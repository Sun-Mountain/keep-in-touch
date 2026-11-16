"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import {
  ContactImportInputError,
  MAX_CONTACT_IMPORT_BYTES,
  fetchGoogleSheetCsv,
  parseContactSpreadsheet,
  type ContactImportState,
  type SpreadsheetContactRow,
} from "@/lib/contact-spreadsheet";
import { db } from "@/lib/db";

type ContactCreateData = {
  name: string;
  email: string | null;
  phone: string | null;
  birthday: Date | null;
  familyMembers: string | null;
  addressLine1: string;
  addressLine2: string | null;
  addressCity: string;
  addressRegion: string;
  addressPostalCode: string;
  addressCountry: string | null;
  company: string | null;
  notes: string | null;
  userId: string;
};

type ValidContact = ContactCreateData & { rowNumber: number };

async function getUserId() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");
  return session.user.id;
}

function getText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export async function addContact(formData: FormData) {
  const userId = await getUserId();
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

  if (!name) throw new Error("A contact name is required.");
  if (!email && !phone) {
    throw new Error("An email address or phone number is required.");
  }
  if (!addressLine1 || !addressCity || !addressRegion || !addressPostalCode) {
    throw new Error("Complete the required mailing address fields.");
  }

  let birthday: Date | null = null;
  if (birthdayValue) {
    birthday = new Date(`${birthdayValue}T00:00:00.000Z`);
    if (
      Number.isNaN(birthday.getTime()) ||
      birthday.toISOString().slice(0, 10) !== birthdayValue
    ) {
      throw new Error("Enter a valid birthday.");
    }
  }

  await db.contact.create({
    data: {
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
      userId,
    },
  });

  revalidatePath("/dashboard");
}

function parseSpreadsheetBirthday(value: string): Date | null | undefined {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;

  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value
    ? undefined
    : date;
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function duplicateKeys(contact: Pick<ContactCreateData, "name" | "email" | "phone">) {
  const name = normalizeName(contact.name);
  const keys: string[] = [];
  if (contact.email) keys.push(`${name}\u0000email:${contact.email.trim().toLowerCase()}`);
  if (contact.phone) keys.push(`${name}\u0000phone:${contact.phone.replace(/\D/g, "")}`);
  return keys;
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
      userId,
    });
  }

  let contactsToCreate: ValidContact[] = validContacts;
  if (validContacts.length > 0) {
    const existingContacts = await db.contact.findMany({
      where: { userId },
      select: { name: true, email: true, phone: true },
    });
    const seenKeys = new Set(existingContacts.flatMap(duplicateKeys));
    contactsToCreate = [];

    for (let index = 0; index < validContacts.length; index += 1) {
      const contact = validContacts[index];
      if (duplicateKeys(contact).some((key) => seenKeys.has(key))) {
        addIssue(`Row ${contact.rowNumber}: matches an existing or earlier contact.`);
        continue;
      }

      duplicateKeys(contact).forEach((key) => seenKeys.add(key));
      contactsToCreate.push(contact);
    }
  }

  const contactsMissingMethods = contactsToCreate.filter(
    (contact) => !contact.email && !contact.phone,
  );
  const warnings = contactsMissingMethods
    .slice(0, 20)
    .map((contact) => `Row ${contact.rowNumber}: imported without an email address or phone number.`);
  const additionalWarnings = Math.max(0, contactsMissingMethods.length - warnings.length);

  let imported = 0;
  if (contactsToCreate.length > 0) {
    imported = await db.$transaction(async (transaction) => {
      let count = 0;
      for (let index = 0; index < contactsToCreate.length; index += 500) {
        const batch = contactsToCreate.slice(index, index + 500);
        count += (
          await transaction.contact.createMany({
            data: batch.map((contact) => {
              const { rowNumber, ...contactData } = contact;
              void rowNumber;
              return contactData;
            }),
          })
        ).count;
      }
      return count;
    }, { timeout: 30_000 });
    revalidatePath("/dashboard");
  }

  return {
    status: "complete",
    imported,
    skipped,
    issues,
    additionalIssues,
    warnings,
    additionalWarnings,
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
