import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState, PageHeader, btn, formatDate } from "@/components/admin/ui";
import { roleCan } from "@/server/auth/roles";
import { requireCapability } from "@/server/auth/session";
import { CORE_PAGES, type CorePageDef } from "@/server/blocks";
import { query } from "@/server/db";

export const metadata: Metadata = { title: "Pages" };

export default async function PagesIndex() {
  const user = await requireCapability("content.view");
  const pages = await query<{ id: number; title: string; slug: string; status: string; updated_at: Date }>(
    "SELECT id, title, slug, status, updated_at FROM pages WHERE deleted_at IS NULL ORDER BY title",
  );

  return (
    <>
      <PageHeader
        title="Pages"
        description="Make new pages for the website from ready-made sections — text, photos, figures, videos and more — in the site's own design."
        actions={
          roleCan(user.role, "content.create") && (
            <Link href="/admin/pages/new" className={btn.primary}>
              + New page
            </Link>
          )
        }
      />

      {pages.length === 0 ? (
        <EmptyState title="No pages built yet">
          Use “New page” to add one — for example a Volunteer, Donate or Annual Report page. Then add it to the menu
          under Navigation.
        </EmptyState>
      ) : (
        <div className="overflow-hidden rounded-lg border border-sand-200 bg-white shadow-xs">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-sand-50 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              <tr>
                <th className="px-4 py-2.5">Title</th>
                <th className="px-4 py-2.5">Address</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Updated</th>
                <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {pages.map((p) => (
                <tr key={p.id} className="hover:bg-sand-25">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/pages/${p.id}`} className="font-semibold text-forest-900 hover:underline">
                      {p.title}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">/{p.slug}</td>
                  <td className="px-4 py-2.5">
                    <Badge value={p.status} />
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{formatDate(p.updated_at)}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Link href={`/admin/pages/${p.id}`} className={btn.ghost}>
                      Edit
                    </Link>
                    <a href={`/${p.slug}`} target="_blank" rel="noopener" className={btn.ghost}>
                      {p.status === "published" ? "View ↗" : "Preview ↗"}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h2 className="mb-3 mt-10 text-[17px] font-bold text-forest-900">Built-in pages</h2>
      <p className="mb-3 text-[14px] text-ink-muted">
        These are part of the site&apos;s design. Their wording is edited under{" "}
        <Link href="/admin/page-content" className="font-semibold text-forest-900 underline">
          Page Content
        </Link>
        , and their lists (projects, posts, team…) in their own sections.
      </p>
      <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.entries(CORE_PAGES) as [string, CorePageDef][])
          .filter(([, d]) => d.path)
          .map(([key, d]) => (
            <li key={key}>
              <Link href={`/admin/page-content/${key}`} className="flex justify-between rounded-md border border-sand-200 bg-white px-3 py-2 text-[14px] hover:border-forest-900">
                <span className="font-semibold text-forest-900">{d.label}</span>
                <span className="text-ink-muted">{d.path}</span>
              </Link>
            </li>
          ))}
      </ul>
    </>
  );
}
