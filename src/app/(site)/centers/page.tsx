import type { Metadata } from "next";
import { CentersMap } from "@/components/site/CentersMap";
import { Emph } from "@/components/site/Emph";
import { Heart, Info, Shield } from "@/components/site/Icons";
import { assertCorePageEnabled, corePageSeo, getPageCopy } from "@/server/blocks";
import { getLearningCenters } from "@/server/content";
import { getSiteSettings } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await corePageSeo("centers");
  return { title: seo.title, description: seo.description, alternates: { canonical: "/centers" } };
}

export default async function CentersPage() {
  await assertCorePageEnabled("centers");
  const [copy, centers, settings] = await Promise.all([getPageCopy("centers"), getLearningCenters(), getSiteSettings()]);
  const t = copy.t;
  const stats = t("stats")
    .split(/\r?\n/)
    .map((l) => l.split("|").map((s) => s.trim()))
    .filter(([v]) => v);

  return (
    <div className="pg-centers">
      <section className="centers-hero">
        <div className="cx">
          <p className="centers-eyebrow">
            <Shield />
            {t("hero_eyebrow")}
          </p>
          <h1>
            <Emph text={t("hero_title")} />
          </h1>
          <p className="lead">{t("hero_text")}</p>
          <div className="centers-stats">
            {stats.map(([value, label]) => (
              <div key={label} className="centers-stat">
                <div className="n">
                  {value.replace(/\+$/, "")}
                  {value.endsWith("+") && <span className="u">+</span>}
                </div>
                <div className="l">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="centers-body">
        <div className="cx">
          <div className="centers-intro">
            <h2>{t("map_title")}</h2>
            <p>{t("map_text")}</p>
          </div>
          <CentersMap centers={centers} />
          <p className="centers-note">
            <Info />
            <span>{t("map_note")}</span>
          </p>
        </div>
      </section>
      <section className="centers-cta">
        <div className="cx centers-cta-inner">
          <div>
            <h2>{t("cta_heading")}</h2>
            <p>{t("cta_text")}</p>
          </div>
          <a className="centers-cta-btn" href={settings.donateUrl} rel="noopener" target="_blank">
            <Heart />
            {t("cta_button")}
          </a>
        </div>
      </section>
    </div>
  );
}
