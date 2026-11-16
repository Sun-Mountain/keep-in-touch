"use client";

import { useActionState, useState } from "react";
import {
  DEFAULT_OUTREACH_MESSAGE,
  DEFAULT_OUTREACH_SUBJECT,
  MAX_OUTREACH_RECIPIENTS,
  renderOutreachTemplate,
} from "@/lib/contact-outreach.js";
import {
  sendEmailOutreach,
  type OutreachSendState,
} from "./outreach-actions";

type OutreachContact = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type Channel = "email" | "text";
type Delivery = "draft" | "gmail" | "proton";

const initialSendState: OutreachSendState = { status: "idle" };
const MAX_VISIBLE_CONTACTS = 100;

export function ContactOutreach({
  contacts,
  gmailEmail,
  protonEmail,
  gmailOAuthConfigured,
}: {
  contacts: OutreachContact[];
  gmailEmail: string | null;
  protonEmail: string | null;
  gmailOAuthConfigured: boolean;
}) {
  const [channel, setChannel] = useState<Channel>("email");
  const [delivery, setDelivery] = useState<Delivery>("draft");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [subject, setSubject] = useState(DEFAULT_OUTREACH_SUBJECT);
  const [message, setMessage] = useState(DEFAULT_OUTREACH_MESSAGE);
  const [showDrafts, setShowDrafts] = useState(false);
  const [review, setReview] = useState(false);
  const [dismissedPartial, setDismissedPartial] = useState(false);
  const [sendState, sendAction, sendPending] = useActionState(
    sendEmailOutreach,
    initialSendState,
  );

  const availableContacts = contacts.filter((contact) =>
    channel === "email" ? Boolean(contact.email) : Boolean(contact.phone),
  );
  const normalizedSearch = search.trim().toLowerCase();
  const filteredContacts = availableContacts.filter((contact) =>
    [contact.name, contact.email, contact.phone]
      .filter(Boolean)
      .some((value) => value!.toLowerCase().includes(normalizedSearch)),
  );
  const visibleContacts = filteredContacts.slice(0, MAX_VISIBLE_CONTACTS);
  const selectableContacts = filteredContacts.slice(0, MAX_OUTREACH_RECIPIENTS);
  const sentContactIds = new Set(
    !dismissedPartial && sendState.status === "partial"
      ? sendState.sentContactIds
      : !dismissedPartial && sendState.status === "error"
        ? sendState.sentContactIds ?? []
        : [],
  );
  const activeSelectedIds = selectedIds.filter((id) => !sentContactIds.has(id));
  const selectedContacts = availableContacts.filter((contact) =>
    activeSelectedIds.includes(contact.id),
  );
  const firstSelected = selectedContacts[0];
  const activeProvider =
    delivery === "gmail" && gmailEmail && gmailOAuthConfigured
      ? "gmail"
      : delivery === "proton" && protonEmail
        ? "proton"
        : null;
  const senderEmail =
    activeProvider === "gmail"
      ? gmailEmail
      : activeProvider === "proton"
        ? protonEmail
        : null;
  const allSelectableSelected =
    selectableContacts.length > 0 &&
    selectableContacts.every((contact) => activeSelectedIds.includes(contact.id));

  function changeChannel(nextChannel: Channel) {
    setChannel(nextChannel);
    setSelectedIds([]);
    setShowDrafts(false);
    setReview(false);
    setDismissedPartial(true);
  }

  function toggleContact(contactId: string) {
    setSelectedIds((current) => {
      const activeIds = current.filter((id) => !sentContactIds.has(id));
      if (activeIds.includes(contactId)) {
        return activeIds.filter((id) => id !== contactId);
      }
      if (activeIds.length >= MAX_OUTREACH_RECIPIENTS) return activeIds;
      return [...activeIds, contactId];
    });
    setShowDrafts(false);
    setReview(false);
    setDismissedPartial(true);
  }

  function getDraftHref(contact: OutreachContact) {
    const body = renderOutreachTemplate(message, contact.name);
    if (channel === "email" && contact.email) {
      const params = new URLSearchParams({
        subject: renderOutreachTemplate(
          subject,
          contact.name.replace(/[\r\n]+/g, " "),
        ),
        body,
      });
      return `mailto:${encodeURIComponent(contact.email)}?${params}`;
    }
    if (channel === "text" && contact.phone) {
      return `sms:${encodeURIComponent(contact.phone)}?body=${encodeURIComponent(body)}`;
    }
    return "#";
  }

  return (
    <section className="contact-outreach" aria-labelledby="contact-outreach-title">
      <p className="eyebrow">Stay in touch</p>
      <h2 id="contact-outreach-title">Check in with your contacts</h2>
      <p className="contact-outreach-intro">
        Review each message before it is sent. Emails and texts are always
        separate, personalized messages.
      </p>

      <div className="gmail-connection">
        <p>
          {gmailEmail && gmailOAuthConfigured && (
            <>Gmail: <strong>{gmailEmail}</strong>. </>
          )}
          {protonEmail && (
            <>Proton Mail: <strong>{protonEmail}</strong>. </>
          )}
          {gmailEmail && !gmailOAuthConfigured && "Gmail sending needs server setup. "}
          {!((gmailEmail && gmailOAuthConfigured) || protonEmail) &&
            "No email account is ready for direct sending; personal drafts remain available. "}
          <a href="/dashboard/settings">Manage email and SMS settings</a>
        </p>
      </div>

      <div className="outreach-channel-options" role="group" aria-label="Message channel">
        <label>
          <input
            checked={channel === "email"}
            name="outreach-channel"
            onChange={() => changeChannel("email")}
            type="radio"
          />
          Email
        </label>
        <label>
          <input
            checked={channel === "text"}
            name="outreach-channel"
            onChange={() => changeChannel("text")}
            type="radio"
          />
          Text
        </label>
      </div>

      {channel === "email" &&
        Boolean((gmailEmail && gmailOAuthConfigured) || protonEmail) && (
          <div
            className="outreach-channel-options"
            role="group"
            aria-label="Email delivery"
          >
            <label>
              <input
                checked={delivery === "draft"}
                name="outreach-delivery"
                onChange={() => {
                  setDelivery("draft");
                  setReview(false);
                }}
                type="radio"
              />
              Open drafts in my email app
            </label>
            {gmailEmail && gmailOAuthConfigured && (
              <label>
                <input
                  checked={delivery === "gmail"}
                  name="outreach-delivery"
                  onChange={() => {
                    setDelivery("gmail");
                    setReview(false);
                  }}
                  type="radio"
                />
                Send through connected Gmail
              </label>
            )}
            {protonEmail && (
              <label>
                <input
                  checked={delivery === "proton"}
                  name="outreach-delivery"
                  onChange={() => {
                    setDelivery("proton");
                    setReview(false);
                  }}
                  type="radio"
                />
                Send through Proton Mail SMTP
              </label>
            )}
          </div>
        )}

      <div className="outreach-selection">
        <div className="outreach-selection-heading">
          <label>
            Find contacts
            <input
              onChange={(event) => setSearch(event.currentTarget.value)}
              placeholder="Search by name or contact detail"
              type="search"
              value={search}
            />
          </label>
          <button
            onClick={() => {
              setSelectedIds(
                allSelectableSelected
                  ? []
                  : selectableContacts.map((contact) => contact.id),
              );
              setShowDrafts(false);
              setReview(false);
              setDismissedPartial(true);
            }}
            type="button"
          >
            {allSelectableSelected
              ? "Clear selection"
              : `Select first ${Math.min(filteredContacts.length, MAX_OUTREACH_RECIPIENTS)} matches`}
          </button>
        </div>

        {filteredContacts.length === 0 ? (
          <p className="outreach-muted">
            No contacts with a {channel === "email" ? "saved email address" : "saved phone number"} match.
          </p>
        ) : (
          <ul className="outreach-contact-list">
            {visibleContacts.map((contact) => {
              const checked = activeSelectedIds.includes(contact.id);
              return (
                <li key={contact.id}>
                  <label>
                    <input
                      aria-label={`Select ${contact.name}`}
                      checked={checked}
                      disabled={!checked && activeSelectedIds.length >= MAX_OUTREACH_RECIPIENTS}
                      onChange={() => toggleContact(contact.id)}
                      type="checkbox"
                    />
                    <span>
                      <strong>{contact.name}</strong>
                      <small>{channel === "email" ? contact.email : contact.phone}</small>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        {filteredContacts.length > MAX_VISIBLE_CONTACTS && (
          <p className="outreach-muted">
            Showing the first {MAX_VISIBLE_CONTACTS} matches. Refine your search to see others.
          </p>
        )}
        <p className="outreach-muted">
          {selectedContacts.length} selected. Maximum {MAX_OUTREACH_RECIPIENTS} per batch.
        </p>
      </div>

      {channel === "email" && (
        <label className="outreach-field">
          Subject
          <input
            maxLength={200}
            onChange={(event) => setSubject(event.currentTarget.value)}
            required
            value={subject}
          />
        </label>
      )}

      <label className="outreach-field">
        Message
        <textarea
          maxLength={5_000}
          onChange={(event) => setMessage(event.currentTarget.value)}
          required
          rows={5}
          value={message}
        />
        <span>Use {"{{name}}"} to personalize each message.</span>
      </label>

      {selectedContacts.length > 0 && channel === "email" && activeProvider ? (
        <div className="outreach-review">
          {!review ? (
            <button
              disabled={!subject.trim() || !message.trim()}
              onClick={() => setReview(true)}
              type="button"
            >
              Review {selectedContacts.length} separate emails
            </button>
          ) : (
            <>
              <h3>Review before sending</h3>
              <p>
                These messages will be sent separately from {senderEmail} using{" "}
                {activeProvider === "gmail" ? "Gmail" : "Proton SMTP"}. Only
                press send if the recipients and preview are correct.
              </p>
              <ul>
                {selectedContacts.map((contact) => (
                  <li key={contact.id}>
                    {contact.name} — {contact.email}
                  </li>
                ))}
              </ul>
              {firstSelected && (
                <div className="outreach-preview">
                  <strong>
                    {renderOutreachTemplate(
                      subject,
                      firstSelected.name.replace(/[\r\n]+/g, " "),
                    )}
                  </strong>
                  <p>{renderOutreachTemplate(message, firstSelected.name)}</p>
                </div>
              )}
              <button
                className="outreach-secondary-button"
                onClick={() => setReview(false)}
                type="button"
              >
                Edit selection or message
              </button>
              <form
                action={sendAction}
                onSubmit={(event) => {
                  if (
                    !window.confirm(
                      `Send ${selectedContacts.length} separate emails from ${senderEmail}?`,
                    )
                  ) {
                    event.preventDefault();
                  } else {
                    setDismissedPartial(false);
                  }
                }}
              >
                {selectedContacts.map((contact) => (
                  <input
                    key={contact.id}
                    name="contactId"
                    type="hidden"
                    value={contact.id}
                  />
                ))}
                <input name="provider" type="hidden" value={activeProvider} />
                <input name="subject" type="hidden" value={subject} />
                <input name="message" type="hidden" value={message} />
                <button disabled={sendPending} type="submit">
                  {sendPending ? "Sending..." : `Send ${selectedContacts.length} emails`}
                </button>
              </form>
            </>
          )}
        </div>
      ) : selectedContacts.length > 0 ? (
        <div className="outreach-review">
          <button
            disabled={!message.trim()}
            onClick={() => setShowDrafts(true)}
            type="button"
          >
            Prepare {channel === "email" ? "email" : "text"} drafts
          </button>
          {showDrafts && (
            <ul className="outreach-draft-list">
              {selectedContacts.map((contact) => (
                <li key={contact.id}>
                  <a href={getDraftHref(contact)}>
                    Open {channel === "email" ? "email" : "text"} draft for {contact.name}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}

      {sendState.status === "error" && (
        <p className="outreach-error" role="alert">{sendState.message}</p>
      )}
      {sendState.status === "sent" && (
        <p className="outreach-status" role="status">
          Sent {sendState.count} separate {sendState.count === 1 ? "email" : "emails"}.
        </p>
      )}
      {sendState.status === "partial" && (
        <p className="outreach-error" role="alert">
          Sent {sendState.sent} of {sendState.total}. Sending stopped at {sendState.contactName}; review your email-provider connection and try the remaining contacts.
        </p>
      )}
    </section>
  );
}
