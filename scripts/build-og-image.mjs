/**
 * Generates `public/og.png` — the 1200x630 card social platforms show
 * when the site is shared.
 *
 *   node scripts/build-og-image.mjs
 *
 * Rendered from the brand SVG and the design tokens rather than an
 * exported artboard, so it cannot drift from the site's own colours.
 * Committed to the repo: this is a build input, not a build artefact,
 * and regenerating it on every deploy would be wasted work.
 *
 * PNG, not SVG or WebP — Facebook, LinkedIn and X all still reject or
 * mishandle both for og:image.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.resolve(import.meta.dirname, "..");
const OUT = path.join(ROOT, "public", "og.png");

/* Straight from globals.css. */
const FOREST_950 = "#12251B";
const SAND_50 = "#F4F2EC";
const LIME_400 = "#A3D344";

const W = 1200;
const H = 630;

const logo = await fs.readFile(path.join(ROOT, "public", "brand", "fes-logo.svg"));

/* The lockup is multi-coloured, so it cannot simply be inverted — that
   rotates the hues instead of whitening them. Paint a solid sand
   rectangle and mask it with the logo's own alpha channel. */
const logoResized = await sharp(logo, { density: 400 })
  .resize({ width: 620, fit: "inside" })
  .png()
  .toBuffer();

const { width: logoW = 620, height: logoH = 0 } =
  await sharp(logoResized).metadata();

const logoPng = await sharp({
  create: { width: logoW, height: logoH, channels: 4, background: SAND_50 },
})
  .composite([{ input: logoResized, blend: "dest-in" }])
  .png()
  .toBuffer();

const background = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <rect width="${W}" height="${H}" fill="${FOREST_950}"/>
  <rect x="0" y="${H - 14}" width="${W}" height="14" fill="${LIME_400}"/>
  <text x="80" y="${H - 66}" font-family="Barlow, Helvetica, Arial, sans-serif"
        font-size="32" fill="${LIME_400}">
    Booni, Chitral &#183; Khyber Pakhtunkhwa, Pakistan
  </text>
</svg>`);

await sharp(background)
  .composite([{ input: logoPng, top: Math.round((H - logoH) / 2) - 40, left: 80 }])
  .png({ compressionLevel: 9 })
  .toFile(OUT);

const { size } = await fs.stat(OUT);
console.log(`public/og.png  ${W}x${H}  ${Math.round(size / 1024)}kB`);
