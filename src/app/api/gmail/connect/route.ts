import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { auth } from "@/lib/auth";
import {
  createGoogleAuthorizationUrl,
  getGoogleOAuthConfig,
  GmailOAuthError,
} from "@/lib/gmail";

const STATE_COOKIE = "gmail_oauth_state";
const CALLBACK_PATH = "/api/gmail/callback";

function settingsRedirect(status: string) {
  const appUrl = process.env.BETTER_AUTH_URL;
  if (!appUrl) throw new Error("BETTER_AUTH_URL must be set.");
  const url = new URL("/dashboard/settings", appUrl);
  url.searchParams.set("gmail", status);
  return Response.redirect(url, 303);
}

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    const appUrl = process.env.BETTER_AUTH_URL;
    if (!appUrl) throw new Error("BETTER_AUTH_URL must be set.");
    return Response.redirect(new URL("/", appUrl), 303);
  }

  try {
    const config = getGoogleOAuthConfig();
    if (!config) return settingsRedirect("not_configured");

    const state = randomBytes(32).toString("base64url");
    const cookieStore = await cookies();
    cookieStore.set(STATE_COOKIE, `${state}.${session.user.id}`, {
      httpOnly: true,
      maxAge: 600,
      path: CALLBACK_PATH,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return Response.redirect(createGoogleAuthorizationUrl(config, state), 302);
  } catch (error) {
    if (!(error instanceof GmailOAuthError)) throw error;
    console.error("Could not start Gmail authorization.", error);
    return settingsRedirect("error");
  }
}
