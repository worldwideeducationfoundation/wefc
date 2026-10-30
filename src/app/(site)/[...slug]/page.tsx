import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewBanner } from "@/components/PreviewBanner";
import { SectionRenderer } from "@/components/SectionRenderer";
import { ListHero } from "@/components/site/ListHero";
import { normalizeSections } from "@/lib/sections";
import { getBuiltPage } from "@/server/content";
import { canPreview } from "@/server/preview";

type Params = { slug: string[] };

/**
 * Pages built in Admin -> Pages, served at their own address.
 *
 * This route only receives addresses no other route claims, so a built page
 * can never shadow a built-in one (the admin also refuses those addresses).
 * Anything that is not a published page is a 404 — except for a signed-in
 * admin previewing a draft.
 */
async function load(params: Promise<Params>) {
  const { slug } = await params;
  const path = slug.map((s) => decodeURIComponent(s)).join("/").toLowerCase();
  return getBuiltPage(path, { allowDraft: await canPreview() });
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const page = await load(params);
  if (!page) return { title: "Page not found" };
  return {
    title: page.seoTitle || page.title,
    description: page.seoDescription || page.lede || undefined,
    alternates: { canonical: `/${page.slug}` },
    robots: page.noindex || page.status === "draft" ? { index: false, follow: true } : undefined,
  };
}

export default async function BuiltPage({ params }: { params: Promise<Params> }) {
  const page = await load(params);
  if (!page) notFound();

  return (
    <div className="pg-list pg-article">
      {page.status === "draft" && <PreviewBanner editHref={`/admin/pages/${page.id}`} />}
      <ListHero eyebrow={page.eyebrow || ""} title={page.title} text={page.lede || ""} />
      <SectionRenderer sections={normalizeSections(page.sections)} />
    </div>
  );
}
