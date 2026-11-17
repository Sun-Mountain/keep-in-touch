import assert from "node:assert/strict";
import test from "node:test";
import {
  decryptPayload,
  encryptPayload,
  serializeContactDetails,
} from "./contact-crypto-core.js";

test("contact encryption round-trips data and rejects invalid keys or tampering", () => {
  const previousKey = process.env.CONTACT_ENCRYPTION_KEY;
  process.env.CONTACT_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");

  try {
    const plaintext = serializeContactDetails({
      name: "Alex Morgan",
      email: "alex@example.com",
      addressLine1: "123 Main Street",
      addressLabelName: "The Morgan Family",
      birthday: new Date("1990-04-03T00:00:00.000Z"),
      lastContact: new Date("2026-11-15T12:30:00.000Z"),
    });
    assert.equal(JSON.parse(plaintext).birthday, "1990-04-03");
    assert.equal(JSON.parse(plaintext).addressLabelName, "The Morgan Family");
    const encrypted = encryptPayload(plaintext);
    assert.equal(decryptPayload(encrypted), plaintext);
    assert.notEqual(encrypted, encryptPayload(plaintext));
    assert.equal(encrypted.includes("Alex Morgan"), false);

    const [version, iv, authTag, ciphertext] = encrypted.split(".");
    const changedCiphertext = `${ciphertext[0] === "A" ? "B" : "A"}${ciphertext.slice(1)}`;
    assert.throws(() =>
      decryptPayload([version, iv, authTag, changedCiphertext].join(".")),
    );

    process.env.CONTACT_ENCRYPTION_KEY = Buffer.alloc(32, 8).toString("base64");
    assert.throws(() => decryptPayload(encrypted));

    process.env.CONTACT_ENCRYPTION_KEY = "invalid";
    assert.throws(() => encryptPayload(plaintext), /32-byte key/);

    delete process.env.CONTACT_ENCRYPTION_KEY;
    assert.throws(() => encryptPayload(plaintext), /must be set/);
  } finally {
    if (previousKey === undefined) {
      delete process.env.CONTACT_ENCRYPTION_KEY;
    } else {
      process.env.CONTACT_ENCRYPTION_KEY = previousKey;
    }
  }
});
