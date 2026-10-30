"use server";

import { redirect } from "next/navigation";
import { logActivity } from "@/server/activity";
import type { ActionResult } from "@/server/admin/guard";
import { getResource, type ResourceDef } from "@/server/admin/resources";
import { saveRecord } from "@/server/admin/save";
import { roleCan } from "@/server/auth/roles";
import { requireCapability, requireUser } from "@/server/auth/session";
import { invalidateContent } from "@/server/cache";
import { execute, queryOne, transaction } from "@/server/db";

/**
 * The shared save / trash / reorder / bulk actions behind every content type
 * in src/server/admin/resources.ts.
 */

function resourceOrThrow(key: string): ResourceDef {
  const def = getResource(key);
  if (!def) throw new Error("Unknown content type.");
  return def;
}

const titleOf = (def: ResourceDef, data: Record<string, unknown>) => String(data[def.titleField] ?? "").slice(0, 120);

export async function saveResource(key: string, id: number | null, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  const def = resourceOrThrow(key);
  const user = await requireUser();
  if (!roleCan(user.role, id ? "content.edit" : "content.create")) {
    return { ok: false, message: "You do not have permission to do that." };
  }

  const result = await saveRecord(def, id, form, user.id);
  if (!result.ok) return { ok: false, message: result.message, errors: result.errors, values: result.values };
  if (!id) redirect(`/admin/content/${def.key}/${result.id}?notice=created`);
  // The submitted values come back so the form shows what was saved
  // (React resets a form to its defaults after its action completes).
  return {
    ok: true,
    message: result.status === "published" ? "Saved and live on the site." : "Saved as a draft.",
    values: result.values,
  };
}

export async function trashResource(key: string, id: number) {
  const def = resourceOrThrow(key);
  const user = await requireCapability("content.delete");
  const row = await queryOne<Record<string, unknown>>(`SELECT ${def.titleField} AS t FROM ${def.table} WHERE id = ?`, [id]);
  await execute(`UPDATE ${def.table} SET deleted_at = UTC_TIMESTAMP() WHERE id = ? AND deleted_at IS NULL`, [id]);
  invalidateContent();
  await logActivity(user.id, "trash", def.key, String(row?.t ?? `#${id}`));
  redirect(`/admin/content/${def.key}?notice=trashed`);
}

export async function duplicateResource(key: string, id: number) {
  const def = resourceOrThrow(key);
  const user = await requireCapability("content.create");
  const row = await queryOne<Record<string, unknown>>(`SELECT * FROM ${def.table} WHERE id = ? AND deleted_at IS NULL`, [id]);
  if (!row) redirect(`/admin/content/${def.key}`);

  const copy: Record<string, unknown> = {};
  for (const f of def.fields) {
    if (f.type === "relation") continue;
    copy[f.name] = row[f.name];
  }
  for (const f of def.fields) {
    if (f.type === "slug") copy[f.name] = `${row[f.name]}-copy-${Date.now().toString(36).slice(-4)}`;
  }
  copy[def.titleField] = `${row[def.titleField] ?? ""} (copy)`.slice(0, 250);
  copy.status = "draft";
  if (def.defaultSort === "order") copy.display_order = Number(row.display_order ?? 0) + 1;

  const res = await execute(`INSERT INTO ${def.table} SET ?`, [copy]);
  for (const f of def.fields) {
    if (f.type !== "relation") continue;
    await execute(
      `INSERT INTO ${f.join.table} (${f.join.ownKey}, ${f.join.otherKey}, position)
       SELECT ?, ${f.join.otherKey}, position FROM ${f.join.table} WHERE ${f.join.ownKey} = ?`,
      [res.insertId, id],
    );
  }
  invalidateContent();
  await logActivity(user.id, "duplicate", def.key, titleOf(def, copy));
  redirect(`/admin/content/${def.key}/${res.insertId}?notice=duplicated`);
}

export async function reorderResource(key: string, orderedIds: number[]): Promise<ActionResult> {
  const def = resourceOrThrow(key);
  const user = await requireUser();
  if (!roleCan(user.role, "content.edit")) return { ok: false, message: "You do not have permission to do that." };
  const ids = orderedIds.filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);
  await transaction(async (conn) => {
    for (const [i, rid] of ids.entries()) {
      await execute(`UPDATE ${def.table} SET display_order = ? WHERE id = ?`, [(i + 1) * 10, rid], conn);
    }
  });
  invalidateContent();
  await logActivity(user.id, "reorder", def.key, `${ids.length} items`);
  return { ok: true, message: "New order saved." };
}

export async function bulkResource(key: string, action: string, ids: number[]): Promise<ActionResult> {
  const def = resourceOrThrow(key);
  const user = await requireUser();
  const clean = ids.filter((n) => Number.isInteger(n) && n > 0).slice(0, 500);
  if (clean.length === 0) return { ok: false, message: "Select at least one item." };

  if (action === "publish" || action === "draft") {
    if (!roleCan(user.role, "content.edit")) return { ok: false, message: "You do not have permission to do that." };
    await execute(`UPDATE ${def.table} SET status = ? WHERE id IN (?) AND deleted_at IS NULL`, [
      action === "publish" ? "published" : "draft",
      clean,
    ]);
  } else if (action === "trash") {
    if (!roleCan(user.role, "content.delete")) return { ok: false, message: "You do not have permission to do that." };
    await execute(`UPDATE ${def.table} SET deleted_at = UTC_TIMESTAMP() WHERE id IN (?) AND deleted_at IS NULL`, [clean]);
  } else {
    return { ok: false, message: "Unknown action." };
  }

  invalidateContent();
  await logActivity(user.id, `bulk_${action}`, def.key, `${clean.length} items`);
  const verb = action === "publish" ? "published" : action === "draft" ? "switched to draft" : "moved to Trash";
  return { ok: true, message: `${clean.length} ${clean.length === 1 ? "item" : "items"} ${verb}.` };
}
