import * as Sentry from "@sentry/nextjs";

// No-ops when NEXT_PUBLIC_SENTRY_DSN is unset (e.g. local dev) — Sentry.init
// without a dsn just disables the client instead of throwing.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
