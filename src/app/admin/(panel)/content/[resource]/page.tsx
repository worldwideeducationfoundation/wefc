import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResourceTable, type TableRow } from "@/components/admin/ResourceTable";
import { EmptyState, PageHeader, btn, formatDate, inputClass } from "@/components/admin/ui";
import { PER_PAGE, listResource, loadOptions, statusCounts } from "@/server/admin/data";
import { getResource } from "@/server/admin/resources";
import { roleCan } from "@/server/auth/roles";
import { requireCapability } from "@/server/auth/session";

export async function generateMetadata({ params }: PageProps<"/admin/content/[resource]">): Promise<Metadata> {
  const def = getResource((await params).resource);
  return { title: def?.plural ?? "Content" };
}

/** The list screen shared by every content type. */
export default async function ResourceListPage({ params, searchParams }: PageProps<"/admin/content/[resource]">) {
  const def = getResource((await params).resource);
  if (!def) notFound();
  const user = await requireCapability("content.view");
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  const filters: Record<string, string> = {};
  for (const f of def.filters ?? []) if (str(f.field)) filters[f.field] = str(f.field);
  const q = str("q").trim();
  const status = (["draft", "published"].includes(str("status")) ? str("status") : "") as "" | "draft" | "published";
  const page = Math.max(1, Number(str("page")) || 1);

  const [{ rows, total }, counts, options] = await Promise.all([
    listResource(def, { q, status, filters, page }),
    statusCounts(def.table),
    loadOptions((def.filters ?? []).flatMap((f) => (f.optionsFrom ? [f.optionsFrom] : []))),
  ]);

  const filtered = Boolean(q || status || Object.keys(filters).length);
  const canReorder = def.defaultSort === "order" && !filtered && total <= PER_PAGE && roleCan(user.role, "content.edit");

  const tableRows: TableRow[] = rows.map((r) => ({
    id: r.id,
    title: String(r[def.titleField] ?? ""),
    status: r.status,
    thumb: r.thumb_url ?? null,
    publicHref: def.publicPath?.(r) ?? null,
    cells: def.columns.map((c) => {
      const v = r[c.field];
      return {
        kind: c.kind,
        value: c.kind === "date" ? formatDate(v as Date) : v === null || v === undefined ? "" : String(v).replace(/,/g, ", "),
      };
    }),
  }));

  const pages = Math.ceil(total / PER_PAGE);
  const link = (overrides: Record<string, string>) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (status) p.set("status", status);
    for (const [k, v] of Object.entries(filters)) p.set(k, v);
    for (const [k, v] of Object.entries(overrides)) {
      if (v) p.set(k, v);
      else p.delete(k);
    }
    return `?${p}`;
  };

  return (
    <>
      <PageHeader
        title={def.plural}
        description={def.description}
        actions={
          roleCan(user.role, "content.create") && (
            <Link href={`/admin/content/${def.key}/new`} className={btn.primary}>
              + New {def.label.toLowerCase()}
            </Link>
          )
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav aria-label="Status" className="flex gap-1 rounded-md bg-sand-100 p-1 text-[13px] font-semibold">
          {[
            ["", `All (${counts.draft + counts.published})`],
            ["published", `Published (${counts.published})`],
            ["draft", `Drafts (${counts.draft})`],
          ].map(([value, label]) => (
            <Link
              key={value}
              href={link({ status: value, page: "" })}
              aria-current={status === value ? "page" : undefined}
              className={`rounded px-3 py-1.5 ${status === value ? "bg-white text-forest-900 shadow-sm" : "text-ink-muted hover:text-forest-900"}`}
            >
              {label}
            </Link>
          ))}
        </nav>

        <form className="flex flex-1 flex-wrap items-center gap-2" role="search">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder={`Search ${def.plural.toLowerCase()}…`} className={`${inputClass} max-w-xs`} />
          {(def.filters ?? []).map((f) => {
            const opts = f.options ?? (f.optionsFrom ? options[f.optionsFrom] : []) ?? [];
            return (
              <select key={f.field} name={f.field} defaultValue={filters[f.field] ?? ""} className={`${inputClass} w-auto`} aria-label={f.label}>
                <option value="">All {f.label.toLowerCase()}s</option>
                {f.optionsFrom && <option value="none">No {f.label.toLowerCase()}</option>}
                {opts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            );
          })}
          <button type="submit" className={btn.secondary}>
            Filter
          </button>
          {filtered && (
            <Link href={`/admin/content/${def.key}`} className={btn.ghost}>
              Clear
            </Link>
          )}
        </form>
      </div>

      {tableRows.length === 0 ? (
        <EmptyState title={filtered ? "Nothing matches" : `No ${def.plural.toLowerCase()} yet`}>
          {filtered ? "Try a different search or filter." : `Add the first ${def.label.toLowerCase()} with the button above.`}
        </EmptyState>
      ) : (
        <ResourceTable
          resourceKey={def.key}
          rows={tableRows}
          columns={def.columns.map((c) => c.label)}
          hasThumb={Boolean(def.thumbField)}
          canReorder={canReorder}
          canEdit={roleCan(user.role, "content.edit")}
          canDelete={roleCan(user.role, "content.delete")}
        />
      )}

      <div className="mt-4 flex items-center justify-between text-[13px] text-ink-muted">
        <p>
          {total} {total === 1 ? def.label.toLowerCase() : def.plural.toLowerCase()}
          {def.defaultSort === "order" && !canReorder && total > 1 && " · Clear the search and filters to drag items into a new order."}
          {canReorder && total > 1 && " · Drag rows (or use the arrows) to change the order on the site."}
        </p>
        {pages > 1 && (
          <div className="flex gap-2">
            {page > 1 && (
              <Link className={btn.secondary} href={link({ page: String(page - 1) })}>
                ← Previous
              </Link>
            )}
            <span className="self-center">
              Page {page} of {pages}
            </span>
            {page < pages && (
              <Link className={btn.secondary} href={link({ page: String(page + 1) })}>
                Next →
              </Link>
            )}
          </div>
        )}
      </div>
    </>
  );
}
