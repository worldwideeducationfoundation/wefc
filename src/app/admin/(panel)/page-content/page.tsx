import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PageHeader } from "@/components/admin/ui";
import { CORE_PAGES, type CorePageDef, corePageStates } from "@/server/blocks";
import { requireCapability } from "@/server/auth/session";
import { query } from "@/server/db";

export const metadata: Metadata = { title: "Page Content" };

export default async function PageContentIndex() {
  await requireCapability("content.view");
  const [states, edited] = await Promise.all([
    corePageStates(),
    query<{ page_key: string; n: number }>("SELECT page_key, COUNT(*) AS n FROM content_blocks GROUP BY page_key"),
  ]);
  const editedBy = Object.fromEntries(edited.map((e) => [e.page_key, Number(e.n)]));

  return (
    <>
      <PageHeader
        title="Page Content"
        description="The wording on the website's built-in pages. Lists like projects, team and posts have their own sections; to make a brand-new page, use Pages."
      />
      <div className="grid gap-3 md:grid-cols-2">
        {(Object.entries(CORE_PAGES) as [string, CorePageDef][]).map(([key, def]) => {
          const enabled = states[key]?.enabled ?? true;
          return (
            <Link
              key={key}
              href={`/admin/page-content/${key}`}
              className="flex flex-col gap-1.5 rounded-lg border border-sand-200 bg-white p-4 shadow-xs transition-colors hover:border-forest-900"
            >
              <span className="flex items-center justify-between gap-3">
                <span className="text-[16px] font-bold text-forest-900">{def.label}</span>
                {def.canDisable && !enabled ? <Badge value="disabled" label="Switched off" /> : def.path ? <Badge value="published" label="On" /> : null}
              </span>
              <span className="text-[13px] text-ink-muted">{def.description}</span>
              <span className="text-[12px] text-ink-muted">
                {def.path && <code className="mr-2">{def.path}</code>}
                {Object.keys(def.blocks).length} editable texts · {editedBy[key] ?? 0} changed
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
