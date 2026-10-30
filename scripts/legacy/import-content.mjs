/**
 * One-off: loads everything the old wefcanada.org published into this app's
 * database, then writes a backup file that can be restored on the live site
 * (Admin -> Backups -> Restore).
 *
 *   node scripts/legacy/export-sanity.mjs                    # 1. articles, topics, authors + their images
 *   node scripts/legacy/export-static.mjs <cheerio-dir>      # 2. the hand-written pages' lists
 *   npm run dev  (once, so the tables exist)                 # 3.
 *   node scripts/legacy/import-content.mjs <cheerio-dir>     # 4. this script
 *
 * Reads the database settings from .env.local. REPLACES all content in that
 * database (admin accounts are left alone). Images are re-encoded to WebP
 * exactly as an upload through the admin would be, and stored in UPLOAD_DIR
 * (./storage/uploads by default).
 *
 * Output: storage/export/wefc-content-backup.tar.gz
 */
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import os from "node:os";
import path from "node:path";
import mysql from "mysql2/promise";
import sharp from "sharp";
import * as tar from "tar";

const ROOT = path.resolve(".");
const cheerio = createRequire(path.resolve(process.argv[2] ?? "node_modules") + "/")("cheerio");
const EXPORT = path.join(ROOT, "storage/export");
const LEGACY = path.join(ROOT, "legacy");

/* ── environment ──────────────────────────────────────────────────── */
for (const name of [".env", ".env.local"]) {
  const file = path.join(ROOT, name);
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/);
    if (m) process.env[m[1]] = m[2];
  }
}
const UPLOAD_DIR = process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.join(ROOT, "storage", "uploads");
const DONATE_URL = "https://donorbox.org/bright-beginnings-early-childhood-learning-centers-eclcs";

const db = await mysql.createConnection({
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: "utf8mb4_unicode_ci",
  timezone: "Z",
});
await db.query("SET time_zone = '+00:00'");
const insert = async (table, row) => (await db.query(`INSERT INTO ${table} SET ?`, [row]))[0].insertId;

/* ── the content tables, emptied first so the script can be re-run ── */
const CONTENT_TABLES = [
  "post_categories", "testimonials", "programs", "posts", "categories", "authors", "stats", "learning_centers",
  "faqs", "team_members", "team_groups", "gallery_items", "gallery_categories", "hero_slides", "nav_items",
  "content_blocks", "core_pages", "settings", "pages", "media",
];
await db.query("SET FOREIGN_KEY_CHECKS = 0");
for (const t of CONTENT_TABLES) await db.query(`DELETE FROM ${t}`);
await db.query("SET FOREIGN_KEY_CHECKS = 1");
fs.rmSync(UPLOAD_DIR, { recursive: true, force: true });

/* ── media: the same processing as src/server/media.ts ─────────────── */
const mediaCache = new Map();
async function addMedia(file, alt, source) {
  const key = `${source}|${alt}`;
  if (mediaCache.has(key)) return mediaCache.get(key);
  const input = fs.readFileSync(file);
  const now = new Date();
  const folder = `${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  let data, ext, mime, width = null, height = null;
  if (input.subarray(0, 5).toString("latin1") === "%PDF-") {
    [data, ext, mime] = [input, "pdf", "application/pdf"];
  } else {
    const out = await sharp(input, { failOn: "error" })
      .rotate()
      .resize({ width: 2400, height: 2400, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    [data, ext, mime, width, height] = [out.data, "webp", "image/webp", out.info.width, out.info.height];
  }
  const relative = `${folder}/${randomBytes(10).toString("hex")}.${ext}`;
  fs.mkdirSync(path.join(UPLOAD_DIR, folder), { recursive: true });
  fs.writeFileSync(path.join(UPLOAD_DIR, relative), data);
  const id = await insert("media", {
    path: relative,
    original_name: path.basename(file).slice(0, 255),
    mime,
    size_bytes: data.length,
    width,
    height,
    alt: (alt || path.basename(file).replace(/\.[a-z0-9]+$/i, "").replace(/[-_]+/g, " ")).slice(0, 300),
    source_url: source.slice(0, 500),
  });
  mediaCache.set(key, id);
  return id;
}
const siteImage = (name, alt) => (name ? addMedia(path.join(EXPORT, "site-images", name), alt, `legacy:/content/uploads/wef/${name}`) : null);

const sanityAssets = new Map(JSON.parse(fs.readFileSync(path.join(EXPORT, "sanity/assets.json"), "utf8")).map((a) => [a._id, a]));
const sanityImage = (img) => {
  const asset = img?.asset?._ref && sanityAssets.get(img.asset._ref);
  if (!asset) return null;
  return addMedia(path.join(EXPORT, "sanity/images", `${asset._id}.${asset.extension}`), img.alt || "", `sanity:${asset._id}`);
};

/* ── links: old addresses -> new ones ──────────────────────────────── */
const PAGE_MOVES = {
  "/pages/mission": "/mission", "/pages/centers": "/centers", "/pages/gallery": "/gallery", "/pages/contact": "/contact",
  "/pages/active-projects": "/projects", "/pages/project-updates": "/updates", "/pages/success-stories": "/stories",
  "/team": "/team", "/donate": "/donate",
};
function newUrl(url) {
  if (!url) return url;
  if (/zeffy\.com|paypal\.com/i.test(url)) return DONATE_URL;
  const u = url.replace(/^https?:\/\/(www\.)?wefcanada\.org/i, "").replace(/\.html$/, "").replace(/\/$/, "") || "/";
  if (!u.startsWith("/")) return url;
  if (PAGE_MOVES[u]) return PAGE_MOVES[u];
  const m = u.match(/^\/pages\/(projects|updates|stories|topics)\/(.+)$/);
  return m ? `/${m[1]}/${m[2]}` : u;
}

/* ── Sanity portable text -> the editor's JSON ─────────────────────── */
async function portableToDoc(blocks = []) {
  const content = [];
  let list = null;
  const spans = (b) =>
    (b.children ?? [])
      .filter((c) => c._type === "span" && c.text)
      .map((c) => {
        const marks = [];
        for (const m of c.marks ?? []) {
          if (m === "strong") marks.push({ type: "bold" });
          else if (m === "em") marks.push({ type: "italic" });
          else {
            const def = (b.markDefs ?? []).find((d) => d._key === m);
            if (def?.href) marks.push({ type: "link", attrs: { href: newUrl(def.href) } });
          }
        }
        return { type: "text", text: c.text, ...(marks.length ? { marks } : {}) };
      });
  for (const b of blocks) {
    if (b._type === "block" && b.listItem) {
      if (!list) content.push((list = { type: b.listItem === "number" ? "orderedList" : "bulletList", content: [] }));
      list.content.push({ type: "listItem", content: [{ type: "paragraph", content: spans(b) }] });
      continue;
    }
    list = null;
    if (b._type === "block") {
      const inline = spans(b);
      if (!inline.length) continue;
      if (b.style === "h2" || b.style === "h3") content.push({ type: "heading", attrs: { level: b.style === "h2" ? 2 : 3 }, content: inline });
      else if (b.style === "blockquote") content.push({ type: "blockquote", content: [{ type: "paragraph", content: inline }] });
      else content.push({ type: "paragraph", content: inline });
    } else if (b._type === "image") {
      const id = await sanityImage(b);
      if (id) content.push({ type: "figure", attrs: { mediaId: id, alt: b.alt || "", caption: "" } });
    } else if (b._type === "statGroup") {
      content.push({ type: "statStrip", attrs: { stats: (b.stats ?? []).map((s) => ({ value: s.value, label: s.label })) } });
    }
  }
  return JSON.stringify({ type: "doc", content });
}

/* HTML from the old pages (FAQ answers) -> the editor's JSON: one paragraph, links and line breaks kept. */
function htmlToDoc(html) {
  const $ = cheerio.load(`<div id="r">${html}</div>`);
  const inline = [];
  $("#r").contents().each((_, n) => {
    if (n.type === "text") {
      const text = n.data.replace(/\s+/g, " ");
      if (text.trim() || (inline.length && text === " ")) inline.push({ type: "text", text });
    } else if (n.name === "br") inline.push({ type: "hardBreak" });
    else if (n.name === "a") {
      const text = $(n).text().replace(/\s+/g, " ");
      inline.push({ type: "text", text, marks: [{ type: "link", attrs: { href: newUrl($(n).attr("href")) } }] });
    } else inline.push({ type: "text", text: $(n).text().replace(/\s+/g, " ") });
  });
  // Tidy the edges and the space before a line break.
  if (inline[0]?.text) inline[0].text = inline[0].text.trimStart();
  const last = inline[inline.length - 1];
  if (last?.text) last.text = last.text.trimEnd();
  for (let i = 0; i < inline.length - 1; i++) if (inline[i + 1].type === "hardBreak" && inline[i].text) inline[i].text = inline[i].text.trimEnd();
  for (let i = 1; i < inline.length; i++) if (inline[i - 1].type === "hardBreak" && inline[i].text) inline[i].text = inline[i].text.trimStart();
  return JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: inline.filter((n) => n.type !== "text" || n.text) }] });
}

/* The curated search titles the old build script applied (legacy/scripts/sanity-sync.mjs). */
const syncSource = fs.readFileSync(path.join(LEGACY, "scripts/sanity-sync.mjs"), "utf8");
const objectLiteral = (name) => {
  const start = syncSource.indexOf(`const ${name} = {`);
  const end = syncSource.indexOf("\n};", start);
  return new Function(`return ${syncSource.slice(start + `const ${name} = `.length, end + 2)}`)();
};
const SEO_DEFAULTS = objectLiteral("SEO_DEFAULTS");
const TOPIC_SEO = objectLiteral("TOPIC_SEO");
const stripBrand = (t = "") => String(t).replace(/\s*[—|–-]\s*Worldwide Education (Fund|Foundation)(\s+Canada)?\s*$/i, "").trim();

/* ── 1. Sanity: authors, topics, posts ─────────────────────────────── */
const read = (f) => JSON.parse(fs.readFileSync(path.join(EXPORT, f), "utf8"));
const authorIds = new Map();
for (const a of read("sanity/author.json")) {
  authorIds.set(a._id, await insert("authors", { name: a.name, role: a.role ?? null, bio: a.bio ?? null, status: "published", image_media_id: await sanityImage(a.image) }));
}
const categoryIds = new Map();
for (const c of read("sanity/category.json").sort((a, b) => (a.order ?? 10) - (b.order ?? 10))) {
  const [seoTitle, seoDescription] = TOPIC_SEO[c.slug.current] ?? [];
  categoryIds.set(
    c._id,
    await insert("categories", {
      title: c.title,
      slug: c.slug.current,
      description: c.description ?? null,
      seo_title: seoTitle ?? null,
      seo_description: seoDescription ?? null,
      display_order: (c.order ?? 10) * 10,
      status: "published",
    }),
  );
}
const postIds = new Map();
for (const p of read("sanity/post.json")) {
  const [seoTitle, seoDescription] = SEO_DEFAULTS[`${p.postType}/${p.slug.current}`] ?? [];
  const cta = p.cta ?? {};
  const id = await insert("posts", {
    section: p.postType,
    title: p.title,
    card_title: p.cardTitle && p.cardTitle !== p.title ? p.cardTitle : null,
    slug: p.slug.current,
    excerpt: p.excerpt ?? null,
    body: await portableToDoc(p.body),
    author_id: authorIds.get(p.author?._ref) ?? null,
    image_media_id: await sanityImage(p.mainImage),
    published_at: new Date(p.publishedAt ?? p._createdAt),
    date_label: p.dateLabel ?? null,
    location: p.location ?? null,
    featured: p.featured ? 1 : 0,
    cta_heading: cta.heading ?? null,
    cta_text: cta.text ?? null,
    cta_primary_label: cta.primaryLabel ?? null,
    cta_primary_url: newUrl(cta.primaryUrl) ?? null,
    cta_secondary_label: cta.secondaryLabel ?? null,
    cta_secondary_url: newUrl(cta.secondaryUrl) ?? null,
    seo_title: seoTitle || stripBrand(p.seoTitle) || null,
    seo_description: seoDescription || p.seoDescription || null,
    legacy_url: `/pages/${{ update: "updates", story: "stories", project: "projects" }[p.postType]}/${p.slug.current}`,
    status: "published",
  });
  postIds.set(`${p.postType}/${p.slug.current}`, id);
  let pos = 0;
  for (const c of p.categories ?? []) {
    const cid = categoryIds.get(c._ref);
    if (cid) await insert("post_categories", { post_id: id, category_id: cid, position: pos++ });
  }
}

/* ── 2. The hand-written pages ─────────────────────────────────────── */
const S = read("static.json");
const order = (i) => (i + 1) * 10;

for (const [i, h] of S.hero_slides.entries()) {
  await insert("hero_slides", { description: h.caption, image_media_id: await siteImage(h.image, h.alt), display_order: order(i), status: "published" });
}

// Home program cards (photo strip and Our Programs) come from the export as they are.
let pi = 0;
for (const p of S.programs.filter((x) => x.placement !== "mission")) {
  await insert("programs", {
    placement: p.placement,
    title: p.title.trim(),
    lead: p.lead || null,
    badge: p.badge || null,
    points: (p.points ?? []).join("\n") || null,
    stats: (p.stats ?? []).join("\n") || null,
    image_media_id: await siteImage(p.image, p.alt),
    display_order: order(pi++),
    status: "published",
  });
}
// The Mission rows are read straight from the page, columns and expandable tracks included.
{
  const $ = cheerio.load(fs.readFileSync(path.join(LEGACY, "pages/mission.html"), "utf8"));
  const t = (el) => $(el).text().replace(/\s+/g, " ").trim();
  const columns = (scope) =>
    $(scope)
      .children(".pcols")
      .find(".pcol")
      .map((_, c) => [t($(c).find("h4")), ...$(c).find("li").map((__, li) => t(li)).get()].join("\n"))
      .get()
      .join("\n\n");
  const notes = (scope) => $(scope).children(".pnotes").find("li").map((_, li) => t(li)).get().join("\n");
  let mi = 0;
  for (const row of $(".prow").toArray()) {
    const e = $(row);
    const body = e.find(".prow-body").first();
    const img = e.find(".prow-media img").first();
    const parentId = await insert("programs", {
      placement: "mission",
      title: t(body.children("h3")),
      lead: t(body.children(".prow-model")) || null,
      badge: t(e.find(".prow-year")) || null,
      category: t(body.children(".prow-cat")) || null,
      accent: (e.attr("style") ?? "").match(/--accent:\s*([^;"]+)/)?.[1]?.trim() ?? null,
      columns_text: columns(body) || null,
      notes: notes(body) || null,
      image_media_id: await siteImage(decodeURIComponent((img.attr("src") ?? "").replace(/^.*\/content\/uploads\/wef\//, "")), img.attr("alt")),
      display_order: order(mi++),
      status: "published",
    });
    let ti = 0;
    for (const acc of body.find("details.pacc").toArray()) {
      const d = $(acc);
      const panel = d.children(".pacc-panel");
      const summary = d.children("summary").clone();
      const meta = t(summary.find(".pacc-meta"));
      summary.find(".pacc-meta, svg").remove();
      await insert("programs", {
        placement: "mission",
        parent_id: parentId,
        title: t(summary),
        lead: t(panel.children(".prow-model")) || null,
        badge: meta || null,
        columns_text: columns(panel) || null,
        notes: notes(panel) || null,
        display_order: order(ti++),
        status: "published",
      });
    }
  }
}

for (const [i, s] of S.stats.entries()) {
  // The home counter for scholars reads "+66" on the old page; the + stays in front.
  await insert("stats", { placement: s.placement, value: s.value, label: s.label, note: s.note || null, display_order: order(i), status: "published" });
}
for (const [i, [value, label]] of [["100+", "learning centers"], ["52,000", "children in the ECD ecosystem"], ["66", "university scholarships"]].entries()) {
  await insert("stats", { placement: "donate", value, label, display_order: order(i), status: "published" });
}

for (const [i, q] of S.testimonials.entries()) {
  await insert("testimonials", {
    quote: q.quote,
    name: q.name || null,
    context: q.role || null,
    location: q.location || null,
    image_media_id: await siteImage(q.image, q.name),
    post_id: postIds.get("story/from-silence-to-confidence") ?? null,
    display_order: order(i),
    status: "published",
  });
}

for (const [i, f] of S.faqs.entries()) {
  await insert("faqs", { question: f.question, answer: htmlToDoc(f.answer_html), display_order: order(i), status: "published" });
}

{
  const groupId = await insert("team_groups", {
    heading: "Co-Founders",
    eyebrow: "Guidance & governance",
    description: "Co-Founders in finance, education, and philanthropy who help shape WEF's strategy and reach.",
    display_order: 10,
    status: "published",
  });
  for (const [i, m] of S.team.entries()) {
    await insert("team_members", {
      group_id: groupId,
      name: m.name,
      role: m.role,
      bio: m.bio,
      image_media_id: await siteImage(m.image, m.name),
      display_order: order(i),
      status: "published",
    });
  }
}

{
  // The gallery's own data block carries the longer lightbox captions; they become the photos' descriptions.
  const html = fs.readFileSync(path.join(LEGACY, "pages/gallery.html"), "utf8");
  const data = JSON.parse(html.match(/window\.__GALLERY = (\[.*?\]);<\/script>/)[1]);
  const catIds = new Map();
  for (const [i, label] of S.gallery_categories.entries()) {
    catIds.set(label, await insert("gallery_categories", { label, display_order: order(i), status: "published" }));
  }
  for (const [i, g] of data.entries()) {
    const name = decodeURIComponent(g.src.replace(/^.*\/content\/uploads\/wef\//, ""));
    await insert("gallery_items", {
      media_id: await siteImage(name, g.cap),
      caption: g.title,
      category_id: catIds.get(g.cat) ?? null,
      display_order: order(i),
      status: "published",
    });
  }
}

for (const [i, c] of S.learning_centers.entries()) {
  await insert("learning_centers", {
    name: c.name,
    village: c.village,
    region: c.region,
    model: c.model,
    sponsor: c.sponsor,
    enrollment: c.enrollment,
    lat: c.lat,
    lon: c.lon,
    display_order: order(i),
    status: "published",
  });
}

/* ── 3. Page images, and the menus with the brochure link ──────────── */
const brochure = await siteImage("ECLC Brochure Canada.pdf", "Worldwide Education Fund Canada — Early Childhood Learning Centers brochure (PDF)");
const scholarship = await siteImage("WEF (CANADA) SCHOLARSHIP PROGRAM_page-0001.jpg", "WEF (Canada) Scholarship Program overview graphic");
await insert("content_blocks", { page_key: "home", block_key: "brochure_file", value: String(brochure) });
await insert("content_blocks", { page_key: "home", block_key: "scholarship_image", value: String(scholarship) });
const [[brochureRow]] = await db.query("SELECT path FROM media WHERE id = ?", [brochure]);

const nav = async (menu, label, href, parent = null, i = 0, kind = "link") =>
  insert("nav_items", { menu, label, href, parent_id: parent, display_order: order(i), kind });
{
  await nav("header", "Home", "/", null, 0);
  const about = await nav("header", "About", "#", null, 1);
  await nav("header", "Our Team", "/team", about, 0);
  await nav("header", "Our Mission", "/mission", about, 1);
  const impact = await nav("header", "Impact", "#", null, 2);
  await nav("header", "Learning Centers Map", "/centers", impact, 0);
  await nav("header", "Success Stories", "/stories", impact, 1);
  await nav("header", "Project Updates", "/updates", impact, 2);
  const work = await nav("header", "What We Do", "#", null, 3);
  await nav("header", "Active Projects", "/projects", work, 0);
  await nav("header", "Gallery", "/gallery", null, 4);
  await nav("header", "Contact", "/contact", null, 5);

  const explore = await nav("footer", "Explore", null, null, 0);
  await nav("footer", "Our Team", "/team", explore, 0);
  await nav("footer", "Our Mission", "/mission", explore, 1);
  await nav("footer", "Gallery", "/gallery", explore, 2);
  await nav("footer", "Success Stories", "/stories", explore, 3);
  await nav("footer", "Canada Brochure (PDF)", `/uploads/${brochureRow.path}`, explore, 4);
  const involved = await nav("footer", "Get Involved", null, null, 1);
  await nav("footer", "Donate", DONATE_URL, involved, 0);
  await nav("footer", "Ways to Give", "/donate", involved, 1);
  await nav("footer", "Contact Us", "/contact", involved, 2);
  await nav("footer", "Active Projects", "/projects", involved, 3);
}

/* ── 4. The backup file: the same format as Admin -> Backups ───────── */
const BACKUP_TABLES = [
  "media", "settings", "content_blocks", "core_pages", "pages", "nav_items", "hero_slides", "programs", "stats",
  "learning_centers", "faqs", "team_groups", "team_members", "gallery_categories", "gallery_items", "authors",
  "categories", "posts", "post_categories", "testimonials", "submissions", "newsletter_subscribers",
];
const tables = {};
for (const t of BACKUP_TABLES) [tables[t]] = await db.query(`SELECT * FROM ${t}`);
const dir = await mkdtemp(path.join(os.tmpdir(), "wefc-import-"));
await writeFile(path.join(dir, "database.json"), JSON.stringify({ format: "wefc-backup-1", createdAt: new Date().toISOString(), tables }));
fs.cpSync(UPLOAD_DIR, path.join(dir, "uploads"), { recursive: true });
const outFile = path.join(EXPORT, "wefc-content-backup.tar.gz");
await tar.c({ gzip: true, cwd: dir, file: outFile, portable: true }, ["database.json", "uploads"]);
await rm(dir, { recursive: true, force: true });

const counts = Object.fromEntries(BACKUP_TABLES.map((t) => [t, tables[t].length]).filter(([, n]) => n));
console.log(counts);
console.log(`Backup: ${outFile} (${(fs.statSync(outFile).size / 1048576).toFixed(1)} MB)`);
await db.end();
