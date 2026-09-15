import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  /* config options here */
};

export default withSentryConfig(nextConfig, {
  silent: true,
  // No org/project auto-upload of source maps unless SENTRY_AUTH_TOKEN is set —
  // keeps `next build` working without Sentry credentials in dev/CI.
});
