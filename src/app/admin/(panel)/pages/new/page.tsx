import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/ui";
import { requireCapability } from "@/server/auth/session";
import { PageEditor } from "../editor";

export const metadata: Metadata = { title: "New page" };

export default async function NewPage() {
  const user = await requireCapability("content.create");
  return (
    <>
      <PageHeader title="New page" back={{ href: "/admin/pages", label: "Pages" }} />
      <PageEditor user={user} row={null} />
    </>
  );
}
