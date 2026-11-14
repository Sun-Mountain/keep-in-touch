import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { auth } from "@/lib/auth";

export default async function Home() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) redirect("/dashboard");

  return (
    <main className="auth-page">
      <section className="auth-intro">
        <Link className="wordmark" href="/">
          <span className="brand-mark" aria-hidden="true">k</span>
          keep in touch
        </Link>
        <div className="intro-copy">
          <p className="eyebrow">A little more thoughtful</p>
          <h1>Good relationships don’t happen by accident.</h1>
          <p className="intro-description">
            Remember the people who matter, make time for a quick hello, and
            keep the connections you care about close.
          </p>
          <div className="intro-note">
            <span className="note-dot" />
            Your people, all in one place.
          </div>
        </div>
        <p className="intro-footer">Make room for the people who make life.</p>
      </section>
      <section className="auth-panel">
        <AuthForm />
      </section>
    </main>
  );
}
