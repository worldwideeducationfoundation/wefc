import Link from "next/link";
import { collectMediaIds } from "@/lib/richtext";
import type { Section as PageSection } from "@/lib/sections";
import { getPostCards, getStats } from "@/server/content";
import { getMediaRefs } from "@/server/media-refs";
import { getSiteSettings } from "@/server/settings";
import { RichText } from "./RichText";
import { linkProps } from "./site/Emph";
import { PostCardGrid } from "./site/PostCards";

/**
 * Renders the sections of a page built in Admin -> Pages with the same
 * markup and classes as the built-in pages: text sits in the article column
 * (`.proj-article`), cards in the list grid (`.ap-grid`), the closing band is
 * the list pages' `.ap-cta`. The page wrapper carries both page scopes.
 * Section headings are h2; the page title above them is the only h1.
 */
export async function SectionRenderer({ sections }: { sections: PageSection[] }) {
  // One query for every image the page uses.
  const ids = new Set<number>();
  for (const s of sections) {
    if (s.type === "text" || s.type === "imageText") collectMediaIds(s.body, ids);
    if (s.type === "imageText" && s.mediaId) ids.add(s.mediaId);
    if (s.type === "gallery") s.mediaIds.forEach((id) => ids.add(id));
  }
  const needs = new Set(sections.map((s) => s.type));
  const [media, stats, settings] = await Promise.all([
    getMediaRefs(ids),
    needs.has("stats") ? getStats("home") : null,
    getSiteSettings(),
  ]);

  const rendered = await Promise.all(
    sections.map(async (s) => {
      const head = s.title || s.eyebrow ? (
        <>
          {s.eyebrow && <p className="eyebrow">{s.eyebrow}</p>}
          {s.title && <h2>{s.title}</h2>}
        </>
      ) : null;
      const alt = s.ground !== "sand" ? { background: "var(--paper)", borderTop: "1px solid var(--line)" } : undefined;
      const column = (children: React.ReactNode) => (
        <article key={s.id} className="proj-article" style={alt}>
          <div className="cx">
            {head}
            {children}
          </div>
        </article>
      );

      switch (s.type) {
        case "text":
          return column(<RichText doc={s.body} media={media} />);
        case "imageText": {
          const image = s.mediaId ? media[s.mediaId] : undefined;
          return column(
            <>
              {image && s.imageSide === "left" && (
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element -- WebP from the media library */}
                  <img src={image.src} width={image.width} height={image.height} alt={image.alt} loading="lazy" />
                </figure>
              )}
              <RichText doc={s.body} media={media} />
              {image && s.imageSide !== "left" && (
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element -- WebP from the media library */}
                  <img src={image.src} width={image.width} height={image.height} alt={image.alt} loading="lazy" />
                </figure>
              )}
            </>,
          );
        }
        case "stats": {
          const items = s.source === "custom" ? s.items : (stats ?? []);
          return column(
            <div className="proj-stats">
              {items.map((it, i) => (
                <div key={i}>
                  <span className="n">{it.value}</span>
                  <span className="l">{it.label}</span>
                </div>
              ))}
            </div>,
          );
        }
        case "gallery":
          return column(
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 }}>
              {s.mediaIds
                .map((id) => media[id])
                .filter(Boolean)
                .map((m, i) => (
                  // eslint-disable-next-line @next/next/no-img-element -- WebP from the media library
                  <img
                    key={i}
                    src={m.src}
                    width={m.width}
                    height={m.height}
                    alt={m.alt}
                    loading="lazy"
                    style={{ width: "100%", aspectRatio: "4 / 3", objectFit: "cover", borderRadius: 14 }}
                  />
                ))}
            </div>,
          );
        case "videos":
          return column(
            <RichText doc={{ type: "doc", content: s.items.map((v) => ({ type: "video", attrs: { url: v.url } })) }} />,
          );
        case "projects":
        case "posts": {
          const posts =
            s.type === "projects"
              ? await getPostCards({ section: "project" })
              : (await getPostCards(s.section === "all" ? {} : { section: s.section }))
                  .filter((p) => p.section !== "project")
                  .slice(0, s.limit);
          return (
            <section key={s.id} className="ap-section" style={alt}>
              <div className="cx">
                {head && <div className="ap-head">{head}</div>}
                <PostCardGrid posts={posts} readMore="Read more" />
              </div>
            </section>
          );
        }
        case "quote":
          return column(
            <blockquote>
              <p>{s.quote}</p>
              {s.attribution && <p>— {s.attribution}</p>}
            </blockquote>,
          );
        case "cta":
          return (
            <section key={s.id} className="ap-cta">
              <div className="cx ap-cta-inner">
                <div>
                  {s.title && <h2>{s.title}</h2>}
                  {s.body && <p>{s.body}</p>}
                </div>
                <div className="ap-cta-actions">
                  <CtaLink className="ap-btn-solid" href={s.actionHref === "donate" ? settings.donateUrl : s.actionHref} label={s.actionLabel} />
                  {s.secondaryLabel && s.secondaryHref && <CtaLink className="ap-btn-line" href={s.secondaryHref} label={s.secondaryLabel} />}
                </div>
              </div>
            </section>
          );
      }
    }),
  );
  return <>{rendered}</>;
}

function CtaLink({ className, href, label }: { className: string; href: string; label: string }) {
  return /^https?:/.test(href) ? (
    <a className={className} {...linkProps(href)}>
      {label}
    </a>
  ) : (
    <Link className={className} href={href}>
      {label}
    </Link>
  );
}
