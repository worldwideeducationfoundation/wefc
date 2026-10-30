// One-off helper used while porting the old static pages: prints the JSX for
// the element matching a selector in a legacy HTML file.
//   node scripts/legacy/html-to-jsx.mjs <cheerio-dir> legacy/index.html "main"
import fs from "node:fs";
import { createRequire } from "node:module";
const [cheerioDir, file, selector] = process.argv.slice(2);
const cheerio = createRequire(cheerioDir + "/")("cheerio");
const $ = cheerio.load(fs.readFileSync(file, "utf8"));

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const RENAME = {
  class: "className", for: "htmlFor", tabindex: "tabIndex", readonly: "readOnly", maxlength: "maxLength",
  autocomplete: "autoComplete", srcset: "srcSet", fetchpriority: "fetchPriority", crossorigin: "crossOrigin",
  viewbox: "viewBox", frameborder: "frameBorder", allowfullscreen: "allowFullScreen", novalidate: "noValidate",
  allowtransparency: "allowTransparency", "accept-charset": "acceptCharset", rowspan: "rowSpan", colspan: "colSpan",
  enterkeyhint: "enterKeyHint", inputmode: "inputMode", spellcheck: "spellCheck", datetime: "dateTime",
};
const camel = (s) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const attrName = (n) => RENAME[n] ?? (n.startsWith("data-") || n.startsWith("aria-") ? n : n.includes("-") || n.includes(":") ? camel(n.replace(":", "-")) : n);
const esc = (s) => s.replace(/[{}<>]/g, (c) => `{"${c}"}`);
function style(v) {
  const parts = v.split(";").map((p) => p.trim()).filter(Boolean).map((p) => {
    const i = p.indexOf(":");
    const k = p.slice(0, i).trim();
    const val = p.slice(i + 1).trim();
    return `${k.startsWith("--") ? JSON.stringify(k) : camel(k)}: ${JSON.stringify(val)}`;
  });
  return `{{ ${parts.join(", ")} }}`;
}
function attrs(el) {
  return Object.entries(el.attribs ?? {}).map(([k, v]) => {
    const n = attrName(k);
    if (k === "style") return ` style=${style(v)}`;
    if (v === "" && !["alt", "value", "content"].includes(k)) return ` ${n}`;
    return ` ${n}=${JSON.stringify(v)}`;
  }).join("");
}
function render(node, depth) {
  const pad = "  ".repeat(depth);
  if (node.type === "text") {
    const t = node.data.replace(/\s+/g, " ");
    return t.trim() ? pad + esc(t.trim()) : "";
  }
  if (node.type === "comment") return `${pad}{/* ${node.data.trim().replace(/\*\//g, "")} */}`;
  if (node.type !== "tag" && node.type !== "script" && node.type !== "style") return "";
  if (node.name === "script" || node.name === "style") return `${pad}{/* <${node.name}> omitted */}`;
  const open = `<${node.name}${attrs(node)}`;
  if (VOID.has(node.name) || node.children.length === 0) return `${pad}${open} />`;
  const kids = node.children.map((c) => render(c, depth + 1)).filter(Boolean);
  if (kids.length === 1 && !kids[0].includes("\n") && kids[0].trim().length < 80) return `${pad}${open}>${kids[0].trim()}</${node.name}>`;
  return `${pad}${open}>\n${kids.join("\n")}\n${pad}</${node.name}>`;
}
$(selector).each((_, el) => console.log(render(el, 0)));
