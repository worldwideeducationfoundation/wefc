"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState } from "react";
import type { FieldDef, FieldOptions } from "@/lib/admin-fields";
import { slugify } from "@/lib/admin-fields";
import { parseRichDoc } from "@/lib/richtext";
import { SubmitButton, Toast, useActionFeedback, useHydrated } from "./client";
import { MediaField, type PickedMedia } from "./MediaPicker";
import { RichTextEditor } from "./RichTextEditor";
import { Badge, Card, FieldShell, btn, inputClass } from "./ui";

type Result = { ok: boolean; message?: string; errors?: Record<string, string>; values?: Record<string, unknown> };

export type ResourceFormProps = {
  fields: FieldDef[];
  initial: Record<string, unknown>;
  options: FieldOptions;
  media: Record<string, PickedMedia>;
  richMediaSrc: Record<string, string>;
  programs: { slug: string; title: string }[];
  isNew: boolean;
  label: string;
  publicHref: string | null;
  action: (prev: Result, form: FormData) => Promise<Result>;
  sidebarExtra?: React.ReactNode;
  updatedAt?: string | null;
};

const asString = (v: unknown) => (v === null || v === undefined ? "" : String(v));

/** Local "YYYY-MM-DDTHH:mm" for a datetime-local input. */
function toLocalInput(value: unknown) {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type DateTimeProps = { id: string; name: string; value: unknown; invalid: boolean };

/** Rendered only in the browser: the editor's time zone is only known there. */
function DateTimeInput(props: DateTimeProps) {
  const hydrated = useHydrated();
  return hydrated ? <DateTimeInputClient {...props} /> : <input className={inputClass} disabled aria-label="Loading date" />;
}

function DateTimeInputClient({ id, name, value, invalid }: DateTimeProps) {
  const [local, setLocal] = useState(() => toLocalInput(value ?? new Date().toISOString()));
  const tz = new Date().getTimezoneOffset();
  return (
    <>
      <input
        id={id}
        name={name}
        type="datetime-local"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        aria-invalid={invalid || undefined}
        className={inputClass}
      />
      <input type="hidden" name={`${name}__tz`} value={tz} />
    </>
  );
}

function SlugInput({
  id,
  name,
  value,
  from,
  prefix,
  isNew,
  invalid,
}: {
  id: string;
  name: string;
  value: string;
  from: string;
  prefix: string;
  isNew: boolean;
  invalid: boolean;
}) {
  const [slug, setSlug] = useState(value);
  const touched = useRef(!isNew || value !== "");

  // Follows the title as it is typed, until the address is edited by hand.
  useEffect(() => {
    const source = document.getElementById(`f-${from}`) as HTMLInputElement | null;
    if (!source) return;
    const onInput = () => {
      if (!touched.current) setSlug(slugify(source.value));
    };
    source.addEventListener("input", onInput);
    return () => source.removeEventListener("input", onInput);
  }, [from]);

  return (
    <div className="flex items-stretch overflow-hidden rounded-md border border-sand-300 bg-white focus-within:border-forest-900 focus-within:ring-2 focus-within:ring-forest-900/15">
      <span className="flex items-center bg-sand-100 px-3 text-[14px] text-ink-muted">{prefix}</span>
      <input
        id={id}
        name={name}
        value={slug}
        onChange={(e) => {
          touched.current = true;
          setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"));
        }}
        aria-invalid={invalid || undefined}
        className="min-w-0 flex-1 px-3 py-2 text-[15px] outline-none"
        spellCheck={false}
      />
    </div>
  );
}

function Field({
  f,
  value,
  error,
  props,
}: {
  f: FieldDef;
  value: unknown;
  error?: string;
  props: Pick<ResourceFormProps, "options" | "media" | "richMediaSrc" | "programs" | "isNew">;
}) {
  const id = `f-${f.name}`;
  const invalid = Boolean(error);
  const common = { id, name: f.name, "aria-invalid": invalid || undefined, "aria-describedby": invalid ? `${id}-error` : undefined };

  let control: React.ReactNode;
  switch (f.type) {
    case "text":
      control = <input {...common} defaultValue={asString(value)} maxLength={f.maxLength} placeholder={f.placeholder} className={inputClass} />;
      break;
    case "url":
      control = <input {...common} type="url" defaultValue={asString(value)} placeholder={f.placeholder ?? "https://"} className={inputClass} />;
      break;
    case "textarea":
    case "lines":
      control = <textarea {...common} defaultValue={asString(value)} rows={f.rows ?? 3} maxLength={f.maxLength} className={inputClass} />;
      break;
    case "number":
      control = <input {...common} type="number" defaultValue={asString(value)} className={inputClass} />;
      break;
    case "date": {
      const v = value instanceof Date ? value.toISOString().slice(0, 10) : asString(value).slice(0, 10);
      control = <input {...common} type="date" defaultValue={v} className={inputClass} />;
      break;
    }
    case "datetime":
      control = <DateTimeInput id={id} name={f.name} value={value} invalid={invalid} />;
      break;
    case "slug":
      control = (
        <SlugInput id={id} name={f.name} value={asString(value)} from={f.from} prefix={f.prefix} isNew={props.isNew} invalid={invalid} />
      );
      break;
    case "toggle":
      return (
        <label className={`flex items-start gap-3 rounded-md border border-sand-200 bg-white px-3 py-2.5 ${f.half ? "" : "md:col-span-2"}`}>
          <input
            type="checkbox"
            name={f.name}
            defaultChecked={Boolean(Number(value))}
            className="mt-0.5 size-4 accent-forest-900"
          />
          <span>
            <span className="block text-[14px] font-semibold text-forest-900">{f.label}</span>
            {f.help && <span className="block text-[13px] text-ink-muted">{f.help}</span>}
          </span>
        </label>
      );
    case "richtext":
      control = (
        <RichTextEditor id={id} name={f.name} initial={parseRichDoc(value)} mediaSrc={props.richMediaSrc} invalid={invalid} />
      );
      break;
    case "media":
      control = <MediaField id={id} name={f.name} initial={props.media[asString(value)] ?? null} invalid={invalid} />;
      break;
    case "youtube":
      control = (
        <input
          {...common}
          defaultValue={value ? (String(value).length === 11 ? `https://www.youtube.com/watch?v=${value}` : String(value)) : ""}
          placeholder="https://www.youtube.com/watch?v=…"
          className={inputClass}
        />
      );
      break;
    case "select": {
      const options = f.options ?? (f.optionsFrom ? props.options[f.optionsFrom] : []) ?? [];
      control = (
        <select {...common} defaultValue={asString(value)} className={inputClass}>
          {(f.allowEmpty !== undefined || !value) && <option value="">{f.allowEmpty ?? "Choose…"}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      );
      break;
    }
    case "relation": {
      const options = props.options[f.optionsFrom] ?? [];
      const picked = new Set(Array.isArray(value) ? value.map(String) : []);
      control = options.length ? (
        <div className="flex flex-wrap gap-2 rounded-md border border-sand-300 bg-white p-3">
          {options.map((o) => (
            <label key={o.value} className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-sand-300 px-3 py-1 text-[14px] has-[:checked]:border-forest-900 has-[:checked]:bg-forest-900 has-[:checked]:text-white">
              <input type="checkbox" name={f.name} value={o.value} defaultChecked={picked.has(o.value)} className="sr-only" />
              {o.label}
            </label>
          ))}
        </div>
      ) : (
        <p className="text-[14px] text-ink-muted">None yet.</p>
      );
      break;
    }
    case "placements": {
      const picked = new Set(Array.isArray(value) ? value.map(String) : asString(value).split(",").filter(Boolean));
      const choices = [
        { value: "home", label: "Home, About & Projects figures" },
        { value: "ticker", label: "Scrolling ticker" },
        ...props.programs.map((p) => ({ value: `program:${p.slug}`, label: `Project: ${p.title}` })),
      ];
      control = (
        <div className="grid gap-1.5 rounded-md border border-sand-300 bg-white p-3 sm:grid-cols-2">
          {choices.map((c) => (
            <label key={c.value} className="flex items-center gap-2 text-[14px]">
              <input type="checkbox" name={f.name} value={c.value} defaultChecked={picked.has(c.value)} className="size-4 accent-forest-900" />
              {c.label}
            </label>
          ))}
        </div>
      );
      break;
    }
  }

  const wide = f.type === "richtext" || !f.half;
  return (
    <FieldShell id={id} label={f.label} help={f.help} error={error} required={f.required} className={wide ? "md:col-span-2" : ""}>
      {control}
    </FieldShell>
  );
}

export function ResourceForm(props: ResourceFormProps) {
  const [state, action, pending] = useActionState(props.action, { ok: true });
  const { toast, dismiss, markDirty, dirty } = useActionFeedback(state);

  const values = { ...props.initial, ...(state.values ?? {}) };
  const errors = state.errors ?? {};
  const status = asString(values.status) === "published" ? "published" : "draft";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
      <form
        id="resource-form"
        action={action}
        onInput={markDirty}
        className="min-w-0"
      >
        <Card>
          <div className="grid gap-5 md:grid-cols-2">
            {props.fields.map((f) => (
              <Field key={f.name} f={f} value={values[f.name]} error={errors[f.name]} props={props} />
            ))}
          </div>
        </Card>

        {/* The status lives in the sidebar but belongs to this form. */}
        <input type="hidden" name="status" id="status-input" defaultValue={status} />
      </form>

      <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
        <Card title="Publish">
          <StatusPicker initial={status} onChange={markDirty} />
          <div className="mt-4 flex flex-col gap-2">
            <button type="submit" form="resource-form" className={btn.primary} disabled={pending}>
              {pending ? "Saving…" : "Save"}
            </button>
            {props.publicHref && !props.isNew && (
              <Link href={props.publicHref} target="_blank" className={btn.secondary}>
                {status === "published" ? "View on site ↗" : "Preview ↗"}
              </Link>
            )}
          </div>
          {props.updatedAt && <p className="mt-3 text-[12px] text-ink-muted">Last saved {props.updatedAt}</p>}
          {dirty && <p className="mt-2 text-[12px] font-semibold text-amber-800">Unsaved changes</p>}
        </Card>
        {props.sidebarExtra}
      </aside>

      <Toast message={toast?.msg} tone={toast?.tone} onClose={dismiss} />
    </div>
  );
}

function StatusPicker({ initial, onChange }: { initial: "draft" | "published"; onChange: () => void }) {
  const [status, setStatus] = useState(initial);
  useEffect(() => {
    const input = document.getElementById("status-input") as HTMLInputElement | null;
    if (input) input.value = status;
  }, [status]);
  return (
    <fieldset>
      <legend className="sr-only">Status</legend>
      <div className="grid grid-cols-2 gap-1 rounded-md bg-sand-100 p-1">
        {(["draft", "published"] as const).map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={status === s}
            onClick={() => {
              setStatus(s);
              onChange();
            }}
            className={`rounded px-2 py-1.5 text-[13px] font-semibold ${
              status === s ? "bg-white text-forest-900 shadow-sm" : "text-ink-muted hover:text-forest-900"
            }`}
          >
            {s === "draft" ? "Draft" : "Published"}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-ink-muted">
        <Badge value={status} />{" "}
        {status === "published" ? "Visible on the website once saved." : "Only visible here in the admin."}
      </p>
    </fieldset>
  );
}

export { SubmitButton };
