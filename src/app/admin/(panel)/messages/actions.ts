"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/server/activity";
import { requireCapability } from "@/server/auth/session";
import { execute } from "@/server/db";

const STATUSES = new Set(["new", "read", "replied", "archived"]);

export async function updateSubmission(id: number, form: FormData) {
  const user = await requireCapability("submissions.manage");
  const status = String(form.get("status") ?? "");
  const note = String(form.get("admin_note") ?? "").trim().slice(0, 1000);
  await execute(
    `UPDATE submissions SET status = ?, admin_note = ?, handled_by = ?, handled_at = UTC_TIMESTAMP() WHERE id = ?`,
    [STATUSES.has(status) ? status : "read", note || null, user.id, id],
  );
  await logActivity(user.id, "update", "messages", `#${id} → ${status}`);
  redirect(`/admin/messages/${id}?notice=saved`);
}

export async function trashSubmission(id: number) {
  const user = await requireCapability("submissions.manage");
  await execute("UPDATE submissions SET deleted_at = UTC_TIMESTAMP() WHERE id = ?", [id]);
  await logActivity(user.id, "trash", "messages", `#${id}`);
  redirect("/admin/messages?notice=trashed");
}
