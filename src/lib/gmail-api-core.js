const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** @param {string} value */
export function isValidOutreachEmail(value) {
  return EMAIL_PATTERN.test(value);
}

/**
 * @param {string} to
 * @param {string} subject
 * @param {string} body
 */
export function createRawGmailMessage(to, subject, body) {
  if (!isValidOutreachEmail(to) || /[\r\n]/.test(subject)) {
    throw new Error("The recipient email or subject is invalid.");
  }

  const encodedSubject = Buffer.from(subject, "utf8").toString("base64");
  const encodedBody = Buffer.from(body, "utf8")
    .toString("base64")
    .match(/.{1,76}/g)
    ?.join("\r\n") ?? "";
  const mimeMessage = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${encodedSubject}?=`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    encodedBody,
  ].join("\r\n");

  return Buffer.from(mimeMessage, "utf8").toString("base64url");
}
