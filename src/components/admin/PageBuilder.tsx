"use client";

/* eslint-disable @next/next/no-img-element -- library thumbnails */
import Link from "next/link";
import { useActionState, useState } from "react";
import { slugify } from "@/lib/admin-fields";
import { type Ground, newSection, SECTION_TYPES, type Section, type SectionType } from "@/lib/sections";
import { Toast, useActionFeedback } from "./client";
import { MediaDialog } from "./MediaPicker";
import { RichTextEditor } from "./RichTextEditor";
import { Badge, Card, FieldShell, btn, inputClass } from "./ui";

type Result = { ok: boolean; message?: string; errors?: Record<string, string>; values?: Record<string, unknown> };

export type PageBuilderProps = {
  initial: {
    title: string;
    slug: string;
    eyebrow: string;
    lede: string;
    seo_title: string;
    seo_description: string;
    noindex: boolean;
    status: "draft" | "published";
    sections: Section[];
  };
  isNew: boolean;
  canAddToMenu: boolean;
  /** Current URLs of every image the page uses, by media id. */
  mediaSrc: Record<string, string>;
  action: (prev: Result, form: FormData) => Promise<Result>;
  sidebarExtra?: React.ReactNode;
};

const GROUNDS: { value: Ground; label: string }[] = [
  { value: "sand", label: "Light" },
  { value: "raised", label: "Tinted" },
  { value: "forest", label: "Dark green" },
];

/**
 * Builds a page from sections. Each section type is one of the site's own
 * layouts, so the result always matches the rest of the website; editors
 * choose the content and the order, not the styling.
 */
export function PageBuilder({ initial, isNew, canAddToMenu, mediaSrc: initialSrc, action, sidebarExtra }: PageBuilderProps) {
  const [state, formAction, pending] = useActionState(action, { ok: true });
  const [sections, setSections] = useState<Section[]>(initial.sections);
  const [status, setStatus] = useState(initial.status);
  const [slug, setSlug] = useState(initial.slug);
  const [slugTouched, setSlugTouched] = useState(!isNew);
  const [mediaSrc, setMediaSrc] = useState(initialSrc);
  const [open, setOpen] = useState<Set<string>>(() => new Set(initial.sections.length <= 3 ? initial.sections.map((s) => s.id) : []));
  const [adding, setAdding] = useState(false);
  const { toast, dismiss, markDirty, dirty } = useActionFeedback(state);

  const v = { ...initial, ...((state.values as Partial<PageBuilderProps["initial"]>) ?? {}) };
  const errors = state.errors ?? {};

  const update = (id: string, patch: Partial<Section>) => {
    markDirty();
    setSections((prev) => prev.map((s) => (s.id === id ? ({ ...s, ...patch } as Section) : s)));
  };
  const remove = (id: string) => {
    if (!window.confirm("Remove this section from the page?")) return;
    markDirty();
    setSections((prev) => prev.filter((s) => s.id !== id));
  };
  const move = (id: string, dir: -1 | 1) => {
    markDirty();
    setSections((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  };
  const duplicate = (id: string) => {
    markDirty();
    setSections((prev) => {
      const i = prev.findIndex((s) => s.id === id);
      const copy = { ...structuredClone(prev[i]), id: Math.random().toString(36).slice(2, 10) };
      setOpen((o) => new Set(o).add(copy.id));
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });
  };
  const add = (type: SectionType) => {
    const s = newSection(type);
    markDirty();
    setSections((prev) => [...prev, s]);
    setOpen((o) => new Set(o).add(s.id));
    setAdding(false);
  };
  const toggle = (id: string) =>
    setOpen((o) => {
      const n = new Set(o);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const remember = (items: { id: number; url: string }[]) =>
    setMediaSrc((m) => ({ ...m, ...Object.fromEntries(items.map((i) => [String(i.id), i.url])) }));

  return (
    <form action={formAction} onInput={markDirty} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <input type="hidden" name="sections" value={JSON.stringify(sections)} />
      <input type="hidden" name="status" value={status} />

      <div className="flex min-w-0 flex-col gap-5">
        <Card title="Page">
          <div className="grid gap-4 md:grid-cols-2">
            <FieldShell id="title" label="Title" required error={errors.title} className="md:col-span-2">
              <input
                id="title"
                name="title"
                defaultValue={v.title}
                maxLength={200}
                className={inputClass}
                onChange={(e) => !slugTouched && setSlug(slugify(e.target.value))}
              />
            </FieldShell>
            <FieldShell id="slug" label="Web address" required error={errors.slug} className="md:col-span-2">
              <div className="flex overflow-hidden rounded-md border border-sand-300 bg-white focus-within:border-forest-900">
                <span className="flex items-center bg-sand-100 px-3 text-[14px] text-ink-muted">wefcanada.org/</span>
                <input
                  id="slug"
                  name="slug"
                  value={slug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                  }}
                  className="min-w-0 flex-1 px-3 py-2 text-[15px] outline-none"
                  spellCheck={false}
                />
              </div>
            </FieldShell>
            <FieldShell id="eyebrow" label="Small heading above the title" error={errors.eyebrow}>
              <input id="eyebrow" name="eyebrow" defaultValue={v.eyebrow} maxLength={120} className={inputClass} />
            </FieldShell>
            <FieldShell id="lede" label="Introduction" error={errors.lede} help="Optional, shown under the title.">
              <textarea id="lede" name="lede" defaultValue={v.lede} rows={2} maxLength={1000} className={inputClass} />
            </FieldShell>
          </div>
        </Card>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-[17px] font-bold text-forest-900">Sections</h2>
            <span className="text-[13px] text-ink-muted">{sections.length} on this page</span>
          </div>

          {sections.length === 0 && (
            <p className="mb-3 rounded-lg border border-dashed border-sand-300 bg-white px-4 py-8 text-center text-[14px] text-ink-muted">
              No sections yet. Add the first one below.
            </p>
          )}

          <ol className="flex flex-col gap-3">
            {sections.map((s, i) => {
              const meta = SECTION_TYPES.find((t) => t.type === s.type)!;
              const isOpen = open.has(s.id);
              return (
                <li key={s.id} className="overflow-hidden rounded-lg border border-sand-200 bg-white shadow-xs">
                  <div className="flex items-center gap-2 border-b border-sand-200 bg-sand-25 px-3 py-2">
                    <button type="button" onClick={() => toggle(s.id)} className="flex min-w-0 flex-1 items-center gap-2 text-left" aria-expanded={isOpen}>
                      <span className="text-[12px] text-ink-muted">{isOpen ? "▾" : "▸"}</span>
                      <Badge value="blog" label={meta.label} />
                      <span className="truncate text-[14px] font-semibold text-forest-900">
                        {"title" in s && s.title ? s.title : s.type === "quote" ? s.quote.slice(0, 60) : ""}
                      </span>
                    </button>
                    <button type="button" className={btn.ghost} onClick={() => move(s.id, -1)} disabled={i === 0} aria-label="Move up">
                      ↑
                    </button>
                    <button type="button" className={btn.ghost} onClick={() => move(s.id, 1)} disabled={i === sections.length - 1} aria-label="Move down">
                      ↓
                    </button>
                    <button type="button" className={btn.ghost} onClick={() => duplicate(s.id)}>
                      Copy
                    </button>
                    <button type="button" className={`${btn.ghost} text-red-800`} onClick={() => remove(s.id)}>
                      Remove
                    </button>
                  </div>
                  {isOpen && (
                    <div className="flex flex-col gap-4 p-4">
                      <SectionFields section={s} update={(p) => update(s.id, p)} mediaSrc={mediaSrc} remember={remember} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>

          <div className="mt-3">
            {adding ? (
              <div className="rounded-lg border border-sand-200 bg-white p-4 shadow-xs">
                <p className="mb-3 text-[14px] font-semibold text-forest-900">Choose a section</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {SECTION_TYPES.map((t) => (
                    <button
                      key={t.type}
                      type="button"
                      onClick={() => add(t.type)}
                      className="rounded-md border border-sand-300 p-3 text-left transition-colors hover:border-forest-900 hover:bg-sand-25"
                    >
                      <span className="block text-[14px] font-semibold text-forest-900">{t.label}</span>
                      <span className="block text-[12px] text-ink-muted">{t.hint}</span>
                    </button>
                  ))}
                </div>
                <button type="button" className={`${btn.ghost} mt-3`} onClick={() => setAdding(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button type="button" className={`${btn.secondary} w-full border-dashed`} onClick={() => setAdding(true)}>
                + Add a section
              </button>
            )}
          </div>
        </div>

        <Card title="Search engines">
          <div className="grid gap-4 md:grid-cols-2">
            <FieldShell id="seo_title" label="Search title" help="Leave empty to use the page title.">
              <input id="seo_title" name="seo_title" defaultValue={v.seo_title} maxLength={200} className={inputClass} />
            </FieldShell>
            <FieldShell id="seo_description" label="Search description" help="Leave empty to use the introduction.">
              <textarea id="seo_description" name="seo_description" defaultValue={v.seo_description} rows={2} maxLength={400} className={inputClass} />
            </FieldShell>
            <label className="flex items-center gap-2 text-[14px] md:col-span-2">
              <input type="checkbox" name="noindex" defaultChecked={v.noindex} className="size-4 accent-forest-900" />
              Hide this page from search engines
            </label>
          </div>
        </Card>
      </div>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <Card title="Publish">
          <div className="grid grid-cols-2 gap-1 rounded-md bg-sand-100 p-1">
            {(["draft", "published"] as const).map((st) => (
              <button
                key={st}
                type="button"
                aria-pressed={status === st}
                onClick={() => {
                  setStatus(st);
                  markDirty();
                }}
                className={`rounded px-2 py-1.5 text-[13px] font-semibold ${status === st ? "bg-white text-forest-900 shadow-sm" : "text-ink-muted"}`}
              >
                {st === "draft" ? "Draft" : "Published"}
              </button>
            ))}
          </div>
          {isNew && canAddToMenu && (
            <label className="mt-3 flex items-center gap-2 text-[13px]">
              <input type="checkbox" name="add_to_menu" className="size-4 accent-forest-900" />
              Add to the main menu
            </label>
          )}
          <div className="mt-4 flex flex-col gap-2">
            <button type="submit" className={btn.primary} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
            {!isNew && (
              <Link href={`/${initial.slug}`} target="_blank" className={btn.secondary}>
                {initial.status === "published" ? "View page ↗" : "Preview ↗"}
              </Link>
            )}
          </div>
          {dirty && <p className="mt-2 text-[12px] font-semibold text-amber-800">Unsaved changes</p>}
        </Card>
        {sidebarExtra}
      </aside>

      <Toast message={toast?.msg} tone={toast?.tone} onClose={dismiss} />
    </form>
  );
}

function SectionFields({
  section: s,
  update,
  mediaSrc,
  remember,
}: {
  section: Section;
  update: (patch: Partial<Section>) => void;
  mediaSrc: Record<string, string>;
  remember: (items: { id: number; url: string }[]) => void;
}) {
  const [picking, setPicking] = useState(false);
  const id = (k: string) => `s-${s.id}-${k}`;

  const heading = s.type !== "quote" && (
    <div className="grid gap-3 md:grid-cols-[1fr_1fr_10rem]">
      <FieldShell id={id("eyebrow")} label="Small heading">
        <input id={id("eyebrow")} value={s.eyebrow ?? ""} onChange={(e) => update({ eyebrow: e.target.value })} className={inputClass} />
      </FieldShell>
      <FieldShell id={id("title")} label="Heading">
        <input id={id("title")} value={s.title ?? ""} onChange={(e) => update({ title: e.target.value })} className={inputClass} />
      </FieldShell>
      <FieldShell id={id("ground")} label="Background">
        <select id={id("ground")} value={s.ground} onChange={(e) => update({ ground: e.target.value as Ground })} className={inputClass}>
          {GROUNDS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
      </FieldShell>
    </div>
  );

  switch (s.type) {
    case "text":
      return (
        <>
          {heading}
          <RichTextEditor id={id("body")} initial={s.body} mediaSrc={mediaSrc} onChange={(body) => update({ body })} />
        </>
      );
    case "imageText":
      return (
        <>
          {heading}
          <div className="grid gap-4 md:grid-cols-[14rem_1fr]">
            <div className="flex flex-col gap-2">
              <div className="flex aspect-4/3 items-center justify-center overflow-hidden rounded-md bg-sand-100">
                {s.mediaId && mediaSrc[String(s.mediaId)] ? (
                  <img src={mediaSrc[String(s.mediaId)]} alt="" className="size-full object-cover" />
                ) : (
                  <span className="text-[12px] text-ink-muted">No image</span>
                )}
              </div>
              <button type="button" className={btn.secondary} onClick={() => setPicking(true)}>
                {s.mediaId ? "Change image" : "Choose image"}
              </button>
              <select value={s.imageSide} onChange={(e) => update({ imageSide: e.target.value as "left" | "right" })} className={inputClass} aria-label="Image position">
                <option value="right">Image on the right</option>
                <option value="left">Image on the left</option>
              </select>
            </div>
            <RichTextEditor id={id("body")} initial={s.body} mediaSrc={mediaSrc} onChange={(body) => update({ body })} />
          </div>
          <MediaDialog
            open={picking}
            onClose={() => setPicking(false)}
            onSelect={(items) => {
              setPicking(false);
              if (items[0]) {
                remember(items);
                update({ mediaId: items[0].id });
              }
            }}
          />
        </>
      );
    case "stats":
      return (
        <>
          {heading}
          <div className="flex gap-4 text-[14px]">
            <label className="flex items-center gap-2">
              <input type="radio" checked={s.source === "site"} onChange={() => update({ source: "site" })} className="accent-forest-900" />
              The home page&apos;s figures (from Figures)
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={s.source === "custom"} onChange={() => update({ source: "custom" })} className="accent-forest-900" />
              Figures for this page only
            </label>
          </div>
          {s.source === "custom" && (
            <ListEditor
              items={s.items}
              blank={{ value: "", label: "", note: "" }}
              onChange={(items) => update({ items })}
              render={(item, set) => (
                <div className="grid flex-1 gap-2 sm:grid-cols-[8rem_1fr_1fr]">
                  <input placeholder="Number" value={item.value} onChange={(e) => set({ ...item, value: e.target.value })} className={inputClass} />
                  <input placeholder="What is counted" value={item.label} onChange={(e) => set({ ...item, label: e.target.value })} className={inputClass} />
                  <input placeholder="Small print (optional)" value={item.note ?? ""} onChange={(e) => set({ ...item, note: e.target.value })} className={inputClass} />
                </div>
              )}
            />
          )}
        </>
      );
    case "gallery":
      return (
        <>
          {heading}
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-6">
            {s.mediaIds.map((mid, i) => (
              <li key={`${mid}-${i}`} className="group relative aspect-square overflow-hidden rounded bg-sand-100">
                {mediaSrc[String(mid)] && <img src={mediaSrc[String(mid)]} alt="" className="size-full object-cover" />}
                <div className="absolute inset-x-0 bottom-0 flex justify-between bg-forest-950/70 px-1 text-[12px] text-white opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                  <button type="button" aria-label="Move earlier" onClick={() => i > 0 && update({ mediaIds: swap(s.mediaIds, i, i - 1) })}>
                    ←
                  </button>
                  <button type="button" onClick={() => update({ mediaIds: s.mediaIds.filter((_, j) => j !== i) })}>
                    Remove
                  </button>
                  <button type="button" aria-label="Move later" onClick={() => i < s.mediaIds.length - 1 && update({ mediaIds: swap(s.mediaIds, i, i + 1) })}>
                    →
                  </button>
                </div>
              </li>
            ))}
            <li>
              <button type="button" onClick={() => setPicking(true)} className="flex aspect-square w-full items-center justify-center rounded border-2 border-dashed border-sand-300 text-[13px] font-semibold text-forest-900 hover:border-forest-900">
                + Add photos
              </button>
            </li>
          </ul>
          <MediaDialog
            open={picking}
            multiple
            onClose={() => setPicking(false)}
            onSelect={(items) => {
              setPicking(false);
              remember(items);
              update({ mediaIds: [...s.mediaIds, ...items.map((m) => m.id)] });
            }}
          />
        </>
      );
    case "videos":
      return (
        <>
          {heading}
          {(
            <ListEditor
              items={s.items}
              blank={{ title: "", url: "" }}
              onChange={(items) => update({ items })}
              render={(item, set) => (
                <div className="grid flex-1 gap-2 sm:grid-cols-2">
                  <input placeholder="Title" value={item.title} onChange={(e) => set({ ...item, title: e.target.value })} className={inputClass} />
                  <input placeholder="YouTube link" value={item.url} onChange={(e) => set({ ...item, url: e.target.value })} className={inputClass} />
                </div>
              )}
            />
          )}
        </>
      );
    case "projects":
      return (
        <>
          {heading}
          <p className="text-[13px] text-ink-muted">Shows a card for every published Active Project, newest first.</p>
        </>
      );
    case "posts":
      return (
        <>
          {heading}
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldShell id={id("section")} label="Which posts">
              <select id={id("section")} value={s.section} onChange={(e) => update({ section: e.target.value as "all" | "update" | "story" })} className={inputClass}>
                <option value="all">Project updates and success stories</option>
                <option value="update">Project updates</option>
                <option value="story">Success stories</option>
              </select>
            </FieldShell>
            <FieldShell id={id("limit")} label="How many">
              <input id={id("limit")} type="number" min={1} max={12} value={s.limit} onChange={(e) => update({ limit: Number(e.target.value) || 3 })} className={inputClass} />
            </FieldShell>
          </div>
        </>
      );
    case "quote":
      return (
        <div className="grid gap-3">
          <FieldShell id={id("quote")} label="Quote">
            <textarea id={id("quote")} rows={3} value={s.quote} onChange={(e) => update({ quote: e.target.value })} className={inputClass} />
          </FieldShell>
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <FieldShell id={id("attribution")} label="Who said it">
              <input id={id("attribution")} value={s.attribution ?? ""} onChange={(e) => update({ attribution: e.target.value })} className={inputClass} />
            </FieldShell>
            <FieldShell id={id("ground")} label="Background">
              <select id={id("ground")} value={s.ground} onChange={(e) => update({ ground: e.target.value as Ground })} className={inputClass}>
                {GROUNDS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </FieldShell>
          </div>
        </div>
      );
    case "cta":
      return (
        <div className="grid gap-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <FieldShell id={id("eyebrow")} label="Small heading">
              <input id={id("eyebrow")} value={s.eyebrow ?? ""} placeholder="Get involved" onChange={(e) => update({ eyebrow: e.target.value })} className={inputClass} />
            </FieldShell>
            <FieldShell id={id("title")} label="Heading">
              <input id={id("title")} value={s.title ?? ""} onChange={(e) => update({ title: e.target.value })} className={inputClass} />
            </FieldShell>
          </div>
          <FieldShell id={id("body")} label="Text">
            <textarea id={id("body")} rows={2} value={s.body ?? ""} onChange={(e) => update({ body: e.target.value })} className={inputClass} />
          </FieldShell>
          <div className="grid gap-3 sm:grid-cols-2">
            <input aria-label="Button label" placeholder="Button label" value={s.actionLabel} onChange={(e) => update({ actionLabel: e.target.value })} className={inputClass} />
            <input aria-label="Button link" placeholder="/contact" value={s.actionHref} onChange={(e) => update({ actionHref: e.target.value })} className={inputClass} />
            <input aria-label="Second button label" placeholder="Second button (optional)" value={s.secondaryLabel ?? ""} onChange={(e) => update({ secondaryLabel: e.target.value })} className={inputClass} />
            <input aria-label="Second button link" placeholder="/projects" value={s.secondaryHref ?? ""} onChange={(e) => update({ secondaryHref: e.target.value })} className={inputClass} />
          </div>
        </div>
      );
  }
}

function swap<T>(list: T[], a: number, b: number): T[] {
  const next = [...list];
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}

function ListEditor<T>({
  items,
  blank,
  onChange,
  render,
}: {
  items: T[];
  blank: T;
  onChange: (items: T[]) => void;
  render: (item: T, set: (item: T) => void) => React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      {items.map((item, i) => (
        <div key={i} className="flex items-start gap-2">
          {render(item, (next) => onChange(items.map((x, j) => (j === i ? next : x))))}
          <button type="button" className={btn.ghost} onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove">
            ×
          </button>
        </div>
      ))}
      <button type="button" className={`${btn.secondary} self-start`} onClick={() => onChange([...items, structuredClone(blank)])}>
        + Add
      </button>
    </div>
  );
}
