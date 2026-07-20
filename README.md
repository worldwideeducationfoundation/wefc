# Donexa Clone - High-Fidelity Website Replica

A complete high-fidelity replica of **Donexa – Charity & Donation Theme** (`https://donexa.peacefulqode.in/`), converted into a highly optimized, fully localized, multi-page **Vite + npm runnable** project designed for immediate deployment to **Vercel**.

## Features

- **100% Asset Localization**: All stylesheets, JavaScript files, images (including full layout/responsive `srcset` variants), web fonts (FontAwesome, Themify, Flaticon), and SVG assets have been completely downloaded, cached, and localized under `public/`. No assets are requested from the remote WordPress server, preventing CORS walls or domain deletion issues.
- **Clean WordPress Routing**: Preserves clean URLs exactly matching WordPress, utilizing folder-nested index structures (e.g., `/about-us/index.html` matches `/about-us/` natively).
- **Responsive Media & Lazy Loading**: Playwright was configured to slowly scroll down each of the 69 pages to trigger and capture lazy-loaded images, preserving background image stylesheets and retina screen widths flawlessly.
- **Vercel & Vite Optimized**: Completely "npm runnable" out of the box with Vite, compilation-tested with exit code `0`. Includes custom configurations (`vite.config.js`, `vercel.json`) to automate routing, assets mapping, and trailing slash behaviors.

---

## Getting Started

### 1. Installation
Install the project dependencies locally:
```bash
npm install
```

### 2. Development Mode
Run the development server locally:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser to view the site with hot-module reloading.

### 3. Production Build
Compile and bundle all 69 pages into highly-optimized static assets inside the `dist/` folder:
```bash
npm run build
```

---

## Deployment to Vercel

This project is fully pre-configured for Vercel out of the box.

### Option A: Using the Vercel CLI
If you have Vercel CLI installed, deploy directly from your terminal:
```bash
vercel
```

### Option B: Deployment via GitHub (Recommended)
1. Initialize a Git repository in this folder:
   ```bash
   git init
   git add .
   git commit -m "feat: initial commit of Donexa complete clone"
   ```
2. Create a repository on GitHub and link it:
   ```bash
   git remote add origin <your-github-repo-url>
   git branch -M main
   git push -u origin main
   ```
3. Go to [Vercel](https://vercel.com/), click **Add New** -> **Project**, import your repository, and click **Deploy**. Vercel will automatically detect **Vite** as the framework, build the project with `npm run build`, and deploy it seamlessly!
