import type { Metadata } from "next";
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { CentersMap } from "@/components/site/CentersMap";
import { DonorboxScript } from "@/components/site/DonorboxScript";
import { Emph } from "@/components/site/Emph";
import { HeroCarousel } from "@/components/site/HeroCarousel";
import { ArrowRight, Check, Dot, External, Eye, Heart, HeartLine, Lock, Shield, VALUE_ICONS } from "@/components/site/Icons";
import { NewsletterForm } from "@/components/site/NewsletterForm";
import { PhotoStrip } from "@/components/site/PhotoStrip";
import { ReachMap } from "@/components/site/ReachMap";
import { HOME_SECTIONS, type HomeSectionKey, corePageSeo, getPageCopy } from "@/server/blocks";
import { getHeroSlides, getLearningCenters, getProgramCards, getStats, getTestimonials } from "@/server/content";
import { getSiteSettings } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await corePageSeo("home");
  return { title: { absolute: seo.title }, description: seo.description, alternates: { canonical: "/" } };
}

/** A figure like "3,000", "+66" or "100+": the number counts up, anything around it stays put. */
function CountUp({ value }: { value: string }) {
  const m = value.match(/^(\D*)([\d,]+)(\D*)$/);
  if (!m) return <>{value}</>;
  const to = Number(m[2].replace(/,/g, ""));
  return (
    <>
      {m[1] && <span className="u">{m[1]}</span>}
      <span data-to={to}>{m[2]}</span>
      {m[3] && <span className="u">{m[3]}</span>}
    </>
  );
}

export default async function HomePage() {
  const [copy, org, settings, slides, strip, programs, stats, testimonials, centers] = await Promise.all([
    getPageCopy("home"),
    getPageCopy("organisation"),
    getSiteSettings(),
    getHeroSlides(),
    getProgramCards("strip"),
    getProgramCards("home"),
    getStats("home"),
    getTestimonials(),
    getLearningCenters(),
  ]);
  const t = copy.t;
  const donate = settings.donateUrl;
  const charity = `Registered Canadian Charity #${settings.charityNumber}`;
  const brochure = copy.image("brochure_file");
  const scholarship = copy.image("scholarship_image");
  const ticker = t("ticker").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

  const sections: Record<HomeSectionKey, () => ReactNode> = {
    vmb: () => (
      <section className="vmb" aria-label="Our vision, mission and belief">
        <div className="container vmb-grid">
          {(
            [
              ["vision", <Eye key="e" />],
              ["mission", <Shield key="s" width="1.7" />],
              ["belief", <HeartLine key="h" />],
            ] as const
          ).map(([k, icon]) => (
            <div key={k} className="vmb-card reveal">
              <div className="vmb-ic">{icon}</div>
              <h2>{org.t(`${k}_heading`)}</h2>
              <p>{org.t(k)}</p>
            </div>
          ))}
        </div>
      </section>
    ),

    ticker: () =>
      ticker.length > 0 && (
        <div className="ticker" aria-hidden="true">
          <div className="ticker-track">
            {/* Twice over, so the scroll loops without a gap. */}
            {[...ticker, ...ticker].map((item, i) => (
              <span key={i} className="ticker-item">
                <Dot />
                {item}
              </span>
            ))}
          </div>
        </div>
      ),

    strip: () => strip.length > 0 && <PhotoStrip eyebrow={t("strip_eyebrow")} title={t("strip_title")} items={strip} />,

    tagline: () => (
      <section className="homeline" aria-label="Our tagline">
        <div className="container">
          <p className="reveal">{t("tagline")}</p>
          <div className="rule reveal" aria-hidden="true" />
        </div>
      </section>
    ),

    brochure: () => (
      <section className="feature" id="featured-brochure">
        <div className="container">
          <div className="feature-head reveal">
            <p className="eyebrow">{t("brochure_eyebrow")}</p>
            <h2>{t("brochure_title")}</h2>
            <p>{t("brochure_text")}</p>
          </div>
          {brochure && (
            <div className="pdfwrap reveal">
              <iframe src={`${brochure.src}#view=FitH&toolbar=1`} title={t("brochure_frame_title")} loading="lazy" />
              <div className="pdfnote">
                <span>{t("brochure_note")}</span>
                <a href={brochure.src} target="_blank" rel="noopener">
                  {t("brochure_open")}
                </a>
              </div>
            </div>
          )}
          <div className="feature-cta reveal">
            <a className="btn btn-donate" href={donate} target="_blank" rel="noopener">
              {t("brochure_donate")}
              <External />
            </a>
            <p className="fine">{t("brochure_fine")}</p>
          </div>
        </div>
      </section>
    ),

    scholarship: () => (
      <section className="feature" id="featured-scholarship">
        <div className="container">
          <div className="feature-head reveal">
            <p className="eyebrow">{t("scholarship_eyebrow")}</p>
            <h2>{t("scholarship_title")}</h2>
            <p>{t("scholarship_text")}</p>
          </div>
          {scholarship && (
            <div className="featgraphic reveal">
              {/* eslint-disable-next-line @next/next/no-img-element -- a wide graphic, stored as WebP */}
              <img src={scholarship.src} width={scholarship.width} height={scholarship.height} alt={scholarship.alt} loading="lazy" decoding="async" />
            </div>
          )}
        </div>
      </section>
    ),

    reach: () => (
      <section className="section reach">
        <div className="container reach-inner">
          <div className="reach-copy reveal">
            <span className="flag">
              <svg viewBox="0 0 512 512" aria-hidden="true">
                <path d="M383.8 351.7c2.5-2.5 105.2-92.4 105.2-92.4l-17.5-7.5c-10-4.9-7.4-11.5-5-17.4 2.4-7.6 20.1-67.3 20.1-67.3s-47.7 10-57.7 12.5c-7.5 2.4-10-2.5-12.5-7.5s-15-32.4-15-32.4-52.6 59.9-55.1 62.3c-10 7.5-20.1 0-17.6-10 0-10 12.6-67.3 12.6-67.3s-30.1 17.4-42.6 22.4c-10 5-15 0-20.1-7.5-2.5-5-32.6-62.3-32.6-62.3s-30 57.3-32.5 62.3c-5 7.5-10 12.5-20 7.5-12.6-5-42.7-22.4-42.7-22.4s12.6 57.3 12.6 67.3c2.5 10-7.5 17.5-17.6 10-2.5-2.4-55.1-62.3-55.1-62.3s-12.5 27.4-15 32.4-5 9.9-12.5 7.5c-10-2.5-57.7-12.5-57.7-12.5s17.6 59.7 20.1 67.3c2.4 5.9 5 12.5-5 17.4L23 259.3s102.6 89.9 105.2 92.4c5.2 5.2 10 10 5 22.5-5.1 15-10.1 30.6-10.1 30.6s95.2-20.1 105.3-22.6c8.7-1.5 12.5 2.6 12.5 7.6 0 5-5 82.4-5 82.4h30l-2.5-10c-2.5-10 2.4-15 12.5-15h30c10 0 15 5 12.5 15l-2.5 10h30s-5-77.4-5-82.4c0-5 3.7-9.1 12.5-7.6 10 2.5 105.2 22.6 105.2 22.6s-5-15.6-10-30.6c-5.1-12.5-.3-17.3 5-22.5z" />
              </svg>
              {t("reach_flag")}
            </span>
            <h2>{t("reach_title")}</h2>
            <p>{t("reach_text")}</p>
          </div>
          <div className="reach-map reveal">
            <ReachMap />
          </div>
        </div>
      </section>
    ),

    programs: () => (
      <section className="section programs" id="programs">
        <div className="container">
          <div className="section-head reveal">
            <p className="eyebrow">{t("programs_eyebrow")}</p>
            <h2>{t("programs_title")}</h2>
            <p>{t("programs_text")}</p>
          </div>
          {programs.map((p, i) => (
            <div key={p.id} className={`program${i % 2 ? " flip" : ""} reveal`}>
              <div className="program-media">
                {p.badge && <span className="program-badge">{p.badge}</span>}
                {p.image && (
                  // eslint-disable-next-line @next/next/no-img-element -- WebP from the media library, cropped by CSS
                  <img src={p.image.src} alt={p.image.alt} width={p.image.width} height={p.image.height} loading="lazy" decoding="async" />
                )}
              </div>
              <div className="program-body">
                <h3>{p.href ? <Link href={p.href}>{p.title}</Link> : p.title}</h3>
                {p.lead && <p className="lead">{p.lead}</p>}
                {p.points.length > 0 && (
                  <ul className="program-points">
                    {p.points.map((pt) => (
                      <li key={pt}>
                        <Check />
                        {pt}
                      </li>
                    ))}
                  </ul>
                )}
                {p.stats.length > 0 && (
                  <div className="program-stats">
                    {p.stats.map((s) => (
                      <div key={s.value + s.label}>
                        <span className="n">{s.value}</span>
                        <span className="l">{s.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    ),

    values: () => (
      <section className="section values">
        <div className="container">
          <div className="section-head reveal">
            <p className="eyebrow on-dark">{t("values_eyebrow")}</p>
            <h2>{t("values_title")}</h2>
            <p>{t("values_text")}</p>
          </div>
          <div className="values-grid">
            {[1, 2, 3, 4].map((n) => (
              <div key={n} className="value reveal">
                <div className="value-ic">{VALUE_ICONS[n - 1]}</div>
                <h3>{t(`value_${n}_title`)}</h3>
                <p>{t(`value_${n}_text`)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    ),

    stories: () =>
      testimonials.length > 0 && (
        <section className="section stories">
          <div className="container">
            <div className="section-head reveal">
              <p className="eyebrow">{t("stories_eyebrow")}</p>
              <h2>{t("stories_title")}</h2>
            </div>
            <div className="stories-grid">
              {testimonials.map((q, i) => (
                <div key={i} className="story reveal">
                  <div className="story-quote">&ldquo;</div>
                  <p className="story-text">{q.quote}</p>
                  <div className="story-by">
                    {q.image && (
                      // eslint-disable-next-line @next/next/no-img-element -- a small portrait
                      <img className="story-avatar" src={q.image.src} alt={q.image.alt} loading="lazy" width={q.image.width} height={q.image.height} />
                    )}
                    <div className="story-by-text">
                      {q.name && <span className="story-name">{q.href ? <Link href={q.href}>{q.name}</Link> : q.name}</span>}
                      {q.context && <span className="story-role">{q.context}</span>}
                      {q.location && <span className="story-loc">{q.location}</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      ),

    impact: () =>
      stats.length > 0 && (
        <section className="impact" id="impact">
          <div className="container">
            <div className="impact-grid">
              {stats.map((s) => (
                <div key={s.label} className="impact-item reveal">
                  <div className="impact-num">
                    <CountUp value={s.value} />
                  </div>
                  <div className="impact-cap">{s.label}</div>
                  {s.note && <div className="impact-sub">{s.note}</div>}
                </div>
              ))}
            </div>
          </div>
        </section>
      ),

    donate: () => (
      <section className="section donate" id="donate">
        <div className="container donate-inner">
          <div className="donate-copy reveal">
            <p className="eyebrow on-dark">{t("donate_eyebrow")}</p>
            <h2>{t("donate_title")}</h2>
            <p>{t("donate_text")}</p>
            <div className="trust-badges">
              <span className="badge">
                <Shield />
                {charity}
              </span>
              <span className="badge">
                <Lock />
                {t("donate_badge_secure")}
              </span>
            </div>
          </div>
          <div className="donate-form reveal">
            <DonorboxScript />
            <iframe
              src={`https://donorbox.org/embed/${settings.donorboxCampaign}?default_interval=o`}
              name="donorbox"
              scrolling="no"
              height="900px"
              width="100%"
              style={{ maxWidth: 500, minWidth: 250, border: 0 }}
              allow="payment"
              title="Donation form"
            />
            <p className="give-charity" style={{ margin: "16px 0 0", fontSize: ".88rem", opacity: 0.72 }}>
              A registered Canadian charity, registration #{settings.charityNumber}. {t("donate_note")} <Link href="/donate">{t("donate_note_link")}</Link>.
            </p>
          </div>
        </div>
      </section>
    ),

    centers: () => (
      <section className="section" id="centers" style={{ background: "var(--paper)", borderTop: "1px solid var(--line)" }}>
        <div className="container">
          <div className="section-head reveal">
            <p className="eyebrow">{t("centers_eyebrow")}</p>
            <h2>{t("centers_title")}</h2>
            <p>{t("centers_text")}</p>
          </div>
          <CentersMap centers={centers} compact />
          <div className="reveal" style={{ marginTop: 34 }}>
            <Link className="btn btn-ghost" href="/centers">
              {t("centers_link")}
              <ArrowRight />
            </Link>
          </div>
        </div>
      </section>
    ),

    newsletter: () => (
      <NewsletterForm
        copy={{
          eyebrow: t("news_eyebrow"),
          title: t("news_title"),
          text: t("news_text"),
          button: t("news_button"),
          note: t("news_note"),
          success: t("news_success"),
        }}
      />
    ),
  };

  const order = copy.order("section_order") as HomeSectionKey[];
  const known = new Set(HOME_SECTIONS.map((s) => s.value));

  return (
    <div className="pg-home">
      <HeroCarousel slides={slides} />
      <section className="hero-intro">
        <div className="container">
          <p className="eyebrow">{t("intro_eyebrow")}</p>
          <h1>
            <Emph text={t("intro_title")} />
          </h1>
          <p className="hero-lead">{t("intro_text")}</p>
          <div className="hero-cta">
            <a className="btn btn-donate" href={donate} rel="noopener" target="_blank">
              {t("intro_donate")}
              <Heart />
            </a>
            <a className="btn btn-ghost" href={t("intro_secondary_href")}>
              {t("intro_secondary")}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M5 12h14M13 6l6 6-6 6" />
              </svg>
            </a>
          </div>
          <p className="hero-trust">
            <Shield />
            {charity}
          </p>
        </div>
      </section>
      {order
        .filter((key) => known.has(key) && copy.on(`show_${key}`))
        .map((key) => (
          <Fragment key={key}>{sections[key]()}</Fragment>
        ))}
    </div>
  );
}
