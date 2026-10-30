"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { NavLink } from "@/lib/types";
import { Caret } from "./Icons";

/**
 * The header from the old site: transparent over each page's opening band,
 * solid once the page scrolls, and a slide-in drawer under 960px where the
 * dropdowns open on tap.
 */
export function Header({ nav, siteName, donateUrl, donateLabel }: { nav: NavLink[]; siteName: string; donateUrl: string; donateLabel: string }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A new page closes the drawer.
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
    setSub(null);
  }

  const [brandLine, brandSub] = siteName.endsWith(" Canada") ? [siteName.slice(0, -7), "Canada"] : [siteName, ""];

  return (
    <header className={`wef-header wef-header--overlay${scrolled ? " wef-scrolled" : ""}`} id="wefHeader">
      <div className="wef-header-inner">
        <Link className="wef-brand" href="/" aria-label={`${siteName} home`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- a 240px brand mark; the optimiser adds nothing */}
          <img className="wef-brand-logo" src="/brand/wefc-logo.webp" alt="" width="240" height="240" />
          <span className="wef-brand-name" aria-hidden="true">
            <span className="wef-brand-line">{brandLine}</span>
            {brandSub && <span className="wef-brand-sub">{brandSub}</span>}
          </span>
        </Link>
        <nav className={`wef-nav${open ? " wef-open" : ""}`} id="wefNav" aria-label="Primary">
          <ul className="wef-menu">
            {nav.map((item) =>
              item.children?.length ? (
                <li key={item.label} className={`wef-has-children${sub === item.label ? " wef-sub-open" : ""}`}>
                  <a
                    className="wef-navlink"
                    href={item.href}
                    aria-haspopup="true"
                    aria-expanded={sub === item.label}
                    onClick={(e) => {
                      if (window.innerWidth <= 960) {
                        e.preventDefault();
                        setSub((s) => (s === item.label ? null : item.label));
                      } else if (item.href === "#") e.preventDefault();
                    }}
                  >
                    {item.label} <Caret />
                  </a>
                  <ul className="wef-submenu">
                    {item.children.map((c) => (
                      <li key={c.href + c.label}>
                        <Link href={c.href}>{c.label}</Link>
                      </li>
                    ))}
                  </ul>
                </li>
              ) : (
                <li key={item.href + item.label}>
                  <Link className="wef-navlink" href={item.href} aria-current={pathname === item.href ? "page" : undefined}>
                    {item.label}
                  </Link>
                </li>
              ),
            )}
          </ul>
          <a className="wef-btn wef-btn-donate" href={donateUrl} rel="noopener" target="_blank">
            {donateLabel}
          </a>
        </nav>
        <button
          className="wef-nav-toggle"
          id="wefNavToggle"
          type="button"
          aria-label="Menu"
          aria-controls="wefNav"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </div>
      <div className={`wef-nav-backdrop${open ? " wef-show" : ""}`} id="wefNavBackdrop" onClick={() => setOpen(false)} />
    </header>
  );
}
