"use client";

import { useEffect, useRef, useState } from "react";
import type { TeamMember } from "@/lib/types";
import { ArrowRight, Close } from "./Icons";

const initials = (name: string) => {
  const p = name.replace(/^Dr\.?\s+/i, "").split(/\s+/).filter(Boolean);
  return ((p[0] ?? "")[0] ?? "") + ((p[p.length - 1] ?? "")[0] ?? "");
};

function Photo({ m, eager }: { m: TeamMember; eager?: boolean }) {
  return m.image ? (
    // eslint-disable-next-line @next/next/no-img-element -- WebP portrait, cropped by CSS
    <img className="tm-photo-img" src={m.image.src} alt={m.name} width={m.image.width} height={m.image.height} loading={eager ? undefined : "lazy"} decoding="async" />
  ) : (
    <div className="tm-initials">
      <span>{initials(m.name)}</span>
    </div>
  );
}

/** One group's cards, and the "Read bio" dialog. */
export function TeamGrid({ members, bioLabel, first }: { members: TeamMember[]; bioLabel: string; first?: boolean }) {
  const [open, setOpen] = useState<TeamMember | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(null);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
      lastFocus.current?.focus();
    };
  }, [open]);

  return (
    <>
      <div className="tm-grid">
        {members.map((m, i) => (
          <article key={m.id} className="tm-card">
            <div className="tm-photo">
              <Photo m={m} eager={first && i === 0} />
            </div>
            <div className="tm-info">
              <h3>{m.name}</h3>
              {m.role && <p className="tm-role">{m.role}</p>}
              {m.bio && (
                <button
                  type="button"
                  className="tm-bio-btn"
                  onClick={(e) => {
                    lastFocus.current = e.currentTarget;
                    setOpen(m);
                  }}
                >
                  {bioLabel} <ArrowRight />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
      {open && (
        <div className="tm-modal" role="dialog" aria-modal="true" aria-labelledby="tmModalName">
          <div className="tm-modal-backdrop" onClick={() => setOpen(null)} />
          <div className="tm-modal-card" role="document">
            <button ref={closeRef} className="tm-modal-close" type="button" aria-label="Close" onClick={() => setOpen(null)}>
              <Close />
            </button>
            <div className="tm-modal-head">
              <div className="tm-modal-photo">
                <Photo m={open} eager />
              </div>
              <div>
                <h3 id="tmModalName">{open.name}</h3>
                {open.role && <p className="tm-role">{open.role}</p>}
              </div>
            </div>
            <div className="tm-modal-body">
              {(open.bio ?? "")
                .split(/\n\s*\n/)
                .map((p) => p.trim())
                .filter(Boolean)
                .map((p) => (
                  <p key={p}>{p}</p>
                ))}
              {open.linkedin && (
                <p>
                  <a href={open.linkedin} rel="noopener" target="_blank">
                    LinkedIn
                  </a>
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
