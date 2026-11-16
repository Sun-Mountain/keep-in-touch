import "dotenv/config";
import { Client } from "pg";
import {
  assertContactEncryptionKeyConfigured,
  encryptPayload,
  serializeContactDetails,
} from "../src/lib/contact-crypto-core.js";

const BATCH_SIZE = 100;
const ENCRYPTED_CONTACT_NAME = "[encrypted]";

function dateOnly(value) {
  if (value === null) return null;
  return (value instanceof Date ? value.toISOString() : String(value)).slice(0, 10);
}

function serializeContact(row) {
  return serializeContactDetails({
    name: row.name,
    email: row.email,
    phone: row.phone,
    birthday: row.birthday === null
      ? null
      : new Date(`${dateOnly(row.birthday)}T00:00:00.000Z`),
    familyMembers: row.familyMembers,
    addressLine1: row.addressLine1,
    addressLine2: row.addressLine2,
    addressCity: row.addressCity,
    addressRegion: row.addressRegion,
    addressPostalCode: row.addressPostalCode,
    addressCountry: row.addressCountry,
    company: row.company,
    notes: row.notes,
    lastContact: row.lastContact,
  });
}

async function encryptExistingContacts() {
  assertContactEncryptionKeyConfigured();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL must be set to connect to PostgreSQL.");
  }

  const client = new Client({ connectionString });
  await client.connect();
  let encryptedCount = 0;

  try {
    while (true) {
      const { rows } = await client.query(
        `SELECT "id", "name", "email", "phone", "birthday", "familyMembers",
          "addressLine1", "addressLine2", "addressCity", "addressRegion",
          "addressPostalCode", "addressCountry", "company", "notes", "lastContact"
        FROM "Contact"
        WHERE "encryptedData" IS NULL
        ORDER BY "id"
        LIMIT $1`,
        [BATCH_SIZE],
      );
      if (rows.length === 0) break;

      await client.query("BEGIN");
      try {
        let updatedCount = 0;
        for (const row of rows) {
          const result = await client.query(
            `UPDATE "Contact"
            SET "name" = $1, "encryptedData" = $2, "email" = NULL, "phone" = NULL,
              "birthday" = NULL, "familyMembers" = NULL, "addressLine1" = NULL,
              "addressLine2" = NULL, "addressCity" = NULL, "addressRegion" = NULL,
              "addressPostalCode" = NULL, "addressCountry" = NULL, "company" = NULL,
              "notes" = NULL, "lastContact" = NULL
            WHERE "id" = $3 AND "encryptedData" IS NULL`,
            [
              ENCRYPTED_CONTACT_NAME,
              encryptPayload(serializeContact(row)),
              row.id,
            ],
          );
          updatedCount += result.rowCount ?? 0;
        }
        await client.query("COMMIT");
        encryptedCount += updatedCount;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }

      console.info(`Encrypted ${encryptedCount} existing contacts.`);
    }

    console.info(
      `Contact encryption backfill complete. Encrypted ${encryptedCount} contacts.`,
    );
  } finally {
    await client.end();
  }
}

encryptExistingContacts().catch((error) => {
  console.error("Could not encrypt existing contact data.", error);
  process.exitCode = 1;
});
