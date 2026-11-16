"use client";

import { useActionState, useEffect, useState } from "react";
import { groupContactsByAddress } from "@/lib/contact-grouping.js";
import {
  createMailingList,
  deleteMailingList,
  type CreateMailingListState,
} from "./mailing-list-actions";

type MailingAddressContact = {
  id: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  addressCity: string | null;
  addressRegion: string | null;
  addressPostalCode: string | null;
  addressCountry: string | null;
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
  const [printingListId, setPrintingListId] = useState<string | null>(null);
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
  const allSelected =
    eligibleContacts.length > 0 &&
    eligibleContacts.every((contact) => selectedIds.includes(contact.id));
  const savedLists = mailingLists.map((list) => ({
    ...list,
    addressGroups: groupContactsByAddress(list.contacts),
  }));

  return (
    <section className="mailing-lists-section" aria-labelledby="mailing-lists-title">
      <header className="mailing-lists-heading">
        <div>
          <p className="eyebrow">Send something thoughtful</p>
          <h2 id="mailing-lists-title">Mailing lists</h2>
        </div>
        <p>Save reusable groups of people and print their mailing addresses.</p>
      </header>

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
          <div className="mailing-list-selection-heading">
            <span>{selectedIds.length} selected</span>
            <button
              onClick={() =>
                setSelectedIds(
                  allSelected ? [] : eligibleContacts.map((contact) => contact.id),
                )
              }
              type="button"
            >
              {allSelected ? "Clear selection" : "Select all contacts"}
            </button>
          </div>
          {eligibleContacts.length === 0 ? (
            <p className="outreach-muted">
              Add contacts with a complete mailing address to create a list.
            </p>
          ) : (
            <ul className="mailing-list-contact-options">
              {eligibleContacts.map((contact) => (
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
                              {group.contacts.map((contact) => contact.name).join(", ")}
                            </strong>
                            {addressLines(group.contacts[0]).map((line, index) => (
                              <span key={`${line}-${index}`}>{line}</span>
                            ))}
                          </li>
                        ))}
                      </ul>
                    </div>
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
