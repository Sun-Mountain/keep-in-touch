import { headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  deleteContact,
  deleteContactTag,
  removeAddressTag,
  createContactTag,
} from "@/app/dashboard/actions";
import { ContactEditor } from "@/app/dashboard/contact-editor";
import { ContactImportForm } from "@/app/dashboard/contact-import-form";
import { ContactForm } from "@/app/dashboard/contact-form";
import { AddressTagPicker } from "@/app/dashboard/address-tag-picker";
import { EraseContactsButton } from "@/app/dashboard/erase-contacts-button";
import { AddressLabelNameEditor } from "@/app/dashboard/address-label-name-editor";
import type { Contact } from "@/generated/prisma/client";
import { auth } from "@/lib/auth";
import {
  createAddressFingerprint,
  decryptContactDetails,
} from "@/lib/contact-crypto";
import type { ContactDetails } from "@/lib/contact-crypto";
import { groupContactsByAddress } from "@/lib/contact-grouping.js";
import { db } from "@/lib/db";
import { migrateLegacyContactTags } from "@/lib/address-tag-migration";

type TagOption = { id: string; name: string };
type DashboardContact = Contact & ContactDetails;

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function contactAddress(contact: ContactDetails) {
  return [
    contact.addressLine1,
    contact.addressLine2,
    [contact.addressCity, contact.addressRegion, contact.addressPostalCode]
      .filter(Boolean)
      .join(", "),
    contact.addressCountry,
  ].filter(Boolean);
}

function AddressTagEditor({
  contactId,
  tags,
  availableTags,
}: {
  contactId: string;
  tags: TagOption[];
  availableTags: TagOption[];
}) {
  return (
    <div className="contact-tags address-tag-editor">
      {tags.length > 0 ? (
        <ul aria-label="Address tags" className="contact-tag-chips">
          {tags.map((tag) => (
            <li key={tag.id}>
              <span>{tag.name}</span>
              <form action={removeAddressTag}>
                <input name="contactId" type="hidden" value={contactId} />
                <input name="tagId" type="hidden" value={tag.id} />
                <button
                  aria-label={`Remove ${tag.name} tag from this address`}
                  className="contact-tag-remove-button"
                  type="submit"
                >
                  ×
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <span className="contact-tags-empty">No tags</span>
      )}
      <AddressTagPicker
        assignedTagIds={tags.map((tag) => tag.id)}
        contactId={contactId}
        tags={availableTags}
      />
    </div>
  );
}

function ContactPerson({
  contact,
  showAddress,
  canEditAddressName,
  addressTags = [],
  availableTags = [],
}: {
  contact: DashboardContact;
  showAddress: boolean;
  canEditAddressName: boolean;
  addressTags?: TagOption[];
  availableTags?: TagOption[];
}) {
  const familyMembers = contact.familyMembers
    ?.split(/\r?\n/)
    .map((member) => member.trim())
    .filter(Boolean);
  const address = showAddress ? contactAddress(contact) : [];
  const hasDetails = Boolean(
    contact.email ||
      contact.phone ||
      contact.birthday ||
      familyMembers?.length ||
      (showAddress && contact.addressLabelName) ||
      address.length ||
      contact.notes,
  );

  return (
    <li className={showAddress ? "contact-card" : "shared-contact-person"}>
      <div className="contact-card-heading">
        <div className="contact-avatar" aria-hidden="true">{initials(contact.name)}</div>
        <div>
          <h3>{contact.name}</h3>
          {contact.company && <p>{contact.company}</p>}
          {!contact.email && !contact.phone && (
            <span className="missing-info-badge">Important info missing</span>
          )}
        </div>
        <form action={deleteContact}>
          <input name="id" type="hidden" value={contact.id} />
          <button className="remove-contact-button" type="submit">Remove</button>
        </form>
      </div>
      <ContactEditor
        contact={{
          id: contact.id,
          name: contact.name,
          email: contact.email,
          phone: contact.phone,
          birthday: contact.birthday?.toISOString().slice(0, 10) ?? "",
          familyMembers: contact.familyMembers,
          addressLine1: contact.addressLine1,
          addressLine2: contact.addressLine2,
          addressCity: contact.addressCity,
          addressRegion: contact.addressRegion,
          addressPostalCode: contact.addressPostalCode,
          addressCountry: contact.addressCountry,
          company: contact.company,
          notes: contact.notes,
        }}
      />
      {showAddress && canEditAddressName && (
        <AddressLabelNameEditor
          addressLabelName={contact.addressLabelName}
          contactIds={[contact.id]}
        />
      )}
      {showAddress && canEditAddressName && (
        <AddressTagEditor
          availableTags={availableTags}
          contactId={contact.id}
          tags={addressTags}
        />
      )}

      {hasDetails && (
        <dl className="contact-details">
          {contact.email && (
            <>
              <dt>Email</dt>
              <dd><a href={`mailto:${contact.email}`}>{contact.email}</a></dd>
            </>
          )}
          {contact.phone && (
            <>
              <dt>Phone</dt>
              <dd><a href={`tel:${contact.phone}`}>{contact.phone}</a></dd>
            </>
          )}
          {contact.birthday && (
            <>
              <dt>Birthday</dt>
              <dd>{contact.birthday.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" })}</dd>
            </>
          )}
          {familyMembers && familyMembers.length > 0 && (
            <>
              <dt>Family</dt>
              <dd>{familyMembers.join(", ")}</dd>
            </>
          )}
          {address.length > 0 && (
            <>
              {showAddress && contact.addressLabelName && (
                <>
                  <dt>Address name</dt>
                  <dd>{contact.addressLabelName}</dd>
                </>
              )}
              <dt>Address</dt>
              <dd>{address.map((line, index) => <span key={index}>{line}</span>)}</dd>
            </>
          )}
          {contact.notes && (
            <>
              <dt>Notes</dt>
              <dd>{contact.notes}</dd>
            </>
          )}
        </dl>
      )}
    </li>
  );
}

export default async function Dashboard() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  await migrateLegacyContactTags(session.user.id);
  const [storedContacts, tags, savedAddressTags] = await Promise.all([
    db.contact.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    }),
    db.tag.findMany({
      where: { userId: session.user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    db.addressTag.findMany({
      where: { userId: session.user.id },
      select: {
        addressFingerprint: true,
        tag: { select: { id: true, name: true } },
      },
    }),
  ]);
  const contacts = storedContacts.map((contact) => ({
    ...contact,
    ...decryptContactDetails(contact),
  }));
  const tagsByAddress = new Map<string, TagOption[]>();
  for (const addressTag of savedAddressTags) {
    const tagsForAddress =
      tagsByAddress.get(addressTag.addressFingerprint) ?? [];
    tagsForAddress.push(addressTag.tag);
    tagsByAddress.set(addressTag.addressFingerprint, tagsForAddress);
  }
  const contactGroups = groupContactsByAddress(contacts).map((group) => ({
    ...group,
    addressTags: group.key
      ? tagsByAddress.get(createAddressFingerprint(group.key)) ?? []
      : [],
  }));
  const addressCount = contactGroups.filter((group) => group.key !== null).length;
  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">The people who matter</p>
          <h1>Your circle</h1>
        </div>
        <p className="tag-line">Keep the little details close, so staying in touch feels natural.</p>
      </header>

      <div className="dashboard-content">
        <div className="contact-entry-options">
          <details className="add-contact-panel import-contact-panel" name="contact-entry" open>
            <summary className="panel-heading accordion-heading">
              <div>
                <p className="eyebrow">Bring your people together</p>
                <h2 id="import-contacts-title">Import contacts</h2>
              </div>
            </summary>
            <ContactImportForm />
          </details>
          <details className="add-contact-panel" name="contact-entry">
            <summary className="panel-heading accordion-heading">
              <div>
                <p className="eyebrow">A new connection</p>
                <h2 id="add-contact-title">Add a person</h2>
              </div>
            </summary>
            <ContactForm />
          </details>

          <div className="contact-tag-manager">
            <div>
              <h3>Manage tags</h3>
              <p>Create tags to organize mailing addresses.</p>
            </div>
            <form action={createContactTag} className="contact-tag-create-form">
              <label htmlFor="new-contact-tag">Tag name</label>
              <input
                id="new-contact-tag"
                maxLength={50}
                name="name"
                placeholder="Family"
                required
              />
              <button type="submit">Create tag</button>
            </form>
            {tags.length === 0 ? (
              <p className="contact-tags-empty">No tags created yet.</p>
            ) : (
              <ul aria-label="Created tags" className="contact-tag-list">
                {tags.map((tag) => (
                  <li key={tag.id}>
                    <span>{tag.name}</span>
                    <form action={deleteContactTag}>
                      <input name="tagId" type="hidden" value={tag.id} />
                      <button
                        aria-label={`Delete tag ${tag.name}`}
                        className="contact-tag-remove-button"
                        type="submit"
                      >
                        ×
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {process.env.NODE_ENV === "development" && (
            <aside className="development-tools" aria-label="Development tools">
              <p className="eyebrow">Development only</p>
              <p>Erase contacts belonging to your account.</p>
              <EraseContactsButton />
            </aside>
          )}
        </div>

        <section className="contacts-section" aria-labelledby="contacts-title">
          <div className="contacts-heading">
            <h2 id="contacts-title">Your people</h2>
            <span>{contacts.length}</span>
            <p className="address-count">
              {addressCount} unique {addressCount === 1 ? "address" : "addresses"}
            </p>
          </div>
          {contacts.length === 0 ? (
            <div className="empty-contacts">
              <p>Your circle is ready to grow.</p>
              <span>Add someone to keep their details in one thoughtful place.</span>
            </div>
          ) : (
            <ul className="contact-list">
              {contactGroups.map((group) => {
                if (group.contacts.length === 1) {
                  const contact = group.contacts[0];
                  return (
                    <ContactPerson
                      addressTags={group.addressTags}
                      availableTags={tags}
                      contact={contact}
                      key={contact.id}
                      showAddress
                      canEditAddressName={group.key !== null}
                    />
                  );
                }

                const sharedAddress = contactAddress(group.contacts[0]);
                return (
                  <li className="contact-card shared-address-card" key={group.contacts[0].id}>
                    <div className="shared-address-heading">
                      <div>
                        <p className="eyebrow">Shared mailing address</p>
                        {group.contacts[0].addressLabelName && (
                          <p className="shared-address-name">
                            {group.contacts[0].addressLabelName}
                          </p>
                        )}
                        <address>
                          {sharedAddress.map((line, index) => <span key={index}>{line}</span>)}
                        </address>
                      </div>
                      <span className="shared-address-count">{group.contacts.length} people</span>
                    </div>
                    <AddressLabelNameEditor
                      addressLabelName={group.contacts[0].addressLabelName}
                      className="shared-address-label-editor"
                      contactIds={group.contacts.map((contact) => contact.id)}
                    />
                    {group.key && (
                      <AddressTagEditor
                        contactId={group.contacts[0].id}
                        tags={group.addressTags}
                        availableTags={tags}
                      />
                    )}
                    <ul className="shared-contact-people">
                      {group.contacts.map((contact) => (
                        <ContactPerson
                          contact={contact}
                          key={contact.id}
                          showAddress={false}
                          canEditAddressName={false}
                        />
                      ))}
                    </ul>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
