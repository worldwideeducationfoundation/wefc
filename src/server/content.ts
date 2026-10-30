import "server-only";
import { formatFigure } from "@/lib/format";
import { postHref } from "@/lib/post-href";
import { collectMediaIds, parseRichDoc } from "@/lib/richtext";
import type {
  CategoryRef,
  Faq,
  FooterGroup,
  GalleryPhoto,
  HeroSlideContent,
  LearningCenter,
  MediaRef,
  NavLink,
  Post,
  PostCard,
  PostSection,
  ProgramCard,
  ProgramPlacement,
  Stat,
  TeamGroup,
  Testimonial,
} from "@/lib/types";
import { disabledCorePaths } from "./blocks";
import { cached } from "./cache";
import { query, queryOne } from "./db";
import { getMediaRefs, rowToRef } from "./media-refs";

/**
 * Everything the public site reads from the database.
 *
 * Only published rows that are not in Trash ever leave this file. Each read
 * goes through `cached`, which an admin save clears, so pages are cheap to
 * render on every request and still show a change immediately.
 */

const LIVE = "status = 'published' AND deleted_at IS NULL";
/** LIVE for one table in a join: every column qualified, so no join can make it ambiguous. */
const live = (alias: string) => `${alias}.status = 'published' AND ${alias}.deleted_at IS NULL`;

type ImageCols = { m_path: string | null; m_width: number | null; m_height: number | null; m_alt: string | null };

/** SQL to join one media column as m_path, m_width, m_height, m_alt. */
const joinMedia = (alias: string, column: string) => `LEFT JOIN media m ON m.id = ${alias}.${column}`;
const MEDIA_COLS = "m.path AS m_path, m.width AS m_width, m.height AS m_height, m.alt AS m_alt";

function imageOf(row: ImageCols) {
  return row.m_path
    ? rowToRef({ path: row.m_path, width: row.m_width, height: row.m_height, alt: row.m_alt ?? "" })
    : undefined;
}

const iso = (d: Date | string) => (d instanceof Date ? d.toISOString() : new Date(d).toISOString());
const lineList = (v: string | null) => (v ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean);

/* ── Home slideshow ─────────────────────────────────────────────────── */

export function getHeroSlides(): Promise<HeroSlideContent[]> {
  return cached("hero_slides", async () => {
    const rows = await query<ImageCols & { id: number; description: string }>(
      `SELECT h.id, h.description, ${MEDIA_COLS}
         FROM hero_slides h ${joinMedia("h", "image_media_id")}
        WHERE ${live("h")} ORDER BY h.display_order, h.id`,
    );
    return rows.map((r) => ({ id: `slide-${r.id}`, description: r.description, image: imageOf(r) }));
  });
}

/* ── Program cards ──────────────────────────────────────────────────── */

type ProgramRow = ImageCols & {
  id: number;
  title: string;
  lead: string | null;
  badge: string | null;
  category: string | null;
  accent: string | null;
  points: string | null;
  stats: string | null;
  columns_text: string | null;
  notes: string | null;
  parent_id: number | null;
  post_section: PostSection | null;
  post_slug: string | null;
};

/** "100 | centers today" -> { value: "100", label: "centers today" } */
function parseStatLine(line: string): Stat {
  const [value, ...rest] = line.split("|");
  return { value: value.trim(), label: rest.join("|").trim() };
}

export function getProgramCards(placement: ProgramPlacement): Promise<ProgramCard[]> {
  return cached(`programs:${placement}`, async () => {
    const cards = await loadProgramCards(placement);
    // Tracks sit inside their parent card; a track whose parent is gone shows on its own.
    const ids = new Set(cards.map((c) => c.id));
    for (const c of cards) if (c.parentId && ids.has(c.parentId)) cards.find((p) => p.id === c.parentId)!.tracks.push(c);
    return cards.filter((c) => !c.parentId || !ids.has(c.parentId));
  });
}

function loadProgramCards(placement: ProgramPlacement): Promise<ProgramCard[]> {
  return (async () => {
    const rows = await query<ProgramRow>(
      `SELECT p.*, po.section AS post_section, po.slug AS post_slug, ${MEDIA_COLS}
         FROM programs p ${joinMedia("p", "image_media_id")}
         LEFT JOIN posts po ON po.id = p.post_id AND ${live("po")}
        WHERE ${live("p")} AND p.placement = ? ORDER BY p.display_order, p.id`,
      [placement],
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      lead: r.lead ?? "",
      badge: r.badge || undefined,
      category: r.category || undefined,
      accent: r.accent && /^#[0-9a-f]{3,8}$/i.test(r.accent) ? r.accent : undefined,
      points: lineList(r.points),
      stats: lineList(r.stats).map(parseStatLine),
      columns: (r.columns_text ?? "")
        .split(/\r?\n\s*\r?\n/)
        .map((block) => lineList(block))
        .filter((block) => block.length > 0)
        .map(([heading, ...items]) => ({ heading, items })),
      notes: lineList(r.notes),
      tracks: [],
      parentId: r.parent_id,
      image: imageOf(r),
      href: r.post_section && r.post_slug ? postHref({ section: r.post_section, slug: r.post_slug }) : undefined,
    }));
  })();
}

/* ── Figures ────────────────────────────────────────────────────────── */

export function getStats(placement: "home" | "mission" | "donate"): Promise<Stat[]> {
  return cached(`stats:${placement}`, async () => {
    const rows = await query<{ value: string; label: string; note: string | null }>(
      `SELECT value, label, note FROM stats WHERE ${LIVE} AND placement = ? ORDER BY display_order, id`,
      [placement],
    );
    return rows.map((r) => ({ value: formatFigure(r.value), label: r.label, note: r.note ?? undefined }));
  });
}

/* ── Learning centers ───────────────────────────────────────────────── */

export function getLearningCenters(): Promise<LearningCenter[]> {
  return cached("learning_centers", async () => {
    const rows = await query<{
      name: string | null;
      village: string;
      region: string | null;
      model: string | null;
      sponsor: string | null;
      enrollment: number | null;
      lat: string | number | null;
      lon: string | number | null;
    }>(`SELECT name, village, region, model, sponsor, enrollment, lat, lon FROM learning_centers WHERE ${LIVE} ORDER BY display_order, id`);
    return rows.map((r) => ({
      ...r,
      enrollment: r.enrollment === null ? null : Number(r.enrollment),
      lat: r.lat === null ? null : Number(r.lat),
      lon: r.lon === null ? null : Number(r.lon),
    }));
  });
}

/* ── Donation FAQs ──────────────────────────────────────────────────── */

export function getFaqs(): Promise<{ faqs: Faq[]; media: Record<number, MediaRef> }> {
  return cached("faqs", async () => {
    const rows = await query<{ question: string; answer: string | null }>(
      `SELECT question, answer FROM faqs WHERE ${LIVE} ORDER BY display_order, id`,
    );
    const faqs = rows.map((r) => ({ question: r.question, answer: parseRichDoc(r.answer) }));
    const ids = new Set<number>();
    for (const f of faqs) collectMediaIds(f.answer, ids);
    return { faqs, media: await getMediaRefs(ids) };
  });
}

/* ── Team ───────────────────────────────────────────────────────────── */

export function getTeamGroups(): Promise<TeamGroup[]> {
  return cached("team", async () => {
    const [groups, members] = await Promise.all([
      query<{ id: number; heading: string; eyebrow: string | null; description: string | null }>(
        `SELECT id, heading, eyebrow, description FROM team_groups WHERE ${LIVE} ORDER BY display_order, id`,
      ),
      query<
        ImageCols & { id: number; group_id: number | null; name: string; role: string | null; bio: string | null; linkedin_url: string | null }
      >(
        `SELECT t.id, t.group_id, t.name, t.role, t.bio, t.linkedin_url, ${MEDIA_COLS}
           FROM team_members t ${joinMedia("t", "image_media_id")}
          WHERE ${live("t")} ORDER BY t.display_order, t.name`,
      ),
    ]);
    return groups
      .map((g) => ({
        heading: g.heading,
        eyebrow: g.eyebrow ?? undefined,
        description: g.description ?? undefined,
        members: members
          .filter((m) => m.group_id === g.id)
          .map((m) => ({
            id: m.id,
            name: m.name,
            role: m.role ?? undefined,
            bio: m.bio ?? undefined,
            linkedin: m.linkedin_url ?? undefined,
            image: imageOf(m),
          })),
      }))
      .filter((g) => g.members.length > 0);
  });
}

/* ── Gallery ────────────────────────────────────────────────────────── */

export function getGallery(): Promise<{ categories: string[]; photos: GalleryPhoto[] }> {
  return cached("gallery", async () => {
    const [cats, rows] = await Promise.all([
      query<{ label: string }>(`SELECT label FROM gallery_categories WHERE ${LIVE} ORDER BY display_order, id`),
      query<ImageCols & { caption: string | null; category: string | null }>(
        `SELECT g.caption, gc.label AS category, ${MEDIA_COLS}
           FROM gallery_items g ${joinMedia("g", "media_id")}
           LEFT JOIN gallery_categories gc ON gc.id = g.category_id AND ${live("gc")}
          WHERE ${live("g")} AND m.path IS NOT NULL ORDER BY g.display_order, g.id`,
      ),
    ]);
    const photos = rows.map((r) => ({ ...imageOf(r)!, caption: r.caption, category: r.category }));
    // Only chips that have a photo behind them.
    const used = new Set(photos.map((p) => p.category));
    return { categories: cats.map((c) => c.label).filter((c) => used.has(c)), photos };
  });
}

/* ── Testimonials ───────────────────────────────────────────────────── */

export function getTestimonials(): Promise<Testimonial[]> {
  return cached("testimonials", async () => {
    const rows = await query<
      ImageCols & {
        quote: string;
        name: string | null;
        context: string | null;
        location: string | null;
        post_section: PostSection | null;
        post_slug: string | null;
      }
    >(
      `SELECT t.quote, t.name, t.context, t.location, po.section AS post_section, po.slug AS post_slug, ${MEDIA_COLS}
         FROM testimonials t ${joinMedia("t", "image_media_id")}
         LEFT JOIN posts po ON po.id = t.post_id AND ${live("po")}
        WHERE ${live("t")} ORDER BY t.display_order, t.id`,
    );
    return rows.map((r) => ({
      quote: r.quote,
      name: r.name ?? undefined,
      context: r.context ?? undefined,
      location: r.location ?? undefined,
      image: imageOf(r),
      href: r.post_section && r.post_slug ? postHref({ section: r.post_section, slug: r.post_slug }) : undefined,
    }));
  });
}

/* ── Posts ──────────────────────────────────────────────────────────── */

type PostRow = ImageCols & {
  id: number;
  section: PostSection;
  title: string;
  card_title: string | null;
  slug: string;
  excerpt: string | null;
  published_at: Date;
  date_label: string | null;
  location: string | null;
  featured: number;
  author_name: string | null;
  author_role: string | null;
  author_bio: string | null;
};

const POST_CARD_SQL = `
  SELECT po.id, po.section, po.title, po.card_title, po.slug, po.excerpt, po.published_at, po.date_label, po.location,
         po.featured, a.name AS author_name, a.role AS author_role, a.bio AS author_bio, ${MEDIA_COLS}
    FROM posts po
    LEFT JOIN authors a ON a.id = po.author_id AND a.deleted_at IS NULL
    ${joinMedia("po", "image_media_id")}`;

async function categoriesFor(postIds: number[]): Promise<Map<number, CategoryRef[]>> {
  const map = new Map<number, CategoryRef[]>();
  if (postIds.length === 0) return map;
  const rows = await query<{ post_id: number; id: number; title: string; slug: string; description: string | null }>(
    `SELECT pc.post_id, c.id, c.title, c.slug, c.description
       FROM post_categories pc JOIN categories c ON c.id = pc.category_id
      WHERE pc.post_id IN (?) AND ${live("c")}
      ORDER BY pc.position, c.title`,
    [postIds],
  );
  for (const r of rows) {
    const list = map.get(r.post_id) ?? [];
    list.push({ id: r.id, title: r.title, slug: r.slug, description: r.description });
    map.set(r.post_id, list);
  }
  return map;
}

async function toCards(rows: PostRow[]): Promise<PostCard[]> {
  const cats = await categoriesFor(rows.map((r) => r.id));
  return rows.map((r) => ({
    id: r.id,
    section: r.section,
    title: r.title,
    cardTitle: r.card_title || r.title,
    slug: r.slug,
    href: postHref(r),
    excerpt: r.excerpt ?? "",
    publishedAt: iso(r.published_at),
    dateLabel: r.date_label,
    location: r.location,
    featured: Boolean(r.featured),
    image: imageOf(r),
    author: r.author_name ? { name: r.author_name, role: r.author_role, bio: r.author_bio } : null,
    categories: cats.get(r.id) ?? [],
  }));
}

/** Published and dated now or earlier: a post scheduled for later stays hidden until then. */
const POST_LIVE = "po.status = 'published' AND po.deleted_at IS NULL AND po.published_at <= UTC_TIMESTAMP()";

export function getPostCards({ section, categorySlug }: { section?: PostSection; categorySlug?: string } = {}): Promise<PostCard[]> {
  return cached(`posts:${section ?? "*"}:${categorySlug ?? "*"}`, async () => {
    const where = [POST_LIVE];
    const params: unknown[] = [];
    if (section) {
      where.push("po.section = ?");
      params.push(section);
    }
    if (categorySlug) {
      where.push(
        "EXISTS (SELECT 1 FROM post_categories pc JOIN categories c ON c.id = pc.category_id WHERE pc.post_id = po.id AND c.slug = ?)",
      );
      params.push(categorySlug);
    }
    const rows = await query<PostRow>(
      `${POST_CARD_SQL} WHERE ${where.join(" AND ")} ORDER BY po.featured DESC, po.published_at DESC, po.id DESC`,
      params,
    );
    return toCards(rows);
  });
}

type FullPostRow = PostRow & {
  body: string | null;
  status: "draft" | "published";
  updated_at: Date;
  cta_heading: string | null;
  cta_text: string | null;
  cta_primary_label: string | null;
  cta_primary_url: string | null;
  cta_secondary_label: string | null;
  cta_secondary_url: string | null;
  seo_title: string | null;
  seo_description: string | null;
};

/**
 * One post by kind and slug. `allowDraft` is passed only when a signed-in
 * admin is previewing, so drafts and scheduled posts are otherwise invisible.
 */
export async function getPost(section: PostSection, slug: string, { allowDraft = false } = {}): Promise<Post | null> {
  const load = async () => {
    const row = await queryOne<FullPostRow>(
      `${POST_CARD_SQL.replace("SELECT po.id,", "SELECT po.body, po.status, po.updated_at, po.cta_heading, po.cta_text, po.cta_primary_label, po.cta_primary_url, po.cta_secondary_label, po.cta_secondary_url, po.seo_title, po.seo_description, po.id,")}
        WHERE po.section = ? AND po.slug = ? AND ${allowDraft ? "po.deleted_at IS NULL" : POST_LIVE} LIMIT 1`,
      [section, slug],
    );
    if (!row) return null;
    const [card] = await toCards([row]);
    const body = parseRichDoc(row.body);
    return {
      ...card,
      body,
      bodyMedia: await getMediaRefs(collectMediaIds(body)),
      status: row.status,
      updatedAt: iso(row.updated_at),
      cta: {
        heading: row.cta_heading ?? undefined,
        text: row.cta_text ?? undefined,
        primaryLabel: row.cta_primary_label ?? undefined,
        primaryUrl: row.cta_primary_url ?? undefined,
        secondaryLabel: row.cta_secondary_label,
        secondaryUrl: row.cta_secondary_url,
      },
      seo: { title: row.seo_title, description: row.seo_description },
    } satisfies Post;
  };
  return allowDraft ? load() : cached(`post:${section}:${slug}`, load);
}

/** Topics that have at least one live post, for the filter chips and topic pages. */
export function getCategories(): Promise<CategoryRef[]> {
  return cached("categories", async () => {
    const rows = await query<{
      id: number;
      title: string;
      slug: string;
      description: string | null;
      seo_title: string | null;
      seo_description: string | null;
      n: number;
    }>(
      `SELECT c.id, c.title, c.slug, c.description, c.seo_title, c.seo_description, COUNT(po.id) AS n
         FROM categories c
         JOIN post_categories pc ON pc.category_id = c.id
         JOIN posts po ON po.id = pc.post_id AND ${POST_LIVE}
        WHERE ${live("c")}
        GROUP BY c.id ORDER BY c.display_order, c.title`,
    );
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      description: r.description,
      seoTitle: r.seo_title,
      seoDescription: r.seo_description,
      postCount: Number(r.n),
    }));
  });
}

export async function getCategory(slug: string) {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}

/* ── Navigation ─────────────────────────────────────────────────────── */

type NavRow = { id: number; menu: "header" | "footer"; parent_id: number | null; kind: string; label: string; href: string | null };

export async function getNavigation(): Promise<{ header: NavLink[]; footer: FooterGroup[] } | null> {
  const [rows, projects, categories, hidden] = await Promise.all([
    cached("nav", () => query<NavRow>("SELECT id, menu, parent_id, kind, label, href FROM nav_items ORDER BY display_order, id")),
    getPostCards({ section: "project" }),
    getCategories(),
    disabledCorePaths(),
  ]);
  // Nothing saved yet: the caller uses the launch menus in src/lib/default-nav.ts.
  if (rows.length === 0) return null;

  const visible = (href: string | null) => !href || !hidden.has(href);

  /** A node's links: auto entries expand into the live list they stand for. */
  const expand = (row: NavRow): NavLink[] => {
    if (row.kind === "auto_projects") return projects.map((p) => ({ label: p.cardTitle, href: p.href }));
    if (row.kind === "auto_categories") return categories.map((c) => ({ label: c.title, href: `/topics/${c.slug}` }));
    return row.href && visible(row.href) ? [{ label: row.label, href: row.href }] : [];
  };

  const childrenOf = (id: number) => rows.filter((r) => r.parent_id === id).flatMap(expand);

  const header: NavLink[] = rows
    .filter((r) => r.menu === "header" && r.parent_id === null)
    .map((r) => {
      const children = childrenOf(r.id);
      return { label: r.label, href: r.href || "#", ...(children.length ? { children } : {}) };
    })
    .filter((l) => (l.children?.length ?? 0) > 0 || (l.href !== "#" && visible(l.href)));

  const footer: FooterGroup[] = rows
    .filter((r) => r.menu === "footer" && r.parent_id === null)
    .map((r) => ({ heading: r.label, links: childrenOf(r.id) }))
    .filter((g) => g.links.length > 0);

  return { header, footer };
}

/* ── Pages built in the admin ───────────────────────────────────────── */

export type BuiltPage = {
  id: number;
  slug: string;
  title: string;
  eyebrow: string | null;
  lede: string | null;
  sections: unknown;
  seoTitle: string | null;
  seoDescription: string | null;
  noindex: boolean;
  status: "draft" | "published";
  updatedAt: string;
};

export async function getBuiltPage(slug: string, { allowDraft = false } = {}): Promise<BuiltPage | null> {
  const load = async () => {
    const row = await queryOne<{
      id: number;
      slug: string;
      title: string;
      eyebrow: string | null;
      lede: string | null;
      sections: string | null;
      seo_title: string | null;
      seo_description: string | null;
      noindex: number;
      status: "draft" | "published";
      updated_at: Date;
    }>(
      `SELECT id, slug, title, eyebrow, lede, sections, seo_title, seo_description, noindex, status, updated_at
         FROM pages WHERE slug = ? AND deleted_at IS NULL ${allowDraft ? "" : "AND status = 'published'"} LIMIT 1`,
      [slug],
    );
    if (!row) return null;
    let sections: unknown = [];
    try {
      sections = row.sections ? JSON.parse(row.sections) : [];
    } catch {
      sections = [];
    }
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      eyebrow: row.eyebrow,
      lede: row.lede,
      sections,
      seoTitle: row.seo_title,
      seoDescription: row.seo_description,
      noindex: Boolean(row.noindex),
      status: row.status,
      updatedAt: iso(row.updated_at),
    };
  };
  return allowDraft ? load() : cached(`page:${slug}`, load);
}

export function getPublishedPageSlugs(): Promise<{ slug: string; updatedAt: string; noindex: boolean }[]> {
  return cached("page_slugs", async () => {
    const rows = await query<{ slug: string; updated_at: Date; noindex: number }>(
      `SELECT slug, updated_at, noindex FROM pages WHERE ${LIVE} ORDER BY display_order, title`,
    );
    return rows.map((r) => ({ slug: r.slug, updatedAt: iso(r.updated_at), noindex: Boolean(r.noindex) }));
  });
}
