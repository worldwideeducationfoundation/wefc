// One-off: downloads every document and image asset from the old Sanity
// project into storage/export/sanity/. Reads SANITY_* from .env.local.
import fs from "node:fs";
import path from "node:path";

const OUT = path.resolve("storage/export/sanity");
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?(.*?)"?\s*$/);
  if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
}
const { SANITY_PROJECT_ID: P, SANITY_DATASET: D, SANITY_API_TOKEN: T } = process.env;
const api = `https://${P}.api.sanity.io/v2024-01-01/data/query/${D}`;

async function groq(q) {
  const r = await fetch(`${api}?query=${encodeURIComponent(q)}&perspective=published`, {
    headers: { Authorization: `Bearer ${T}` },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()).result;
}

fs.mkdirSync(path.join(OUT, "images"), { recursive: true });
const docs = await groq(`*[!(_id in path("drafts.**")) && !(_type match "system.*") && !(_type match "sanity.*")]`);
const assets = await groq(`*[_type == "sanity.imageAsset"]{_id, url, originalFilename, extension, metadata{dimensions}}`);
const byType = {};
for (const d of docs) (byType[d._type] ??= []).push(d);
for (const [t, list] of Object.entries(byType)) {
  fs.writeFileSync(path.join(OUT, `${t}.json`), JSON.stringify(list, null, 2));
  console.log(t, list.length);
}
fs.writeFileSync(path.join(OUT, "assets.json"), JSON.stringify(assets, null, 2));
let n = 0;
for (const a of assets) {
  const file = path.join(OUT, "images", `${a._id}.${a.extension}`);
  if (fs.existsSync(file)) continue;
  const r = await fetch(a.url);
  if (!r.ok) { console.warn("failed", a.url, r.status); continue; }
  fs.writeFileSync(file, Buffer.from(await r.arrayBuffer()));
  n++;
}
console.log("assets", assets.length, "downloaded", n);
