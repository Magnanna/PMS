import { z } from "zod";

/**
 * Boot-time env validation. Import `env` instead of reading `process.env`
 * directly anywhere in the app — an invalid/missing var fails fast here
 * instead of surfacing as a confusing runtime bug later.
 *
 * Per-org Daraja (M-Pesa) credentials are NOT here — those are DB-encrypted,
 * not env vars (Section 10/NFR-2 of the PRD).
 */
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  ADVANTA_API_KEY: z.string().min(1).optional(),
  ADVANTA_PARTNER_ID: z.string().min(1).optional(),
  MPESA_CREDENTIALS_ENC_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url().optional(),
  SENTRY_AUTH_TOKEN: z.string().min(1).optional(),
});

const clientSchema = z.object({
  NEXT_PUBLIC_SITE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SENTRY_DSN: z.string().url().optional(),
});

const schema = serverSchema.merge(clientSchema);

type Env = z.infer<typeof schema>;

function loadEnv(): Env {
  const isServer = typeof window === "undefined";
  const parsed = (isServer ? schema : clientSchema).safeParse(process.env);

  if (!parsed.success) {
    console.error(
      "Invalid environment variables:",
      parsed.error.flatten().fieldErrors
    );
    throw new Error("Invalid environment variables — see .env.example");
  }

  return parsed.data as Env;
}

export const env = loadEnv();
