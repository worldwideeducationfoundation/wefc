"use client";

import { useRef, useState } from "react";
import { Alert, btn, inputClass } from "./ui";

export function BackupRestore() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const restore = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return setResult({ ok: false, msg: "Choose a backup file first." });
    setBusy(true);
    setResult(null);
    const res = await fetch("/admin/api/backup", {
      method: "PUT",
      body: file,
      headers: { "x-confirm": "RESTORE", "content-type": "application/gzip" },
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    setResult({ ok: res.ok, msg: data.message ?? data.error ?? "Restore failed." });
  };

  return (
    <div className="flex flex-col gap-3">
      <input ref={fileRef} type="file" accept=".gz,.tgz,application/gzip" className="text-[14px]" />
      <label className="text-[14px]">
        Type <strong>RESTORE</strong> to confirm
        <input value={confirm} onChange={(e) => setConfirm(e.target.value)} className={`${inputClass} mt-1 max-w-xs`} />
      </label>
      <button type="button" className={`${btn.danger} self-start`} disabled={busy || confirm !== "RESTORE"} onClick={restore}>
        {busy ? "Restoring… keep this page open" : "Restore this backup"}
      </button>
      {result && <Alert tone={result.ok ? "success" : "error"}>{result.msg}</Alert>}
    </div>
  );
}
