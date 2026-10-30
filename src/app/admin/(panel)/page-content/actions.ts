"use server";

import { logActivity } from "@/server/activity";
import type { ActionResult } from "@/server/admin/guard";
import { CORE_PAGES, type CorePageDef, isCorePageKey } from "@/server/blocks";
import { roleCan } from "@/server/auth/roles";
import { requireUser } from "@/server/auth/session";
import { invalidateContent } from "@/server/cache";
import { execute, transaction } from "@/server/db";
import { safeHref } from "@/lib/richtext";

const LIMITS = { text: 300, textarea: 2000, paragraphs: 20000, image: 20, toggle: 1, order: 500 } as const;

/**
 * Saves a built-in page's copy. A block left identical to its default (or
 * emptied) stores nothing, so it keeps following the original wording.
 */
export async function savePageContent(key: string, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!roleCan(user.role, "content.edit")) return { ok: false, message: "You do not have permission to do that." };
  if (!isCorePageKey(key)) return { ok: false, message: "Unknown page." };
  const def: CorePageDef = CORE_PAGES[key];

  const errors: Record<string, string> = {};
  const values: Record<string, string> = {};
  const writes: { block: string; value: string | null }[] = [];

  for (const [block, b] of Object.entries(def.blocks)) {
    let raw = String(form.get(`block_${block}`) ?? "").replace(/\r\n/g, "\n");
    // An unticked checkbox sends nothing; for a toggle that means "off".
    if (b.type === "toggle") raw = form.get(`block_${block}`) === "on" ? "1" : "0";
    if (b.type === "order") {
      const known = (b.options ?? []).map((o) => o.value);
      raw = raw
        .split(",")
        .filter((k) => known.includes(k))
        .join(",");
    }
    const value = raw.trim();
    values[block] = raw;
    if (block.endsWith("_href") && value && !safeHref(value)) {
      errors[block] = "Use a page on this site (starting with /) or a full https:// address.";
      continue;
    }
    if (b.type === "image" && value && !/^\d+$/.test(value)) {
      errors[block] = "Choose an image from the library.";
      continue;
    }
    if ([...value].length > LIMITS[b.type]) {
      errors[block] = `Keep this under ${LIMITS[b.type]} characters.`;
      continue;
    }
    writes.push({ block, value: value === "" || value === b.default ? null : value });
  }
  if (Object.keys(errors).length) return { ok: false, message: "Please fix the highlighted fields.", errors, values };

  const enabled = def.canDisable ? form.get("is_enabled") === "on" : true;
  const seoTitle = String(form.get("seo_title") ?? "").trim().slice(0, 200) || null;
  const seoDescription = String(form.get("seo_description") ?? "").trim().slice(0, 400) || null;

  await transaction(async (conn) => {
    for (const w of writes) {
      if (w.value === null) {
        await execute("DELETE FROM content_blocks WHERE page_key = ? AND block_key = ?", [key, w.block], conn);
      } else {
        await execute(
          `INSERT INTO content_blocks (page_key, block_key, value, updated_by) VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE value = VALUES(value), updated_by = VALUES(updated_by)`,
          [key, w.block, w.value, user.id],
          conn,
        );
      }
    }
    if (def.path) {
      await execute(
        `INSERT INTO core_pages (page_key, is_enabled, seo_title, seo_description, updated_by) VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE is_enabled = VALUES(is_enabled), seo_title = VALUES(seo_title),
                                 seo_description = VALUES(seo_description), updated_by = VALUES(updated_by)`,
        [key, enabled ? 1 : 0, seoTitle, seoDescription, user.id],
        conn,
      );
    }
  });

  invalidateContent();
  await logActivity(user.id, "update", "page_content", def.label);
  return { ok: true, message: enabled ? "Saved. The page shows the new wording now." : "Saved. This page is switched off.", values };
}
