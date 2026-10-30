import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { Readable } from "node:stream";
import { resolveUploadPath } from "@/server/media";

/**
 * Serves uploaded images from UPLOAD_DIR.
 *
 * Every stored file has a random, never-reused name, so it can be cached by
 * browsers and CDNs forever. Replacing an image in the media library writes a
 * new file name rather than overwriting, so nobody is served a stale copy.
 */
const TYPES: Record<string, string> = {
  webp: "image/webp",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  avif: "image/avif",
  pdf: "application/pdf",
};

export async function GET(_req: Request, ctx: RouteContext<"/uploads/[...path]">) {
  const { path: segments } = await ctx.params;
  if (segments.some((s) => s === ".." || s.startsWith(".") || s.includes("\\"))) {
    return new Response("Not found", { status: 404 });
  }

  const relative = segments.join("/");
  const ext = relative.split(".").pop()?.toLowerCase() ?? "";
  const full = resolveUploadPath(relative);
  if (!full || !TYPES[ext]) return new Response("Not found", { status: 404 });

  try {
    const info = await stat(full);
    if (!info.isFile()) return new Response("Not found", { status: 404 });

    const stream = Readable.toWeb(createReadStream(full)) as ReadableStream;
    return new Response(stream, {
      headers: {
        "Content-Type": TYPES[ext],
        "Content-Length": String(info.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
        // A PDF may be shown in a frame on this site's own pages (the brochure).
        "Content-Security-Policy": ext === "pdf" ? "default-src 'none'; frame-ancestors 'self'" : "default-src 'none'",
        ...(ext === "pdf" ? { "Content-Disposition": "inline" } : {}),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
