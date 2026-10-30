"use client";

import { useActionState } from "react";
import { saveAccount } from "@/app/admin/(panel)/users/actions";
import { SubmitButton, Toast, useActionFeedback } from "./client";
import { Card, FieldShell, inputClass } from "./ui";

type Result = { ok: boolean; message?: string; errors?: Record<string, string>; values?: Record<string, unknown> };
type Role = { value: string; label: string; description: string };

export function UserForm({
  initial,
  roles,
  isNew,
  isSelf,
  action,
}: {
  initial: { name: string; email: string; role: string; status: string };
  roles: Role[];
  isNew: boolean;
  isSelf: boolean;
  action: (prev: Result, form: FormData) => Promise<Result>;
}) {
  const [state, formAction] = useActionState(action, { ok: true });
  const v = { ...initial, ...((state.values as typeof initial) ?? {}) };
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="max-w-2xl">
      <Card>
        <div className="grid gap-4 md:grid-cols-2">
          {state.message && !state.ok && <p className="text-[14px] font-semibold text-red-800 md:col-span-2">{state.message}</p>}
          <FieldShell id="name" label="Name" required error={e.name}>
            <input id="name" name="name" defaultValue={v.name} className={inputClass} />
          </FieldShell>
          <FieldShell id="email" label="Email" required error={e.email} help="They sign in with this.">
            <input id="email" name="email" type="email" defaultValue={v.email} className={inputClass} />
          </FieldShell>
          <fieldset className="md:col-span-2">
            <legend className="mb-1.5 text-[14px] font-semibold text-forest-900">Role</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {roles.map((r) => (
                <label key={r.value} className="flex cursor-pointer flex-col gap-1 rounded-md border border-sand-300 p-3 has-[:checked]:border-forest-900 has-[:checked]:bg-forest-50">
                  <span className="flex items-center gap-2 text-[14px] font-semibold text-forest-900">
                    <input type="radio" name="role" value={r.value} defaultChecked={v.role === r.value} disabled={isSelf} className="accent-forest-900" />
                    {r.label}
                  </span>
                  <span className="text-[12px] text-ink-muted">{r.description}</span>
                </label>
              ))}
            </div>
            {isSelf && <input type="hidden" name="role" value={v.role} />}
            {e.role && <p className="mt-1.5 text-[13px] font-medium text-red-800">{e.role}</p>}
          </fieldset>
          <FieldShell id="status" label="Account">
            <select id="status" name="status" defaultValue={v.status} disabled={isSelf} className={inputClass}>
              <option value="active">Active — can sign in</option>
              <option value="disabled">Disabled — cannot sign in</option>
            </select>
            {isSelf && <input type="hidden" name="status" value={v.status} />}
          </FieldShell>
          <FieldShell
            id="password"
            label={isNew ? "Password" : "New password"}
            required={isNew}
            error={e.password}
            help={isNew ? "At least 12 characters. Share it with them privately; they can change it under their account." : "Leave empty to keep their current password. Setting one signs them out everywhere."}
          >
            <input id="password" name="password" type="password" autoComplete="new-password" className={inputClass} />
          </FieldShell>
        </div>
        <div className="mt-5">
          <SubmitButton>{isNew ? "Create account" : "Save"}</SubmitButton>
        </div>
      </Card>
    </form>
  );
}

export function AccountForm({ initial }: { initial: { name: string; email: string } }) {
  const [state, formAction] = useActionState(saveAccount, { ok: true });
  const { toast, dismiss } = useActionFeedback(state);
  const v = { ...initial, ...((state.values as typeof initial) ?? {}) };
  const e = state.errors ?? {};
  return (
    <form action={formAction} className="flex max-w-2xl flex-col gap-5">
      <Card title="Your details">
        <div className="grid gap-4 md:grid-cols-2">
          <FieldShell id="name" label="Name" error={e.name}>
            <input id="name" name="name" defaultValue={v.name} className={inputClass} />
          </FieldShell>
          <FieldShell id="email" label="Email" error={e.email}>
            <input id="email" name="email" type="email" defaultValue={v.email} className={inputClass} />
          </FieldShell>
        </div>
      </Card>
      <Card title="Change password" description="Leave these empty to keep your current password.">
        <div className="grid gap-4 md:grid-cols-2">
          <FieldShell id="password" label="New password" error={e.password} help="At least 12 characters.">
            <input id="password" name="password" type="password" autoComplete="new-password" className={inputClass} />
          </FieldShell>
          <FieldShell id="confirm" label="New password again" error={e.confirm}>
            <input id="confirm" name="confirm" type="password" autoComplete="new-password" className={inputClass} />
          </FieldShell>
        </div>
      </Card>
      <Card>
        <FieldShell id="current" label="Current password" error={e.current} help="Needed to change your email or password.">
          <input id="current" name="current" type="password" autoComplete="current-password" className={`${inputClass} max-w-sm`} />
        </FieldShell>
        <div className="mt-4">
          <SubmitButton>Save</SubmitButton>
        </div>
      </Card>
      <Toast message={toast?.msg} tone={toast?.tone} onClose={dismiss} />
    </form>
  );
}
