import { withSentryConfig } from "@sentry/nextjs/config";

/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactCompiler: true,
  reactStrictMode: true,
  allowedDevOrigins:  ['72.61.75.183']
};

export default withSentryConfig(nextConfig, {
  // Optional — only needed to upload source maps for readable stack traces.
  // Without these set, the build just skips the upload with a warning;
  // error reporting itself still works via NEXT_PUBLIC_SENTRY_DSN.
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
});
