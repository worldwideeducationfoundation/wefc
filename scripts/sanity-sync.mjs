/**
 * Renders the site's article pages from Sanity.
 *
 * Fetches every `post` document and writes:
 *   - pages/updates/<slug>.html, pages/stories/<slug>.html,
 *     pages/projects/<slug>.html — one article page per post, from
 *     build/templates/article.html
 *   - the card grid inside pages/project-updates.html,
 *     pages/success-stories.html and pages/active-projects.html
 *
 * Those files are generated artifacts: edit the post in Sanity Studio and
 * re-run this, do not edit the HTML. It runs automatically before `npm run
 * build`, and can be run on its own with `npm run sanity:sync`.
 *
 *   node scripts/sanity-sync.mjs           # write the pages
 *   node scripts/sanity-sync.mjs --check   # fail if the pages are stale
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  sanityClient,
  SANITY_PROJECT_ID,
  SANITY_DATASET,
  SANITY_API_TOKEN,
} from './sanity-env.mjs';

const CHECK_ONLY = process.argv.includes('--check');

/** Everything that differs between the three kinds of article page. */
const POST_TYPES = {
  update: {
    dir: 'pages/updates',
    listing: 'pages/project-updates.html',
    listingHref: '/pages/project-updates',
    backLabel: 'Project Updates',
    eyebrow: 'Project Update',
    h1MaxWidth: '24ch',
    dateIcon: 'calendar',
  },
  story: {
    dir: 'pages/stories',
    listing: 'pages/success-stories.html',
    listingHref: '/pages/success-stories',
    backLabel: 'Success Stories',
    eyebrow: 'Success Story',
    h1MaxWidth: '24ch',
    dateIcon: 'clock',
  },
  project: {
    dir: 'pages/projects',
    listing: 'pages/active-projects.html',
    listingHref: '/pages/active-projects',
    backLabel: 'Active Projects',
    eyebrow: 'Active Project',
    h1MaxWidth: '20ch',
    dateIcon: 'clock',
  },
};

const ICONS = {
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" /></svg>',
  calendar:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>',
  clock:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>',
  arrow:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
};

const GRID_START = '<!-- sanity:cards:start -->';
const GRID_END = '<!-- sanity:cards:end -->';
const FILTERS_START = '<!-- sanity:filters:start -->';
const FILTERS_END = '<!-- sanity:filters:end -->';

const SITE_NAME = 'Worldwide Education Fund';

/** Where a category's own page lives. The slug is the Sanity category slug. */
const TOPIC_DIR = 'pages/topics';
const topicHref = (slug) => `/${TOPIC_DIR}/${slug}`;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const escapeHtml = (s = '') =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** For values that land inside a double-quoted attribute. */
const escapeAttr = (s = '') => escapeHtml(s).replace(/"/g, '&quot;');

const formatDate = (iso) =>
  new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });

/**
 * Sanity serves derivatives off the asset URL, so the width is requested here
 * rather than shipping the full-size original to every visitor.
 */
function imageUrl(url, width) {
  if (!url) return '';
  return `${url}?auto=format&fit=max&w=${width}`;
}

// ---------------------------------------------------------------------------
// Portable Text -> the markup the article stylesheet expects
// ---------------------------------------------------------------------------

function renderSpans(block) {
  const markDefs = new Map((block.markDefs || []).map((d) => [d._key, d]));

  return (block.children || [])
    .map((span) => {
      let html = escapeHtml(span.text);
      // Innermost first, so <a><strong>text</strong></a> nests the way the
      // marks array is ordered.
      for (const mark of [...(span.marks || [])].reverse()) {
        if (mark === 'strong') html = `<strong>${html}</strong>`;
        else if (mark === 'em') html = `<em>${html}</em>`;
        else if (markDefs.has(mark)) {
          const def = markDefs.get(mark);
          if (def._type === 'link' && def.href) {
            const external = /^https?:/i.test(def.href);
            const attrs = external ? ' rel="noopener" target="_blank"' : '';
            html = `<a href="${escapeAttr(def.href)}"${attrs}>${html}</a>`;
          }
        }
      }
      return html;
    })
    .join('');
}

function renderBody(body = []) {
  const out = [];
  let listBuffer = null;

  const flushList = () => {
    if (!listBuffer) return;
    out.push(`<ul>\n${listBuffer.map((li) => `  <li>${li}</li>`).join('\n')}\n</ul>`);
    listBuffer = null;
  };

  for (const block of body) {
    if (block._type === 'block' && block.listItem) {
      (listBuffer ??= []).push(renderSpans(block));
      continue;
    }
    flushList();

    if (block._type === 'block') {
      const html = renderSpans(block);
      if (!html) continue;
      if (block.style === 'blockquote') out.push(`<blockquote><p>${html}</p></blockquote>`);
      else if (block.style === 'h2' || block.style === 'h3') {
        out.push(`<${block.style}>${html}</${block.style}>`);
      } else out.push(`<p>${html}</p>`);
    } else if (block._type === 'image') {
      if (!block.url) continue;
      out.push(
        `<figure>\n  <img src="${escapeAttr(imageUrl(block.url, 1200))}" alt="${escapeAttr(
          block.alt || ''
        )}" loading="lazy" />\n</figure>`
      );
    } else if (block._type === 'statGroup') {
      const stats = (block.stats || [])
        .map(
          (s) =>
            `  <div><span class="n">${escapeHtml(s.value)}</span><span class="l">${escapeHtml(
              s.label
            )}</span></div>`
        )
        .join('\n');
      out.push(`<div class="proj-stats">\n${stats}\n</div>`);
    }
  }
  flushList();

  return indent(out.join('\n\n'), 8);
}

const indent = (text, spaces) =>
  text
    .split('\n')
    .map((line) => (line ? ' '.repeat(spaces) + line : line))
    .join('\n');

// ---------------------------------------------------------------------------
// Page rendering
// ---------------------------------------------------------------------------

function renderMeta(post, config) {
  const spans = [];
  if (post.location) {
    spans.push(`<span>${ICONS.pin}${escapeHtml(post.location)}</span>`);
  }
  // A stored dateLabel wins, because it exists precisely for the posts whose
  // hero shows something other than a date ("Ongoing", "Success Story").
  const dateText = post.dateLabel || (post.publishedAt ? formatDate(post.publishedAt) : '');
  if (dateText) {
    spans.push(`<span>${ICONS[config.dateIcon]}${escapeHtml(dateText)}</span>`);
  }
  return indent(spans.join('\n'), 10);
}

function renderCta(cta, config) {
  if (!cta?.heading) return '';

  const button = (label, url, className) => {
    if (!label || !url) return '';
    const external = /^https?:/i.test(url);
    const attrs = external ? ' rel="noopener" target="_blank"' : '';
    return `          <a class="${className}" href="${escapeAttr(url)}"${attrs}>${escapeHtml(
      label
    )}</a>`;
  };

  const actions = [
    button(cta.primaryLabel, cta.primaryUrl, 'proj-btn-solid'),
    button(cta.secondaryLabel, cta.secondaryUrl || config.listingHref, 'proj-btn-line'),
  ]
    .filter(Boolean)
    .join('\n');

  return `    <section class="proj-cta">
      <div class="proj-cta-inner">
        <div>
          <h2>${escapeHtml(cta.heading)}</h2>
          <p>${escapeHtml(cta.text)}</p>
        </div>
        <div class="proj-cta-actions">
${actions}
        </div>
      </div>
    </section>
`;
}

function renderArticle(template, post) {
  const config = POST_TYPES[post.postType];
  const seoTitle = post.seoTitle || `${post.title} — ${SITE_NAME}`;
  const seoDescription = post.seoDescription || post.excerpt || '';

  return template
    .replaceAll('{{SEO_TITLE}}', escapeAttr(seoTitle))
    .replaceAll('{{SEO_DESCRIPTION}}', escapeAttr(seoDescription))
    .replaceAll('{{OG_IMAGE}}', escapeAttr(imageUrl(post.mainImageUrl, 1200)))
    .replaceAll('{{H1_MAXWIDTH}}', config.h1MaxWidth)
    .replaceAll('{{BACK_HREF}}', config.listingHref)
    .replaceAll('{{BACK_LABEL}}', escapeHtml(config.backLabel))
    .replaceAll('{{EYEBROW}}', escapeHtml(config.eyebrow))
    .replaceAll('{{TITLE}}', escapeHtml(post.title))
    .replaceAll('{{META}}', renderMeta(post, config))
    .replaceAll('{{BODY}}', renderBody(post.body))
    .replaceAll('{{CTA}}', renderCta(post.cta, config));
}

function renderCard(post) {
  const config = POST_TYPES[post.postType];
  const src = escapeAttr(imageUrl(post.mainImageUrl, 800));
  const alt = escapeAttr(post.mainImageAlt || '');
  // The filter script reads these slugs; they are the Sanity category slugs,
  // so a category renamed in the Studio changes the chip label without
  // breaking the link between chip and card.
  const cats = escapeAttr((post.categories || []).map((c) => c.slug).join(' '));
  return `          <a class="ap-card" href="/${config.dir}/${post.slug}" data-categories="${cats}">
            <div class="ap-card-media">
              <img src="${src}" alt="${alt}" loading="lazy" />
            </div>
            <div class="ap-card-body">
              <h3>${escapeHtml(post.cardTitle || post.title)}</h3>
              <p>${escapeHtml(post.excerpt)}</p>
              <span class="ap-card-link">Read more
                ${ICONS.arrow}
              </span>
            </div>
          </a>`;
}

/** Replace the text between two marker comments, keeping the markers. */
function replaceBetween(source, startMarker, endMarker, body, file) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker);
  if (start === -1 || end === -1) {
    throw new Error(
      `${path.relative(ROOT, file)} is missing its ${startMarker} / ${endMarker} markers.`
    );
  }
  return source.slice(0, start + startMarker.length) + body + '          ' + source.slice(end);
}

/**
 * The chips above a listing grid: one per category that actually has a post on
 * that page, plus an "All" chip. Each chip is a real link to the category's own
 * page, so it works with JavaScript disabled and is crawlable; the filter
 * script intercepts the click and filters in place instead.
 */
function renderFilters(categories, posts) {
  const counts = new Map();
  for (const post of posts) {
    for (const cat of post.categories || []) {
      counts.set(cat.slug, (counts.get(cat.slug) || 0) + 1);
    }
  }

  const chips = [
    `          <a class="ap-filter" data-category="" href="?" aria-pressed="true">All<span class="n">${posts.length}</span></a>`,
  ];
  for (const cat of categories) {
    const n = counts.get(cat.slug);
    if (!n) continue; // no post on this page carries the category
    chips.push(
      `          <a class="ap-filter" data-category="${escapeAttr(cat.slug)}" href="${topicHref(
        cat.slug
      )}" aria-pressed="false">${escapeHtml(cat.title)}<span class="n">${n}</span></a>`
    );
  }
  return chips.join('\n');
}

/**
 * Rewrites the generated regions of a listing page — the filter chips and the
 * card grid — leaving the rest of that page (its hero copy, its own CTA) under
 * human control.
 */
function renderListing(file, posts, categories) {
  let source = fs.readFileSync(file, 'utf8');
  source = replaceBetween(source, GRID_START, GRID_END, '\n' + posts.map(renderCard).join('\n') + '\n', file);
  source = replaceBetween(
    source,
    FILTERS_START,
    FILTERS_END,
    '\n' + renderFilters(categories, posts) + '\n',
    file
  );
  return source;
}

/** A category's own page: everything tagged with it, across all three types. */
function renderTopic(template, category, categories, posts) {
  const mine = posts.filter((p) => (p.categories || []).some((c) => c.slug === category.slug));
  const links = categories
    .map((cat) => {
      const current = cat.slug === category.slug;
      return `          <a class="ap-filter" href="${topicHref(cat.slug)}"${
        current ? ' aria-current="page"' : ''
      }>${escapeHtml(cat.title)}</a>`;
    })
    .join('\n');

  const description =
    category.description || `Everything from WEF's work tagged ${category.title}.`;

  return template
    .replaceAll('{{SEO_TITLE}}', escapeAttr(`${category.title} — ${SITE_NAME}`))
    .replaceAll('{{SEO_DESCRIPTION}}', escapeAttr(description))
    .replaceAll('{{TITLE}}', escapeHtml(category.title))
    .replaceAll('{{DESCRIPTION}}', escapeHtml(description))
    .replaceAll(
      '{{COUNT_LABEL}}',
      `${mine.length} ${mine.length === 1 ? 'article' : 'articles'}`
    )
    .replaceAll('{{TOPIC_LINKS}}', links)
    .replaceAll('{{CARDS}}', mine.map(renderCard).join('\n'));
}

// ---------------------------------------------------------------------------

const QUERY = `*[_type == "post" && defined(slug.current)] | order(publishedAt desc) {
  "slug": slug.current,
  postType,
  title,
  cardTitle,
  excerpt,
  location,
  dateLabel,
  publishedAt,
  seoTitle,
  seoDescription,
  cta,
  "mainImageUrl": mainImage.asset->url,
  "mainImageAlt": mainImage.alt,
  "categories": categories[]->{ title, "slug": slug.current },
  "body": body[]{
    ...,
    _type == "image" => { "url": asset->url, alt }
  }
}`;

/** Every category, in the display order set in the Studio. */
const CATEGORY_QUERY = `*[_type == "category" && defined(slug.current)]
  | order(coalesce(order, 99) asc, title asc) {
    title,
    "slug": slug.current,
    description
  }`;

/** Has a previous sync left article pages in the repo to fall back on? */
function hasGeneratedPages() {
  return Object.values(POST_TYPES).every((config) => {
    const dir = path.join(ROOT, config.dir);
    return fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.endsWith('.html'));
  });
}

async function main() {
  const client = sanityClient();
  console.log(
    `${CHECK_ONLY ? '[check] ' : ''}Reading posts from ${SANITY_PROJECT_ID}/${SANITY_DATASET}`
  );

  let posts;
  let categories;
  try {
    [posts, categories] = await Promise.all([
      client.fetch(QUERY),
      client.fetch(CATEGORY_QUERY),
    ]);
  } catch (err) {
    // The generated pages are committed, so a deploy that cannot reach Sanity
    // should still ship the last known-good content rather than failing. A
    // `--check` run still fails, so CI catches a genuinely broken setup.
    if (!CHECK_ONLY && hasGeneratedPages()) {
      console.warn(
        `\n  ! Could not reach Sanity (${err.message}).` +
          '\n  ! Building with the article pages already in the repo — they may be out of date.\n'
      );
      return;
    }
    throw err;
  }

  if (!posts.length) {
    // Content documents in this project are not publicly readable — only the
    // image assets are — so an unauthenticated query succeeds and returns an
    // empty list rather than a 401. Without this the failure reads as "there
    // is no content", which sends you looking in entirely the wrong place.
    throw new Error(
      SANITY_API_TOKEN
        ? `Sanity returned no posts from ${SANITY_PROJECT_ID}/${SANITY_DATASET}. ` +
          'Check the project id and dataset, or run `npm run sanity:import`.'
        : 'Sanity returned no posts, and no SANITY_API_TOKEN is set. Posts in this ' +
          'project are not publicly readable, so the build needs a read token. Set ' +
          'SANITY_API_TOKEN in the build environment (a Viewer token is enough).'
    );
  }

  const unknown = posts.filter((p) => !POST_TYPES[p.postType]);
  if (unknown.length) {
    throw new Error(
      `Unknown postType on: ${unknown.map((p) => `${p.slug} (${p.postType})`).join(', ')}`
    );
  }

  const template = fs.readFileSync(path.join(ROOT, 'build/templates/article.html'), 'utf8');
  const writes = [];

  for (const post of posts) {
    const config = POST_TYPES[post.postType];
    writes.push([
      path.join(ROOT, config.dir, `${post.slug}.html`),
      renderArticle(template, post),
    ]);
  }

  for (const [postType, config] of Object.entries(POST_TYPES)) {
    const listing = path.join(ROOT, config.listing);
    const ofType = posts.filter((p) => p.postType === postType);
    writes.push([listing, renderListing(listing, ofType, categories)]);
  }

  // A page per category. Only categories that actually carry a post get one —
  // an empty topic page is a dead end for a visitor and a thin page for search.
  const topicTemplate = fs.readFileSync(path.join(ROOT, 'build/templates/topic.html'), 'utf8');
  const usedSlugs = new Set(posts.flatMap((p) => (p.categories || []).map((c) => c.slug)));
  const liveCategories = categories.filter((c) => usedSlugs.has(c.slug));

  for (const category of liveCategories) {
    writes.push([
      path.join(ROOT, TOPIC_DIR, `${category.slug}.html`),
      renderTopic(topicTemplate, category, liveCategories, posts),
    ]);
  }

  // Article and topic pages are generated wholesale, so a post or category
  // deleted in Sanity has to take its page with it or the site keeps serving
  // an orphan.
  const orphans = [];
  for (const [postType, config] of Object.entries(POST_TYPES)) {
    const dir = path.join(ROOT, config.dir);
    if (!fs.existsSync(dir)) continue;
    const live = new Set(posts.filter((p) => p.postType === postType).map((p) => `${p.slug}.html`));
    for (const file of fs.readdirSync(dir)) {
      if (file.endsWith('.html') && !live.has(file)) orphans.push(path.join(dir, file));
    }
  }
  const topicDir = path.join(ROOT, TOPIC_DIR);
  if (fs.existsSync(topicDir)) {
    const live = new Set(liveCategories.map((c) => `${c.slug}.html`));
    for (const file of fs.readdirSync(topicDir)) {
      if (file.endsWith('.html') && !live.has(file)) orphans.push(path.join(topicDir, file));
    }
  }

  let stale = 0;
  for (const [file, content] of writes) {
    const current = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null;
    if (current === content) continue;
    stale += 1;
    const label = path.relative(ROOT, file).replace(/\\/g, '/');
    if (CHECK_ONLY) {
      console.log(`  stale: ${label}`);
    } else {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, content);
      console.log(`  wrote ${label}`);
    }
  }

  for (const file of orphans) {
    const label = path.relative(ROOT, file).replace(/\\/g, '/');
    stale += 1;
    if (CHECK_ONLY) console.log(`  orphaned: ${label}`);
    else {
      fs.rmSync(file);
      console.log(`  removed ${label} (no longer in Sanity)`);
    }
  }

  if (CHECK_ONLY && stale) {
    throw new Error(`${stale} generated file(s) are out of date. Run \`npm run sanity:sync\`.`);
  }
  console.log(
    `\n${posts.length} posts and ${liveCategories.length} categories synced` +
      (stale ? `, ${stale} file(s) updated.` : ', everything already up to date.')
  );
}

main().catch((err) => {
  console.error(`\nSync failed: ${err.message}`);
  process.exitCode = 1;
});
