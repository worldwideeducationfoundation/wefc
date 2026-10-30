import type { ReactNode } from "react";
import { footerNav, headerNav } from "@/lib/default-nav";
import { siteGraph } from "@/lib/schema";
import type { FooterGroup, NavLink, SiteSettings } from "@/lib/types";
import { CORE_PAGES, getPageCopy } from "@/server/blocks";
import { getNavigation } from "@/server/content";
import { defaultSiteSettings, getSiteSettings } from "@/server/settings";
import { JsonLd } from "../JsonLd";
import { Footer, type FooterCopy } from "./Footer";
import { Header } from "./Header";
import { Reveal } from "./Reveal";

/**
 * The public site's frame: header, footer and the site-wide JSON-LD.
 *
 * Both menus come from Admin -> Navigation, with the automatic entries
 * (every active project, every topic) filled in from the live lists. With
 * no menus saved yet, or no database, the launch menus are used.
 */
export async function SiteChrome({ children }: { children: ReactNode }) {
  let settings: SiteSettings;
  let nav: { header: NavLink[]; footer: FooterGroup[] } | null;
  const f = CORE_PAGES.footer.blocks;
  let copy: FooterCopy & { donate: string } = {
    about: f.about.default,
    copyright: f.copyright.default,
    contactHeading: f.contact_heading.default,
    donate: f.donate_label.default,
  };
  try {
    const [s, n, c] = await Promise.all([getSiteSettings(), getNavigation(), getPageCopy("footer")]);
    settings = s;
    nav = n;
    copy = { about: c.t("about"), copyright: c.t("copyright"), contactHeading: c.t("contact_heading"), donate: c.t("donate_label") };
  } catch {
    /* No database: during the build or in an outage. The frame still
       renders, with the launch settings and menus, rather than failing. */
    settings = defaultSiteSettings();
    nav = null;
  }
  nav ??= { header: headerNav, footer: footerNav };

  return (
    <>
      <JsonLd data={siteGraph(settings)} />
      <a href="#main" className="wef-skip">
        Skip to content
      </a>
      <Header nav={nav.header} siteName={settings.name} donateUrl={settings.donateUrl} donateLabel={copy.donate} />
      <main id="main">{children}</main>
      <Footer settings={settings} groups={nav.footer} copy={copy} />
      <Reveal />
    </>
  );
}
