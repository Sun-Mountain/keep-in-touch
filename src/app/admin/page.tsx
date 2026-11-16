import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { auth } from "@/lib/auth";

export default async function Admin() {
  const session = await auth.api.getSession({ headers: await headers() });

  if (session) redirect("/dashboard");

  return (
    <div className="center-in-page">
      <AuthForm />
    </div>
  );
}
