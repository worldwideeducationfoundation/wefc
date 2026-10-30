import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmButton, SubmitButton } from "@/components/admin/client";
import { Badge, Card, FieldShell, PageHeader, btn, formatDateTime, inputClass } from "@/components/admin/ui";
import { roleCan } from "@/server/auth/roles";
import { requireCapability } from "@/server/auth/session";
import { execute, queryOne } from "@/server/db";
import { trashSubmission, updateSubmission } from "../actions";

export const metadata: Metadata = { title: "Message" };

export default async function MessagePage({ params }: PageProps<"/admin/messages/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const user = await requireCapability("submissions.view");

  const m = await queryOne<{
    id: number;
    name: string;
    email: string;
    phone: string | null;
    subject: string | null;
    message: string;
    status: string;
    admin_note: string | null;
    created_at: Date;
    handled_at: Date | null;
    handler: string | null;
  }>(
    `SELECT s.*, u.name AS handler FROM submissions s LEFT JOIN admin_users u ON u.id = s.handled_by
      WHERE s.id = ? AND s.deleted_at IS NULL`,
    [id],
  );
  if (!m) notFound();

  // Opening a new message marks it read.
  if (m.status === "new" && roleCan(user.role, "submissions.manage")) {
    await execute("UPDATE submissions SET status = 'read' WHERE id = ? AND status = 'new'", [id]);
    m.status = "read";
  }
  const canManage = roleCan(user.role, "submissions.manage");
  const replyHref = `mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || "Your message to Worldwide Education Fund Canada"}`)}`;

  return (
    <>
      <PageHeader
        title={m.subject || "(no subject)"}
        back={{ href: "/admin/messages", label: "Messages" }}
        actions={
          <a href={replyHref} className={btn.primary}>
            Reply by email
          </a>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <Card>
          <dl className="mb-5 grid gap-x-6 gap-y-2 text-[14px] sm:grid-cols-[7rem_1fr]">
            <dt className="font-semibold text-ink-muted">From</dt>
            <dd className="font-semibold text-forest-900">{m.name}</dd>
            <dt className="font-semibold text-ink-muted">Email</dt>
            <dd>
              <a href={`mailto:${m.email}`} className="underline">
                {m.email}
              </a>
            </dd>
            {m.phone && (
              <>
                <dt className="font-semibold text-ink-muted">Phone</dt>
                <dd>
                  <a href={`tel:${m.phone}`} className="underline">
                    {m.phone}
                  </a>
                </dd>
              </>
            )}
            <dt className="font-semibold text-ink-muted">Received</dt>
            <dd>{formatDateTime(m.created_at)}</dd>
          </dl>
          <div className="whitespace-pre-wrap rounded-md bg-sand-50 p-4 font-body text-[16px] leading-relaxed text-ink">{m.message}</div>
        </Card>

        <aside className="flex flex-col gap-4">
          <Card title="Status">
            <p className="mb-3">
              <Badge value={m.status} />
              {m.handler && (
                <span className="ml-2 text-[12px] text-ink-muted">
                  by {m.handler}, {formatDateTime(m.handled_at)}
                </span>
              )}
            </p>
            {canManage ? (
              <form action={updateSubmission.bind(null, m.id)} className="flex flex-col gap-3">
                <FieldShell id="status" label="Mark as">
                  <select id="status" name="status" defaultValue={m.status} className={inputClass}>
                    <option value="read">Read</option>
                    <option value="replied">Replied</option>
                    <option value="archived">Archived</option>
                    <option value="new">Unread</option>
                  </select>
                </FieldShell>
                <FieldShell id="admin_note" label="Internal note" help="Only visible to admins.">
                  <textarea id="admin_note" name="admin_note" rows={3} defaultValue={m.admin_note ?? ""} maxLength={1000} className={inputClass} />
                </FieldShell>
                <SubmitButton>Save</SubmitButton>
              </form>
            ) : (
              <p className="text-[13px] text-ink-muted">You can read messages but not change them.</p>
            )}
          </Card>
          {canManage && (
            <form action={trashSubmission.bind(null, m.id)}>
              <ConfirmButton className={`${btn.danger} w-full`} message="Move this message to Trash?">
                Move to Trash
              </ConfirmButton>
            </form>
          )}
        </aside>
      </div>
    </>
  );
}
