import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getResourceRow } from "@/server/admin/data";
import { getResource } from "@/server/admin/resources";
import { requireCapability } from "@/server/auth/session";
import { ResourceEditor } from "../../editor";

export async function generateMetadata({ params }: PageProps<"/admin/content/[resource]/[id]">): Promise<Metadata> {
  const def = getResource((await params).resource);
  return { title: def ? `Edit ${def.label.toLowerCase()}` : "Edit" };
}

export default async function EditResourcePage({ params }: PageProps<"/admin/content/[resource]/[id]">) {
  const { resource, id } = await params;
  const def = getResource(resource);
  const numericId = Number(id);
  if (!def || !Number.isInteger(numericId) || numericId <= 0) notFound();
  const user = await requireCapability("content.view");
  const row = await getResourceRow(def, numericId);
  if (!row) notFound();
  return <ResourceEditor def={def} user={user} row={row} />;
}
