import type { Metadata } from "next";
import Link from "next/link";
import { ConfirmButton, SubmitButton } from "@/components/admin/client";
import { Badge, EmptyState, PageHeader, btn, formatDateTime, inputClass } from "@/components/admin/ui";
import { roleCan } from "@/server/auth/roles";
import { requireCapability } from "@/server/auth/session";
import { query } from "@/server/db";
import { deleteSubscriber, setSubscriberStatus } from "./actions";

export const metadata: Metadata = { title: "Newsletter" };

const PER_PAGE = 100;

/** Everyone who signed up through the footer's "Stay in touch" form. */
export default async function NewsletterPage({ searchParams }: PageProps<"/admin/newsletter">) {
  const user = await requireCapability("submissions.view");
  const sp = await searchParams;
  const status = sp.status === "unsubscribed" ? "unsubscribed" : sp.status === "all" ? "" : "subscribed";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const page = Math.max(1, Number(sp.page) || 1);

  const where: string[] = [];
  const args: unknown[] = [];
  if (status) {
    where.push("status = ?");
    args.push(status);
  }
  if (q) {
    where.push("email LIKE ?");
    args.push(`%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`);
  }
  const w = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows, counts] = await Promise.all([
    query<{ id: number; email: string; status: string; created_at: Date; updated_at: Date }>(
      `SELECT id, email, status, created_at, updated_at FROM newsletter_subscribers ${w}
        ORDER BY created_at DESC, id DESC LIMIT ${PER_PAGE} OFFSET ${(page - 1) * PER_PAGE}`,
      args,
    ),
    query<{ status: string; n: number }>("SELECT status, COUNT(*) AS n FROM newsletter_subscribers GROUP BY status"),
  ]);
  const count = Object.fromEntries(counts.map((c) => [c.status, Number(c.n)]));
  const canManage = roleCan(user.role, "submissions.manage");
  const tabs = [
    ["subscribed", `Subscribed (${count.subscribed ?? 0})`],
    ["unsubscribed", `Unsubscribed (${count.unsubscribed ?? 0})`],
    ["all", "All"],
  ] as const;

  return (
    <>
      <PageHeader
        title="Newsletter"
        description="Email addresses left in the “Stay in touch” form at the foot of every page. The form's wording is under Page Content → Footer."
        actions={
          <a href={`/admin/api/newsletter.csv?status=${status || "all"}`} className={btn.secondary}>
            Download as spreadsheet (CSV)
          </a>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <nav aria-label="Status" className="flex gap-1 rounded-md bg-sand-100 p-1 text-[13px] font-semibold">
          {tabs.map(([key, label]) => (
            <Link
              key={key}
              href={`?status=${key}`}
              aria-current={(status || "all") === key ? "page" : undefined}
              className={`rounded px-3 py-1.5 ${(status || "all") === key ? "bg-white text-forest-900 shadow-sm" : "text-ink-muted hover:text-forest-900"}`}
            >
              {label}
            </Link>
          ))}
        </nav>
        <form className="flex gap-2" role="search">
          <input type="hidden" name="status" value={status || "all"} />
          <input name="q" defaultValue={q} placeholder="Search email…" className={`${inputClass} w-64`} />
          <button className={btn.secondary}>Search</button>
        </form>
      </div>

      {rows.length === 0 ? (
        <EmptyState title={q ? "No addresses match" : "No signups yet"}>
          Addresses appear here as soon as someone uses the signup at the foot of the website.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-sand-200 bg-white shadow-xs">
          <table className="w-full text-left text-[14px]">
            <thead className="bg-sand-50 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
              <tr>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Signed up</th>
                <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-sand-200">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5 font-semibold text-forest-900">
                    <a href={`mailto:${r.email}`} className="hover:underline">
                      {r.email}
                    </a>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge value={r.status === "subscribed" ? "published" : "draft"} label={r.status === "subscribed" ? "Subscribed" : "Unsubscribed"} />
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{formatDateTime(r.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-right">
                    {canManage && (
                      <span className="inline-flex gap-1">
                        <form action={setSubscriberStatus.bind(null, r.id, r.status === "subscribed" ? "unsubscribed" : "subscribed")}>
                          <SubmitButton className={btn.ghost} pendingLabel="…">
                            {r.status === "subscribed" ? "Unsubscribe" : "Resubscribe"}
                          </SubmitButton>
                        </form>
                        <form action={deleteSubscriber.bind(null, r.id)}>
                          <ConfirmButton className={`${btn.ghost} text-red-800`} message={`Delete ${r.email} completely?`}>
                            Delete
                          </ConfirmButton>
                        </form>
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
