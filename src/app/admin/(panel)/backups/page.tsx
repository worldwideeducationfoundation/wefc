import type { Metadata } from "next";
import { BackupRestore } from "@/components/admin/BackupRestore";
import { Alert, Card, PageHeader, btn } from "@/components/admin/ui";
import { requireCapability } from "@/server/auth/session";
import { queryOne } from "@/server/db";
import { env } from "@/server/env";

export const metadata: Metadata = { title: "Backups" };

export default async function BackupsPage() {
  await requireCapability("backups.manage");
  const media = await queryOne<{ n: number; mb: number }>("SELECT COUNT(*) AS n, COALESCE(SUM(size_bytes),0)/1048576 AS mb FROM media");

  return (
    <>
      <PageHeader
        title="Backups"
        description="A copy of all the website's content and images in one file. Keep one somewhere safe, and download a fresh one before big changes."
      />
      <div className="grid max-w-3xl gap-5">
        <Card title="Download a backup" description={`Everything except admin accounts: every page, project, post, message and setting, plus ${Number(media?.n ?? 0)} images (about ${Number(media?.mb ?? 0).toFixed(0)} MB).`}>
          {/* A file download from an API route, not a page: a plain link is right here. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/admin/api/backup" className={btn.primary}>
            Download backup (.tar.gz)
          </a>
        </Card>
        <Card title="Restore from a backup" description="Replaces all content on this website with the backup's, and adds its images. Admin accounts are not changed.">
          <div className="mb-4">
            <Alert tone="warn">
              Anything added since the backup was made will be lost. Download a fresh backup first if unsure.
            </Alert>
          </div>
          <BackupRestore />
        </Card>
        <p className="text-[12px] text-ink-muted">
          Images are stored on the server at <code>{env.uploadDir}</code>
          {!env.uploadDirConfigured && " (the default location — set UPLOAD_DIR on the live server)"}.
        </p>
      </div>
    </>
  );
}
