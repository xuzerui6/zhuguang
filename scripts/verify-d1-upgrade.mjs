import { DatabaseSync } from "node:sqlite";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";

const source = process.argv[2];
if (!source) throw new Error("Pass an external D1 SQL backup path.");
const database = new DatabaseSync(":memory:", { enableForeignKeyConstraints: false });
database.exec(readFileSync(source, "utf8"));
database.exec("PRAGMA foreign_keys=ON");
const quote = (name) => `"${name.replaceAll('"', '""')}"`;
const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
const fingerprint = (name, columns) => createHash("sha256").update(JSON.stringify(database.prepare(`SELECT ${columns.map(quote).join(",")} FROM ${quote(name)}`).all().map((row) => JSON.stringify(row)).sort())).digest("hex");
const before = tables.map(({ name }) => {
  const columns = database.prepare(`PRAGMA table_info(${quote(name)})`).all().map((row) => row.name);
  return { name, columns, hash: fingerprint(name, columns) };
});
const originalForeignKeyErrors = database.prepare("PRAGMA foreign_key_check").all().length;
const migration = "0023_release_safety_and_classification.sql";
const requiredBaseline = ["app_releases", "entity_metric_classifications", "metric_classification_events", "ops_audit_logs", "product_events", "public_eligible_coach_reviews"];
for (const name of requiredBaseline) {
  const found = database.prepare("SELECT 1 FROM sqlite_master WHERE name=?").get(name);
  if (!found) throw new Error(`Production backup is not at the 0022 baseline: ${name} is missing`);
}
if (database.prepare("SELECT 1 FROM pragma_table_info('app_releases') WHERE name='revision'").get()) {
  throw new Error("The supplied backup already contains migration 0023; use a pre-migration backup for restore validation.");
}
database.exec(readFileSync(path.join("drizzle", migration), "utf8"));
const changed = before.filter((item) => fingerprint(item.name, item.columns) !== item.hash).map((item) => item.name);
if (changed.length) throw new Error(`Existing columns changed: ${changed.join(",")}`);
const integrity = database.prepare("PRAGMA integrity_check").get().integrity_check;
const foreignKeyErrors = database.prepare("PRAGMA foreign_key_check").all().length;
if (integrity !== "ok" || foreignKeyErrors > originalForeignKeyErrors) throw new Error("Restored schema failed integrity checks");
const requiredObjects = [
  ["index", "entity_metric_classification_lookup"],
  ["index", "product_event_classification_time"],
  ["trigger", "metric_classification_events_no_delete"],
  ["trigger", "metric_classification_events_no_update"],
  ["trigger", "ops_audit_logs_no_delete"],
  ["trigger", "ops_audit_logs_no_update"],
  ["trigger", "release_operations_no_delete"],
  ["trigger", "release_operations_no_update"],
  ["view", "public_eligible_coach_reviews"],
];
for (const [type, name] of requiredObjects) {
  if (!database.prepare("SELECT 1 FROM sqlite_master WHERE type=? AND name=?").get(type, name)) throw new Error(`Migration object is missing: ${type} ${name}`);
}
database.exec("SAVEPOINT immutable_check");
try {
  database.prepare("INSERT INTO ops_audit_logs(id,actor,action,entity_type,entity_id,detail_json,created_at) VALUES (?,?,?,?,?,?,?)")
    .run("migration-0023-trigger-check", "isolated-verifier", "verify", "migration", "0023", "{}", Date.now());
  database.prepare("UPDATE ops_audit_logs SET actor=actor WHERE id='migration-0023-trigger-check'").run();
  throw new Error("Audit immutability trigger did not reject an update");
} catch (error) {
  if (!/immutable/u.test(String(error))) throw error;
} finally {
  database.exec("ROLLBACK TO immutable_check; RELEASE immutable_check");
}
const report = { backupRestored: true, backupSha256: createHash("sha256").update(readFileSync(source)).digest("hex"), oldTablesUnchanged: before.length, migration, integrity, originalForeignKeyErrors, foreignKeyErrors, requiredObjects: requiredObjects.map(([, name]) => name) };
mkdirSync("artifacts/qa/code25", { recursive: true });
writeFileSync("artifacts/qa/code25/d1-restore-validation.json", JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
database.close();
