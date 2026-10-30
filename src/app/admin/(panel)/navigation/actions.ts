"use server";

import { logActivity } from "@/server/activity";
import type { ActionResult } from "@/server/admin/guard";
import { roleCan } from "@/server/auth/roles";
import { requireUser } from "@/server/auth/session";
import { invalidateContent } from "@/server/cache";
import { execute, transaction } from "@/server/db";

export type NavNode = { kind: "link" | "auto_projects" | "auto_categories"; label: string; href: string; children: NavNode[] };

const KINDS = new Set(["link", "auto_projects", "auto_categories"]);

function validHref(href: string) {
  if (href.startsWith("/") && !href.startsWith("//")) return true;
  if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return true;
  try {
    return ["http:", "https:"].includes(new URL(href).protocol);
  } catch {
    return false;
  }
}

/** Replaces one menu with the submitted tree, in a single transaction. */
export async function saveMenu(menu: "header" | "footer", _prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!roleCan(user.role, "settings.manage")) return { ok: false, message: "You do not have permission to do that." };
  if (menu !== "header" && menu !== "footer") return { ok: false, message: "Unknown menu." };

  let tree: NavNode[];
  try {
    tree = JSON.parse(String(form.get("tree") ?? "[]"));
    if (!Array.isArray(tree)) throw new Error();
  } catch {
    return { ok: false, message: "The menu could not be read. Please try again." };
  }

  const problems: string[] = [];
  const clean = (nodes: NavNode[], depth: number): NavNode[] =>
    nodes.slice(0, 40).map((n, i) => {
      const kind = KINDS.has(n.kind) ? n.kind : "link";
      const label = String(n.label ?? "").trim().slice(0, 120);
      const href = String(n.href ?? "").trim().slice(0, 500);
      if (kind === "link") {
        if (!label) problems.push(`Item ${i + 1} needs a label.`);
        // A footer heading (top level) needs no link; everything else does.
        const needsHref = !(menu === "footer" && depth === 0);
        if (needsHref && !href) problems.push(`“${label || `Item ${i + 1}`}” needs a link.`);
        if (href && !validHref(href)) problems.push(`“${label}” has an invalid link: use /a-page or a full https:// address.`);
      }
      return { kind, label: label || (kind === "auto_projects" ? "Every published project" : "Blog categories"), href, children: depth === 0 ? clean(n.children ?? [], 1) : [] };
    });
  const nodes = clean(tree, 0);
  if (problems.length) return { ok: false, message: problems.slice(0, 3).join(" ") };

  await transaction(async (conn) => {
    await execute("DELETE FROM nav_items WHERE menu = ?", [menu], conn);
    for (const [i, n] of nodes.entries()) {
      const res = await execute(
        "INSERT INTO nav_items (menu, kind, label, href, display_order) VALUES (?, ?, ?, ?, ?)",
        [menu, n.kind, n.label, n.href || null, (i + 1) * 10],
        conn,
      );
      for (const [j, c] of n.children.entries()) {
        await execute(
          "INSERT INTO nav_items (menu, parent_id, kind, label, href, display_order) VALUES (?, ?, ?, ?, ?, ?)",
          [menu, res.insertId, c.kind, c.label, c.href || null, (j + 1) * 10],
          conn,
        );
      }
    }
  });

  invalidateContent();
  await logActivity(user.id, "update", "navigation", `${menu} menu`);
  return { ok: true, message: `${menu === "header" ? "Main" : "Footer"} menu saved.` };
}
