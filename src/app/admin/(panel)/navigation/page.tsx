import type { Metadata } from "next";
import { NavEditor } from "@/components/admin/NavEditor";
import { PageHeader } from "@/components/admin/ui";
import { requireCapability } from "@/server/auth/session";
import { CORE_PAGES, type CorePageDef } from "@/server/blocks";
import { query } from "@/server/db";
import { type NavNode, saveMenu } from "./actions";

export const metadata: Metadata = { title: "Navigation" };

type Row = { id: number; menu: string; parent_id: number | null; kind: NavNode["kind"]; label: string; href: string | null };

function treeOf(rows: Row[], menu: string): NavNode[] {
  const own = rows.filter((r) => r.menu === menu);
  return own
    .filter((r) => r.parent_id === null)
    .map((r) => ({
      kind: r.kind,
      label: r.label,
      href: r.href ?? "",
      children: own
        .filter((c) => c.parent_id === r.id)
        .map((c) => ({ kind: c.kind, label: c.label, href: c.href ?? "", children: [] })),
    }));
}

export default async function NavigationPage() {
  await requireCapability("settings.manage");
  const [rows, pages, programs, categories] = await Promise.all([
    query<Row>("SELECT id, menu, parent_id, kind, label, href FROM nav_items ORDER BY display_order, id"),
    query<{ title: string; slug: string }>("SELECT title, slug FROM pages WHERE deleted_at IS NULL ORDER BY title"),
    query<{ title: string; slug: string; section: string }>("SELECT COALESCE(card_title, title) AS title, slug, section FROM posts WHERE deleted_at IS NULL AND section = 'project' ORDER BY published_at DESC"),
    query<{ title: string; slug: string }>("SELECT title, slug FROM categories WHERE deleted_at IS NULL ORDER BY title"),
  ]);

  // Suggestions for the link boxes: every page the site has.
  const links = [
    ...(Object.values(CORE_PAGES) as CorePageDef[]).filter((p) => p.path).map((p) => ({ label: p.label, href: p.path! })),
    ...pages.map((p) => ({ label: p.title, href: `/${p.slug}` })),
    ...programs.map((p) => ({ label: p.title, href: `/projects/${p.slug}` })),
    ...categories.map((c) => ({ label: `Topic: ${c.title}`, href: `/topics/${c.slug}` })),
  ];

  return (
    <>
      <PageHeader
        title="Navigation"
        description="The menus at the top and bottom of every page. Start typing a link to pick from the site's pages. A page switched off under Page Content is left out of the menus automatically."
      />
      <div className="flex flex-col gap-6">
        <NavEditor menu="header" initial={treeOf(rows, "header")} links={links} action={saveMenu.bind(null, "header")} />
        <NavEditor menu="footer" initial={treeOf(rows, "footer")} links={links} action={saveMenu.bind(null, "footer")} />
      </div>
    </>
  );
}
