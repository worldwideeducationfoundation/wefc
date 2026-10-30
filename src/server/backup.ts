import "server-only";
import { createWriteStream } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import * as tar from "tar";
import { invalidateContent } from "./cache";
import { execute, query, transaction } from "./db";
import { env } from "./env";

/**
 * Full backups of the website's content: every content table as JSON plus
 * every uploaded image, in one .tar.gz.
 *
 * Admin accounts, sessions and the activity log are deliberately NOT in a
 * backup: a downloadable file should never carry password hashes, and
 * restoring one must never lock the people restoring it out.
 *
 * Restoring replaces all content with the backup's and adds its images to the
 * server. It is also the way to move content between two installs — for
 * example from a local copy to the live site.
 */
export const BACKUP_TABLES = [
  "media",
  "settings",
  "content_blocks",
  "core_pages",
  "pages",
  "nav_items",
  "hero_slides",
  "programs",
  "stats",
  "learning_centers",
  "faqs",
  "team_groups",
  "team_members",
  "gallery_categories",
  "gallery_items",
  "authors",
  "categories",
  "posts",
  "post_categories",
  "testimonials",
  "submissions",
  "newsletter_subscribers",
] as const;

/** Columns pointing at admin accounts, which a backup does not include. */
const USER_COLUMNS: Record<string, string[]> = {
  media: ["created_by"],
  submissions: ["handled_by"],
  settings: ["updated_by"],
  content_blocks: ["updated_by"],
  core_pages: ["updated_by"],
};

const FORMAT = "wefc-backup-1";

/** Writes a backup archive and returns its path; the caller streams and deletes it. */
export async function createBackup(): Promise<{ file: string; dir: string }> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "wefc-backup-"));
  const data: Record<string, unknown[]> = {};
  for (const table of BACKUP_TABLES) {
    data[table] = await query(`SELECT * FROM ${table}`);
  }
  await writeFile(
    path.join(dir, "database.json"),
    JSON.stringify({ format: FORMAT, createdAt: new Date().toISOString(), tables: data }),
  );

  const entries = ["database.json"];
  try {
    if ((await stat(env.uploadDir)).isDirectory()) {
      // A link to the uploads folder, followed when archiving, so images are
      // streamed straight from where they live rather than copied first.
      await symlink(env.uploadDir, path.join(dir, "uploads"), "junction");
      entries.push("uploads");
    }
  } catch {
    /* no uploads yet */
  }

  const file = path.join(dir, "backup.tar.gz");
  await tar.c({ gzip: true, cwd: dir, file, follow: true, portable: true }, entries);
  return { file, dir };
}

const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;

/** Restores a backup archive streamed in `body`. Returns a summary. */
export async function restoreBackup(body: ReadableStream<Uint8Array>): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), "wefc-restore-"));
  try {
    const archive = path.join(dir, "upload.tar.gz");
    await pipeline(Readable.fromWeb(body as never), createWriteStream(archive));

    const out = path.join(dir, "x");
    await mkdir(out);
    await tar.x({
      file: archive,
      cwd: out,
      strict: true,
      // Only the two things a backup contains; nothing may escape the folder.
      filter: (p) => p === "database.json" || p.startsWith("uploads/"),
    });

    let parsed: { format?: string; tables?: Record<string, Record<string, unknown>[]> };
    try {
      parsed = JSON.parse(await readFile(path.join(out, "database.json"), "utf8"));
    } catch {
      throw new Error("That file is not a backup from this admin.");
    }
    if (parsed.format !== FORMAT || !parsed.tables) throw new Error("That file is not a backup from this admin.");
    const tables = parsed.tables;

    let rowCount = 0;
    await transaction(async (conn) => {
      await execute("SET FOREIGN_KEY_CHECKS = 0", [], conn);
      try {
        await fill(conn);
      } finally {
        // The connection goes back to the pool; it must not keep checks off.
        await execute("SET FOREIGN_KEY_CHECKS = 1", [], conn);
      }
    });

    async function fill(conn: Parameters<Parameters<typeof transaction>[0]>[0]) {
      for (const table of BACKUP_TABLES) await execute(`DELETE FROM ${table}`, [], conn);
      for (const table of BACKUP_TABLES) {
        const rows = tables[table] ?? [];
        for (const raw of rows) {
          const row: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(raw)) {
            if (!/^[a-z_]+$/.test(k)) continue;
            row[k] = typeof v === "string" && ISO.test(v) ? new Date(v) : v;
          }
          for (const c of USER_COLUMNS[table] ?? []) if (c in row) row[c] = null;
          await execute(`INSERT INTO ${table} SET ?`, [row], conn);
          rowCount++;
        }
      }
    }

    let images = 0;
    try {
      const src = path.join(out, "uploads");
      if ((await stat(src)).isDirectory()) {
        await mkdir(env.uploadDir, { recursive: true });
        await cp(src, env.uploadDir, { recursive: true, force: true });
        images = (tables.media ?? []).length;
      }
    } catch {
      /* backup had no images */
    }

    invalidateContent();
    return `Restored ${rowCount} records and ${images} images.`;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
