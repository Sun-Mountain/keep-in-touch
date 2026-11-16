"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  assertContactEncryptionKeyConfigured,
  decryptContactDetails,
} from "@/lib/contact-crypto";
import {
  MAX_OUTREACH_RECIPIENTS,
  renderOutreachTemplate,
} from "@/lib/contact-outreach.js";
import { auth } from "@/lib/auth";
import {
  GmailOAuthError,
  GmailReconnectError,
  getGoogleOAuthConfig,
  refreshGmailAccessToken,
  sendGmailMessage,
} from "@/lib/gmail";
import { isValidOutreachEmail } from "@/lib/gmail-api-core.js";
import {
  createProtonTransporter,
  decryptProtonSmtpToken,
  encryptProtonSmtpToken,
  ProtonSMTPError,
  sendProtonMessage,
  verifyProtonSmtp,
} from "@/lib/proton-smtp";
import { db } from "@/lib/db";

export type OutreachSendState =
  | { status: "idle" }
  | { status: "error"; message: string; sentContactIds?: string[] }
  | { status: "sent"; count: number }
  | {
      status: "partial";
      sent: number;
      total: number;
      contactName: string;
      sentContactIds: string[];
    };

export type ProtonConnectionState =
  | { status: "idle" }
  | { status: "connected"; message: string }
  | { status: "error"; message: string };

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  return session.user.id;
}

function getText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

function providerErrorMessage(error: unknown) {
  if (
    error instanceof GmailReconnectError ||
    error instanceof GmailOAuthError ||
    error instanceof ProtonSMTPError
  ) {
    return error.message;
  }
  return null;
}

export async function connectProton(
  _previousState: ProtonConnectionState,
  formData: FormData,
): Promise<ProtonConnectionState> {
  const userId = await getUserId();
  const email = getText(formData, "protonEmail").toLowerCase();
  const smtpToken = getText(formData, "smtpToken");
  if (!isValidOutreachEmail(email) || email.length > 254) {
    return { status: "error", message: "Enter a valid custom-domain email address." };
  }
  if (!smtpToken || smtpToken.length > 4_096 || /[\r\n]/.test(smtpToken)) {
    return { status: "error", message: "Enter a valid Proton SMTP token." };
  }

  try {
    assertContactEncryptionKeyConfigured();
    await verifyProtonSmtp(email, smtpToken);
    const encryptedSmtpToken = encryptProtonSmtpToken(smtpToken);
    await db.protonConnection.upsert({
      where: { userId },
      update: {
        email,
        encryptedSmtpToken,
      },
      create: {
        userId,
        email,
        encryptedSmtpToken,
      },
    });
    revalidatePath("/dashboard");
    return { status: "connected", message: "Proton SMTP was connected successfully." };
  } catch (error) {
    if (error instanceof ProtonSMTPError) {
      return { status: "error", message: error.message };
    }
    throw error;
  }
}

export async function disconnectProton() {
  const userId = await getUserId();
  await db.protonConnection.deleteMany({ where: { userId } });
  revalidatePath("/dashboard");
}

export async function disconnectGmail() {
  const userId = await getUserId();
  await db.gmailConnection.deleteMany({ where: { userId } });
  revalidatePath("/dashboard");
}

export async function sendEmailOutreach(
  previousState: OutreachSendState,
  formData: FormData,
): Promise<OutreachSendState> {
  const userId = await getUserId();
  const provider = getText(formData, "provider");
  const rawIds = formData.getAll("contactId");
  const previousSentIds =
    previousState.status === "partial"
      ? previousState.sentContactIds
      : previousState.status === "error"
        ? previousState.sentContactIds ?? []
        : [];
  const includesPreviouslySentContact = rawIds.some(
    (id) => typeof id === "string" && previousSentIds.includes(id.trim()),
  );
  const retainedSentIds = includesPreviouslySentContact ? [] : previousSentIds;
  const errorState = (message: string): OutreachSendState => ({
    status: "error",
    message,
    ...(retainedSentIds.length > 0 ? { sentContactIds: retainedSentIds } : {}),
  });

  if (provider !== "gmail" && provider !== "proton") {
    return errorState("Choose an email provider before sending.");
  }
  if (
    rawIds.length === 0 ||
    rawIds.length > MAX_OUTREACH_RECIPIENTS ||
    rawIds.some((id) => typeof id !== "string" || !id.trim())
  ) {
    return errorState(`Choose between 1 and ${MAX_OUTREACH_RECIPIENTS} contacts.`);
  }

  const contactIds = rawIds.map((id) => String(id).trim());
  if (new Set(contactIds).size !== contactIds.length) {
    return errorState("A contact was selected more than once.");
  }

  const subjectTemplate = getText(formData, "subject");
  const messageTemplate = getText(formData, "message");
  if (
    !subjectTemplate ||
    subjectTemplate.length > 200 ||
    /[\r\n]/.test(subjectTemplate)
  ) {
    return errorState("Enter a subject of up to 200 characters on one line.");
  }
  if (!messageTemplate || messageTemplate.length > 5_000) {
    return errorState("Enter a message of up to 5,000 characters.");
  }

  let googleConfig: ReturnType<typeof getGoogleOAuthConfig> = null;
  if (provider === "gmail") {
    try {
      googleConfig = getGoogleOAuthConfig();
    } catch (error) {
      if (error instanceof GmailOAuthError) return errorState(error.message);
      throw error;
    }
    if (!googleConfig) {
      return errorState("Gmail sending is not configured on this server.");
    }
  }

  const storedContacts = await db.contact.findMany({
    where: { userId, id: { in: contactIds } },
  });
  if (storedContacts.length !== contactIds.length) {
    return errorState("Some selected contacts are no longer available.");
  }

  const contactsById = new Map(
    storedContacts.map((contact) => [
      contact.id,
      { contact, details: decryptContactDetails(contact) },
    ]),
  );
  const recipients = contactIds.map((id) => contactsById.get(id));
  if (recipients.some((recipient) => !recipient)) {
    return errorState("Some selected contacts are no longer available.");
  }

  const availableRecipients = recipients.filter(
    (recipient): recipient is NonNullable<typeof recipient> => recipient !== undefined,
  );
  const prepared = availableRecipients.map((recipient) => {
    const email = recipient.details.email?.trim().toLowerCase() ?? "";
    return {
      name: recipient.details.name,
      email,
      valid: isValidOutreachEmail(email),
    };
  });
  if (prepared.some((recipient) => !recipient.valid)) {
    return errorState(
      "Every selected contact needs a valid email address to send email.",
    );
  }

  let sendMessage: (to: string, subject: string, body: string) => Promise<void>;
  let protonTransporter: ReturnType<typeof createProtonTransporter> | null = null;
  if (provider === "gmail") {
    const config = googleConfig;
    if (!config) {
      return errorState("Gmail sending is not configured on this server.");
    }
    const connection = await db.gmailConnection.findUnique({
      where: { userId },
      select: { encryptedRefreshToken: true },
    });
    if (!connection) {
      return errorState("Connect a Gmail account before sending email.");
    }

    let accessToken: string;
    try {
      accessToken = await refreshGmailAccessToken(
        config,
        connection.encryptedRefreshToken,
      );
    } catch (error) {
      const message = providerErrorMessage(error);
      if (message) return errorState(message);
      throw error;
    }
    sendMessage = (to, subject, body) =>
      sendGmailMessage(accessToken, to, subject, body);
  } else {
    const connection = await db.protonConnection.findUnique({
      where: { userId },
      select: { email: true, encryptedSmtpToken: true },
    });
    if (!connection) {
      return errorState("Connect Proton SMTP before sending email.");
    }
    try {
      const transporter = createProtonTransporter(
        connection.email,
        decryptProtonSmtpToken(connection.encryptedSmtpToken),
      );
      protonTransporter = transporter;
      sendMessage = (to, subject, body) =>
        sendProtonMessage(transporter, connection.email, to, subject, body);
    } catch (error) {
      const message = providerErrorMessage(error);
      if (message) return errorState(message);
      throw error;
    }
  }

  let sent = 0;
  const sentContactIds: string[] = [];
  try {
    for (const [index, recipient] of prepared.entries()) {
      try {
        await sendMessage(
          recipient.email,
          renderOutreachTemplate(
            subjectTemplate,
            recipient.name.replace(/[\r\n]+/g, " "),
          ),
          renderOutreachTemplate(messageTemplate, recipient.name),
        );
        sent += 1;
        sentContactIds.push(contactIds[index]);
      } catch (error) {
        const message = providerErrorMessage(error);
        if (!message) throw error;
        console.error("Email outreach stopped after a provider error.", message);
        return sent === 0
          ? errorState(message)
          : {
              status: "partial",
              sent,
              total: prepared.length,
              contactName: recipient.name,
              sentContactIds: [...retainedSentIds, ...sentContactIds],
            };
      }
    }
  } finally {
    protonTransporter?.close();
  }

  revalidatePath("/dashboard");
  return { status: "sent", count: sent };
}
