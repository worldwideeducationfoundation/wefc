import "server-only";
import mysql from "mysql2/promise";
import { env } from "./env";
import { MIGRATIONS } from "./migrations.generated";

/**
 * Applies every migration that has not run yet, in name order.
 *
 * The SQL lives in db/migrations/*.sql and is bundled into the app at build
 * time (scripts/bundle-migrations.mjs), so this never depends on the host's
 * folder layout. It runs when the server starts (src/instrumentation.ts) and,
 * as a safety net, before the first database query of the process
 * (src/server/db.ts) — whichever comes first. A deploy that adds a migration
 * therefore updates the live database by itself. A named lock stops two
 * processes applying the same file at once.
 */
export async function runMigrations(log: (msg: string) => void = console.log) {
  if (!env.dbConfigured) {
    log("[db] Not configured; skipping migrations.");
    return { applied: [] as string[] };
  }

  const conn = await mysql.createConnection({
    ...env.db,
    charset: "utf8mb4_unicode_ci",
    timezone: "Z",
    multipleStatements: true,
  });

  const applied: string[] = [];
  try {
    await conn.query("SET time_zone = '+00:00'");
    const [[lock]] = await conn.query<mysql.RowDataPacket[]>("SELECT GET_LOCK('wefc_migrations', 60) AS got");
    if (!lock?.got) throw new Error("Could not acquire the migration lock.");

    try {
      await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(190) NOT NULL PRIMARY KEY,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);

      const [doneRows] = await conn.query<mysql.RowDataPacket[]>("SELECT version FROM schema_migrations");
      const done = new Set(doneRows.map((r) => String(r.version)));

      for (const { version, sql } of MIGRATIONS) {
        if (done.has(version)) continue;
        log(`[db] Applying ${version}`);
        await conn.query(sql);
        await conn.query("INSERT INTO schema_migrations (version) VALUES (?)", [version]);
        applied.push(version);
      }
    } finally {
      await conn.query("SELECT RELEASE_LOCK('wefc_migrations')");
    }
  } finally {
    await conn.end();
  }

  if (applied.length === 0) log("[db] Schema is up to date.");
  return { applied };
}
