"use client";

/* eslint-disable @next/next/no-img-element -- small library thumbnails */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { bulkResource, reorderResource } from "@/app/admin/(panel)/content/actions";
import { Toast } from "./client";
import { Badge, btn } from "./ui";

export type TableRow = {
  id: number;
  title: string;
  status: "draft" | "published";
  thumb: string | null;
  cells: { value: string; kind?: "text" | "date" | "badge" | "muted" }[];
  publicHref: string | null;
};

export function ResourceTable({
  resourceKey,
  rows: initialRows,
  columns,
  hasThumb,
  canReorder,
  canEdit,
  canDelete,
}: {
  resourceKey: string;
  rows: TableRow[];
  columns: string[];
  hasThumb: boolean;
  canReorder: boolean;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [dragId, setDragId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; tone: "success" | "error" } | null>(null);
  const [pending, start] = useTransition();

  // A fresh server render (after a filter change or bulk action) replaces local order.
  const [seen, setSeen] = useState(initialRows);
  if (seen !== initialRows) {
    setSeen(initialRows);
    setRows(initialRows);
    setSelected(new Set());
  }

  const flash = (msg: string | undefined, ok: boolean) => {
    if (!msg) return;
    setToast({ msg, tone: ok ? "success" : "error" });
    setTimeout(() => setToast(null), 4000);
  };

  const bulk = (action: "publish" | "draft" | "trash") => {
    if (action === "trash" && !window.confirm(`Move ${selected.size} item(s) to Trash? You can restore them from Trash.`)) return;
    start(async () => {
      const res = await bulkResource(resourceKey, action, [...selected]);
      flash(res.message, res.ok);
      router.refresh();
    });
  };

  const saveOrder = (next: TableRow[]) => {
    start(async () => {
      const res = await reorderResource(resourceKey, next.map((r) => r.id));
      flash(res.message, res.ok);
    });
  };

  const move = (fromId: number, toId: number) => {
    if (fromId === toId) return;
    const next = [...rows];
    const from = next.findIndex((r) => r.id === fromId);
    const to = next.findIndex((r) => r.id === toId);
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    setRows(next);
    saveOrder(next);
  };

  const nudge = (id: number, dir: -1 | 1) => {
    const i = rows.findIndex((r) => r.id === id);
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    move(id, rows[j].id);
  };

  const allSelected = rows.length > 0 && selected.size === rows.length;

  return (
    <div className="overflow-hidden rounded-lg border border-sand-200 bg-white shadow-xs">
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-sand-200 bg-lime-50 px-4 py-2.5">
          <span className="mr-2 text-[14px] font-semibold text-forest-900">{selected.size} selected</span>
          {canEdit && (
            <>
              <button type="button" className={btn.secondary} disabled={pending} onClick={() => bulk("publish")}>
                Publish
              </button>
              <button type="button" className={btn.secondary} disabled={pending} onClick={() => bulk("draft")}>
                Switch to draft
              </button>
            </>
          )}
          {canDelete && (
            <button type="button" className={btn.danger} disabled={pending} onClick={() => bulk("trash")}>
              Move to Trash
            </button>
          )}
          <button type="button" className={btn.ghost} onClick={() => setSelected(new Set())}>
            Clear
          </button>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[14px]">
          <thead className="bg-sand-50 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink-muted">
            <tr>
              <th className="w-10 px-4 py-2.5">
                <input
                  type="checkbox"
                  aria-label="Select all"
                  checked={allSelected}
                  onChange={() => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="size-4 accent-forest-900"
                />
              </th>
              {canReorder && <th className="w-16 px-1 py-2.5"><span className="sr-only">Order</span></th>}
              {hasThumb && <th className="w-16 px-2 py-2.5"><span className="sr-only">Image</span></th>}
              <th className="px-3 py-2.5">Title</th>
              {columns.map((c) => (
                <th key={c} className="px-3 py-2.5">
                  {c}
                </th>
              ))}
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5"><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-sand-200">
            {rows.map((row) => (
              <tr
                key={row.id}
                draggable={canReorder}
                onDragStart={() => setDragId(row.id)}
                onDragOver={(e) => canReorder && e.preventDefault()}
                onDrop={() => dragId !== null && move(dragId, row.id)}
                onDragEnd={() => setDragId(null)}
                className={`${dragId === row.id ? "opacity-40" : ""} ${selected.has(row.id) ? "bg-lime-50/60" : "hover:bg-sand-25"}`}
              >
                <td className="px-4 py-2.5">
                  <input
                    type="checkbox"
                    aria-label={`Select ${row.title}`}
                    checked={selected.has(row.id)}
                    onChange={() =>
                      setSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(row.id)) next.delete(row.id);
                        else next.add(row.id);
                        return next;
                      })
                    }
                    className="size-4 accent-forest-900"
                  />
                </td>
                {canReorder && (
                  <td className="px-1 py-2.5 text-ink-muted">
                    <span className="flex items-center gap-0.5">
                      <span className="cursor-grab px-1 text-[16px]" aria-hidden="true" title="Drag to reorder">
                        ⠿
                      </span>
                      <span className="flex flex-col">
                        <button type="button" className="px-1 text-[10px] leading-none hover:text-forest-900" onClick={() => nudge(row.id, -1)} aria-label={`Move ${row.title} up`}>
                          ▲
                        </button>
                        <button type="button" className="px-1 text-[10px] leading-none hover:text-forest-900" onClick={() => nudge(row.id, 1)} aria-label={`Move ${row.title} down`}>
                          ▼
                        </button>
                      </span>
                    </span>
                  </td>
                )}
                {hasThumb && (
                  <td className="px-2 py-2">
                    {row.thumb ? (
                      <img src={row.thumb} alt="" className="size-11 rounded object-cover" loading="lazy" />
                    ) : (
                      <span className="flex size-11 items-center justify-center rounded bg-sand-100 text-[11px] text-ink-muted">—</span>
                    )}
                  </td>
                )}
                <td className="max-w-md px-3 py-2.5">
                  <Link href={`/admin/content/${resourceKey}/${row.id}`} className="line-clamp-2 font-semibold text-forest-900 hover:underline">
                    {row.title || "(untitled)"}
                  </Link>
                </td>
                {row.cells.map((cell, i) => (
                  <td key={i} className={`px-3 py-2.5 ${cell.kind === "muted" ? "text-ink-muted" : ""}`}>
                    {cell.kind === "badge" && cell.value ? <Badge value={cell.value} /> : <span className="line-clamp-1">{cell.value}</span>}
                  </td>
                ))}
                <td className="px-3 py-2.5">
                  <Badge value={row.status} />
                </td>
                <td className="whitespace-nowrap px-3 py-2.5 text-right">
                  <Link href={`/admin/content/${resourceKey}/${row.id}`} className={btn.ghost}>
                    Edit
                  </Link>
                  {row.publicHref && row.status === "published" && (
                    <a href={row.publicHref} target="_blank" rel="noopener" className={btn.ghost}>
                      View ↗
                    </a>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Toast message={toast?.msg} tone={toast?.tone} onClose={() => setToast(null)} />
    </div>
  );
}
