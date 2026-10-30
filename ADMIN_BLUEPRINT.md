# Blueprint: a self-hosted website + admin on Hostinger

This describes how the **FES Pakistan** site (fespakistan.org) and its built-in
admin are built and hosted. The goal is to build the same thing for another
site, keeping the same architecture, security model and admin experience, with
that site's own content types and design.

> **Reference implementation:** `https://github.com/worldwideeducationfoundation/fesp`
> (private repo, branch `main`). If you can read it (`gh repo clone
> worldwideeducationfoundation/fesp ../fesp-reference`), use it as the source
> of truth and copy or adapt files from it. Don't reinvent them. File paths
> below refer to that repo. Treat it as read-only.

---

## 1. The big picture

One **Next.js app** serves both the public website and the admin at `/admin`.
There is no separate CMS, no WordPress, and no third-party headless service.

```
GitHub (code) ──push──► Hostinger Node.js app ──► MySQL database  (all text, settings, menus, users)
                                               └─► UPLOAD_DIR      (all uploaded images, outside the app folder)
```

- **Code** lives in GitHub. Pushing to `main` makes Hostinger rebuild and restart.
- **Content** lives in MySQL. **Images** live in a folder on the server. Neither
  is ever in git, so a deploy can't overwrite content and editing content
  never needs a deploy.
- Admin edits show on the site **immediately**. Public pages render on request
  and read through a small in-process cache, which every admin write clears.
- The **database schema creates itself**. SQL migrations are bundled into the
  app and applied on server start, so nothing ever needs importing in phpMyAdmin.

### Stack

| Piece | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, React Server Components, Server Actions), TypeScript | One app for site + admin. Server Actions handle admin forms with built-in CSRF protection |
| Styling | Tailwind CSS v4 (`@tailwindcss/postcss`), design tokens in `globals.css` | |
| Database | MySQL/MariaDB via `mysql2/promise` (pool, `?` placeholders only) | It's what Hostinger shared hosting provides |
| Images | `sharp`: every upload is re-encoded to WebP, max 2400px | Small files, and nothing uploaded is ever served back byte-for-byte |
| Rich text | Tiptap 3 (`@tiptap/react`, `@tiptap/starter-kit`), stored as JSON | |
| Validation | `zod` | |
| Backups | `tar` (.tar.gz of JSON + images) | |
| Node | `>=22.17.0 <23`, pinned in `.nvmrc` and `engines` | Hostinger's Node 22 |

No ORM, no auth library and no external services. Passwords use Node's built-in `scrypt`.

> **Next.js 16 is not the Next.js in your training data.** Read
> `node_modules/next/dist/docs/` before writing code. Notably, middleware is
> now `src/proxy.ts` (exporting `proxy`), route handler params are async, and
> `RouteContext<"/path">` types exist.

---

## 2. Repository layout

The Next.js app sits at the **repository root**, so Hostinger builds from the
root with no subdirectory setting.

```
.
├── db/migrations/           001_initial.sql, 002_….sql — schema, applied in name order
├── scripts/
│   └── bundle-migrations.mjs   prebuild: copies the .sql files into src/server/migrations.generated.ts
├── src/
│   ├── instrumentation.ts      on server start → run migrations (Node runtime only)
│   ├── instrumentation-node.ts
│   ├── proxy.ts                no admin cookie 
│   │   ├── (site)/             the public website (route group with its own layout)
│   │   ├── admin/
│   │   │   ├── login/, setup/          open pages
│   │   │   ├── (panel)/                everything behind sign-in, using the Shell layout
│   │   │   │   ├── page.tsx            dashboard
│   │   │   │   ├── content/[resource]/ generic list / new / [id] edit for every content type
│   │   │   │   ├── pages/              page builder (custom pages made of sections)
│   │   │   │   ├── page-content/[key]/ editable copy of the built-in pages
│   │   │   │   ├── navigation/ media/ messages/ newsletter/ settings/
│   │   │   │   ├── users/ account/ activity/ trash/ backups/ api-access/
│   │   │   └── api/                    media upload, backup download/restore, CSV exports
│   │   ├── api/v1/             Content API (Bearer-token REST for scripts / Claude)
│   │   ├── uploads/[...path]/  serves images from UPLOAD_DIR
│   │   ├── robots.ts, sitemap.ts
│   ├── components/             site components; components/admin/ for the admin UI
│   ├── lib/                    shared types and helpers (safe on client and server)
│   └── server/                 everything that touches the DB ("server-only")
│       ├── env.ts db.ts migrate.ts cache.ts
│       ├── auth/ session.ts password.ts roles.ts
│       ├── admin/ resources.ts save.ts validate.ts trash.ts nav.ts guard.ts origin.ts media-usage.ts
│       ├── api/ auth.ts content.ts
│       ├── content.ts          public-site reads (published only, cached)
│       ├── blocks.ts           editable copy of built-in pages, with defaults
│       ├── settings.ts         site-wide settings, with defaults
│       ├── media.ts backup.ts activity.ts preview.ts
├── .env.example  DEPLOYMENT.md  CONTENT_API.md  README.md
```

---

## 3. How each part works

### 3.1 Configuration: `src/server/env.ts`
All config comes from environment variables: Hostinger's panel in production,
`.env.local` in development. Nothing secret is committed. Use either
`DATABASE_URL` or `DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD`.
`UPLOAD_DIR` falls back to `./storage/uploads` (gitignored) for local development.

### 3.2 Database: `src/server/db.ts`, `src/server/migrate.ts`
- A single `mysql2` pool kept on `globalThis`, with `utf8mb4`, UTC, and `connectionLimit: 8`.
- Use `pool.query` with `?` placeholders. **Never interpolate values.** The
  only identifiers placed into SQL are table and column names from the fixed
  allow-list in `resources.ts`.
- Migrations: `db/migrations/*.sql` are bundled into
  `src/server/migrations.generated.ts` by `scripts/bundle-migrations.mjs` (the
  `prebuild` script, output committed). `runMigrations()` takes a MySQL
  `GET_LOCK`, records applied versions in `schema_migrations`, and runs from
  `instrumentation.ts` on boot. `db.ts` also runs it before the first query of
  a process, as a safety net. A deploy that adds a migration therefore updates
  the live database by itself.
- An unreachable database is logged, not fatal. The admin then explains what's wrong.

**Table conventions** (see the header comment in `001_initial.sql`):
- Every content table has `id`, `status ENUM('draft','published')`,
  `display_order` (for drag-to-reorder types), `created_at`, `updated_at`,
  `created_by`, `updated_by`, and `deleted_at` (soft delete, which is the
  Trash). **Every public query filters on `status='published' AND deleted_at IS NULL`.**
- Images are referenced by `*_media_id` columns that point at `media`.
- Rich text is stored as Tiptap JSON in a `LONGTEXT`.
- System tables: `admin_users`, `admin_sessions`, `login_attempts`,
  `activity_logs`, `media`, `settings`, `content_blocks`, `core_pages`,
  `pages`, `nav_items`, `submissions`, `api_tokens`, `newsletter_subscribers`,
  `schema_migrations`.

### 3.3 Authentication and roles: `src/server/auth/`
- **First admin:** `/admin/setup` works only while there are no admins, and only
  with the `ADMIN_SETUP_KEY` from the environment. That stops anyone claiming
  a fresh install.
- **Passwords:** scrypt (N=32768), stored as `scrypt$N$r$p$salt$hash` and
  rehashed automatically if parameters change. The minimum is 12 characters,
  checked against a common-password list. There are no composition rules (NIST 800-63B).
- **Sessions:** a random token goes in an httpOnly, `Secure` (on HTTPS),
  `SameSite=Lax` cookie (`<site>_admin`). The DB stores only its SHA-256. Idle
  timeout is 2h and the absolute limit is 12h. The user row is re-read on every
  request, so disabling someone takes effect on their next click.
- **Login throttling:** 5 attempts per email and 20 per IP, then a 15-minute
  lockout. A dummy hash is checked for unknown emails, so timing doesn't reveal
  which accounts exist.
- **Roles** (`roles.ts`): `super_admin`, `administrator`, `editor`. Code
  always asks for a **capability** (`content.edit`, `media.upload`,
  `users.manage`, `backups.manage`, `submissions.view`, …), never a role name.
  The same check hides a button and guards the action.
- `proxy.ts` only checks that the cookie exists and redirects. The real check
  (`requireCapability`) runs in every admin page and action. Server actions are
  wrapped with `guarded(capability, fn)`, which turns a missing permission into
  a form message. Route handlers under `/admin/api` call `sameOrigin()` for CSRF.

### 3.4 The generic content engine: `src/server/admin/resources.ts`
This is the heart of the admin. **Each content type is one `ResourceDef`
entry**: key, table, labels, sidebar group, list columns, filters, search
fields, sort (or `"order"` for drag-to-reorder), form fields, public URL, and
media/rich-text columns. From that single entry, the shared screens at
`/admin/content/[resource]` provide:

- a list with search, filters, sort, drag-to-reorder, and bulk publish/unpublish/trash
- create/edit form (`ResourceForm.tsx`), validation (`validate.ts`), and save (`save.ts`)
- duplicate, Trash/restore, the activity log, and "view on site"
- Content API support (`/api/v1/content/{key}`) and backups

Field types (`src/lib/admin-fields.ts`): `text`, `textarea`, `lines`, `url`,
`slug` (auto-generated from another field), `number`, `date`, `datetime`,
`toggle`, `richtext`, `media`, `youtube`, `select` (static or
`optionsFrom` another table), `relation` (many-to-many via a join table),
and `placements`.

**Adding a content type means a migration (the table) plus one `ResourceDef`
entry plus the public page that reads it.** You don't build new admin screens.

### 3.5 Editable copy, settings, navigation, and built pages
- **Page Content** (`blocks.ts`): every visible string and image on the
  built-in pages (home, about, contact, …) is a named block with a
  **default**, the launch wording. Pages read copy through `getPageCopy(page)`
  and never through string literals. "Reset to original" deletes the stored
  value. Block types: `text`, `textarea`, `paragraphs`, `image`, `toggle`
  (show/hide a section), `order` (section order).
- **Settings** (`settings.ts`): organisation name, tagline, contact details,
  socials, and so on. Each has a default, so a fresh database shows a complete site.
- **Navigation** (`nav.ts`, `NavEditor.tsx`): the header and footer menus,
  stored in `nav_items`, falling back to `src/lib/default-nav.ts`.
- **Pages** (`lib/sections.ts`, `PageBuilder.tsx`): editors create new pages
  from sections (text, image+text, stats, gallery, videos, projects, posts,
  quote, CTA, …). Each section type renders with the **same components the
  built-in pages use**, so built pages look native. They're served by the
  catch-all `(site)/[...slug]/page.tsx`. `normalizeSections` runs on both save
  and render.

### 3.6 Media: `src/server/media.ts`, `app/uploads/[...path]`
Uploads (max 15 MB) are decoded by sharp, auto-rotated, scaled to at most
2400px, and saved as WebP under `UPLOAD_DIR` with a random, never-reused name.
Anything that can't be decoded is rejected. They're served by a route handler
with `immutable` caching, `nosniff`, and `CSP: default-src 'none'`. The media
library shows where each image is used (`media-usage.ts`), and alt text is
required. URL imports block private and internal IPs (SSRF). Uploads go through
`/admin/api/media` (a route handler, not a server action) because the proxy
buffers and caps request bodies.

### 3.7 Public site reads: `src/server/content.ts`, `cache.ts`
Server components call typed readers that are published-only and wrapped in
`cached(key, load)` (30s TTL, cleared by `invalidateContent()` on every
admin write). A signed-in admin can preview drafts (`preview.ts`,
`PreviewBanner`). Pages are dynamic, so **the build never needs the database**.

### 3.8 Everything else in the admin
- **Messages**: contact form submissions, with CSV export (`submissions.view` only).
- **Newsletter**: subscribers, with CSV export.
- **Activity log**: who changed what, including API changes marked "(API)".
- **Trash**: restore or permanently delete soft-deleted items.
- **Backups** (`backup.ts`): download a `.tar.gz` of every content table as
  JSON plus every image. Restore replaces all content. Admin users, sessions
  and logs are **never** included. This is also how content moves between
  installs (local → live).
- **API Access + Content API** (`app/api/v1`, `server/api/`): Bearer keys
  (`<prefix>_` + 40 random chars, only the SHA-256 is stored) that act as the
  admin who created them, with that person's role. `GET /api/v1` describes
  every type, its fields, and the live choices. `POST` creates drafts unless
  `"status":"published"` is sent. Rich text accepts Markdown, and images accept
  a URL (downloaded into the media library). Document it in `CONTENT_API.md`.

### 3.9 Security headers: `next.config.ts`
`poweredByHeader: false`; `nosniff`, `Referrer-Policy`,
`X-Frame-Options`, `Permissions-Policy`; and in production a strict CSP
(`'self'` plus only the third parties the site needs, e.g. YouTube) and HSTS.
`/admin/*` additionally gets `noindex`, `X-Frame-Options: DENY`, and
`Cache-Control: no-store`. Old URLs from the previous site go in
`redirects()` as **301s**. Also set:

```ts
experimental: { cpus: 2, serverActions: { bodySizeLimit: "4mb" } },
serverExternalPackages: ["sharp", "mysql2"],
images: { formats: ["image/avif", "image/webp"] },
```

`cpus: 2` matters. Hostinger reports dozens of cores, and one build worker per
core runs the shared plan out of memory.

### 3.10 Admin UI
`components/admin/Shell.tsx`: a sidebar grouped by content area (a drawer on
phones), a top bar with the user and sign-out, and items hidden by
capability. Shared primitives are in `components/admin/ui.tsx` and
`client.tsx`. The admin uses the site's own design tokens (sand background,
UI font) plus `app/admin/admin.css` for the shell and editor. It's clean,
calm and form-first, and must work on a phone.

---

## 4. Hosting on Hostinger

1. **MySQL database:** hPanel → Databases → MySQL Databases. Create the database
   and a user with a strong password, and note the full `u123456789_…` names.
2. **Node.js app:** hPanel → Websites → Add website → Node.js app. Connect the
   GitHub repo (branch `main`), and set Node **22**, build `npm run build`,
   start `npm start`, root = repository root.
3. **Environment variables**, in the app's settings:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SITE_URL` | `https://<domain>`. Read at **build** time, so redeploy after changing it |
   | `DB_HOST` | `127.0.0.1` (preferred over `localhost` for Node on Hostinger) |
   | `DB_PORT` | `3306` |
   | `DB_NAME`, `DB_USER`, `DB_PASSWORD` | from step 1 |
   | `UPLOAD_DIR` | absolute path **outside** the app folder, e.g. `/home/u123456789/<site>-uploads` |
   | `ADMIN_SETUP_KEY` | long random phrase. Remove after the first admin exists |
   | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. Keeps admin forms working across redeploys |

4. **Deploy.** Tables are created on first start.
5. Open `https://<site>/admin`, go to `/admin/setup`, enter the setup key, and
   create the super admin.
6. **Move the domain over** (if an old WordPress site has it): back up the old
   site, delete that website in hPanel (the domain and email stay), use
   **Change domain** on the Node.js app, install SSL for both apex and `www`,
   set `NEXT_PUBLIC_SITE_URL`, and redeploy.

Everyday use: **content** is edited in `/admin` (live at once). **Code** is
pushed to GitHub (Hostinger rebuilds, and content is untouched). Download a
backup before big changes.

---

## 5. Build order for the new site

Do this in phases, and check each one works before starting the next.

1. **Study the existing site.** Crawl it, list every page and URL, and decide
   the content types (e.g. posts, programs, team, partners, events, gallery),
   the settings, and the editable copy per page. Record the old URL → new URL
   map for the 301s. Write decisions in `NOTES.md`.
2. **Scaffold** Next.js 16 + TypeScript + Tailwind v4 at the repo root. Add
   `.nvmrc`, `engines`, `.env.example`, a `.gitignore` covering `.env*` and
   `storage/`, `next.config.ts` (section 3.9), and the design tokens in
   `globals.css` for the new brand.
3. **Server foundation:** copy `env.ts`, `db.ts`, `migrate.ts`, `cache.ts`,
   `request.ts`, `instrumentation*.ts`, `bundle-migrations.mjs`, and the
   `prebuild` script. Write `001_initial.sql` with the system tables (copied)
   plus this site's content tables, following the conventions in 3.2.
4. **Auth:** copy `auth/*`, `proxy.ts`, `admin/guard.ts`, `admin/origin.ts`,
   `activity.ts`, and the login/setup pages. **Rename** the cookie
   (`fesp_admin` → `<site>_admin`), the API token prefix, the migration lock
   name, and the common-password list entries.
5. **Admin shell + generic engine:** copy `components/admin/*`,
   `admin-fields.ts`, `resources.ts` (rewritten for this site's types),
   `save.ts`, `validate.ts`, `trash.ts`, and the `content/[resource]` pages.
6. **Media:** `media.ts`, `media-refs.ts`, `media-usage.ts`, the upload
   route, the uploads route, and the media library page.
7. **Settings, Page Content blocks, Navigation, Page builder:** adapt the
   defaults and section types to the new site.
8. **Public site:** build pages from the new design, reading only through
   `content.ts`, `getPageCopy`, and settings. Keep strings out of components.
9. **Messages, newsletter, users, activity, trash, backups, Content API,** plus `CONTENT_API.md`.
10. **Hardening and quality:** security headers, 301s, `robots.ts`,
    `sitemap.ts`, JSON-LD, accessibility (one `<h1>` per page, visible focus,
    `prefers-reduced-motion`, real alt text, AA contrast, no horizontal scroll
    from 320px to 1920px, 24px+ touch targets), `npm run typecheck`, `npm run lint`, and a clean `npm run build`.
11. **Deploy** per section 4, then bring content in (Content API or admin), and switch the domain.

### Rules that made the FES build work
- One `ResourceDef` per content type. Don't hand-build CRUD screens.
- Every editable string and setting has a default in code, so an empty
  database still renders a complete site.
- Drafts by default. Soft delete everywhere. Log every write.
- Capabilities, not role names. Re-check on the server for every action.
- No secrets in git. No images in git. No values interpolated into SQL.
- The build never touches the database. Migrations run at start.
- Copy files from the reference repo rather than rewriting them, and adapt names and branding.
