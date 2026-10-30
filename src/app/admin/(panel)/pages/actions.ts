"use server";

import { redirect } from "next/navigation";
import { normalizeSections } from "@/lib/sections";
import { logActivity } from "@/server/activity";
import type { ActionResult } from "@/server/admin/guard";
import { roleCan } from "@/server/auth/roles";
import { requireCapability, requireUser } from "@/server/auth/session";
import { invalidateContent } from "@/server/cache";
import { execute, queryOne, transaction } from "@/server/db";

/**
 * Addresses a built page may not take, because a built-in route already
 * answers there (or below there, for routes with their own sub-pages).
 */
const RESERVED_FIRST = new Set(["admin", "api", "uploads", "_next", "blog", "pages", "projects", "updates", "stories", "topics", "brand", "media"]);
const RESERVED_EXACT = new Set(["mission", "team", "centers", "gallery", "contact", "donate", "sitemap.xml", "robots.txt", "og.png"]);
const PATH_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*){0,3}$/;

export async function savePage(id: number | null, _prev: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  if (!roleCan(user.role, id ? "content.edit" : "content.create")) {
    return { ok: false, message: "You do not have permission to do that." };
  }

  const values = {
    title: String(form.get("title") ?? "").trim(),
    slug: String(form.get("slug") ?? "").trim().toLowerCase().replace(/^\/+|\/+$/g, ""),
    eyebrow: String(form.get("eyebrow") ?? "").trim(),
    lede: String(form.get("lede") ?? "").trim(),
    seo_title: String(form.get("seo_title") ?? "").trim(),
    seo_description: String(form.get("seo_description") ?? "").trim(),
    noindex: form.get("noindex") === "on",
    status: form.get("status") === "published" ? "published" : "draft",
  };

  let sections: unknown = [];
  try {
    sections = JSON.parse(String(form.get("sections") ?? "[]"));
  } catch {
    return { ok: false, message: "The page's sections could not be read. Please try again." };
  }
  const clean = normalizeSections(sections);

  const errors: Record<string, string> = {};
  if (!values.title) errors.title = "Give the page a title.";
  else if (values.title.length > 200) errors.title = "Keep the title under 200 characters.";
  if (!values.slug) errors.slug = "Choose the page's web address.";
  else if (!PATH_PATTERN.test(values.slug)) errors.slug = "Use lowercase letters, numbers and dashes (and / for a sub-page).";
  else if (RESERVED_EXACT.has(values.slug) || RESERVED_FIRST.has(values.slug.split("/")[0])) {
    errors.slug = "That address belongs to a built-in part of the site. Choose another.";
  } else {
    const clash = await queryOne("SELECT id FROM pages WHERE slug = ? AND id <> ? LIMIT 1", [values.slug, id ?? 0]);
    if (clash) errors.slug = "Another page already uses this address.";
  }
  if (values.eyebrow.length > 120) errors.eyebrow = "Keep this under 120 characters.";
  if (values.lede.length > 1000) errors.lede = "Keep the introduction under 1,000 characters.";
  if (Object.keys(errors).length) {
    return { ok: false, message: "Please fix the highlighted fields.", errors, values: { ...values, sections: clean } };
  }

  const row = {
    title: values.title,
    slug: values.slug,
    eyebrow: values.eyebrow || null,
    lede: values.lede || null,
    sections: JSON.stringify(clean),
    seo_title: values.seo_title.slice(0, 200) || null,
    seo_description: values.seo_description.slice(0, 400) || null,
    noindex: values.noindex ? 1 : 0,
    status: values.status,
  };

  let savedId = id;
  await transaction(async (conn) => {
    if (id) {
      await execute("UPDATE pages SET ? WHERE id = ? AND deleted_at IS NULL", [row, id], conn);
    } else {
      const res = await execute("INSERT INTO pages SET ?", [row], conn);
      savedId = res.insertId;
      // Optionally put the new page straight into the main menu.
      if (form.get("add_to_menu") === "on" && roleCan(user.role, "settings.manage")) {
        const last = await queryOne<{ m: number | null }>(
          "SELECT MAX(display_order) AS m FROM nav_items WHERE menu = 'header' AND parent_id IS NULL",
          [],
          conn,
        );
        await execute(
          "INSERT INTO nav_items (menu, kind, label, href, display_order) VALUES ('header', 'link', ?, ?, ?)",
          [values.title.slice(0, 120), `/${values.slug}`, Number(last?.m ?? 0) + 10],
          conn,
        );
      }
    }
  });

  invalidateContent();
  await logActivity(user.id, id ? "update" : "create", "pages", values.title);
  if (!id) redirect(`/admin/pages/${savedId}?notice=created`);
  return {
    ok: true,
    message: values.status === "published" ? `Saved — live at /${values.slug}` : "Saved as a draft.",
    values: { ...values, sections: clean },
  };
}

export async function trashPage(id: number) {
  const user = await requireCapability("content.delete");
  const row = await queryOne<{ title: string }>("SELECT title FROM pages WHERE id = ?", [id]);
  await execute("UPDATE pages SET deleted_at = UTC_TIMESTAMP() WHERE id = ?", [id]);
  invalidateContent();
  await logActivity(user.id, "trash", "pages", row?.title ?? `#${id}`);
  redirect("/admin/pages?notice=trashed");
}
