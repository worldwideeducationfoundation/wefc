import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { postHref, SECTION_PATHS } from "@/lib/post-href";
import { articleSchema, breadcrumbSchema, graph } from "@/lib/schema";
import type { PostSection } from "@/lib/types";
import { getPageCopy } from "@/server/blocks";
import { getPost } from "@/server/content";
import { canPreview } from "@/server/preview";
import { getSiteSettings } from "@/server/settings";
import { JsonLd } from "../JsonLd";
import { PreviewBanner } from "../PreviewBanner";
import { RichText } from "../RichText";
import { Calendar, ChevronLeft, Clock, Pin } from "./Icons";

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });

async function load(section: PostSection, params: Promise<{ slug: string }>) {
  const { slug } = await params;
  return getPost(section, decodeURIComponent(slug), { allowDraft: await canPreview() });
}

export async function articleMetadata(section: PostSection, params: Promise<{ slug: string }>): Promise<Metadata> {
  const post = await load(section, params);
  if (!post) return { title: "Page not found" };
  const description = post.seo.description || post.excerpt;
  return {
    title: post.seo.title || post.title,
    description,
    alternates: { canonical: post.href },
    openGraph: {
      type: "article",
      title: post.seo.title || post.title,
      description,
      url: post.href,
      publishedTime: post.publishedAt,
      ...(post.image ? { images: [{ url: post.image.src, width: post.image.width, height: post.image.height, alt: post.image.alt }] } : {}),
    },
    robots: post.status === "draft" ? { index: false, follow: true } : undefined,
  };
}

/** One project update, success story or project page: the old site's article template. */
export async function ArticlePage({ section, params }: { section: PostSection; params: Promise<{ slug: string }> }) {
  const [post, copy, settings] = await Promise.all([load(section, params), getPageCopy("article"), getSiteSettings()]);
  if (!post) notFound();

  const listing = SECTION_PATHS[section];
  const backLabel = copy.t(`back_${section}`);
  const date = post.dateLabel || formatDate(post.publishedAt);
  const cta = {
    heading: post.cta.heading || copy.t("cta_heading"),
    text: post.cta.heading ? (post.cta.text ?? "") : copy.t("cta_text"),
    primaryLabel: post.cta.primaryLabel || copy.t("cta_primary_label"),
    primaryUrl: post.cta.primaryUrl || settings.donateUrl,
    secondaryLabel: post.cta.heading ? post.cta.secondaryLabel : copy.t("cta_secondary_label"),
    secondaryUrl: (post.cta.heading ? post.cta.secondaryUrl : copy.t("cta_secondary_href")) || listing,
  };
  const ext = (h: string) => (/^https?:/.test(h) ? { rel: "noopener", target: "_blank" } : {});

  return (
    <div className="pg-article" style={section === "project" ? ({ "--h1-max": "20ch" } as React.CSSProperties) : undefined}>
      <JsonLd
        data={graph(
          articleSchema(post, { url: postHref(post) }),
          breadcrumbSchema([
            { name: "Home", href: "/" },
            { name: backLabel, href: listing },
            { name: post.title, href: postHref(post) },
          ]),
        )}
      />
      {post.status === "draft" && <PreviewBanner editHref={`/admin/content/posts/${post.id}`} />}
      <section className="proj-hero">
        <span className="proj-orb1" />
        <div className="cx proj-hero-inner">
          <Link className="proj-back" href={listing}>
            <ChevronLeft width="2" /> {backLabel}
          </Link>
          <p className="eyebrow">{copy.t(`eyebrow_${section}`)}</p>
          <h1>{post.title}</h1>
          <div className="proj-meta">
            {post.location && (
              <span>
                <Pin />
                {post.location}
              </span>
            )}
            {date && (
              <span>
                {section === "update" ? <Calendar /> : <Clock />}
                {date}
              </span>
            )}
          </div>
        </div>
      </section>
      <article className="proj-article">
        <div className="cx">
          <RichText doc={post.body} media={post.bodyMedia} />
        </div>
      </article>
      {cta.heading && (
        <section className="proj-cta">
          <div className="proj-cta-inner">
            <div>
              <h2>{cta.heading}</h2>
              {cta.text && <p>{cta.text}</p>}
            </div>
            <div className="proj-cta-actions">
              {cta.primaryLabel && cta.primaryUrl && (
                <a className="proj-btn-solid" href={cta.primaryUrl} {...ext(cta.primaryUrl)}>
                  {cta.primaryLabel}
                </a>
              )}
              {cta.secondaryLabel && cta.secondaryUrl && (
                <a className="proj-btn-line" href={cta.secondaryUrl} {...ext(cta.secondaryUrl)}>
                  {cta.secondaryLabel}
                </a>
              )}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
