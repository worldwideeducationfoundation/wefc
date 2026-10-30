import { duplicateResource, saveResource, trashResource } from "@/app/admin/(panel)/content/actions";
import { ConfirmButton, SubmitButton } from "@/components/admin/client";
import type { PickedMedia } from "@/components/admin/MediaPicker";
import { ResourceForm } from "@/components/admin/ResourceForm";
import { Card, PageHeader, btn, formatDateTime } from "@/components/admin/ui";
import { collectMediaIds, parseRichDoc } from "@/lib/richtext";
import { loadOptions, mediaPreviews, optionSourcesOf } from "@/server/admin/data";
import type { ResourceDef } from "@/server/admin/resources";
import { roleCan } from "@/server/auth/roles";
import type { AdminUser } from "@/server/auth/session";


/** Loads everything a content form needs and renders it. Shared by "new" and "edit". */
export async function ResourceEditor({
  def,
  user,
  row,
}: {
  def: ResourceDef;
  user: AdminUser;
  row: Record<string, unknown> | null;
}) {
  const isNew = row === null;
  const initial: Record<string, unknown> = row ?? { status: "draft", ...(def.newDefaults ?? {}) };

  const mediaIds: unknown[] = def.fields.filter((f) => f.type === "media").map((f) => initial[f.name]);
  const richIds = new Set<number>();
  for (const f of def.fields) if (f.type === "richtext") collectMediaIds(parseRichDoc(initial[f.name]), richIds);

  const [options, previews, richPreviews, programs] = await Promise.all([
    loadOptions(optionSourcesOf(def)),
    mediaPreviews(mediaIds),
    mediaPreviews(richIds),
    // The "placements" field type is unused on this site; it offers no project choices.
    Promise.resolve([] as { slug: string; short_title: string }[]),
  ]);

  const media: Record<string, PickedMedia> = Object.fromEntries(
    Object.entries(previews).map(([id, m]) => [id, { id: Number(id), url: m.url, alt: m.alt }]),
  );
  const richMediaSrc = Object.fromEntries(Object.entries(richPreviews).map(([id, m]) => [id, m.url]));

  const id = row ? Number(row.id) : null;
  const title = isNew ? `New ${def.label.toLowerCase()}` : String(row?.[def.titleField] ?? def.label) || def.label;

  return (
    <>
      <PageHeader title={title} back={{ href: `/admin/content/${def.key}`, label: def.plural }} />
      <ResourceForm
        fields={def.fields}
        initial={initial}
        options={options}
        media={media}
        richMediaSrc={richMediaSrc}
        programs={programs.map((p) => ({ slug: p.slug, title: p.short_title }))}
        isNew={isNew}
        label={def.label}
        publicHref={row ? (def.publicPath?.(row) ?? null) : null}
        action={saveResource.bind(null, def.key, id)}
        updatedAt={row?.updated_at ? formatDateTime(row.updated_at as Date) : null}
        sidebarExtra={
          id ? (
            <Card title="More">
              <div className="flex flex-col gap-2">
                {roleCan(user.role, "content.create") && (
                  <form action={duplicateResource.bind(null, def.key, id)}>
                    <SubmitButton className={`${btn.secondary} w-full`} pendingLabel="Copying…">
                      Duplicate
                    </SubmitButton>
                  </form>
                )}
                {roleCan(user.role, "content.delete") && (
                  <form action={trashResource.bind(null, def.key, id)}>
                    <ConfirmButton className={`${btn.danger} w-full`} message={`Move this ${def.label.toLowerCase()} to Trash? You can restore it from Trash.`}>
                      Move to Trash
                    </ConfirmButton>
                  </form>
                )}
              </div>
            </Card>
          ) : null
        }
      />
    </>
  );
}
