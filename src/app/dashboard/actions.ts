"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Contact } from "@/generated/prisma/client";
import {
  decryptContactDetails,
  encryptedContactStorageData,
  type ContactDetails,
} from "@/lib/contact-crypto";
import {
  hasSameContactInformation,
  normalizeContactName,
} from "@/lib/contact-duplicates.js";
import {
  type ContactImportUpdate,
  type ContactInputValues,
  ContactImportInputError,
  MAX_CONTACT_IMPORT_BYTES,
  fetchGoogleSheetCsv,
  type ContactMatchCandidate,
  parseContactSpreadsheet,
  type ContactImportState,
  type SpreadsheetContactRow,
} from "@/lib/contact-spreadsheet";
import { db } from "@/lib/db";

type ContactCreateData = ContactDetails & { userId: string };

type ValidContact = ContactCreateData & { rowNumber: number };
const MAX_CONTACT_UPDATE_CONFIRMATIONS = 20;
const MAX_CONTACT_MATCH_CANDIDATES = 20;

export type AddContactState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | { status: "duplicate"; message: string }
  | {
      status: "confirm-update";
      message: string;
      contact: ContactInputValues;
      candidates: ContactMatchCandidate[];
    }
  | { status: "complete"; message: string };

export type ConfirmContactUpdateState =
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

function parseContactForm(
  formData: FormData,
  requireContactMethod: boolean,
): { values: ContactInputValues; details: ContactDetails } | { error: string } {
  const values: ContactInputValues = {
    name: getText(formData, "name"),
    email: getText(formData, "email"),
    phone: getText(formData, "phone"),
    birthday: getText(formData, "birthday"),
    familyMembers: getText(formData, "familyMembers"),
    addressLine1: getText(formData, "addressLine1"),
    addressLine2: getText(formData, "addressLine2"),
    addressCity: getText(formData, "addressCity"),
    addressRegion: getText(formData, "addressRegion"),
    addressPostalCode: getText(formData, "addressPostalCode"),
    addressCountry: getText(formData, "addressCountry"),
    company: getText(formData, "company"),
    notes: getText(formData, "notes"),
  };

  if (!values.name) return { error: "A contact name is required." };
  if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    return { error: "Enter a valid email address." };
  }
  if (requireContactMethod && !values.email && !values.phone) {
    return { error: "An email address or phone number is required." };
  }
  if (
    !values.addressLine1 ||
    !values.addressCity ||
    !values.addressRegion ||
    !values.addressPostalCode
  ) {
    return { error: "Complete the required mailing address fields." };
  }

  let birthday: Date | null = null;
  if (values.birthday) {
    birthday = new Date(`${values.birthday}T00:00:00.000Z`);
    if (
      Number.isNaN(birthday.getTime()) ||
      birthday.toISOString().slice(0, 10) !== values.birthday
    ) {
      return { error: "Enter a valid birthday." };
    }
  }

  return {
    values,
    details: {
      name: values.name,
      email: values.email || null,
      phone: values.phone || null,
      birthday,
      familyMembers: values.familyMembers || null,
      addressLine1: values.addressLine1,
      addressLine2: values.addressLine2 || null,
      addressCity: values.addressCity,
      addressRegion: values.addressRegion,
      addressPostalCode: values.addressPostalCode,
      addressCountry: values.addressCountry || null,
      company: values.company || null,
      notes: values.notes || null,
      lastContact: null,
    },
  };
}

function contactMatchCandidate(
  contact: { id: string; updatedAt: Date },
  details: ContactDetails,
): ContactMatchCandidate {
  const address = [
    details.addressLine1,
    details.addressCity,
    details.addressRegion,
    details.addressPostalCode,
  ].filter(Boolean);
  return {
    id: contact.id,
    description:
      [details.email, details.phone, details.company, address.join(", ")]
        .filter(Boolean)
        .join(" · ") || "No other identifying details",
    expectedUpdatedAt: contact.updatedAt.toISOString(),
  };
}

function contactInputValues(contact: ValidContact): ContactInputValues {
  return {
    name: contact.name,
    email: contact.email ?? "",
    phone: contact.phone ?? "",
    birthday: contact.birthday?.toISOString().slice(0, 10) ?? "",
    familyMembers: contact.familyMembers ?? "",
    addressLine1: contact.addressLine1 ?? "",
    addressLine2: contact.addressLine2 ?? "",
    addressCity: contact.addressCity ?? "",
    addressRegion: contact.addressRegion ?? "",
    addressPostalCode: contact.addressPostalCode ?? "",
    addressCountry: contact.addressCountry ?? "",
    company: contact.company ?? "",
    notes: contact.notes ?? "",
  };
}

export async function addContact(
  previousState: AddContactState,
  formData: FormData,
): Promise<AddContactState> {
  void previousState;
  const userId = await getUserId();
  const parsed = parseContactForm(formData, true);
  if ("error" in parsed) return { status: "error", message: parsed.error };

  const existingContacts = await db.contact.findMany({ where: { userId } });
  const sameNameContacts = existingContacts
    .map((contact) => ({
      contact,
      details: decryptContactDetails(contact),
    }))
    .filter(
      ({ details }) =>
        normalizeContactName(details.name) ===
        normalizeContactName(parsed.details.name),
    );

  if (sameNameContacts.length > MAX_CONTACT_MATCH_CANDIDATES) {
    return {
      status: "error",
      message: "There are too many contacts with this name to update safely. Review the existing contacts and try again.",
    };
  }

  if (
    sameNameContacts.some(({ details }) =>
      hasSameContactInformation(details, parsed.details),
    )
  ) {
    return {
      status: "duplicate",
      message: "This contact already exists with the same information, so it was not added.",
    };
  }

  if (sameNameContacts.length > 0) {
    return {
      status: "confirm-update",
      message:
        "A contact with this name already exists, but the information is different. Choose whether to update an existing contact.",
      contact: parsed.values,
      candidates: sameNameContacts.map(({ contact, details }) =>
        contactMatchCandidate(contact, details),
      ),
    };
  }

  await db.contact.create({
    data: {
      ...encryptedContactStorageData(parsed.details),
      userId,
    },
  });

  revalidatePath("/dashboard");
  return { status: "complete", message: "Contact added." };
}

export async function confirmContactUpdate(
  previousState: ConfirmContactUpdateState,
  formData: FormData,
): Promise<ConfirmContactUpdateState> {
  void previousState;
  const userId = await getUserId();
  const contactId = getText(formData, "contactId");
  const expectedUpdatedAt = getText(formData, "expectedUpdatedAt");
  if (!contactId || !expectedUpdatedAt) {
    return { status: "error", message: "The contact update could not be confirmed." };
  }

  const parsed = parseContactForm(formData, false);
  if ("error" in parsed) return { status: "error", message: parsed.error };

  const existingContact = await db.contact.findFirst({
    where: { id: contactId, userId },
  });
  if (!existingContact) {
    return { status: "error", message: "That contact could not be found." };
  }

  const existingDetails = decryptContactDetails(existingContact);
  if (
    normalizeContactName(existingDetails.name) !==
    normalizeContactName(parsed.details.name)
  ) {
    return {
      status: "error",
      message: "That contact's name changed. Review the contact and try again.",
    };
  }
  if (existingContact.updatedAt.toISOString() !== expectedUpdatedAt) {
    return {
      status: "error",
      message: "That contact changed since the comparison. Review it and try again.",
    };
  }
  if (hasSameContactInformation(existingDetails, parsed.details)) {
    return { status: "success", message: "The contact already has this information." };
  }

  const result = await db.contact.updateMany({
    where: { id: contactId, userId, updatedAt: existingContact.updatedAt },
    data: {
      ...encryptedContactStorageData({
        ...parsed.details,
        lastContact: existingDetails.lastContact,
      }),
    },
  });
  if (result.count === 0) {
    return { status: "error", message: "That contact could not be found." };
  }

  revalidatePath("/dashboard");
  return { status: "success", message: "Contact information updated." };
}

type ContactUpdateState = { error: string; success: boolean };

export async function updateContact(
  previousState: ContactUpdateState,
  formData: FormData,
): Promise<ContactUpdateState> {
  void previousState;
  const userId = await getUserId();
  const id = getText(formData, "id");
  const name = getText(formData, "name");
  const email = getText(formData, "email");
  const phone = getText(formData, "phone");
  const birthdayValue = getText(formData, "birthday");
  const addressLine1 = getText(formData, "addressLine1");
  const addressLine2 = getText(formData, "addressLine2");
  const addressCity = getText(formData, "addressCity");
  const addressRegion = getText(formData, "addressRegion");
  const addressPostalCode = getText(formData, "addressPostalCode");
  const addressCountry = getText(formData, "addressCountry");

  if (!id) return { error: "A contact id is required.", success: false };
  if (!name) return { error: "A contact name is required.", success: false };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Enter a valid email address.", success: false };
  }
  if (!addressLine1 || !addressCity || !addressRegion || !addressPostalCode) {
    return { error: "Complete the required mailing address fields.", success: false };
  }

  let birthday: Date | null = null;
  if (birthdayValue) {
    birthday = new Date(`${birthdayValue}T00:00:00.000Z`);
    if (
      Number.isNaN(birthday.getTime()) ||
      birthday.toISOString().slice(0, 10) !== birthdayValue
    ) {
      return { error: "Enter a valid birthday.", success: false };
    }
  }

  const existingContact = await db.contact.findFirst({ where: { id, userId } });
  if (!existingContact) {
    return { error: "That contact could not be found.", success: false };
  }
  const existingDetails = decryptContactDetails(existingContact);

  const result = await db.contact.updateMany({
    where: { id, userId },
    data: {
      ...encryptedContactStorageData({
        name,
        email: email || null,
        phone: phone || null,
        birthday,
        familyMembers: getText(formData, "familyMembers") || null,
        addressLine1,
        addressLine2: addressLine2 || null,
        addressCity,
        addressRegion,
        addressPostalCode,
        addressCountry: addressCountry || null,
        company: getText(formData, "company") || null,
        notes: getText(formData, "notes") || null,
        lastContact: existingDetails.lastContact,
      }),
    },
  });
  if (result.count === 0) {
    return { error: "That contact could not be found.", success: false };
  }

  revalidatePath("/dashboard");
  return { error: "", success: true };
}

function parseSpreadsheetBirthday(value: string): Date | null | undefined {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? undefined
    : date;
}

export async function importContacts(
  _previousState: ContactImportState,
  formData: FormData,
): Promise<ContactImportState> {
  const userId = await getUserId();
  const uploadValue = formData.get("file");
  const upload = uploadValue instanceof File && uploadValue.size > 0 ? uploadValue : null;
  const spreadsheetUrl = getText(formData, "spreadsheetUrl");

  if (upload && spreadsheetUrl) {
    return { status: "error", message: "Choose a file or a Google Sheets link, not both." };
  }
  if (!upload && !spreadsheetUrl) {
    return { status: "error", message: "Choose a spreadsheet file or enter a Google Sheets link." };
  }

  let parsed: Awaited<ReturnType<typeof parseContactSpreadsheet>>;
  try {
    let spreadsheet: Buffer;
    let format: "xlsx" | "csv";

    if (upload) {
      const extension = upload.name.toLowerCase().split(".").at(-1);
      if (extension !== "xlsx" && extension !== "csv") {
        return { status: "error", message: "Upload an .xlsx or .csv file." };
      }
      if (upload.size > MAX_CONTACT_IMPORT_BYTES) {
        return { status: "error", message: "The spreadsheet must be no larger than 4 MB." };
      }
      spreadsheet = Buffer.from(await upload.arrayBuffer());
      format = extension;
    } else {
      spreadsheet = await fetchGoogleSheetCsv(spreadsheetUrl);
      format = "csv";
    }

    parsed = await parseContactSpreadsheet(spreadsheet, format);
  } catch (error) {
    if (error instanceof ContactImportInputError) {
      return { status: "error", message: error.message };
    }
    console.error("Could not read contact spreadsheet.", error);
    return {
      status: "error",
      message: "Could not read the spreadsheet. Check the file or public Google Sheets link and try again.",
    };
  }

  if (parsed.rows.length === 0) {
    return { status: "error", message: "The spreadsheet does not contain any contact rows." };
  }

  const issues: string[] = [];
  let additionalIssues = 0;
  let skipped = parsed.rowLimitSkipped;
  const addIssue = (message: string, countsAsSkipped = true) => {
    if (countsAsSkipped) skipped += 1;
    if (issues.length < 20) issues.push(message);
    else additionalIssues += 1;
  };
  if (parsed.rowLimitSkipped > 0) {
    addIssue(
      `${parsed.rowLimitSkipped} additional rows were skipped because the import limit is 5,000 rows.`,
      false,
    );
  }

  const validContacts: ValidContact[] = [];
  for (const row of parsed.rows) {
    const invalidReason = validateSpreadsheetRow(row);
    if (invalidReason) {
      addIssue(`Row ${row.rowNumber}: ${invalidReason}`);
      continue;
    }

    const birthday = parseSpreadsheetBirthday(row.birthday);
    if (birthday === undefined) {
      addIssue(`Row ${row.rowNumber}: birthday must be a valid date in YYYY-MM-DD format.`);
      continue;
    }

    validContacts.push({
      rowNumber: row.rowNumber,
      name: row.name,
      email: row.email || null,
      phone: row.phone || null,
      birthday,
      familyMembers: row.familyMembers || null,
      addressLine1: row.addressLine1,
      addressLine2: row.addressLine2 || null,
      addressCity: row.addressCity,
      addressRegion: row.addressRegion,
      addressPostalCode: row.addressPostalCode,
      addressCountry: row.addressCountry || null,
      company: row.company || null,
      notes: row.notes || null,
      lastContact: null,
      userId,
    });
  }

  const contactsToCreate: ValidContact[] = [];
  const importedByName = new Map<string, ValidContact>();
  const pendingDetailsByName = new Map<string, ContactDetails[]>();
  const namesWithPendingUpdates = new Set<string>();
  const pendingImportUpdates: {
    rowNumber: number;
    contact: ContactInputValues;
    candidates: ContactMatchCandidate[] | null;
    targetName: string | null;
  }[] = [];

  if (validContacts.length > 0) {
    const storedContacts = await db.contact.findMany({
      where: { userId },
    });
    const existingByName = new Map<
      string,
      { contact: (typeof storedContacts)[number]; details: ContactDetails }[]
    >();
    for (const contact of storedContacts) {
      const details = decryptContactDetails(contact);
      const name = normalizeContactName(details.name);
      const matches = existingByName.get(name) ?? [];
      matches.push({ contact, details });
      existingByName.set(name, matches);
    }

    for (const contact of validContacts) {
      const name = normalizeContactName(contact.name);
      const existingMatches = existingByName.get(name) ?? [];
      const firstImported = importedByName.get(name);
      const previouslySeenDetails = [
        ...existingMatches.map(({ details }) => details),
        ...(firstImported ? [firstImported] : []),
        ...(pendingDetailsByName.get(name) ?? []),
      ];

      if (
        previouslySeenDetails.some((details) =>
          hasSameContactInformation(details, contact),
        )
      ) {
        addIssue(`Row ${contact.rowNumber}: same name and contact information already exist; skipped.`);
        continue;
      }

      if (namesWithPendingUpdates.has(name)) {
        addIssue(
          `Row ${contact.rowNumber}: another differing row with this name is already awaiting confirmation; skipped.`,
        );
        continue;
      }

      if (existingMatches.length > 0) {
        namesWithPendingUpdates.add(name);
        pendingImportUpdates.push({
          rowNumber: contact.rowNumber,
          contact: contactInputValues(contact),
          candidates: existingMatches.map(({ contact: existing, details }) =>
            contactMatchCandidate(existing, details),
          ),
          targetName: null,
        });
        const pending = pendingDetailsByName.get(name) ?? [];
        pending.push(contact);
        pendingDetailsByName.set(name, pending);
        continue;
      }

      if (firstImported) {
        namesWithPendingUpdates.add(name);
        pendingImportUpdates.push({
          rowNumber: contact.rowNumber,
          contact: contactInputValues(contact),
          candidates: null,
          targetName: name,
        });
        const pending = pendingDetailsByName.get(name) ?? [];
        pending.push(contact);
        pendingDetailsByName.set(name, pending);
        continue;
      }

      importedByName.set(name, contact);
      contactsToCreate.push(contact);
    }
  }

  const contactsMissingMethods = [
    ...contactsToCreate.filter((contact) => !contact.email && !contact.phone),
    ...pendingImportUpdates
      .filter(({ contact }) => !contact.email && !contact.phone)
      .map(({ rowNumber }) => ({ rowNumber })),
  ];
  const warnings = contactsMissingMethods
    .slice(0, 20)
    .map((contact) => `Row ${contact.rowNumber}: no email address or phone number was provided.`);
  const additionalWarnings = Math.max(0, contactsMissingMethods.length - warnings.length);

  let imported = 0;
  if (contactsToCreate.length > 0) {
    imported = await db.$transaction(async (transaction) => {
      let count = 0;
      for (let index = 0; index < contactsToCreate.length; index += 500) {
        const batch = contactsToCreate.slice(index, index + 500);
        count += (
          await transaction.contact.createMany({
            data: batch.map((contact) => ({
              ...encryptedContactStorageData(contact),
              userId: contact.userId,
            })),
          })
        ).count;
      }
      return count;
    }, { timeout: 30_000 });
    revalidatePath("/dashboard");
  }

  const pendingUpdates: ContactImportUpdate[] = [];
  const newContactTargets = new Set(
    pendingImportUpdates.flatMap((update) =>
      update.targetName ? [update.targetName] : [],
    ),
  );
  const newContactMatches = new Map<
    string,
    { contact: Contact; details: ContactDetails }[]
  >();

  if (newContactTargets.size > 0) {
    const storedContacts = await db.contact.findMany({
      where: { userId },
    });
    for (const contact of storedContacts) {
      const details = decryptContactDetails(contact);
      const name = normalizeContactName(details.name);
      if (!newContactTargets.has(name)) continue;
      const matches = newContactMatches.get(name) ?? [];
      matches.push({ contact, details });
      newContactMatches.set(name, matches);
    }
  }

  for (const update of pendingImportUpdates) {
    let candidates = update.candidates;
    if (update.targetName) {
      const matches = newContactMatches.get(update.targetName) ?? [];
      if (matches.length !== 1) {
        addIssue(
          `Row ${update.rowNumber}: another contact with this name appeared during import; skipped to avoid updating the wrong contact.`,
        );
        continue;
      }
      candidates = [
        contactMatchCandidate(matches[0].contact, matches[0].details),
      ];
    }

    if (
      !candidates ||
      candidates.length > MAX_CONTACT_MATCH_CANDIDATES ||
      pendingUpdates.length >= MAX_CONTACT_UPDATE_CONFIRMATIONS
    ) {
      addIssue(
        `Row ${update.rowNumber}: too many same-name contacts or update requests to confirm safely; skipped.`,
      );
      continue;
    }

    pendingUpdates.push({
      rowNumber: update.rowNumber,
      contact: update.contact,
      candidates,
    });
  }

  return {
    status: "complete",
    imported,
    skipped,
    issues,
    additionalIssues,
    warnings,
    additionalWarnings,
    pendingUpdates,
  };
}

function validateSpreadsheetRow(row: SpreadsheetContactRow) {
  if (!row.name) return "name is required.";
  if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
    return "email is not valid.";
  }
  if (
    !row.addressLine1 ||
    !row.addressCity ||
    !row.addressRegion ||
    !row.addressPostalCode
  ) {
    return "complete all required mailing address fields.";
  }
  return null;
}

export async function deleteContact(formData: FormData) {
  const userId = await getUserId();
  const id = String(formData.get("id") ?? "");
  if (!id) throw new Error("A contact id is required.");

  await db.contact.deleteMany({ where: { id, userId } });
  revalidatePath("/dashboard");
}

export async function eraseContacts() {
  if (process.env.NODE_ENV !== "development") {
    throw new Error("Erasing contacts is only available in development.");
  }

  const userId = await getUserId();
  await db.contact.deleteMany({ where: { userId } });
  revalidatePath("/dashboard");
}
