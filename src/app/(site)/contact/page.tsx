import type { Metadata } from "next";
import { ContactForm } from "@/components/site/ContactForm";
import { Emph } from "@/components/site/Emph";
import { Mail, MapPin, Phone, SOCIAL_ICONS, Star } from "@/components/site/Icons";
import { corePageSeo, getPageCopy } from "@/server/blocks";
import { getSiteSettings } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await corePageSeo("contact");
  return { title: seo.title, description: seo.description, alternates: { canonical: "/contact" } };
}

export default async function ContactPage() {
  const [copy, s] = await Promise.all([getPageCopy("contact"), getSiteSettings()]);
  const t = copy.t;
  const socials = s.socials.filter((x) => x.key !== "trustpilot");

  return (
    <div className="pg-contact">
      <section className="ct-hero">
        <div className="cx ct-hero-inner">
          <p className="eyebrow">{t("hero_eyebrow")}</p>
          <h1>
            <Emph text={t("hero_title")} />
          </h1>
          <p>{t("hero_text")}</p>
        </div>
      </section>
      <section className="ct-body">
        <div className="cx ct-grid">
          <div className="ct-info">
            <h2>{t("info_title")}</h2>
            <p className="lead">{t("info_text")}</p>
            <div className="ct-lines">
              {s.email && (
                <a className="ct-line" href={`mailto:${s.email}`}>
                  <span className="ct-ic">
                    <Mail />
                  </span>
                  <span>
                    <span className="k">Email</span>
                    <span className="v">{s.email}</span>
                  </span>
                </a>
              )}
              {s.phone && (
                <a className="ct-line" href={`tel:${s.phoneHref}`}>
                  <span className="ct-ic">
                    <Phone />
                  </span>
                  <span>
                    <span className="k">Phone</span>
                    <span className="v">{s.phone}</span>
                  </span>
                </a>
              )}
              {s.addressLine && (
                <a
                  className="ct-line"
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.addressLine)}`}
                  rel="noopener"
                  target="_blank"
                >
                  <span className="ct-ic">
                    <MapPin />
                  </span>
                  <span>
                    <span className="k">Address</span>
                    <span className="v">{s.addressLine}</span>
                  </span>
                </a>
              )}
            </div>
            {socials.length > 0 && (
              <>
                <p className="ct-social-label">{t("follow")}</p>
                <div className="ct-socials">
                  {socials.map((x) => (
                    <a key={x.key} href={x.href} rel="noopener" target="_blank" aria-label={x.label}>
                      {SOCIAL_ICONS[x.key]}
                    </a>
                  ))}
                </div>
              </>
            )}
          </div>
          <ContactForm
            topics={s.contactTopics}
            email={s.email}
            copy={{
              title: t("form_title"),
              text: t("form_text"),
              optinTitle: t("optin_title"),
              optinText: t("optin_text"),
              button: t("button"),
              success: t("success"),
              direct: t("direct"),
            }}
          />
        </div>
      </section>
      {s.trustpilot && (
        <section className="ct-review">
          <div className="ct-review-inner">
            <div className="ct-stars" aria-hidden="true">
              {[0, 1, 2, 3, 4].map((i) => (
                <Star key={i} />
              ))}
            </div>
            <h2>{t("review_title")}</h2>
            <p>{t("review_text")}</p>
            <a href={s.trustpilot} rel="noopener" target="_blank">
              {t("review_link")}
            </a>
          </div>
        </section>
      )}
    </div>
  );
}
