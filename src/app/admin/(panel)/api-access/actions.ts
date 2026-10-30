"use server";

import { revalidatePath } from "next/cache";
import { logActivity } from "@/server/activity";
import { newToken } from "@/server/api/auth";
import { requireUser } from "@/server/auth/session";
import { execute, queryOne } from "@/server/db";

export type TokenState = { token?: string; name?: string; error?: string };

/** Creates a key for the signed-in admin. The key is returned once and never stored. */
export async function createToken(_prev: TokenState, form: FormData): Promise<TokenState> {
  const user = await requireUser();
  const name = String(form.get("name") ?? "").trim().slice(0, 120);
  if (!name) return { error: "Give the key a name, e.g. “Claude on Nauman’s laptop”." };
  const { token, hash, hint } = newToken();
  await execute("INSERT INTO api_tokens (user_id, name, token_hash, token_hint) VALUES (?, ?, ?, ?)", [user.id, name, hash, hint]);
  await logActivity(user.id, "create", "api_keys", name);
  revalidatePath("/admin/api-access");
  return { token, name };
}

/** Revokes a key: one's own, or anyone's for a Super Admin. */
export async function revokeToken(id: number) {
  const user = await requireUser();
  const row = await queryOne<{ user_id: number; name: string }>("SELECT user_id, name FROM api_tokens WHERE id = ?", [id]);
  if (!row || (row.user_id !== user.id && user.role !== "super_admin")) return;
  await execute("UPDATE api_tokens SET revoked_at = UTC_TIMESTAMP() WHERE id = ? AND revoked_at IS NULL", [id]);
  await logActivity(user.id, "revoke", "api_keys", row.name);
  revalidatePath("/admin/api-access");
}
