"use client";

/* eslint-disable @next/next/no-img-element -- library thumbnails */
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { deleteMedia, getUsage, updateMediaDetails } from "@/app/admin/(panel)/media/actions";
import { Toast } from "./client";
import { type PickedMedia, uploadFiles } from "./MediaPicker";
import { FieldShell, btn, inputClass } from "./ui";

type Item = PickedMedia & { caption?: string | null };

/**
 * The media library page: every image on the site, uploaded once and used
 * anywhere. Edit an image's description in one place and every page using it
 * updates; replace the file and every page shows the new one.
 */
export function MediaLibrary({ canUpload, canDelete }: { canUpload: boolean; canDelete: boolean }) {
  const [items, setItems] = useState<Item[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Item | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const flash = (msg: string, ok = true) => {
    setToast({ msg, tone: ok ? "success" : "error" });
    setTimeout(() => setToast(null), 5000);
  };

  const load = useCallback(async (query: string, p: number) => {
    const res = await fetch(`/admin/api/media?q=${encodeURIComponent(query)}&page=${p}`);
    const data = await res.json();
    setItems((prev) => (p === 1 ? data.items : [...prev, ...data.items]));
    setTotal(data.total);
    setPage(p);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => load(q, 1), 250);
    return () => clearTimeout(t);
  }, [q, load]);

  const upload = async (files: File[]) => {
    if (!files.length) return;
    setUploading(true);
    const result = await uploadFiles(files);
    setUploading(false);
    if (result.items.length) {
      setItems((prev) => [...result.items, ...prev]);
      setTotal((t) => t + result.items.length);
      flash(`${result.items.length} image${result.items.length === 1 ? "" : "s"} uploaded.`);
    }
    if (result.errors.length) flash(result.errors.join(" "), false);
  };

  return (
    <div
      onDragOver={(e) => {
        if (!canUpload) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!canUpload) return;
        e.preventDefault();
        setDragging(false);
        upload([...e.dataTransfer.files].filter((f) => f.type.startsWith("image/")));
      }}
      className={dragging ? "rounded-lg ring-4 ring-lime-500" : ""}
    >
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by description or file name…" className={`${inputClass} max-w-sm`} />
        <span className="text-[13px] text-ink-muted">{total} images</span>
        {canUpload && (
          <>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif,application/pdf"
              className="hidden"
              onChange={(e) => {
                upload([...(e.target.files ?? [])]);
                e.target.value = "";
              }}
            />
            <button type="button" className={`${btn.lime} ml-auto`} onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? "Uploading…" : "Upload images"}
            </button>
          </>
        )}
      </div>
      {canUpload && (
        <p className="mb-4 text-[13px] text-ink-muted">
          Drag photographs anywhere on this page to upload them. They are resized and compressed automatically — upload
          the best quality you have.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => setActive(item)}
              className="group block w-full text-left"
            >
              <span className="block aspect-square overflow-hidden rounded-md bg-sand-100 ring-forest-900 group-hover:ring-2">
                {item.url.endsWith(".pdf") ? <span className="grid size-full min-h-24 place-items-center text-[13px] font-semibold text-forest-900">PDF</span> : <img src={item.url} alt={item.alt} loading="lazy" className="size-full object-cover" />}
              </span>
              <span className={`mt-1 block truncate text-[12px] ${item.alt ? "text-ink-muted" : "font-semibold text-amber-800"}`}>
                {item.alt || "No description"}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {items.length < total && (
        <div className="mt-5 text-center">
          <button type="button" className={btn.secondary} onClick={() => load(q, page + 1)}>
            Load more
          </button>
        </div>
      )}

      {active && (
        <MediaDetails
          key={active.id}
          item={active}
          canUpload={canUpload}
          canDelete={canDelete}
          onClose={() => setActive(null)}
          onChange={(next) => {
            setItems((prev) => prev.map((i) => (i.id === next.id ? { ...i, ...next } : i)));
            setActive((a) => (a ? { ...a, ...next } : a));
          }}
          onDeleted={(id) => {
            setItems((prev) => prev.filter((i) => i.id !== id));
            setTotal((t) => t - 1);
            setActive(null);
          }}
          flash={flash}
        />
      )}
      <Toast message={toast?.msg} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}

function MediaDetails({
  item,
  canUpload,
  canDelete,
  onClose,
  onChange,
  onDeleted,
  flash,
}: {
  item: Item;
  canUpload: boolean;
  canDelete: boolean;
  onClose: () => void;
  onChange: (i: Partial<Item> & { id: number }) => void;
  onDeleted: (id: number) => void;
  flash: (msg: string, ok?: boolean) => void;
}) {
  const [alt, setAlt] = useState(item.alt);
  const [caption, setCaption] = useState(item.caption ?? "");
  const [usage, setUsage] = useState<{ label: string; href: string }[] | null>(null);
  const [confirmUsage, setConfirmUsage] = useState<{ label: string; href: string }[] | null>(null);
  const [pending, start] = useTransition();
  const replaceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getUsage(item.id).then(setUsage);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [item.id, onClose]);

  const save = () =>
    start(async () => {
      const res = await updateMediaDetails(item.id, alt, caption);
      flash(res.message ?? "", res.ok);
      if (res.ok) onChange({ id: item.id, alt, caption });
    });

  const replace = async (file: File) => {
    const body = new FormData();
    body.append("replace", String(item.id));
    body.append("file", file);
    const res = await fetch("/admin/api/media", { method: "POST", body });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.url) {
      onChange({ id: item.id, url: data.url });
      flash("Image replaced everywhere it is used.");
    } else flash(data.error ?? "Could not replace the image.", false);
  };

  const remove = (force: boolean) =>
    start(async () => {
      const res = await deleteMedia(item.id, force);
      if (res.ok) {
        flash("Image deleted.");
        onDeleted(item.id);
      } else if (res.usage) setConfirmUsage(res.usage);
      else flash(res.message ?? "Could not delete.", false);
    });

  return (
    <div className="fixed inset-0 z-[70] flex justify-end" role="dialog" aria-modal="true" aria-label="Image details">
      <button type="button" aria-label="Close" className="absolute inset-0 bg-forest-950/50" onClick={onClose} />
      <div className="relative flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-sand-200 px-5 py-3">
          <h2 className="text-[16px] font-bold text-forest-900">Image details</h2>
          <button type="button" className={btn.ghost} onClick={onClose}>
            Close
          </button>
        </div>
        <div className="flex flex-col gap-4 p-5">
          {item.url.endsWith(".pdf") ? <span className="grid size-full min-h-24 place-items-center text-[13px] font-semibold text-forest-900">PDF</span> : <img src={item.url} alt={item.alt} className="max-h-72 w-full rounded-md bg-sand-100 object-contain" />}
          <p className="text-[12px] text-ink-muted">
            {item.name} · {item.width}×{item.height}px ·{" "}
            <a href={item.url} target="_blank" rel="noopener" className="underline">
              open full size
            </a>
          </p>

          <FieldShell id="m-alt" label="Description (alt text)" help="What the photo shows, for people who cannot see it and for search engines.">
            <textarea id="m-alt" rows={2} value={alt} onChange={(e) => setAlt(e.target.value)} maxLength={300} className={inputClass} disabled={!canUpload} />
          </FieldShell>
          <FieldShell id="m-caption" label="Caption" help="Optional default caption.">
            <input id="m-caption" value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={300} className={inputClass} disabled={!canUpload} />
          </FieldShell>
          {canUpload && (
            <div className="flex flex-wrap gap-2">
              <button type="button" className={btn.primary} onClick={save} disabled={pending}>
                Save details
              </button>
              <input ref={replaceRef} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && replace(e.target.files[0])} />
              <button type="button" className={btn.secondary} onClick={() => replaceRef.current?.click()}>
                Replace file…
              </button>
            </div>
          )}

          <div>
            <h3 className="mb-1.5 text-[14px] font-semibold text-forest-900">Used on</h3>
            {usage === null ? (
              <p className="text-[13px] text-ink-muted">Checking…</p>
            ) : usage.length === 0 ? (
              <p className="text-[13px] text-ink-muted">Not used anywhere yet.</p>
            ) : (
              <ul className="flex flex-col gap-1 text-[13px]">
                {usage.map((u) => (
                  <li key={u.href + u.label}>
                    <Link href={u.href} className="font-semibold text-forest-900 hover:underline">
                      {u.label}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canDelete && (
            <div className="border-t border-sand-200 pt-4">
              {confirmUsage ? (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-[13px] text-amber-950">
                  <p className="font-semibold">This image is used in {confirmUsage.length} place(s).</p>
                  <p className="mt-1">Deleting it leaves those places without a picture.</p>
                  <div className="mt-3 flex gap-2">
                    <button type="button" className={btn.danger} onClick={() => remove(true)} disabled={pending}>
                      Delete anyway
                    </button>
                    <button type="button" className={btn.ghost} onClick={() => setConfirmUsage(null)}>
                      Keep it
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className={btn.danger}
                  disabled={pending}
                  onClick={() => window.confirm("Delete this image permanently?") && remove(false)}
                >
                  Delete image
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
