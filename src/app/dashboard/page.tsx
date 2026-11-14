import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { addContact, deleteContact } from "@/app/dashboard/actions";
import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";
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

  const contacts = await db.contact.findMany({
    where: { userId: session.user.id },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <main className="dashboard-page">
      <header className="dashboard-header">
        <Link className="wordmark" href="/dashboard">
          <span className="brand-mark" aria-hidden="true">k</span>
          keep in touch
        </Link>
        <div className="header-account">
          <span className="account-name">{session.user.name}</span>
          <SignOutButton />
        </div>
      </header>

      <div className="dashboard-content">
        <section className="dashboard-welcome">
          <div>
            <p className="eyebrow">Your little black book</p>
            <h1>People worth keeping close.</h1>
            <p className="intro-description">
              A home for the names, notes, and little details you don’t want to forget.
            </p>
          </div>
          <div className="contact-count">
            <span>{String(contacts.length).padStart(2, "0")}</span>
            <small>{contacts.length === 1 ? "person" : "people"} in your circle</small>
          </div>
        </section>

        <div className="dashboard-grid">
          <section className="contact-section">
            <div className="section-heading">
              <div>
                <p className="eyebrow">Your circle</p>
                <h2>All your people</h2>
              </div>
              <span className="subtle-count">{contacts.length} saved</span>
            </div>

            {contacts.length === 0 ? (
              <div className="empty-state">
                <span className="empty-icon" aria-hidden="true">✳</span>
                <h3>Your circle starts here.</h3>
                <p>Add someone you’d like to remember to reach out to.</p>
              </div>
            ) : (
              <ul className="contact-list">
                {contacts.map((contact, index) => (
                  <li className="contact-card" key={contact.id}>
                    <span className={`avatar avatar-${index % 5}`}>{initials(contact.name)}</span>
                    <div className="contact-details">
                      <h3>{contact.name}</h3>
                      <p>{[contact.company, contact.email].filter(Boolean).join(" · ") || "A person in your circle"}</p>
                      {contact.notes && <p className="contact-notes">{contact.notes}</p>}
                    </div>
                    <form action={deleteContact}>
                      <input name="id" type="hidden" value={contact.id} />
                      <button className="icon-button" aria-label={`Remove ${contact.name}`} title="Remove contact" type="submit">
                        ×
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <aside className="add-contact-card">
            <p className="eyebrow">A new connection</p>
            <h2>Add someone to your circle.</h2>
            <p className="form-description">Keep the little details close. You can always add more later.</p>
            <form action={addContact} className="contact-form">
              <label>
                Name
                <input autoComplete="name" name="name" placeholder="Their name" required />
              </label>
              <label>
                Email <span className="optional-label">Optional</span>
                <input autoComplete="email" name="email" placeholder="hello@example.com" type="email" />
              </label>
              <label>
                Where you know them <span className="optional-label">Optional</span>
                <input name="company" placeholder="Company, community, or elsewhere" />
              </label>
              <label>
                A note to remember <span className="optional-label">Optional</span>
                <textarea name="notes" placeholder="What would be nice to ask them about?" rows={3} />
              </label>
              <button className="button button-primary" type="submit">
                Add to your circle <span aria-hidden="true">+</span>
              </button>
            </form>
          </aside>
        </div>
      </div>
    </main>
  );
}
