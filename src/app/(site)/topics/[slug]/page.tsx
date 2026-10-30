import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JsonLd } from "@/components/JsonLd";
import { ListCta, ListHero } from "@/components/site/ListHero";
import { PostCardGrid } from "@/components/site/PostCards";
import { collectionSchema, graph } from "@/lib/schema";
import { getPageCopy } from "@/server/blocks";
import { getCategories, getCategory, getPostCards } from "@/server/content";
import { getSiteSettings } from "@/server/settings";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const topic = await getCategory((await params).slug);
  if (!topic) return { title: "Page not found" };
  return {
    title: topic.seoTitle || topic.title,
    description: topic.seoDescription || topic.description || undefined,
    alternates: { canonical: `/topics/${topic.slug}` },
  };
}

/** A topic's own page: everything tagged with it, across updates, stories and projects. */
export default async function TopicPage({ params }: Props) {
  const { slug } = await params;
  const [topic, topics, posts, copy, settings] = await Promise.all([
    getCategory(slug),
    getCategories(),
    getPostCards({ categorySlug: slug }),
    getPageCopy("topics"),
    getSiteSettings(),
  ]);
  if (!topic) notFound();

  return (
    <div className="pg-list">
      <JsonLd
        data={graph(collectionSchema({ name: topic.title, description: topic.description ?? "", url: `/topics/${topic.slug}`, posts }))}
      />
      <ListHero eyebrow={copy.t("eyebrow")} title={topic.title} text={topic.description || `Everything from WEF's work tagged ${topic.title}.`} />
      <section className="ap-section">
        <div className="cx">
          <div className="ap-head">
            <p className="eyebrow">
              {posts.length} {posts.length === 1 ? "article" : "articles"}
            </p>
            <h2>{copy.t("list_title").replace("{topic}", topic.title)}</h2>
            <p>{copy.t("list_text")}</p>
          </div>
          <nav className="ap-filters" aria-label="Topics">
            {topics.map((t) => (
              <Link key={t.slug} className="ap-filter" href={`/topics/${t.slug}`} aria-current={t.slug === topic.slug ? "page" : undefined}>
                {t.title}
              </Link>
            ))}
          </nav>
          <PostCardGrid posts={posts} readMore="Read more" />
        </div>
      </section>
      <ListCta
        heading={copy.t("cta_heading")}
        text={copy.t("cta_text")}
        primaryLabel={copy.t("cta_primary_label")}
        primaryHref={settings.donateUrl}
        secondaryLabel={copy.t("cta_secondary_label")}
        secondaryHref={copy.t("cta_secondary_href")}
      />
    </div>
  );
}
