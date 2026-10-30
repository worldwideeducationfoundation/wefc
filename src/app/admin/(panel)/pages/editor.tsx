import { ConfirmButton } from "@/components/admin/client";
import { PageBuilder } from "@/components/admin/PageBuilder";
import { Card, btn } from "@/components/admin/ui";
import { collectMediaIds } from "@/lib/richtext";
import { normalizeSections } from "@/lib/sections";
import { mediaPreviews } from "@/server/admin/data";
import { roleCan } from "@/server/auth/roles";
import type { AdminUser } from "@/server/auth/session";
import { savePage, trashPage } from "./actions";

type PageRow = {
  id: number;
  title: string;
  slug: string;
  eyebrow: string | null;
  lede: string | null;
  sections: string | null;
  seo_title: string | null;
  seo_description: string | null;
  noindex: number;
  status: "draft" | "published";
};

export async function PageEditor({ user, row }: { user: AdminUser; row: PageRow | null }) {
  let raw: unknown = [];
  try {
    raw = row?.sections ? JSON.parse(row.sections) : [];
  } catch {
    raw = [];
  }
  const sections = normalizeSections(raw);

  const ids = new Set<number>();
  for (const s of sections) {
    if (s.type === "text" || s.type === "imageText") collectMediaIds(s.body, ids);
    if (s.type === "imageText" && s.mediaId) ids.add(s.mediaId);
    if (s.type === "gallery") s.mediaIds.forEach((m) => ids.add(m));
  }
  const previews = await mediaPreviews(ids);
  const mediaSrc = Object.fromEntries(Object.entries(previews).map(([id, m]) => [id, m.url]));

  return (
    <PageBuilder
      initial={{
        title: row?.title ?? "",
        slug: row?.slug ?? "",
        eyebrow: row?.eyebrow ?? "",
        lede: row?.lede ?? "",
        seo_title: row?.seo_title ?? "",
        seo_description: row?.seo_description ?? "",
        noindex: Boolean(row?.noindex),
        status: row?.status ?? "draft",
        sections,
      }}
      isNew={!row}
      canAddToMenu={roleCan(user.role, "settings.manage")}
      mediaSrc={mediaSrc}
      action={savePage.bind(null, row?.id ?? null)}
      sidebarExtra={
        row && roleCan(user.role, "content.delete") ? (
          <Card title="More">
            <ConfirmButton
              className={`${btn.danger} w-full`}
              message="Move this page to Trash? It disappears from the website; you can restore it from Trash."
              formAction={trashPage.bind(null, row.id)}
            >
              Move to Trash
            </ConfirmButton>
          </Card>
        ) : null
      }
    />
  );
}

export type { PageRow };
