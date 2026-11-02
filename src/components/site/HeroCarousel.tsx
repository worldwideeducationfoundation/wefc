"use client";

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react";
import { imageUrl } from "@/lib/image";
import type { HeroSlideContent } from "@/lib/types";
import { ChevronLeft, ChevronRight } from "./Icons";

/** The cross-fading photographs at the top of the home page. */
export function HeroCarousel({ slides }: { slides: HeroSlideContent[] }) {
  const [i, setI] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const x0 = useRef<number | null>(null);
  const n = slides.length;
  const go = useCallback((to: number) => setI(((to % n) + n) % n), [n]);

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
  };
  const reset = useCallback(() => {
    if (timer.current) clearInterval(timer.current);
    if (n > 1 && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      timer.current = setInterval(() => setI((c) => (c + 1) % n), 5000);
    }
  }, [n]);

  useEffect(() => {
    reset();
    return stop;
  }, [reset]);

  if (n === 0) return null;
  return (
    <section className="hero" aria-label="Photos from our programs">
      <div className="hero-media" onMouseEnter={stop} onMouseLeave={reset}>
        <div
          className="hero-carousel"
          onTouchStart={(e) => (x0.current = e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (x0.current === null) return;
            const dx = e.changedTouches[0].clientX - x0.current;
            if (Math.abs(dx) > 40) {
              go(dx < 0 ? i + 1 : i - 1);
              reset();
            }
            x0.current = null;
          }}
        >
          {slides.map((s, idx) => (
            <figure key={s.id} className={`hero-slide${idx === i ? " is-active" : ""}`} aria-hidden={idx !== i}>
              <div
                className="hero-slide-img"
                style={
                  /* Only the slides around the current one carry a photo (the
                     one fading out, the one showing, the next, and the last
                     for a wrap-around), so a visitor who never waits for
                     slide 7 never downloads it. */
                  s.image && (Math.abs(idx - i) <= 1 || idx === n - 1)
                    ? ({
                        "--hero-sm": `url('${imageUrl(s.image.src, 768)}')`,
                        "--hero-lg": `url('${imageUrl(s.image.src, 1920)}')`,
                      } as CSSProperties)
                    : undefined
                }
                role="img"
                aria-label={s.image?.alt || s.description}
              />
              <figcaption className="hero-caption">{s.description}</figcaption>
            </figure>
          ))}
        </div>
        {n > 1 && (
          <>
            <button
              type="button"
              className="hero-nav prev"
              aria-label="Previous photo"
              onClick={() => {
                go(i - 1);
                reset();
              }}
            >
              <ChevronLeft />
            </button>
            <button
              type="button"
              className="hero-nav next"
              aria-label="Next photo"
              onClick={() => {
                go(i + 1);
                reset();
              }}
            >
              <ChevronRight />
            </button>
            <div className="hero-dots">
              {slides.map((s, idx) => (
                <button
                  key={s.id}
                  type="button"
                  className={`hero-dot${idx === i ? " is-active" : ""}`}
                  aria-label={`Show photo ${idx + 1} of ${n}`}
                  aria-current={idx === i}
                  onClick={() => {
                    go(idx);
                    reset();
                  }}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
