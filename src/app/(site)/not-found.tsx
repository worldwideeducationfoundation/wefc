import type { Metadata } from "next";
import Link from "next/link";
import { CORE_PAGES, getPageCopy } from "@/server/blocks";

export const metadata: Metadata = { title: "Page not found", robots: { index: false } };

export default async function NotFound() {
  let title = CORE_PAGES.notfound.blocks.title.default;
  let text = CORE_PAGES.notfound.blocks.text.default;
  let links = CORE_PAGES.notfound.blocks.links.default;
  try {
    const copy = await getPageCopy("notfound");
    [title, text, links] = [copy.t("title"), copy.t("text"), copy.t("links")];
  } catch {
    /* no database: the defaults above */
  }
  return (
    <div className="pg-notfound">
      <section className="nf">
        <div className="cx nf-inner">
          <p className="nf-code" aria-hidden="true">
            404
          </p>
          <h1>{title}</h1>
          <p>{text}</p>
          <div className="nf-links">
            {links
              .split(/\r?\n/)
              .map((l) => l.split("|").map((s) => s.trim()))
              .filter(([label, href]) => label && href)
              .map(([label, href]) => (
                <Link key={href} href={href}>
                  {label}
                </Link>
              ))}
          </div>
        </div>
      </section>
    </div>
  );
}
