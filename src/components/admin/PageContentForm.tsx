"use client";

import { useActionState, useState } from "react";
import { Toast, useActionFeedback } from "./client";
import { MediaField, type PickedMedia } from "./MediaPicker";
import { Card, FieldShell, btn, inputClass } from "./ui";

type Result = { ok: boolean; message?: string; errors?: Record<string, string>; values?: Record<string, unknown> };
type Block = {
  key: string;
  label: string;
  type: "text" | "textarea" | "paragraphs" | "image" | "toggle" | "order";
  default: string;
  help?: string;
  group: string;
  options?: { value: string; label: string }[];
};

/** Reorders a list of sections with up/down buttons; the order is kept in a hidden input. */
function OrderEditor({
  id,
  value,
  options,
  disabled,
  onChange,
}: {
  id: string;
  value: string;
  options: { value: string; label: string }[];
  disabled: boolean;
  onChange: () => void;
}) {
  const known = options.map((o) => o.value);
  const initial = [...new Set([...value.split(",").filter((k) => known.includes(k)), ...known])];
  const [order, setOrder] = useState(initial);
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
    onChange();
  };
  return (
    <div>
      <input type="hidden" id={id} name={id} value={order.join(",")} />
      <ol className="flex flex-col gap-1.5">
        {order.map((key, i) => (
          <li key={key} className="flex items-center gap-2 rounded-md border border-sand-200 bg-white px-3 py-2 text-[14px]">
            <span className="w-6 text-[12px] font-semibold text-ink-muted">{i + 1}</span>
            <span className="flex-1 font-semibold text-forest-900">{options.find((o) => o.value === key)?.label ?? key}</span>
            <button type="button" className={btn.ghost} disabled={disabled || i === 0} onClick={() => move(i, -1)} aria-label="Move up">
              ↑
            </button>
            <button type="button" className={btn.ghost} disabled={disabled || i === order.length - 1} onClick={() => move(i, 1)} aria-label="Move down">
              ↓
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PageContentForm({
  blocks,
  stored,
  media,
  canDisable,
  hasPath,
  enabled,
  seo,
  seoDefaults,
  canEdit,
  action,
}: {
  blocks: Block[];
  stored: Record<string, string>;
  media: Record<string, PickedMedia>;
  canDisable: boolean;
  hasPath: boolean;
  enabled: boolean;
  seo: { title: string; description: string };
  seoDefaults: { title: string; description: string };
  canEdit: boolean;
  action: (prev: Result, form: FormData) => Promise<Result>;
}) {
  const [state, formAction, pending] = useActionState(action, { ok: true });
  const { toast, dismiss, markDirty } = useActionFeedback(state);

  const values = (state.values as Record<string, string> | undefined) ?? undefined;
  const valueOf = (b: Block) => values?.[b.key] ?? stored[b.key] ?? b.default;

  const groups = new Map<string, Block[]>();
  for (const b of blocks) groups.set(b.group, [...(groups.get(b.group) ?? []), b]);

  return (
    <form action={formAction} onInput={markDirty} className="flex flex-col gap-5">
      {hasPath && (
        <Card title="Page">
          <div className="grid gap-4 md:grid-cols-2">
            {canDisable && (
              <label className="flex items-start gap-3 md:col-span-2">
                <input type="checkbox" name="is_enabled" defaultChecked={enabled} className="mt-1 size-4 accent-forest-900" disabled={!canEdit} />
                <span>
                  <span className="block text-[14px] font-semibold text-forest-900">Page is switched on</span>
                  <span className="block text-[13px] text-ink-muted">
                    Switched off, the page shows “Page not found” and its links disappear from the menus.
                  </span>
                </span>
              </label>
            )}
            <FieldShell id="seo_title" label="Search title" help={`Leave empty for “${seoDefaults.title}”.`}>
              <input id="seo_title" name="seo_title" defaultValue={seo.title} maxLength={200} className={inputClass} disabled={!canEdit} />
            </FieldShell>
            <FieldShell id="seo_description" label="Search description" help="Leave empty for the original description.">
              <textarea
                id="seo_description"
                name="seo_description"
                rows={2}
                defaultValue={seo.description}
                placeholder={seoDefaults.description}
                maxLength={400}
                className={inputClass}
                disabled={!canEdit}
              />
            </FieldShell>
          </div>
        </Card>
      )}

      {[...groups.entries()].map(([group, list]) => (
        <Card key={group || "main"} title={group || "Text"}>
          <div className="flex flex-col gap-5">
            {list.map((b) => {
              const id = `block_${b.key}`;
              const v = valueOf(b);
              const changed = (stored[b.key] ?? "") !== "" && stored[b.key] !== b.default;
              const help = (
                <>
                  {b.help && <span className="block">{b.help}</span>}
                  {changed && !["image", "toggle", "order"].includes(b.type) && (
                    <button
                      type="button"
                      className="mt-1 font-semibold text-forest-900 underline underline-offset-2"
                      onClick={() => {
                        const el = document.getElementById(id) as HTMLInputElement | HTMLTextAreaElement | null;
                        if (el) {
                          el.value = b.default;
                          markDirty();
                        }
                      }}
                    >
                      Reset to the original wording
                    </button>
                  )}
                </>
              );
              return (
                b.type === "toggle" ? (
                  <label key={b.key} className="flex items-center gap-3 rounded-md border border-sand-200 bg-white px-3 py-2.5">
                    <input
                      type="checkbox"
                      id={id}
                      name={id}
                      defaultChecked={v !== "0"}
                      disabled={!canEdit}
                      className="size-4 accent-forest-900"
                    />
                    <span className="text-[14px] font-semibold text-forest-900">{b.label}</span>
                  </label>
                ) : (
                <FieldShell key={b.key} id={id} label={b.label} help={help} error={state.errors?.[b.key]}>
                  {b.type === "order" ? (
                    <OrderEditor id={id} value={v} options={b.options ?? []} disabled={!canEdit} onChange={markDirty} />
                  ) : b.type === "image" ? (
                    <MediaField id={id} name={id} initial={media[v] ?? null} />
                  ) : b.type === "text" ? (
                    <input id={id} name={id} defaultValue={v} className={inputClass} disabled={!canEdit} />
                  ) : (
                    <textarea
                      id={id}
                      name={id}
                      defaultValue={v}
                      rows={b.type === "paragraphs" ? 12 : 3}
                      className={inputClass}
                      disabled={!canEdit}
                    />
                  )}
                  {b.type === "paragraphs" && (
                    <p className="mt-1 text-[12px] text-ink-muted">Leave a blank line between paragraphs.</p>
                  )}
                </FieldShell>
                )
              );
            })}
          </div>
        </Card>
      ))}

      {canEdit && (
        <div className="sticky bottom-4 z-10 flex justify-end">
          <button type="submit" className={`${btn.primary} shadow-lg`} disabled={pending}>
            {pending ? "Saving…" : "Save changes"}
          </button>
        </div>
      )}
      <Toast message={toast?.msg} tone={toast?.tone} onClose={dismiss} />
    </form>
  );
}
