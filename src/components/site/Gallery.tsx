"use client";

import { useEffect, useRef, useState } from "react";
import type { GalleryPhoto } from "@/lib/types";
import { ChevronLeft, ChevronRight, Close } from "./Icons";

/** The Gallery page's filter chips, photo grid and lightbox. */
export function Gallery({ photos, categories, allLabel }: { photos: GalleryPhoto[]; categories: string[]; allLabel: string }) {
  const [filter, setFilter] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);
  const visible = photos.map((p, i) => ({ p, i })).filter(({ p }) => !filter || p.category === filter);

  const step = (dir: number) =>
    setOpen((cur) => {
      if (cur === null || !visible.length) return cur;
      const idx = Math.max(0, visible.findIndex((v) => v.i === cur));
      return visible[(idx + dir + visible.length) % visible.length].i;
    });

  useEffect(() => {
    if (open === null) return;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowRight") step(1);
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
    // step reads the current filter; re-binding on each open is enough.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open === null, filter]);

  const close = () => {
    setOpen(null);
    lastFocus.current?.focus();
  };
  const current = open === null ? null : photos[open];

  return (
    <>
      {categories.length > 0 && (
        <div className="gl-filters">
          {["", ...categories].map((c) => (
            <button key={c || "all"} type="button" className={`gl-chip${filter === c ? " is-active" : ""}`} aria-pressed={filter === c} onClick={() => setFilter(c)}>
              {c || allLabel}
            </button>
          ))}
        </div>
      )}
      <div className="gl-grid">
        {photos.map((p, i) => (
          <figure key={i} className={`gl-item${filter && p.category !== filter ? " is-hidden" : ""}`}>
            <button
              type="button"
              className="gl-open"
              aria-label={`Open image: ${p.caption || p.alt}`}
              onClick={(e) => {
                lastFocus.current = e.currentTarget;
                setOpen(i);
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- WebP from the media library, cropped by CSS */}
              <img src={p.src} alt={p.alt} width={p.width} height={p.height} loading={i < 2 ? undefined : "lazy"} decoding="async" />
              <span className="gl-overlay">
                {p.category && <span className="gl-cat">{p.category}</span>}
                {p.caption && <span className="gl-title">{p.caption}</span>}
              </span>
            </button>
          </figure>
        ))}
      </div>
      {current && (
        <div className="lb" role="dialog" aria-modal="true" aria-label="Image viewer">
          <div className="lb-backdrop" onClick={close} />
          <button ref={closeRef} className="lb-btn lb-close" type="button" aria-label="Close" onClick={close}>
            <Close />
          </button>
          <button className="lb-btn lb-prev" type="button" aria-label="Previous" onClick={() => step(-1)}>
            <ChevronLeft width="2" />
          </button>
          <button className="lb-btn lb-next" type="button" aria-label="Next" onClick={() => step(1)}>
            <ChevronRight width="2" />
          </button>
          <div className="lb-stage">
            {/* eslint-disable-next-line @next/next/no-img-element -- full-size WebP */}
            <img className="lb-img" src={current.src} alt={current.alt} decoding="async" />
            <div className="lb-cap">
              <div className="c">{current.caption}</div>
              <div className="d">{current.alt}</div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
