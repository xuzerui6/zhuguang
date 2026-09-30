import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";

const backupPath = process.argv[2];
if (!backupPath) throw new Error("An external D1 backup path is required");
const database = new DatabaseSync(":memory:");
const digest = rows => createHash("sha256").update(rows.map(row => JSON.stringify(row)).sort().join("\n")).digest("hex");
try {
  // D1 exports may insert child rows before creating their referenced tables.
  database.exec("PRAGMA foreign_keys=OFF");
  database.exec(await readFile(backupPath, "utf8"));
  database.exec("PRAGMA foreign_keys=ON");
  const tables = database.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
  const before = tables.map(({ name }) => {
    const columns = database.prepare(`PRAGMA table_info("${name}")`).all().map(column => `"${column.name}"`).join(",");
    const rows = database.prepare(`SELECT ${columns} FROM "${name}"`).all();
    return { name, columns, count: rows.length, hash: digest(rows) };
  });
  database.exec(await readFile(new URL("../drizzle/0025_multicity_coach_onboarding.sql", import.meta.url), "utf8"));
  for (const table of before) {
    const rows = database.prepare(`SELECT ${table.columns} FROM "${table.name}"`).all();
    if (rows.length !== table.count || digest(rows) !== table.hash) throw new Error(`Historical data changed: ${table.name}`);
  }
  if (database.prepare("PRAGMA integrity_check").get().integrity_check !== "ok") throw new Error("Integrity check failed");
  if (database.prepare("PRAGMA foreign_key_check").all().length) throw new Error("Foreign key check failed");
  if (database.prepare("SELECT count(*) AS n FROM service_areas").get().n !== 23) throw new Error("Service area backfill failed");
  console.log(JSON.stringify({ restored: true, historicalTablesUnchanged: before.length, migration: "0025", integrity: "ok", foreignKeys: "ok" }));
} finally {
  database.close();
}
