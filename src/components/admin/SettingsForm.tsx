"use client";

import { useActionState } from "react";
import { saveSettings } from "@/app/admin/(panel)/settings/actions";
import { SubmitButton, Toast, useActionFeedback } from "./client";
import { Card, FieldShell, inputClass } from "./ui";

type Field = { key: string; label: string; group: string; type?: string; default: string; help?: string };

export function SettingsForm({ fields, values: stored }: { fields: Field[]; values: Record<string, string> }) {
  const [state, action] = useActionState(saveSettings, { ok: true });
  const { toast, dismiss, markDirty } = useActionFeedback(state);

  const values = { ...stored, ...((state.values as Record<string, string>) ?? {}) };
  const groups = [...new Set(fields.map((f) => f.group))];

  return (
    <form action={action} onInput={markDirty} className="flex flex-col gap-5">
      {groups.map((g) => (
        <Card key={g} title={g}>
          <div className="grid gap-4 md:grid-cols-2">
            {fields
              .filter((f) => f.group === g)
              .map((f) => (
                <FieldShell
                  key={f.key}
                  id={f.key}
                  label={f.label}
                  help={f.help ?? (f.default ? `Default: ${f.default.length > 60 ? `${f.default.slice(0, 60)}…` : f.default}` : undefined)}
                  error={state.errors?.[f.key]}
                  className={f.type === "textarea" ? "md:col-span-2" : ""}
                >
                  {f.type === "textarea" ? (
                    <textarea id={f.key} name={f.key} rows={3} defaultValue={values[f.key] ?? ""} placeholder={f.default} className={inputClass} />
                  ) : (
                    <input
                      id={f.key}
                      name={f.key}
                      type={f.type === "email" ? "email" : f.type === "url" ? "url" : "text"}
                      defaultValue={values[f.key] ?? ""}
                      placeholder={f.default || (f.type === "url" ? "https://" : "")}
                      className={inputClass}
                    />
                  )}
                </FieldShell>
              ))}
          </div>
        </Card>
      ))}
      <div className="sticky bottom-4 flex justify-end">
        <SubmitButton className="inline-flex min-h-10 items-center rounded-md bg-forest-900 px-5 text-[14px] font-semibold text-sand-50 shadow-lg hover:bg-forest-950">
          Save settings
        </SubmitButton>
      </div>
      <Toast message={toast?.msg} tone={toast?.tone} onClose={dismiss} />
    </form>
  );
}
