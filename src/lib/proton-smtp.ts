import nodemailer from "nodemailer";
import {
  decryptPayload,
  encryptPayload,
} from "@/lib/contact-crypto-core.js";

const PROTON_SMTP_HOST = "smtp.protonmail.ch";
const PROTON_SMTP_PORT = 587;

export class ProtonSMTPError extends Error {}

function getErrorCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof error.code === "string"
  ) {
    return error.code;
  }
  return "unknown";
}

export function encryptProtonSmtpToken(token: string) {
  return encryptPayload(token);
}

export function decryptProtonSmtpToken(encryptedToken: string) {
  return decryptPayload(encryptedToken);
}

export function createProtonTransporter(email: string, token: string) {
  return nodemailer.createTransport({
    host: PROTON_SMTP_HOST,
    port: PROTON_SMTP_PORT,
    secure: false,
    requireTLS: true,
    tls: { minVersion: "TLSv1.2" },
    auth: { user: email, pass: token },
    pool: true,
    maxConnections: 1,
  });
}

export async function verifyProtonSmtp(email: string, token: string) {
  const transporter = createProtonTransporter(email, token);
  try {
    await transporter.verify();
  } catch (error) {
    console.error("Proton SMTP verification failed.", getErrorCode(error));
    throw new ProtonSMTPError(
      "Could not verify Proton SMTP. Check the custom-domain address and SMTP token.",
    );
  } finally {
    transporter.close();
  }
}

export async function sendProtonMessage(
  transporter: ReturnType<typeof createProtonTransporter>,
  from: string,
  to: string,
  subject: string,
  body: string,
) {
  try {
    await transporter.sendMail({ from, to, subject, text: body });
  } catch (error) {
    const code = getErrorCode(error);
    console.error("Proton SMTP send failed.", code);
    throw new ProtonSMTPError(
      code === "EAUTH"
        ? "Reconnect Proton SMTP to continue sending."
        : "Proton could not send this message.",
    );
  }
}
