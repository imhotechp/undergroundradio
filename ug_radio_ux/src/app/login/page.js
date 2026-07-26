"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/app/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(username, password);
      router.push("/home");
    } catch (err) {
      setError(err.message ?? "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12 text-[var(--theme-fg)]">
      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-sm space-y-5 rounded-2xl border border-white/10 bg-[var(--theme-bg)]/70 p-6 shadow-2xl backdrop-blur-xl"
      >
        <h1 className="text-2xl font-bold tracking-tight">Log in</h1>

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

        <div className="space-y-1">
          <label htmlFor="password" className="text-sm text-white/60">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
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
          {submitting ? "Logging in..." : "Log in"}
        </button>
      </form>
    </div>
  );
}
