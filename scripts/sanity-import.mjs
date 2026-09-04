/**
 * One-time migration: static article pages -> Sanity documents.
 *
 * Reads every page under pages/updates, pages/stories and pages/projects,
 * converts the article markup to Portable Text, uploads the referenced images
 * as Sanity assets, and writes one `post` document per page (plus the author
 * and category documents they reference).
 *
 * Safe to re-run: every document gets a deterministic `_id` and is written with
 * createOrReplace, and uploaded assets are remembered in
 * scripts/.sanity-assets.json so images are not re-uploaded.
 *
 *   node scripts/sanity-import.mjs            # write to Sanity
 *   node scripts/sanity-import.mjs --dry-run  # parse and report, write nothing
 */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { ROOT, sanityClient, SANITY_PROJECT_ID, SANITY_DATASET } from './sanity-env.mjs';

const DRY_RUN = process.argv.includes('--dry-run');

const AUTHOR = {
  _id: 'author.wef-communications',
  _type: 'author',
  name: 'WEF Communications',
  slug: { _type: 'slug', current: 'wef-communications' },
  role: 'Communications Team',
  bio: "The communications team of the Worldwide Education Fund, reporting on WEF's programs across Chitral, Pakistan and Central Asia.",
};

const CATEGORIES = [
  ['early-childhood-education', 'Early Childhood Education', 'Bright Beginnings centers, pre-primary learning and the ECD research behind them.', 1],
  ['scholarships', 'Scholarships', 'Secondary, undergraduate and graduate scholarships funded through WEF.', 2],
  ['higher-education', 'Higher Education', 'University partnerships and degree programs across Pakistan and Central Asia.', 3],
  ['teacher-training', 'Teacher Training', 'Professional development for the educators running WEF-supported classrooms.', 4],
  ['learning-spaces', 'Learning Spaces & Technology', 'Classroom refurbishment, language labs and technology-enabled learning.', 5],
  ['inclusive-education', 'Inclusive Education', 'Supporting neurodivergent children and learners who are otherwise left out.', 6],
  ['philanthropy', 'Philanthropy & Giving', 'Endowments, major gifts and the donors sustaining the work.', 7],
  ['community-partnerships', 'Community & Partnerships', 'Implementing partners, advisory boards and the communities WEF works with.', 8],
];

/**
 * Per-post editorial metadata that is not recoverable from the static markup:
 * which categories a post belongs to, and — for posts whose hero shows a label
 * rather than a date ("Success Story", "Active Since 2026", "Undated") — the
 * sort date. Those dates are chosen to reproduce the order the cards already
 * appear in on each listing page.
 */
const POST_META = {
  'update/refresher-training-university-of-chitral': {
    // The static page shows no date at all; this one is an estimate placed
    // after the June 14 2026 update it sits above on the listing page.
    publishedAt: '2026-07-10T09:00:00Z',
    categories: ['teacher-training', 'early-childhood-education'],
  },
  'update/inspiring-learning-spaces-government-schools': { categories: ['learning-spaces'] },
  'update/advisory-board-expansion': { categories: ['community-partnerships', 'early-childhood-education'] },
  'update/reaching-isolated-children': { categories: ['early-childhood-education'] },
  'update/bright-beginnings-eclc-expand': { categories: ['early-childhood-education'] },
  'update/childrens-day-chitral': { categories: ['early-childhood-education', 'community-partnerships'] },
  'update/early-childhood-education-1-77-million': { categories: ['philanthropy', 'early-childhood-education'] },
  'update/herzing-family-1-27-million-gift': { categories: ['philanthropy'] },
  'update/auca-uca-scholarship-journey': { categories: ['scholarships', 'higher-education'] },
  // Same calendar day as the secondary-school update; the time breaks the tie
  // in the order the two cards already appear on the listing page.
  'update/helping-hands-ladies-group': {
    publishedAt: '2025-09-09T12:00:00Z',
    categories: ['community-partnerships', 'philanthropy'],
  },
  'update/secondary-school-scholarships': {
    publishedAt: '2025-09-09T09:00:00Z',
    categories: ['scholarships'],
  },
  'update/eclc-lower-chitral': { categories: ['early-childhood-education'] },
  'update/herzing-scholarships': {
    // Hero reads "Undated"; this date only places it last, as it already is.
    publishedAt: '2025-06-01T09:00:00Z',
    categories: ['scholarships', 'philanthropy'],
  },

  'story/from-silence-to-confidence': {
    publishedAt: '2026-06-01T09:00:00Z',
    categories: ['inclusive-education', 'early-childhood-education'],
  },
  'story/asads-journey-hunza-to-us': {
    publishedAt: '2026-05-01T09:00:00Z',
    categories: ['scholarships', 'higher-education'],
  },
  'story/mehrunissa-barkatali-mba-scholar': {
    publishedAt: '2026-04-01T09:00:00Z',
    categories: ['scholarships', 'higher-education'],
  },
  'story/saima-shaheen-mba-scholar': {
    publishedAt: '2026-03-01T09:00:00Z',
    categories: ['scholarships', 'higher-education'],
  },

  'project/bright-beginnings-eclc': {
    publishedAt: '2026-06-01T09:00:00Z',
    categories: ['early-childhood-education'],
  },
  'project/herzing-daya-research-hub': {
    publishedAt: '2026-05-01T09:00:00Z',
    categories: ['higher-education', 'early-childhood-education'],
  },
  'project/herzing-training-skills-development': {
    publishedAt: '2026-04-01T09:00:00Z',
    categories: ['teacher-training', 'higher-education'],
  },
  'project/secondary-school-scholarships': {
    publishedAt: '2026-03-01T09:00:00Z',
    categories: ['scholarships'],
  },
  'project/rising-stars-scholarship': {
    publishedAt: '2026-02-01T09:00:00Z',
    categories: ['scholarships', 'higher-education'],
  },
};

const SOURCES = [
  { postType: 'update', dir: 'pages/updates', listing: 'pages/project-updates.html' },
  { postType: 'story', dir: 'pages/stories', listing: 'pages/success-stories.html' },
  { postType: 'project', dir: 'pages/projects', listing: 'pages/active-projects.html' },
];

// ---------------------------------------------------------------------------
// Asset uploads
// ---------------------------------------------------------------------------

const ASSET_CACHE_FILE = path.join(ROOT, 'scripts', '.sanity-assets.json');

function readAssetCache() {
  if (!fs.existsSync(ASSET_CACHE_FILE)) return {};
  try {
    const cache = JSON.parse(fs.readFileSync(ASSET_CACHE_FILE, 'utf8'));
    // The cache is keyed by source path only, so it would silently hand back
    // asset ids from a different project if the target ever changes.
    if (cache.__project !== `${SANITY_PROJECT_ID}/${SANITY_DATASET}`) return {};
    return cache;
  } catch {
    return {};
  }
}

const assetCache = readAssetCache();

function saveAssetCache() {
  assetCache.__project = `${SANITY_PROJECT_ID}/${SANITY_DATASET}`;
  fs.writeFileSync(ASSET_CACHE_FILE, JSON.stringify(assetCache, null, 2) + '\n');
}

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif'];

/**
 * Turn `/content/uploads/wef/a%20b.jpg` into the file it points at in public/.
 *
 * A couple of the static pages name an image with the wrong extension — the
 * og:image on the Mehrunissa story asks for .jpg where only .jpeg and .webp
 * exist — so a miss falls back to the same basename under any image
 * extension rather than dropping the image.
 */
function localPathForSrc(src) {
  if (!src || /^https?:/i.test(src)) return null;
  const clean = decodeURIComponent(src.split('?')[0].split('#')[0]);
  const exact = path.join(ROOT, 'public', clean.replace(/^\//, ''));
  if (fs.existsSync(exact)) return exact;

  const dir = path.dirname(exact);
  const base = path.basename(exact, path.extname(exact));
  for (const ext of IMAGE_EXTENSIONS) {
    const candidate = path.join(dir, base + ext);
    if (fs.existsSync(candidate)) {
      console.warn(`  ~ ${clean} not found, using ${path.basename(candidate)} instead`);
      return candidate;
    }
  }
  return null;
}

async function uploadImage(client, src) {
  if (assetCache[src]) return assetCache[src];
  const file = localPathForSrc(src);
  if (!file) {
    console.warn(`  ! missing image on disk, skipping: ${src}`);
    return null;
  }
  if (DRY_RUN) return `image-DRYRUN-${path.basename(file)}`;

  // Sanity's asset endpoint returns the occasional 503 on a long run of
  // uploads. Each attempt needs a fresh read stream, since a failed one is
  // already partly consumed.
  let asset;
  for (let attempt = 1; ; attempt++) {
    try {
      asset = await client.assets.upload('image', fs.createReadStream(file), {
        filename: path.basename(file),
      });
      break;
    } catch (err) {
      if (attempt === 4) throw err;
      const wait = attempt * 2000;
      console.warn(`  ~ upload of ${path.basename(file)} failed (${err.message}); retrying in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  assetCache[src] = asset._id;
  saveAssetCache();
  console.log(`  + uploaded ${path.basename(file)} -> ${asset._id}`);
  return asset._id;
}

// ---------------------------------------------------------------------------
// HTML -> Portable Text
// ---------------------------------------------------------------------------

let keySeed = 0;
const nextKey = (prefix) => `${prefix}${(keySeed++).toString(36)}`;

const squash = (s) => (s || '').replace(/\s+/g, ' ').trim();

/**
 * Flatten an element's inline content into Portable Text spans, carrying
 * <strong>/<em> across as marks and <a> as a link markDef.
 */
function inlineChildren(el) {
  const children = [];
  const markDefs = [];

  const walk = (node, marks) => {
    for (const child of node.childNodes) {
      if (child.nodeType === 3) {
        // Collapse the newlines and indentation the source files are written
        // with, but keep a single space so "word\n  word" does not become
        // "wordword".
        const text = child.textContent.replace(/\s+/g, ' ');
        if (!text) continue;
        children.push({ _type: 'span', _key: nextKey('s'), text, marks: [...marks] });
        continue;
      }
      if (child.nodeType !== 1) continue;
      const tag = child.tagName.toLowerCase();
      if (tag === 'strong' || tag === 'b') walk(child, [...marks, 'strong']);
      else if (tag === 'em' || tag === 'i') walk(child, [...marks, 'em']);
      else if (tag === 'br') {
        children.push({ _type: 'span', _key: nextKey('s'), text: ' ', marks: [...marks] });
      } else if (tag === 'a') {
        const key = nextKey('l');
        markDefs.push({ _type: 'link', _key: key, href: child.getAttribute('href') || '' });
        walk(child, [...marks, key]);
      } else {
        walk(child, marks);
      }
    }
  };
  walk(el, []);

  // Trim the outer edges only; interior spacing between spans is meaningful.
  if (children.length) {
    children[0].text = children[0].text.replace(/^\s+/, '');
    children[children.length - 1].text = children[children.length - 1].text.replace(/\s+$/, '');
  }
  const kept = children.filter((c) => c.text !== '');
  return { children: kept, markDefs };
}

function textBlock(el, style, listItem) {
  const { children, markDefs } = inlineChildren(el);
  if (!children.length) return null;
  const block = { _type: 'block', _key: nextKey('b'), style, markDefs, children };
  if (listItem) {
    block.listItem = listItem;
    block.level = 1;
  }
  return block;
}

async function bodyToPortableText(client, container) {
  const blocks = [];

  for (const el of container.children) {
    const tag = el.tagName.toLowerCase();

    if (tag === 'p') {
      const b = textBlock(el, 'normal');
      if (b) blocks.push(b);
    } else if (tag === 'h2' || tag === 'h3') {
      const b = textBlock(el, tag);
      if (b) blocks.push(b);
    } else if (tag === 'ul' || tag === 'ol') {
      const listItem = tag === 'ul' ? 'bullet' : 'number';
      for (const li of el.querySelectorAll(':scope > li')) {
        const b = textBlock(li, 'normal', listItem);
        if (b) blocks.push(b);
      }
    } else if (tag === 'blockquote') {
      for (const p of el.querySelectorAll(':scope > p')) {
        const b = textBlock(p, 'blockquote');
        if (b) blocks.push(b);
      }
      if (!el.querySelector(':scope > p')) {
        const b = textBlock(el, 'blockquote');
        if (b) blocks.push(b);
      }
    } else if (tag === 'figure') {
      const img = el.querySelector('img');
      if (!img) continue;
      const assetId = await uploadImage(client, img.getAttribute('src'));
      if (!assetId) continue;
      blocks.push({
        _type: 'image',
        _key: nextKey('i'),
        asset: { _type: 'reference', _ref: assetId },
        alt: squash(img.getAttribute('alt')) || undefined,
      });
    } else if (tag === 'div' && el.classList.contains('proj-stats')) {
      const stats = [...el.querySelectorAll(':scope > div')].map((d) => ({
        _type: 'stat',
        _key: nextKey('t'),
        value: squash(d.querySelector('.n')?.textContent),
        label: squash(d.querySelector('.l')?.textContent),
      }));
      if (stats.length) {
        blocks.push({ _type: 'statGroup', _key: nextKey('g'), stats });
      }
    } else {
      console.warn(`  ? unhandled body element <${tag} class="${el.className}">`);
    }
  }

  return blocks;
}

// ---------------------------------------------------------------------------
// Page parsing
// ---------------------------------------------------------------------------

/**
 * Card headings and summaries live on the listing pages, not on the article
 * pages, keyed by the link each card points at. A few cards carry a shortened
 * heading rather than repeating the full article title.
 */
function readListingCards(listingFile) {
  const dom = new JSDOM(fs.readFileSync(path.join(ROOT, listingFile), 'utf8'));
  const bySlug = new Map();
  for (const card of dom.window.document.querySelectorAll('a.ap-card')) {
    const href = card.getAttribute('href') || '';
    const slug = href.replace(/\/$/, '').split('/').pop();
    bySlug.set(slug, {
      title: squash(card.querySelector('.ap-card-body h3')?.textContent),
      excerpt: squash(card.querySelector('.ap-card-body p')?.textContent),
    });
  }
  return bySlug;
}

const MONTHS = 'january february march april may june july august september october november december'.split(' ');

/** "February 12, 2026" -> "2026-02-12T09:00:00Z". Returns null for labels like "Ongoing". */
function parseDateLabel(label) {
  const m = /^([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})$/.exec(squash(label));
  if (!m) return null;
  const month = MONTHS.indexOf(m[1].toLowerCase());
  if (month === -1) return null;
  return `${m[3]}-${String(month + 1).padStart(2, '0')}-${String(m[2]).padStart(2, '0')}T09:00:00Z`;
}

async function parsePage(client, file, postType, cards) {
  const slug = path.basename(file, '.html');
  const key = `${postType}/${slug}`;
  const meta = POST_META[key] || {};
  const source = fs.readFileSync(file, 'utf8');

  // Once the migration has run, these pages are rendered *from* Sanity and
  // their images point at the Sanity CDN. Re-importing them would round-trip
  // the dataset through its own output — so refuse, and point at git for the
  // original markup.
  if (source.includes('GENERATED FILE - DO NOT EDIT BY HAND')) {
    throw new Error(
      `${path.relative(ROOT, file)} is generated from Sanity, not source content. ` +
        'The migration has already run. To re-import from the original static pages, ' +
        'check them out first (e.g. `git checkout <commit-before-migration> -- pages/`).'
    );
  }

  const dom = new JSDOM(source);
  const doc = dom.window.document;

  const title = squash(doc.querySelector('.proj-hero h1')?.textContent);
  const seoTitle = squash(doc.querySelector('title')?.textContent);
  const seoDescription = squash(doc.querySelector('meta[name="description"]')?.getAttribute('content'));
  const ogImage = doc.querySelector('meta[property="og:image"]')?.getAttribute('content');

  // The hero shows a pin span and (usually) a date span, in that order.
  const metaSpans = [...doc.querySelectorAll('.proj-meta span')].map((s) => {
    const clone = s.cloneNode(true);
    clone.querySelectorAll('svg').forEach((svg) => svg.remove());
    return squash(clone.textContent);
  });
  const location = metaSpans[0] || '';
  const rawDate = metaSpans[1] || '';

  const parsedDate = parseDateLabel(rawDate);
  const publishedAt = meta.publishedAt || parsedDate;
  if (!publishedAt) {
    throw new Error(`${key}: no publishedAt — add one to POST_META in scripts/sanity-import.mjs`);
  }
  // A hero that already shows a real date is reproduced from publishedAt, so
  // only non-date labels ("Success Story", "Ongoing", "Undated") are stored.
  const dateLabel = parsedDate ? '' : rawDate;

  const cta = doc.querySelector('.proj-cta');
  const ctaLinks = cta ? [...cta.querySelectorAll('.proj-cta-actions a')] : [];

  const mainImageAsset = await uploadImage(client, ogImage);
  if (!mainImageAsset) throw new Error(`${key}: could not upload main image ${ogImage}`);

  const body = await bodyToPortableText(client, doc.querySelector('.proj-article .cx'));
  if (!body.length) throw new Error(`${key}: empty body`);

  const card = cards.get(slug);
  if (!card) {
    console.warn(`  ! ${key}: no card on the listing page, using the meta description as the summary`);
  }
  const excerpt = card?.excerpt || seoDescription;
  // Only stored when the card deliberately says something shorter than the H1.
  const cardTitle = card?.title && card.title !== title ? card.title : undefined;

  const categories = meta.categories || [];
  if (!categories.length) throw new Error(`${key}: no categories in POST_META`);

  return {
    _id: `post.${postType}.${slug}`,
    _type: 'post',
    postType,
    title,
    slug: { _type: 'slug', current: slug },
    cardTitle,
    excerpt,
    mainImage: {
      _type: 'image',
      asset: { _type: 'reference', _ref: mainImageAsset },
      alt: title,
    },
    body,
    author: { _type: 'reference', _ref: AUTHOR._id },
    categories: categories.map((c) => ({
      _type: 'reference',
      _key: `cat-${c}`,
      _ref: `category.${c}`,
    })),
    publishedAt,
    dateLabel,
    location,
    featured: false,
    cta: cta
      ? {
          _type: 'callToAction',
          heading: squash(cta.querySelector('h2')?.textContent),
          text: squash(cta.querySelector('p')?.textContent),
          primaryLabel: squash(ctaLinks[0]?.textContent),
          primaryUrl: ctaLinks[0]?.getAttribute('href') || '',
          secondaryLabel: squash(ctaLinks[1]?.textContent) || undefined,
          secondaryUrl: ctaLinks[1]?.getAttribute('href') || undefined,
        }
      : undefined,
    seoTitle,
    seoDescription,
  };
}

// ---------------------------------------------------------------------------

async function main() {
  const client = sanityClient({ write: !DRY_RUN });
  console.log(
    `${DRY_RUN ? '[dry run] ' : ''}Importing into ${SANITY_PROJECT_ID}/${SANITY_DATASET}\n`
  );

  const documents = [
    AUTHOR,
    ...CATEGORIES.map(([slug, title, description, order]) => ({
      _id: `category.${slug}`,
      _type: 'category',
      title,
      slug: { _type: 'slug', current: slug },
      description,
      order,
    })),
  ];

  for (const source of SOURCES) {
    const cards = readListingCards(source.listing);
    const dir = path.join(ROOT, source.dir);
    const files = fs.readdirSync(dir).filter((f) => f.endsWith('.html')).sort();
    console.log(`${source.dir} (${files.length} pages)`);
    for (const f of files) {
      console.log(`  · ${f}`);
      documents.push(await parsePage(client, path.join(dir, f), source.postType, cards));
    }
  }

  const posts = documents.filter((d) => d._type === 'post');
  console.log(
    `\nParsed ${posts.length} posts, ${CATEGORIES.length} categories, 1 author.`
  );

  if (DRY_RUN) {
    const sample = posts[0];
    console.log(`\nSample (${sample._id}):`);
    console.log(JSON.stringify({ ...sample, body: `${sample.body.length} blocks` }, null, 2));
    return;
  }

  // One transaction so a mid-import failure cannot leave posts pointing at
  // categories that were never created.
  const tx = client.transaction();
  for (const doc of documents) tx.createOrReplace(doc);
  await tx.commit();
  console.log(`\nWrote ${documents.length} documents to Sanity.`);
}

main().catch((err) => {
  console.error(`\nImport failed: ${err.message}`);
  process.exitCode = 1;
});
