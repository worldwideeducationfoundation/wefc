import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";

/**
 * `/admin/` is disallowed: it is the sign-in page and nothing a search
 * engine should list. Everything else is open — this is a small site that
 * wants to be found.
 *
 * The host is the canonical origin, never the Vercel preview URL, so a
 * preview deployment does not advertise its own sitemap.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/"] },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
