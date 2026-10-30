"use server";

import { timingSafeEqual } from "node:crypto";
import { redirect } from "next/navigation";
import { logActivity } from "@/server/activity";
import { hashPassword, passwordPolicyError } from "@/server/auth/password";
import { adminCount, pruneAuthTables, signIn, signOut, startSession } from "@/server/auth/session";
import { execute } from "@/server/db";
import { env } from "@/server/env";

export type FormState = { error?: string; errors?: Record<string, string>; values?: Record<string, string> };

/** Only same-site admin paths may be returned to after signing in. */
function safeNext(value: FormDataEntryValue | null) {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/admin") && !next.startsWith("//") ? next : "/admin";
}

export async function loginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "");
  const result = await signIn(email, String(form.get("password") ?? ""));
  if (!result.ok) return { error: result.error, values: { email } };
  // Housekeeping on a quiet path: at most once per successful sign-in.
  await pruneAuthTables().catch(() => {});
  redirect(safeNext(form.get("next")));
}

export async function logoutAction() {
  await signOut();
  redirect("/admin/login?signedOut=1");
}

function keysMatch(given: string, expected: string) {
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Creates the very first admin account. Only possible while no account
 * exists, and only with the ADMIN_SETUP_KEY set on the server — so nobody who
 * finds a fresh install before you do can claim it.
 */
export async function setupAction(_prev: FormState, form: FormData): Promise<FormState> {
  if ((await adminCount()) > 0) redirect("/admin/login");

  const values = {
    name: String(form.get("name") ?? "").trim(),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
  };
  if (!env.setupKey) {
    return { error: "Set ADMIN_SETUP_KEY in the server's environment variables first, then reload this page.", values };
  }
  if (!keysMatch(String(form.get("setupKey") ?? ""), env.setupKey)) {
    return { errors: { setupKey: "That setup key does not match ADMIN_SETUP_KEY." }, values };
  }

  const errors: Record<string, string> = {};
  if (!values.name) errors.name = "Enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) errors.email = "Enter a valid email address.";
  const password = String(form.get("password") ?? "");
  const policy = passwordPolicyError(password, values.email, values.name);
  if (policy) errors.password = policy;
  else if (password !== String(form.get("confirm") ?? "")) errors.confirm = "The two passwords do not match.";
  if (Object.keys(errors).length) return { errors, values };

  const res = await execute(
    "INSERT INTO admin_users (name, email, password_hash, role, status) VALUES (?, ?, ?, 'super_admin', 'active')",
    [values.name, values.email, await hashPassword(password)],
  );
  await startSession(res.insertId);
  await logActivity(res.insertId, "create", "users", `First admin: ${values.email}`);
  redirect("/admin?notice=welcome");
}
