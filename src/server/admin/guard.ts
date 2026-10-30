import "server-only";
import type { Capability } from "../auth/roles";
import { ForbiddenError, requireCapability } from "../auth/session";

/**
 * Wraps a server action body so a missing permission comes back as a message
 * the form can show, instead of an error page.
 */
export type ActionResult = { ok: boolean; message?: string; errors?: Record<string, string>; values?: Record<string, unknown> };

export async function guarded<T extends ActionResult>(
  capability: Capability,
  fn: (user: Awaited<ReturnType<typeof requireCapability>>) => Promise<T>,
): Promise<T | ActionResult> {
  try {
    const user = await requireCapability(capability);
    return await fn(user);
  } catch (err) {
    if (err instanceof ForbiddenError) return { ok: false, message: "You do not have permission to do that." };
    throw err;
  }
}
