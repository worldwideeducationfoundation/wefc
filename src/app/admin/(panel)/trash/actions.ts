"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/server/activity";
import { TRASH_TYPES, trashType } from "@/server/admin/trash";
import { roleCan } from "@/server/auth/roles";
import { requireUser } from "@/server/auth/session";
import { invalidateContent } from "@/server/cache";
import { dbErrorCode, execute } from "@/server/db";

export async function restoreItem(type: string, id: number) {
  const user = await requireUser();
  const t = trashType(type);
  if (!t || !roleCan(user.role, t.restoreCap)) redirect("/admin/trash");
  try {
    await execute(`UPDATE ${t.table} SET deleted_at = NULL WHERE id = ?`, [id]);
  } catch (err) {
    // A restored item whose address was taken in the meantime.
    if (dbErrorCode(err) === "ER_DUP_ENTRY") redirect("/admin/trash?notice=Another+item+now+uses+its+address%3B+change+that+one+first.");
    throw err;
  }
  invalidateContent();
  await logActivity(user.id, "restore", t.key, `#${id}`);
  redirect("/admin/trash?notice=restored");
}

export async function purgeItem(type: string, id: number) {
  const user = await requireUser();
  const t = trashType(type);
  if (!t || !roleCan(user.role, t.purgeCap)) redirect("/admin/trash");
  await execute(`DELETE FROM ${t.table} WHERE id = ? AND deleted_at IS NOT NULL`, [id]);
  invalidateContent();
  await logActivity(user.id, "purge", t.key, `#${id}`);
  redirect("/admin/trash?notice=purged");
}

export async function emptyTrash() {
  const user = await requireUser();
  let n = 0;
  for (const t of TRASH_TYPES) {
    if (!roleCan(user.role, t.purgeCap)) continue;
    const res = await execute(`DELETE FROM ${t.table} WHERE deleted_at IS NOT NULL`);
    n += res.affectedRows;
  }
  invalidateContent();
  await logActivity(user.id, "empty_trash", "trash", `${n} items`);
  redirect("/admin/trash?notice=emptied");
}
