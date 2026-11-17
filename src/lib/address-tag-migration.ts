import { db } from "@/lib/db";
import { decryptContactDetails } from "@/lib/contact-crypto";
import { createAddressFingerprint } from "@/lib/contact-crypto";
import { groupContactsByAddress } from "@/lib/contact-grouping.js";

export async function migrateLegacyContactTags(userId: string) {
  const contacts = await db.contact.findMany({
    where: { userId, tags: { some: {} } },
    include: {
      tags: {
        where: { tag: { userId } },
        select: { tagId: true },
      },
    },
  });
  if (contacts.length === 0) return;

  const groups = groupContactsByAddress(
    contacts.map((contact) => ({
      id: contact.id,
      ...decryptContactDetails(contact),
      tagIds: contact.tags.map(({ tagId }) => tagId),
    })),
  );
  const addressTags = new Map<string, {
    userId: string;
    addressFingerprint: string;
    tagId: string;
  }>();
  const migratedContactIds: string[] = [];

  for (const group of groups) {
    if (!group.key) continue;
    const addressFingerprint = createAddressFingerprint(group.key);
    for (const contact of group.contacts) {
      migratedContactIds.push(contact.id);
      for (const tagId of contact.tagIds) {
        const key = `${addressFingerprint}:${tagId}`;
        addressTags.set(key, { userId, addressFingerprint, tagId });
      }
    }
  }
  if (migratedContactIds.length === 0) return;

  await db.$transaction(async (transaction) => {
    await transaction.addressTag.createMany({
      data: [...addressTags.values()],
      skipDuplicates: true,
    });
    await transaction.contactTag.deleteMany({
      where: { contactId: { in: migratedContactIds } },
    });
  });
}
