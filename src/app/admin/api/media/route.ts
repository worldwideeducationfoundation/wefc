import { NextResponse } from "next/server";
import { logActivity } from "@/server/activity";
import { sameOrigin } from "@/server/admin/origin";
import { roleCan } from "@/server/auth/roles";
import { getCurrentUser } from "@/server/auth/session";
import { invalidateContent } from "@/server/cache";
import { query, queryOne } from "@/server/db";
import { MAX_UPLOAD_BYTES, mediaUrl, replaceImage, storeImage, UploadError } from "@/server/media";

/**
 * The media library's API, used by the image picker on every form.
 *   GET  ?q=&page=   search the library
 *   POST files       upload one or more images
 *   POST file+replace  swap the file behind an existing image (every page using it updates)
 */
const PAGE = 48;

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || !roleCan(user.role, "media.view")) return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const where = q ? "WHERE alt LIKE ? OR original_name LIKE ? OR caption LIKE ?" : "";
  const like = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
  const args = q ? [like, like, like] : [];

  const [rows, total] = await Promise.all([
    query<{ id: number; path: string; alt: string; caption: string | null; width: number | null; height: number | null; original_name: string | null }>(
      `SELECT id, path, alt, caption, width, height, original_name FROM media ${where}
        ORDER BY created_at DESC, id DESC LIMIT ${PAGE} OFFSET ${(page - 1) * PAGE}`,
      args,
    ),
    queryOne<{ n: number }>(`SELECT COUNT(*) AS n FROM media ${where}`, args),
  ]);

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      url: mediaUrl(r.path),
      alt: r.alt,
      caption: r.caption,
      width: r.width,
      height: r.height,
      name: r.original_name,
    })),
    total: Number(total?.n ?? 0),
    pageSize: PAGE,
  });
}

export async function POST(request: Request) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Bad origin" }, { status: 403 });
  const user = await getCurrentUser();
  if (!user || !roleCan(user.role, "media.upload")) {
    return NextResponse.json({ error: "You do not have permission to upload images." }, { status: 403 });
  }

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_UPLOAD_BYTES * 10 + 1_000_000) {
    return NextResponse.json({ error: "Upload at most 10 images at a time." }, { status: 413 });
  }

  const form = await request.formData();

  const replaceId = Number(form.get("replace"));
  if (Number.isInteger(replaceId) && replaceId > 0) {
    const file = form.get("file");
    if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "Choose an image." }, { status: 400 });
    try {
      await replaceImage(replaceId, Buffer.from(await file.arrayBuffer()), file.name);
    } catch (err) {
      const message = err instanceof UploadError ? err.message : "Could not replace the image.";
      if (!(err instanceof UploadError)) console.error("[media] replace failed", err);
      return NextResponse.json({ error: message }, { status: 400 });
    }
    invalidateContent();
    await logActivity(user.id, "replace", "media", file.name);
    const row = await queryOne<{ path: string }>("SELECT path FROM media WHERE id = ?", [replaceId]);
    return NextResponse.json({ url: row ? mediaUrl(row.path) : null });
  }

  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 10);
  const alt = String(form.get("alt") ?? "").trim() || null;
  if (files.length === 0) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });

  const items = [];
  const errors: string[] = [];
  for (const file of files) {
    try {
      const media = await storeImage(Buffer.from(await file.arrayBuffer()), {
        originalName: file.name,
        alt: files.length === 1 ? alt : null,
        userId: user.id,
      });
      items.push({ id: media.id, url: media.url, alt: media.alt, width: media.width, height: media.height, name: media.originalName });
    } catch (err) {
      errors.push(`${file.name}: ${err instanceof UploadError ? err.message : "could not be stored."}`);
      if (!(err instanceof UploadError)) console.error("[media] upload failed", err);
    }
  }

  if (items.length) {
    invalidateContent();
    await logActivity(user.id, "upload", "media", items.length === 1 ? items[0].name ?? "1 image" : `${items.length} images`);
  }
  return NextResponse.json({ items, errors }, { status: items.length ? 200 : 400 });
}
