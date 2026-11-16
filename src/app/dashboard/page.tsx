import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { deleteContact } from "@/app/dashboard/actions";
import { ContactEditor } from "@/app/dashboard/contact-editor";
import { ContactImportForm } from "@/app/dashboard/contact-import-form";
import { ContactForm } from "@/app/dashboard/contact-form";
import { auth } from "@/lib/auth";
import { decryptContactDetails } from "@/lib/contact-crypto";
import { db } from "@/lib/db";

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default async function Dashboard() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const storedContacts = await db.contact.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });
  const contacts = storedContacts.map((contact) => ({
    ...contact,
    ...decryptContactDetails(contact),
  }));

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">The people who matter</p>
          <h1>Your circle</h1>
        </div>
        <p>Keep the little details close, so staying in touch feels natural.</p>
      </header>

      <div className="dashboard-content">
        <div className="contact-entry-options">
          <details className="add-contact-panel import-contact-panel" name="contact-entry" open>
            <summary className="panel-heading accordion-heading">
              <p className="eyebrow">Bring your people together</p>
              <h2 id="import-contacts-title">Import contacts</h2>
            </summary>
            <ContactImportForm />
          </details>
          <details className="add-contact-panel" name="contact-entry">
            <summary className="panel-heading accordion-heading">
              <p className="eyebrow">A new connection</p>
              <h2 id="add-contact-title">Add a person</h2>
            </summary>
            <ContactForm />
          </details>
        </div>

        <section className="contacts-section" aria-labelledby="contacts-title">
          <div className="contacts-heading">
            <h2 id="contacts-title">Your people</h2>
            <span>{contacts.length}</span>
          </div>
          {contacts.length === 0 ? (
            <div className="empty-contacts">
              <p>Your circle is ready to grow.</p>
              <span>Add someone to keep their details in one thoughtful place.</span>
            </div>
          ) : (
            <ul className="contact-list">
              {contacts.map((contact) => {
                const familyMembers = contact.familyMembers
                  ?.split(/\r?\n/)
                  .map((member) => member.trim())
                  .filter(Boolean);
                const address = [
                  contact.addressLine1,
                  contact.addressLine2,
                  [contact.addressCity, contact.addressRegion, contact.addressPostalCode]
                    .filter(Boolean)
                    .join(", "),
                  contact.addressCountry,
                ].filter(Boolean);

                return (
                  <li className="contact-card" key={contact.id}>
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

                    {(contact.email || contact.phone || contact.birthday || familyMembers?.length || address.length || contact.notes) && (
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
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
