import "server-only";
import mysql, {
  type Pool,
  type PoolConnection,
  type ResultSetHeader,
  type RowDataPacket,
} from "mysql2/promise";
import { env } from "./env";
import { runMigrations } from "./migrate";

/**
 * The MySQL/MariaDB connection pool.
 *
 * Kept on globalThis so dev-server reloads (and separately bundled route
 * modules) share one pool instead of opening a new one per reload.
 *
 * Every connection runs in UTC: DATETIME columns are stored and read as UTC,
 * and the site formats dates for display itself.
 *
 * Queries use `?` placeholders through `pool.query`, which escapes values on
 * the client. That also expands arrays (`IN (?)`) and objects (`SET ?`),
 * which the admin's generic save path relies on. Never interpolate a value
 * into SQL; only identifiers from a fixed allow-list ever are.
 */
type Global = typeof globalThis & { __wefcPool?: Pool; __wefcSchema?: Promise<unknown> };
const g = globalThis as Global;

export class DatabaseNotConfiguredError extends Error {
  constructor() {
    super(
      "The database is not configured. Set DB_HOST, DB_USER, DB_PASSWORD and DB_NAME (or DATABASE_URL).",
    );
    this.name = "DatabaseNotConfiguredError";
  }
}

export function pool(): Pool {
  if (!env.dbConfigured) throw new DatabaseNotConfiguredError();
  if (!g.__wefcPool) {
    g.__wefcPool = mysql.createPool({
      ...env.db,
      charset: "utf8mb4_unicode_ci",
      timezone: "Z",
      connectionLimit: 8,
      maxIdle: 4,
      idleTimeout: 60_000,
      enableKeepAlive: true,
      dateStrings: false,
      supportBigNumbers: true,
    });
    g.__wefcPool.on("connection", (conn) => {
      conn.query("SET time_zone = '+00:00'");
    });
  }
  return g.__wefcPool;
}

/**
 * Makes sure the tables exist before this process first touches them.
 * Normally the startup hook has already done it and this is one quick check;
 * if the host started the app without running that hook, this is what
 * creates the tables. A failure is not cached, so the next request retries,
 * and its message says what went wrong.
 */
export class SchemaSetupError extends Error {
  constructor(cause: unknown) {
    super(`The database tables could not be created: ${cause instanceof Error ? cause.message : String(cause)}`);
    this.name = "SchemaSetupError";
  }
}

function schemaReady(): Promise<unknown> {
  g.__wefcSchema ??= runMigrations().catch((err) => {
    g.__wefcSchema = undefined;
    console.error("[db] Migrations failed:", err);
    throw new SchemaSetupError(err);
  });
  return g.__wefcSchema;
}

export type Row = RowDataPacket;
type Executor = Pick<Pool, "query"> | Pick<PoolConnection, "query">;

export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  conn?: Executor,
): Promise<T[]> {
  if (!conn) await schemaReady();
  const [rows] = await (conn ?? pool()).query<RowDataPacket[]>(sql, params);
  return rows as unknown as T[];
}

export async function queryOne<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = [],
  conn?: Executor,
): Promise<T | null> {
  const rows = await query<T>(sql, params, conn);
  return rows[0] ?? null;
}

export async function execute(
  sql: string,
  params: unknown[] = [],
  conn?: Executor,
): Promise<ResultSetHeader> {
  if (!conn) await schemaReady();
  const [result] = await (conn ?? pool()).query<ResultSetHeader>(sql, params);
  return result;
}

/** Runs `fn` in a transaction, committing on success and rolling back on any throw. */
export async function transaction<T>(fn: (conn: PoolConnection) => Promise<T>): Promise<T> {
  await schemaReady();
  const conn = await pool().getConnection();
  try {
    await conn.beginTransaction();
    const result = await fn(conn);
    await conn.commit();
    return result;
  } catch (err) {
    await conn.rollback().catch(() => {});
    throw err;
  } finally {
    conn.release();
  }
}

/** MySQL error code, when `err` is one. */
export function dbErrorCode(err: unknown): string | undefined {
  return typeof err === "object" && err && "code" in err
    ? String((err as { code: unknown }).code)
    : undefined;
}
