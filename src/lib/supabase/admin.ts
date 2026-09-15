import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { env } from "@/env";

/**
 * Service-role client — bypasses RLS. Server-only (the `server-only` import
 * throws if this is ever pulled into a client bundle). Use ONLY for trusted
 * server paths (webhooks, cron, admin console) — never per-request user
 * reads, which must go through the RLS-scoped client in server.ts.
 */
export function createAdminClient() {
  return createSupabaseClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
