@AGENTS.md

# Website content (posts, projects, team, page texts)

Content lives in the live site's database, not in this repository. To add or
change content, use the Content API described in `CONTENT_API.md`, with
`WEFC_API_URL` and `WEFC_API_TOKEN` from `.env.local` (keys are created under
Admin → API Access). Read `GET $WEFC_API_URL` first for the live field list
and choices. Save as a draft unless the user asks for it to be published, and
report the `url` / `admin_url` of what was created.
