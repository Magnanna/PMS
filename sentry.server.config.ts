import * as Sentry from "@sentry/nextjs";

// No-ops cleanly if SENTRY_DSN is unset (dev/CI) — see NFR-6.
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
});
