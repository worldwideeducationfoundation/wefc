/**
 * Quality gate for the public site: accessibility, structure, mobile layout
 * and search basics, on every page in the sitemap.
 *
 *   node scripts/audit.mjs                       # against http://localhost:3000
 *   BASE=https://wefcanada.org node scripts/audit.mjs
 *
 * Exits 1 when anything fails, so it can gate a deploy.
 */
import { chromium, devices, webkit } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const BASE = (process.env.BASE || "http://localhost:3000").replace(/\/$/, "");

/* Phones the site must work on: iPhone SE (the narrowest current iPhone),
   a standard iPhone, a large Android, and a 320px Android for older devices. */
const PHONES = [
  ["webkit", devices["iPhone SE"]],
  ["webkit", devices["iPhone 13"]],
  ["chromium", devices["Pixel 7"]],
  ["chromium", { ...devices["Pixel 7"], viewport: { width: 320, height: 640 } }],
];

let failures = 0;
const fail = (m) => {
  failures++;
  console.log(`  ✗ ${m}`);
};
const pass = (m) => console.log(`  ✓ ${m}`);

const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
const ROUTES = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);
if (ROUTES.length === 0) throw new Error(`No URLs in ${BASE}/sitemap.xml`);
console.log(`${ROUTES.length} routes from ${BASE}/sitemap.xml`);

const browsers = { chromium: await chromium.launch(), webkit: await webkit.launch() };

/* ---------- 1. Accessibility (axe-core, WCAG 2.1 A/AA) and structure ---------- */
console.log("\n── Accessibility and structure (1440px) ──");
const seo = [];
{
  const ctx = await browsers.chromium.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "load" });
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
    for (const v of violations) fail(`${route} [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length})`);

    const r = await page.evaluate(() => {
      const levels = [...document.querySelectorAll("main h1,main h2,main h3,main h4,main h5,main h6")].map((h) => Number(h.tagName[1]));
      const skip = levels.find((l, i) => i > 0 && l - levels[i - 1] > 1);
      const meta = (sel) => document.querySelector(sel)?.getAttribute("content") ?? "";
      return {
        h1: document.querySelectorAll("h1").length,
        skip,
        imgNoAlt: [...document.querySelectorAll("img")].filter((i) => i.getAttribute("alt") === null).length,
        zoomBlocked: /maximum-scale|user-scalable/.test(meta('meta[name="viewport"]')),
        title: document.title,
        description: meta('meta[name="description"]'),
        canonical: document.querySelector('link[rel="canonical"]')?.getAttribute("href") ?? "",
        ogImage: meta('meta[property="og:image"]'),
        jsonLd: [...document.querySelectorAll('script[type="application/ld+json"]')].every((s) => {
          try {
            JSON.parse(s.textContent);
            return true;
          } catch {
            return false;
          }
        }),
      };
    });
    if (r.h1 !== 1) fail(`${route} has ${r.h1} <h1> elements`);
    if (r.skip) fail(`${route} skips a heading level (to h${r.skip})`);
    if (r.imgNoAlt) fail(`${route} ${r.imgNoAlt} <img> without alt`);
    if (r.zoomBlocked) fail(`${route} viewport blocks pinch-zoom`);
    if (!r.jsonLd) fail(`${route} has invalid JSON-LD`);
    seo.push({ route, ...r });
  }
  await ctx.close();
  if (!failures) pass("no axe violations, one <h1> per page, no heading skips, every image has alt");
}

/* ---------- 2. Search basics ---------- */
console.log("\n── Search ──");
{
  const before = failures;
  for (const s of seo) {
    if (!s.title || s.title.length > 65) fail(`${s.route} title is ${s.title.length} characters: "${s.title}"`);
    if (!s.description || s.description.length > 165) fail(`${s.route} description is ${s.description.length} characters`);
    if (!s.canonical) fail(`${s.route} has no canonical`);
    if (!s.ogImage) fail(`${s.route} has no og:image`);
  }
  for (const key of ["title", "description"]) {
    const seen = new Map();
    for (const s of seo) seen.set(s[key], [...(seen.get(s[key]) ?? []), s.route]);
    for (const [value, routes] of seen) if (routes.length > 1) fail(`duplicate ${key} on ${routes.join(", ")}: "${value}"`);
  }
  if (failures === before) pass("titles ≤65 and descriptions ≤165 characters, all unique; canonical and og:image everywhere");
}

/* ---------- 3. Phones: no sideways scrolling, tappable controls, readable text ---------- */
console.log("\n── Phones (iOS WebKit and Android Chromium) ──");
{
  const before = failures;
  for (const [engine, device] of PHONES) {
    const ctx = await browsers[engine].newContext({ ...device });
    const page = await ctx.newPage();
    const w = device.viewport.width;
    for (const route of ROUTES) {
      await page.goto(BASE + route, { waitUntil: "load" });
      const r = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const small = [];
        const tiny = new Set();
        for (const el of document.querySelectorAll("body *")) {
          if (el.closest("[aria-hidden=true], .leaflet-control-attribution, iframe")) continue;
          const cs = getComputedStyle(el);
          if (cs.display === "none" || cs.visibility === "hidden") continue;
          const b = el.getBoundingClientRect();
          if (!b.width || !b.height || b.width <= 1) continue;
          // WCAG 2.5.8: 24px targets; inline links in running text are exempt.
          if (el.matches("a[href], button") && (b.width < 24 || b.height < 24) && !(cs.display.startsWith("inline") && el.closest("p, li, dd, figcaption, address")))
            small.push(`${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)}" ${Math.round(b.width)}x${Math.round(b.height)}`);
          if ([...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()) && parseFloat(cs.fontSize) < 12)
            tiny.add(`${el.tagName.toLowerCase()}.${[...el.classList].join(".")} ${cs.fontSize}`);
        }
        return { overflow: document.documentElement.scrollWidth - vw, small, tiny: [...tiny] };
      });
      if (r.overflow > 1) fail(`${engine} ${w}px ${route} scrolls sideways by ${r.overflow}px`);
      for (const s of r.small.slice(0, 3)) fail(`${engine} ${w}px ${route} small tap target: ${s}`);
      for (const s of r.tiny.slice(0, 3)) fail(`${engine} ${w}px ${route} text under 12px: ${s}`);
    }
    await ctx.close();
  }
  if (failures === before) pass(`${ROUTES.length} routes x ${PHONES.length} phones: no sideways scroll, 24px targets, 12px+ text`);
}

for (const b of Object.values(browsers)) await b.close();
console.log(failures ? `\n${failures} problem(s).` : "\nAll checks passed.");
process.exit(failures ? 1 : 0);
