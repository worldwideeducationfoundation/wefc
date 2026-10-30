import fs from 'fs';
import { execFileSync } from 'child_process';
import { resolve, relative } from 'path';

/**
 * Build-time SEO plugin: canonical URLs, social tags, robots.txt and sitemap.xml.
 *
 * Canonicals are injected here rather than hand-written into each page for a
 * concrete reason: every page is reachable at three URLs — /pages/contact,
 * /pages/contact/ and /pages/contact.html (the directory-index twins the
 * clean-urls plugin writes), and again on both the apex and www hostnames.
 * Deriving the canonical from the output path means the tag can never drift
 * from where the file actually lands.
 *
 * og:image and twitter:card are handled here for the same reason. Both are the
 * kind of tag that is easy to hand-write subtly wrong on one page out of forty
 * and never notice, because nothing on the page itself looks broken.
 */

export const SITE_URL = 'https://wefcanada.org';

/**
 * Pages that must never be indexed.
 *
 * 404 is here because Vercel serves dist/404.html for any unmatched path: it
 * has to exist as a built page, but it is not a destination and must stay out
 * of both the index and the sitemap.
 */
const NOINDEX_ROUTES = new Set(['404']);

/** Priority and change frequency by route, falling back to sensible defaults. */
function sitemapHints(route) {
  if (route === '') return { priority: '1.0', changefreq: 'weekly' };
  if (['donate', 'pages/mission', 'pages/active-projects', 'pages/centers', 'team'].includes(route)) {
    return { priority: '0.9', changefreq: 'monthly' };
  }
  if (['pages/contact', 'pages/gallery', 'pages/success-stories', 'pages/project-updates'].includes(route)) {
    return { priority: '0.8', changefreq: 'monthly' };
  }
  return { priority: '0.7', changefreq: 'monthly' };
}

/** '/pages/contact.html' -> 'pages/contact'; '/index.html' -> ''. */
function routeFromHtmlPath(htmlPath) {
  return htmlPath
    .replace(/^\//, '')
    .replace(/index\.html$/, '')
    .replace(/\.html$/, '')
    .replace(/\/$/, '');
}

/** Canonical form: apex host, trailing slash, so one URL wins per page. */
export function canonicalUrl(route) {
  return route === '' ? `${SITE_URL}/` : `${SITE_URL}/${route}/`;
}

/**
 * Last commit date for every tracked file, from a single `git log` pass.
 *
 * The sitemap used to stamp every URL with the build date, which told search
 * engines that all forty pages changed every time anything was deployed — a
 * signal that means nothing once it is always true. A per-file commit date is
 * the honest version.
 *
 * One `git log` walk is used rather than a call per file because the latter is
 * forty process spawns on every build. Returns an empty map when git is
 * unavailable (a tarball deploy, a clone with no history); callers fall back to
 * the build date.
 */
function gitLastModifiedDates() {
  const dates = new Map();
  try {
    const log = execFileSync(
      'git',
      ['log', '--pretty=format:%cI', '--name-only', '--no-renames'],
      { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }
    );
    let current = null;
    for (const line of log.split('\n')) {
      const text = line.trim();
      if (!text) continue;
      if (/^\d{4}-\d{2}-\d{2}T/.test(text)) {
        current = text.slice(0, 10);
      } else if (current && !dates.has(text)) {
        // git log walks newest first, so the first sighting of a path is its
        // most recent commit. Later (older) sightings must not overwrite it.
        dates.set(text, current);
      }
    }
  } catch {
    // No git, no history, or not a repository — fall back to the build date.
  }
  return dates;
}

const ORG_ID = `${SITE_URL}/#organization`;

const MONTHS = {
  january: '01', february: '02', march: '03', april: '04', may: '05', june: '06',
  july: '07', august: '08', september: '09', october: '10', november: '11', december: '12'
};

/**
 * The publication date shown to readers, from the `.proj-meta` strip at the top
 * of an update ("February 12, 2026").
 *
 * Deliberately not falling back to the file's git date: that records when the
 * page was committed to this repository, which for older updates is months
 * after the event. A wrong datePublished is worse than none, so pages without a
 * visible date simply don't get the property.
 */
function publishedDate(html) {
  const meta = html.match(/class="proj-meta"[\s\S]{0,900}?<\/div>/i);
  if (!meta) return null;
  const m = meta[0].match(/>([A-Z][a-z]+) (\d{1,2}), (\d{4})</);
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  return `${m[3]}-${month}-${String(m[2]).padStart(2, '0')}`;
}

/** The section a page sits under, for breadcrumbs. */
function breadcrumbParent(route) {
  if (route.startsWith('pages/updates/')) return ['Project Updates', 'pages/project-updates'];
  if (route.startsWith('pages/stories/')) return ['Success Stories', 'pages/success-stories'];
  if (route.startsWith('pages/projects/')) return ['Active Projects', 'pages/active-projects'];
  return null;
}

const decodeEntities = (s) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

function readMeta(html) {
  const title = (html.match(/<title>([^<]*)<\/title>/i) || [, ''])[1];
  const description = (html.match(/<meta\s+name="description"\s*[\s\S]{0,20}?content="([^"]*)"/i) || [, ''])[1];
  const image = (html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i) || [, ''])[1];
  return {
    title: decodeEntities(title),
    // The name without the brand tail — what a breadcrumb should read.
    shortTitle: decodeEntities(title).split(' | ')[0],
    description: decodeEntities(description),
    image: decodeEntities(image)
  };
}

/**
 * Per-page JSON-LD: a breadcrumb trail on every inner page, plus Article markup
 * on the updates and stories. The home page already declares the NGO and
 * WebSite nodes by hand and is skipped here; everything below points back at
 * that organization by @id rather than restating it.
 */
function structuredData(route, html) {
  if (route === '') return null;

  const { title, shortTitle, description, image } = readMeta(html);
  if (!title) return null;

  const crumbs = [{ name: 'Home', url: canonicalUrl('') }];
  const parent = breadcrumbParent(route);
  if (parent) crumbs.push({ name: parent[0], url: canonicalUrl(parent[1]) });
  crumbs.push({ name: shortTitle, url: canonicalUrl(route) });

  const graph = [
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonicalUrl(route)}#breadcrumb`,
      itemListElement: crumbs.map((c, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        name: c.name,
        item: c.url
      }))
    }
  ];

  const isArticle = route.startsWith('pages/updates/') || route.startsWith('pages/stories/');
  if (isArticle) {
    const article = {
      '@type': 'Article',
      '@id': `${canonicalUrl(route)}#article`,
      headline: shortTitle,
      mainEntityOfPage: canonicalUrl(route),
      inLanguage: 'en',
      publisher: { '@id': ORG_ID },
      author: { '@id': ORG_ID }
    };
    if (description) article.description = description;
    if (image) article.image = image;
    const published = publishedDate(html);
    if (published) {
      article.datePublished = published;
      article.dateModified = published;
    }
    graph.push(article);
  }

  return { '@context': 'https://schema.org', '@graph': graph };
}

export function seoPlugin() {
  const routes = new Set();
  /** route -> repo-relative source path, for looking up commit dates later. */
  const sourceByRoute = new Map();

  const GA4_ID = process.env.GA4_MEASUREMENT_ID || '';
  const SITE_VERIFICATION = process.env.GOOGLE_SITE_VERIFICATION || '';

  return {
    name: 'wef-seo',
    apply: 'build',

    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const route = routeFromHtmlPath(ctx.path);
        const url = canonicalUrl(route);
        const noindex = NOINDEX_ROUTES.has(route);

        if (!noindex) {
          routes.add(route);
          if (ctx.filename) {
            sourceByRoute.set(route, relative(resolve(), ctx.filename).replace(/\\/g, '/'));
          }
        }

        const tags = [];

        // Never emit a second canonical: a page that already declares one has
        // made a deliberate choice this plugin should not override.
        if (!/rel=["']canonical["']/i.test(html)) {
          tags.push({
            tag: 'link',
            attrs: { rel: 'canonical', href: url },
            injectTo: 'head'
          });
        }

        // og:url is the same decision as the canonical, so keep them in step.
        if (!/property=["']og:url["']/i.test(html)) {
          tags.push({
            tag: 'meta',
            attrs: { property: 'og:url', content: url },
            injectTo: 'head'
          });
        }

        // Open Graph requires an absolute URL. Seventeen pages hand-wrote a
        // site-root path like /content/uploads/wef/WEFC%20Logo.png, which no
        // crawler can resolve — those pages shared with no image at all. The
        // update and story pages already carry absolute Sanity CDN URLs and are
        // left untouched by this.
        let out = html.replace(
          /(<meta[^>]*property=["']og:image["'][^>]*content=["'])(\/[^"']*)(["'])/gi,
          (_match, before, path, after) => `${before}${SITE_URL}${path}${after}`
        );

        // Without a card type, X renders a bare link with no preview even when
        // og:image is perfectly valid.
        if (!/name=["']twitter:card["']/i.test(out)) {
          tags.push({
            tag: 'meta',
            attrs: { name: 'twitter:card', content: 'summary_large_image' },
            injectTo: 'head'
          });
        }

        // Breadcrumb and Article markup, derived from what the page already
        // says. A page that ships its own JSON-LD (the home page) is left alone.
        if (!/type=["']application\/ld\+json["']/i.test(out)) {
          const data = structuredData(route, out);
          if (data) {
            tags.push({
              tag: 'script',
              attrs: { type: 'application/ld+json' },
              // `</` inside a script body would close the tag early.
              children: JSON.stringify(data, null, 2).replace(/<\//g, '<\\/'),
              injectTo: 'head'
            });
          }
        }

        // Search Console's HTML-tag method only ever checks the home page.
        if (SITE_VERIFICATION && route === '') {
          tags.push({
            tag: 'meta',
            attrs: { name: 'google-site-verification', content: SITE_VERIFICATION },
            injectTo: 'head'
          });
        }

        // Analytics is opt-in through the environment, so local builds and
        // preview deploys never report traffic into the production property.
        if (GA4_ID && !noindex) {
          tags.push({
            tag: 'script',
            attrs: { async: true, src: `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}` },
            injectTo: 'head'
          });
          tags.push({
            tag: 'script',
            children:
              'window.dataLayer=window.dataLayer||[];' +
              'function gtag(){dataLayer.push(arguments);}' +
              "gtag('js',new Date());" +
              `gtag('config','${GA4_ID}');`,
            injectTo: 'head'
          });
        }

        if (noindex) {
          // The theme pages ship their own `<meta name="robots">` carrying
          // WordPress's max-image-preview directive. Two robots metas are
          // ambiguous, so drop the existing one and state the full policy in
          // the tag injected below.
          out = out.replace(/<meta[^>]*name=["']robots["'][^>]*>\s*/gi, '');
          tags.push({
            tag: 'meta',
            attrs: { name: 'robots', content: 'noindex, follow, max-image-preview:large' },
            injectTo: 'head'
          });
        }

        return { html: out, tags };
      }
    },

    closeBundle() {
      const outDir = resolve('dist');
      if (!fs.existsSync(outDir)) return;

      const today = new Date().toISOString().slice(0, 10);
      const commitDates = gitLastModifiedDates();
      const sorted = [...routes].sort();
      let dated = 0;

      const urls = sorted.map((route) => {
        const { priority, changefreq } = sitemapHints(route);
        const source = sourceByRoute.get(route);
        const lastmod = (source && commitDates.get(source)) || today;
        if (source && commitDates.has(source)) dated++;
        return [
          '  <url>',
          `    <loc>${canonicalUrl(route)}</loc>`,
          `    <lastmod>${lastmod}</lastmod>`,
          `    <changefreq>${changefreq}</changefreq>`,
          `    <priority>${priority}</priority>`,
          '  </url>'
        ].join('\n');
      }).join('\n');

      fs.writeFileSync(
        resolve(outDir, 'sitemap.xml'),
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
        'utf8'
      );

      fs.writeFileSync(
        resolve(outDir, 'robots.txt'),
        [
          'User-agent: *',
          'Allow: /',
          '',
          `Sitemap: ${SITE_URL}/sitemap.xml`,
          ''
        ].join('\n'),
        'utf8'
      );

      console.log(
        `[seo] sitemap.xml with ${sorted.length} URLs (${dated} dated from git), robots.txt written.` +
        (GA4_ID ? ' GA4 tag injected.' : ' GA4 disabled (set GA4_MEASUREMENT_ID to enable).')
      );
    }
  };
}
