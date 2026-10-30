"use client";

import { useActionState, useState } from "react";
import { createToken, type TokenState } from "@/app/admin/(panel)/api-access/actions";
import { SubmitButton } from "./client";
import { Alert, FieldShell, btn, inputClass } from "./ui";

/** Creates a key and shows it — once. */
export function ApiKeyForm() {
  const [state, action] = useActionState<TokenState, FormData>(createToken, {});
  const [copied, setCopied] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {state.token && (
        <Alert tone="success">
          <p className="font-semibold">Key “{state.name}” created. Copy it now — it will not be shown again.</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <code className="break-all rounded bg-white px-2 py-1.5 font-mono text-[13px] text-forest-900 ring-1 ring-lime-300">{state.token}</code>
            <button
              type="button"
              className={btn.secondary}
              onClick={() => navigator.clipboard.writeText(state.token!).then(() => setCopied(true))}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </Alert>
      )}
      {state.error && <Alert tone="error">{state.error}</Alert>}
      <form action={action} className="flex flex-wrap items-end gap-3">
        <FieldShell id="key-name" label="Name for the new key" help="So you can tell keys apart later." className="min-w-64 flex-1">
          <input id="key-name" name="name" maxLength={120} placeholder="Claude on Nauman’s laptop" className={inputClass} />
        </FieldShell>
        <SubmitButton pendingLabel="Creating…">Create key</SubmitButton>
      </form>
    </div>
  );
}
