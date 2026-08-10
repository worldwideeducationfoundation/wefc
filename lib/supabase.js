import { createClient } from '@supabase/supabase-js';

/**
 * Shared Supabase browser client.
 *
 * Credentials come from build-time env vars (Hostinger injects SUPABASE_URL and
 * SUPABASE_API_KEY automatically once the database is linked). They are mapped
 * onto `import.meta.env` explicitly in vite.config.js — see the `define` block
 * there, which is also the reason only these two names ever reach the bundle.
 *
 * The key here is the PUBLIC anon key and it ships in the JS bundle by design.
 * Everything it can touch is locked down by Row Level Security — see
 * supabase/schema.sql. Never put a service-role key in these variables.
 */
const SUPABASE_URL = import.meta.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.SUPABASE_ANON_KEY || '';

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
