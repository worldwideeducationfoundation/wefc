import { defineConfig, loadEnv } from 'vite';
import { resolve, extname, relative } from 'path';
import fs from 'fs';

// Helper to recursively find all HTML files
function getHtmlInputFiles(dir, files = {}) {
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const filePath = resolve(dir, file);
    const stat = fs.statSync(filePath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist' && file !== 'public' && !file.startsWith('.')) {
        getHtmlInputFiles(filePath, files);
      }
    } else if (extname(file) === '.html') {
      const relativePath = relative(resolve(), filePath);
      const name = relativePath.replace(/\.html$/, '').replace(/[\\/]/g, '_') || 'main';
      files[name || 'index'] = filePath;
    }
  }
  return files;
}

// Scrape the category slugs the site actually links to. Sanity only knows the
// categories that have been created there, but the navigation links to more
// than that, and a linked URL should render an empty listing rather than a 404.
function linkedCategorySlugs(dir, found = new Set()) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (!['node_modules', 'dist', '.git'].includes(entry.name) && !entry.name.startsWith('.')) {
        linkedCategorySlugs(resolve(dir, entry.name), found);
      }
    } else if (entry.name.endsWith('.html')) {
      const html = fs.readFileSync(resolve(dir, entry.name), 'utf8');
      for (const m of html.matchAll(/href="\/blog\/category\/([a-z0-9-]+)\/?"/gi)) {
        found.add(m[1]);
      }
    }
  }
  return found;
}

// Ask Sanity which blog post and category slugs exist, so each one can be given
// a real file on disk. Returns empty lists rather than failing the build.
async function fetchBlogSlugs() {
  try {
    const { createClient } = await import('@sanity/client');
    const client = createClient({
      projectId: process.env.VITE_SANITY_PROJECT_ID || 'wgy1a1gg',
      dataset: process.env.VITE_SANITY_DATASET || 'production',
      apiVersion: process.env.VITE_SANITY_API_VERSION || '2026-07-08',
      useCdn: true
    });
    const [posts, categories] = await Promise.all([
      client.fetch('*[_type == "post" && !(_id in path("drafts.**"))].slug.current'),
      client.fetch('*[_type == "category"].slug.current')
    ]);
    return {
      posts: (posts || []).filter(Boolean),
      categories: (categories || []).filter(Boolean)
    };
  } catch (error) {
    console.warn(`[clean-urls] Could not reach Sanity (${error.message}). ` +
      'Blog post pages will not be pre-rendered this build.');
    return { posts: [], categories: [] };
  }
}

/**
 * Give every page a directory-index twin: dist/pages/contact.html is also
 * written as dist/pages/contact/index.html.
 *
 * The whole site links to extensionless URLs (/pages/contact, /pages/gallery).
 * Vercel resolved those through `cleanUrls` in vercel.json, but Hostinger
 * serves dist/ as plain static files and 404s on them. A directory index is
 * the one form of clean URL every static host understands with no
 * configuration, so this makes the output portable rather than betting on
 * host-specific rewrite rules. The original .html files stay in place, so old
 * /pages/contact.html links keep working too.
 *
 * The blog's dynamic routes (/blog/<slug>, /blog/category/<slug>) get the same
 * treatment from the slug lists, since there is no file for them otherwise.
 * Both loaders read the slug off the last path segment, which a trailing-slash
 * directory URL preserves.
 */
function cleanUrlsBuildPlugin() {
  return {
    name: 'clean-urls-build',
    async closeBundle() {
      const outDir = resolve('dist');
      if (!fs.existsSync(outDir)) return;

      const written = [];

      const writeIndex = (routeDir, sourceFile) => {
        const target = resolve(outDir, routeDir, 'index.html');
        if (fs.existsSync(target)) return;
        fs.mkdirSync(resolve(outDir, routeDir), { recursive: true });
        fs.copyFileSync(sourceFile, target);
        written.push(routeDir);
      };

      // 1. Every built page except the ones already serving as a directory index.
      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const full = resolve(dir, entry.name);
          if (entry.isDirectory()) {
            walk(full);
          } else if (entry.name.endsWith('.html') && entry.name !== 'index.html') {
            const route = relative(outDir, full).replace(/\.html$/, '').replace(/\\/g, '/');
            writeIndex(route, full);
          }
        }
      };
      walk(outDir);

      // 2. Blog posts and category listings, which have no file of their own.
      const postTemplate = resolve(outDir, 'blog/post.html');
      const categoryTemplate = resolve(outDir, 'blog/category.html');
      const { posts, categories } = await fetchBlogSlugs();

      if (fs.existsSync(postTemplate)) {
        for (const slug of posts) writeIndex(`blog/${slug}`, postTemplate);
      }
      if (fs.existsSync(categoryTemplate)) {
        const slugs = new Set([...categories, ...linkedCategorySlugs(resolve('.'))]);
        for (const slug of slugs) writeIndex(`blog/category/${slug}`, categoryTemplate);
      }

      console.log(`[clean-urls] Wrote ${written.length} directory-index routes.`);
    }
  };
}

// Development middleware to serve clean URLs without .html
const cleanUrlsPlugin = {
  name: 'clean-urls-dev',
  configureServer(server) {
    server.middlewares.use((req, res, next) => {
      const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
      let pathname = parsedUrl.pathname;

      // Handle clean home index
      if (pathname === '/' || pathname === '') {
        return next();
      }

      // Remove trailing slash if present
      if (pathname.endsWith('/')) {
        pathname = pathname.slice(0, -1);
      }

      // If it's a route and doesn't have an extension (like .js, .css, .jpg)
      if (!pathname.includes('.')) {
        // 1. Direct categories route interceptor: e.g. /blog/category/news -> /blog/category.html
        if (pathname.startsWith('/blog/category/')) {
          req.url = '/blog/category.html' + parsedUrl.search;
          return next();
        }

        // 2. Direct .html mapping: e.g. /pages/about -> /pages/about.html
        const potentialHtmlFile = pathname + '.html';
        const directPath = resolve('.' + potentialHtmlFile);
        if (fs.existsSync(directPath)) {
          req.url = potentialHtmlFile + parsedUrl.search;
          return next();
        }

        // 3. Index.html mapping inside folder: e.g. /blog -> /blog/index.html
        const potentialIndexFile = pathname + '/index.html';
        const indexPath = resolve('.' + potentialIndexFile);
        if (fs.existsSync(indexPath)) {
          req.url = potentialIndexFile + parsedUrl.search;
          return next();
        }

        // 4. Fallback: If it is a blog subpath (dynamic slug), route to /blog/post.html
        if (pathname.startsWith('/blog/') && !['/blog/list', '/blog/standard'].includes(pathname)) {
          req.url = '/blog/post.html' + parsedUrl.search;
          return next();
        }
      }
      next();
    });
  }
};

export default defineConfig(({ mode }) => {
  // Load every env var (no prefix filter) so we can pick out the Supabase
  // credentials Hostinger injects at build time under their own names.
  const env = loadEnv(mode, process.cwd(), '');

  return {
    root: './',
    plugins: [cleanUrlsPlugin, cleanUrlsBuildPlugin()],
    // Only these two names are ever inlined into the bundle — an explicit
    // allowlist rather than an `envPrefix`, so a stray SUPABASE_SERVICE_ROLE_KEY
    // in the environment can never leak into client-side JavaScript.
    define: {
      'import.meta.env.SUPABASE_URL': JSON.stringify(
        env.SUPABASE_URL || env.VITE_SUPABASE_URL || ''
      ),
      'import.meta.env.SUPABASE_ANON_KEY': JSON.stringify(
        env.SUPABASE_API_KEY || env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || ''
      )
    },
    build: {
      outDir: 'dist',
      emptyOutDir: true,
      rollupOptions: {
        input: getHtmlInputFiles(resolve())
      }
    }
  };
});
