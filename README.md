# Worldwide Education Fund Canada

Website and admin for **wefcanada.org** — a registered Canadian charity
(709257208) running early childhood learning centers, teacher training and
scholarships in Chitral, Pakistan and Central Asia.

Next.js 16 (App Router, RSC, TypeScript). The public pages keep the old
static site's design and stylesheets (`src/styles/`); the admin uses
Tailwind CSS v4.

All content is managed in the built-in admin at **`/admin`** and stored in
MySQL; uploaded images are stored on the server (`UPLOAD_DIR`), never in
git. See **`DEPLOYMENT.md`** for how it runs on Hostinger and
**`CONTENT_API.md`** for adding content from scripts or Claude.

---

## Repository layout

```
.                        ← Next.js app (this is the deploy root)
├── db/migrations/       database schema, applied automatically on start
├── src/
│   ├── app/(site)/      the public website
│   ├── app/admin/       the admin
│   ├── app/api/v1/      the Content API
│   ├── components/      shared UI (components/admin/ for the admin)
│   ├── lib/             shared types and helpers
│   ├── server/          database, content reads, auth, media
│   └── styles/          the public site's stylesheets
├── public/              logo, favicon, social card
└── scripts/             build and audit tooling
```

The app sits at the repository root so the host builds it with no
subdirectory configuration.

---

## Local development

Requires Node `>=22.17.0 <23` (see `.nvmrc`) and a MySQL or MariaDB database.

```bash
npm install
cp .env.example .env.local     # fill in the database and ADMIN_SETUP_KEY
npm run dev                    # http://localhost:3000, admin at /admin
```

The first visit to `/admin` creates the tables, then asks you to create the
first admin account. To fill an empty copy with content, use Backups →
Restore with a backup downloaded from another copy.

### Scripts

| Command | Does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm start` | Serve the production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `node scripts/audit.mjs` | Quality gate over every page in the sitemap — set `BASE` to test the live site |

---

## Environment variables

See `.env.example` for the full list. Never commit real values —
`.gitignore` covers `.env*`.

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical origin. Defaults to `https://wefcanada.org` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | The MySQL database (or one `DATABASE_URL`) |
| `UPLOAD_DIR` | Where uploaded images are stored — outside the app folder in production |
| `ADMIN_SETUP_KEY` | Required to create the first admin account at `/admin/setup` |
| `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | Keeps admin forms working across redeploys |

---

## Deployment

Hosted on Hostinger as a Node.js app that deploys from GitHub. Step-by-step
instructions, including the first-run setup and content import, are in
**`DEPLOYMENT.md`**.

## Quality bar

Enforced by `scripts/audit.mjs` on every page in the sitemap:

- WCAG 2.1 AA (axe-core): no violations
- Exactly one `<h1>` per page; heading levels never skip; every image has alt text
- Pinch-zoom is never disabled
- No sideways scrolling on iPhone SE, iPhone 13, Pixel 7 or a 320px Android,
  in both WebKit (iOS Safari) and Chromium (Android)
- Every control at least 24×24 CSS px on a phone (WCAG 2.5.8), and no text
  under 12px
- Search: titles ≤65 and descriptions ≤165 characters, all unique, with a
  canonical URL and social image on every page

Images from the media library are served through Next's optimiser
(`src/lib/image.ts`) with a `srcset`, so phones download a copy sized for
their screen rather than the 2400px original.
