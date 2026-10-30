"use server";

import { logActivity } from "@/server/activity";
import type { ActionResult } from "@/server/admin/guard";
import { mediaUsage, type Usage } from "@/server/admin/media-usage";
import { roleCan } from "@/server/auth/roles";
import { requireUser } from "@/server/auth/session";
import { invalidateContent } from "@/server/cache";
import { execute, queryOne } from "@/server/db";
import { deleteStoredFile } from "@/server/media";

export async function getUsage(id: number): Promise<Usage[]> {
  const user = await requireUser();
  if (!roleCan(user.role, "media.view")) return [];
  return mediaUsage(id);
}

export async function updateMediaDetails(id: number, alt: string, caption: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!roleCan(user.role, "media.upload")) return { ok: false, message: "You do not have permission to do that." };
  await execute("UPDATE media SET alt = ?, caption = ? WHERE id = ?", [
    alt.trim().slice(0, 300),
    caption.trim().slice(0, 300) || null,
    id,
  ]);
  invalidateContent();
  await logActivity(user.id, "update", "media", alt.slice(0, 120));
  return { ok: true, message: "Description saved — every page using this image shows it." };
}

export async function deleteMedia(id: number, force: boolean): Promise<ActionResult & { usage?: Usage[] }> {
  const user = await requireUser();
  if (!roleCan(user.role, "media.delete")) return { ok: false, message: "You do not have permission to delete images." };
  const usage = await mediaUsage(id);
  if (usage.length && !force) {
    return { ok: false, message: "This image is still in use.", usage };
  }
  const row = await queryOne<{ path: string; original_name: string | null }>("SELECT path, original_name FROM media WHERE id = ?", [id]);
  if (!row) return { ok: true };
  // Foreign keys clear the columns that pointed at it; rich text simply skips a missing image.
  await execute("DELETE FROM media WHERE id = ?", [id]);
  await deleteStoredFile(row.path);
  invalidateContent();
  await logActivity(user.id, "delete", "media", row.original_name ?? row.path);
  return { ok: true, message: "Image deleted." };
}
