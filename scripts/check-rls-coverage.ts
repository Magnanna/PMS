/**
 * CI gate (US-A2): fails the build if a table exists in src/db/schema.ts
 * without a matching "ENABLE ROW LEVEL SECURITY" statement somewhere in
 * drizzle/*.sql. Static/textual on purpose — no live DB needed in CI.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const schemaPath = join(__dirname, "..", "src", "db", "schema.ts");
const drizzleDir = join(__dirname, "..", "drizzle");

const schemaSource = readFileSync(schemaPath, "utf8");
const tableNameRegex = /pgTable\(\s*"([a-z0-9_]+)"/g;
const tableNames = [...schemaSource.matchAll(tableNameRegex)].map((m) => m[1]);

if (tableNames.length === 0) {
  console.error("No tables found in schema.ts — regex likely out of date.");
  process.exit(1);
}

const migrationFiles = readdirSync(drizzleDir).filter((f) => f.endsWith(".sql"));
const migrationSource = migrationFiles
  .map((f) => readFileSync(join(drizzleDir, f), "utf8"))
  .join("\n");

const missing = tableNames.filter((name) => {
  const enableRlsRegex = new RegExp(
    `alter table ${name} enable row level security`,
    "i"
  );
  return !enableRlsRegex.test(migrationSource);
});

if (missing.length > 0) {
  console.error(
    `RLS coverage check FAILED — ${missing.length} table(s) have no "ENABLE ROW LEVEL SECURITY" statement:\n` +
      missing.map((t) => `  - ${t}`).join("\n") +
      "\n\nAdd a policy migration for these before merging (see drizzle/0001_rls_policies.sql for the pattern)."
  );
  process.exit(1);
}

console.log(`RLS coverage check passed — ${tableNames.length} tables all have RLS enabled.`);
