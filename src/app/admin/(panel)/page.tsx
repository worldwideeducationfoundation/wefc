import type { Metadata } from "next";
import Link from "next/link";
import { Alert, Badge, Card, PageHeader, btn, timeAgo } from "@/components/admin/ui";
import { roleCan } from "@/server/auth/roles";
import { requireUser } from "@/server/auth/session";
import { query, queryOne } from "@/server/db";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Dashboard" };

const CARDS = [
  { key: "posts", label: "Posts", href: "/admin/content/posts" },
  { key: "programs", label: "Program cards", href: "/admin/content/programs" },
  { key: "learning_centers", label: "Learning centers", href: "/admin/content/learning-centers" },
  { key: "pages", label: "Pages", href: "/admin/pages" },
  { key: "team_members", label: "Team members", href: "/admin/content/team" },
  { key: "gallery_items", label: "Gallery photos", href: "/admin/content/gallery" },
] as const;

export default async function DashboardPage() {
  const user = await requireUser();
  const canMessages = roleCan(user.role, "submissions.view");

  const counts = await query<{ k: string; total: number; live: number }>(
    CARDS.map(
      (c) => `SELECT '${c.key}' AS k, COUNT(*) AS total, COALESCE(SUM(status = 'published'), 0) AS live FROM ${c.key} WHERE deleted_at IS NULL`,
    ).join(" UNION ALL "),
  );
  const byKey = Object.fromEntries(counts.map((c) => [c.k, { total: Number(c.total), live: Number(c.live) }]));
  const drafts = Object.values(byKey).reduce((n, c) => n + (c.total - c.live), 0);

  const [unread, recentPosts, activity, media, content] = await Promise.all([
    canMessages
      ? queryOne<{ n: number }>("SELECT COUNT(*) AS n FROM submissions WHERE status = 'new' AND deleted_at IS NULL")
      : null,
    query<{ id: number; title: string; status: string; section: string; updated_at: Date }>(
      "SELECT id, title, status, section, updated_at FROM posts WHERE deleted_at IS NULL ORDER BY updated_at DESC LIMIT 5",
    ),
    roleCan(user.role, "activity.view")
      ? query<{ action: string; module: string; details: string | null; created_at: Date; name: string | null }>(
          `SELECT l.action, l.module, l.details, l.created_at, u.name
             FROM activity_logs l LEFT JOIN admin_users u ON u.id = l.user_id
            ORDER BY l.created_at DESC, l.id DESC LIMIT 8`,
        )
      : [],
    queryOne<{ n: number; mb: number }>("SELECT COUNT(*) AS n, COALESCE(SUM(size_bytes), 0) / 1048576 AS mb FROM media"),
    queryOne<{ n: number }>("SELECT (SELECT COUNT(*) FROM programs) + (SELECT COUNT(*) FROM posts) AS n"),
  ]);

  const unreadCount = Number(unread?.n ?? 0);
  const firstName = user.name.split(" ")[0];

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={
          drafts > 0
            ? `${drafts} item${drafts === 1 ? " is" : "s are"} still in draft — not visible on the website until published.`
            : "Everything is published. Changes you save appear on the website straight away."
        }
        actions={
          <>
            {roleCan(user.role, "content.create") && (
              <>
                <Link href="/admin/content/posts/new" className={btn.primary}>
                  + Write a post
                </Link>
                <Link href="/admin/pages/new" className={btn.secondary}>
                  + New page
                </Link>
              </>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-4">
        {env.isProduction && !env.uploadDirConfigured && roleCan(user.role, "settings.manage") && (
          <Alert tone="warn">
            <strong>Set UPLOAD_DIR.</strong> Uploaded images are being stored inside the app&apos;s own folder, which a
            redeploy could replace. Set the <code>UPLOAD_DIR</code> environment variable to a folder outside the app
            (see DEPLOYMENT.md) and move the <code>storage/uploads</code> folder there.
          </Alert>
        )}
        {Number(content?.n ?? 0) === 0 && roleCan(user.role, "settings.manage") && (
          <Alert tone="info">
            The site has no content yet. Start adding your own, or bring everything over from another copy of the
            site with{" "}
            <Link href="/admin/backups" className="font-semibold underline">
              Backups → Restore
            </Link>
            .
          </Alert>
        )}
        {unreadCount > 0 && (
          <Alert tone="info">
            <strong>{unreadCount}</strong> new message{unreadCount === 1 ? "" : "s"} from the contact form.{" "}
            <Link href="/admin/messages?status=new" className="font-semibold underline">
              Read {unreadCount === 1 ? "it" : "them"}
            </Link>
          </Alert>
        )}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
        {CARDS.map((c) => {
          const s = byKey[c.key] ?? { total: 0, live: 0 };
          return (
            <Link key={c.key} href={c.href} className="rounded-lg border border-sand-200 bg-white p-4 shadow-xs transition-colors hover:border-forest-900">
              <span className="block text-[28px] font-bold leading-none text-forest-900">{s.total}</span>
              <span className="mt-1.5 block text-[13px] font-semibold text-forest-900">{c.label}</span>
              <span className="mt-0.5 block text-[12px] text-ink-muted">
                {s.live} live · {s.total - s.live} draft
              </span>
            </Link>
          );
        })}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Recently edited posts" actions={<Link href="/admin/content/posts" className={btn.ghost}>All posts</Link>}>
          {recentPosts.length === 0 ? (
            <p className="text-[14px] text-ink-muted">No posts yet.</p>
          ) : (
            <ul className="divide-y divide-sand-200">
              {recentPosts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/content/posts/${p.id}`} className="min-w-0 truncate text-[14px] font-semibold text-forest-900 hover:underline">
                    {p.title}
                  </Link>
                  <span className="flex shrink-0 items-center gap-2">
                    <Badge value={p.status} />
                    <span className="text-[12px] text-ink-muted">{timeAgo(p.updated_at)}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {activity.length > 0 ? (
          <Card title="Recent activity" actions={<Link href="/admin/activity" className={btn.ghost}>View all</Link>}>
            <ul className="divide-y divide-sand-200">
              {activity.map((a, i) => (
                <li key={i} className="flex items-start justify-between gap-3 py-2.5 text-[14px]">
                  <span className="min-w-0">
                    <strong className="text-forest-900">{a.name ?? "Someone"}</strong>{" "}
                    <span className="text-ink-muted">
                      {a.action.replace(/_/g, " ")} · {a.module}
                    </span>
                    {a.details && <span className="block truncate text-[13px] text-ink">{a.details}</span>}
                  </span>
                  <span className="shrink-0 text-[12px] text-ink-muted">{timeAgo(a.created_at)}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : (
          <Card title="Quick links">
            <ul className="grid gap-2 text-[14px]">
              <li><Link className="font-semibold text-forest-900 hover:underline" href="/admin/content/hero-slides">Change the home page slideshow</Link></li>
              <li><Link className="font-semibold text-forest-900 hover:underline" href="/admin/page-content">Edit the wording on a page</Link></li>
              <li><Link className="font-semibold text-forest-900 hover:underline" href="/admin/media">Upload photographs</Link></li>
            </ul>
          </Card>
        )}
      </div>

      <p className="mt-6 text-[12px] text-ink-muted">
        Media library: {Number(media?.n ?? 0)} images, {Number(media?.mb ?? 0).toFixed(1)} MB on the server.
      </p>
    </>
  );
}
