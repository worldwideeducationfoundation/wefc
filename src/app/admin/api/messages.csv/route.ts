import { logActivity } from "@/server/activity";
import { roleCan } from "@/server/auth/roles";
import { getCurrentUser } from "@/server/auth/session";
import { query } from "@/server/db";

/** Messages as a CSV file that opens in Excel or Google Sheets. */
const cell = (v: unknown) => {
  let s = v instanceof Date ? v.toISOString().replace("T", " ").slice(0, 16) : String(v ?? "");
  // A cell starting with = + - @ would run as a formula in a spreadsheet.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !roleCan(user.role, "submissions.view")) return new Response("Not allowed", { status: 403 });

  const status = new URL(request.url).searchParams.get("status");
  const valid = ["new", "read", "replied", "archived"].includes(status ?? "");
  const rows = await query<Record<string, unknown>>(
    `SELECT created_at, name, email, phone, subject, message, status, admin_note FROM submissions
      WHERE deleted_at IS NULL ${valid ? "AND status = ?" : ""} ORDER BY created_at DESC`,
    valid ? [status] : [],
  );

  const header = ["Received (UTC)", "Name", "Email", "Phone", "Subject", "Message", "Status", "Note"];
  const lines = [header.map(cell).join(","), ...rows.map((r) => Object.values(r).map(cell).join(","))];
  await logActivity(user.id, "export", "messages", `${rows.length} rows`);

  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="wefc-messages-${new Date().toISOString().slice(0, 10)}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
