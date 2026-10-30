-- =============================================================================
-- Worldwide Education Fund Canada — Supabase schema
--
-- Run this once in the Supabase dashboard: SQL Editor → New query → paste →
-- Run. It is idempotent, so re-running it after an edit is safe.
--
-- Security model: the website is a static site, so it talks to Supabase with
-- the PUBLIC anon key. Row Level Security therefore does all the work — the
-- anon role may INSERT into these two tables and nothing else. It cannot read
-- back a single row, so submitted messages and email addresses are not
-- exposed to visitors. Read them in the Supabase dashboard (Table Editor),
-- which uses the service role.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Contact form submissions
-- -----------------------------------------------------------------------------
create table if not exists public.contact_messages (
  id                   uuid primary key default gen_random_uuid(),
  name                 text not null check (char_length(name) between 1 and 200),
  email                text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone                text check (char_length(phone) <= 60),
  topic                text check (char_length(topic) <= 120),
  message              text not null check (char_length(message) between 1 and 5000),
  subscribe_newsletter boolean not null default false,
  source               text check (char_length(source) <= 200),
  page_url             text check (char_length(page_url) <= 500),
  status               text not null default 'new'
                         check (status in ('new', 'read', 'replied', 'archived')),
  created_at           timestamptz not null default now()
);

comment on table public.contact_messages is
  'Enquiries submitted through the website contact form. Insert-only for anon.';

create index if not exists contact_messages_created_at_idx
  on public.contact_messages (created_at desc);
create index if not exists contact_messages_status_idx
  on public.contact_messages (status);

-- -----------------------------------------------------------------------------
-- Newsletter subscribers
-- -----------------------------------------------------------------------------
create table if not exists public.newsletter_subscribers (
  id         uuid primary key default gen_random_uuid(),
  email      text not null check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  name       text check (char_length(name) <= 200),
  source     text check (char_length(source) <= 200),
  page_url   text check (char_length(page_url) <= 500),
  status     text not null default 'subscribed'
               check (status in ('subscribed', 'unsubscribed', 'bounced')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.newsletter_subscribers is
  'Newsletter sign-ups from the homepage form and the contact-form opt-in.';

-- Case-insensitive uniqueness: one row per address, however it was typed.
create unique index if not exists newsletter_subscribers_email_key
  on public.newsletter_subscribers (lower(email));
create index if not exists newsletter_subscribers_created_at_idx
  on public.newsletter_subscribers (created_at desc);

-- -----------------------------------------------------------------------------
-- Row Level Security — anon may write, never read
-- -----------------------------------------------------------------------------
alter table public.contact_messages      enable row level security;
alter table public.newsletter_subscribers enable row level security;

drop policy if exists "public can submit contact messages" on public.contact_messages;
create policy "public can submit contact messages"
  on public.contact_messages
  for insert
  to anon, authenticated
  with check (true);

drop policy if exists "public can subscribe to the newsletter" on public.newsletter_subscribers;
create policy "public can subscribe to the newsletter"
  on public.newsletter_subscribers
  for insert
  to anon, authenticated
  with check (true);

-- No SELECT / UPDATE / DELETE policies exist on purpose: with RLS on, their
-- absence means the anon role cannot read or change anything in these tables.

-- -----------------------------------------------------------------------------
-- Idempotent newsletter sign-up
--
-- Lets someone re-subscribe (or subscribe again from a second form) without an
-- error, and re-activates an address that had unsubscribed. SECURITY DEFINER so
-- it can perform the UPDATE half of the upsert that RLS otherwise forbids; the
-- body only ever touches this one table.
-- -----------------------------------------------------------------------------
create or replace function public.subscribe_to_newsletter(
  p_email    text,
  p_name     text default null,
  p_source   text default null,
  p_page_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.newsletter_subscribers (email, name, source, page_url)
  values (
    lower(trim(p_email)),
    nullif(trim(coalesce(p_name, '')), ''),
    left(p_source, 200),
    left(p_page_url, 500)
  )
  on conflict (lower(email)) do update
    set status     = 'subscribed',
        name       = coalesce(excluded.name, public.newsletter_subscribers.name),
        updated_at = now();
end;
$$;

revoke all on function public.subscribe_to_newsletter(text, text, text, text) from public;
grant execute on function public.subscribe_to_newsletter(text, text, text, text)
  to anon, authenticated;
