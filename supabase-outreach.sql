create table if not exists outreach_settings (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
create table if not exists outreach_drafts (
  id uuid primary key default gen_random_uuid(),
  group_key text not null,
  company text,
  country text,
  to_email text,
  to_name text,
  step text not null default 'intro',
  subject text,
  body text,
  language text,
  basis jsonb,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  approved_at timestamptz,
  sent_at timestamptz
);
alter table outreach_settings enable row level security;
alter table outreach_drafts enable row level security;
create policy "os all" on outreach_settings for all to authenticated using (true) with check (true);
create policy "od all" on outreach_drafts for all to authenticated using (true) with check (true);
