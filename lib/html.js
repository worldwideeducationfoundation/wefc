/**
 * HTML escaping helpers for the client-side loaders.
 *
 * The loaders build markup by interpolating CMS values into template literals.
 * Anything reaching innerHTML that way must be escaped: a Sanity editor could
 * otherwise inject markup (stored XSS), and — far more likely in practice — a
 * legitimate title containing an ampersand or a quote would silently corrupt
 * the surrounding tag.
 *
 * Use `esc` for text and for values inside double-quoted attributes; both cases
 * are covered because the quote characters are escaped too.
 */
export function esc(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Escape a value destined for a URL-bearing attribute (href/src).
 *
 * Escaping alone would still allow `javascript:` and `data:` URLs, which
 * execute when clicked, so anything that is not clearly a safe location is
 * dropped entirely.
 */
export function escUrl(value) {
  if (value === null || value === undefined) return '';
  const raw = String(value).trim();
  // Allow root-relative, protocol-relative, http(s), mailto and tel only.
  if (!/^(https?:\/\/|\/\/|\/|mailto:|tel:|#)/i.test(raw)) return '';
  return esc(raw);
}
