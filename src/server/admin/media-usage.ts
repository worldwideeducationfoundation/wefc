import "server-only";
import { CORE_PAGES, type CorePageDef } from "../blocks";
import { query } from "../db";
import { RESOURCES } from "./resources";

export type Usage = { label: string; href: string };

/**
 * Everywhere a media item is used — so the library can say "used on 3
 * pages" and refuse to delete an image the site still shows.
 */
export async function mediaUsage(mediaId: number): Promise<Usage[]> {
  const out: Usage[] = [];
  // JSON documents store `"mediaId":123` (rich text) or numbers in arrays (galleries).
  const jsonLike = `%"mediaId":${mediaId}%`;

  for (const def of RESOURCES) {
    const conds: string[] = def.mediaColumns.map((c) => `${c} = ?`);
    const args: unknown[] = def.mediaColumns.map(() => mediaId);
    for (const c of def.richColumns ?? []) {
      conds.push(`${c} LIKE ?`);
      args.push(jsonLike);
    }
    if (conds.length === 0) continue;
    const rows = await query<{ id: number; t: string | null }>(
      `SELECT id, ${def.titleField} AS t FROM ${def.table} WHERE deleted_at IS NULL AND (${conds.join(" OR ")})`,
      args,
    );
    for (const r of rows) out.push({ label: `${def.label}: ${r.t ?? `#${r.id}`}`, href: `/admin/content/${def.key}/${r.id}` });
  }

  const pages = await query<{ id: number; title: string; sections: string | null }>(
    "SELECT id, title, sections FROM pages WHERE deleted_at IS NULL AND sections LIKE ?",
    [`%${mediaId}%`],
  );
  for (const p of pages) {
    // Confirm the number really is a media reference, not part of some text.
    const s = p.sections ?? "";
    if (s.includes(`"mediaId":${mediaId}`) || new RegExp(`"mediaIds":\\[[^\\]]*\\b${mediaId}\\b`).test(s)) {
      out.push({ label: `Page: ${p.title}`, href: `/admin/pages/${p.id}` });
    }
  }

  const blocks = await query<{ page_key: string }>("SELECT DISTINCT page_key FROM content_blocks WHERE value = ?", [String(mediaId)]);
  for (const b of blocks) {
    const def = (CORE_PAGES as Record<string, CorePageDef>)[b.page_key];
    if (def) out.push({ label: `Page content: ${def.label}`, href: `/admin/page-content/${b.page_key}` });
  }

  return out;
}
