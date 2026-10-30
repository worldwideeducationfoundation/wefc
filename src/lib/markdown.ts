import { type RichDoc, type RichMark, type RichNode, youtubeId } from "./richtext";

/**
 * Markdown to the site's rich-text format, for the Content API: a post can be
 * sent as plain Markdown and is stored exactly as if it had been typed into
 * the admin's editor.
 *
 *   ## Heading / ### Subheading     # is treated as ## (the title is the h1)
 *   blank line                      new paragraph
 *   - item / * item / 1. item       lists
 *   > text                          quote
 *   >>> quote — Who said it         pull quote
 *   ---                             divider
 *   ![alt](https://… "caption")     image, copied into the media library
 *   ![alt](media:123 "caption")     image already in the library
 *   a YouTube link on its own line  video
 *   **bold**  *italic*  _italic_  [text](https://…)
 */
export type ImageResolver = (src: string, alt: string, caption: string) => Promise<number | null>;

function inline(text: string): RichNode[] {
  const out: RichNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*\s][^*]*)\*|_([^_\s][^_]*)_|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let last = 0;
  const push = (t: string, marks?: RichMark[]) => {
    if (t) out.push({ type: "text", text: t, ...(marks?.length ? { marks } : {}) });
  };
  for (const m of text.matchAll(re)) {
    push(text.slice(last, m.index));
    if (m[1]) push(m[1], [{ type: "bold" }]);
    else if (m[2] || m[3]) push(m[2] ?? m[3], [{ type: "italic" }]);
    else if (m[4]) push(m[4], [{ type: "link", attrs: { href: m[5] } }]);
    last = (m.index ?? 0) + m[0].length;
  }
  push(text.slice(last));
  return out;
}

const para = (text: string): RichNode => ({ type: "paragraph", content: inline(text) });

export async function markdownToDoc(markdown: string, resolveImage: ImageResolver): Promise<RichDoc> {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const content: RichNode[] = [];
  let paragraph: string[] = [];
  let list = null as RichNode | null;

  const flush = () => {
    if (paragraph.length) content.push(para(paragraph.join(" ").trim()));
    paragraph = [];
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    const t = line.trim();

    if (!t) {
      flush();
      list = null;
      continue;
    }

    const heading = t.match(/^(#{1,6})\s+(.*)$/);
    const bullet = t.match(/^[-*]\s+(.*)$/);
    const numbered = t.match(/^\d+[.)]\s+(.*)$/);
    const image = t.match(/^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)$/);
    const pull = t.match(/^>>>\s+(.*?)(?:\s+[—–-]{1,2}\s+(.+))?$/);
    const quote = t.match(/^>\s?(.*)$/);

    if (heading) {
      flush();
      list = null;
      content.push({ type: "heading", attrs: { level: heading[1].length >= 3 ? 3 : 2 }, content: inline(heading[2]) });
    } else if (bullet || numbered) {
      flush();
      const type = bullet ? "bulletList" : "orderedList";
      if (!list || list.type !== type) {
        list = { type, content: [] };
        content.push(list);
      }
      list.content!.push({ type: "listItem", content: [para((bullet ?? numbered)![1])] });
    } else if (/^(-{3,}|\*{3,})$/.test(t)) {
      flush();
      list = null;
      content.push({ type: "horizontalRule" });
    } else if (image) {
      flush();
      list = null;
      const mediaId = await resolveImage(image[2], image[1], image[3] ?? "");
      if (mediaId) content.push({ type: "figure", attrs: { mediaId, alt: image[1], caption: image[3] ?? "" } });
    } else if (pull) {
      flush();
      list = null;
      content.push({ type: "pullQuote", attrs: { quote: pull[1].replace(/^["“]|["”]$/g, ""), attribution: pull[2] ?? "" } });
    } else if (quote) {
      flush();
      list = null;
      const prev = content[content.length - 1];
      if (prev?.type === "blockquote") prev.content!.push(para(quote[1]));
      else content.push({ type: "blockquote", content: [para(quote[1])] });
    } else if (/^https?:\/\/\S+$/.test(t) && (youtubeId(t) || /\.mp4(\?|$)/i.test(t))) {
      flush();
      list = null;
      content.push({ type: "video", attrs: { url: t } });
    } else {
      list = null;
      paragraph.push(t);
    }
  }
  flush();

  return { type: "doc", content };
}
