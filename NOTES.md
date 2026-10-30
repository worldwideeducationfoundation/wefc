# NOTES — WEF Canada rebuild

Running log of decisions for rebuilding wefcanada.org as a self-hosted
Next.js site + admin, following `ADMIN_BLUEPRINT.md`. Newest phase last.
Blueprint sections are referenced as `§`.

Reference implementation: `../fesp-reference` (clone of
`worldwideeducationfoundation/fesp`, `main` @ `d027111`). Read-only.

---

## Phase 1 — study of the current site

### What runs today

| Piece | Today | After the rebuild |
|---|---|---|
| Pages | Hand-written HTML + Vite, static on Hostinger | Next.js 16 app on Hostinger Node.js |
| Articles, topics, team | Sanity (`pvj2zu1w`), rendered to HTML at build time by `scripts/sanity-sync.mjs`, published via a GitHub Action | MySQL, edited in `/admin`, live immediately |
| Contact form, newsletter | Supabase (anon insert, RLS) | `submissions`, `newsletter_subscribers` tables |
| Learning-centers map | `public/content/maps/centers-data.js`, generated from `MAP-1.gpkg` (88 geocoded of 97 rows) | `learning_centers` table |
| Images | `public/content/uploads/wef/` (in git) + `cdn.sanity.io` | Media library in `UPLOAD_DIR`, WebP |
| Giving | Donorbox embeds (form, progress meter, donor wall) | Unchanged; campaign is a setting |
| Headers, redirects | `public/.htaccess` | `next.config.ts` (§3.9) |

Sanity, Supabase, the sync workflow, `studio-wef-canada-blog/` and the empty
`nextjs-wef-canada-blog/` stub all retire once content is moved.

### Every public URL (39 in the live sitemap, plus 404)

| Page | Current URL | Built from |
|---|---|---|
| Home | `/` | hand-written |
| Our Mission | `/pages/mission` | hand-written |
| Our Team | `/team/` | hand-written (3 co-founders, bio modal) |
| Learning Centers Map | `/pages/centers` | hand-written + `centers-data.js` |
| Gallery | `/pages/gallery` | hand-written, 22 photos, 6 filter categories |
| Contact | `/pages/contact` | hand-written + Supabase form |
| Ways to Give | `/donate/` | hand-written + Donorbox, 6 FAQs |
| Active Projects (list) | `/pages/active-projects` | hero hand-written, cards from Sanity |
| Project Updates (list) | `/pages/project-updates` | same |
| Success Stories (list) | `/pages/success-stories` | same |
| Project (×5) | `/pages/projects/{slug}` | Sanity post, type *Active Project* |
| Update (×13) | `/pages/updates/{slug}` | Sanity post, type *Project Update* |
| Story (×4) | `/pages/stories/{slug}` | Sanity post, type *Success Story* |
| Topic (×8) | `/pages/topics/{slug}` | Sanity category |

Header menu: Home · What We Do (Our Mission, Active Projects, Learning Centers
Map) · Impact (Project Updates, Success Stories, Gallery) · About (Our Team,
Contact Us) · Ways to Give. Footer: Explore / Get Involved / Contact columns.

---

### Proposed content types (one `ResourceDef` each, §3.4)

Group = sidebar group in the admin.

| Key | Table | Group | Count today | Fields (beyond the standard columns) | Shows on |
|---|---|---|---|---|---|
| `posts` | `posts` | Stories | 22 | `kind` (update / story / project), title, card_title, slug, excerpt, image, body (rich text, incl. inline images and the **stat strip**), author_id, categories (relation), published_at, date_label, location, featured, CTA (heading, text, primary label+URL, secondary label+URL), seo_title, seo_description | `/updates/…`, `/stories/…`, `/projects/…`, the three list pages, topic pages |
| `categories` | `categories` | Stories | 8 | title, slug, description; drag-ordered | `/topics/{slug}`, filter chips on list pages |
| `authors` | `authors` | Stories | few | name, slug, role, photo, bio | article byline |
| `programs` | `programs` | Programs | ~11 | title, short_title, summary, image, **placements** (Home photo strip / Home programs / Mission), optional link to a project post | Home "From a first classroom…", Home "Pathways out of generational poverty", Mission "How we turn opportunity into outcomes" |
| `stats` | `stats` | Programs | 8 | value, label, note, placements (Home impact counters / Mission at-a-glance), as_of | Home counters (100 / 3,000 / 200 / 66+), Mission glance (9 / 100+ / 3,000+ / 66) |
| `learning-centers` | `learning_centers` | Programs | 88 (+9 without coordinates) | name (lead teacher), village, region, model (select), sponsor, enrollment, lat, lon | `/centers` map and list, Home map band |
| `hero-slides` | `hero_slides` | Website | 7 | image, caption | Home hero |
| `testimonials` | `testimonials` | Website | 1 | quote, name, role, location, photo, link to post | Home "The difference your support makes" |
| `faqs` | `faqs` | Website | 6 | question, answer (rich text) | `/donate` "Before you give" |
| `team` | `team_members` | People | 3 | name, role, group, photo, bio, LinkedIn/Facebook/Instagram/X | `/team` |
| `team-groups` | `team_groups` | People | 1 used (Co-Founders); Sanity also defines Advisory Board, Chitral Field Team | heading | `/team` |
| `gallery` | `gallery_items` | Media | 22 | image, caption, gallery category | `/gallery` |
| `gallery-categories` | `gallery_categories` | Media | 6 | label | `/gallery` filter chips |

Dropped from the FES set: `milestones`, `partners`, `videos`, `locations`
(WEFC has no timeline, partner list or video page; its "locations" are the
learning centers above). Supporters are Donorbox's donor wall, not a type.

**Why posts stay one type with a `kind`:** that is the Sanity model today
(one schema, `postType` decides URL and listing), all three kinds share the
same article template, and it makes the import a 1:1 field mapping.

**Why programs are separate from project posts:** the program cards on Home
and Mission are a catalogue of ~11 short items, only 5 of which have a
long-form project page. A card can link to its project post when there is one.

### Settings (§3.5, each with a default)

- **Identity:** name "Worldwide Education Fund Canada", short name "WEF Canada",
  tagline "Investing in Minds & Empowering Futures", description,
  charity registration "709257208".
- **Contact:** email info@wefcanada.org, phone +1 (214) 502-8388, address
  4423 White Mud Road, Edmonton, Alberta, T6H 5W7, contact-form topics
  (General enquiry, Supporting a program, Volunteering, Partnership,
  Donation question, Media & press).
- **Social:** Facebook, Instagram, LinkedIn, X, YouTube (current URLs as defaults).
- **Giving:** Donorbox campaign slug
  (`bright-beginnings-early-childhood-learning-centers-eclcs`), cheque
  mailing instructions.

### Editable page copy (`getPageCopy`, §3.5)

| Page | Blocks |
|---|---|
| organisation (shared) | Vision, Mission, Belief (used on Home and Mission) |
| footer | blurb, column headings |
| home | hero intro (h1, lead, buttons); photo-strip heading; tagline band; featured brochure (heading, text, **PDF**); featured scholarship (heading, text, image); reach (heading + 4 regions: Canada, Chitral, Khorog, Bishkek); programs heading; values (4 × title/text); stories heading; impact heading; donate band; centers band; newsletter; section toggles + order |
| mission | hero, glance heading, projects heading, transparency ("Every dollar reaches the field") |
| team | hero, CTA |
| centers | hero, map heading, CTA |
| gallery | hero |
| contact | hero, intro, form intro, "Worked with us before?" |
| donate | hero, "Where your gift goes" (4 items), FAQ heading, supporters heading |
| updates / stories / projects lists | hero, section heading, CTA band |
| 404 | heading, text |

---

### Proposed URL map (301s in `next.config.ts`)

Recommend dropping the `/pages/` prefix, which is an artefact of the Vite
folder layout. Every old URL, with or without `.html` or a trailing slash,
301s to its new one.

| Old | New |
|---|---|
| `/pages/mission` | `/mission` |
| `/pages/centers` | `/centers` |
| `/pages/gallery` | `/gallery` |
| `/pages/contact` | `/contact` |
| `/pages/active-projects` | `/projects` |
| `/pages/project-updates` | `/updates` |
| `/pages/success-stories` | `/stories` |
| `/pages/projects/:slug` | `/projects/:slug` |
| `/pages/updates/:slug` | `/updates/:slug` |
| `/pages/stories/:slug` | `/stories/:slug` |
| `/pages/topics/:slug` | `/topics/:slug` |
| `/team/`, `/donate/` | `/team`, `/donate` (unchanged apart from the slash) |

Carried over from `.htaccess`: the three `/blog/{post}` → project 301s,
`/blog` and `/blog/category/*` → `/updates`, all other `/blog/*` → **410**
(a route handler, since `redirects()` cannot return 410), and www → apex.

Old image URLs under `/content/uploads/wef/*` will 404 once images move to
the media library. They are not linked from anywhere; acceptable.

---

### Deviations from the blueprint to agree

1. **PDF in the media library.** The home page embeds the ECLC brochure PDF.
   §3.6 only accepts images (sharp re-encodes everything). Proposal: allow
   PDF as a second media kind: magic-byte check, size cap, stored under a
   random name, served with `Content-Disposition: inline` and
   `CSP: sandbox`. Alternative: keep the one PDF as a static file in
   `public/`.
2. **Leaflet** is loaded from unpkg today. Bundle it from npm instead, so CSP
   needs only the tile hosts (`*.tile.openstreetmap.org`,
   `server.arcgisonline.com`). `chitral_border.geojson` stays in the repo as
   a static asset (geometry, not content).
3. **Stat strip inside rich text.** Needs a small custom Tiptap node, since
   Sanity articles embed 1–4 figure strips mid-body. Markdown import via the
   Content API needs a syntax for it.
4. **Content migration** comes from Sanity (posts, categories, authors, team)
   via a one-off script into the Content API, from `centers-data.js` for the
   map, from the static HTML for programs/FAQs/gallery, and from Supabase
   for existing messages and subscribers (CSV export → import).

---

## Phases 2–10 — built (branch `rebuild`)

Decisions taken without waiting, all reversible:

- **Branch, not main.** The app lives on `rebuild`; the old site is in
  `legacy/`. `main` still deploys the old static site.
- **Clean URLs** (`/mission`, `/updates/…`) with 301s from every `/pages/…`
  address, `.html` variants included. `/blog/*` keeps its 301s and 410.
- **PDF in the media library.** The ECLC brochure is a media item (stored as
  is after a `%PDF-` signature check, served inline, frameable only by the site).
- **Design kept exactly.** The old stylesheets are reused: each page's inline
  styles were scoped to a wrapper class (`scripts/legacy/scope-css.mjs` →
  `src/styles/pages/*.css`). Side-by-side screenshots at 1440px match the old
  site to within a few pixels of page height on every page.
- **Program cards** are one type with a placement (home photo strip, home
  programs, Mission). Mission cards hold "columns" (Where/Who/Impact…) and can
  have expandable tracks (the two scholarship programs).
- **Figures inside articles** are a `statStrip` rich-text node, with an editor
  block ("Figures") so project posts round-trip without loss (tested).
- **Fonts self-hosted** (`src/app/fonts`, Fraunces with its opsz axis + Jost).
  next/font/google failed the production build here; local files also mean
  the Hostinger build never needs Google. The admin uses the same two faces.
- Donorbox stays as iframes plus its `widget.js` resizer (CSP allows it).
- The reach map's place labels are part of the SVG drawing, not page copy.

Content import: `scripts/legacy/` (export-sanity, export-static,
import-content). Result: `storage/export/wefc-content-backup.tar.gz` —
22 posts, 8 topics, 25 program cards, 11 figures, 88 centers, 7 slides,
22 gallery photos, 3 team members, 6 FAQs, menus, 106 media files.
Restore tested through Admin → Backups. Supabase messages/subscribers were
not migrated (anon key cannot read them).
