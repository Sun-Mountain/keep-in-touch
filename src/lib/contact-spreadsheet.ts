import ExcelJS from "exceljs";
import type { CellValue } from "exceljs";
import { Readable } from "node:stream";

export const MAX_CONTACT_IMPORT_BYTES = 4 * 1024 * 1024;
export const MAX_CONTACT_IMPORT_ROWS = 5_000;

export type ContactImportState =
  | { status: "idle" }
  | { status: "error"; message: string }
  | {
      status: "complete";
      imported: number;
      skipped: number;
      issues: string[];
      additionalIssues: number;
      warnings: string[];
      additionalWarnings: number;
      pendingUpdates: ContactImportUpdate[];
    };

export type SpreadsheetContactRow = {
  rowNumber: number;
  name: string;
  email: string;
  phone: string;
  birthday: string;
  familyMembers: string;
  addressLine1: string;
  addressLine2: string;
  addressCity: string;
  addressRegion: string;
  addressPostalCode: string;
  addressCountry: string;
  company: string;
  notes: string;
};

export type ContactInputValues = Omit<SpreadsheetContactRow, "rowNumber">;

export type ContactMatchCandidate = {
  id: string;
  description: string;
  expectedUpdatedAt: string;
};

export type ContactImportUpdate = {
  rowNumber: number;
  contact: ContactInputValues;
  candidates: ContactMatchCandidate[];
};

type ContactField = Exclude<keyof SpreadsheetContactRow, "rowNumber">;

const CONTACT_FIELDS: ContactField[] = [
  "name",
  "email",
  "phone",
  "birthday",
  "familyMembers",
  "addressLine1",
  "addressLine2",
  "addressCity",
  "addressRegion",
  "addressPostalCode",
  "addressCountry",
  "company",
  "notes",
];

const HEADER_ALIASES: Record<ContactField, string[]> = {
  name: ["name", "fullname", "contactname"],
  email: ["email", "emailaddress"],
  phone: ["phone", "phonenumber", "mobile"],
  birthday: ["birthday", "birthdate"],
  familyMembers: ["familymembers", "familymembernames", "family"],
  addressLine1: ["addressline1", "streetaddress", "street"],
  addressLine2: ["addressline2", "apartment", "suite"],
  addressCity: ["addresscity", "city"],
  addressRegion: ["addressregion", "state", "province", "stateprovince", "region"],
  addressPostalCode: ["addresspostalcode", "postalcode", "zipcode", "zip"],
  addressCountry: ["addresscountry", "country"],
  company: ["company", "organization"],
  notes: ["notes"],
};

export class ContactImportInputError extends Error {}

function normalizeHeader(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function cellText(value: CellValue): string {
  if (value == null) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value !== "object") return String(value).trim();
  if ("richText" in value) return value.richText.map((part) => part.text).join("").trim();
  if ("text" in value) return value.text.trim();
  if ("result" in value) {
    const result = value.result;
    if (result == null || (typeof result === "object" && !(result instanceof Date))) return "";
    return cellText(result);
  }
  return "";
}

export async function parseContactSpreadsheet(
  buffer: Buffer,
  format: "xlsx" | "csv",
) {
  const workbook = new ExcelJS.Workbook();
  if (format === "xlsx") {
    await workbook.xlsx.read(Readable.from([buffer]));
  } else {
    await workbook.csv.read(Readable.from([buffer]));
  }

  const worksheet = workbook.worksheets[0];
  if (!worksheet) {
    throw new ContactImportInputError("The spreadsheet does not contain a worksheet.");
  }

  const headerRow = worksheet.getRow(1);
  const columns = new Map<ContactField, number>();
  for (let column = 1; column <= headerRow.cellCount; column += 1) {
    const header = normalizeHeader(cellText(headerRow.getCell(column).value));
    const field = CONTACT_FIELDS.find((key) =>
      HEADER_ALIASES[key].includes(header),
    );
    if (field && !columns.has(field)) columns.set(field, column);
  }

  const requiredHeaders: ContactField[] = [
    "name",
    "addressLine1",
    "addressCity",
    "addressRegion",
    "addressPostalCode",
  ];
  const missingHeaders = requiredHeaders.filter((field) => !columns.has(field));
  if (missingHeaders.length > 0) {
    throw new ContactImportInputError(
      `Missing required columns: ${missingHeaders.join(", ")}.`,
    );
  }
  const rows: SpreadsheetContactRow[] = [];
  let rowLimitSkipped = 0;
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const readCell = (field: ContactField) => {
      const column = columns.get(field);
      return column === undefined ? "" : cellText(row.getCell(column).value);
    };
    const fields = {
      name: readCell("name"),
      email: readCell("email"),
      phone: readCell("phone"),
      birthday: readCell("birthday"),
      familyMembers: readCell("familyMembers"),
      addressLine1: readCell("addressLine1"),
      addressLine2: readCell("addressLine2"),
      addressCity: readCell("addressCity"),
      addressRegion: readCell("addressRegion"),
      addressPostalCode: readCell("addressPostalCode"),
      addressCountry: readCell("addressCountry"),
      company: readCell("company"),
      notes: readCell("notes"),
    };

    if (Object.values(fields).every((value) => !value)) return;
    if (rows.length >= MAX_CONTACT_IMPORT_ROWS) {
      rowLimitSkipped += 1;
      return;
    }

    rows.push({ rowNumber, ...fields });
  });

  return { rows, rowLimitSkipped };
}

function googleSheetsExportUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ContactImportInputError("Enter a valid Google Sheets link.");
  }

  if (
    url.protocol !== "https:" ||
    url.hostname !== "docs.google.com" ||
    url.port ||
    url.username ||
    url.password
  ) {
    throw new ContactImportInputError("Use a Google Sheets link from docs.google.com.");
  }

  const publishedMatch = url.pathname.match(
    /^\/spreadsheets\/d\/e\/([A-Za-z0-9_-]+)\/pubhtml\/?$/,
  );
  const sheetMatch = url.pathname.match(
    /^\/spreadsheets\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]+)(?:\/|$)/,
  );
  const sheetId = publishedMatch?.[1] ?? sheetMatch?.[1];
  if (!sheetId) {
    throw new ContactImportInputError("Use a Google Sheets spreadsheet link.");
  }

  const gid = url.searchParams.get("gid") ?? new URLSearchParams(url.hash.slice(1)).get("gid");
  if (gid && !/^\d+$/.test(gid)) {
    throw new ContactImportInputError("The Google Sheets tab link is invalid.");
  }

  const exportUrl = publishedMatch
    ? new URL(`https://docs.google.com/spreadsheets/d/e/${sheetId}/pub`)
    : new URL(`https://docs.google.com/spreadsheets/d/${sheetId}/export`);
  exportUrl.searchParams.set(publishedMatch ? "output" : "format", "csv");
  if (gid) exportUrl.searchParams.set("gid", gid);
  return exportUrl;
}

async function readLimitedResponse(response: Response) {
  const reader = response.body?.getReader();
  if (!reader) throw new ContactImportInputError("Google Sheets returned an empty response.");

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > MAX_CONTACT_IMPORT_BYTES) {
        await reader.cancel();
        throw new ContactImportInputError("The spreadsheet must be no larger than 4 MB.");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks);
}

export async function fetchGoogleSheetCsv(value: string) {
  const exportUrl = googleSheetsExportUrl(value);
  const response = await fetch(exportUrl, {
    cache: "no-store",
    headers: { Accept: "text/csv" },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new ContactImportInputError(
      "Could not access that sheet. Make sure it is public or published, then try again.",
    );
  }

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  if (contentType.includes("text/html")) {
    throw new ContactImportInputError(
      "That sheet is private. Share it publicly or publish it before importing.",
    );
  }

  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_CONTACT_IMPORT_BYTES) {
    throw new ContactImportInputError("The spreadsheet must be no larger than 4 MB.");
  }

  return readLimitedResponse(response);
}
