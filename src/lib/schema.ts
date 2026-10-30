import { absoluteUrl, siteUrl } from "./site-url";
import type { Post, PostCard, SiteSettings } from "./types";

/**
 * JSON-LD builders.
 *
 * Every value here is derived from content that already exists — the
 * organisation details in Admin -> Settings, or the post's own fields. Nothing is written specially for search engines:
 * structured data that disagrees with the page is worse than none.
 *
 * `@id` values are stable URLs so the Organization and WebSite nodes can
 * be referenced from every page instead of being restated in full.
 */
const ORG_ID = `${siteUrl}/#organization`;
const SITE_ID = `${siteUrl}/#website`;

type Json = Record<string, unknown>;

export function organizationSchema(siteSettings: SiteSettings, programTitles: string[] = []): Json {
  const { address } = siteSettings;

  return {
    "@type": "NGO",
    "@id": ORG_ID,
    name: siteSettings.name,
    alternateName: siteSettings.shortName,
    url: siteUrl,
    email: siteSettings.email,
    telephone: siteSettings.phone,
    description: siteSettings.description,
    logo: {
      "@type": "ImageObject",
      url: absoluteUrl("/brand/wefc-logo.webp"),
    },
    ...(siteSettings.charityNumber ? { taxID: siteSettings.charityNumber } : {}),
    address: {
      "@type": "PostalAddress",
      streetAddress: address.line1,
      addressLocality: address.line2,
      addressRegion: address.region,
      postalCode: address.postcode,
      addressCountry: "CA",
    },
    areaServed: ["Chitral, Pakistan", "Tajikistan", "Kyrgyzstan"],
    /* The programmes are the organisation's actual services, and they
       are the terms people search for. */
    ...(programTitles.length ? { knowsAbout: programTitles } : {}),
    slogan: siteSettings.tagline,
    ...(siteSettings.socials.length ? { sameAs: siteSettings.socials.map((s) => s.href) } : {}),
  };
}

export function webSiteSchema(siteSettings: SiteSettings): Json {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    url: siteUrl,
    name: siteSettings.name,
    description: siteSettings.description,
    inLanguage: "en",
    publisher: { "@id": ORG_ID },
  };
}

/** A breadcrumb trail. Pairs with the visible <Breadcrumbs /> component. */
export function breadcrumbSchema(
  crumbs: { name: string; href: string }[],
): Json {
  return {
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((crumb, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: crumb.name,
      item: absoluteUrl(crumb.href),
    })),
  };
}

/** One article: a project update, success story or project page. */
export function articleSchema(post: Post, { url }: { url: string }): Json {
  const image = post.image ? absoluteUrl(post.image.src) : undefined;

  return {
    "@type": "Article",
    "@id": `${absoluteUrl(url)}#article`,
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    inLanguage: "en",
    mainEntityOfPage: { "@type": "WebPage", "@id": absoluteUrl(url) },
    ...(image ? { image: [image] } : {}),
    ...(post.author?.name
      ? { author: { "@type": "Person", name: post.author.name } }
      : {}),
    publisher: { "@id": ORG_ID },
    ...(post.categories?.length
      ? { articleSection: post.categories.map((c) => c.title) }
      : {}),
  };
}

/** A listing page, so the section itself is a crawlable entity. */
export function collectionSchema({
  name,
  description,
  url,
  posts,
}: {
  name: string;
  description: string;
  url: string;
  posts: PostCard[];
}): Json {
  return {
    "@type": "CollectionPage",
    "@id": `${absoluteUrl(url)}#collection`,
    name,
    description,
    url: absoluteUrl(url),
    isPartOf: { "@id": SITE_ID },
    publisher: { "@id": ORG_ID },
    mainEntity: {
      "@type": "ItemList",
      numberOfItems: posts.length,
      itemListElement: posts.map((post, i) => ({
        "@type": "ListItem",
        position: i + 1,
        url: absoluteUrl(post.href),
        name: post.title,
      })),
    },
  };
}

/**
 * Wrap nodes into a single `@graph`.
 *
 * The Organization and WebSite nodes are emitted once, by the root
 * layout, and every other node refers to them by `@id`. Restating them
 * per page would put the same `@id` in two script tags on one document,
 * which is what a consumer sees as a conflicting duplicate entity.
 */
export function graph(...nodes: Json[]): Json {
  return { "@context": "https://schema.org", "@graph": nodes };
}

/** The site-wide nodes. Rendered once, in the root layout. */
export function siteGraph(siteSettings: SiteSettings, programTitles: string[] = []): Json {
  return graph(organizationSchema(siteSettings, programTitles), webSiteSchema(siteSettings));
}
