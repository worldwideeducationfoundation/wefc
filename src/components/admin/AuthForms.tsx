"use client";

import { useActionState } from "react";
import { type FormState, loginAction, setupAction } from "@/app/admin/actions";
import { SubmitButton } from "./client";
import { Alert, FieldShell, btn, inputClass } from "./ui";

export function LoginForm({ next }: { next?: string }) {
  const [state, action] = useActionState<FormState, FormData>(loginAction, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <input type="hidden" name="next" value={next ?? ""} />
      <FieldShell id="email" label="Email">
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          defaultValue={state.values?.email ?? ""}
          className={inputClass}
        />
      </FieldShell>
      <FieldShell id="password" label="Password">
        <input id="password" name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </FieldShell>
      <SubmitButton pendingLabel="Signing in…" className={`${btn.primary} mt-2 w-full`}>
        Sign in
      </SubmitButton>
    </form>
  );
}

export function SetupForm({ keyConfigured }: { keyConfigured: boolean }) {
  const [state, action] = useActionState<FormState, FormData>(setupAction, {});
  const e = state.errors ?? {};
  return (
    <form action={action} className="flex flex-col gap-4">
      {state.error && <Alert tone="error">{state.error}</Alert>}
      {!keyConfigured && (
        <Alert tone="warn">
          <strong>ADMIN_SETUP_KEY is not set.</strong> Add it to the server&apos;s environment variables (any long
          random phrase), restart the app, then reload this page.
        </Alert>
      )}
      <FieldShell id="setupKey" label="Setup key" error={e.setupKey} help="The value of ADMIN_SETUP_KEY on the server.">
        <input id="setupKey" name="setupKey" type="password" required autoComplete="off" className={inputClass} />
      </FieldShell>
      <FieldShell id="name" label="Your name" error={e.name}>
        <input id="name" name="name" required autoComplete="name" defaultValue={state.values?.name ?? ""} className={inputClass} />
      </FieldShell>
      <FieldShell id="email" label="Email" error={e.email} help="You will sign in with this.">
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="username"
          defaultValue={state.values?.email ?? ""}
          className={inputClass}
        />
      </FieldShell>
      <FieldShell id="password" label="Password" error={e.password} help="At least 12 characters. A short sentence is easy to remember and hard to guess.">
        <input id="password" name="password" type="password" required autoComplete="new-password" className={inputClass} />
      </FieldShell>
      <FieldShell id="confirm" label="Password again" error={e.confirm}>
        <input id="confirm" name="confirm" type="password" required autoComplete="new-password" className={inputClass} />
      </FieldShell>
      <SubmitButton pendingLabel="Creating…" className={`${btn.primary} mt-2 w-full`}>
        Create admin account
      </SubmitButton>
    </form>
  );
}
