"use client";

import { useActionState, useState } from "react";
import type { NavNode } from "@/app/admin/(panel)/navigation/actions";
import { Toast, useActionFeedback } from "./client";
import { Card, btn, inputClass } from "./ui";

type Result = { ok: boolean; message?: string };

const AUTO_LABELS = {
  auto_projects: "Automatic: every published project",
  auto_categories: "Automatic: every blog category",
} as const;

/**
 * Edits one menu as a two-level tree. Automatic entries stand for a live list
 * (every project, every blog category) and fill themselves in on the site.
 */
export function NavEditor({
  menu,
  initial,
  links,
  action,
}: {
  menu: "header" | "footer";
  initial: NavNode[];
  links: { label: string; href: string }[];
  action: (prev: Result, form: FormData) => Promise<Result>;
}) {
  const [tree, setTree] = useState<NavNode[]>(initial);
  const [state, formAction, pending] = useActionState(action, { ok: true });
  const { toast, dismiss, markDirty, dirty } = useActionFeedback(state);

  const change = (next: NavNode[]) => {
    setTree(next);
    markDirty();
  };
  const listId = `links-${menu}`;
  const isFooter = menu === "footer";

  const row = (node: NavNode, path: number[], siblings: NavNode[], setSiblings: (n: NavNode[]) => void, depth: number) => {
    const i = path[path.length - 1];
    const set = (patch: Partial<NavNode>) => setSiblings(siblings.map((s, j) => (j === i ? { ...s, ...patch } : s)));
    const moveBy = (d: number) => {
      const j = i + d;
      if (j < 0 || j >= siblings.length) return;
      const next = [...siblings];
      [next[i], next[j]] = [next[j], next[i]];
      setSiblings(next);
    };
    const auto = node.kind !== "link";

    return (
      <div className={`flex flex-wrap items-center gap-2 rounded-md border border-sand-200 bg-white p-2 ${depth ? "ml-8" : ""}`}>
        {auto ? (
          <span className="flex-1 rounded bg-lime-50 px-3 py-2 text-[14px] font-semibold text-lime-900">
            {AUTO_LABELS[node.kind as keyof typeof AUTO_LABELS]}
          </span>
        ) : (
          <>
            <input
              aria-label="Label"
              placeholder={isFooter && depth === 0 ? "Group heading" : "Label"}
              value={node.label}
              onChange={(e) => set({ label: e.target.value })}
              className={`${inputClass} w-44 flex-1`}
            />
            {!(isFooter && depth === 0) && (
              <input
                aria-label="Link"
                placeholder="/page or https://…"
                list={listId}
                value={node.href}
                onChange={(e) => set({ href: e.target.value })}
                className={`${inputClass} w-56 flex-1`}
              />
            )}
          </>
        )}
        <div className="flex items-center">
          <button type="button" className={btn.ghost} onClick={() => moveBy(-1)} disabled={i === 0} aria-label="Move up">
            ↑
          </button>
          <button type="button" className={btn.ghost} onClick={() => moveBy(1)} disabled={i === siblings.length - 1} aria-label="Move down">
            ↓
          </button>
          <button
            type="button"
            className={`${btn.ghost} text-red-800`}
            onClick={() => setSiblings(siblings.filter((_, j) => j !== i))}
            aria-label="Remove"
          >
            ×
          </button>
        </div>
      </div>
    );
  };

  return (
    <form action={formAction}>
      <input type="hidden" name="tree" value={JSON.stringify(tree)} />
      <datalist id={listId}>
        {links.map((l) => (
          <option key={l.href} value={l.href}>
            {l.label}
          </option>
        ))}
      </datalist>
      <Card
        title={isFooter ? "Footer menu" : "Main menu"}
        description={
          isFooter
            ? "Groups of links in the footer. Each group has a heading and its links."
            : "The links across the top of every page. An item can have a dropdown of links under it."
        }
        actions={
          <button type="submit" className={btn.primary} disabled={pending || !dirty}>
            {pending ? "Saving…" : dirty ? "Save menu" : "Saved"}
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          {tree.map((node, i) => (
            <div key={i} className="flex flex-col gap-2">
              {row(node, [i], tree, change, 0)}
              {node.kind === "link" &&
                node.children.map((child, j) => (
                  <div key={j}>
                    {row(child, [i, j], node.children, (children) => change(tree.map((n, k) => (k === i ? { ...n, children } : n))), 1)}
                  </div>
                ))}
              {node.kind === "link" && (
                <div className="ml-8 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btn.ghost}
                    onClick={() => change(tree.map((n, k) => (k === i ? { ...n, children: [...n.children, { kind: "link", label: "", href: "", children: [] }] } : n)))}
                  >
                    + {isFooter ? "Link in this group" : "Dropdown link"}
                  </button>
                  {(["auto_projects", "auto_categories"] as const).map((kind) =>
                    node.children.some((c) => c.kind === kind) ? null : (
                      <button
                        key={kind}
                        type="button"
                        className={btn.ghost}
                        onClick={() => change(tree.map((n, k) => (k === i ? { ...n, children: [...n.children, { kind, label: "", href: "", children: [] }] } : n)))}
                      >
                        + {kind === "auto_projects" ? "All projects" : "All blog categories"}
                      </button>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
          <button
            type="button"
            className={`${btn.secondary} self-start`}
            onClick={() => change([...tree, { kind: "link", label: "", href: "", children: [] }])}
          >
            + {isFooter ? "Add a group" : "Add a menu item"}
          </button>
        </div>
      </Card>
      <Toast message={toast?.msg} tone={toast?.tone} onClose={dismiss} />
    </form>
  );
}
