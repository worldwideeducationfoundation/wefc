import { Suspense } from "react";
import { Notice } from "@/components/admin/client";
import { Shell } from "@/components/admin/Shell";
import { ADMIN_NAV } from "@/server/admin/nav";
import { RESOURCES } from "@/server/admin/resources";
import { ROLE_LABELS, roleCan } from "@/server/auth/roles";
import { requireUser } from "@/server/auth/session";
import { query } from "@/server/db";

/**
 * Every admin page except sign-in and setup sits inside this layout, which
 * refuses anyone not signed in. Each page and action still checks its own
 * permission — this is the outer door, not the only lock.
 */
async function badgeCounts(canMessages: boolean) {
  const trashUnion = [...RESOURCES.map((r) => r.table), "pages"]
    .map((t) => `SELECT COUNT(*) AS n FROM ${t} WHERE deleted_at IS NOT NULL`)
    .join(" UNION ALL ");
  const [trash, messages] = await Promise.all([
    query<{ n: number }>(`SELECT SUM(n) AS n FROM (${trashUnion}) x`),
    canMessages
      ? query<{ n: number }>("SELECT COUNT(*) AS n FROM submissions WHERE status = 'new' AND deleted_at IS NULL")
      : Promise.resolve([{ n: 0 }]),
  ]);
  return { trash: Number(trash[0]?.n ?? 0), messages: Number(messages[0]?.n ?? 0) };
}

export default async function PanelLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireUser();
  const counts = await badgeCounts(roleCan(user.role, "submissions.view"));

  const groups = ADMIN_NAV.map((g) => ({
    label: g.label,
    items: g.items
      .filter((i) => roleCan(user.role, i.cap))
      .map((i) => ({ label: i.label, href: i.href, count: i.badge ? counts[i.badge] : undefined })),
  })).filter((g) => g.items.length > 0);

  return (
    <Shell groups={groups} user={{ name: user.name, roleLabel: ROLE_LABELS[user.role] }}>
      {children}
      <Suspense>
        <Notice />
      </Suspense>
    </Shell>
  );
}
