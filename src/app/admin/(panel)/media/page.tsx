import type { Metadata } from "next";
import { MediaLibrary } from "@/components/admin/MediaLibrary";
import { PageHeader } from "@/components/admin/ui";
import { roleCan } from "@/server/auth/roles";
import { requireCapability } from "@/server/auth/session";

export const metadata: Metadata = { title: "Media Library" };

export default async function MediaPage() {
  const user = await requireCapability("media.view");
  return (
    <>
      <PageHeader
        title="Media Library"
        description="Every image on the website. They are stored on the website's server — not in GitHub — and reused anywhere."
      />
      <MediaLibrary canUpload={roleCan(user.role, "media.upload")} canDelete={roleCan(user.role, "media.delete")} />
    </>
  );
}
