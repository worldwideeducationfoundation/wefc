import { Emph } from "./Emph";

/** The green opening band of the list, topic and built pages (`.ap-hero`). Lives inside `.pg-list`. */
export function ListHero({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return (
    <section className="ap-hero">
      <span className="ap-orb1" />
      <span className="ap-orb2" />
      <div className="cx ap-hero-inner">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>
          <Emph text={title} />
        </h1>
        {text && <p>{text}</p>}
      </div>
    </section>
  );
}

/** The list pages' closing band (`.ap-cta`). */
export function ListCta({
  heading,
  text,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
}: {
  heading: string;
  text: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
}) {
  const ext = (h: string) => (/^https?:/.test(h) ? { rel: "noopener", target: "_blank" } : {});
  return (
    <section className="ap-cta">
      <div className="cx ap-cta-inner">
        <div>
          <h2>{heading}</h2>
          <p>{text}</p>
        </div>
        <div className="ap-cta-actions">
          <a className="ap-btn-solid" href={primaryHref} {...ext(primaryHref)}>
            {primaryLabel}
          </a>
          {secondaryLabel && secondaryHref && (
            <a className="ap-btn-line" href={secondaryHref} {...ext(secondaryHref)}>
              {secondaryLabel}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}
