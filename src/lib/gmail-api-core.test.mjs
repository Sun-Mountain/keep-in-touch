import assert from "node:assert/strict";
import test from "node:test";
import {
  createRawGmailMessage,
  isValidOutreachEmail,
} from "./gmail-api-core.js";

test("builds a base64url Gmail message with a UTF-8 subject and body", () => {
  const raw = createRawGmailMessage(
    "person@example.com",
    "Hello, José",
    "Thanks for checking in.",
  );
  const mime = Buffer.from(raw, "base64url").toString("utf8");

  assert.match(mime, /^To: person@example\.com\r\n/);
  assert.match(mime, /Subject: =\?UTF-8\?B\?/);
  assert.ok(mime.endsWith(Buffer.from("Thanks for checking in.").toString("base64")));
});

test("rejects malformed recipients and email header injection", () => {
  assert.equal(isValidOutreachEmail("person@example.com"), true);
  assert.equal(isValidOutreachEmail("bad\r\nBcc: other@example.com"), false);
  assert.throws(() =>
    createRawGmailMessage("person@example.com\r\nBcc: other@example.com", "Hi", "Body"),
  );
  assert.throws(() =>
    createRawGmailMessage("person@example.com", "Hello\r\nBcc: other@example.com", "Body"),
  );
});
