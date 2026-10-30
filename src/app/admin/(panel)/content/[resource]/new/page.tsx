import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResource } from "@/server/admin/resources";
import { requireCapability } from "@/server/auth/session";
import { ResourceEditor } from "../../editor";

export async function generateMetadata({ params }: PageProps<"/admin/content/[resource]/new">): Promise<Metadata> {
  const def = getResource((await params).resource);
  return { title: def ? `New ${def.label.toLowerCase()}` : "New" };
}

export default async function NewResourcePage({ params }: PageProps<"/admin/content/[resource]/new">) {
  const def = getResource((await params).resource);
  if (!def) notFound();
  const user = await requireCapability("content.create");
  return <ResourceEditor def={def} user={user} row={null} />;
}
