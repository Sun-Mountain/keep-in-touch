import { decryptPayload, encryptPayload } from "@/lib/contact-crypto-core.js";
import { createRawGmailMessage } from "@/lib/gmail-api-core.js";

const GOOGLE_AUTHORIZATION_ENDPOINT =
  "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_ENDPOINT = "https://openidconnect.googleapis.com/v1/userinfo";
const GMAIL_SEND_ENDPOINT =
  "https://gmail.googleapis.com/gmail/v1/users/me/messages/send";

export type GoogleOAuthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

export class GmailOAuthError extends Error {}

export class GmailReconnectError extends Error {}

async function fetchGoogle(
  input: string,
  init: RequestInit,
  failureMessage: string,
) {
  try {
    return await fetch(input, init);
  } catch (error) {
    console.error("Google request failed.", error);
    throw new GmailOAuthError(failureMessage);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function responseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    throw new GmailOAuthError("Google returned an invalid response.");
  }
}

export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;

  let parsedRedirectUri: URL;
  try {
    parsedRedirectUri = new URL(redirectUri);
  } catch {
    throw new GmailOAuthError("The Google OAuth redirect URI is invalid.");
  }
  const isLocalHttp =
    parsedRedirectUri.protocol === "http:" &&
    ["localhost", "127.0.0.1", "[::1]"].includes(parsedRedirectUri.hostname);
  if (
    parsedRedirectUri.pathname !== "/api/gmail/callback" ||
    parsedRedirectUri.search ||
    parsedRedirectUri.hash ||
    parsedRedirectUri.username ||
    parsedRedirectUri.password ||
    (parsedRedirectUri.protocol !== "https:" &&
      !(process.env.NODE_ENV !== "production" && isLocalHttp))
  ) {
    throw new GmailOAuthError("The Google OAuth redirect URI is invalid.");
  }

  return { clientId, clientSecret, redirectUri };
}

export function createGoogleAuthorizationUrl(
  config: GoogleOAuthConfig,
  state: string,
) {
  const url = new URL(GOOGLE_AUTHORIZATION_ENDPOINT);
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email https://www.googleapis.com/auth/gmail.send");
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  return url;
}

export async function exchangeGoogleAuthorizationCode(
  config: GoogleOAuthConfig,
  code: string,
): Promise<{ accessToken: string; refreshToken: string | null; email: string }> {
  const tokenResponse = await fetchGoogle(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUri,
    }),
    cache: "no-store",
  }, "Google could not authorize this Gmail connection.");
  const tokenPayload: unknown = await responseJson(tokenResponse);
  if (!tokenResponse.ok || !isRecord(tokenPayload)) {
    throw new GmailOAuthError("Google could not authorize this Gmail connection.");
  }

  const accessToken = tokenPayload.access_token;
  const refreshToken = tokenPayload.refresh_token;
  if (
    typeof accessToken !== "string" ||
    (refreshToken !== undefined && typeof refreshToken !== "string")
  ) {
    throw new GmailOAuthError("Google returned incomplete authorization data.");
  }

  const profileResponse = await fetchGoogle(GOOGLE_USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  }, "Google could not return the Gmail account profile.");
  const profilePayload: unknown = await responseJson(profileResponse);
  if (
    !profileResponse.ok ||
    !isRecord(profilePayload) ||
    typeof profilePayload.email !== "string" ||
    profilePayload.email_verified !== true
  ) {
    throw new GmailOAuthError("Google did not return a verified account email.");
  }

  return {
    accessToken,
    refreshToken: typeof refreshToken === "string" ? refreshToken : null,
    email: profilePayload.email,
  };
}

export function encryptGmailRefreshToken(refreshToken: string) {
  return encryptPayload(refreshToken);
}

export function decryptGmailRefreshToken(encryptedRefreshToken: string) {
  return decryptPayload(encryptedRefreshToken);
}

export async function refreshGmailAccessToken(
  config: GoogleOAuthConfig,
  encryptedRefreshToken: string,
) {
  const refreshToken = decryptGmailRefreshToken(encryptedRefreshToken);
  const response = await fetchGoogle(GOOGLE_TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
    cache: "no-store",
  }, "Google could not refresh the Gmail connection.");
  const payload: unknown = await responseJson(response);
  if (!response.ok) {
    if (isRecord(payload) && payload.error === "invalid_grant") {
      throw new GmailReconnectError("Reconnect Gmail to continue sending.");
    }
    throw new GmailOAuthError("Google could not refresh the Gmail connection.");
  }
  if (!isRecord(payload) || typeof payload.access_token !== "string") {
    throw new GmailOAuthError("Google returned incomplete token data.");
  }
  return payload.access_token;
}

export async function sendGmailMessage(
  accessToken: string,
  to: string,
  subject: string,
  body: string,
) {
  const response = await fetchGoogle(GMAIL_SEND_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: createRawGmailMessage(to, subject, body) }),
    cache: "no-store",
  }, "Gmail could not send this message.");

  if (response.status === 401) {
    throw new GmailReconnectError("Reconnect Gmail to continue sending.");
  }
  if (!response.ok) {
    throw new GmailOAuthError("Gmail could not send this message.");
  }
}
