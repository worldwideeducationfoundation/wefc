import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState, PageHeader, btn, formatDateTime, inputClass } from "@/components/admin/ui";
import { requireCapability } from "@/server/auth/session";
import { query, queryOne } from "@/server/db";

export const metadata: Metadata = { title: "Activity Log" };

const PER_PAGE = 50;

export default async function ActivityPage({ searchParams }: PageProps<"/admin/activity">) {
  await requireCapability("activity.view");
  const sp = await searchParams;
  const section = typeof sp.module === "string" ? sp.module : "";
  const userId = typeof sp.user === "string" ? Number(sp.user) : 0;
  const page = Math.max(1, Number(sp.page) || 1);

  const where: string[] = [];
  const args: unknown[] = [];
  if (section) {
    where.push("l.module = ?");
    args.push(section);
  }
  if (userId) {
    where.push("l.user_id = ?");
    args.push(userId);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows, total, modules, users] = await Promise.all([
    query<{ id: number; action: string; module: string; details: string | null; ip_address: string | null; created_at: Date; name: string | null }>(
      `SELECT l.id, l.action, l.module, l.details, l.ip_address, l.created_at, u.name
         FROM activity_logs l LEFT JOIN admin_users u ON u.id = l.user_id ${w}
        ORDER BY l.created_at DESC, l.id DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`,
      args,
    ),
    queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM activity_logs l ${w}`, args),
    query<{ module: string }>("SELECT DISTINCT module FROM activity_logs ORDER BY module"),
    query<{ id: number; name: string }>("SELECT id, name FROM admin_users ORDER BY name"),
  ]);
  const pages = Math.ceil(Number(total?.n ?? 0) / PER_PAGE);
  const link = (p: number) => `?${new URLSearchParams({ ...(section ? { module: section } : {}), ...(userId ? { user: String(userId) } : {}), page: String(p) })}`;

  return (
    <>
      <PageHeader title="Activity Log" description="Who changed what, and when. Kept for a year." />
      <form className="mb-4 flex flex-wrap gap-2">
        <select name="module" defaultValue={section} className={`${inputClass} w-auto`} aria-label="Section">
          <option value="">All sections</option>
          {modules.map((m) => (
            <option key={m.module} value={m.module}>
              {m.module}
            </option>
          ))}
        </select>
        <select name="user" defaultValue={userId || ""} className={`${inputClass} w-auto`} aria-label="Person">
          <option value="">Everyone</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <button className={btn.secondary}>Filter</button>
      </form>
      {rows.length === 0 ? (
        <EmptyState title="Nothing recorded yet" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-sand-200 bg-white shadow-xs">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-sand-50 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              <tr>
                <th className="px-4 py-2.5">When</th>
                <th className="px-4 py-2.5">Who</th>
                <th className="px-4 py-2.5">What</th>
                <th className="px-4 py-2.5">Details</th>
                <th className="px-4 py-2.5">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-4 py-2 text-ink-muted">{formatDateTime(r.created_at)}</td>
                  <td className="px-4 py-2 font-semibold text-forest-900">{r.name ?? "—"}</td>
                  <td className="px-4 py-2">
                    {r.action.replace(/_/g, " ")} · <span className="text-ink-muted">{r.module}</span>
                  </td>
                  <td className="max-w-sm truncate px-4 py-2">{r.details}</td>
                  <td className="px-4 py-2 text-[12px] text-ink-muted">{r.ip_address}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="mt-4 flex items-center gap-2 text-[13px]">
          {page > 1 && (
            <Link className={btn.secondary} href={link(page - 1)}>
              ← Newer
            </Link>
          )}
          <span className="text-ink-muted">
            Page {page} of {pages}
          </span>
          {page < pages && (
            <Link className={btn.secondary} href={link(page + 1)}>
              Older →
            </Link>
          )}
        </div>
      )}
    </>
  );
}
