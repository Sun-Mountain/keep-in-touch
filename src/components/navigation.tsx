import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";
import { headers } from "next/dist/server/request/headers";
import { redirect } from "next/dist/client/components/navigation";

export default async function Navigation() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  return (
    <nav aria-label="Main navigation" className="navigation">
      <div className="navigation-links">
        <Link href="/dashboard">Your circle</Link>
        <Link href="/dashboard/mailing-lists">Mailing lists</Link>
        <Link href="/dashboard/outreach">Email and text</Link>
        <Link href="/dashboard/settings">Settings</Link>
        <SignOutButton />
      </div>
    </nav>
  );
}