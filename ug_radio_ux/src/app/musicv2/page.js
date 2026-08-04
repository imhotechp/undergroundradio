"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login, signup } from "@/app/lib/api";

export default function MusicV2Page() {
  return (
    <Suspense fallback={null}>
      <MusicV2Form />
    </Suspense>
  );
}

function MusicV2Form() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [mode, setMode] = useState("signup"); // signup | login
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function toggleMode() {
    setError("");
    setMode((m) => (m === "signup" ? "login" : "signup"));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signup(username, password, email, phoneNumber, token);
      } else {
        await login(username, password, token);
      }
      router.push("/home");
    } catch (err) {
      const message = err.message ?? "Something went wrong.";
      // signup failed because this username already has an account — switch
      // them into login mode instead of leaving them stuck on a dead-end error
      if (mode === "signup" && message.toLowerCase().includes("already taken")) {
        setMode("login");
        setPassword("");
        setError("You already have an account with that username — log in below to add this song to your library.");
      } else {
        setError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-12 text-center text-[var(--theme-fg)]">
        <div className="mx-auto w-full max-w-sm space-y-3 rounded-2xl border border-white/10 bg-[rgb(var(--theme-bg-rgb)/70%)] p-6 shadow-2xl backdrop-blur-xl">
          <h1 className="text-xl font-bold tracking-tight">Invalid link</h1>
          <p className="text-sm text-white/60">
            This link is invalid or missing its token. Ask for a new one.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-12 text-[var(--theme-fg)]">
      <form
        onSubmit={handleSubmit}
        className="mx-auto w-full max-w-sm space-y-5 rounded-2xl border border-white/10 bg-[rgb(var(--theme-bg-rgb)/70%)] p-6 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight">
            {mode === "signup" ? "Create your account" : "Log in"}
          </h1>
          <button
            type="button"
            onClick={toggleMode}
            className="shrink-0 pt-1 text-right text-xs font-medium text-white/50 underline-offset-2 hover:underline"
          >
            {mode === "signup" ? "Already have an account? Log in" : "New here? Sign up"}
          </button>
        </div>

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
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-base outline-none focus:border-white/50"
          />
        </div>

        {mode === "signup" && (
          <>
            <div className="space-y-1">
              <label htmlFor="email" className="text-sm text-white/60">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-base outline-none focus:border-white/50"
              />
            </div>

            <div className="space-y-1">
              <label htmlFor="phoneNumber" className="text-sm text-white/60">
                Phone Number
              </label>
              <input
                id="phoneNumber"
                name="phoneNumber"
                type="tel"
                autoComplete="tel"
                placeholder="5551234567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                required
                className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-base outline-none focus:border-white/50"
              />
            </div>
          </>
        )}

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg py-2.5 font-medium text-white disabled:opacity-50"
          style={{ backgroundColor: "var(--theme-accent)" }}
        >
          {submitting
            ? mode === "signup"
              ? "Creating account..."
              : "Logging in..."
            : mode === "signup"
              ? "Create account"
              : "Log in"}
        </button>

        <button
          type="button"
          onClick={toggleMode}
          className="w-full text-center text-sm text-white/50"
        >
          {mode === "signup"
            ? "Already have an account? Log in instead"
            : "New here? Create an account instead"}
        </button>
      </form>
    </div>
  );
}
