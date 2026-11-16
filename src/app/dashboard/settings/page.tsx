import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { EmailProviderSettings } from "@/app/dashboard/settings/email-provider-settings";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const gmailNotices: Record<string, string> = {
  connected: "Gmail was connected successfully.",
  not_configured: "Gmail OAuth is not configured on this server yet.",
  cancelled: "Gmail connection was cancelled.",
  invalid_state: "The Gmail connection expired or could not be verified. Please try again.",
  session_expired: "Your session expired during Gmail authorization. Please sign in and try again.",
  refresh_token_missing: "Google did not provide ongoing Gmail access. Reconnect and approve access again.",
  error: "Gmail could not be connected. Please try again.",
};

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ gmail?: string | string[] }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const [gmailConnection, protonConnection] = await Promise.all([
    db.gmailConnection.findUnique({
      where: { userId: session.user.id },
      select: { email: true },
    }),
    db.protonConnection.findUnique({
      where: { userId: session.user.id },
      select: { email: true },
    }),
  ]);
  const query = await searchParams;
  const gmailStatus = typeof query.gmail === "string" ? query.gmail : null;

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Make it yours</p>
          <h1>Settings</h1>
        </div>
        <p>Set up the email accounts and phone messaging you use to stay in touch.</p>
      </header>

      <div className="settings-sections">
        <EmailProviderSettings
          gmailEmail={gmailConnection?.email ?? null}
          protonEmail={protonConnection?.email ?? null}
          gmailNotice={gmailStatus ? gmailNotices[gmailStatus] ?? null : null}
          gmailOAuthConfigured={Boolean(
            process.env.GOOGLE_CLIENT_ID?.trim() &&
              process.env.GOOGLE_CLIENT_SECRET?.trim() &&
              process.env.GOOGLE_REDIRECT_URI?.trim(),
          )}
        />

        <section className="settings-card" aria-labelledby="sms-settings-title">
          <p className="eyebrow">Text messages</p>
          <h2 id="sms-settings-title">Phone SMS</h2>
          <p>
            Text drafts open in your device’s messaging app. Keep in Touch
            doesn’t send or store text messages; your phone and carrier send
            them using the number configured on your device.
          </p>
          <ol>
            <li>Set up your usual SMS app and phone number on your phone.</li>
            <li>Open the Email and text page from that device.</li>
            <li>Select Text, review each draft, and send it from your messaging app.</li>
          </ol>
        </section>
      </div>
    </div>
  );
}
