import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  decryptGmailRefreshToken,
  encryptGmailRefreshToken,
  exchangeGoogleAuthorizationCode,
  getGoogleOAuthConfig,
  GmailOAuthError,
} from "@/lib/gmail";

const STATE_COOKIE = "gmail_oauth_state";

function dashboardRedirect(status: string) {
  const appUrl = process.env.BETTER_AUTH_URL;
  if (!appUrl) throw new Error("BETTER_AUTH_URL must be set.");
  const url = new URL("/dashboard", appUrl);
  url.searchParams.set("gmail", status);
  return Response.redirect(url, 303);
}

export async function GET(request: Request) {
  const cookieStore = await cookies();
  const storedState = cookieStore.get(STATE_COOKIE)?.value ?? "";
  cookieStore.delete(STATE_COOKIE);

  const query = new URL(request.url).searchParams;
  if (query.has("error")) return dashboardRedirect("cancelled");

  const state = query.get("state") ?? "";
  const code = query.get("code") ?? "";
  const separator = storedState.indexOf(".");
  const expectedState = separator === -1 ? "" : storedState.slice(0, separator);
  const expectedUserId = separator === -1 ? "" : storedState.slice(separator + 1);
  if (!state || state !== expectedState || !expectedUserId || !code) {
    return dashboardRedirect("invalid_state");
  }

  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || session.user.id !== expectedUserId) {
    return dashboardRedirect("session_expired");
  }

  try {
    const config = getGoogleOAuthConfig();
    if (!config) return dashboardRedirect("not_configured");

    const authorization = await exchangeGoogleAuthorizationCode(config, code);
    const existing = await db.gmailConnection.findUnique({
      where: { userId: session.user.id },
    });
    const existingRefreshToken =
      existing?.email.toLowerCase() === authorization.email.toLowerCase()
        ? decryptGmailRefreshToken(existing.encryptedRefreshToken)
        : null;
    const refreshToken = authorization.refreshToken ?? existingRefreshToken;
    if (!refreshToken) {
      return dashboardRedirect("refresh_token_missing");
    }

    await db.gmailConnection.upsert({
      where: { userId: session.user.id },
      update: {
        email: authorization.email,
        encryptedRefreshToken: encryptGmailRefreshToken(refreshToken),
      },
      create: {
        userId: session.user.id,
        email: authorization.email,
        encryptedRefreshToken: encryptGmailRefreshToken(refreshToken),
      },
    });
    return dashboardRedirect("connected");
  } catch (error) {
    if (!(error instanceof GmailOAuthError)) throw error;
    console.error("Gmail authorization callback failed.", error);
    return dashboardRedirect("error");
  }
}
