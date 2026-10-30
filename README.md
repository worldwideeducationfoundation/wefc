# Worldwide Education Fund Canada

Website and admin for **wefcanada.org** — a registered Canadian charity
(709257208) running early childhood learning centers, teacher training and
scholarships in Chitral, Pakistan and Central Asia.

Next.js 16 (App Router, RSC, TypeScript). The public pages keep the old
static site's design and stylesheets (`src/styles/`); the admin uses
Tailwind CSS v4. Built from `ADMIN_BLUEPRINT.md`.

All content is managed in the built-in admin at **`/admin`** and stored in
MySQL; uploaded images are stored on the server (`UPLOAD_DIR`), never in
git. See **`DEPLOYMENT.md`** for how it runs on Hostinger.

---

## Repository layout

```
.                        ← Next.js app (this is the deploy root)
├── db/migrations/       database schema, applied automatically on start
├── src/
│   ├── app/(site)/      the public website
│   ├── app/admin/       the admin
│   ├── components/      shared UI (components/admin/ for the admin)
│   ├── lib/             shared types and helpers
│   └── server/          database, content reads, auth, media, Content API
├── public/brand/        logo and favicon
├── legacy/              the old static site, for reference only
└── scripts/             build + audit tooling
```

The Next.js app is at the repository root **on purpose** so the host
builds from the root with no subdirectory configuration. See `NOTES.md`.

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
| `node scripts/audit.mjs` | Accessibility / contrast / structure gate — **server must be running** |
| `node scripts/shoot.mjs` | Screenshot key routes at 360 / 1440 |
| `node scripts/build-brand-assets.mjs` | Regenerate logo SVGs from the source PNG |

---

## Environment variables

See `.env.example` for the full list with explanations. Never commit real
values — `.gitignore` covers `.env*`.

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Canonical origin. Defaults to `https://wefcanada.org` |
| `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` | The MySQL database (or one `DATABASE_URL`) |
| `UPLOAD_DIR` | Where uploaded images are stored — outside the app folder in production |
| `ADMIN_SETUP_KEY` | Required to create the first admin account at `/admin/setup` |

---

## Deployment

Hosted on Hostinger as a Node.js app that deploys from GitHub. Step-by-step
instructions, including the first-run setup and content import, are in
**`DEPLOYMENT.md`**.

## Accessibility

Non-negotiable, enforced by `scripts/audit.mjs`:

- Pinch-zoom is never disabled — no `maximum-scale`, no `user-scalable=0`
- Exactly one `<h1>` per page; heading levels never skip
- Visible focus on every interactive element
- `prefers-reduced-motion` respected by both marquees
- Real alt text on every image
- Contrast measured against the palette rules in `NOTES.md`

**Lime `#9EC009` is a surface colour, never text on a light background**
(2.1:1). The only approved text-on-lime pairing is forest `#0F2E22` at
7.0:1. `ActionLink`'s `primary` variant is the only lime button, and it
is rationed to one per page.

Also enforced: no horizontal overflow on **any route at any of 11 real
device widths** (320 → 1920), and every control at least 24×24 CSS px
on a phone (WCAG 2.5.8).

The landing carousel auto-advances every second, so it carries a pause
button, stops on hover and focus, and does not move at all under
`prefers-reduced-motion` (WCAG 2.2.2). The gate asserts each of those.

Current gate results: 12 routes, 0 axe violations, 131 text nodes
measured, tightest contrast 6.4:1, no overflow at any width.
