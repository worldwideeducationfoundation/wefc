import { listResource, loadOptions, optionSourcesOf, getResourceRow } from "@/server/admin/data";
import { getResource } from "@/server/admin/resources";
import { saveRecord } from "@/server/admin/save";
import { api, ApiError, readJson, toApi, toFormData } from "@/server/api/content";

const resourceOr404 = (key: string) => {
  const def = getResource(key);
  if (!def) throw new ApiError(404, `Unknown content type "${key}". GET /api/v1 lists them.`);
  return def;
};

/** GET /api/v1/content/{type}?q=&status=&page= */
export async function GET(request: Request, ctx: RouteContext<"/api/v1/content/[resource]">) {
  return api(request, "content.view", async () => {
    const def = resourceOr404((await ctx.params).resource);
    const sp = new URL(request.url).searchParams;
    const status = sp.get("status");
    const { rows, total } = await listResource(def, {
      q: sp.get("q")?.trim() ?? "",
      status: status === "draft" || status === "published" ? status : "",
      filters: {},
      page: Math.max(1, Number(sp.get("page")) || 1),
    });
    const items = [];
    for (const r of rows) {
      const full = await getResourceRow(def, r.id);
      if (full) items.push(await toApi(def, full));
    }
    return { type: def.key, total, items };
  });
}

/** POST /api/v1/content/{type} — create. Drafts unless "status": "published". */
export async function POST(request: Request, ctx: RouteContext<"/api/v1/content/[resource]">) {
  return api(request, "content.create", async (user) => {
    const def = resourceOr404((await ctx.params).resource);
    const input = await readJson(request);
    const options = await loadOptions(optionSourcesOf(def));
    const form = await toFormData(def, input, null, options);
    const result = await saveRecord(def, null, form, user.id, { via: "API" });
    if (!result.ok) throw new ApiError(422, result.message, result.errors);
    return { created: await toApi(def, (await getResourceRow(def, result.id))!) };
  });
}
