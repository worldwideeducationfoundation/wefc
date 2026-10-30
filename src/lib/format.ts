/**
 * Display formatting for content as it is stored in the admin. These change
 * how text is presented, never what it says.
 */

/** "3000" -> "3,000", "1500+" -> "1,500+"; ranges, words and already-formatted values pass through. */
export function formatFigure(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  const m = v.match(/^(\d{4,})(\+?)$/);
  if (!m) return v;
  return `${Number(m[1]).toLocaleString("en-US")}${m[2]}`;
}

/** Titles render in capitals, where a closing full stop reads as a stray mark. */
export function displayTitle(title: string): string {
  return title.trim().replace(/\s+/g, " ").replace(/(?<!\.)\.$/, "");
}

/** The catch-all WordPress category is not a real grouping; it is never shown. */
export const HIDDEN_CATEGORY_SLUGS = new Set(["uncategorized"]);

const STOP = new Set(["a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "or", "see", "the", "to", "with", "your", "our"]);

/**
 * A readable web address from a long one: at most `max` characters, cut at a
 * word boundary, without a dangling "and" / "the" / "see" at the end.
 */
export function shortenSlug(slug: string, max = 60): string {
  if (slug.length <= max) return slug;
  const words = slug.split("-").filter(Boolean);
  const out: string[] = [];
  for (const w of words) {
    if ([...out, w].join("-").length > max) break;
    out.push(w);
  }
  // No dangling small word, and no number cut off from what it counted ("…-gift-1").
  while (out.length > 3 && (STOP.has(out[out.length - 1]) || /^\d{1,2}$/.test(out[out.length - 1]))) out.pop();
  return out.join("-") || slug.slice(0, max);
}

/** Collapses whitespace and drops a trailing ellipsis, for comparing text. */
export function normaliseText(text: string): string {
  return text
    .replace(/(\.\.\.|…)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}
