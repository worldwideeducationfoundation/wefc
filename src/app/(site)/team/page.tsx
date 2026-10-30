import type { Metadata } from "next";
import Link from "next/link";
import { Emph } from "@/components/site/Emph";
import { TeamGrid } from "@/components/site/TeamGrid";
import { assertCorePageEnabled, corePageSeo, getPageCopy } from "@/server/blocks";
import { getTeamGroups } from "@/server/content";
import { getSiteSettings } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await corePageSeo("team");
  return { title: seo.title, description: seo.description, alternates: { canonical: "/team" } };
}

export default async function TeamPage() {
  await assertCorePageEnabled("team");
  const [copy, groups, settings] = await Promise.all([getPageCopy("team"), getTeamGroups(), getSiteSettings()]);
  const t = copy.t;
  const secondary = t("cta_secondary_href");

  return (
    <div className="pg-team">
      <section className="tm-hero">
        <span className="tm-orb1" />
        <span className="tm-orb2" />
        <div className="cx tm-hero-inner">
          <p className="eyebrow">{t("hero_eyebrow")}</p>
          <h1>
            <Emph text={t("hero_title")} />
          </h1>
          <p>{t("hero_text")}</p>
        </div>
      </section>

      {groups.map((g, i) => (
        <section key={g.heading} className={`tm-section${i % 2 === 0 ? " tm-alt" : ""}`}>
          <div className="cx">
            <div className="tm-head">
              {g.eyebrow && <p className="eyebrow">{g.eyebrow}</p>}
              <h2>{g.heading}</h2>
              {g.description && <p>{g.description}</p>}
            </div>
            <TeamGrid members={g.members} bioLabel={t("bio_button")} first={i === 0} />
          </div>
        </section>
      ))}

      <section className="tm-cta">
        <div className="cx tm-cta-inner">
          <div>
            <h2>{t("cta_heading")}</h2>
            <p>{t("cta_text")}</p>
          </div>
          <div className="tm-cta-actions">
            <a className="tm-btn-solid" href={settings.donateUrl} rel="noopener" target="_blank">
              {t("cta_primary_label")}
            </a>
            <Link className="tm-btn-line" href={secondary}>
              {t("cta_secondary_label")}
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
