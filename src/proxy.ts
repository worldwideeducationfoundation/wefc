import { type NextRequest, NextResponse } from "next/server";

/**
 * A quick first check for the admin: no session cookie means straight to the
 * sign-in page. This only looks at whether the cookie exists — the real check
 * (is the session valid, is the account active, may this role do this) runs
 * on the server for every admin page and every action.
 */
const OPEN = ["/admin/login", "/admin/setup"];

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (OPEN.some((p) => pathname === p || pathname.startsWith(`${p}/`))) return NextResponse.next();

  if (!request.cookies.get("wefc_admin")?.value) {
    const url = request.nextUrl.clone();
    url.pathname = "/admin/login";
    url.search = pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

/* /admin/api is left out: those routes answer 403 themselves (a fetch should
   not be redirected to an HTML page), and a request that passes through the
   proxy has its body buffered and capped at 10 MB — too small for image
   uploads and backup restores. */
export const config = {
  matcher: ["/admin", "/admin/((?!api/).*)"],
};
