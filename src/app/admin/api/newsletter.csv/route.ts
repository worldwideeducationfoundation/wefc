import { logActivity } from "@/server/activity";
import { roleCan } from "@/server/auth/roles";
import { getCurrentUser } from "@/server/auth/session";
import { query } from "@/server/db";

/** Newsletter signups as a CSV for Excel, Google Sheets or a mailing service. */
const cell = (v: unknown) => {
  let s = v instanceof Date ? v.toISOString().replace("T", " ").slice(0, 16) : String(v ?? "");
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`; // never a formula in a spreadsheet
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !roleCan(user.role, "submissions.view")) return new Response("Not allowed", { status: 403 });

  const status = new URL(request.url).searchParams.get("status");
  const filter = status === "subscribed" || status === "unsubscribed" ? status : null;
  const rows = await query<Record<string, unknown>>(
    `SELECT email, status, created_at FROM newsletter_subscribers ${filter ? "WHERE status = ?" : ""} ORDER BY created_at`,
    filter ? [filter] : [],
  );
  await logActivity(user.id, "export", "newsletter", `${rows.length} addresses`);

  const lines = [["Email", "Status", "Signed up (UTC)"].map(cell).join(","), ...rows.map((r) => Object.values(r).map(cell).join(","))];
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wefc-newsletter-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
