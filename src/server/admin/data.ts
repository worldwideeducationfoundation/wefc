import "server-only";
import type { FieldOptions, OptionSource } from "@/lib/admin-fields";
import { query, queryOne } from "../db";
import { mediaUrl } from "../media";
import { LIST_JOINS, POST_SECTIONS, type ResourceDef } from "./resources";

export const PER_PAGE = 50;

/** Options for select and relation fields, loaded fresh for each form. */
export async function loadOptions(sources: Iterable<OptionSource>): Promise<FieldOptions> {
  const out: FieldOptions = {};
  for (const source of new Set(sources)) {
    switch (source) {
      case "programs":
        out.programs = (
          await query<{ id: number; title: string }>(
            "SELECT id, title FROM programs WHERE deleted_at IS NULL AND placement = 'mission' AND parent_id IS NULL ORDER BY display_order, id",
          )
        ).map((r) => ({ value: String(r.id), label: r.title }));
        break;
      case "team_groups":
        out.team_groups = (
          await query<{ id: number; heading: string }>(
            "SELECT id, heading FROM team_groups WHERE deleted_at IS NULL ORDER BY display_order, id",
          )
        ).map((r) => ({ value: String(r.id), label: r.heading }));
        break;
      case "gallery_categories":
        out.gallery_categories = (
          await query<{ id: number; label: string }>(
            "SELECT id, label FROM gallery_categories WHERE deleted_at IS NULL ORDER BY display_order, id",
          )
        ).map((r) => ({ value: String(r.id), label: r.label }));
        break;
      case "authors":
        out.authors = (
          await query<{ id: number; name: string }>("SELECT id, name FROM authors WHERE deleted_at IS NULL ORDER BY name")
        ).map((r) => ({ value: String(r.id), label: r.name }));
        break;
      case "posts":
        out.posts = (
          await query<{ id: number; title: string; section: string }>(
            "SELECT id, title, section FROM posts WHERE deleted_at IS NULL ORDER BY published_at DESC",
          )
        ).map((r) => ({ value: String(r.id), label: `${POST_SECTIONS.find((p) => p.value === r.section)?.label ?? r.section}: ${r.title}` }));
        break;
      case "categories":
        out.categories = (
          await query<{ id: number; title: string }>(
            "SELECT id, title FROM categories WHERE deleted_at IS NULL ORDER BY display_order, title",
          )
        ).map((r) => ({ value: String(r.id), label: r.title }));
        break;
    }
  }
  return out;
}

export function optionSourcesOf(def: ResourceDef): OptionSource[] {
  const sources: OptionSource[] = [];
  for (const f of def.fields) {
    if ((f.type === "select" || f.type === "relation") && "optionsFrom" in f && f.optionsFrom) sources.push(f.optionsFrom);
  }
  for (const f of def.filters ?? []) if (f.optionsFrom) sources.push(f.optionsFrom);
  return sources;
}

export type ListParams = {
  q: string;
  status: "" | "draft" | "published";
  filters: Record<string, string>;
  page: number;
};

export type ListRow = Record<string, unknown> & {
  id: number;
  status: "draft" | "published";
  display_order: number;
  updated_at: Date;
  thumb_url?: string | null;
};

export async function listResource(def: ResourceDef, params: ListParams) {
  const where = ["t.deleted_at IS NULL"];
  const args: unknown[] = [];

  if (params.q) {
    const like = `%${params.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push(`(${def.searchFields.map((f) => `t.${f} LIKE ?`).join(" OR ")})`);
    def.searchFields.forEach(() => args.push(like));
  }
  if (params.status) {
    where.push("t.status = ?");
    args.push(params.status);
  }
  for (const f of def.filters ?? []) {
    const v = params.filters[f.field];
    if (v === "none") where.push(`t.${f.field} IS NULL`);
    else if (v) {
      where.push(`t.${f.field} = ?`);
      args.push(v);
    }
  }

  const extra = LIST_JOINS[def.table];
  const thumb = def.thumbField
    ? { select: "tm.path AS thumb_path", join: `LEFT JOIN media tm ON tm.id = t.${def.thumbField}` }
    : null;

  const order =
    def.defaultSort === "order"
      ? `t.display_order ASC, t.${def.titleField} ASC, t.id ASC`
      : `t.${def.defaultSort.column} ${def.defaultSort.dir === "desc" ? "DESC" : "ASC"}, t.id DESC`;

  const whereSql = `WHERE ${where.join(" AND ")}`;
  const [countRow, rows] = await Promise.all([
    queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM ${def.table} t ${whereSql}`, args),
    query<ListRow & { thumb_path?: string | null }>(
      `SELECT t.*${extra ? `, ${extra.select}` : ""}${thumb ? `, ${thumb.select}` : ""}
         FROM ${def.table} t ${extra?.join ?? ""} ${thumb?.join ?? ""}
         ${whereSql} ORDER BY ${order}
         LIMIT ${PER_PAGE} OFFSET ${(Math.max(1, params.page) - 1) * PER_PAGE}`,
      args,
    ),
  ]);

  return {
    total: Number(countRow?.n ?? 0),
    rows: rows.map((r): ListRow => ({ ...r, thumb_url: r.thumb_path ? mediaUrl(r.thumb_path) : null })),
  };
}

export async function getResourceRow(def: ResourceDef, id: number): Promise<Record<string, unknown> | null> {
  const row = await queryOne<Record<string, unknown>>(
    `SELECT * FROM ${def.table} WHERE id = ? AND deleted_at IS NULL LIMIT 1`,
    [id],
  );
  if (!row) return null;
  for (const f of def.fields) {
    if (f.type === "relation") {
      const rel = await query<{ other: number }>(
        `SELECT ${f.join.otherKey} AS other FROM ${f.join.table} WHERE ${f.join.ownKey} = ? ORDER BY position`,
        [id],
      );
      row[f.name] = rel.map((r) => String(r.other));
    }
  }
  return row;
}

/** Thumbnails for the media fields on a form. */
export async function mediaPreviews(ids: Iterable<unknown>): Promise<Record<string, { url: string; alt: string }>> {
  const list = [...new Set([...ids].map(Number).filter((n) => Number.isInteger(n) && n > 0))];
  if (list.length === 0) return {};
  const rows = await query<{ id: number; path: string; alt: string }>("SELECT id, path, alt FROM media WHERE id IN (?)", [list]);
  return Object.fromEntries(rows.map((r) => [String(r.id), { url: mediaUrl(r.path), alt: r.alt }]));
}

export async function statusCounts(table: string) {
  const rows = await query<{ status: string; n: number }>(
    `SELECT status, COUNT(*) AS n FROM ${table} WHERE deleted_at IS NULL GROUP BY status`,
  );
  const out = { draft: 0, published: 0 };
  for (const r of rows) out[r.status as "draft" | "published"] = Number(r.n);
  return out;
}
