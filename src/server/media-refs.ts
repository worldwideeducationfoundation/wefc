import "server-only";
import type { MediaRef } from "@/lib/types";
import { cached } from "./cache";
import { query } from "./db";
import { mediaUrl } from "./media";

type Row = { id: number; path: string; width: number | null; height: number | null; alt: string };

export function rowToRef(row: Pick<Row, "path" | "width" | "height" | "alt">): MediaRef {
  return {
    src: mediaUrl(row.path),
    alt: row.alt ?? "",
    width: row.width ?? 1600,
    height: row.height ?? 1200,
  };
}

/** Media items by id, as the MediaRef shape components render. */
export async function getMediaRefs(ids: Iterable<number>): Promise<Record<number, MediaRef>> {
  const unique = [...new Set([...ids].filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b);
  if (unique.length === 0) return {};
  return cached(`media:${unique.join(",")}`, async () => {
    const rows = await query<Row>("SELECT id, path, width, height, alt FROM media WHERE id IN (?)", [unique]);
    return Object.fromEntries(rows.map((r) => [r.id, rowToRef(r)]));
  });
}
