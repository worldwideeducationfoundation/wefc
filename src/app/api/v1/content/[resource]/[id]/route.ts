import { logActivity } from "@/server/activity";
import { getResourceRow, loadOptions, optionSourcesOf } from "@/server/admin/data";
import { getResource, type ResourceDef } from "@/server/admin/resources";
import { saveRecord } from "@/server/admin/save";
import { api, ApiError, readJson, toApi, toFormData } from "@/server/api/content";
import { invalidateContent } from "@/server/cache";
import { execute } from "@/server/db";

type Ctx = RouteContext<"/api/v1/content/[resource]/[id]">;

async function load(ctx: Ctx): Promise<{ def: ResourceDef; id: number; row: Record<string, unknown> }> {
  const { resource, id } = await ctx.params;
  const def = getResource(resource);
  if (!def) throw new ApiError(404, `Unknown content type "${resource}".`);
  const n = Number(id);
  const row = Number.isInteger(n) && n > 0 ? await getResourceRow(def, n) : null;
  if (!row) throw new ApiError(404, `No ${def.label.toLowerCase()} with id ${id} (it may be in Trash).`);
  return { def, id: n, row };
}

export async function GET(request: Request, ctx: Ctx) {
  return api(request, "content.view", async () => {
    const { def, row } = await load(ctx);
    return toApi(def, row);
  });
}

/** PATCH — only the fields sent change; the rest keep their current values. */
export async function PATCH(request: Request, ctx: Ctx) {
  return api(request, "content.edit", async (user) => {
    const { def, id, row } = await load(ctx);
    const input = await readJson(request);
    const form = await toFormData(def, input, row, await loadOptions(optionSourcesOf(def)));
    const result = await saveRecord(def, id, form, user.id, { via: "API" });
    if (!result.ok) throw new ApiError(result.notFound ? 404 : 422, result.message, result.errors);
    return { updated: await toApi(def, (await getResourceRow(def, id))!) };
  });
}

/** DELETE — moves the item to Trash, where it can be restored from the admin. */
export async function DELETE(request: Request, ctx: Ctx) {
  return api(request, "content.delete", async (user) => {
    const { def, id, row } = await load(ctx);
    await execute(`UPDATE ${def.table} SET deleted_at = UTC_TIMESTAMP() WHERE id = ?`, [id]);
    invalidateContent();
    await logActivity(user.id, "trash", def.key, `${String(row[def.titleField] ?? `#${id}`).slice(0, 100)} (API)`);
    return { trashed: { type: def.key, id } };
  });
}
