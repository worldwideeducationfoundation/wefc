import type { Metadata } from "next";
import { collectionSchema, graph } from "@/lib/schema";
import type { PostSection } from "@/lib/types";
import { corePageSeo, getPageCopy } from "@/server/blocks";
import { getCategories, getPostCards } from "@/server/content";
import { getSiteSettings } from "@/server/settings";
import { JsonLd } from "../JsonLd";
import { FilteredPosts } from "./FilteredPosts";
import { ListCta, ListHero } from "./ListHero";

const PAGE: Record<PostSection, { key: "updates" | "stories" | "projects"; path: string }> = {
  update: { key: "updates", path: "/updates" },
  story: { key: "stories", path: "/stories" },
  project: { key: "projects", path: "/projects" },
};

export async function listMetadata(section: PostSection): Promise<Metadata> {
  const { key, path } = PAGE[section];
  const seo = await corePageSeo(key);
  return { title: seo.title, description: seo.description, alternates: { canonical: path } };
}

/** Project Updates, Success Stories and Active Projects: one page, three kinds of post. */
export async function PostListPage({ section }: { section: PostSection }) {
  const { key, path } = PAGE[section];
  const [copy, posts, categories, settings, seo] = await Promise.all([
    getPageCopy(key),
    getPostCards({ section }),
    getCategories(),
    getSiteSettings(),
    corePageSeo(key),
  ]);

  return (
    <div className="pg-list">
      <JsonLd data={graph(collectionSchema({ name: seo.title, description: seo.description ?? "", url: path, posts }))} />
      <ListHero eyebrow={copy.t("hero_eyebrow")} title={copy.t("hero_title")} text={copy.t("hero_text")} />
      <section className="ap-section">
        <div className="cx">
          <div className="ap-head">
            <p className="eyebrow">{copy.t("list_eyebrow")}</p>
            <h2>{copy.t("list_title")}</h2>
            <p>{copy.t("list_text")}</p>
          </div>
          {posts.length ? (
            <FilteredPosts posts={posts} categories={categories} readMore={copy.t("read_more")} />
          ) : (
            <div className="ap-empty">
              <p>{copy.t("empty")}</p>
            </div>
          )}
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
