# Worldwide Education Fund Canada

Static site built with Vite. Every page is plain HTML except the article pages,
which are generated from Sanity.

## Content in Sanity

All project updates, success stories and active-project pages live in the
**WEF Canada Blog** Sanity project (`pvj2zu1w`, dataset `production`). The
Studio is a separate app in [studio-wef-canada-blog/](studio-wef-canada-blog/).

These files are **generated** — edit the post in Sanity, not the HTML:

| Generated | From |
| --- | --- |
| `pages/updates/*.html` | posts with type *Project Update* |
| `pages/stories/*.html` | posts with type *Success Story* |
| `pages/projects/*.html` | posts with type *Active Project* |
| the card grid in `pages/project-updates.html`, `pages/success-stories.html`, `pages/active-projects.html` | the matching posts, newest first |

Everything else on those three listing pages — the hero copy, their own CTA —
is still hand-edited. Only the block between the `<!-- sanity:cards:start -->`
and `<!-- sanity:cards:end -->` markers is replaced.

Article images are served from the Sanity CDN, sized on request. The originals
still sit in `public/content/uploads/wef/` for the non-article pages.

### Publishing a change

```bash
npm run studio:dev     # open the Studio at http://localhost:3333
npm run sanity:sync    # re-render the pages from Sanity
```

`npm run build` runs the sync first, so a deploy always picks up the latest
published content. Commit the regenerated pages along with any other change.

`npm run sanity:check` fails if the committed pages are out of date with
Sanity — useful in CI.

### Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Vite dev server (does not re-sync) |
| `npm run build` | sync from Sanity, then build to `dist/` |
| `npm run sanity:sync` | re-render article pages and listing cards |
| `npm run sanity:check` | fail if the generated pages are stale |
| `npm run sanity:import` | the one-time migration from the old static pages |
| `npm run studio:dev` | run Sanity Studio locally |
| `npm run studio:deploy` | deploy the Studio to sanity.studio |

`sanity:import` is finished and will refuse to run against generated pages. It
only exists so the migration is reproducible from an earlier commit.

## Environment

Copy `.env.example` to `.env.local` and fill it in. The same four variables must
be set in the deploy host's build environment (Hostinger → the site's
environment variables), because the build queries Sanity.

**`SANITY_API_TOKEN` is required at build time.** Posts, authors and categories
in this project are not publicly readable — an unauthenticated query succeeds
but returns nothing — so a build without a token fails. A **Viewer** token is
enough; there is no reason to give a build environment write access. Create one
at <https://www.sanity.io/manage/project/pvj2zu1w/api#tokens>.

Image assets *are* public, so `cdn.sanity.io` images on the live site need no
token and keep working regardless.

The token deliberately carries no `VITE_` prefix, and `vite.config.js` inlines
only `SUPABASE_URL` and `SUPABASE_API_KEY`, so it can never reach the browser
bundle.

## Layout

```
build/templates/article.html   the article page template the sync fills in
scripts/sanity-sync.mjs        Sanity -> HTML renderer (runs before every build)
scripts/sanity-import.mjs      one-time static HTML -> Sanity migration
scripts/sanity-env.mjs         .env loading and the shared Sanity client
studio-wef-canada-blog/        Sanity Studio (standalone)
```
