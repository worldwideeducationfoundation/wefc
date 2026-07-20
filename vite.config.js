import { defineConfig } from 'vite';
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

export default defineConfig({
  root: './',
  plugins: [cleanUrlsPlugin],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: getHtmlInputFiles(resolve())
    }
  }
});
