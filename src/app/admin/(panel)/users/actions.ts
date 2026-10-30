"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/server/activity";
import type { ActionResult } from "@/server/admin/guard";
import { hashPassword, passwordPolicyError, verifyPassword } from "@/server/auth/password";
import { ROLES, type Role } from "@/server/auth/roles";
import { endAllSessions, endOtherSessions, requireCapability, requireUser } from "@/server/auth/session";
import { dbErrorCode, execute, queryOne } from "@/server/db";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function superAdminCount(excludingId: number) {
  const row = await queryOne<{ n: number }>(
    "SELECT COUNT(*) AS n FROM admin_users WHERE role = 'super_admin' AND status = 'active' AND id <> ?",
    [excludingId],
  );
  return Number(row?.n ?? 0);
}

export async function saveUser(id: number | null, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireCapability("users.manage");
  const isNew = id === null;
  const values = {
    name: String(form.get("name") ?? "").trim(),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
    role: String(form.get("role") ?? "editor") as Role,
    status: form.get("status") === "disabled" ? "disabled" : "active",
  };
  const password = String(form.get("password") ?? "");

  const errors: Record<string, string> = {};
  if (!values.name || values.name.length > 120) errors.name = "Enter a name (up to 120 characters).";
  if (!EMAIL.test(values.email) || values.email.length > 190) errors.email = "Enter a valid email address.";
  if (!ROLES.includes(values.role)) errors.role = "Choose a role.";
  if (!id || password) {
    const policy = passwordPolicyError(password, values.email, values.name);
    if (policy) errors.password = policy;
  }
  if (id === me.id && (values.status === "disabled" || values.role !== me.role)) {
    errors.role = "You cannot change your own role or disable yourself. Ask another Super Admin.";
  }
  if (id && (values.role !== "super_admin" || values.status === "disabled")) {
    const current = await queryOne<{ role: string }>("SELECT role FROM admin_users WHERE id = ?", [id]);
    if (current?.role === "super_admin" && (await superAdminCount(id)) === 0) {
      errors.role = "This is the only active Super Admin. Make someone else a Super Admin first.";
    }
  }
  if (Object.keys(errors).length) return { ok: false, message: "Please fix the highlighted fields.", errors, values };

  try {
    if (id) {
      await execute("UPDATE admin_users SET name = ?, email = ?, role = ?, status = ? WHERE id = ?", [
        values.name,
        values.email,
        values.role,
        values.status,
        id,
      ]);
      if (password) {
        await execute("UPDATE admin_users SET password_hash = ? WHERE id = ?", [await hashPassword(password), id]);
        await endAllSessions(id);
      }
      if (values.status === "disabled") await endAllSessions(id);
    } else {
      const res = await execute(
        "INSERT INTO admin_users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)",
        [values.name, values.email, await hashPassword(password), values.role, values.status],
      );
      id = res.insertId;
    }
  } catch (err) {
    if (dbErrorCode(err) === "ER_DUP_ENTRY") {
      return { ok: false, message: "Another account already uses that email.", errors: { email: "Already in use." }, values };
    }
    throw err;
  }

  await logActivity(me.id, isNew ? "create" : "update", "users", values.email);
  redirect(`/admin/users?notice=saved`);
}

export async function deleteUser(id: number) {
  const me = await requireCapability("users.manage");
  if (id === me.id) redirect("/admin/users?notice=You+cannot+delete+your+own+account.");
  const target = await queryOne<{ email: string; role: string }>("SELECT email, role FROM admin_users WHERE id = ?", [id]);
  if (target?.role === "super_admin" && (await superAdminCount(id)) === 0) {
    redirect("/admin/users?notice=You+cannot+delete+the+only+Super+Admin.");
  }
  await execute("DELETE FROM admin_users WHERE id = ?", [id]);
  await logActivity(me.id, "delete", "users", target?.email ?? `#${id}`);
  redirect("/admin/users?notice=deleted");
}

/** The signed-in person's own details and password. */
export async function saveAccount(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const values = {
    name: String(form.get("name") ?? "").trim(),
    email: String(form.get("email") ?? "").trim().toLowerCase(),
  };
  const current = String(form.get("current") ?? "");
  const next = String(form.get("password") ?? "");
  const confirm = String(form.get("confirm") ?? "");

  const errors: Record<string, string> = {};
  if (!values.name) errors.name = "Enter your name.";
  if (!EMAIL.test(values.email)) errors.email = "Enter a valid email address.";

  const row = await queryOne<{ password_hash: string; email: string }>("SELECT password_hash, email FROM admin_users WHERE id = ?", [me.id]);
  const changingSensitive = next || values.email !== row?.email;
  if (changingSensitive && !(row && (await verifyPassword(current, row.password_hash)))) {
    errors.current = "Enter your current password to change your email or password.";
  }
  if (next) {
    const policy = passwordPolicyError(next, values.email, values.name);
    if (policy) errors.password = policy;
    else if (next !== confirm) errors.confirm = "The two passwords do not match.";
  }
  if (Object.keys(errors).length) return { ok: false, message: "Please fix the highlighted fields.", errors, values };

  try {
    await execute("UPDATE admin_users SET name = ?, email = ? WHERE id = ?", [values.name, values.email, me.id]);
  } catch (err) {
    if (dbErrorCode(err) === "ER_DUP_ENTRY") return { ok: false, errors: { email: "Another account uses that email." }, values };
    throw err;
  }
  if (next) {
    await execute("UPDATE admin_users SET password_hash = ? WHERE id = ?", [await hashPassword(next), me.id]);
    await endOtherSessions(me.id);
    await logActivity(me.id, "password_change", "account");
    return { ok: true, message: "Password changed. Any other devices have been signed out.", values };
  }
  await logActivity(me.id, "update", "account");
  return { ok: true, message: "Your details are saved.", values };
}
