import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ContactOutreach } from "@/app/dashboard/contact-outreach";
import { auth } from "@/lib/auth";
import { decryptContactDetails } from "@/lib/contact-crypto";
import { db } from "@/lib/db";

export default async function OutreachPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const [storedContacts, gmailConnection, protonConnection] = await Promise.all([
    db.contact.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    }),
    db.gmailConnection.findUnique({
      where: { userId: session.user.id },
      select: { email: true },
    }),
    db.protonConnection.findUnique({
      where: { userId: session.user.id },
      select: { email: true },
    }),
  ]);
  const contacts = storedContacts.map((contact) => ({
    id: contact.id,
    ...decryptContactDetails(contact),
  }));

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Stay in touch</p>
          <h1>Email and text</h1>
        </div>
        <p>Send personal update checks or open individual drafts for your contacts.</p>
      </header>

      <ContactOutreach
        contacts={contacts.map(({ id, name, email, phone }) => ({
          id,
          name,
          email,
          phone,
        }))}
        gmailEmail={gmailConnection?.email ?? null}
        protonEmail={protonConnection?.email ?? null}
        gmailOAuthConfigured={Boolean(
          process.env.GOOGLE_CLIENT_ID?.trim() &&
            process.env.GOOGLE_CLIENT_SECRET?.trim() &&
            process.env.GOOGLE_REDIRECT_URI?.trim(),
        )}
      />
    </div>
  );
}
