"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ProgramCard } from "@/lib/types";

/** The home page's horizontally scrolling program photos: arrows on wide screens, dots on phones. */
export function PhotoStrip({ eyebrow, title, items }: { eyebrow: string; title: string; items: ProgramCard[] }) {
  const strip = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const el = strip.current;
    if (!el) return;
    let raf = 0;
    const sync = () => {
      raf = 0;
      const max = el.scrollWidth - el.clientWidth;
      setAtStart(el.scrollLeft <= 2);
      setAtEnd(el.scrollLeft >= max - 2);
      // The card whose left edge is nearest the rail's padded start edge.
      const left = el.getBoundingClientRect().left + (parseFloat(getComputedStyle(el).scrollPaddingLeft) || 0);
      let best = 0;
      let dist = Infinity;
      el.querySelectorAll<HTMLElement>(".pstrip-item").forEach((item, idx) => {
        const d = Math.abs(item.getBoundingClientRect().left - left);
        if (d < dist) {
          dist = d;
          best = idx;
        }
      });
      setActive(best);
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(sync);
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", sync);
    sync();
    return () => {
      el.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", sync);
      cancelAnimationFrame(raf);
    };
  }, []);

  const step = () => {
    const el = strip.current!;
    const first = el.querySelector(".pstrip-item");
    if (!first) return el.clientWidth * 0.8;
    return first.getBoundingClientRect().width + (parseFloat(getComputedStyle(el).columnGap) || 20);
  };

  return (
    <section className="photostrip" aria-label={eyebrow}>
      <div className="container">
        <div className="photostrip-head reveal">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h2>{title}</h2>
          </div>
          <div className="pstrip-nav">
            <button
              type="button"
              aria-label="Scroll photos left"
              disabled={atStart}
              onClick={() => strip.current?.scrollBy({ left: -step(), behavior: "smooth" })}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 18 9 12l6-6" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Scroll photos right"
              disabled={atEnd}
              onClick={() => strip.current?.scrollBy({ left: step(), behavior: "smooth" })}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className="pstrip reveal" ref={strip} tabIndex={0} role="region" aria-label="Photo gallery, scroll horizontally">
        {items.map((p, idx) => {
          const body = (
            <>
              <div className="pstrip-fig">
                {p.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- already WebP at a sensible size; the strip's CSS crops it
                  <img
                    src={p.image.src}
                    width={p.image.width}
                    height={p.image.height}
                    alt={p.image.alt}
                    loading={idx === 0 ? undefined : "lazy"}
                    decoding="async"
                  />
                )}
              </div>
              <span className="pstrip-num">{String(idx + 1).padStart(2, "0")}</span>
              <figcaption className="pstrip-cap">
                <h3>{p.title}</h3>
                {p.lead && <p>{p.lead}</p>}
              </figcaption>
            </>
          );
          return (
            <figure key={p.id} className="pstrip-item">
              {p.href ? (
                <Link href={p.href} style={{ color: "inherit", textDecoration: "none" }}>
                  {body}
                </Link>
              ) : (
                body
              )}
            </figure>
          );
        })}
      </div>
      {items.length > 1 && (
        <div className="pstrip-dots" aria-hidden="true">
          {items.map((p, idx) => (
            <button
              key={p.id}
              type="button"
              tabIndex={-1}
              className={idx === active ? "is-active" : undefined}
              onClick={() =>
                strip.current
                  ?.querySelectorAll<HTMLElement>(".pstrip-item")
                  [idx]?.scrollIntoView({ inline: "start", block: "nearest", behavior: "smooth" })
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
