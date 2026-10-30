// One-off: pulls the hand-written content of the old static site (legacy/)
// into storage/export/static.json. Run: node scripts/legacy/export-static.mjs <path-to-cheerio>
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
const require = createRequire(process.argv[2] + "/");
const cheerio = require("cheerio");

const L = path.resolve("legacy");
const load = (f) => cheerio.load(fs.readFileSync(path.join(L, f), "utf8"));
const t = (el) => el.text().replace(/\s+/g, " ").trim();
const img = (src) => (src ? decodeURIComponent(src.replace(/^.*\/content\/uploads\/wef\//, "")).replace(/['")]+$/, "") : null);
const lis = ($, el) => el.find("li").map((_, li) => t($(li))).get();

const out = {};
const home = load("index.html");

out.hero_slides = home(".hero-slide").map((_, f) => {
  const d = home(f).find(".hero-slide-img");
  return { image: img(d.attr("style")?.match(/url\('?([^')]+)/)?.[1]), alt: d.attr("aria-label"), caption: t(home(f).find("figcaption")) };
}).get();

out.programs = [];
home(".pstrip-item").each((_, f) => {
  const e = home(f);
  out.programs.push({ placement: "strip", title: t(e.find("h3")), lead: t(e.find("figcaption p")), image: img(e.find("img").attr("src")), alt: e.find("img").attr("alt") });
});
home("#programs .program").each((_, f) => {
  const e = home(f);
  out.programs.push({
    placement: "home", title: t(e.find("h3")), badge: t(e.find(".program-badge")) || null, lead: t(e.find(".lead")),
    image: img(e.find("img").attr("src")), alt: e.find("img").attr("alt"),
    points: lis(home, e.find(".program-points")),
    stats: e.find(".program-stats > div").map((_, s) => `${t(home(s).find(".n"))} | ${t(home(s).find(".l"))}`).get(),
  });
});
const mission = load("pages/mission.html");
mission(".prow").each((_, f) => {
  const e = mission(f);
  const col = (h) => e.find(".pcol").filter((_, c) => t(mission(c).find("h4")) === h).first();
  out.programs.push({
    placement: "mission", title: t(e.find("h3")), badge: t(e.find(".prow-year")) || null, category: t(e.find(".prow-cat")),
    accent: e.attr("style")?.match(/--accent:\s*([^;"]+)/)?.[1] ?? null, lead: t(e.find(".prow-model")),
    image: img(e.find("img").attr("src")), alt: e.find("img").attr("alt"),
    where: lis(mission, col("Where")), who: lis(mission, col("Who")), impact: lis(mission, col("Impact")),
    notes: lis(mission, e.find(".pnotes")),
  });
});

out.stats = [
  ...home(".impact-item").map((_, f) => {
    const e = home(f);
    const n = e.find("[data-to]").attr("data-to");
    return { placement: "home", value: (e.find(".u").text() ? "+" : "") + Number(n).toLocaleString("en-US"), label: t(e.find(".impact-cap")), note: t(e.find(".impact-sub")) };
  }).get(),
  ...mission(".glance-item").map((_, f) => ({ placement: "mission", value: t(mission(f).find(".glance-num")).replace(/\s+/g, ""), label: t(mission(f).find(".glance-lbl")) })).get(),
];

out.testimonials = home(".stories .story, .stories [class*=story-card], .stories article").length ? [] : [];
home(".story-text").each((_, p) => {
  const card = home(p).parent();
  out.testimonials.push({ quote: t(home(p)), name: t(card.find(".story-name")), role: t(card.find(".story-role")), location: t(card.find(".story-loc")), image: img(card.find("img").attr("src")) });
});

out.values = home(".values h3").map((_, h) => ({ title: t(home(h)), text: t(home(h).next("p")) })).get();
out.vmb = home(".vmb h2").map((_, h) => ({ title: t(home(h)), text: t(home(h).parent().find("p").last()) })).get();

const donate = load("donate/index.html");
out.faqs = donate(".give-faq dt").map((_, d) => ({ question: t(donate(d)), answer_html: donate(d).next("dd").html().trim() })).get();
out.give_where = donate(".give-where h3").map((_, h) => ({ title: t(donate(h)), text: t(donate(h).next("p")) })).get();

const gallery = load("pages/gallery.html");
out.gallery_categories = gallery(".gl-chip").map((_, b) => gallery(b).attr("data-filter")).get().filter(Boolean);
out.gallery = gallery(".gl-item").map((_, f) => {
  const e = gallery(f);
  return { category: e.attr("data-cat"), title: t(e.find(".gl-title")), image: img(e.find("img").attr("src")), alt: e.find("img").attr("alt") };
}).get();

const team = fs.readFileSync(path.join(L, "team/index.html"), "utf8");
const bios = JSON.parse(team.match(/__TEAM_BIOS = (\{.*?\});<\/script>/)[1]);
out.team_groups = ["Co-Founders"];
out.team = Object.values(bios).map((b) => ({ group: "Co-Founders", name: b.name, role: b.role, image: img(b.photo), bio: b.bio.join("\n\n") }));

const centersJs = fs.readFileSync(path.join(L, "public/content/maps/centers-data.js"), "utf8");
out.learning_centers = JSON.parse(centersJs.slice(centersJs.indexOf("{"), centersJs.lastIndexOf("}") + 1)).centers;

// Page copy: every heading/paragraph of each hand-written page, in order, for the blocks.
const copy = (f, sel = "main section") => {
  const $ = load(f);
  return $(sel).map((_, s) => ({
    section: ($(s).attr("class") || "").split(" ").slice(-1)[0] + ($(s).attr("id") ? "#" + $(s).attr("id") : ""),
    text: $(s).find("h1,h2,p.eyebrow,p,a.btn,a[class*=btn],dt").not(".pstrip-cap p, .program p, .prow p, .gl-item *, .story-text").map((_, e) => `${e.tagName}: ${t($(e))}`).get().slice(0, 40),
  })).get();
};
out.page_copy = Object.fromEntries(
  ["index.html", "pages/mission.html", "pages/centers.html", "pages/gallery.html", "pages/contact.html", "team/index.html", "donate/index.html", "pages/active-projects.html", "pages/project-updates.html", "pages/success-stories.html", "404.html"].map((f) => [f, copy(f)]),
);

fs.mkdirSync("storage/export", { recursive: true });
fs.writeFileSync("storage/export/static.json", JSON.stringify(out, null, 2));
for (const [k, v] of Object.entries(out)) console.log(k, Array.isArray(v) ? v.length : Object.keys(v).length);
