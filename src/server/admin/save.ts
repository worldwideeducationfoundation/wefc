import "server-only";
import { logActivity } from "../activity";
import { invalidateContent } from "../cache";
import { dbErrorCode, execute, queryOne, transaction } from "../db";
import { loadOptions, optionSourcesOf } from "./data";
import type { ResourceDef } from "./resources";
import { parseFields } from "./validate";

/**
 * Validates and saves one content item. The single save path for every
 * content type, used by the admin's forms and by the Content API alike, so
 * both apply exactly the same checks.
 */
export type SaveResult =
  | { ok: true; id: number; status: "draft" | "published"; values: Record<string, unknown> }
  | { ok: false; message: string; errors?: Record<string, string>; values?: Record<string, unknown>; notFound?: boolean };

export async function saveRecord(
  def: ResourceDef,
  id: number | null,
  form: FormData,
  userId: number,
  { via }: { via?: string } = {},
): Promise<SaveResult> {
  // Select and relation values must be one of the options the form offers.
  const options = await loadOptions(optionSourcesOf(def));
  const selectOptions: Record<string, string[]> = {};
  for (const f of def.fields) {
    if ((f.type === "select" || f.type === "relation") && "optionsFrom" in f && f.optionsFrom) {
      selectOptions[f.name] = (options[f.optionsFrom] ?? []).map((o) => o.value);
    }
  }

  const parsed = parseFields(def.fields, form, { selectOptions });
  const status = form.get("status") === "published" ? "published" : "draft";

  for (const f of def.fields) {
    if (f.type !== "slug" || parsed.errors[f.name]) continue;
    const scope = def.slugScope;
    const clash = await queryOne<{ id: number }>(
      `SELECT id FROM ${def.table} WHERE ${f.name} = ? AND id <> ?${scope ? ` AND ${scope} = ?` : ""} LIMIT 1`,
      scope ? [parsed.data[f.name], id ?? 0, parsed.data[scope]] : [parsed.data[f.name], id ?? 0],
    );
    if (clash) parsed.errors[f.name] = "Another item already uses this address. Choose a different one.";
  }

  if (Object.keys(parsed.errors).length > 0) {
    return { ok: false, message: "Please fix the highlighted fields.", errors: parsed.errors, values: { ...parsed.values, status } };
  }

  const row = { ...parsed.data, status };
  let savedId = id;
  try {
    await transaction(async (conn) => {
      if (id) {
        const res = await execute(`UPDATE ${def.table} SET ? WHERE id = ? AND deleted_at IS NULL`, [row, id], conn);
        if (res.affectedRows === 0) throw new Error("NOT_FOUND");
      } else {
        // New items go to the end of a hand-ordered list. Types ordered by
        // date instead (posts) have no position column at all.
        let position = {};
        if (def.defaultSort === "order") {
          const last = await queryOne<{ m: number | null }>(`SELECT MAX(display_order) AS m FROM ${def.table}`, [], conn);
          position = { display_order: Number(last?.m ?? 0) + 10 };
        }
        const res = await execute(`INSERT INTO ${def.table} SET ?`, [{ ...row, ...position }], conn);
        savedId = res.insertId;
      }
      for (const f of def.fields) {
        if (f.type !== "relation") continue;
        await execute(`DELETE FROM ${f.join.table} WHERE ${f.join.ownKey} = ?`, [savedId], conn);
        const ids = parsed.relations[f.name] ?? [];
        if (ids.length) {
          await execute(
            `INSERT INTO ${f.join.table} (${f.join.ownKey}, ${f.join.otherKey}, position) VALUES ?`,
            [ids.map((other, i) => [savedId, other, i])],
            conn,
          );
        }
      }
    });
  } catch (err) {
    if (err instanceof Error && err.message === "NOT_FOUND") {
      return { ok: false, notFound: true, message: "This item no longer exists — it may have been moved to Trash." };
    }
    if (dbErrorCode(err) === "ER_DUP_ENTRY") {
      return { ok: false, message: "Another item already uses this address.", values: { ...parsed.values, status } };
    }
    console.error("[admin] save failed", err);
    return { ok: false, message: "Could not save. Please try again.", values: { ...parsed.values, status } };
  }

  invalidateContent();
  const title = String(row[def.titleField as keyof typeof row] ?? "").slice(0, 100);
  await logActivity(userId, id ? "update" : "create", def.key, via ? `${title} (${via})` : title);
  return { ok: true, id: savedId!, status, values: { ...parsed.values, status } };
}
