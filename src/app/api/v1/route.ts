import { CORE_PAGES, type CorePageDef } from "@/server/blocks";
import { loadOptions, optionSourcesOf } from "@/server/admin/data";
import { RESOURCES } from "@/server/admin/resources";
import { api, describeField } from "@/server/api/content";

/**
 * GET /api/v1 — what this API can do, described from the live site: every
 * content type with its fields and current choices (categories, authors,
 * projects…), and every built-in page's editable texts. A client can read
 * this once and know exactly what to send.
 */
export async function GET(request: Request) {
  return api(request, "content.view", async (user) => {
    const options = await loadOptions(RESOURCES.flatMap(optionSourcesOf));
    return {
      api: "WEF Canada Content API v1",
      signed_in_as: { name: user.name, email: user.email, role: user.role },
      docs: "See CONTENT_API.md in the website's repository.",
      endpoints: {
        "GET /api/v1/content/{type}": "list (query: q, status, page)",
        "POST /api/v1/content/{type}": "create; new items are drafts unless status is \"published\"",
        "GET /api/v1/content/{type}/{id}": "one item",
        "PATCH /api/v1/content/{type}/{id}": "change only the fields you send",
        "DELETE /api/v1/content/{type}/{id}": "move to Trash (restorable in the admin)",
        "POST /api/v1/media": "add an image: JSON {url, alt, caption} or multipart files",
        "GET /api/v1/page-content/{page}": "a built-in page's texts",
        "PATCH /api/v1/page-content/{page}": "change some of them: {\"blocks\": {\"key\": \"text\"}}",
      },
      content_types: RESOURCES.map((r) => ({
        type: r.key,
        name: r.plural,
        description: r.description,
        fields: r.fields.map((f) => describeField(f, options)),
      })),
      pages: Object.fromEntries(
        (Object.entries(CORE_PAGES) as [string, CorePageDef][]).map(([key, p]) => [
          key,
          {
            name: p.label,
            path: p.path,
            blocks: Object.fromEntries(Object.entries(p.blocks).map(([k, b]) => [k, { label: b.label, type: b.type }])),
          },
        ]),
      ),
    };
  });
}
