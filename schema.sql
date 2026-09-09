-- Pipeline - job application tracker schema.
-- Idempotent: safe to run in the Supabase SQL editor on a fresh or existing install.

create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  company text not null check (char_length(company) > 0),
  role text not null check (char_length(role) > 0),
  location text not null default '',
  stage text not null default 'wishlist'
    check (stage in ('wishlist', 'applied', 'interview', 'offer', 'rejected')),
  source text not null default '',
  salary text not null default '',
  url text not null default '',
  contact_name text not null default '',
  contact_role text not null default '',
  applied date,
  deadline date,
  notes text not null default '',
  created_at timestamptz not null default now()
);

-- url must be http(s) or empty; enforced client-side too, but the shared demo
-- account makes the server the only enforcement point that counts
alter table public.applications
  drop constraint if exists applications_url_scheme_check;
alter table public.applications
  add constraint applications_url_scheme_check
  check (url = '' or url ~ '^https?://');

alter table public.applications enable row level security;

-- users can only see and touch their own rows
drop policy if exists own_rows on public.applications;
create policy own_rows on public.applications
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
