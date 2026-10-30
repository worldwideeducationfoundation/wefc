/**
 * The rich-text format used for post bodies, project pages and page sections.
 *
 * It is the JSON document the admin's editor (TipTap/ProseMirror) produces,
 * stored as-is in the database and rendered by <RichText>. Rendering walks
 * the tree and emits React elements — never HTML strings — so nothing typed
 * into the editor can inject markup into the site.
 *
 * Node types the site knows how to render (anything else is skipped):
 *   paragraph, heading (level 2|3), bulletList, orderedList, listItem,
 *   blockquote, hardBreak, horizontalRule, text,
 *   figure    { mediaId, alt, caption }      an image from the media library
 *   pullQuote { quote, attribution }
 *   statStrip { stats: [{ value, label }] }  a row of big figures in an article
 *   video     { url }                        YouTube link or .mp4
 * Marks: bold, italic, underline, link { href }.
 */

export type RichMark = {
  type: "bold" | "italic" | "underline" | "link" | string;
  attrs?: { href?: string | null; [key: string]: unknown };
};

export type RichNode = {
  type: string;
  attrs?: Record<string, unknown>;
  content?: RichNode[];
  text?: string;
  marks?: RichMark[];
};

export type RichDoc = { type: "doc"; content: RichNode[] };

export const emptyDoc = (): RichDoc => ({ type: "doc", content: [] });

/** Parses a stored document, tolerating NULL, legacy strings and bad JSON. */
export function parseRichDoc(value: unknown): RichDoc {
  if (!value) return emptyDoc();
  if (typeof value === "object" && (value as RichDoc).type === "doc") return value as RichDoc;
  if (typeof value !== "string") return emptyDoc();
  try {
    const parsed = JSON.parse(value);
    if (parsed && parsed.type === "doc" && Array.isArray(parsed.content)) return parsed;
  } catch {
    // Plain text from an older field: one paragraph per blank-line block.
    return paragraphsToDoc(value.split(/\n\s*\n/));
  }
  return emptyDoc();
}

export function isEmptyDoc(doc: RichDoc | null | undefined): boolean {
  return !doc || docToPlainText(doc).trim() === "" && !hasNodeOfType(doc, ["figure", "video", "pullQuote", "statStrip"]);
}

function hasNodeOfType(node: RichNode | RichDoc, types: string[]): boolean {
  if (types.includes(node.type)) return true;
  return (node.content ?? []).some((child) => hasNodeOfType(child, types));
}

export function paragraphsToDoc(paragraphs: readonly string[]): RichDoc {
  return {
    type: "doc",
    content: paragraphs
      .map((p) => p.trim())
      .filter(Boolean)
      .map((text) => ({ type: "paragraph", content: [{ type: "text", text }] })),
  };
}

/** All visible text, for search, excerpts and meta descriptions. */
export function docToPlainText(doc: RichDoc | RichNode): string {
  const out: string[] = [];
  const walk = (node: RichNode | RichDoc) => {
    if (node.type === "text") out.push((node as RichNode).text ?? "");
    if (node.type === "pullQuote") out.push(String((node as RichNode).attrs?.quote ?? ""));
    for (const child of node.content ?? []) walk(child);
    if (["paragraph", "heading", "listItem", "blockquote"].includes(node.type)) out.push("\n");
  };
  walk(doc);
  return out.join("").replace(/\n{2,}/g, "\n").trim();
}

/** Every media id a document refers to, so the renderer can fetch them in one query. */
export function collectMediaIds(doc: RichDoc | null | undefined, into = new Set<number>()): Set<number> {
  const walk = (node: RichNode | RichDoc) => {
    if (node.type === "figure") {
      const id = Number((node as RichNode).attrs?.mediaId);
      if (Number.isInteger(id) && id > 0) into.add(id);
    }
    for (const child of node.content ?? []) walk(child);
  };
  if (doc) walk(doc);
  return into;
}

/** The only link schemes a rich-text link may use. */
export function safeHref(href: unknown): string | null {
  if (typeof href !== "string") return null;
  const value = href.trim();
  if (value.startsWith("/") && !value.startsWith("//")) return value;
  if (value.startsWith("#")) return value;
  try {
    const url = new URL(value);
    return ["http:", "https:", "mailto:", "tel:"].includes(url.protocol) ? url.toString() : null;
  } catch {
    return null;
  }
}

/** YouTube id from any of the URL shapes people paste. */
export function youtubeId(url: string): string | null {
  const m = url.match(
    /(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?(?:.*&)?v=|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/,
  );
  if (m) return m[1];
  return /^[\w-]{11}$/.test(url.trim()) ? url.trim() : null;
}
