"use client";

import { useState } from "react";
import Link from "next/link";
import { requestPasswordReset } from "@/app/lib/api";

export default function ForgotPasswordPage() {
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await requestPasswordReset(username);
      setSent(true);
    } catch (err) {
      setError(err.message ?? "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12 text-[var(--theme-fg)]">
      <div className="mx-auto w-full max-w-sm space-y-5 rounded-2xl border border-white/10 bg-[rgb(var(--theme-bg-rgb)/70%)] p-6 shadow-2xl backdrop-blur-xl">
        <h1 className="text-2xl font-bold tracking-tight">Reset your password</h1>

        {sent ? (
          <>
            <p className="text-sm text-white/70">
              If that account exists, we&apos;ve sent a password reset link to the email on file.
            </p>
            <Link href="/login" className="block text-center text-sm underline" style={{ color: "var(--theme-accent)" }}>
              Back to log in
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <p className="text-sm text-white/60">
              Enter your username and we&apos;ll email you a link to reset your password.
            </p>
            <div className="space-y-1">
              <label htmlFor="username" className="text-sm text-white/60">
                Username
              </label>
              <input
                id="username"
                name="username"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-base outline-none focus:border-white/50"
              />
            </div>

            {error && <p className="text-sm text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg py-2.5 font-medium text-white disabled:opacity-50"
              style={{ backgroundColor: "var(--theme-accent)" }}
            >
              {submitting ? "Sending..." : "Send reset link"}
            </button>

            <Link href="/login" className="block text-center text-sm text-white/50">
              Back to log in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
