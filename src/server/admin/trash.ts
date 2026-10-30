import "server-only";
import type { Capability } from "../auth/roles";
import { query } from "../db";
import { RESOURCES } from "./resources";

/**
 * Everything that can sit in Trash. "Delete" anywhere in the admin only
 * stamps deleted_at, so an item can be restored exactly as it was; Trash is
 * where it is deleted for good. Each type keeps the permission of the
 * section it came from, so Trash is never a way around one.
 */
export type TrashType = {
  key: string;
  table: string;
  label: string;
  titleColumn: string;
  viewCap: Capability;
  restoreCap: Capability;
  purgeCap: Capability;
  editHref: (id: number) => string;
};

export const TRASH_TYPES: TrashType[] = [
  ...RESOURCES.map((r) => ({
    key: r.key,
    table: r.table,
    label: r.label,
    titleColumn: r.titleField,
    viewCap: "content.view" as const,
    restoreCap: "content.edit" as const,
    purgeCap: "content.delete" as const,
    editHref: (id: number) => `/admin/content/${r.key}/${id}`,
  })),
  {
    key: "pages",
    table: "pages",
    label: "Page",
    titleColumn: "title",
    viewCap: "content.view",
    restoreCap: "content.edit",
    purgeCap: "content.delete",
    editHref: (id) => `/admin/pages/${id}`,
  },
  {
    key: "messages",
    table: "submissions",
    label: "Message",
    titleColumn: "name",
    viewCap: "submissions.view",
    restoreCap: "submissions.manage",
    purgeCap: "submissions.manage",
    editHref: (id) => `/admin/messages/${id}`,
  },
];

export function trashType(key: string) {
  return TRASH_TYPES.find((t) => t.key === key) ?? null;
}

export type TrashItem = { type: string; label: string; id: number; title: string; deletedAt: Date };

export async function listTrash(types: TrashType[]): Promise<TrashItem[]> {
  if (types.length === 0) return [];
  const sql = types
    .map(
      (t) =>
        `SELECT '${t.key}' AS type, id, CAST(${t.titleColumn} AS CHAR(255)) AS title, deleted_at FROM ${t.table} WHERE deleted_at IS NOT NULL`,
    )
    .join(" UNION ALL ");
  const rows = await query<{ type: string; id: number; title: string | null; deleted_at: Date }>(
    `${sql} ORDER BY deleted_at DESC LIMIT 500`,
  );
  return rows.map((r) => ({
    type: r.type,
    label: trashType(r.type)?.label ?? r.type,
    id: r.id,
    title: r.title || `#${r.id}`,
    deletedAt: r.deleted_at,
  }));
}
