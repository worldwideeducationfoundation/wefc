import { logActivity } from "@/server/activity";
import { absoluteUrl } from "@/lib/site-url";
import { api, ApiError } from "@/server/api/content";
import { invalidateContent } from "@/server/cache";
import { importRemoteImage, type Media, storeImage, UploadError } from "@/server/media";

/**
 * POST /api/v1/media — add images to the media library.
 *   JSON       {"url": "https://…", "alt": "…", "caption": "…"}
 *   multipart  one or more "files", with an optional "alt"
 * Returns each image's id, to use in any image field or as ![alt](media:ID).
 */
const shape = (m: Media) => ({ id: m.id, url: absoluteUrl(m.url), alt: m.alt, width: m.width, height: m.height });

export async function POST(request: Request) {
  return api(request, "media.upload", async (user) => {
    const type = request.headers.get("content-type") ?? "";
    const out: ReturnType<typeof shape>[] = [];

    try {
      if (type.includes("application/json")) {
        const body = (await request.json()) as { url?: string; alt?: string; caption?: string };
        if (!body.url || !/^https?:\/\//.test(body.url)) throw new ApiError(400, 'Send {"url": "https://…"}.');
        const media = await importRemoteImage(body.url, body.alt ?? null, body.caption ?? null);
        if (!media) throw new ApiError(400, `Could not download ${body.url}.`);
        out.push(shape(media));
      } else {
        const form = await request.formData();
        const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0).slice(0, 10);
        if (!files.length) throw new ApiError(400, 'Send JSON {"url": …} or multipart "files".');
        const alt = String(form.get("alt") ?? "").trim() || null;
        for (const file of files) {
          out.push(shape(await storeImage(Buffer.from(await file.arrayBuffer()), { originalName: file.name, alt, userId: user.id })));
        }
      }
    } catch (err) {
      if (err instanceof UploadError) throw new ApiError(400, err.message);
      throw err;
    }

    invalidateContent();
    await logActivity(user.id, "upload", "media", `${out.length} image(s) (API)`);
    return { media: out };
  });
}
