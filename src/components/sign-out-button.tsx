"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [error, setError] = useState("");

  async function handleSignOut() {
    setError("");
    const { error: signOutError } = await authClient.signOut();
    if (signOutError) {
      setError(signOutError.message ?? "Could not sign out. Please try again.");
      return;
    }
    router.push("/admin");
    router.refresh();
  }

  return (
    <div>
      <button className="sign-out-button" onClick={handleSignOut} type="button">
        Sign out <span aria-hidden="true">↗</span>
      </button>
      {error && <p className="form-error" role="alert">{error}</p>}
    </div>
  );
}
