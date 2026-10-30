# Deploying the WEF Canada website and admin on Hostinger

The website and its admin are one Next.js app. **Code** lives in GitHub;
**content and images** live on Hostinger (a MySQL database and a folder on the
server). Pushing to GitHub updates the code; editing in `/admin` updates the
content — the two never overwrite each other.

```
GitHub (code)  ──push──►  Hostinger Node.js app  ──►  MySQL database   (all text, settings, menus)
                                                  └─►  UPLOAD_DIR folder (all images and the brochure PDF)
```

## First deployment

1. **Create the database.** hPanel → Databases → MySQL Databases. Create a
   database and a user with a strong password. Note the full names
   (e.g. `u123456789_wefc`).

2. **Create the Node.js app** (hPanel → Websites → Add website → Node.js app).
   Connect the GitHub repository `worldwideeducationfoundation/wefc` and choose:
   - Branch: the branch with this app (`rebuild` until it is merged to `main`)
   - Node version: **22**
   - Build command: `npm run build`
   - Start command: `npm start`
   - Root: the repository root

   Use a temporary address first. The current wefcanada.org website keeps
   running until the domain is moved in step 8.

3. **Environment variables** (in the app's settings). See `.env.example`:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_SITE_URL` | the temporary address for now; `https://wefcanada.org` after step 8. Read at build time, so redeploy after changing it |
   | `DB_HOST` | `127.0.0.1` |
   | `DB_PORT` | `3306` |
   | `DB_NAME`, `DB_USER`, `DB_PASSWORD` | from step 1 |
   | `UPLOAD_DIR` | a folder **outside** the app, e.g. `/home/u123456789/wefc-uploads` |
   | `ADMIN_SETUP_KEY` | any long random phrase |
   | `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` — keeps admin forms working across redeploys |

   `UPLOAD_DIR` matters: if images were stored inside the app's folder, a
   redeploy could replace that folder. The admin dashboard warns if it is
   not set.

4. **Deploy.** On start the app creates all database tables by itself
   (`db/migrations/`). Nothing needs importing in phpMyAdmin.

5. **Create your admin account.** Open `https://<your-site>/admin`. It sends
   you to `/admin/setup`: enter the `ADMIN_SETUP_KEY`, your name, email and a
   password (12+ characters).

6. **Bring the content in.** Admin → **Backups** → **Restore**, choose
   `wefc-content-backup.tar.gz` (made from the old site; see "Where the
   content came from" below), type `RESTORE` and confirm. It loads every
   post, topic, program card, figure, learning center, team member, gallery
   photo, FAQ, menu and image in one go. Admin accounts are not touched.

7. Check the site, add other people under **Users & Roles**, and remove
   `ADMIN_SETUP_KEY` from the environment variables.

8. **Move the domain.** The old static site serves wefcanada.org today.
   Once the new app checks out: in hPanel, move `wefcanada.org` to the
   Node.js app (back up and then delete the old static website; the domain
   and email stay), install SSL for `wefcanada.org` and `www.wefcanada.org`,
   set `NEXT_PUBLIC_SITE_URL=https://wefcanada.org` and redeploy. Every old
   `/pages/...` address 301-redirects to its new one (`next.config.ts`).

## Where the content came from

`scripts/legacy/` holds the one-off importer. It read the old site's Sanity
project (posts, topics, author and their images) and the hand-written pages
in `legacy/` (program cards, figures, map centers, team, gallery, FAQs),
loaded them into a local database exactly as the admin would store them, and
wrote the backup file. It is kept for reference; content is now edited in
`/admin`.

Not migrated: contact-form messages and newsletter sign-ups that the old site
stored in **Supabase**. Export them from the Supabase dashboard (Table Editor
→ `contact_messages`, `newsletter_subscribers` → Export CSV) if you want to
keep them.

## Everyday use

- **Content** (text, images, pages, menus, posts): edit in `/admin`. Changes
  are live immediately — no push, no rebuild.
- **Code** (design, new features): push to GitHub; Hostinger rebuilds. Content
  and images are unaffected. If a change adds a file to `db/migrations/`, the
  database is updated automatically on the next start.
- **Backups**: Admin → Backups → Download, before big changes and regularly.

## Running it locally

1. Install MySQL or MariaDB and create an empty database.
2. Copy `.env.example` to `.env.local` and fill in the database details and an
   `ADMIN_SETUP_KEY` (leave `UPLOAD_DIR` empty to use `./storage/uploads`).
3. `npm install`, then `npm run dev`, and open http://localhost:3000/admin.
4. To get the live content locally: download a backup from the live admin and
   restore it in the local one.

## Where things are in the code

| Path | What |
|---|---|
| `db/migrations/` | Database schema, applied automatically in order |
| `src/server/` | Everything that touches the database: content reads (`content.ts`), editable page copy (`blocks.ts`), settings, media storage, auth |
| `src/server/admin/resources.ts` | The content types the admin manages — adding a field or a type starts here |
| `src/app/(site)/` | The public website |
| `src/styles/` | The old site's stylesheets; `pages/*.css` are generated per page by `scripts/legacy/scope-css.mjs` |
| `src/app/admin/` | The admin |
| `src/app/api/v1/` and `CONTENT_API.md` | The Content API, for adding content from Claude or other tools |
| `legacy/` | The old static site, for reference only |
