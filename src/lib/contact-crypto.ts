import type { Contact } from "@/generated/prisma/client";
import {
  decryptPayload,
  encryptPayload,
  serializeContactDetails,
} from "./contact-crypto-core.js";

export { assertContactEncryptionKeyConfigured } from "./contact-crypto-core.js";

export type ContactDetails = {
  name: string;
  email: string | null;
  phone: string | null;
  birthday: Date | null;
  familyMembers: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  addressCity: string | null;
  addressRegion: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
  addressLabelName: string | null;
  company: string | null;
  notes: string | null;
  lastContact: Date | null;
};

const ENCRYPTED_CONTACT_NAME = "[encrypted]";
type ContactStorageRecord = Pick<
  Contact,
  Exclude<keyof ContactDetails, "addressLabelName"> | "encryptedData"
>;

export function encryptContactDetails(details: ContactDetails) {
  return encryptPayload(serializeContactDetails(details));
}

function parseDate(value: unknown, dateOnly: boolean): Date | null {
  if (value === null) return null;
  if (typeof value !== "string") {
    throw new Error("Encrypted contact data contains an invalid date.");
  }

  const date = new Date(dateOnly ? `${value}T00:00:00.000Z` : value);
  if (
    Number.isNaN(date.getTime()) ||
    (dateOnly && date.toISOString().slice(0, 10) !== value)
  ) {
    throw new Error("Encrypted contact data contains an invalid date.");
  }
  return date;
}

function parseContactDetails(value: unknown): ContactDetails {
  if (typeof value !== "object" || value === null) {
    throw new Error("Encrypted contact data has an invalid format.");
  }

  const data = value as Record<string, unknown>;
  const stringFields = [
    "email",
    "phone",
    "familyMembers",
    "addressLine1",
    "addressLine2",
    "addressCity",
    "addressRegion",
    "addressPostalCode",
    "addressCountry",
    "addressLabelName",
    "company",
    "notes",
  ] as const;

  if (typeof data.name !== "string") {
    throw new Error("Encrypted contact data has an invalid format.");
  }
  for (const field of stringFields) {
    if (field === "addressLabelName" && data[field] === undefined) continue;
    if (data[field] !== null && typeof data[field] !== "string") {
      throw new Error("Encrypted contact data has an invalid format.");
    }
  }

  return {
    name: data.name,
    email: data.email as string | null,
    phone: data.phone as string | null,
    birthday: parseDate(data.birthday, true),
    familyMembers: data.familyMembers as string | null,
    addressLine1: data.addressLine1 as string | null,
    addressLine2: data.addressLine2 as string | null,
    addressCity: data.addressCity as string | null,
    addressRegion: data.addressRegion as string | null,
    addressPostalCode: data.addressPostalCode as string | null,
    addressCountry: data.addressCountry as string | null,
    addressLabelName: (data.addressLabelName as string | null | undefined) ?? null,
    company: data.company as string | null,
    notes: data.notes as string | null,
    lastContact: parseDate(data.lastContact, false),
  };
}

export function decryptContactDetails(contact: ContactStorageRecord): ContactDetails {
  if (contact.encryptedData === null) {
    if (contact.name === ENCRYPTED_CONTACT_NAME) {
      throw new Error("Encrypted contact data is missing.");
    }

    return {
      name: contact.name,
      email: contact.email,
      phone: contact.phone,
      birthday: contact.birthday,
      familyMembers: contact.familyMembers,
      addressLine1: contact.addressLine1,
      addressLine2: contact.addressLine2,
      addressCity: contact.addressCity,
      addressRegion: contact.addressRegion,
      addressPostalCode: contact.addressPostalCode,
      addressCountry: contact.addressCountry,
      addressLabelName: null,
      company: contact.company,
      notes: contact.notes,
      lastContact: contact.lastContact,
    };
  }

  const plaintext = decryptPayload(contact.encryptedData);

  let parsed: unknown;
  try {
    parsed = JSON.parse(plaintext);
  } catch {
    throw new Error("Encrypted contact data has an invalid format.");
  }
  return parseContactDetails(parsed);
}

export function encryptedContactStorageData(details: ContactDetails) {
  return {
    name: ENCRYPTED_CONTACT_NAME,
    encryptedData: encryptContactDetails(details),
    email: null,
    phone: null,
    birthday: null,
    familyMembers: null,
    addressLine1: null,
    addressLine2: null,
    addressCity: null,
    addressRegion: null,
    addressPostalCode: null,
    addressCountry: null,
    company: null,
    notes: null,
    lastContact: null,
  };
}
