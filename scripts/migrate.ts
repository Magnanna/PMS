/**
 * Applies drizzle/*.sql in journal order — including the hand-written
 * 0001_rls_policies.sql, which `drizzle-kit push` would skip (push only
 * diffs schema.ts-derived table DDL, not custom SQL migrations).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const client = postgres(connectionString, { max: 1, prepare: false });
  const db = drizzle(client);

  await migrate(db, { migrationsFolder: "./drizzle" });

  await client.end();
  console.log("Migrations applied.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
