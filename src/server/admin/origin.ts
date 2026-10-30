import "server-only";

/**
 * Cross-site request check for the admin's route handlers (server actions
 * get the same check from Next.js itself). A browser always sends Origin on
 * a cross-site POST, so a request whose Origin is another site is refused.
 */
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return request.method === "GET";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
