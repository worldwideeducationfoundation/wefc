"use client";

/* eslint-disable @next/next/no-img-element -- admin thumbnails are plain <img>s: they are already small WebP files and do not need the optimiser. */
import { useCallback, useEffect, useRef, useState } from "react";
import { btn, inputClass } from "./ui";

export type PickedMedia = { id: number; url: string; alt: string; width?: number | null; height?: number | null; name?: string | null };

/** Uploads files to the media library; returns what was stored and any per-file errors. */
export async function uploadFiles(files: File[], alt?: string): Promise<{ items: PickedMedia[]; errors: string[] }> {
  const body = new FormData();
  for (const f of files) body.append("files", f);
  if (alt) body.append("alt", alt);
  const res = await fetch("/admin/api/media", { method: "POST", body });
  const data = await res.json().catch(() => ({}));
  return { items: data.items ?? [], errors: data.errors ?? (data.error ? [data.error] : res.ok ? [] : ["Upload failed."]) };
}

/**
 * The media library in a dialog: search, upload (button or drag and drop),
 * and pick one image — or several, for galleries.
 */
type DialogProps = {
  open: boolean;
  multiple?: boolean;
  onClose: () => void;
  onSelect: (items: PickedMedia[]) => void;
};

/** Mounted only while open, so every opening starts with a fresh selection. */
export function MediaDialog(props: DialogProps) {
  return props.open ? <MediaDialogBody {...props} /> : null;
}

function MediaDialogBody({ multiple = false, onClose, onSelect }: DialogProps) {
  const [items, setItems] = useState<PickedMedia[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [selected, setSelected] = useState<PickedMedia[]>([]);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (query: string, p: number) => {
    try {
      const res = await fetch(`/admin/api/media?q=${encodeURIComponent(query)}&page=${p}`);
      const data = await res.json();
      setItems((prev) => (p === 1 ? data.items : [...prev, ...data.items]));
      setTotal(data.total);
      setPage(p);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const focus = setTimeout(() => searchRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(focus);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Loads the first page on opening, and again (debounced) as the search changes.
  useEffect(() => {
    const t = setTimeout(() => load(q, 1), q ? 250 : 0);
    return () => clearTimeout(t);
  }, [q, load]);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    setErrors([]);
    const result = await uploadFiles(files);
    setUploading(false);
    setErrors(result.errors);
    if (result.items.length) {
      setItems((prev) => [...result.items, ...prev]);
      setTotal((t) => t + result.items.length);
      setSelected((prev) => (multiple ? [...prev, ...result.items] : result.items.slice(0, 1)));
    }
  };

  const toggle = (item: PickedMedia) => {
    setSelected((prev) => {
      const has = prev.some((p) => p.id === item.id);
      if (!multiple) return has ? [] : [item];
      return has ? prev.filter((p) => p.id !== item.id) : [...prev, item];
    });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-3 md:p-8" role="dialog" aria-modal="true" aria-label="Media library">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-forest-950/60" onClick={onClose} />
      <div
        className={`relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl ${dragging ? "ring-4 ring-lime-500" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          upload([...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")));
        }}
      >
        <div className="flex flex-wrap items-center gap-3 border-b border-sand-200 px-5 py-3">
          <h2 className="mr-auto text-[17px] font-bold text-forest-900">Media library</h2>
          <input
            ref={searchRef}
            type="search"
            placeholder="Search by description or file name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className={`${inputClass} max-w-xs`}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              upload([...(e.target.files ?? [])]);
              e.target.value = "";
            }}
          />
          <button type="button" className={btn.lime} onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? "Uploading…" : "Upload new"}
          </button>
        </div>

        {errors.length > 0 && (
          <div className="border-b border-red-200 bg-red-50 px-5 py-2 text-[13px] text-red-900">
            {errors.map((e) => (
              <p key={e}>{e}</p>
            ))}
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5">
          {items.length === 0 && !loading ? (
            <p className="py-16 text-center text-[14px] text-ink-muted">
              {q ? "No images match that search." : "No images yet. Upload one, or drag files onto this window."}
            </p>
          ) : (
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
              {items.map((item) => {
                const isSel = selected.some((s) => s.id === item.id);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => toggle(item)}
                      onDoubleClick={() => !multiple && onSelect([item])}
                      aria-pressed={isSel}
                      title={item.alt || item.name || ""}
                      className={`group relative block aspect-square w-full overflow-hidden rounded-md bg-sand-100 ring-offset-2 ${
                        isSel ? "ring-4 ring-lime-500" : "hover:ring-2 hover:ring-forest-900"
                      }`}
                    >
                      {item.url.endsWith(".pdf") ? <span className="grid size-full min-h-24 place-items-center text-[13px] font-semibold text-forest-900">PDF</span> : <img src={item.url} alt={item.alt} loading="lazy" className="size-full object-cover" />}
                      {isSel && (
                        <span className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-lime-500 text-[13px] font-bold text-forest-950">
                          ✓
                        </span>
                      )}
                    </button>
                    <p className="mt-1 truncate text-[12px] text-ink-muted">{item.alt || item.name}</p>
                  </li>
                );
              })}
            </ul>
          )}
          {items.length < total && (
            <div className="mt-5 text-center">
              <button
                type="button"
                className={btn.secondary}
                disabled={loading}
                onClick={() => {
                  setLoading(true);
                  load(q, page + 1);
                }}
              >
                {loading ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-sand-200 bg-sand-50 px-5 py-3">
          <p className="text-[13px] text-ink-muted">
            {selected.length ? `${selected.length} selected` : "Drag images here to upload them."}
          </p>
          <div className="flex gap-2">
            <button type="button" className={btn.secondary} onClick={onClose}>
              Cancel
            </button>
            <button type="button" className={btn.primary} disabled={!selected.length} onClick={() => onSelect(selected)}>
              {multiple ? `Add ${selected.length || ""} image${selected.length === 1 ? "" : "s"}` : "Use this image"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A form field holding one media id, with a thumbnail and Choose / Remove. */
export function MediaField({
  id,
  name,
  initial,
  invalid,
}: {
  id: string;
  name: string;
  initial: PickedMedia | null;
  invalid?: boolean;
}) {
  const [value, setValue] = useState<PickedMedia | null>(initial);
  const [open, setOpen] = useState(false);

  return (
    <div className={`flex items-center gap-4 rounded-md border bg-white p-3 ${invalid ? "border-red-700" : "border-sand-300"}`}>
      <input type="hidden" name={name} value={value?.id ?? ""} />
      <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded bg-sand-100">
        {value ? (
          value.url.endsWith(".pdf") ? (
            <span className="grid size-full place-items-center text-[13px] font-semibold text-forest-900">PDF</span>
          ) : (
            <img src={value.url} alt={value.alt} className="size-full object-cover" />
          )
        ) : (
          <span className="text-[12px] text-ink-muted">No image</span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        {value && <p className="truncate text-[13px] text-ink-muted">{value.alt || value.name}</p>}
        <div className="flex flex-wrap gap-2">
          <button id={id} type="button" className={btn.secondary} onClick={() => setOpen(true)}>
            {value ? "Change" : "Choose image"}
          </button>
          {value && (
            <button type="button" className={btn.ghost} onClick={() => setValue(null)}>
              Remove
            </button>
          )}
        </div>
      </div>
      <MediaDialog
        open={open}
        onClose={() => setOpen(false)}
        onSelect={(items) => {
          setValue(items[0] ?? null);
          setOpen(false);
        }}
      />
    </div>
  );
}
