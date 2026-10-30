"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import { logoutAction } from "@/app/admin/actions";

type Item = { label: string; href: string; count?: number };
type Group = { label: string; items: Item[] };

/**
 * The admin frame: sidebar on the left (a drawer on phones), a slim top bar
 * with the signed-in person and sign-out, and the page.
 */
export function Shell({
  groups,
  user,
  children,
}: {
  groups: Group[];
  user: { name: string; roleLabel: string };
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;

  const isActive = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));

  const nav = (
    <nav aria-label="Admin sections" className="flex flex-col gap-5 px-3 py-4">
      <Link
        href="/admin"
        aria-current={isActive("/admin") ? "page" : undefined}
        className={`rounded-md px-3 py-2 text-[14px] font-semibold ${
          isActive("/admin") ? "bg-forest-800 text-white" : "text-sand-200 hover:bg-forest-900 hover:text-white"
        }`}
      >
        Dashboard
      </Link>
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-lime-400/80">{group.label}</p>
          <ul className="flex flex-col gap-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={isActive(item.href) ? "page" : undefined}
                  className={`flex items-center justify-between rounded-md px-3 py-1.5 text-[14px] ${
                    isActive(item.href)
                      ? "bg-forest-800 font-semibold text-white"
                      : "text-sand-200 hover:bg-forest-900 hover:text-white"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.count ? (
                    <span className="rounded-full bg-lime-500 px-1.5 text-[11px] font-bold text-forest-950">{item.count}</span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <div className="flex min-h-screen flex-1">
      {/* Sidebar — fixed on desktop */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col overflow-y-auto bg-forest-950 lg:flex">
        <Brand />
        {nav}
      </aside>

      {/* Drawer — phones and tablets */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Admin menu">
          <button type="button" className="absolute inset-0 bg-forest-950/50" aria-label="Close menu" onClick={() => setOpenFor(null)} />
          <aside className="relative h-full w-72 overflow-y-auto bg-forest-950 shadow-xl">
            <Brand />
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 items-center justify-between gap-3 border-b border-sand-200 bg-white/90 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex size-10 items-center justify-center rounded-md text-forest-900 hover:bg-sand-100 lg:hidden"
              aria-label="Open menu"
              onClick={() => setOpenFor(pathname)}
            >
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <a href="/" target="_blank" rel="noopener" className="hidden text-[13px] font-semibold text-ink-muted hover:text-forest-900 sm:inline">
              View website ↗
            </a>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/admin/account" className="flex items-center gap-2.5 rounded-md px-2 py-1 hover:bg-sand-100">
              <span className="flex size-8 items-center justify-center rounded-full bg-forest-900 text-[13px] font-bold text-sand-50" aria-hidden="true">
                {user.name.charAt(0).toUpperCase()}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-[13px] font-semibold text-forest-900">{user.name}</span>
                <span className="block text-[12px] text-ink-muted">{user.roleLabel}</span>
              </span>
            </Link>
            <form action={logoutAction}>
              <button type="submit" className="rounded-md border border-sand-300 px-3 py-1.5 text-[13px] font-semibold text-forest-900 hover:border-forest-900">
                Sign out
              </button>
            </form>
          </div>
        </header>
        <main id="admin-main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <Link href="/admin" className="flex items-center gap-3 border-b border-forest-800 px-5 py-4">
      <Image src="/brand/wefc-logo.webp" alt="" width={32} height={32} className="size-8 rounded-full bg-white" />
      <span className="leading-tight">
        <span className="block text-[14px] font-bold text-white">WEF Canada</span>
        <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-lime-400">Admin</span>
      </span>
    </Link>
  );
}
