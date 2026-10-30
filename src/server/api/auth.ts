import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { execute, queryOne } from "../db";
import type { AdminUser } from "../auth/session";
import type { Role } from "../auth/roles";

/**
 * Content API keys. A key is "wefc_" plus 40 random characters; only its
 * SHA-256 is stored, so the database never holds a usable key.
 */
const sha256 = (v: string) => createHash("sha256").update(v).digest("hex");

export function newToken() {
  const token = `wefc_${randomBytes(30).toString("base64url")}`;
  return { token, hash: sha256(token), hint: token.slice(0, 9) };
}

/** The admin a request's key belongs to, or null. Disabled admins' keys stop working. */
export async function userFromRequest(request: Request): Promise<AdminUser | null> {
  const header = request.headers.get("authorization") ?? "";
  const token = header.match(/^Bearer\s+(wefc_[A-Za-z0-9_-]{20,})$/)?.[1];
  if (!token) return null;

  const row = await queryOne<{ token_id: number; id: number; name: string; email: string; role: Role; status: string; last_used_at: Date | null }>(
    `SELECT t.id AS token_id, t.last_used_at, u.id, u.name, u.email, u.role, u.status
       FROM api_tokens t JOIN admin_users u ON u.id = t.user_id
      WHERE t.token_hash = ? AND t.revoked_at IS NULL LIMIT 1`,
    [sha256(token)],
  );
  if (!row || row.status !== "active") return null;

  if (!row.last_used_at || Date.now() - new Date(row.last_used_at).getTime() > 60_000) {
    await execute("UPDATE api_tokens SET last_used_at = UTC_TIMESTAMP() WHERE id = ?", [row.token_id]);
  }
  return { id: row.id, name: row.name, email: row.email, role: row.role };
}
