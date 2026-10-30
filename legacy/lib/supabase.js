import { createClient } from '@supabase/supabase-js';

/**
 * Shared Supabase browser client.
 *
 * Credentials come from build-time env vars, mapped onto `import.meta.env` in
 * vite.config.js — see the `define` block there, which is also the reason only
 * these two names ever reach the bundle.
 *
 * The literals below are the fallback when those vars are absent from the build
 * environment. Hostinger's Supabase integration is documented as injecting them
 * automatically, but the deployed bundle came out with both values empty, which
 * silently disabled every form on the live site. Committing the public
 * credentials means a deploy cannot quietly lose the database again.
 *
 * This is safe: the key is the PUBLISHABLE key, which is designed to ship in
 * browser code, and everything it can reach is constrained by Row Level
 * Security — verified to block reads, updates and deletes on both tables (see
 * supabase/schema.sql). A service-role key must NEVER appear here.
 */
const SUPABASE_URL =
  import.meta.env.SUPABASE_URL || 'https://jgvfjqqvljmfsqlezovf.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.SUPABASE_ANON_KEY || 'sb_publishable_44Yeqto6EF6zfcrAKmtXTg_Ro0Bss31';

/** False on a build where the env vars were not present (e.g. local dev without .env). */
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

export const supabase = isSupabaseConfigured
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
  : null;

/** Table names in one place so a rename is a one-line change. */
export const TABLES = {
  contactMessages: 'contact_messages',
  newsletterSubscribers: 'newsletter_subscribers',
};

/**
 * Add someone to the newsletter list. Idempotent: re-subscribing an existing
 * address updates it instead of failing.
 *
 * Uses the `subscribe_to_newsletter` RPC from schema.sql when it exists, and
 * falls back to a plain insert (treating a duplicate as success) so the form
 * still works on a project where only the tables were created.
 */
export async function subscribeToNewsletter({ email, name = null, source = null, pageUrl = null }) {
  if (!supabase) throw new Error('Supabase is not configured');

  const { error } = await supabase.rpc('subscribe_to_newsletter', {
    p_email: email,
    p_name: name,
    p_source: source,
    p_page_url: pageUrl,
  });

  if (!error) return;

  // PGRST202 = the function does not exist on this project.
  if (error.code !== 'PGRST202') throw error;

  const { error: insertError } = await supabase
    .from(TABLES.newsletterSubscribers)
    .insert({ email: email.toLowerCase(), name, source, page_url: pageUrl });

  // 23505 = unique violation, i.e. already on the list. Not an error for the visitor.
  if (insertError && insertError.code !== '23505') throw insertError;
}

/** Save a contact-form enquiry. */
export async function saveContactMessage(record) {
  if (!supabase) throw new Error('Supabase is not configured');
  const { error } = await supabase.from(TABLES.contactMessages).insert(record);
  if (error) throw error;
}
