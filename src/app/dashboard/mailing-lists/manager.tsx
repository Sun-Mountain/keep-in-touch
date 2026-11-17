"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import { groupContactsByAddress } from "@/lib/contact-grouping.js";
import {
  createMailingList,
  deleteMailingList,
  updateMailingListAddressName,
  updateMailingListAddressSent,
  type CreateMailingListState,
} from "../mailing-list-actions";

type MailingAddressContact = {
  id: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  addressCity: string | null;
  addressRegion: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
  sentAt?: Date | null;
  addressLabelName?: string | null;
  mailingListAddressLabelName?: string | null;
};

type SavedMailingList = {
  id: string;
  name: string;
  contacts: MailingAddressContact[];
};

const initialState: CreateMailingListState = { status: "idle" };

function addressLines(contact: MailingAddressContact) {
  return [
    contact.addressLine1,
    contact.addressLine2,
    [
      contact.addressCity,
      contact.addressRegion,
      contact.addressPostalCode,
    ].filter(Boolean).join(", "),
    contact.addressCountry,
  ].filter(Boolean);
}

export function MailingLists({
  contacts,
  mailingLists,
}: {
  contacts: MailingAddressContact[];
  mailingLists: SavedMailingList[];
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [contactSearch, setContactSearch] = useState("");
  const [printingListId, setPrintingListId] = useState<string | null>(null);
  const [isUpdatingSentStatus, startSentStatusTransition] = useTransition();
  const [createState, createAction, isPending] = useActionState(
    createMailingList,
    initialState,
  );
  useEffect(() => {
    if (!printingListId) return;
    const handleAfterPrint = () => setPrintingListId(null);
    window.addEventListener("afterprint", handleAfterPrint);
    window.print();
    return () => window.removeEventListener("afterprint", handleAfterPrint);
  }, [printingListId]);
  const eligibleContacts = contacts.filter(
    (contact) =>
      contact.addressLine1?.trim() &&
      contact.addressCity?.trim() &&
      contact.addressRegion?.trim() &&
      contact.addressPostalCode?.trim(),
  );
  const normalizedSearch = contactSearch.trim().toLowerCase();
  const visibleContacts = eligibleContacts.filter((contact) =>
    contact.name.toLowerCase().includes(normalizedSearch),
  );
  const visibleContactIds = visibleContacts.map((contact) => contact.id);
  const allVisibleSelected =
    visibleContacts.length > 0 &&
    visibleContacts.every((contact) => selectedIds.includes(contact.id));
  const savedLists = mailingLists.map((list) => ({
    ...list,
    addressGroups: groupContactsByAddress(list.contacts).map((group) => ({
      ...group,
      isSent: group.contacts.every((contact) => contact.sentAt != null),
      addressLabelName:
        group.contacts.find((contact) => contact.mailingListAddressLabelName)
          ?.mailingListAddressLabelName ??
        group.contacts.find((contact) => contact.addressLabelName)?.addressLabelName ??
        null,
    })),
  }));

  return (
    <section
      aria-label="Create and manage mailing lists"
      className="mailing-lists-section"
    >
      <div className="mailing-lists-layout">
        <form action={createAction} className="mailing-list-builder">
          <h3>Create a list</h3>
          <label>
            List name
            <input
              maxLength={80}
              name="name"
              placeholder="Holiday cards"
              required
            />
          </label>
          {eligibleContacts.length > 0 && (
            <label className="mailing-list-search">
              Search contacts by name
              <input
                onChange={(event) => setContactSearch(event.target.value)}
                placeholder="Start typing a name"
                type="search"
                value={contactSearch}
              />
            </label>
          )}
          <div className="mailing-list-selection-heading">
            <span>{selectedIds.length} selected</span>
            <button
              disabled={visibleContacts.length === 0}
              onClick={() =>
                setSelectedIds((current) =>
                  allVisibleSelected
                    ? current.filter((id) => !visibleContactIds.includes(id))
                    : [...new Set([...current, ...visibleContactIds])],
                )
              }
              type="button"
            >
              {allVisibleSelected
                ? normalizedSearch ? "Clear shown" : "Clear selection"
                : normalizedSearch ? "Select all shown" : "Select all contacts"}
            </button>
          </div>
          {eligibleContacts.length === 0 ? (
            <p className="outreach-muted">
              Add contacts with a complete mailing address to create a list.
            </p>
          ) : visibleContacts.length === 0 ? (
            <p className="outreach-muted">No contacts match your search.</p>
          ) : (
            <ul className="mailing-list-contact-options">
              {visibleContacts.map((contact) => (
                <li key={contact.id}>
                  <label>
                    <input
                      checked={selectedIds.includes(contact.id)}
                      name="contactId"
                      onChange={() =>
                        setSelectedIds((current) =>
                          current.includes(contact.id)
                            ? current.filter((id) => id !== contact.id)
                            : [...current, contact.id],
                        )
                      }
                      type="checkbox"
                      value={contact.id}
                    />
                    <span>
                      <strong>{contact.name}</strong>
                      <small>{addressLines(contact).join(", ")}</small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <button disabled={isPending || selectedIds.length === 0} type="submit">
            {isPending ? "Saving..." : "Save mailing list"}
          </button>
          {createState.status === "error" && (
            <p className="outreach-error" role="alert">{createState.message}</p>
          )}
          {createState.status === "success" && (
            <p className="outreach-status" role="status">{createState.message}</p>
          )}
        </form>

        <div className="saved-mailing-lists">
          <h3>Saved lists</h3>
          {savedLists.length === 0 ? (
            <p className="outreach-muted">Your saved mailing lists will appear here.</p>
          ) : (
            <ul>
              {savedLists.map((list) => (
                <li key={list.id}>
                  <details
                    className={`saved-mailing-list${printingListId === list.id ? " is-printing" : ""}`}
                  >
                    <summary>
                      <strong>{list.name}</strong>
                      <span>
                        {list.contacts.length} {list.contacts.length === 1 ? "person" : "people"}
                        {" · "}
                        {list.addressGroups.length}{" "}
                        {list.addressGroups.length === 1 ? "address" : "addresses"}
                      </span>
                    </summary>
                    <div className="saved-mailing-list-actions">
                      <button onClick={() => setPrintingListId(list.id)} type="button">
                        Print addresses
                      </button>
                      <form action={deleteMailingList}>
                        <input name="id" type="hidden" value={list.id} />
                        <button className="remove-contact-button" type="submit">
                          Delete list
                        </button>
                      </form>
                    </div>
                    <div className="mailing-list-printable">
                      <h3>{list.name}</h3>
                      <ul className="mailing-address-labels">
                        {list.addressGroups.map((group) => (
                          <li key={group.key ?? group.contacts[0].id}>
                            <strong>
                              {group.addressLabelName ??
                                group.contacts.map((contact) => contact.name).join(", ")}
                            </strong>
                            {addressLines(group.contacts[0]).map((line, index) => (
                              <span key={`${line}-${index}`}>{line}</span>
                            ))}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <ul className="mailing-list-status-list">
                      {list.addressGroups.map((group) => {
                        const names = group.contacts
                          .map((contact) => contact.name)
                          .join(", ");
                        const addressLabelName = group.addressLabelName ?? "";
                        return (
                          <li key={group.key ?? group.contacts[0].id}>
                            <div>
                              <strong>{addressLabelName || names}</strong>
                              {addressLabelName && <small>{names}</small>}
                              <address>
                                {addressLines(group.contacts[0]).map((line, index) => (
                                  <span key={`${line}-${index}`}>{line}</span>
                                ))}
                              </address>
                            </div>
                            <form
                              action={updateMailingListAddressName}
                              className="mailing-list-address-name-form"
                            >
                              <input
                                name="mailingListId"
                                type="hidden"
                                value={list.id}
                              />
                              {group.contacts.map((contact) => (
                                <input
                                  key={contact.id}
                                  name="contactId"
                                  type="hidden"
                                  value={contact.id}
                                />
                              ))}
                              <label>
                                Alternative address name
                                <input
                                  defaultValue={addressLabelName}
                                  maxLength={100}
                                  name="addressLabelName"
                                  placeholder={names}
                                />
                              </label>
                              <button type="submit">Save name</button>
                            </form>
                            <form
                              action={updateMailingListAddressSent}
                              className="mailing-list-sent-form"
                            >
                              <input
                                name="mailingListId"
                                type="hidden"
                                value={list.id}
                              />
                              {group.contacts.map((contact) => (
                                <input
                                  key={contact.id}
                                  name="contactId"
                                  type="hidden"
                                  value={contact.id}
                                />
                              ))}
                              <label className="mailing-list-sent-control">
                                <input
                                  aria-label={`Letter sent for ${names}`}
                                  checked={group.isSent}
                                  disabled={isUpdatingSentStatus}
                                  onChange={(event) => {
                                    const form = event.currentTarget.form;
                                    if (!form) return;
                                    const formData = new FormData(form);
                                    formData.set(
                                      "sent",
                                      String(event.currentTarget.checked),
                                    );
                                    startSentStatusTransition(() =>
                                      updateMailingListAddressSent(formData),
                                    );
                                  }}
                                  type="checkbox"
                                />
                                <span>{group.isSent ? "Sent" : "Mark sent"}</span>
                              </label>
                            </form>
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
