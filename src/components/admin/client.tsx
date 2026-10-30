"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { useFormStatus } from "react-dom";
import { btn } from "./ui";

/** Messages shown after a redirect, keyed by ?notice=. */
const NOTICES: Record<string, string> = {
  saved: "Saved.",
  created: "Created. Keep editing, or publish when it is ready.",
  duplicated: "Copy created as a draft.",
  trashed: "Moved to Trash. You can restore it from Trash.",
  restored: "Restored.",
  purged: "Deleted permanently.",
  emptied: "Trash emptied.",
  deleted: "Deleted.",
  welcome: "Your account is ready. Welcome to the WEF Canada admin.",
  password: "Password changed. Other devices have been signed out.",
};

/**
 * A toast for ?notice=…. The parameter is removed after a few seconds (or on
 * dismiss), so a reload does not show the message again.
 */
export function Notice() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const key = params.get("notice");

  const clear = useCallback(() => {
    const next = new URLSearchParams(params.toString());
    next.delete("notice");
    router.replace(`${pathname}${next.size ? `?${next}` : ""}`, { scroll: false });
  }, [params, pathname, router]);

  useEffect(() => {
    if (!key) return;
    const t = setTimeout(clear, 5000);
    return () => clearTimeout(t);
  }, [key, clear]);

  // Shown only after hydration: the server and the first browser render must match.
  const hydrated = useHydrated();
  return <Toast message={hydrated && key ? (NOTICES[key] ?? key) : null} onClose={clear} />;
}

type ActionStateLike = { ok: boolean; message?: string };

/**
 * Feedback for a form driven by useActionState: the toast for the latest
 * result (hidden after five seconds or on dismiss), and whether there are
 * edits made since that result — derived from the state rather than copied
 * into it, so there is nothing to keep in sync.
 */
export function useActionFeedback(state: ActionStateLike) {
  const [hiddenFor, setHiddenFor] = useState<ActionStateLike | null>(null);
  const [editedAt, setEditedAt] = useState<ActionStateLike | null>(null);

  useEffect(() => {
    if (!state.message) return;
    const t = setTimeout(() => setHiddenFor(state), 5000);
    return () => clearTimeout(t);
  }, [state]);

  // Unsaved while the last edit happened after the last result, or that result failed.
  const dirty = editedAt !== null && (editedAt === state || !state.ok);
  useUnsavedWarning(dirty);

  return {
    toast: state.message && hiddenFor !== state ? { msg: state.message, tone: state.ok ? ("success" as const) : ("error" as const) } : null,
    dismiss: () => setHiddenFor(state),
    markDirty: () => setEditedAt(state),
    dirty,
  };
}

const noopSubscribe = () => () => {};

/** False during server render and hydration, true afterwards. */
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}

export function Toast({ message, tone = "success", onClose }: { message: string | null | undefined; tone?: "success" | "error"; onClose?: () => void }) {
  if (!message) return null;
  return (
    <div
      role="status"
      className={`fixed bottom-5 right-5 z-[60] flex max-w-sm items-start gap-3 rounded-lg px-4 py-3 text-[14px] font-medium shadow-lg ${
        tone === "error" ? "bg-red-800 text-white" : "bg-forest-950 text-sand-50"
      }`}
    >
      <span aria-hidden="true">{tone === "error" ? "!" : "✓"}</span>
      <span className="flex-1">{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} className="text-sand-300 hover:text-white" aria-label="Dismiss">
          ×
        </button>
      )}
    </div>
  );
}

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className = btn.primary,
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className} name={name} value={value}>
      {pending ? pendingLabel : children}
    </button>
  );
}

/** A submit button that asks first. For destructive actions in plain forms. */
export function ConfirmButton({
  children,
  message,
  className = btn.danger,
  formAction,
}: {
  children: ReactNode;
  message: string;
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={className}
      formAction={formAction}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending ? "Working…" : children}
    </button>
  );
}

/** Warns before leaving a page with unsaved changes. */
export function useUnsavedWarning(dirty: boolean) {
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
}
