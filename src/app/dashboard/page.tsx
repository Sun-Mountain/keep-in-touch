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
    <div className="dashboard-page">
      <div className="content">

      </div>
    </div>
  );
}
