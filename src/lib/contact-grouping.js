/**
 * @typedef {{
 *   addressLine1: string | null;
 *   addressLine2: string | null;
 *   addressCity: string | null;
 *   addressRegion: string | null;
 *   addressPostalCode: string | null;
 *   addressCountry: string | null;
 * }} AddressFields
 */

function normalizeAddressPart(value) {
  return (value ?? "")
    .normalize("NFKC")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * @template {AddressFields} T
 * @param {T[]} contacts
 * @returns {{ key: string | null; contacts: T[] }[]}
 */
export function groupContactsByAddress(contacts) {
  const groups = [];
  const groupsByAddress = new Map();

  for (const contact of contacts) {
    const requiredParts = [
      contact.addressLine1,
      contact.addressCity,
      contact.addressRegion,
      contact.addressPostalCode,
    ];
    const key = requiredParts.every((part) => normalizeAddressPart(part))
      ? JSON.stringify(
          [
            contact.addressLine1,
            contact.addressLine2,
            contact.addressCity,
            contact.addressRegion,
            contact.addressPostalCode,
            contact.addressCountry,
          ].map(normalizeAddressPart),
        )
      : null;

    const existingGroup = key ? groupsByAddress.get(key) : undefined;
    if (existingGroup) {
      existingGroup.contacts.push(contact);
      continue;
    }

    const group = { key, contacts: [contact] };
    groups.push(group);
    if (key) groupsByAddress.set(key, group);
  }

  return groups;
}
