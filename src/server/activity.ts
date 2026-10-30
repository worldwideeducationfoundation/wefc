import "server-only";
import { execute } from "./db";
import { clientIp } from "./request";

/**
 * The audit trail behind Admin -> Activity Log: who changed what, and when.
 * Never allowed to break the action it records — a failed log write is
 * reported to the server log and swallowed.
 */
export async function logActivity(
  userId: number | null,
  action: string,
  module: string,
  details?: string | null,
) {
  try {
    await execute(
      "INSERT INTO activity_logs (user_id, action, module, details, ip_address) VALUES (?, ?, ?, ?, ?)",
      [userId, action.slice(0, 40), module.slice(0, 60), details?.slice(0, 255) ?? null, await clientIp()],
    );
  } catch (err) {
    console.error("[activity] could not record", action, module, err);
  }
}
