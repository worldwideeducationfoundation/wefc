# Content API

Add and update the website's content without the admin forms — from Claude, a
script, or any tool that can make HTTP requests. Everything goes through the
same checks as the admin, appears on the site immediately, and is recorded in
**Admin → Activity Log** marked "(API)".

## Access

1. In the admin, open **API Access** and create a key. It is shown once.
2. Put it where the tool can read it, e.g. in this project's `.env.local`
   (never committed):

   ```
   WEFC_API_URL=https://<site>/api/v1
   WEFC_API_TOKEN=wefc_…
   ```

3. Send it on every request: `Authorization: Bearer $WEFC_API_TOKEN`.

A key acts as the admin who created it, with that person's role. Revoke it
under API Access at any time.

`GET $WEFC_API_URL` describes everything live: each content type, its fields,
and the current choices (categories, authors, projects, team groups). **Start
there** rather than guessing field names.

## Content types

`posts` · `categories` · `authors` · `programs` (projects) · `stats` (figures &
ticker) · `hero-slides` · `testimonials` · `locations` · `team` · `team-groups` ·
`milestones` · `partners` · `gallery` · `videos`

| Request | Does |
|---|---|
| `GET /content/{type}?q=&status=&page=` | list (50 per page) |
| `POST /content/{type}` | create — a **draft** unless `"status": "published"` |
| `GET /content/{type}/{id}` | one item |
| `PATCH /content/{type}/{id}` | change only the fields sent |
| `DELETE /content/{type}/{id}` | move to Trash (restorable in the admin) |
| `POST /media` | add an image: `{"url", "alt", "caption"}` or multipart `files` |
| `GET /page-content/{page}` | a built-in page's texts (`home`, `about`, `contact`, …) |
| `PATCH /page-content/{page}` | `{"blocks": {"key": "text"}}`; `null` restores the original |

### Field values

- **Rich text** (`body`, a project's `description`/`impact`): Markdown, either
  as the field itself or in `<field>_markdown`.
- **Images**: a media id, or an image URL — it is downloaded into the media
  library. Inside Markdown: `![alt](https://… "caption")` or `![alt](media:12)`.
- **Choices** (author, section, category, team group, project): the id or the
  name exactly as the admin shows it, e.g. `"categories": ["Field Notes"]`.
- **Dates**: ISO 8601, e.g. `"2026-10-21T09:00:00Z"`. A future date keeps a
  post hidden until then.
- **Web address** (`slug`): optional on create — made from the title.

### Markdown in rich text

```
## Heading            ### Subheading
- bullet / 1. numbered
> quote
>>> A pull quote — Who said it
---                   (divider)
![alt](https://… "caption")
https://www.youtube.com/watch?v=…   (a video, on its own line)
**bold**  *italic*  [link](https://…)
```

## Examples

Publish a project update:

```bash
curl -X POST "$WEFC_API_URL/content/posts" \
  -H "Authorization: Bearer $WEFC_API_TOKEN" -H "Content-Type: application/json" \
  -d '{
    "title": "New learning center opens in Mastuj",
    "section": "update",
    "excerpt": "Thirty children started classes this week.",
    "image_media_id": "https://example.org/photo.jpg",
    "body_markdown": "## A new start\n\nThirty children…",
    "status": "published"
  }'
```

Add a team member to a group, with a photo:

```bash
curl -X POST "$WEFC_API_URL/content/team" -H "Authorization: Bearer $WEFC_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Ayesha Khan", "role": "ECD Teacher", "group_id": "Early Childhood Development Team",
       "image_media_id": "https://example.org/ayesha.jpg", "status": "published"}'
```

Change the home page introduction, and hide the partners section:

```bash
curl -X PATCH "$WEFC_API_URL/page-content/home" -H "Authorization: Bearer $WEFC_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"blocks": {"intro": "…", "show_partners": false}}'
```

Errors come back as JSON with a reason, and for invalid fields a `details`
object naming each field — the same messages the admin form would show.
