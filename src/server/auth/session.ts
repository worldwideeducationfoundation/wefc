import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { logActivity } from "../activity";
import { execute, query, queryOne } from "../db";
import { clientIp, requestIsHttps, userAgent } from "../request";
import { dummyHash, hashPassword, needsRehash, verifyPassword } from "./password";
import { type Capability, type Role, roleCan } from "./roles";

export const SESSION_COOKIE = "wefc_admin";

/** Signed out after this long without a request… */
const IDLE_SECONDS = 2 * 60 * 60;
/** …and after this long regardless, so a forgotten tab cannot stay signed in. */
const ABSOLUTE_SECONDS = 12 * 60 * 60;

const MAX_ATTEMPTS_PER_EMAIL = 5;
const MAX_ATTEMPTS_PER_IP = 20;
const LOCKOUT_MINUTES = 15;

export type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

/**
 * The signed-in admin for this request, or null.
 *
 * Reads the account fresh from the database on every request, so disabling
 * someone or changing their role takes effect on their very next click —
 * not when their session happens to end. `cache` shares the answer between
 * the layout, the page and its components within one request.
 */
export const getCurrentUser = cache(async (): Promise<AdminUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token || token.length < 32) return null;

  const row = await queryOne<{
    session_id: string;
    last_seen_at: Date;
    expires_at: Date;
    id: number;
    name: string;
    email: string;
    role: Role;
    status: string;
  }>(
    `SELECT s.id AS session_id, s.last_seen_at, s.expires_at,
            u.id, u.name, u.email, u.role, u.status
       FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id
      WHERE s.id = ? LIMIT 1`,
    [sha256(token)],
  );
  if (!row) return null;

  const now = Date.now();
  const idleFor = (now - new Date(row.last_seen_at).getTime()) / 1000;
  if (row.status !== "active" || now > new Date(row.expires_at).getTime() || idleFor > IDLE_SECONDS) {
    await execute("DELETE FROM admin_sessions WHERE id = ?", [row.session_id]);
    return null;
  }

  // Sliding idle window, written at most once a minute rather than per request.
  if (idleFor > 60) {
    await execute("UPDATE admin_sessions SET last_seen_at = UTC_TIMESTAMP() WHERE id = ?", [row.session_id]);
  }

  return { id: row.id, name: row.name, email: row.email, role: row.role };
});

export async function can(capability: Capability): Promise<boolean> {
  const user = await getCurrentUser();
  return roleCan(user?.role, capability);
}

/** For admin pages: the signed-in user, or a redirect to the login page. */
export async function requireUser(): Promise<AdminUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/admin/login");
  return user;
}

/**
 * For pages and actions. Throws rather than redirecting when used inside an
 * action, so a request crafted without the UI gets a hard failure.
 */
export async function requireCapability(capability: Capability): Promise<AdminUser> {
  const user = await requireUser();
  if (!roleCan(user.role, capability)) {
    throw new ForbiddenError(capability);
  }
  return user;
}

export class ForbiddenError extends Error {
  constructor(capability: string) {
    super(`You do not have permission to do that (${capability}).`);
    this.name = "ForbiddenError";
  }
}

async function isRateLimited(email: string, ip: string) {
  const [byEmail, byIp] = await Promise.all([
    queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM login_attempts
        WHERE email = ? AND success = 0 AND created_at > UTC_TIMESTAMP() - INTERVAL ? MINUTE`,
      [email, LOCKOUT_MINUTES],
    ),
    queryOne<{ n: number }>(
      `SELECT COUNT(*) AS n FROM login_attempts
        WHERE ip_address = ? AND success = 0 AND created_at > UTC_TIMESTAMP() - INTERVAL ? MINUTE`,
      [ip, LOCKOUT_MINUTES],
    ),
  ]);
  return Number(byEmail?.n ?? 0) >= MAX_ATTEMPTS_PER_EMAIL || Number(byIp?.n ?? 0) >= MAX_ATTEMPTS_PER_IP;
}

/**
 * Checks the credentials and, if they are right, starts a session and sets
 * the cookie. Every failure returns the same message, so the form never
 * reveals whether an email has an account or which limit was hit.
 */
export async function signIn(emailRaw: string, password: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = emailRaw.trim().toLowerCase();
  const generic = "Incorrect email or password.";
  if (!email || !password) return { ok: false, error: generic };

  const ip = await clientIp();
  if (await isRateLimited(email, ip)) {
    return { ok: false, error: `Too many failed attempts. Try again in ${LOCKOUT_MINUTES} minutes.` };
  }

  const user = await queryOne<{
    id: number;
    name: string;
    email: string;
    role: Role;
    status: string;
    password_hash: string;
  }>("SELECT id, name, email, role, status, password_hash FROM admin_users WHERE email = ? LIMIT 1", [email]);

  const passwordOk = await verifyPassword(password, user?.password_hash ?? (await dummyHash()));

  if (!user || user.status !== "active" || !passwordOk) {
    await execute("INSERT INTO login_attempts (email, ip_address, success) VALUES (?, ?, 0)", [email, ip]);
    return { ok: false, error: generic };
  }

  await execute("INSERT INTO login_attempts (email, ip_address, success) VALUES (?, ?, 1)", [email, ip]);
  if (needsRehash(user.password_hash)) {
    await execute("UPDATE admin_users SET password_hash = ? WHERE id = ?", [await hashPassword(password), user.id]);
  }
  await execute("UPDATE admin_users SET last_login_at = UTC_TIMESTAMP() WHERE id = ?", [user.id]);

  await startSession(user.id);
  await logActivity(user.id, "login", "auth");
  return { ok: true };
}

export async function startSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  await execute(
    `INSERT INTO admin_sessions (id, user_id, ip_address, user_agent, expires_at)
     VALUES (?, ?, ?, ?, UTC_TIMESTAMP() + INTERVAL ? SECOND)`,
    [sha256(token), userId, await clientIp(), await userAgent(), ABSOLUTE_SECONDS],
  );
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: await requestIsHttps(),
    sameSite: "lax",
    path: "/",
    maxAge: ABSOLUTE_SECONDS,
  });
}

export async function signOut() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    const user = await getCurrentUser();
    await execute("DELETE FROM admin_sessions WHERE id = ?", [sha256(token)]);
    if (user) await logActivity(user.id, "logout", "auth");
  }
  jar.delete(SESSION_COOKIE);
}

/** Ends every other session of a user — after a password change, for one. */
export async function endOtherSessions(userId: number) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  await execute("DELETE FROM admin_sessions WHERE user_id = ? AND id <> ?", [userId, token ? sha256(token) : ""]);
}

export async function endAllSessions(userId: number) {
  await execute("DELETE FROM admin_sessions WHERE user_id = ?", [userId]);
}

/** Housekeeping, run opportunistically: expired sessions and old login attempts. */
export async function pruneAuthTables() {
  await execute("DELETE FROM admin_sessions WHERE expires_at < UTC_TIMESTAMP()");
  await execute("DELETE FROM login_attempts WHERE created_at < UTC_TIMESTAMP() - INTERVAL 30 DAY");
}

export async function adminCount(): Promise<number> {
  const rows = await query<{ n: number }>("SELECT COUNT(*) AS n FROM admin_users");
  return Number(rows[0]?.n ?? 0);
}
