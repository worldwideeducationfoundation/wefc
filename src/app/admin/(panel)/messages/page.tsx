import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState, PageHeader, btn, inputClass, timeAgo } from "@/components/admin/ui";
import { requireCapability } from "@/server/auth/session";
import { query } from "@/server/db";

export const metadata: Metadata = { title: "Messages" };

const TABS = [
  ["", "All"],
  ["new", "New"],
  ["read", "Read"],
  ["replied", "Replied"],
  ["archived", "Archived"],
] as const;

export default async function MessagesPage({ searchParams }: PageProps<"/admin/messages">) {
  await requireCapability("submissions.view");
  const sp = await searchParams;
  const status = typeof sp.status === "string" && TABS.some(([k]) => k === sp.status) ? sp.status : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";

  const where = ["deleted_at IS NULL"];
  const args: unknown[] = [];
  if (status) {
    where.push("status = ?");
    args.push(status);
  }
  if (q) {
    const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    where.push("(name LIKE ? OR email LIKE ? OR subject LIKE ? OR message LIKE ?)");
    args.push(like, like, like, like);
  }

  const [rows, counts] = await Promise.all([
    query<{ id: number; name: string; email: string; subject: string | null; message: string; status: string; created_at: Date }>(
      `SELECT id, name, email, subject, message, status, created_at FROM submissions WHERE ${where.join(" AND ")}
        ORDER BY created_at DESC, id DESC LIMIT 200`,
      args,
    ),
    query<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM submissions WHERE deleted_at IS NULL GROUP BY status"),
  ]);
  const count = Object.fromEntries(counts.map((c) => [c.status, Number(c.n)]));
  const all = counts.reduce((n, c) => n + Number(c.n), 0);

  return (
    <>
      <PageHeader
        title="Messages"
        description="Everything sent through the contact form on the website."
        actions={
          <a href={`/admin/api/messages.csv${status ? `?status=${status}` : ""}`} className={btn.secondary}>
            Download as spreadsheet (CSV)
          </a>
        }
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav aria-label="Status" className="flex gap-1 rounded-md bg-sand-100 p-1 text-[13px] font-semibold">
          {TABS.map(([key, label]) => (
            <Link
              key={key}
              href={key ? `?status=${key}` : "?"}
              aria-current={status === key ? "page" : undefined}
              className={`rounded px-3 py-1.5 ${status === key ? "bg-white text-forest-900 shadow-sm" : "text-ink-muted hover:text-forest-900"}`}
            >
              {label} ({key ? (count[key] ?? 0) : all})
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" role="search">
          {status && <input type="hidden" name="status" value={status} />}
          <input name="q" defaultValue={q} placeholder="Search messages…" className={`${inputClass} w-64`} />
          <button className={btn.secondary}>Search</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={q || status ? "No messages match" : "No messages yet"}>
          Messages sent through the website&apos;s contact form appear here.
        </EmptyState>
      ) : (
        <ul className="divide-y divide-sand-200 overflow-hidden rounded-lg border border-sand-200 bg-white shadow-xs">
          {rows.map((m) => (
            <li key={m.id}>
              <Link href={`/admin/messages/${m.id}`} className="flex items-start gap-4 px-4 py-3 hover:bg-sand-25">
                <span className="w-44 shrink-0">
                  <span className={`block truncate text-[14px] ${m.status === "new" ? "font-bold text-forest-900" : "font-semibold text-ink"}`}>{m.name}</span>
                  <span className="block truncate text-[12px] text-ink-muted">{m.email}</span>
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block truncate text-[14px] ${m.status === "new" ? "font-bold" : ""}`}>{m.subject || "(no subject)"}</span>
                  <span className="block truncate text-[13px] text-ink-muted">{m.message}</span>
                </span>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <Badge value={m.status} />
                  <span className="text-[12px] text-ink-muted">{timeAgo(m.created_at)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
