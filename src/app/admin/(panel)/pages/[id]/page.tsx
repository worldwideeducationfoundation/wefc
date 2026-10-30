import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/admin/ui";
import { requireCapability } from "@/server/auth/session";
import { queryOne } from "@/server/db";
import { PageEditor, type PageRow } from "../editor";

export const metadata: Metadata = { title: "Edit page" };

export default async function EditPage({ params }: PageProps<"/admin/pages/[id]">) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const user = await requireCapability("content.view");
  const row = await queryOne<PageRow>("SELECT * FROM pages WHERE id = ? AND deleted_at IS NULL", [id]);
  if (!row) notFound();
  return (
    <>
      <PageHeader title={row.title} back={{ href: "/admin/pages", label: "Pages" }} />
      <PageEditor user={user} row={row} />
    </>
  );
}
