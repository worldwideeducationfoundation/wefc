import type { Metadata } from "next";
import Link from "next/link";
import { Badge, PageHeader, btn, formatDateTime } from "@/components/admin/ui";
import { ROLE_DESCRIPTIONS, ROLE_LABELS, ROLES, type Role } from "@/server/auth/roles";
import { requireCapability } from "@/server/auth/session";
import { query } from "@/server/db";

export const metadata: Metadata = { title: "Users & Roles" };

export default async function UsersPage() {
  const me = await requireCapability("users.manage");
  const users = await query<{ id: number; name: string; email: string; role: Role; status: string; last_login_at: Date | null }>(
    "SELECT id, name, email, role, status, last_login_at FROM admin_users ORDER BY name",
  );
  return (
    <>
      <PageHeader
        title="Users & Roles"
        description="Everyone who can sign in to this admin."
        actions={
          <Link href="/admin/users/new" className={btn.primary}>
            + Add a person
          </Link>
        }
      />
      <div className="overflow-hidden rounded-lg border border-sand-200 bg-white shadow-xs">
        <table className="w-full text-left text-[14px]">
          <thead className="bg-sand-50 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            <tr>
              <th className="px-4 py-2.5">Name</th>
              <th className="px-4 py-2.5">Role</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Last signed in</th>
              <th className="px-4 py-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {users.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-2.5">
                  <span className="block font-semibold text-forest-900">
                    {u.name} {u.id === me.id && <span className="text-[12px] font-normal text-ink-muted">(you)</span>}
                  </span>
                  <span className="block text-[13px] text-ink-muted">{u.email}</span>
                </td>
                <td className="px-4 py-2.5">{ROLE_LABELS[u.role]}</td>
                <td className="px-4 py-2.5">
                  <Badge value={u.status} />
                </td>
                <td className="px-4 py-2.5 text-ink-muted">{u.last_login_at ? formatDateTime(u.last_login_at) : "Never"}</td>
                <td className="px-4 py-2.5 text-right">
                  <Link href={`/admin/users/${u.id}`} className={btn.ghost}>
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mb-3 mt-8 text-[16px] font-bold text-forest-900">What each role can do</h2>
      <dl className="grid gap-3 md:grid-cols-3">
        {ROLES.map((r) => (
          <div key={r} className="rounded-md border border-sand-200 bg-white p-4">
            <dt className="font-semibold text-forest-900">{ROLE_LABELS[r]}</dt>
            <dd className="mt-1 text-[13px] text-ink-muted">{ROLE_DESCRIPTIONS[r]}</dd>
          </div>
        ))}
      </dl>
    </>
  );
}
