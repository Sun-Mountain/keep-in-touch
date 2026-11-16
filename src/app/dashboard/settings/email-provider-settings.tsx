"use client";

import { useActionState } from "react";
import {
  connectProton,
  disconnectGmail,
  disconnectProton,
  type ProtonConnectionState,
} from "@/app/dashboard/outreach-actions";

const initialProtonConnectionState: ProtonConnectionState = { status: "idle" };

function ProtonConnectionForm() {
  const [connectionState, connectAction, connectPending] = useActionState(
    connectProton,
    initialProtonConnectionState,
  );

  return (
    <>
      <form action={connectAction}>
        <label className="outreach-field">
          Proton custom-domain email address
          <input
            autoComplete="email"
            maxLength={254}
            name="protonEmail"
            required
            type="email"
          />
        </label>
        <label className="outreach-field">
          Proton SMTP token
          <input
            autoComplete="new-password"
            maxLength={4_096}
            name="smtpToken"
            required
            type="password"
          />
        </label>
        <button disabled={connectPending} type="submit">
          {connectPending ? "Verifying..." : "Connect Proton SMTP"}
        </button>
      </form>
      {connectionState.status === "error" && (
        <p className="outreach-error" role="alert">{connectionState.message}</p>
      )}
      {connectionState.status === "connected" && (
        <p className="outreach-status" role="status">{connectionState.message}</p>
      )}
      <p className="outreach-muted">
        Proton SMTP requires a paid plan with a custom-domain address and SMTP
        token. SMTP-submitted messages are not end-to-end encrypted.
      </p>
    </>
  );
}

export function EmailProviderSettings({
  gmailEmail,
  protonEmail,
  gmailOAuthConfigured,
  gmailNotice,
}: {
  gmailEmail: string | null;
  protonEmail: string | null;
  gmailOAuthConfigured: boolean;
  gmailNotice: string | null;
}) {
  return (
    <section className="settings-card" aria-labelledby="email-settings-title">
      <p className="eyebrow">Email</p>
      <h2 id="email-settings-title">Email accounts</h2>
      <p>
        Connect an account to send separate, personalized messages from the
        Email and text page.
      </p>
      {gmailNotice && (
        <p className="outreach-status" role="status">{gmailNotice}</p>
      )}

      <div className="settings-provider">
        <h3>Gmail</h3>
        {gmailEmail ? (
          <>
            <p>Connected account: <strong>{gmailEmail}</strong></p>
            {!gmailOAuthConfigured && (
              <p className="outreach-error">
                Gmail sending is unavailable until the server’s Google OAuth
                settings are configured.
              </p>
            )}
            <div className="outreach-actions">
              {gmailOAuthConfigured && <a href="/api/gmail/connect">Reconnect Gmail</a>}
              <form action={disconnectGmail}>
                <button className="outreach-link-button" type="submit">
                  Disconnect Gmail
                </button>
              </form>
            </div>
          </>
        ) : gmailOAuthConfigured ? (
          <p>
            <a href="/api/gmail/connect">Connect Gmail</a> using the server’s
            configured Google OAuth app.
          </p>
        ) : (
          <p className="outreach-muted">
            Gmail isn’t configured for this app. An administrator must set up
            Google OAuth on the server before users can connect.
          </p>
        )}
      </div>

      <div className="settings-provider">
        <h3>Proton Mail</h3>
        {protonEmail && (
          <>
            <p>Connected account: <strong>{protonEmail}</strong></p>
            <form action={disconnectProton}>
              <button className="outreach-link-button" type="submit">
                Disconnect Proton SMTP
              </button>
            </form>
          </>
        )}
        <details open={!protonEmail}>
          <summary>
            {protonEmail ? "Update Proton SMTP settings" : "Connect Proton SMTP"}
          </summary>
          <ProtonConnectionForm />
        </details>
      </div>
    </section>
  );
}
