import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";
import { headers } from "next/dist/server/request/headers";
import { redirect } from "next/dist/client/components/navigation";

import {
  Home,
  MailOutlineOutlined,
  Outbox,
  Settings
} from "@mui/icons-material"

export default async function Navigation() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  return (
    <nav aria-label="Main navigation" className="navigation">
      <div className="navigation-links">
        <Link href="/dashboard"><Home /></Link>
        <Link href="/dashboard/mailing-lists"><MailOutlineOutlined /></Link>
        <Link href="/dashboard/outreach"><Outbox /></Link>
        <Link href="/dashboard/settings"><Settings /></Link>
        <SignOutButton />
      </div>
    </nav>
  );
}