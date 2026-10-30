import type { Metadata } from "next";
import Link from "next/link";
import { Emph } from "@/components/site/Emph";
import { ArrowRight, Eye, Heart, HeartLine, Shield } from "@/components/site/Icons";
import type { ProgramCard } from "@/lib/types";
import { assertCorePageEnabled, corePageSeo, getPageCopy } from "@/server/blocks";
import { getProgramCards, getStats } from "@/server/content";
import { getSiteSettings } from "@/server/settings";

export async function generateMetadata(): Promise<Metadata> {
  const seo = await corePageSeo("mission");
  return { title: seo.title, description: seo.description, alternates: { canonical: "/mission" } };
}

/** A figure like "100+": the trailing sign is drawn in the accent colour. */
function Figure({ value }: { value: string }) {
  const m = value.match(/^(.*?)(\+)$/);
  return m ? (
    <>
      {m[1]}
      <span className="u">+</span>
    </>
  ) : (
    <>{value}</>
  );
}

const isInvestment = (line: string) => /^(projected|total) investment/i.test(line);

function Details({ card }: { card: ProgramCard }) {
  return (
    <>
      {card.columns.length > 0 && (
        <div className="pcols">
          {card.columns.map((col) => (
            <div key={col.heading} className="pcol">
              <h4>{col.heading}</h4>
              <ul>
                {col.items.map((it) => (
                  <li key={it}>{it}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
      {card.notes.length > 0 && (
        <div className="pnotes">
          <div className="pnotes-inner">
            <h4>Notes</h4>
            <ul>
              {card.notes.map((n) => (
                <li key={n} className={isInvestment(n) ? "invest" : undefined}>
                  {n}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

export default async function MissionPage() {
  await assertCorePageEnabled("mission");
  const [copy, org, stats, rows, settings] = await Promise.all([
    getPageCopy("mission"),
    getPageCopy("organisation"),
    getStats("mission"),
    getProgramCards("mission"),
    getSiteSettings(),
  ]);
  const t = copy.t;

  return (
    <div className="pg-mission">
      <section className="mhero">
        <span className="mhero-orb1" />
        <span className="mhero-orb2" />
        <div className="cx mhero-inner">
          <p className="eyebrow">{t("hero_eyebrow")}</p>
          <p className="tag">{t("hero_tag")}</p>
          <h1>
            <Emph text={t("hero_title")} />
          </h1>
          <p>{t("hero_text")}</p>
        </div>
      </section>

      <section className="vmb">
        <div className="cx vmb-grid">
          {(
            [
              ["vision", <Eye key="e" />],
              ["mission", <Shield key="s" width="1.7" />],
              ["belief", <HeartLine key="h" />],
            ] as const
          ).map(([k, icon]) => (
            <div key={k} className="vmb-card">
              <div className="vmb-ic">{icon}</div>
              <h2>{org.t(`${k}_heading`)}</h2>
              <p>{org.t(k)}</p>
            </div>
          ))}
        </div>
      </section>

      {stats.length > 0 && (
        <section className="glance">
          <div className="cx">
            <div className="glance-head">
              <p className="eyebrow">{t("glance_eyebrow")}</p>
              <h2>{t("glance_title")}</h2>
            </div>
            <div className="glance-grid">
              {stats.map((s) => (
                <div key={s.label} className="glance-item">
                  <div className="glance-num">
                    <Figure value={s.value} />
                  </div>
                  <div className="glance-lbl">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="projects">
        <div className="cx">
          <div className="projects-head">
            <p className="eyebrow">{t("projects_eyebrow")}</p>
            <h2>{t("projects_title")}</h2>
            <p>{t("projects_text")}</p>
          </div>
          <div className="prows">
            {rows.map((p, i) => (
              <article key={p.id} className="prow" style={p.accent ? ({ "--accent": p.accent } as React.CSSProperties) : undefined}>
                <div className="prow-media">
                  {p.image && (
                    // eslint-disable-next-line @next/next/no-img-element -- WebP from the media library, cropped by CSS
                    <img src={p.image.src} alt={p.image.alt} width={p.image.width} height={p.image.height} loading={i === 0 ? undefined : "lazy"} decoding="async" />
                  )}
                  {p.badge && <span className="prow-year">{p.badge}</span>}
                </div>
                <div className="prow-body">
                  {p.category && <span className="prow-cat">{p.category}</span>}
                  <h3>{p.href ? <Link href={p.href}>{p.title}</Link> : p.title}</h3>
                  {p.lead && <p className="prow-model">{p.lead}</p>}
                  {p.tracks.length > 0 ? (
                    <div className="paccs">
                      {p.tracks.map((tr, j) => (
                        <details key={tr.id} className="pacc" open={j === 0}>
                          <summary>
                            {tr.title}
                            {tr.badge && <span className="pacc-meta">{tr.badge}</span>}
                            <svg className="pacc-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M6 9l6 6 6-6" />
                            </svg>
                          </summary>
                          <div className="pacc-panel">
                            {tr.lead && <p className="prow-model">{tr.lead}</p>}
                            <Details card={tr} />
                          </div>
                        </details>
                      ))}
                    </div>
                  ) : (
                    <Details card={p} />
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="transp">
        <div className="cx">
          <div className="transp-card">
            <div className="transp-inner">
              <span className="badge">
                <Shield />
                {t("money_badge")}
              </span>
              <h2>{t("money_title")}</h2>
              {copy.paras("money_text").map((para) => (
                <p key={para}>{para}</p>
              ))}
              <p className="idline">Registered Canadian Charity #{settings.charityNumber}</p>
              <div className="transp-actions">
                <Link className="btn-solid" href="/centers">
                  {t("money_map")}
                  <ArrowRight />
                </Link>
                <a className="btn-line" href={settings.donateUrl} rel="noopener" target="_blank">
                  <Heart />
                  {t("money_donate")}
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
