"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * The old site's two scroll effects, for every page: `.reveal` elements fade
 * up as they enter the viewport, and `[data-to]` numbers count up once.
 * Runs again after each client-side navigation. With reduced motion the
 * stylesheets show everything at once and the numbers are written straight in.
 */
export function Reveal() {
  const pathname = usePathname();
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveals = document.querySelectorAll<HTMLElement>(".reveal:not(.is-visible)");
    const revealIO = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("is-visible");
            revealIO.unobserve(e.target);
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" },
    );
    reveals.forEach((el, i) => {
      el.style.transitionDelay = `${Math.min(i, 4) * 60}ms`;
      revealIO.observe(el);
    });

    const counters = document.querySelectorAll<HTMLElement>("[data-to]");
    const countUp = (el: HTMLElement) => {
      const to = Number(el.dataset.to);
      if (reduce || !Number.isFinite(to)) {
        el.textContent = to.toLocaleString();
        return;
      }
      let t0: number | null = null;
      const step = (ts: number) => {
        t0 ??= ts;
        const p = Math.min((ts - t0) / 1600, 1);
        el.textContent = Math.floor((1 - Math.pow(1 - p, 3)) * to).toLocaleString();
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const statIO = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            countUp(e.target as HTMLElement);
            statIO.unobserve(e.target);
          }
        }
      },
      { threshold: 0.5 },
    );
    counters.forEach((n) => statIO.observe(n));
    return () => {
      revealIO.disconnect();
      statIO.disconnect();
    };
  }, [pathname]);
  return null;
}
