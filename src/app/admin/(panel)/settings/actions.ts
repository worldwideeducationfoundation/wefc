"use server";

import { logActivity } from "@/server/activity";
import type { ActionResult } from "@/server/admin/guard";
import { roleCan } from "@/server/auth/roles";
import { requireUser } from "@/server/auth/session";
import { invalidateContent } from "@/server/cache";
import { execute, transaction } from "@/server/db";
import { SETTING_FIELDS } from "@/server/settings";

export async function saveSettings(_prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!roleCan(user.role, "settings.manage")) return { ok: false, message: "You do not have permission to do that." };

  const errors: Record<string, string> = {};
  const values: Record<string, string> = {};
  for (const f of SETTING_FIELDS) {
    const v = String(form.get(f.key) ?? "").trim().replace(/\r\n/g, "\n");
    values[f.key] = v;
    const type = "type" in f ? f.type : "text";
    if (v.length > 2000) errors[f.key] = "Too long.";
    else if (type === "email" && v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) errors[f.key] = "Enter a valid email address.";
    else if (type === "url" && v) {
      try {
        if (!["http:", "https:"].includes(new URL(v).protocol)) throw new Error();
      } catch {
        errors[f.key] = "Enter a full address starting with https://";
      }
    }
  }
  if (Object.keys(errors).length) return { ok: false, message: "Please fix the highlighted fields.", errors, values };

  await transaction(async (conn) => {
    for (const f of SETTING_FIELDS) {
      await execute(
        `INSERT INTO settings (setting_key, value, updated_by) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)`,
        [f.key, values[f.key] || null, user.id],
        conn,
      );
    }
  });
  invalidateContent();
  await logActivity(user.id, "update", "settings");
  return { ok: true, message: "Settings saved. The website shows them now.", values };
}
