import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const ENVELOPE_VERSION = "v1";
const IV_LENGTH = 12;

function getEncryptionKey() {
  const encodedKey = process.env.CONTACT_ENCRYPTION_KEY?.trim();
  if (!encodedKey) {
    throw new Error(
      "CONTACT_ENCRYPTION_KEY must be set to a base64-encoded 32-byte key.",
    );
  }

  const key = Buffer.from(encodedKey, "base64");
  if (key.length !== 32 || key.toString("base64") !== encodedKey) {
    throw new Error(
      "CONTACT_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  }
  return key;
}

export function assertContactEncryptionKeyConfigured() {
  getEncryptionKey();
}

/**
 * @param {{
 *   birthday: Date | null;
 *   lastContact: Date | null;
 *   addressLabelName?: string | null;
 * }} details
 */
export function serializeContactDetails(details) {
  return JSON.stringify({
    ...details,
    addressLabelName: details.addressLabelName ?? null,
    birthday: details.birthday?.toISOString().slice(0, 10) ?? null,
    lastContact: details.lastContact?.toISOString() ?? null,
  });
}

/** @param {string} plaintext */
export function encryptPayload(plaintext) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return [
    ENVELOPE_VERSION,
    iv.toString("base64url"),
    authTag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

/** @param {string} envelope */
export function decryptPayload(envelope) {
  const [version, encodedIv, encodedAuthTag, encodedCiphertext, ...extra] =
    envelope.split(".");
  if (
    version !== ENVELOPE_VERSION ||
    !encodedIv ||
    !encodedAuthTag ||
    !encodedCiphertext ||
    extra.length > 0
  ) {
    throw new Error("Encrypted contact data has an unsupported format.");
  }

  const iv = Buffer.from(encodedIv, "base64url");
  const authTag = Buffer.from(encodedAuthTag, "base64url");
  const ciphertext = Buffer.from(encodedCiphertext, "base64url");
  if (iv.length !== IV_LENGTH || authTag.length !== 16) {
    throw new Error("Encrypted contact data has an unsupported format.");
  }

  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
