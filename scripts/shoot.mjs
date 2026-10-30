/**
 * Full-page screenshots of the main routes, for eyeballing a change.
 *   node scripts/shoot.mjs                        # local dev server
 *   BASE=https://wefcanada.org OLD=1 node scripts/shoot.mjs   # the old static site, for comparison
 * Writes .shots/<name>.png (gitignored).
 */
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const BASE = process.env.BASE || "http://localhost:3000";
const OLD = Boolean(process.env.OLD);
const WIDTH = Number(process.env.WIDTH || 1440);
const only = process.argv.slice(2);
const routes = [
  ["home", "/", "/"],
  ["mission", "/mission", "/pages/mission"],
  ["team", "/team", "/team/"],
  ["centers", "/centers", "/pages/centers"],
  ["gallery", "/gallery", "/pages/gallery"],
  ["contact", "/contact", "/pages/contact"],
  ["donate", "/donate", "/donate/"],
  ["updates", "/updates", "/pages/project-updates"],
  ["article", "/projects/bright-beginnings-eclc", "/pages/projects/bright-beginnings-eclc"],
  ["topic", "/topics/scholarships", "/pages/topics/scholarships"],
].filter(([name]) => !only.length || only.includes(name));

await mkdir(".shots", { recursive: true });
const browser = await chromium.launch();
for (const [name, path, oldPath] of routes) {
  const ctx = await browser.newContext({ viewport: { width: WIDTH, height: 900 }, deviceScaleFactor: 1, reducedMotion: "reduce" });
  const page = await ctx.newPage();
  const res = await page.goto(BASE + (OLD ? oldPath : path), { waitUntil: "load", timeout: 60000 });
  // Scroll through so every scroll-reveal fires, then back to the top.
  await page.evaluate(async () => {
    for (let y = 0; y < document.body.scrollHeight; y += 600) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 60));
    }
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(1200);
  const file = `.shots/${OLD ? "old-" : ""}${name}-${WIDTH}.png`;
  await page.screenshot({ path: file, fullPage: true });
  console.log(`${file}  HTTP ${res.status()}`);
  await ctx.close();
}
await browser.close();
