import { type RichDoc, parseRichDoc, youtubeId } from "./richtext";

/**
 * Sections of a page built in Admin -> Pages.
 *
 * A built page is a list of these, in order. Each type maps onto a part of
 * the site's own design (the same components the built-in pages use), so a
 * page made in the admin looks like it was always part of the site.
 *
 * `normalizeSections` is applied both when a page is saved and when it is
 * rendered: whatever is stored, only well-formed sections of known types
 * reach the page.
 */
export type Ground = "sand" | "raised" | "forest";

type Base = { id: string; eyebrow?: string; title?: string; ground: Ground };

export type TextSection = Base & { type: "text"; body: RichDoc };
export type ImageTextSection = Base & {
  type: "imageText";
  body: RichDoc;
  mediaId: number | null;
  imageSide: "left" | "right";
};
export type StatsSection = Base & {
  type: "stats";
  source: "site" | "custom";
  items: { value: string; label: string; note?: string }[];
};
export type GallerySection = Base & { type: "gallery"; mediaIds: number[] };
export type VideosSection = Base & { type: "videos"; items: { title: string; url: string }[] };
export type ProjectsSection = Base & { type: "projects" };
export type PostsSection = Base & { type: "posts"; section: "all" | "update" | "story"; limit: number };
export type QuoteSection = Base & { type: "quote"; quote: string; attribution?: string };
export type CtaSection = Base & {
  type: "cta";
  body?: string;
  actionLabel: string;
  actionHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
};

export type Section =
  | TextSection
  | ImageTextSection
  | StatsSection
  | GallerySection
  | VideosSection
  | ProjectsSection
  | PostsSection
  | QuoteSection
  | CtaSection;

export type SectionType = Section["type"];

export const SECTION_TYPES: { type: SectionType; label: string; hint: string }[] = [
  { type: "text", label: "Text", hint: "Headings, paragraphs, lists, images and videos." },
  { type: "imageText", label: "Image and text", hint: "A photograph beside a block of text." },
  { type: "stats", label: "Figures", hint: "Large numbers with labels — the home page's figures or your own." },
  { type: "gallery", label: "Photo gallery", hint: "A grid of photographs from the media library." },
  { type: "videos", label: "Videos", hint: "YouTube films, loaded only when someone presses play." },
  { type: "projects", label: "Active projects", hint: "Cards for every published Active Project." },
  { type: "posts", label: "Latest posts", hint: "The newest project updates or success stories." },
  { type: "quote", label: "Quote", hint: "A large pull quote with who said it." },
  { type: "cta", label: "Call to action", hint: "A dark band with a heading and buttons." },
];

export function newSection(type: SectionType): Section {
  const id = Math.random().toString(36).slice(2, 10);
  const base = { id, ground: "sand" as Ground };
  switch (type) {
    case "text":
      return { ...base, type, title: "", body: { type: "doc", content: [] } };
    case "imageText":
      return { ...base, type, title: "", body: { type: "doc", content: [] }, mediaId: null, imageSide: "right" };
    case "stats":
      return { ...base, type, title: "", source: "site", items: [] };
    case "gallery":
      return { ...base, type, title: "", mediaIds: [] };
    case "videos":
      return { ...base, type, title: "", items: [] };
    case "projects":
      return { ...base, type, title: "Our projects" };
    case "posts":
      return { ...base, type, title: "Latest updates", section: "all", limit: 3 };
    case "quote":
      return { ...base, type, quote: "", attribution: "" };
    case "cta":
      return { ...base, type, ground: "forest", title: "", body: "", actionLabel: "Contact us", actionHref: "/contact" };
  }
}

const str = (v: unknown, max = 2000) => (typeof v === "string" ? v.slice(0, max) : "");
const optStr = (v: unknown, max = 2000) => {
  const s = str(v, max).trim();
  return s ? s : undefined;
};
const ground = (v: unknown): Ground => (v === "raised" || v === "forest" ? v : "sand");
const intOrNull = (v: unknown) => {
  const n = Number(v);
  return Number.isInteger(n) && n > 0 ? n : null;
};

export function normalizeSections(input: unknown): Section[] {
  if (!Array.isArray(input)) return [];
  const out: Section[] = [];
  for (const raw of input.slice(0, 60)) {
    if (!raw || typeof raw !== "object") continue;
    const s = raw as Record<string, unknown>;
    const base = {
      id: str(s.id, 40) || Math.random().toString(36).slice(2, 10),
      eyebrow: optStr(s.eyebrow, 160),
      title: optStr(s.title, 200),
      ground: ground(s.ground),
    };
    switch (s.type) {
      case "text":
        out.push({ ...base, type: "text", body: parseRichDoc(s.body) });
        break;
      case "imageText":
        out.push({
          ...base,
          type: "imageText",
          body: parseRichDoc(s.body),
          mediaId: intOrNull(s.mediaId),
          imageSide: s.imageSide === "left" ? "left" : "right",
        });
        break;
      case "stats":
        out.push({
          ...base,
          type: "stats",
          source: s.source === "custom" ? "custom" : "site",
          items: (Array.isArray(s.items) ? s.items : [])
            .slice(0, 12)
            .map((i: Record<string, unknown>) => ({ value: str(i?.value, 40), label: str(i?.label, 160), note: optStr(i?.note, 200) }))
            .filter((i) => i.value || i.label),
        });
        break;
      case "gallery":
        out.push({
          ...base,
          type: "gallery",
          mediaIds: (Array.isArray(s.mediaIds) ? s.mediaIds : []).map(intOrNull).filter((n): n is number => n !== null).slice(0, 200),
        });
        break;
      case "videos":
        out.push({
          ...base,
          type: "videos",
          items: (Array.isArray(s.items) ? s.items : [])
            .slice(0, 40)
            .map((i: Record<string, unknown>) => ({ title: str(i?.title, 255), url: str(i?.url, 500) }))
            .filter((i) => youtubeId(i.url)),
        });
        break;
      case "projects":
        out.push({ ...base, type: "projects" });
        break;
      case "posts":
        out.push({
          ...base,
          type: "posts",
          section: s.section === "update" || s.section === "story" ? s.section : "all",
          limit: Math.min(12, Math.max(1, Number(s.limit) || 3)),
        });
        break;
      case "quote":
        out.push({ ...base, type: "quote", quote: str(s.quote, 1000), attribution: optStr(s.attribution, 200) });
        break;
      case "cta":
        out.push({
          ...base,
          type: "cta",
          body: optStr(s.body, 1000),
          actionLabel: str(s.actionLabel, 80) || "Contact us",
          actionHref: str(s.actionHref, 500) || "/contact",
          secondaryLabel: optStr(s.secondaryLabel, 80),
          secondaryHref: optStr(s.secondaryHref, 500),
        });
        break;
    }
  }
  return out;
}
