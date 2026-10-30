import type { Metadata } from "next";
import { Emph } from "@/components/site/Emph";
import { Gallery } from "@/components/site/Gallery";
import { assertCorePageEnabled, corePageSeo, getPageCopy } from "@/server/blocks";
import { getGallery } from "@/server/content";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await corePageSeo("gallery");
  return { title: seo.title, description: seo.description, alternates: { canonical: "/gallery" } };
}

export default async function GalleryPage() {
  await assertCorePageEnabled("gallery");
  const [copy, gallery] = await Promise.all([getPageCopy("gallery"), getGallery()]);
  const t = copy.t;
  return (
    <div className="pg-gallery">
      <section className="gl-hero">
        <div className="cx gl-hero-inner">
          <p className="eyebrow">{t("hero_eyebrow")}</p>
          <h1>
            <Emph text={t("hero_title")} />
          </h1>
          <p>{t("hero_text")}</p>
        </div>
      </section>
      <section className="gl-body">
        <div className="cx">
          <Gallery photos={gallery.photos} categories={gallery.categories} allLabel={t("all_label")} />
        </div>
      </section>
    </div>
  );
}
