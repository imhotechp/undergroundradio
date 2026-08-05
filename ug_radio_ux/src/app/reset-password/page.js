"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { confirmPasswordReset } from "@/app/lib/api";

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetPasswordForm />
    </Suspense>
  );
}

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const uid = searchParams.get("uid");
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await confirmPasswordReset(uid, token, password);
      setDone(true);
    } catch (err) {
      setError(err.message ?? "Could not reset password.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!uid || !token) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12 text-center text-[var(--theme-fg)]">
        <div className="mx-auto w-full max-w-sm space-y-3 rounded-2xl border border-white/10 bg-[rgb(var(--theme-bg-rgb)/70%)] p-6 shadow-2xl backdrop-blur-xl">
          <h1 className="text-xl font-bold tracking-tight">Invalid link</h1>
          <p className="text-sm text-white/60">
            This password reset link is invalid or missing its token. Request a new one.
          </p>
          <Link href="/forgot-password" className="block text-center text-sm underline" style={{ color: "var(--theme-accent)" }}>
            Request a new link
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12 text-[var(--theme-fg)]">
      <div className="mx-auto w-full max-w-sm space-y-5 rounded-2xl border border-white/10 bg-[rgb(var(--theme-bg-rgb)/70%)] p-6 shadow-2xl backdrop-blur-xl">
        <h1 className="text-2xl font-bold tracking-tight">Set a new password</h1>

        {done ? (
          <>
            <p className="text-sm text-white/70">Your password has been reset.</p>
            <Link href="/login" className="block text-center text-sm underline" style={{ color: "var(--theme-accent)" }}>
              Log in
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm text-white/60">
                New password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-base outline-none focus:border-white/50"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="confirmPassword" className="text-sm text-white/60">
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
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
              {submitting ? "Resetting..." : "Reset password"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
