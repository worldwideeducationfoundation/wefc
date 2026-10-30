/**
 * The site's production origin.
 *
 * Canonical URLs, Open Graph tags, the sitemap and the JSON-LD graph all
 * have to agree on one absolute origin, and it must never be the Vercel
 * preview host — a canonical pointing at `*.vercel.app` tells Google the
 * preview is the real site.
 *
 * Set `NEXT_PUBLIC_SITE_URL` in the host's environment panel to move the
 * site to its custom domain without a code change. It is read at build
 * time (NEXT_PUBLIC_*), so changing it needs a redeploy, not just a save.
 */
const FALLBACK_ORIGIN = "https://wefcanada.org";

function readOrigin(): string {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return FALLBACK_ORIGIN;

  /* A bare host ("wefcanada.org") is the likeliest way to get this
     wrong; treat it as https rather than emitting a relative URL. */
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    return new URL(withScheme).origin;
  } catch {
    return FALLBACK_ORIGIN;
  }
}

export const siteUrl = readOrigin();

/** Absolute URL for a site-relative path. */
export function absoluteUrl(path = "/"): string {
  return new URL(path, `${siteUrl}/`).toString();
}
