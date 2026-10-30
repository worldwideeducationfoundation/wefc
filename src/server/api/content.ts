import "server-only";
import { NextResponse } from "next/server";
import { type FieldDef, type FieldOptions, slugify } from "@/lib/admin-fields";
import { markdownToDoc } from "@/lib/markdown";
import { parseRichDoc } from "@/lib/richtext";
import { absoluteUrl } from "@/lib/site-url";
import type { ResourceDef } from "../admin/resources";
import { type Capability, roleCan } from "../auth/roles";
import type { AdminUser } from "../auth/session";
import { query } from "../db";
import { importRemoteImage, type Media, mediaUrl, UploadError } from "../media";
import { userFromRequest } from "./auth";

/**
 * Shared pieces of the Content API (/api/v1).
 *
 * Every write goes through the same saveRecord() the admin's forms use: the
 * JSON is turned into the same form data a person would submit, so the API
 * can never store anything the admin would refuse.
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}

/** Authenticates the key, checks the capability, runs the handler, and shapes any error as JSON. */
export async function api(
  request: Request,
  capability: Capability,
  handler: (user: AdminUser) => Promise<unknown>,
): Promise<NextResponse> {
  try {
    const user = await userFromRequest(request);
    if (!user) throw new ApiError(401, "Missing or invalid API key. Send it as: Authorization: Bearer wefc_…");
    if (!roleCan(user.role, capability)) throw new ApiError(403, `This key's account (${user.role}) cannot ${capability}.`);
    const result = await handler(user);
    return NextResponse.json(result ?? { ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message, ...(err.details ? { details: err.details } : {}) }, { status: err.status });
    }
    console.error("[api] failed", err);
    return NextResponse.json({ error: "Something went wrong on the server." }, { status: 500 });
  }
}

export async function readJson(request: Request): Promise<Record<string, unknown>> {
  try {
    const body = await request.json();
    if (body && typeof body === "object" && !Array.isArray(body)) return body as Record<string, unknown>;
  } catch {
    /* fall through */
  }
  throw new ApiError(400, "Send a JSON object as the request body.");
}

/** importRemoteImage, with its refusals reported to the client as a 400 rather than a server error. */
async function download(url: string, alt: string, caption = ""): Promise<Media | null> {
  try {
    return await importRemoteImage(url, alt, caption);
  } catch (err) {
    if (err instanceof UploadError) throw new ApiError(400, `${url}: ${err.message}`);
    throw err;
  }
}

/** A media field's value: a media id, "media:123", or an image URL to copy into the library. */
async function mediaIdFrom(value: unknown, alt: string): Promise<string> {
  if (value === null || value === "" || value === undefined) return "";
  if (typeof value === "number") return String(value);
  const s = String(value).trim();
  if (/^(media:)?\d+$/.test(s)) return s.replace("media:", "");
  if (/^https?:\/\//.test(s)) {
    const media = await download(s, alt);
    if (!media) throw new ApiError(400, `Could not download the image at ${s}.`);
    return String(media.id);
  }
  throw new ApiError(400, `"${s}" is not a media id or an image URL.`);
}

const imageResolver = async (src: string, alt: string, caption: string) => {
  if (/^(media:)?\d+$/.test(src)) return Number(src.replace("media:", ""));
  if (/^https?:\/\//.test(src)) return (await download(src, alt, caption))?.id ?? null;
  return null;
};

/** A select or relation value: the option's id, or its name as shown in the admin (case-insensitive). */
function optionValue(field: FieldDef, options: FieldOptions, value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  const list = field.type === "select" && field.options ? field.options : "optionsFrom" in field && field.optionsFrom ? options[field.optionsFrom] ?? [] : [];
  const s = String(value).trim();
  const hit =
    list.find((o) => o.value === s) ??
    list.find((o) => o.label.toLowerCase() === s.toLowerCase()) ??
    list.find((o) => o.label.toLowerCase().replace(/^(blog|update): /, "") === s.toLowerCase());
  if (!hit) throw new ApiError(400, `"${s}" is not one of the choices for ${field.name}.`, { choices: list.map((o) => o.label) });
  return hit.value;
}

const utcLocal = (d: Date) => d.toISOString().slice(0, 16);

/**
 * Builds the form data the admin form would send. On an update, fields not
 * in `input` keep their current values, so a client can change just one.
 */
export async function toFormData(
  def: ResourceDef,
  input: Record<string, unknown>,
  existing: Record<string, unknown> | null,
  options: FieldOptions,
): Promise<FormData> {
  const form = new FormData();
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k);
  const titleText = String(input[def.titleField] ?? existing?.[def.titleField] ?? "");

  for (const f of def.fields) {
    const mdKey = `${f.name}_markdown`;
    const given = has(f.name) || (f.type === "richtext" && has(mdKey));
    const value = given ? input[f.name] : existing?.[f.name];

    switch (f.type) {
      case "richtext": {
        let doc;
        if (has(mdKey)) doc = await markdownToDoc(String(input[mdKey] ?? ""), imageResolver);
        else if (given && typeof value === "string" && !value.trim().startsWith("{")) doc = await markdownToDoc(value, imageResolver);
        else doc = parseRichDoc(value);
        form.set(f.name, JSON.stringify(doc));
        break;
      }
      case "media":
        form.set(f.name, given ? await mediaIdFrom(value, titleText) : value ? String(value) : "");
        break;
      case "toggle":
        if (value === true || value === 1 || value === "1" || value === "on" || value === "true") form.set(f.name, "on");
        break;
      case "datetime": {
        const d = value instanceof Date ? value : value ? new Date(String(value)) : given ? null : new Date();
        if (d && Number.isNaN(d.getTime())) throw new ApiError(400, `${f.name} must be a date and time, e.g. 2026-10-21T09:00:00Z.`);
        form.set(f.name, d ? utcLocal(d) : "");
        form.set(`${f.name}__tz`, "0");
        break;
      }
      case "date": {
        const d = value instanceof Date ? value.toISOString().slice(0, 10) : String(value ?? "").slice(0, 10);
        form.set(f.name, d);
        break;
      }
      case "select":
        form.set(f.name, given ? optionValue(f, options, value) : value === null || value === undefined ? "" : String(value));
        break;
      case "relation": {
        const list = Array.isArray(value) ? value : value ? String(value).split(",") : [];
        for (const v of list) form.append(f.name, given ? optionValue(f, options, v) : String(v));
        break;
      }
      case "placements": {
        const list = Array.isArray(value) ? value : String(value ?? "").split(",");
        for (const v of list.map((x) => String(x).trim()).filter(Boolean)) form.append(f.name, v);
        break;
      }
      case "slug": {
        // Like the admin: no address given for a new item -> made from its title.
        const fromTitle = slugify(String(input[f.from] ?? existing?.[f.from] ?? ""));
        form.set(f.name, value ? String(value) : fromTitle);
        break;
      }
      case "lines":
        form.set(f.name, Array.isArray(value) ? value.join("\n") : String(value ?? ""));
        break;
      default:
        form.set(f.name, value === null || value === undefined ? "" : String(value));
    }
  }

  const status = has("status") ? input.status : (existing?.status ?? "draft");
  if (status !== "draft" && status !== "published") throw new ApiError(400, 'status must be "draft" or "published".');
  form.set("status", String(status));
  return form;
}

/** A stored row as the API returns it. */
export async function toApi(def: ResourceDef, row: Record<string, unknown>) {
  const out: Record<string, unknown> = { id: row.id, status: row.status };
  const mediaIds = def.fields.filter((f) => f.type === "media").map((f) => Number(row[f.name])).filter((n) => n > 0);
  const media = mediaIds.length
    ? Object.fromEntries(
        (await query<{ id: number; path: string; alt: string }>("SELECT id, path, alt FROM media WHERE id IN (?)", [mediaIds])).map((m) => [
          m.id,
          { id: m.id, url: absoluteUrl(mediaUrl(m.path)), alt: m.alt },
        ]),
      )
    : {};
  for (const f of def.fields) {
    const v = row[f.name];
    if (f.type === "media") out[f.name] = v ? (media[Number(v)] ?? { id: v }) : null;
    else if (f.type === "richtext") out[f.name] = parseRichDoc(v);
    else if (f.type === "toggle") out[f.name] = Boolean(Number(v));
    else if (f.type === "placements") out[f.name] = String(v ?? "").split(",").filter(Boolean);
    else out[f.name] = v ?? null;
  }
  if ("display_order" in row) out.display_order = row.display_order;
  out.updated_at = row.updated_at;
  const path = def.publicPath?.(row);
  if (path) out.url = absoluteUrl(path);
  out.admin_url = absoluteUrl(`/admin/content/${def.key}/${row.id}`);
  return out;
}

/** What a client needs to know to write a field, for the self-describing index. */
export function describeField(f: FieldDef, options: FieldOptions) {
  const base: Record<string, unknown> = { name: f.name, type: f.type, label: f.label, required: Boolean(f.required) };
  if (f.help) base.help = f.help;
  if ("maxLength" in f && f.maxLength) base.maxLength = f.maxLength;
  if (f.type === "select" || f.type === "relation") {
    const list = f.type === "select" && f.options ? f.options : "optionsFrom" in f && f.optionsFrom ? options[f.optionsFrom] ?? [] : [];
    base.choices = list.map((o) => ({ id: o.value, name: o.label }));
  }
  if (f.type === "richtext") base.accepts = `JSON document, or Markdown as a string or in "${f.name}_markdown"`;
  if (f.type === "media") base.accepts = "a media id, or an image URL (it is copied into the media library)";
  if (f.type === "slug") base.accepts = "lowercase-words-with-dashes";
  if (f.type === "datetime") base.accepts = "ISO 8601, e.g. 2026-10-21T09:00:00Z";
  if (f.type === "placements") base.accepts = '["home", "ticker", "program:<project-slug>"]';
  return base;
}
