import { logActivity } from "@/server/activity";
import { api, ApiError, readJson } from "@/server/api/content";
import { CORE_PAGES, type CorePageDef, isCorePageKey } from "@/server/blocks";
import { invalidateContent } from "@/server/cache";
import { execute, query, transaction } from "@/server/db";

type Ctx = RouteContext<"/api/v1/page-content/[key]">;

const LIMITS = { text: 300, textarea: 2000, paragraphs: 20000, image: 20, toggle: 1, order: 500 } as const;

async function pageOr404(ctx: Ctx): Promise<[string, CorePageDef]> {
  const { key } = await ctx.params;
  if (!isCorePageKey(key)) throw new ApiError(404, `Unknown page "${key}". GET /api/v1 lists them.`);
  return [key, CORE_PAGES[key] as CorePageDef];
}

/** GET — every editable text on a built-in page, with its current value and default. */
export async function GET(request: Request, ctx: Ctx) {
  return api(request, "content.view", async () => {
    const [key, def] = await pageOr404(ctx);
    const rows = await query<{ block_key: string; value: string | null }>("SELECT block_key, value FROM content_blocks WHERE page_key = ?", [key]);
    const stored = Object.fromEntries(rows.map((r) => [r.block_key, r.value]));
    return {
      page: key,
      name: def.label,
      blocks: Object.fromEntries(
        Object.entries(def.blocks).map(([k, b]) => [k, { label: b.label, type: b.type, value: stored[k] ?? b.default, default: b.default }]),
      ),
    };
  });
}

/**
 * PATCH {"blocks": {"intro": "…", "show_partners": false}} — changes only the
 * texts sent. null (or the default) puts a text back to its original wording.
 */
export async function PATCH(request: Request, ctx: Ctx) {
  return api(request, "content.edit", async (user) => {
    const [key, def] = await pageOr404(ctx);
    const body = await readJson(request);
    const blocks = body.blocks;
    if (!blocks || typeof blocks !== "object") throw new ApiError(400, 'Send {"blocks": {"key": "text"}}.');

    const writes: [string, string | null][] = [];
    for (const [k, raw] of Object.entries(blocks as Record<string, unknown>)) {
      const b = def.blocks[k];
      if (!b) throw new ApiError(400, `"${k}" is not a text on ${def.label}.`, { blocks: Object.keys(def.blocks) });
      let v = raw === null ? null : b.type === "toggle" ? (raw === false || raw === "0" ? "0" : "1") : Array.isArray(raw) ? raw.join(",") : String(raw).trim();
      if (v !== null && [...v].length > LIMITS[b.type]) throw new ApiError(422, `"${k}" is too long (max ${LIMITS[b.type]}).`);
      if (v === b.default || v === "") v = null;
      writes.push([k, v]);
    }

    await transaction(async (conn) => {
      for (const [k, v] of writes) {
        if (v === null) await execute("DELETE FROM content_blocks WHERE page_key = ? AND block_key = ?", [key, k], conn);
        else
          await execute(
            `INSERT INTO content_blocks (page_key, block_key, value, updated_by) VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)`,
            [key, k, v, user.id],
            conn,
          );
      }
    });
    invalidateContent();
    await logActivity(user.id, "update", "page_content", `${def.label}: ${writes.map(([k]) => k).join(", ")} (API)`.slice(0, 250));
    return { updated: writes.map(([k]) => k) };
  });
}
