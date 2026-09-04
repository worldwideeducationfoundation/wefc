/**
 * Checks whether the deployed site is actually serving the Sanity-backed
 * build, rather than an older deploy.
 *
 * The generated pages are static HTML by design — content is pulled from
 * Sanity at build time — so "does it look static?" cannot answer the question.
 * These three fingerprints can, and none of them exist in a pre-migration
 * build:
 *
 *   1. <meta name="content-source" content="sanity:...">
 *   2. images served from cdn.sanity.io rather than /content/uploads/
 *   3. the category filter chips, which only the sync script writes
 *
 *   npm run verify:live                    # check https://wefcanada.org
 *   npm run verify:live -- http://localhost:4173
 */
import { SANITY_PROJECT_ID, SANITY_DATASET } from './sanity-env.mjs';

const base = (process.argv[2] || 'https://wefcanada.org').replace(/\/$/, '');

const PAGES = [
  '/pages/project-updates/',
  '/pages/success-stories/',
  '/pages/active-projects/',
  '/pages/updates/childrens-day-chitral/',
  '/pages/topics/scholarships/',
];

const EXPECTED_SOURCE = `sanity:${SANITY_PROJECT_ID}/${SANITY_DATASET}`;

async function check(pathname) {
  const url = base + pathname;
  let res;
  try {
    res = await fetch(url, { redirect: 'follow' });
  } catch (err) {
    return { url, ok: false, notes: [`request failed: ${err.message}`] };
  }
  if (!res.ok) return { url, ok: false, notes: [`HTTP ${res.status}`] };

  const html = await res.text();
  const notes = [];

  const hasStamp = html.includes(`content="${EXPECTED_SOURCE}"`);
  const sanityImages = (html.match(/cdn\.sanity\.io/g) || []).length;
  const legacyImages = (html.match(/\/content\/uploads\/wef\/(?!favico|WEFC)/g) || []).length;
  const chips = (html.match(/class="ap-filter"/g) || []).length;

  if (!hasStamp) notes.push('no content-source meta (old build)');
  if (!sanityImages) notes.push('no cdn.sanity.io images');
  if (legacyImages) notes.push(`${legacyImages} legacy /content/uploads image(s)`);
  if (pathname.includes('topics') || pathname.endsWith('-updates/')) {
    if (!chips) notes.push('no category filter chips');
  }

  return {
    url,
    ok: hasStamp && sanityImages > 0 && legacyImages === 0,
    notes: notes.length ? notes : [`${sanityImages} Sanity images, ${chips} category chips`],
  };
}

const results = [];
for (const p of PAGES) results.push(await check(p));

console.log(`Checking ${base} against ${EXPECTED_SOURCE}\n`);
for (const r of results) {
  console.log(`  ${r.ok ? 'PASS' : 'FAIL'}  ${r.url}`);
  for (const n of r.notes) console.log(`        ${n}`);
}

const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.log(
    `\n${failed.length} of ${results.length} pages are NOT serving the Sanity build.` +
      '\nThe deploy is stale or its build failed — redeploy and check the build log' +
      '\nfor "posts and categories synced".'
  );
  process.exitCode = 1;
} else {
  console.log(`\nAll ${results.length} pages are serving content from Sanity.`);
}
