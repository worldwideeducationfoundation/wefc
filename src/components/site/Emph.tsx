import { Fragment } from "react";

/**
 * Text with *asterisk* emphasis, as the page-copy editor writes it: the
 * marked words render in <em>, which the site's headings draw in the green
 * italic accent. Everything else is plain text, never HTML.
 */
export function Emph({ text }: { text: string }) {
  const parts = text.split(/\*([^*]+)\*/g);
  return (
    <>
      {parts.map((part, i) => (i % 2 === 1 ? <em key={i}>{part}</em> : <Fragment key={i}>{part}</Fragment>))}
    </>
  );
}

/** A link that opens off-site gets rel/target; one on the site stays in the tab. */
export function linkProps(href: string) {
  return /^https?:/i.test(href) ? { href, rel: "noopener", target: "_blank" } : { href };
}
