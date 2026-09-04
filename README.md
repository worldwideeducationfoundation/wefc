# Worldwide Education Fund Canada

Static site built with Vite. Every page is hand-written HTML except the article
and topic pages, which are generated from Sanity at build time.

---

## How content flows

```
Sanity Studio  ──(npm run sanity:sync)──>  pages/*.html  ──(vite build)──>  dist/
   pvj2zu1w                                  committed                     deployed
```

`npm run build` runs the sync first, so a deploy always renders whatever is
published in Sanity at that moment.

**These files are generated. Edit the post in Sanity, not the HTML:**

| Generated | From |
| --- | --- |
| `pages/updates/*.html` | posts with type *Project Update* |
| `pages/stories/*.html` | posts with type *Success Story* |
| `pages/projects/*.html` | posts with type *Active Project* |
| `pages/topics/*.html` | one page per category that has posts |
| the card grid + filter chips in the three listing pages | the matching posts, newest first |

Everything else on the listing pages — hero copy, their own CTA — is still
hand-edited. Only the regions between the `<!-- sanity:cards:… -->` and
`<!-- sanity:filters:… -->` markers get rewritten.

Article images are served from the Sanity CDN, sized per request
(`?auto=format&fit=max&w=…`). Only the logo, favicon and non-article page
imagery still live in `public/content/uploads/`.

### Publishing a change

```bash
npm run studio:dev     # edit at http://localhost:3333
npm run sanity:sync    # re-render the pages
git commit && git push # deploy picks it up
```

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Vite dev server (does **not** re-sync) |
| `npm run build` | sync from Sanity, then build to `dist/` |
| `npm run sanity:sync` | re-render article, topic and listing pages |
| `npm run sanity:check` | fail if the committed pages are stale (for CI) |
| `npm run sanity:import` | the one-time migration; refuses to re-run |
| `npm run verify:live` | check the **deployed** site is serving the Sanity build |
| `npm run studio:dev` / `studio:deploy` | run / publish the Studio |

---

## Environment

Copy `.env.example` to `.env.local`. The same four variables must be set in
Hostinger's build environment:

```
SANITY_PROJECT_ID=pvj2zu1w
SANITY_DATASET=production
SANITY_API_VERSION=2026-07-08
SANITY_API_TOKEN=<Viewer token>
```

**The token is required at build time.** Posts, authors and categories in this
project are not publicly readable — an unauthenticated query *succeeds and
returns nothing* rather than erroring, which is why the sync script fails loudly
on an empty result instead of shipping an empty site. Image assets *are* public,
so `cdn.sanity.io` images work without a token.

Use a **Viewer** token. A build environment never needs write access.

The token has no `VITE_` prefix and `vite.config.js` inlines only
`SUPABASE_URL` / `SUPABASE_API_KEY`, so it cannot reach the browser bundle.

---

## Verifying a deploy

The pages are static HTML by design, so "it looks static" tells you nothing.
Three fingerprints do, none of which exist in a pre-migration build:

1. `<meta name="content-source" content="sanity:pvj2zu1w/production">`
2. images from `cdn.sanity.io` rather than `/content/uploads/`
3. the category filter chips

```bash
npm run verify:live                          # checks wefcanada.org
npm run verify:live -- http://localhost:4173 # checks a local preview
```

It exits non-zero and names what is missing. If it fails, the deploy is stale or
its build failed — check the build log for `posts and categories synced`.

---

## What changed (week of 2026-09-01)

### 1. Articles moved from static HTML into Sanity

22 pages (13 updates, 4 stories, 5 projects) were hand-maintained HTML.
Publishing anything meant a developer editing markup. They are now Sanity
documents rendered back to static HTML at build time — the team publishes from
the Studio, and the site keeps its static hosting and SEO.

One `post` type covers all three kinds. They already shared a single
hero/article/CTA template, so three schemas would only have duplicated fields;
`postType` picks the URL prefix, hero eyebrow and listing page. Categories, the
author, the CTA band and the project stat strips are modelled rather than baked
into markup.

`scripts/sanity-import.mjs` did the migration: it parsed the old markup into
Portable Text and uploaded ~40 images as Sanity assets. It refuses to run
against its own output, so it can only ever re-run against the original pages
from an earlier commit.

Verified: all 22 article bodies and all listing cards round-trip identical to
the originals, with two deliberate exceptions noted under *Known gaps*.

### 2. Categories are real, and drive the site

8 categories in Sanity, every post tagged, each with a slug that **is** the URL:

`early-childhood-education`, `scholarships`, `higher-education`,
`teacher-training`, `learning-spaces`, `inclusive-education`, `philanthropy`,
`community-partnerships`

- Each gets a page at `/pages/topics/<slug>` listing everything tagged with it
  across all three post types.
- Listing pages show filter chips built from the categories actually present,
  with counts. Chips are real links to the topic page (crawlable, works without
  JS); `wef-filters.js` intercepts the click and filters in place, mirroring the
  choice into `?category=<slug>` so a filtered view is shareable.
- Rename a category in the Studio and the chip label changes; the slug is what
  ties chip to card, so nothing breaks.

Add a category in Sanity, tag a post, run sync — the page, the chips and the
sitemap entry all appear. No code change.

### 3. Repo cleanup

Removed 280 files, ~43 MB, none of it referenced by any page:

| Removed | Why |
| --- | --- |
| `public/content/plugins/**` (145 files) | WooCommerce, Elementor, Give, Metform, MegaMenu, JetSticky — WordPress-era leftovers. No page loads any of it. |
| `public/includes/**` (9 files) | Same: orphaned WP jQuery/dashicons. |
| `public/content/themes/**` (36 files) | Bootstrap, Font Awesome, `woocommerce.css`, `test-data.css`. Only six `wef-*.css/js` files are actually loaded, and they are self-contained (no `@import`, no `url()`). |
| 89 files in `uploads/wef` | Orphaned after the Sanity migration, plus WP stock imagery. |

Also removed the root `sanity/schemas/` copy and the unused Next.js scaffold,
both still pointing at the retired `wgy1a1gg` project.

`public/content/maps/` was left completely untouched — all 6 files.

The deployed `dist/` is now ~27 MB. Every asset reference in the built output
was checked against the filesystem: 470 references, 0 broken.

---

## Known gaps / what to improve next

**Ranked by what actually bites first.**

1. **Publishing still needs a rebuild.** An editor hits Publish in Sanity and
   nothing changes until someone runs a build. Fix: a Sanity webhook
   (Manage → API → Webhooks) pointing at a Hostinger deploy hook, so publishing
   triggers a rebuild. This is the single biggest remaining gap and it is
   mostly a dashboard task, not a code one.

2. **Images are not resized before upload.** Some originals are 4–6 MB
   (`IMG_3232.JPG` is 6 MB). Sanity's CDN resizes on request for article
   images, but the non-article pages still serve full-size originals straight
   from `public/`. Compressing those, or moving the rest of the site's imagery
   into Sanity too, is the next real performance win.

3. **`refresher-training-university-of-chitral` has an invented date.** The
   original static page showed no date at all; it was given `2026-07-10` to
   hold its position on the listing. Someone who knows should correct it.

4. **`dateLabel` is a blunt instrument.** Posts whose hero shows text rather
   than a date ("Ongoing", "Active Since 2026", "Undated") store that string
   and a separate sort date. It works, but a `showDate` boolean would be
   clearer than "empty string means render the date".

5. **The homepage is still fully hand-written.** It has its own hard-coded
   story cards that do not come from Sanity and can drift from the real posts.
   The `featured` boolean already exists on `post` for exactly this and is
   currently unused.

6. **No CI.** `npm run sanity:check` exists and is designed for it — it fails
   when the committed pages are out of date with Sanity. Nothing runs it.

7. **The five project pages picked up the fuller footer** the other 17 pages
   already had (they had been missing the "Project Updates" link). Intentional,
   but worth knowing if a diff looks surprising.

8. **`build/templates/*.html` were extracted from real pages** and carry a
   full copy of the page CSS each. If the site chrome changes, both templates
   need the same edit. Extracting the shared `<style>` block into a real
   stylesheet would remove that duplication.

---

## Layout

```
build/templates/article.html   article page template
build/templates/topic.html     category page template
build/seo.js                   sitemap + robots, walks dist/
scripts/sanity-sync.mjs        Sanity -> HTML (runs before every build)
scripts/sanity-import.mjs      one-time migration, now inert
scripts/sanity-env.mjs         .env loading + shared Sanity client
scripts/verify-live.mjs        is the deploy actually serving Sanity content?
studio-wef-canada-blog/        Sanity Studio (standalone)
```
