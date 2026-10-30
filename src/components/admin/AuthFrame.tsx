import Image from "next/image";
import type { ReactNode } from "react";

/** The centred card used by the sign-in and setup pages. */
export function AuthFrame({ title, intro, children }: { title: string; intro?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-1 items-center justify-center bg-forest-950 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Image src="/brand/wefc-logo.webp" alt="" width={40} height={40} className="size-10 rounded-full bg-white" />
          <span className="text-[15px] font-semibold uppercase tracking-[0.14em] text-sand-200">WEF Canada Admin</span>
        </div>
        <div className="rounded-xl bg-white p-7 shadow-2xl">
          <h1 className="text-[24px] font-bold text-forest-900">{title}</h1>
          {intro && <div className="mt-2 text-[14px] text-ink-muted">{intro}</div>}
          <div className="mt-6">{children}</div>
        </div>
      </div>
    </div>
  );
}
