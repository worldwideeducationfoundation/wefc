import "server-only";
import path from "node:path";

/**
 * Server configuration, read from the host's environment (Hostinger's
 * environment-variable panel, or .env.local when developing).
 *
 * Nothing secret is ever hardcoded or committed: the database password and
 * the setup key exist only on the server.
 */

function int(value: string | undefined, fallback: number) {
  const n = Number.parseInt(value ?? "", 10);
  return Number.isFinite(n) ? n : fallback;
}

/** DATABASE_URL wins when set; otherwise the five DB_* variables. */
function databaseConfig() {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const u = new URL(url);
    return {
      host: u.hostname,
      port: int(u.port, 3306),
      user: decodeURIComponent(u.username),
      password: decodeURIComponent(u.password),
      database: decodeURIComponent(u.pathname.replace(/^\//, "")),
    };
  }
  return {
    host: process.env.DB_HOST?.trim() || "127.0.0.1",
    port: int(process.env.DB_PORT, 3306),
    user: process.env.DB_USER?.trim() || "",
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME?.trim() || "",
  };
}

export const env = {
  db: databaseConfig(),

  /** True once the database has been configured at all. */
  get dbConfigured() {
    return Boolean(this.db.user && this.db.database);
  },

  /**
   * Where uploaded images are stored. On Hostinger this must be a folder
   * OUTSIDE the app's own directory, so a redeploy from GitHub can never
   * replace or delete it. Falls back to ./storage/uploads (gitignored) for
   * local development.
   */
  uploadDir: process.env.UPLOAD_DIR?.trim()
    ? path.resolve(process.env.UPLOAD_DIR.trim())
    : path.join(process.cwd(), "storage", "uploads"),
  uploadDirConfigured: Boolean(process.env.UPLOAD_DIR?.trim()),

  /** Required to create the first admin account on a fresh install. */
  setupKey: process.env.ADMIN_SETUP_KEY?.trim() || "",

  isProduction: process.env.NODE_ENV === "production",
} as const;
