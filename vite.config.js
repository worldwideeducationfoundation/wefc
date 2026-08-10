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
    plugins: [cleanUrlsPlugin],
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
