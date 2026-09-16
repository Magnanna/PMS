import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "@/env";
import * as schema from "./schema";

/**
 * Next dev's Fast Refresh re-evaluates this module on almost every save,
 * which would otherwise create a brand-new postgres-js connection pool each
 * time without closing the old one — Supabase's session pooler caps at 15
 * client slots, so a day of edits exhausts it ("max clients reached in
 * session mode") and every query starts failing. Caching the client on
 * `globalThis` in dev makes hot reloads reuse the same pool. Production
 * doesn't hot-reload, so this is a no-op there — one client for the
 * process lifetime either way.
 */
const globalForDb = globalThis as unknown as { pgClient?: postgres.Sql };

const client =
  globalForDb.pgClient ?? postgres(env.DATABASE_URL, { prepare: false, max: 5 });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pgClient = client;
}

export const db = drizzle(client, { schema });
