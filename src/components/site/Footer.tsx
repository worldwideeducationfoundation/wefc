import Link from "next/link";
import type { FooterGroup, SiteSettings } from "@/lib/types";
import { linkProps } from "./Emph";
import { Mail, MapPin, Phone, SOCIAL_ICONS } from "./Icons";

export type FooterCopy = { about: string; copyright: string; contactHeading: string };

export function Footer({ settings, groups, copy }: { settings: SiteSettings; groups: FooterGroup[]; copy: FooterCopy }) {
  const [brandLine, brandSub] = settings.name.endsWith(" Canada") ? [settings.name.slice(0, -7), "Canada"] : [settings.name, ""];
  return (
    <footer className="wef-footer">
      <div className="wef-footer-inner">
        <div className="wef-footer-top">
          <div className="wef-footer-brand">
            <div className="wef-footer-lockup">
              {/* eslint-disable-next-line @next/next/no-img-element -- a 240px brand mark */}
              <img className="wef-footer-logo" src="/brand/wefc-logo.webp" alt="" width="240" height="240" />
              <span className="wef-brand-name" aria-hidden="true">
                <span className="wef-brand-line">{brandLine}</span>
                {brandSub && <span className="wef-brand-sub">{brandSub}</span>}
              </span>
            </div>
            <p className="wef-footer-about">{copy.about}</p>
            {settings.socials.length > 0 && (
              <div className="wef-socials">
                {settings.socials.map((s) => (
                  <a key={s.key} href={s.href} rel="noopener" target="_blank" aria-label={s.label}>
                    {SOCIAL_ICONS[s.key]}
                  </a>
                ))}
              </div>
            )}
          </div>
          {groups.map((g) => (
            <div key={g.heading}>
              <h2>{g.heading}</h2>
              <ul>
                {g.links.map((l) => (
                  <li key={l.href + l.label}>
                    {/^https?:|^\/uploads\//.test(l.href) ? <a {...linkProps(l.href)} {...(l.href.startsWith("/uploads/") ? { target: "_blank", rel: "noopener" } : {})}>{l.label}</a> : <Link href={l.href}>{l.label}</Link>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div>
            <h2>{copy.contactHeading}</h2>
            <ul className="wef-footer-contact">
              {settings.phone && (
                <li>
                  <Phone />
                  <a href={`tel:${settings.phoneHref}`}>{settings.phone}</a>
                </li>
              )}
              {settings.email && (
                <li>
                  <Mail />
                  <a href={`mailto:${settings.email}`}>{settings.email}</a>
                </li>
              )}
              {settings.addressLine && (
                <li>
                  <MapPin />
                  <span>{settings.addressLine}</span>
                </li>
              )}
            </ul>
          </div>
        </div>
        <div className="wef-footer-bottom">
          <span>{copy.copyright.replace("{year}", String(new Date().getFullYear()))}</span>
          {settings.charityNumber && <span>Registered Canadian Charity #{settings.charityNumber}</span>}
        </div>
      </div>
    </footer>
  );
}
