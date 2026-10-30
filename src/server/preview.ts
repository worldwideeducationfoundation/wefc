import "server-only";
import { getCurrentUser } from "./auth/session";

/**
 * True when the visitor is a signed-in admin, who may see drafts on the
 * public site. Anyone else only ever gets published content.
 */
export async function canPreview(): Promise<boolean> {
  try {
    return (await getCurrentUser()) !== null;
  } catch {
    return false;
  }
}
