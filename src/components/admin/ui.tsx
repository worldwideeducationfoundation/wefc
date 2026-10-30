import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The admin's building blocks. Built on the site's own tokens (forest,
 * sand, lime) so the admin looks like WEF Canada rather than a generic dashboard,
 * but in a calmer, denser layout suited to editing.
 */

export const btn = {
  primary:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-forest-900 px-4 text-[14px] font-semibold text-sand-50 shadow-sm transition-colors hover:bg-forest-950 disabled:cursor-not-allowed disabled:opacity-60",
  secondary:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-sand-300 bg-white px-4 text-[14px] font-semibold text-forest-900 shadow-sm transition-colors hover:border-forest-900 disabled:opacity-60",
  danger:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-red-200 bg-white px-4 text-[14px] font-semibold text-red-800 transition-colors hover:border-red-700 hover:bg-red-50 disabled:opacity-60",
  ghost:
    "inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md px-2.5 text-[14px] font-semibold text-forest-900 transition-colors hover:bg-sand-100",
  lime:
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-lime-500 px-4 text-[14px] font-semibold text-forest-950 shadow-sm transition-colors hover:bg-lime-400",
} as const;

export const inputClass =
  "block w-full rounded-md border border-sand-300 bg-white px-3 py-2 text-[15px] text-ink shadow-xs placeholder:text-sand-500 focus:border-forest-900 focus:outline-none focus:ring-2 focus:ring-forest-900/15 aria-invalid:border-red-700 disabled:bg-sand-100";

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 border-b border-sand-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-2 inline-flex items-center gap-1 text-[13px] font-semibold text-ink-muted hover:text-forest-900">
            <span aria-hidden="true">←</span> {back.label}
          </Link>
        )}
        <h1 className="text-[26px] font-bold leading-tight text-forest-900">{title}</h1>
        {description && <p className="mt-1 max-w-3xl text-[14px] text-ink-muted">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-lg border border-sand-200 bg-white shadow-xs ${className}`}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4 border-b border-sand-200 px-5 py-3.5">
          <div>
            {title && <h2 className="text-[16px] font-bold text-forest-900">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-ink-muted">{description}</p>}
          </div>
          {actions}
        </div>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

const BADGES: Record<string, string> = {
  published: "bg-lime-100 text-lime-900 ring-lime-300",
  active: "bg-lime-100 text-lime-900 ring-lime-300",
  draft: "bg-sand-100 text-sand-700 ring-sand-300",
  disabled: "bg-sand-100 text-sand-700 ring-sand-300",
  new: "bg-amber-100 text-amber-900 ring-amber-300",
  read: "bg-sand-100 text-sand-700 ring-sand-300",
  replied: "bg-forest-100 text-forest-900 ring-forest-200",
  archived: "bg-sand-100 text-sand-600 ring-sand-200",
  blog: "bg-forest-50 text-forest-800 ring-forest-200",
  updates: "bg-lime-50 text-lime-900 ring-lime-200",
};

const BADGE_LABELS: Record<string, string> = {
  published: "Published",
  draft: "Draft",
  updates: "Project Update",
  blog: "Blog",
};

export function Badge({ value, label }: { value: string; label?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[12px] font-semibold ring-1 ring-inset ${
        BADGES[value] ?? "bg-sand-100 text-sand-700 ring-sand-300"
      }`}
    >
      {label ?? BADGE_LABELS[value] ?? value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ")}
    </span>
  );
}

export function FieldShell({
  id,
  label,
  help,
  error,
  required,
  children,
  className = "",
}: {
  id: string;
  label: ReactNode;
  help?: ReactNode;
  error?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-[14px] font-semibold text-forest-900">
        {label}
        {required && <span className="text-red-700"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1.5 text-[13px] font-medium text-red-800">
          {error}
        </p>
      ) : help ? (
        <p className="mt-1.5 text-[13px] text-ink-muted">{help}</p>
      ) : null}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-sand-300 bg-white px-6 py-14 text-center">
      <p className="text-[16px] font-bold text-forest-900">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-[14px] text-ink-muted">{children}</div>}
    </div>
  );
}

export function Alert({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "success"; children: ReactNode }) {
  const tones = {
    info: "border-forest-200 bg-forest-50 text-forest-900",
    warn: "border-amber-300 bg-amber-50 text-amber-950",
    error: "border-red-300 bg-red-50 text-red-900",
    success: "border-lime-300 bg-lime-50 text-lime-950",
  };
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`rounded-md border px-4 py-3 text-[14px] ${tones[tone]}`}>
      {children}
    </div>
  );
}

export function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Karachi",
  });
}

export function formatDate(value: Date | string | null | undefined) {
  if (!value) return "—";
  const d = value instanceof Date ? value : new Date(value);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Karachi" });
}

export function timeAgo(value: Date | string) {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const units: [number, string][] = [
    [3600, "minute"],
    [86400, "hour"],
    [604800, "day"],
  ];
  let divisor = 60;
  for (const [limit, unit] of units) {
    if (seconds < limit) {
      const n = Math.floor(seconds / divisor);
      return `${n} ${unit}${n === 1 ? "" : "s"} ago`;
    }
    divisor = limit;
  }
  return formatDate(value);
}
