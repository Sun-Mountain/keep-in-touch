"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { decryptContactDetails } from "@/lib/contact-crypto";
import { db } from "@/lib/db";

const MAX_MAILING_LIST_MEMBERS = 5_000;

export type CreateMailingListState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "success"; message: string };

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  return session.user.id;
}

function getText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function createMailingList(
  _previousState: CreateMailingListState,
  formData: FormData,
): Promise<CreateMailingListState> {
  const userId = await getUserId();
  const name = getText(formData, "name");
  if (!name || name.length > 80) {
    return { status: "error", message: "Enter a list name up to 80 characters." };
  }

  const rawIds = formData.getAll("contactId");
  if (
    rawIds.length === 0 ||
    rawIds.length > MAX_MAILING_LIST_MEMBERS ||
    rawIds.some((id) => typeof id !== "string" || !id.trim())
  ) {
    return {
      status: "error",
      message: `Choose between 1 and ${MAX_MAILING_LIST_MEMBERS} contacts.`,
    };
  }

  const contactIds = rawIds.map((id) => String(id).trim());
  if (new Set(contactIds).size !== contactIds.length) {
    return { status: "error", message: "A contact was selected more than once." };
  }

  const contacts = await db.contact.findMany({
    where: { userId, id: { in: contactIds } },
  });
  if (contacts.length !== contactIds.length) {
    return { status: "error", message: "Some selected contacts are unavailable." };
  }

  const contactsById = new Map(
    contacts.map((contact) => [
      contact.id,
      decryptContactDetails(contact),
    ]),
  );
  const hasIncompleteAddress = contactIds.some((id) => {
    const contact = contactsById.get(id);
    return (
      !contact?.addressLine1?.trim() ||
      !contact.addressCity?.trim() ||
      !contact.addressRegion?.trim() ||
      !contact.addressPostalCode?.trim()
    );
  });
  if (hasIncompleteAddress) {
    return {
      status: "error",
      message: "Every selected contact needs a complete mailing address.",
    };
  }

  const normalizedName = name.normalize("NFKC").replace(/\s+/g, " ").toLowerCase();
  const existingList = await db.mailingList.findUnique({
    where: { userId_normalizedName: { userId, normalizedName } },
    select: { id: true },
  });
  if (existingList) {
    return { status: "error", message: "You already have a mailing list with that name." };
  }

  await db.mailingList.create({
    data: {
      userId,
      name: name.replace(/\s+/g, " "),
      normalizedName,
      members: {
        create: contactIds.map((contactId) => ({ contactId })),
      },
    },
  });
  revalidatePath("/dashboard/mailing-lists");
  return { status: "success", message: `Saved "${name}" mailing list.` };
}

export async function updateMailingListAddressSent(formData: FormData) {
  const userId = await getUserId();
  const { mailingListId, contactIds } = parseMailingListAddress(formData);

  const result = await db.mailingListContact.updateMany({
    where: {
      mailingListId,
      contactId: { in: contactIds },
      mailingList: { userId },
      contact: { userId },
    },
    data: {
      sentAt: getText(formData, "sent") === "true" ? new Date() : null,
    },
  });
  if (result.count !== contactIds.length) {
    throw new Error("Some mailing-list members could not be updated.");
  }

  revalidatePath("/dashboard/mailing-lists");
}

export async function updateMailingListAddressName(formData: FormData) {
  const userId = await getUserId();
  const { mailingListId, contactIds } = parseMailingListAddress(formData);
  const addressLabelName = getText(formData, "addressLabelName")
    .replace(/\s+/g, " ");
  if (addressLabelName.length > 100) {
    throw new Error("An address label name must be 100 characters or fewer.");
  }

  const result = await db.mailingListContact.updateMany({
    where: {
      mailingListId,
      contactId: { in: contactIds },
      mailingList: { userId },
      contact: { userId },
    },
    data: { addressLabelName: addressLabelName || null },
  });
  if (result.count !== contactIds.length) {
    throw new Error("Some mailing-list members could not be updated.");
  }

  revalidatePath("/dashboard/mailing-lists");
}

export async function deleteMailingList(formData: FormData) {
  const userId = await getUserId();
  const id = getText(formData, "id");
  if (!id) throw new Error("A mailing list ID is required.");

  await db.mailingList.deleteMany({ where: { id, userId } });
  revalidatePath("/dashboard/mailing-lists");
}

function parseMailingListAddress(formData: FormData) {
  const mailingListId = getText(formData, "mailingListId");
  const rawIds = formData.getAll("contactId");
  if (
    !mailingListId ||
    rawIds.length === 0 ||
    rawIds.length > MAX_MAILING_LIST_MEMBERS ||
    rawIds.some((id) => typeof id !== "string" || !id.trim())
  ) {
    throw new Error("A mailing list and its address members are required.");
  }

  const contactIds = rawIds.map((id) => String(id).trim());
  if (new Set(contactIds).size !== contactIds.length) {
    throw new Error("A mailing-list member was submitted more than once.");
  }
  return { mailingListId, contactIds };
}
