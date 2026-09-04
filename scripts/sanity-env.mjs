import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@sanity/client';

export const ROOT = path.resolve(fileURLToPath(new URL('..', import.meta.url)));

/**
 * Minimal .env reader.
 *
 * These scripts run from plain `node`, outside Vite, so `loadEnv` is not
 * available and there is no dotenv dependency in this project. Later files win
 * over earlier ones, and anything already in `process.env` (a CI or Vercel
 * build variable) always wins over a file, so deploys need no local file at
 * all.
 */
function loadEnvFiles(files = ['.env', '.env.local']) {
  for (const name of files) {
    const file = path.join(ROOT, name);
    if (!fs.existsSync(file)) continue;
    for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const eq = line.indexOf('=');
      if (eq === -1) continue;
      const key = line.slice(0, eq).trim();
      let value = line.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (process.env[key] === undefined) process.env[key] = value;
    }
  }
}

loadEnvFiles();

export const SANITY_PROJECT_ID =
  process.env.SANITY_PROJECT_ID || process.env.VITE_SANITY_PROJECT_ID || 'pvj2zu1w';
export const SANITY_DATASET =
  process.env.SANITY_DATASET || process.env.VITE_SANITY_DATASET || 'production';
export const SANITY_API_VERSION =
  process.env.SANITY_API_VERSION || process.env.VITE_SANITY_API_VERSION || '2026-07-08';
export const SANITY_API_TOKEN = process.env.SANITY_API_TOKEN || '';

/**
 * @param {{ write?: boolean }} [opts] `write: true` requires the editor token
 *   and bypasses the CDN so freshly written documents read back immediately.
 */
export function sanityClient({ write = false } = {}) {
  if (write && !SANITY_API_TOKEN) {
    throw new Error(
      'SANITY_API_TOKEN is not set. Add it to .env.local (see .env.example) before running a write script.'
    );
  }
  return createClient({
    projectId: SANITY_PROJECT_ID,
    dataset: SANITY_DATASET,
    apiVersion: SANITY_API_VERSION,
    token: SANITY_API_TOKEN || undefined,
    // The sync script must see the very latest published content, and the
    // import script reads back what it just wrote, so neither can use the CDN.
    useCdn: false,
  });
}
