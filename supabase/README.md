# Supabase — form submissions

Everything a visitor submits on the site (contact enquiries, newsletter sign-ups)
is stored in Supabase.

## One-time setup

1. **Run the schema.** Supabase dashboard → SQL Editor → New query → paste all of
   [`schema.sql`](schema.sql) → Run. It creates the two tables, the Row Level
   Security policies, and the `subscribe_to_newsletter` function. Re-running it
   later is safe.
2. **Link the database to the app.** On Hostinger, connecting Supabase injects
   `SUPABASE_URL` and `SUPABASE_API_KEY` as build environment variables — no
   manual step. Anywhere else (Vercel, local), set those two yourself; see
   [`.env.example`](../.env.example).
3. **Deploy.** The next build picks the variables up.

Until the variables exist, forms stay usable: the contact form falls back to
opening the visitor's email app, so nothing is lost.

## Where the data lands

| Table | Filled by |
| --- | --- |
| `contact_messages` | The contact form at `/pages/contact` |
| `newsletter_subscribers` | The homepage newsletter band, and the "Keep me updated" opt-in on the contact form |

Read them in the Supabase dashboard → Table Editor. The website's anon key can
only **insert** into these tables — it cannot read a single row back, so
addresses and messages are never exposed to visitors.

## Adding a form to another page

No new JavaScript required.

```html
<link href="/content/themes/donexa/assets/css/wef-forms.css?v=1" rel="stylesheet" />

<form data-supabase-form="newsletter" data-source="mission page" novalidate>
  <label class="wef-field">
    <span>Email <span class="req">*</span></span>
    <input type="email" name="email" autocomplete="email" required />
  </label>
  <div class="wef-hp" aria-hidden="true">
    <label>Leave this field empty<input type="text" name="wef_hp" tabindex="-1" autocomplete="off" /></label>
  </div>
  <button class="btn wef-news-submit" type="submit">Subscribe</button>
  <p class="wef-form-status" data-form-status role="status"><span></span></p>
</form>

<script src="/lib/supabase-forms.js" type="module"></script>
```

Attributes understood by [`lib/supabase-forms.js`](../lib/supabase-forms.js):

- `data-supabase-form` — `newsletter` or `contact`. Picks the handler.
- `data-source` — label recorded with the row; defaults to the page path.
- `data-mailto-fallback` — email address to open if the database is unreachable.
- `data-success-message` — override the confirmation text.
- `data-form-status` — element that receives status text.
- `name="wef_hp"` — the honeypot. Keep it; bots fill it and are silently dropped.

A **new kind of form** means one table in `schema.sql` plus one entry in the
`HANDLERS` map in `lib/supabase-forms.js`.
