import { createReadStream } from "node:fs";
import { rm, stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { logActivity } from "@/server/activity";
import { sameOrigin } from "@/server/admin/origin";
import { roleCan } from "@/server/auth/roles";
import { getCurrentUser } from "@/server/auth/session";
import { createBackup, restoreBackup } from "@/server/backup";

/** GET downloads a full backup; PUT (the archive as the body) restores one. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || !roleCan(user.role, "backups.manage")) return new Response("Not allowed", { status: 403 });

  const { file, dir } = await createBackup();
  const size = (await stat(file)).size;
  const stream = createReadStream(file);
  stream.on("close", () => {
    rm(dir, { recursive: true, force: true }).catch(() => {});
  });
  await logActivity(user.id, "download", "backups", `${(size / 1048576).toFixed(1)} MB`);

  const name = `wefc-website-backup-${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}.tar.gz`;
  return new Response(Readable.toWeb(stream) as ReadableStream, {
    headers: {
      "Content-Type": "application/gzip",
      "Content-Length": String(size),
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function PUT(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user || !roleCan(user.role, "backups.manage")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (request.headers.get("x-confirm") !== "RESTORE") {
    return NextResponse.json({ error: "Restore was not confirmed." }, { status: 400 });
  }
  if (!request.body) return NextResponse.json({ error: "No file was sent." }, { status: 400 });

  try {
    const summary = await restoreBackup(request.body);
    await logActivity(user.id, "restore", "backups", summary);
    return NextResponse.json({ message: summary });
  } catch (err) {
    console.error("[backup] restore failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Restore failed." }, { status: 400 });
  }
}
