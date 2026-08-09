"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ApiError, login, signup } from "@/app/lib/api";

export default function MusicV2Page() {
  return (
    <Suspense fallback={null}>
      <MusicV2Form />
    </Suspense>
  );
}

// Mirrors the backend's AccountSerializer.validate() (myapp/serializers.py)
// exactly, so obvious mistakes surface instantly under the right box instead
// of waiting on a round trip. The backend re-checks all of this regardless —
// this is only for faster feedback, not the source of truth.
const USERNAME_RE = /^\w{3,20}$/;
const PASSWORD_RE = /^[a-zA-Z0-9_!@#$]{8,}$/;
const EMAIL_RE = /^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9.-]+$/;
const PHONE_RE = /^\d{10}$/;

function validateSignupFields({ username, password, email, phoneNumber }) {
  const errors = {};
  if (!USERNAME_RE.test(username)) {
    errors.username = username.length < 3 || username.length > 20
      ? "Username must be between 3 and 20 characters."
      : "Only letters, numbers, and underscores are allowed in username.";
  }
  if (!PASSWORD_RE.test(password)) {
    errors.password = password.length < 8
      ? "Password must be at least 8 characters long."
      : 'Only letters, numbers, and these special characters "_!@#$" are allowed in password.';
  }
  if (!EMAIL_RE.test(email)) {
    errors.email = "Enter a valid email address.";
  }
  if (!PHONE_RE.test(phoneNumber)) {
    errors.phoneNumber = "Enter a valid 10-digit US phone number.";
  }
  return errors;
}

// Backend field errors come back snake_case (phone_number); form state is camelCase.
function mapServerFieldErrors(fields) {
  if (!fields) return {};
  const { phone_number, ...rest } = fields;
  return phone_number !== undefined ? { ...rest, phoneNumber: phone_number } : rest;
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
  const [fieldErrors, setFieldErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);

  function toggleMode() {
    setError("");
    setFieldErrors({});
    setMode((m) => (m === "signup" ? "login" : "signup"));
  }

  function updateField(setter, name) {
    return (e) => {
      setter(e.target.value);
      if (fieldErrors[name]) {
        setFieldErrors((prev) => {
          const next = { ...prev };
          delete next[name];
          return next;
        });
      }
    };
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setFieldErrors({});

    if (mode === "signup") {
      const clientErrors = validateSignupFields({ username, password, email, phoneNumber });
      if (Object.keys(clientErrors).length > 0) {
        setFieldErrors(clientErrors);
        return;
      }
    }

    setSubmitting(true);
    try {
      if (mode === "signup") {
        await signup(username, password, email, phoneNumber, token);
      } else {
        await login(username, password, token);
      }
      // The song this token references is attached by mp3juug.com in a
      // separate, async server-to-server call that isn't guaranteed to have
      // finished yet — justJoined tells /home to poll briefly instead of
      // possibly rendering an empty library.
      router.push("/home?justJoined=1");
    } catch (err) {
      const message = err.message ?? "Something went wrong.";
      const serverFields = err instanceof ApiError ? mapServerFieldErrors(err.fields) : undefined;
      // signup failed because this username already has an account — switch
      // them into login mode instead of leaving them stuck on a dead-end error
      if (mode === "signup" && serverFields?.username?.toLowerCase().includes("already taken")) {
        setMode("login");
        setPassword("");
        setError("You already have an account with that username — log in below to add this song to your library.");
      } else if (mode === "signup" && serverFields) {
        setFieldErrors(serverFields);
      } else {
        // Login errors intentionally stay generic (not tied to username vs.
        // password) so a failed attempt doesn't reveal which one was wrong.
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
            onChange={updateField(setUsername, "username")}
            required
            aria-invalid={!!fieldErrors.username}
            aria-describedby={fieldErrors.username ? "username-error" : undefined}
            className={`w-full rounded-lg border bg-white/10 px-3 py-2.5 text-base outline-none focus:border-white/50 ${fieldErrors.username ? "border-red-400/70" : "border-white/20"}`}
          />
          {fieldErrors.username && (
            <p id="username-error" role="alert" className="text-sm text-red-400">
              {fieldErrors.username}
            </p>
          )}
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
            onChange={updateField(setPassword, "password")}
            required
            aria-invalid={!!fieldErrors.password}
            aria-describedby={fieldErrors.password ? "password-error" : undefined}
            className={`w-full rounded-lg border bg-white/10 px-3 py-2.5 text-base outline-none focus:border-white/50 ${fieldErrors.password ? "border-red-400/70" : "border-white/20"}`}
          />
          {fieldErrors.password && (
            <p id="password-error" role="alert" className="text-sm text-red-400">
              {fieldErrors.password}
            </p>
          )}
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
                onChange={updateField(setEmail, "email")}
                required
                aria-invalid={!!fieldErrors.email}
                aria-describedby={fieldErrors.email ? "email-error" : undefined}
                className={`w-full rounded-lg border bg-white/10 px-3 py-2.5 text-base outline-none focus:border-white/50 ${fieldErrors.email ? "border-red-400/70" : "border-white/20"}`}
              />
              {fieldErrors.email && (
                <p id="email-error" role="alert" className="text-sm text-red-400">
                  {fieldErrors.email}
                </p>
              )}
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
                onChange={updateField(setPhoneNumber, "phoneNumber")}
                required
                aria-invalid={!!fieldErrors.phoneNumber}
                aria-describedby={fieldErrors.phoneNumber ? "phoneNumber-error" : undefined}
                className={`w-full rounded-lg border bg-white/10 px-3 py-2.5 text-base outline-none focus:border-white/50 ${fieldErrors.phoneNumber ? "border-red-400/70" : "border-white/20"}`}
              />
              {fieldErrors.phoneNumber && (
                <p id="phoneNumber-error" role="alert" className="text-sm text-red-400">
                  {fieldErrors.phoneNumber}
                </p>
              )}
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
