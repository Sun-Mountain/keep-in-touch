"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AuthForm() {
  const router = useRouter();
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = isSignUp
        ? await authClient.signUp.email({ name, email, password })
        : await authClient.signIn.email({ email, password });

      if (result.error) {
        setError(result.error.message ?? "Something went wrong. Please try again.");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("We couldn’t connect. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <div className="mobile-wordmark">
        <span className="brand-mark" aria-hidden="true">k</span>
        keep in touch
      </div>
      <p className="eyebrow">{isSignUp ? "Start your little black book" : "Welcome back"}</p>
      <h2>{isSignUp ? "Make it meaningful." : "Pick up where you left off."}</h2>
      <p className="form-description">
        {isSignUp
          ? "Create an account and start keeping your people close."
          : "Sign in to your personal corner of the world."}
      </p>

      <form className="auth-form" onSubmit={handleSubmit}>
        {isSignUp && (
          <label>
            Your name
            <input
              autoComplete="name"
              onChange={(event) => setName(event.target.value)}
              placeholder="Alex Morgan"
              required
              value={name}
            />
          </label>
        )}
        <label>
          Email address
          <input
            autoComplete="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            required
            type="email"
            value={email}
          />
        </label>
        <label>
          Password
          <input
            autoComplete={isSignUp ? "new-password" : "current-password"}
            minLength={8}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="At least 8 characters"
            required
            type="password"
            value={password}
          />
        </label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary submit-button" disabled={isLoading} type="submit">
          {isLoading ? "One moment..." : isSignUp ? "Create your account" : "Sign in"}
          {!isLoading && <span aria-hidden="true">→</span>}
        </button>
      </form>

      <p className="form-switch">
        {isSignUp ? "Already have an account?" : "New around here?"}{" "}
        <button
          className="text-button"
          onClick={() => {
            setIsSignUp(!isSignUp);
            setError("");
          }}
          type="button"
        >
          {isSignUp ? "Sign in" : "Create an account"}
        </button>
      </p>
      <p className="privacy-note">Just for you. Your contacts stay private.</p>
    </div>
  );
}
