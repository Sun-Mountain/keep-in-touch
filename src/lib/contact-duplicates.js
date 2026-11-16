/**
 * @typedef {{
 *   name: string;
 *   email: string | null;
 *   phone: string | null;
 *   birthday: string | Date | null;
 *   familyMembers: string | null;
 *   addressLine1: string | null;
 *   addressLine2: string | null;
 *   addressCity: string | null;
 *   addressRegion: string | null;
 *   addressPostalCode: string | null;
 *   addressCountry: string | null;
 *   company: string | null;
 *   notes: string | null;
 * }} ContactInformation
 */

/** @type {Array<keyof ContactInformation>} */
const CONTACT_FIELDS = [
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

export function normalizeContactName(value) {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * @param {keyof ContactInformation} field
 * @param {string | Date | null} value
 */
function normalizeContactValue(field, value) {
  if (value == null) return "";
  if (field === "birthday") {
    return value instanceof Date
      ? value.toISOString().slice(0, 10)
      : value.trim();
  }
  if (field === "phone") return value.replace(/\D/g, "");
  const text = value instanceof Date ? value.toISOString() : value;
  const normalized = text.normalize("NFKC").trim().replace(/\s+/g, " ");
  if (field === "notes") return normalized;
  return normalized.toLowerCase();
}

/**
 * @param {ContactInformation} left
 * @param {ContactInformation} right
 */
export function hasSameContactInformation(left, right) {
  return CONTACT_FIELDS.every(
    (field) =>
      normalizeContactValue(field, left[field]) ===
      normalizeContactValue(field, right[field]),
  );
}
