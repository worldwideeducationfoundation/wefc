import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { PickedMedia } from "@/components/admin/MediaPicker";
import { PageContentForm } from "@/components/admin/PageContentForm";
import { PageHeader, btn } from "@/components/admin/ui";
import { mediaPreviews } from "@/server/admin/data";
import { roleCan } from "@/server/auth/roles";
import { requireCapability } from "@/server/auth/session";
import { CORE_PAGES, type CorePageDef, corePageStates, isCorePageKey } from "@/server/blocks";
import { query } from "@/server/db";
import { savePageContent } from "../actions";

export async function generateMetadata({ params }: PageProps<"/admin/page-content/[key]">): Promise<Metadata> {
  const { key } = await params;
  return { title: isCorePageKey(key) ? `${CORE_PAGES[key].label} — Page Content` : "Page Content" };
}

export default async function PageContentEdit({ params }: PageProps<"/admin/page-content/[key]">) {
  const { key } = await params;
  if (!isCorePageKey(key)) notFound();
  const user = await requireCapability("content.view");
  const def: CorePageDef = CORE_PAGES[key];

  const [rows, states] = await Promise.all([
    query<{ block_key: string; value: string | null }>("SELECT block_key, value FROM content_blocks WHERE page_key = ?", [key]),
    corePageStates(),
  ]);
  const stored = Object.fromEntries(rows.map((r) => [r.block_key, r.value ?? ""]));
  const imageIds = Object.entries(def.blocks)
    .filter(([, b]) => b.type === "image")
    .map(([k]) => stored[k]);
  const previews = await mediaPreviews(imageIds);
  const media: Record<string, PickedMedia> = Object.fromEntries(
    Object.entries(previews).map(([id, m]) => [id, { id: Number(id), url: m.url, alt: m.alt }]),
  );
  const state = states[key];

  return (
    <>
      <PageHeader
        title={def.label}
        description={def.description}
        back={{ href: "/admin/page-content", label: "Page Content" }}
        actions={
          def.path ? (
            <a href={def.path} target="_blank" rel="noopener" className={btn.secondary}>
              View page ↗
            </a>
          ) : null
        }
      />
      <PageContentForm
        blocks={Object.entries(def.blocks).map(([k, b]) => ({
          key: k,
          label: b.label,
          type: b.type,
          default: b.default,
          help: b.help,
          group: b.group ?? "",
          options: b.options,
        }))}
        stored={stored}
        media={media}
        canDisable={def.canDisable}
        hasPath={Boolean(def.path)}
        enabled={state?.enabled ?? true}
        seo={{ title: state?.seoTitle ?? "", description: state?.seoDescription ?? "" }}
        seoDefaults={{ title: def.seo?.title ?? def.label, description: def.seo?.description ?? "" }}
        canEdit={roleCan(user.role, "content.edit")}
        action={savePageContent.bind(null, key)}
      />
    </>
  );
}
