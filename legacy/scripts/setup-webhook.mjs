/**
 * Creates the Sanity webhook that makes a publish reach the website.
 *
 * Publishing in the Studio changes nothing on a static site until a build
 * runs. This wires that up: Sanity calls GitHub, GitHub re-renders the pages
 * and pushes, Hostinger deploys the push.
 *
 *   Sanity publish -> repository_dispatch -> sync-content.yml -> git push -> Hostinger
 *
 * Run it once, from an account that administers the Sanity project. The API
 * token in .env.local is a robot with editor rights and CANNOT create
 * webhooks — this needs an admin token.
 *
 *   node scripts/setup-webhook.mjs --sanity-token <admin-token> --github-token <pat>
 *   node scripts/setup-webhook.mjs ... --dry-run
 *
 * Get an admin Sanity token: sanity.io/manage/project/pvj2zu1w/api#tokens
 *   (role: Administrator)
 * Get a GitHub PAT: github.com/settings/tokens
 *   fine-grained, this repo only, Contents: read & write
 */
import { SANITY_PROJECT_ID, SANITY_DATASET } from './sanity-env.mjs';

const REPO = 'worldwideeducationfoundation/wefc';
const HOOK_NAME = 'Rebuild site on publish';

function arg(name) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? '' : process.argv[i + 1];
}

const sanityToken = arg('sanity-token') || process.env.SANITY_ADMIN_TOKEN || '';
const githubToken = arg('github-token') || process.env.GITHUB_DISPATCH_TOKEN || '';
const dryRun = process.argv.includes('--dry-run');

if (!sanityToken || !githubToken) {
  console.error(
    'Usage: node scripts/setup-webhook.mjs --sanity-token <admin-token> --github-token <pat>\n\n' +
      'The token in .env.local will not work: it is a robot with editor rights and\n' +
      'cannot create webhooks. Create an Administrator token at\n' +
      `https://www.sanity.io/manage/project/${SANITY_PROJECT_ID}/api#tokens`
  );
  process.exit(1);
}

// Sanity posts this to GitHub, which turns it into a repository_dispatch event
// that .github/workflows/sync-content.yml listens for.
const hook = {
  name: HOOK_NAME,
  description:
    'Tells GitHub to re-render the site whenever a post or category is published.',
  url: `https://api.github.com/repos/${REPO}/dispatches`,
  on: ['create', 'update', 'delete'],
  // Only content that actually appears on the site. Drafts are excluded: a
  // draft is not published, so rebuilding for one would leak unpublished work.
  filter: '_type == "post" || _type == "category"',
  projection: '{"event_type": "sanity-publish"}',
  httpMethod: 'POST',
  apiVersion: 'v2021-03-25',
  includeDrafts: false,
  headers: {
    Authorization: `Bearer ${githubToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  },
  dataset: SANITY_DATASET,
};

const base = `https://api.sanity.io/v2021-10-14/hooks/projects/${SANITY_PROJECT_ID}`;
const auth = { Authorization: `Bearer ${sanityToken}`, 'Content-Type': 'application/json' };

const listed = await fetch(base, { headers: auth });
if (!listed.ok) {
  console.error(
    `Cannot list webhooks (HTTP ${listed.status}). ` +
      'The token is probably not an Administrator token.\n' +
      (await listed.text()).slice(0, 300)
  );
  process.exit(1);
}

const existing = (await listed.json()).find((h) => h.name === HOOK_NAME);

if (dryRun) {
  console.log(existing ? `Would update webhook ${existing.id}` : 'Would create webhook');
  console.log(JSON.stringify({ ...hook, headers: { Authorization: '<redacted>' } }, null, 2));
  process.exit(0);
}

const res = await fetch(existing ? `${base}/${existing.id}` : base, {
  method: existing ? 'PUT' : 'POST',
  headers: auth,
  body: JSON.stringify(hook),
});

if (!res.ok) {
  console.error(`Failed (HTTP ${res.status}): ${(await res.text()).slice(0, 400)}`);
  process.exit(1);
}

console.log(
  `${existing ? 'Updated' : 'Created'} the "${HOOK_NAME}" webhook on ` +
    `${SANITY_PROJECT_ID}/${SANITY_DATASET}.\n\n` +
    'Publishing a post in the Studio will now rebuild the site automatically.\n' +
    'Check it fired: https://www.sanity.io/manage/project/' +
    `${SANITY_PROJECT_ID}/api/webhooks`
);
