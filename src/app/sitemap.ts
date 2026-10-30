import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site-url";
import { CORE_PAGES, type CorePageDef, disabledCorePaths } from "@/server/blocks";
import { getCategories, getPostCards, getPublishedPageSlugs } from "@/server/content";

export const dynamic = "force-dynamic";

/**
 * The sitemap is derived from the same data the pages render, so a post,
 * topic or page published in the admin appears here at once. Built-in pages
 * that are switched off are left out.
 */
const PRIORITY: Record<string, number> = {
  "/": 1,
  "/donate": 0.9,
  "/projects": 0.9,
  "/mission": 0.8,
  "/updates": 0.8,
  "/stories": 0.8,
  "/centers": 0.7,
  "/team": 0.7,
  "/contact": 0.7,
};

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl;
  const now = new Date();

  try {
    const [hidden, posts, categories, pages] = await Promise.all([
      disabledCorePaths(),
      getPostCards(),
      getCategories(),
      getPublishedPageSlugs(),
    ]);

    const core = (Object.values(CORE_PAGES) as CorePageDef[])
      .map((p) => p.path)
      .filter((p): p is string => Boolean(p) && !hidden.has(p!));

    return [
      ...core.map((path) => ({
        url: `${base}${path === "/" ? "" : path}`,
        lastModified: now,
        changeFrequency: "monthly" as const,
        priority: PRIORITY[path] ?? 0.6,
      })),
      ...posts.map((p) => ({
        url: `${base}${p.href}`,
        lastModified: new Date(p.publishedAt),
        changeFrequency: "monthly" as const,
        priority: p.section === "project" ? 0.8 : 0.7,
      })),
      ...categories.map((c) => ({
        url: `${base}/topics/${c.slug}`,
        lastModified: now,
        changeFrequency: "weekly" as const,
        priority: 0.5,
      })),
      ...pages
        .filter((p) => !p.noindex)
        .map((p) => ({
          url: `${base}/${p.slug}`,
          lastModified: new Date(p.updatedAt),
          changeFrequency: "monthly" as const,
          priority: 0.6,
        })),
    ];
  } catch {
    // A database outage must not take the sitemap down; the home page is still worth listing.
    return [{ url: base, lastModified: now, changeFrequency: "monthly", priority: 1 }];
  }
}
