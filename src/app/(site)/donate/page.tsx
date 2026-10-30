import type { Metadata } from "next";
import Link from "next/link";
import { RichText } from "@/components/RichText";
import { Emph } from "@/components/site/Emph";
import { DonorboxScript } from "@/components/site/DonorboxScript";
import { corePageSeo, getPageCopy } from "@/server/blocks";
import { getFaqs, getStats } from "@/server/content";
import { getSiteSettings } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await corePageSeo("donate");
  return { title: seo.title, description: seo.description, alternates: { canonical: "/donate" } };
}

export default async function DonatePage() {
  const [copy, s, figures, { faqs, media }] = await Promise.all([getPageCopy("donate"), getSiteSettings(), getStats("donate"), getFaqs()]);
  const t = copy.t;
  const embed = `https://donorbox.org/embed/${s.donorboxCampaign}`;

  return (
    <div className="pg-donate">
      <DonorboxScript />
      <section className="give-hero">
        <div className="cx">
          <div className="give-top">
            <div className="give-top-copy">
              <p className="eyebrow">{t("hero_eyebrow")}</p>
              <h1>
                <Emph text={t("hero_title")} />
              </h1>
              <p className="intro">{t("hero_text")}</p>
              <p className="give-charity">{t("hero_charity").replace("{charity}", s.charityNumber)}</p>
            </div>
            <div className="give-top-widget ct-form-wrap">
              <iframe
                src={`${embed}?default_interval=o`}
                name="donorbox"
                scrolling="no"
                height="900px"
                width="100%"
                style={{ maxWidth: 500, minWidth: 250, border: 0 }}
                allow="payment"
                title="Donation form"
              />
            </div>
          </div>
          <div className="give-meter">
            <iframe
              height="93px"
              width="100%"
              src={`${embed}?donation_meter_color=%232ecc71&only_donation_meter=true`}
              style={{ maxWidth: 500, minWidth: 250, minHeight: 90, border: 0 }}
              name="donorbox"
              scrolling="no"
              title="Donation progress"
            />
          </div>
          {figures.length > 0 && (
            <div className="give-figures">
              {figures.map((f) => (
                <div key={f.label} className="give-fig">
                  <span className="n">{f.value}</span>
                  <span className="l">{f.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="give-where">
        <div className="cx">
          <h2>{t("where_title")}</h2>
          <p>{t("where_text")}</p>
          <div className="give-programs">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="give-prog">
                <h3>{t(`where_${n}_title`)}</h3>
                <p>{t(`where_${n}_text`)}</p>
                {t(`where_${n}_href`) && <Link href={t(`where_${n}_href`)}>{t(`where_${n}_link`)}</Link>}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="give-faq">
        <div className="cx">
          <h2>{t("faq_title")}</h2>
          <dl>
            {faqs.map((f) => (
              <div key={f.question} style={{ display: "contents" }}>
                <dt>{f.question}</dt>
                <dd>
                  <RichText doc={f.answer} media={media} />
                </dd>
              </div>
            ))}
          </dl>
          <div className="give-close">
            <p>{t("close_text")}</p>
            <p>
              <a className="give-cta" href={s.donateUrl} rel="noopener" target="_blank">
                {t("close_button")}
                <svg viewBox="0 0 24 24" aria-hidden="true" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 17 17 7M9 7h8v8" />
                </svg>
              </a>
            </p>
          </div>
        </div>
      </section>

      <section className="give-donors">
        <div className="cx">
          <h2>{t("donors_title")}</h2>
          <p>{t("donors_text")}</p>
          <iframe
            height="93px"
            width="100%"
            src={`${embed}?donor_wall_color=%232ecc71&only_donor_wall=true`}
            style={{ width: "100%", maxWidth: 500, minWidth: 310, minHeight: 345, border: 0 }}
            name="donorbox"
            scrolling="no"
            title="Donor wall"
          />
        </div>
      </section>
    </div>
  );
}
