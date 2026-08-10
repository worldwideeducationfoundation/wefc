import fs from 'fs';
import { resolve, relative } from 'path';

/**
 * Build-time SEO plugin: canonical URLs, robots.txt and sitemap.xml.
 *
 * Canonicals are injected here rather than hand-written into each page for a
 * concrete reason: every page is reachable at three URLs — /pages/contact,
 * /pages/contact/ and /pages/contact.html (the directory-index twins the
 * clean-urls plugin writes), and again on both the apex and www hostnames.
 * Deriving the canonical from the output path means the tag can never drift
 * from where the file actually lands.
 */

export const SITE_URL = 'https://wefcanada.org';

/**
 * Pages that must never be indexed.
 *
 * - `blog/post`, `blog/category` are client-side templates. They render a
 *   Sanity document chosen from the URL, so on their own path they are an
 *   empty shell.
 * - `blog/list`, `blog/standard` are leftover layout demos from the purchased
 *   WordPress theme.
 * - The remaining entries are that theme's filler articles about choosing a
 *   WordPress theme. They are thin, off-topic for a charity, and link to
 *   /tag/* and /category/* pages that do not exist.
 *
 * They are excluded from the sitemap and marked noindex rather than deleted —
 * removing them is a content decision for the site owners.
 */
const NOINDEX_ROUTES = new Set([
  'blog/post',
  'blog/category',
  'blog/list',
  'blog/standard',
  'blog/best-charity-theme',
  'blog/best-ngo-theme',
  'blog/donation-guide-beginners',
  'blog/high-converting',
  'blog/ngo-launch-guide',
  'blog/nonprofit-review',
  'blog/perfect-fundraising-choice',
  'blog/powerful-donation',
  'blog/top-features',
  'blog/wordpress-theme-ngo'
]);

/** Priority and change frequency by route, falling back to sensible defaults. */
function sitemapHints(route) {
  if (route === '') return { priority: '1.0', changefreq: 'weekly' };
  if (['pages/mission', 'pages/active-projects', 'pages/centers', 'team'].includes(route)) {
    return { priority: '0.9', changefreq: 'monthly' };
  }
  if (['pages/contact', 'pages/gallery', 'pages/success-stories', 'pages/project-updates', 'blog'].includes(route)) {
    return { priority: '0.8', changefreq: 'monthly' };
  }
  if (route.startsWith('blog/category/')) return { priority: '0.6', changefreq: 'weekly' };
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

export function seoPlugin() {
  const routes = new Set();

  return {
    name: 'wef-seo',
    apply: 'build',

    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const route = routeFromHtmlPath(ctx.path);
        const url = canonicalUrl(route);
        const noindex = NOINDEX_ROUTES.has(route);

        if (!noindex) routes.add(route);

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

        let out = html;

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

    // Rollup runs closeBundle hooks in parallel unless a plugin opts out.
    // The sitemap has to be written after the clean-urls plugin has created
    // the blog route directories, so this one is explicitly sequential.
    closeBundle: {
      sequential: true,
      async handler() {
      const outDir = resolve('dist');
      if (!fs.existsSync(outDir)) return;

      // The clean-urls plugin adds directory-index twins for the Sanity blog
      // routes after the HTML transform has run, so those routes are not in
      // `routes` yet. Pick them up off disk instead.
      for (const dir of ['blog', 'blog/category']) {
        const full = resolve(outDir, dir);
        if (!fs.existsSync(full)) continue;
        for (const entry of fs.readdirSync(full, { withFileTypes: true })) {
          if (!entry.isDirectory() || entry.name === 'category') continue;
          if (fs.existsSync(resolve(full, entry.name, 'index.html'))) {
            const route = `${dir}/${entry.name}`;
            if (!NOINDEX_ROUTES.has(route)) routes.add(route);
          }
        }
      }

      const today = new Date().toISOString().slice(0, 10);
      const sorted = [...routes].sort();

      const urls = sorted.map((route) => {
        const { priority, changefreq } = sitemapHints(route);
        return [
          '  <url>',
          `    <loc>${canonicalUrl(route)}</loc>`,
          `    <lastmod>${today}</lastmod>`,
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
          '# Client-side templates and leftover theme demo content.',
          '# These are also marked noindex in the pages themselves.',
          'Disallow: /blog/post',
          'Disallow: /blog/category.html',
          'Disallow: /blog/list',
          'Disallow: /blog/standard',
          '',
          `Sitemap: ${SITE_URL}/sitemap.xml`,
          ''
        ].join('\n'),
        'utf8'
      );

      console.log(`[seo] sitemap.xml with ${sorted.length} URLs, robots.txt written.`);
      }
    }
  };
}
