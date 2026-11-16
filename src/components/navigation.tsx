import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { auth } from "@/lib/auth";
import { headers } from "next/dist/server/request/headers";
import { redirect } from "next/dist/client/components/navigation";

export default async function Navigation() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/");

  return (
    <nav className="navigation">
      {/* <Link className="wordmark" href="/dashboard">
        <span className="brand-mark" aria-hidden="true">k</span>
        keep in touch
      </Link>
      <div className="header-account">
        <span className="account-name">{session.user.name}</span>
        <SignOutButton />
      </div> */}
      <div>
        <SignOutButton />
      </div>
    </nav>
  );
}