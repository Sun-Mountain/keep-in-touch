import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { MailingLists } from "./manager";
import { auth } from "@/lib/auth";
import { decryptContactDetails } from "@/lib/contact-crypto";
import { db } from "@/lib/db";

export default async function MailingListsPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  const [storedContacts, storedMailingLists] = await Promise.all([
    db.contact.findMany({
      where: { userId: session.user.id },
      orderBy: { updatedAt: "desc" },
    }),
    db.mailingList.findMany({
      where: { userId: session.user.id },
      orderBy: { createdAt: "desc" },
      include: {
        members: {
          where: { contact: { userId: session.user.id } },
          include: { contact: true },
        },
      },
    }),
  ]);
  const contacts = storedContacts.map((contact) => ({
    id: contact.id,
    ...decryptContactDetails(contact),
  }));
  const mailingLists = storedMailingLists.map((mailingList) => ({
    id: mailingList.id,
    name: mailingList.name,
    contacts: mailingList.members.map((member) => ({
      id: member.contact.id,
      sentAt: member.sentAt,
      mailingListAddressLabelName: member.addressLabelName,
      ...decryptContactDetails(member.contact),
    })),
  }));

  return (
    <div className="dashboard-page">
      <header className="dashboard-header">
        <div>
          <p className="eyebrow">Send something thoughtful</p>
          <h1>Mailing lists</h1>
        </div>
        <p>Save reusable groups of people and print their mailing addresses.</p>
      </header>

      <MailingLists
        contacts={contacts.map(
          ({
            id,
            name,
            addressLine1,
            addressLine2,
            addressCity,
            addressRegion,
            addressPostalCode,
            addressCountry,
          }) => ({
            id,
            name,
            addressLine1,
            addressLine2,
            addressCity,
            addressRegion,
            addressPostalCode,
            addressCountry,
          }),
        )}
        mailingLists={mailingLists}
      />
    </div>
  );
}
