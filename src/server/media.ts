import "server-only";
import { randomBytes } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp, { type Metadata as SharpMetadata, type OutputInfo } from "sharp";
import { execute, queryOne } from "./db";
import { env } from "./env";

/**
 * The media library's storage.
 *
 * Every image uploaded in the admin is decoded, auto-rotated, scaled down to
 * at most 2400px and re-encoded as WebP before it is stored. That does three
 * things at once: the files are small (phones on Chitral connections load
 * them), anything that is not really an image is rejected because it cannot
 * be decoded, and no uploaded file is ever served back byte-for-byte — which
 * removes the whole class of "image" uploads that are really scripts.
 *
 * Files live under UPLOAD_DIR on the server's own disk, named by random id,
 * never in git. They are served by src/app/uploads/[...path]/route.ts.
 */

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const MAX_EDGE = 2400;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp", "gif", "avif", "heif", "tiff"]);

export type Media = {
  id: number;
  path: string;
  url: string;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string | null;
  mime: string;
  sizeBytes: number;
  originalName: string | null;
  createdAt: Date;
};

export type MediaRow = {
  id: number;
  path: string;
  width: number | null;
  height: number | null;
  alt: string;
  caption: string | null;
  mime: string;
  size_bytes: number;
  original_name: string | null;
  created_at: Date;
};

export const mediaUrl = (relativePath: string) => `/uploads/${relativePath}`;

export function toMedia(row: MediaRow): Media {
  return {
    id: row.id,
    path: row.path,
    url: mediaUrl(row.path),
    width: row.width,
    height: row.height,
    alt: row.alt ?? "",
    caption: row.caption,
    mime: row.mime,
    sizeBytes: Number(row.size_bytes),
    originalName: row.original_name,
    createdAt: row.created_at,
  };
}

export class UploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UploadError";
  }
}

/** Absolute path for a stored file, refusing anything that would leave UPLOAD_DIR. */
export function resolveUploadPath(relative: string): string | null {
  const root = path.resolve(env.uploadDir);
  const full = path.resolve(root, relative);
  return full.startsWith(root + path.sep) ? full : null;
}

/**
 * Stores one image and records it in the media table. `alt` defaults to the
 * file name without its extension, so nothing is ever published with empty
 * alt text; editors are prompted to improve it in the library.
 */
export async function storeImage(
  input: Buffer,
  {
    originalName,
    alt,
    caption,
    sourceUrl,
    userId,
  }: { originalName?: string | null; alt?: string | null; caption?: string | null; sourceUrl?: string | null; userId?: number | null },
): Promise<Media> {
  if (input.length === 0) throw new UploadError("The file is empty.");
  if (input.length > MAX_UPLOAD_BYTES) {
    throw new UploadError(`Images must be smaller than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  }

  // PDFs (the ECLC brochure) are kept as they are: there is nothing to
  // re-encode. Only a file that really starts with the PDF signature counts.
  if (input.subarray(0, 5).toString("latin1") === "%PDF-") {
    return storeFile(input, "pdf", "application/pdf", null, { originalName, alt, caption, sourceUrl, userId });
  }

  let meta: SharpMetadata;
  try {
    meta = await sharp(input).metadata();
  } catch {
    throw new UploadError("That file is not an image this site can use. Upload a JPG, PNG or WebP.");
  }
  if (!meta.format || !ACCEPTED_FORMATS.has(meta.format)) {
    throw new UploadError("Only JPG, PNG, WebP, GIF and AVIF images can be uploaded.");
  }

  let processed: { data: Buffer; info: OutputInfo };
  try {
    processed = await sharp(input, { failOn: "error" })
      .rotate()
      .resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new UploadError("This image file seems to be damaged. Try saving it again, or use a different copy.");
  }
  const { data, info } = processed;
  return storeFile(data, "webp", "image/webp", { width: info.width, height: info.height }, { originalName, alt, caption, sourceUrl, userId });
}

async function storeFile(
  data: Buffer,
  ext: string,
  mime: string,
  size: { width: number; height: number } | null,
  {
    originalName,
    alt,
    caption,
    sourceUrl,
    userId,
  }: { originalName?: string | null; alt?: string | null; caption?: string | null; sourceUrl?: string | null; userId?: number | null },
): Promise<Media> {
  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const relative = `${folder}/${randomBytes(10).toString("hex")}.${ext}`;
  const full = resolveUploadPath(relative);
  if (!full) throw new UploadError("Could not store the file.");

  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, data);

  const fallbackAlt = (originalName ?? "")
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/[-_]+/g, " ")
    .trim()
    .slice(0, 300);

  try {
    const result = await execute(
      `INSERT INTO media (path, original_name, mime, size_bytes, width, height, alt, caption, source_url, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        relative,
        originalName?.slice(0, 255) ?? null,
        mime,
        data.length,
        size?.width ?? null,
        size?.height ?? null,
        (alt ?? "").trim().slice(0, 300) || fallbackAlt,
        caption?.trim().slice(0, 300) || null,
        sourceUrl?.slice(0, 500) ?? null,
        userId ?? null,
      ],
    );
    const row = await queryOne<MediaRow>("SELECT * FROM media WHERE id = ?", [result.insertId]);
    return toMedia(row!);
  } catch (err) {
    await rm(full, { force: true });
    throw err;
  }
}

/** Replaces the file behind an existing media item; every page using it updates. */
export async function replaceImage(mediaId: number, input: Buffer, originalName: string | null) {
  const existing = await queryOne<MediaRow>("SELECT * FROM media WHERE id = ?", [mediaId]);
  if (!existing) throw new UploadError("That image no longer exists.");
  const fresh = await storeImage(input, { originalName, alt: existing.alt, caption: existing.caption });
  // storeImage wrote the new file under a fresh row; move that file onto the
  // existing id (dropping the temporary row first, as paths are unique), then
  // remove the old file.
  await execute("DELETE FROM media WHERE id = ?", [fresh.id]);
  await execute(
    "UPDATE media SET path = ?, original_name = ?, size_bytes = ?, width = ?, height = ? WHERE id = ?",
    [fresh.path, fresh.originalName, fresh.sizeBytes, fresh.width, fresh.height, mediaId],
  );
  await deleteStoredFile(existing.path);
}

export async function deleteStoredFile(relative: string) {
  const full = resolveUploadPath(relative);
  if (full) await rm(full, { force: true });
}

/** True for addresses on a private network, this machine, or otherwise not the public internet. */
function isPrivateAddress(ip: string): boolean {
  const v4 = ip.replace(/^::ffff:/i, "");
  if (isIP(v4) === 4) {
    const [a, b] = v4.split(".").map(Number);
    return (
      a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

async function assertPublicUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new UploadError("Only http and https image addresses can be used.");
  const addresses = isIP(url.hostname) ? [{ address: url.hostname }] : await lookup(url.hostname, { all: true });
  if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
    throw new UploadError("That address is not on the public internet.");
  }
  return url;
}

/**
 * Downloads an image for the media library — used by the Content API when it
 * is given an image URL. Only public internet addresses are fetched (never
 * this server or its private network, even via a redirect), within a time
 * and size limit, so a URL cannot be used to probe the server's surroundings.
 */
async function fetchImage(raw: string): Promise<Buffer | null> {
  let url = await assertPublicUrl(raw);
  for (let hop = 0; hop < 4; hop++) {
    const res = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(20_000) });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      url = await assertPublicUrl(new URL(res.headers.get("location")!, url).toString());
      continue;
    }
    if (!res.ok || !res.body) return null;
    if (Number(res.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES) throw new UploadError("That image is too large.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    for await (const chunk of res.body as unknown as AsyncIterable<Uint8Array>) {
      size += chunk.length;
      if (size > MAX_UPLOAD_BYTES) throw new UploadError("That image is too large.");
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }
  throw new UploadError("Too many redirects.");
}

/** Imports an image from a URL once; a second call with the same URL returns the first. */
export async function importRemoteImage(url: string, alt?: string | null, caption?: string | null): Promise<Media | null> {
  const existing = await queryOne<MediaRow>("SELECT * FROM media WHERE source_url = ? LIMIT 1", [url]);
  if (existing) return toMedia(existing);
  const buffer = await fetchImage(url);
  if (!buffer) return null;
  const name = decodeURIComponent(new URL(url).pathname.split("/").pop() ?? "image");
  return storeImage(buffer, { originalName: name, alt, caption, sourceUrl: url });
}
