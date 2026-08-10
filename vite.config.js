import { defineConfig, loadEnv } from 'vite';
import { resolve, extname, relative } from 'path';
import fs from 'fs';
import { seoPlugin } from './build/seo.js';

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
 */
function cleanUrlsBuildPlugin() {
  return {
    name: 'clean-urls-build',
    closeBundle() {
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
        // 1. Direct .html mapping: e.g. /pages/mission -> /pages/mission.html
        const potentialHtmlFile = pathname + '.html';
        const directPath = resolve('.' + potentialHtmlFile);
        if (fs.existsSync(directPath)) {
          req.url = potentialHtmlFile + parsedUrl.search;
          return next();
        }

        // 2. Index.html mapping inside folder: e.g. /team -> /team/index.html
        const potentialIndexFile = pathname + '/index.html';
        const indexPath = resolve('.' + potentialIndexFile);
        if (fs.existsSync(indexPath)) {
          req.url = potentialIndexFile + parsedUrl.search;
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
    // Order matters: cleanUrlsBuildPlugin writes the blog directory routes in
    // its closeBundle, and seoPlugin's closeBundle reads them to build the
    // sitemap, so it has to come after.
    plugins: [cleanUrlsPlugin, cleanUrlsBuildPlugin(), seoPlugin()],
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
