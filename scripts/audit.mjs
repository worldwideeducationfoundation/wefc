/**
 * Phase 1 quality gate — runs the brief's §9 acceptance criteria as
 * automated checks so "done" is evidence, not opinion.
 *
 *   npm run build && npm start   # then:
 *   node scripts/audit.mjs
 */
import { chromium } from "playwright";
import { AxeBuilder } from "@axe-core/playwright";

const BASE = process.env.BASE || "http://localhost:3000";
/* Every route the site serves, plus one programme detail page as the
   representative of the five generated from the same component. */
const ROUTES = [
  "/",
  "/about",
  "/about/team",
  "/projects",
  "/projects/learning-centers",
  "/gallery/pictures",
  "/gallery/videos",
  "/project-updates",
  "/blog",
  "/blog/ecd-first-graduation",
  /* An imported update, image-heavy — the representative of the 20
     brought over from the old WordPress site. */
  "/project-updates/kamals-visit-to-chitral",
  "/blog/category/announcements",
  "/contact",
];
/* Real device widths, not round numbers: iPhone SE and 12/13/14 in
   portrait, iPad mini/Air portrait, iPad Pro portrait and landscape,
   then laptop and desktop. */
const WIDTHS = [320, 360, 390, 414, 768, 834, 1024, 1180, 1280, 1440, 1920];

let failures = 0;
const fail = (m) => {
  failures++;
  console.log(`  ✗ ${m}`);
};
const pass = (m) => console.log(`  ✓ ${m}`);

const browser = await chromium.launch();

/* ---------- 1. axe-core, every route ---------- */
console.log("\n── axe-core (WCAG 2.1 A/AA) ──");
for (const route of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + route, { waitUntil: "networkidle" });
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  if (violations.length === 0) pass(`${route} — 0 violations`);
  else
    for (const v of violations)
      fail(`${route} — [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
  await ctx.close();
}

/* ---------- 2. Contrast of real rendered text (brief §2.2) ---------- */
console.log("\n── Contrast audit of actual painted text ──");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });

  const results = await page.evaluate(() => {
    const lum = (c) => {
      const s = c.map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * s[0] + 0.7152 * s[1] + 0.0722 * s[2];
    };
    /* Tailwind v4 emits oklab() / color-mix() for tinted and
       alpha-modified colours, which no regex should try to parse.
       Round-trip every colour through a canvas so the browser itself
       resolves it to sRGB bytes. */
    const cv = document.createElement("canvas");
    cv.width = cv.height = 1;
    const cx = cv.getContext("2d", { willReadFrequently: true });
    const toRGBA = (str) => {
      cx.globalCompositeOperation = "copy";
      cx.fillStyle = "rgba(0,0,0,0)";
      cx.fillRect(0, 0, 1, 1);
      cx.fillStyle = str;
      cx.fillRect(0, 0, 1, 1);
      const d = cx.getImageData(0, 0, 1, 1).data;
      return [d[0], d[1], d[2], d[3] / 255];
    };
    /* Composite the ancestor background stack down onto white so a
       translucent header over the page ground resolves correctly. */
    const opaqueBg = (el) => {
      const layers = [];
      let n = el;
      while (n && n !== document.documentElement) {
        const [r, g, b, a] = toRGBA(getComputedStyle(n).backgroundColor);
        if (a > 0) layers.push([r, g, b, a]);
        if (a >= 0.999) break;
        n = n.parentElement;
      }
      let out = [255, 255, 255];
      for (let i = layers.length - 1; i >= 0; i--) {
        const [r, g, b, a] = layers[i];
        out = [
          Math.round(r * a + out[0] * (1 - a)),
          Math.round(g * a + out[1] * (1 - a)),
          Math.round(b * a + out[2] * (1 - a)),
        ];
      }
      return out;
    };
    const out = [];
    for (const el of document.querySelectorAll("h1,h2,h3,p,a,li,button,dt,dd,span")) {
      const t = (el.textContent || "").trim();
      if (!t || el.children.length > 0) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const r = el.getBoundingClientRect();
      /* Visually-hidden text is never painted, so it has no contrast to
         measure. Tailwind's `sr-only` collapses the box to 1x1 and clips
         it; measuring it reports the inherited colour against whatever
         ground happens to be behind, which is meaningless. axe-core
         excludes these for the same reason. */
      if (r.width <= 1 || r.height <= 1) continue;
      if (cs.clip === "rect(0px, 0px, 0px, 0px)") continue;
      const fg = toRGBA(cs.color).slice(0, 3);
      const bg = opaqueBg(el);
      const L1 = lum(fg), L2 = lum(bg);
      const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const px = parseFloat(cs.fontSize);
      const bold = parseInt(cs.fontWeight, 10) >= 700;
      const large = px >= 24 || (px >= 18.66 && bold);
      out.push({
        text: t.slice(0, 44),
        ratio: +ratio.toFixed(2),
        required: large ? 3 : 4.5,
        px: Math.round(px),
        fg: cs.color,
        bg: `rgb(${bg.join(",")})`,
      });
    }
    return out;
  });

  const bad = results.filter((r) => r.ratio < r.required);
  const worst = [...results].sort((a, b) => a.ratio - b.ratio).slice(0, 3);
  if (bad.length === 0) {
    pass(`${results.length} text nodes measured, all pass`);
    for (const w of worst)
      console.log(`      tightest: ${w.ratio}:1 (needs ${w.required}) ${w.px}px "${w.text}"`);
  } else {
    for (const b of bad)
      fail(`${b.ratio}:1 (needs ${b.required}) ${b.px}px "${b.text}" ${b.fg} on ${b.bg}`);
  }
  await ctx.close();
}

/* ---------- 3. Structure + old-site regressions (§0, §9) ---------- */
console.log("\n── Structure & §0 regressions ──");
for (const route of ROUTES) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + route, { waitUntil: "networkidle" });

  const r = await page.evaluate(() => {
    const levels = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) =>
      Number(h.tagName[1])
    );
    let skip = null;
    for (let i = 1; i < levels.length; i++)
      if (levels[i] - levels[i - 1] > 1) skip = `h${levels[i - 1]} → h${levels[i]}`;
    return {
      h1: document.querySelectorAll("h1").length,
      skip,
      deadLinks: [...document.querySelectorAll("a")]
        .map((a) => a.getAttribute("href"))
        .filter((h) => !h || h === "#" || h === "<>" || h === "about:blank"),
      strongInHeading: document.querySelectorAll("h1 strong,h2 strong,h3 strong").length,
      viewport:
        document.querySelector('meta[name="viewport"]')?.getAttribute("content") || "",
      imgNoAlt: [...document.querySelectorAll("img")].filter(
        (i) => i.getAttribute("alt") === null
      ).length,
    };
  });

  const tag = route.padEnd(14);
  r.h1 === 1 ? pass(`${tag} exactly one <h1>`) : fail(`${tag} ${r.h1} <h1> elements`);
  r.skip ? fail(`${tag} heading skip ${r.skip}`) : pass(`${tag} no heading skips`);
  r.deadLinks.length === 0
    ? pass(`${tag} no dead links`)
    : fail(`${tag} dead links: ${r.deadLinks.join(", ")}`);
  r.strongInHeading === 0
    ? pass(`${tag} no <strong> inside headings`)
    : fail(`${tag} ${r.strongInHeading} <strong> in headings`);
  /\b(maximum-scale|user-scalable)\b/.test(r.viewport)
    ? fail(`${tag} viewport blocks zoom: "${r.viewport}"`)
    : pass(`${tag} pinch-zoom allowed`);
  r.imgNoAlt === 0
    ? pass(`${tag} all <img> have an alt attribute`)
    : fail(`${tag} ${r.imgNoAlt} <img> missing alt`);
  await ctx.close();
}

/* ---------- 4. No horizontal overflow, every route x every width ----
   Checking only the homepage missed real breaks: a long partner name or
   a wide stat grid can overflow an interior route while `/` stays
   clean. Every route is now tested at every device width. */
console.log("");
console.log("── Horizontal overflow (all routes x all widths) ──");
for (const w of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 900 } });
  const page = await ctx.newPage();
  const broken = [];
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    const over = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth
    );
    if (over > 0) broken.push(`${route} +${over}px`);
  }
  broken.length === 0
    ? pass(`${w}px — clean across ${ROUTES.length} routes`)
    : fail(`${w}px — ${broken.join(", ")}`);
  await ctx.close();
}

/* ---------- 4b. Touch targets on a phone (WCAG 2.5.8) -------------
   Every control must be at least 24x24 CSS px. Measured at 390px,
   where controls are most likely to be cramped. Inline links inside
   running text are exempt under 2.5.8. */
console.log("");
console.log("── Touch targets at 390px ──");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await ctx.newPage();
  const small = [];
  for (const route of ROUTES) {
    await page.goto(BASE + route, { waitUntil: "networkidle" });
    const bad = await page.evaluate(() => {
      const out = [];
      for (const el of document.querySelectorAll("a[href], button")) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden") continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        /* Skip-links and other sr-only controls are 1x1 until focused,
           at which point they render at full size. */
        if (r.width <= 1 || r.height <= 1) continue;
        if (cs.clip === "rect(0px, 0px, 0px, 0px)") continue;
        if (cs.display.startsWith("inline") && el.closest("p, li, dd, figcaption, address")) continue;
        if (r.width < 24 || r.height < 24) {
          out.push(`${el.tagName.toLowerCase()} "${(el.textContent || "").trim().slice(0, 24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
        }
      }
      return out;
    });
    if (bad.length) small.push(`${route}: ${bad.slice(0, 4).join("; ")}`);
  }
  small.length === 0
    ? pass(`all controls >= 24x24 CSS px across ${ROUTES.length} routes`)
    : small.forEach((m) => fail(m));
  await ctx.close();
}

/* ---------- 4c. Landing carousel ---------------------------------- */
console.log("");
console.log("── Landing carousel ──");
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });

  const count = await page.locator('[aria-roledescription="carousel"]').count();
  count === 1 ? pass("carousel present, once") : fail(`expected 1 carousel, found ${count}`);

  const first = await page.evaluate(() => {
    const el = document.querySelector("main")?.firstElementChild;
    return el?.getAttribute("aria-roledescription") === "carousel";
  });
  first ? pass("carousel is the first element in <main>") : fail("carousel is not first in <main>");

  const track = page.locator('[aria-roledescription="carousel"] ul').first();
  const t1 = await track.evaluate((el) => el.style.transform);
  await page.waitForTimeout(1500);
  const t2 = await track.evaluate((el) => el.style.transform);
  t1 !== t2 ? pass(`auto-advances (${t1} -> ${t2})`) : fail("carousel did not advance");

  const pauseBtn = page.getByRole("button", { name: /pause slideshow/i });
  if (await pauseBtn.count()) {
    await pauseBtn.first().click();
    const p1 = await track.evaluate((el) => el.style.transform);
    await page.waitForTimeout(1500);
    const p2 = await track.evaluate((el) => el.style.transform);
    p1 === p2 ? pass("pause button stops auto-advance (WCAG 2.2.2)") : fail("pause button did not stop it");
  } else {
    fail("no pause control (WCAG 2.2.2)");
  }
  await ctx.close();
}

/* ---------- 4d. Carousel honours reduced motion ------------------- */
{
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const track = page.locator('[aria-roledescription="carousel"] ul').first();
  const t1 = await track.evaluate((el) => el.style.transform);
  await page.waitForTimeout(1700);
  const t2 = await track.evaluate((el) => el.style.transform);
  t1 === t2
    ? pass("carousel stationary under prefers-reduced-motion")
    : fail("carousel auto-advances despite prefers-reduced-motion");
  await ctx.close();
}

/* ---------- 5. Ticker behaviour (§5.2) ---------- */
console.log("\n── TickerBand ──");
{
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/projects", { waitUntil: "networkidle" });
  const track = page.locator(".scroller-track").first();

  const anim = await track.evaluate((el) => {
    const cs = getComputedStyle(el);
    return { name: cs.animationName, dur: cs.animationDuration, timing: cs.animationTimingFunction };
  });
  anim.name !== "none" ? pass(`animation applied (${anim.name}, ${anim.dur})`) : fail("no animation");
  parseFloat(anim.dur) >= 30 && parseFloat(anim.dur) <= 40
    ? pass(`cycle ${anim.dur} within the 30–40s spec`)
    : fail(`cycle ${anim.dur} outside 30–40s`);

  // Two identical copies => track is exactly 2x one copy
  const copies = await track.evaluate((el) => {
    const kids = [...el.children];
    return kids.map((k) => Math.round(k.getBoundingClientRect().width));
  });
  copies.length === 2 && copies[0] === copies[1]
    ? pass(`seamless loop: 2 copies, ${copies[0]}px each`)
    : fail(`expected 2 equal copies, got ${JSON.stringify(copies)}`);

  // It actually moves
  const p1 = await track.evaluate((el) => getComputedStyle(el).transform);
  await page.waitForTimeout(700);
  const p2 = await track.evaluate((el) => getComputedStyle(el).transform);
  p1 !== p2 ? pass("track is moving") : fail(`track static (${p1})`);

  // Pauses on hover. Hover the *viewport*, not the track — the track
  // is in motion and Playwright refuses to hover an unstable element,
  // and `.scroller-viewport:hover` is what the CSS rule targets.
  await page.locator(".scroller-viewport").first().hover({ force: true });
  await page.waitForTimeout(150);
  const h1 = await track.evaluate((el) => getComputedStyle(el).transform);
  await page.waitForTimeout(600);
  const h2 = await track.evaluate((el) => getComputedStyle(el).transform);
  h1 === h2 ? pass("pauses on hover") : fail("does not pause on hover");

  // Screen readers get it once, statically
  const srCount = await page.locator(".sr-only li").count();
  const ariaHidden = await track.getAttribute("aria-hidden");
  ariaHidden === "true" && srCount > 0
    ? pass(`visual track aria-hidden; ${srCount} items exposed once to SR`)
    : fail(`a11y wiring wrong (aria-hidden=${ariaHidden}, sr items=${srCount})`);
  await ctx.close();
}

/* ---------- 6. prefers-reduced-motion ---------- */
console.log("\n── prefers-reduced-motion: reduce ──");
{
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await ctx.newPage();
  await page.goto(BASE + "/projects", { waitUntil: "networkidle" });
  const track = page.locator(".scroller-track").first();
  const t1 = await track.evaluate((el) => getComputedStyle(el).transform);
  await page.waitForTimeout(800);
  const t2 = await track.evaluate((el) => getComputedStyle(el).transform);
  t1 === t2 ? pass("ticker is stationary") : fail("ticker still animating");

  const scrollable = await page
    .locator(".scroller-viewport")
    .first()
    .evaluate((el) => getComputedStyle(el).overflowX);
  scrollable === "auto" || scrollable === "scroll"
    ? pass(`degrades to a scrollable strip (overflow-x: ${scrollable})`)
    : fail(`overflow-x is "${scrollable}", not scrollable`);
  await ctx.close();
}

/* ---------- 7. Keyboard: mobile drawer ---------- */
console.log("\n── Mobile drawer keyboard behaviour ──");
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: /open menu/i });
  await trigger.click();
  const dialog = page.getByRole("dialog");
  (await dialog.isVisible()) ? pass("drawer opens") : fail("drawer did not open");
  const focusInside = await page.evaluate(
    () => !!document.activeElement?.closest('[role="dialog"]')
  );
  focusInside ? pass("focus moves into the drawer") : fail("focus not moved into drawer");
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  (await dialog.count()) === 0 ? pass("Escape closes it") : fail("Escape did not close it");
  const returned = await page.evaluate(
    () => document.activeElement?.getAttribute("aria-controls") === "mobile-nav"
  );
  returned ? pass("focus returns to the trigger") : fail("focus did not return to trigger");
  await ctx.close();
}

await browser.close();
console.log(
  failures === 0
    ? "\n✅ All Phase 1 checks passed.\n"
    : `\n❌ ${failures} check(s) failed.\n`
);
process.exit(failures === 0 ? 0 : 1);
