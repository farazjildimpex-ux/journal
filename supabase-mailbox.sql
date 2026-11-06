-- Run once in Supabase: SQL Editor -> New query -> paste -> Run. Safe to run more than once.
-- Stores the Gmail inbox settings and the documents waiting for your approval.

create table if not exists public.mail_settings (
  id text primary key default 'main',
  enabled boolean not null default true,
  gmail text not null default '',
  allowed text[] not null default '{}',
  last_check timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.mail_settings (id) values ('main') on conflict (id) do nothing;

create table if not exists public.mail_inbox (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  status text not null default 'pending',   -- pending, applied, dismissed, ignored
  kind text,                                 -- invoice, bill_of_lading, airway_bill, other
  message_id text not null,
  idx int not null default 0,
  subject text, sender text, received_at timestamptz,
  doc_number text, file_name text,
  data jsonb not null default '{}'::jsonb,
  applied_at timestamptz,
  unique (message_id, idx)
);
create index if not exists mail_inbox_status_idx on public.mail_inbox (status, created_at desc);

alter table public.mail_settings enable row level security;
alter table public.mail_inbox enable row level security;
drop policy if exists "mail_settings_all" on public.mail_settings;
create policy "mail_settings_all" on public.mail_settings for all to authenticated using (true) with check (true);
drop policy if exists "mail_inbox_all" on public.mail_inbox;
create policy "mail_inbox_all" on public.mail_inbox for all to authenticated using (true) with check (true);

-- Fixed secret shared by the Gmail script and the app (created once, same on every device).
alter table public.mail_settings add column if not exists secret text;
update public.mail_settings set secret = replace(gen_random_uuid()::text, '-', '') where id = 'main' and (secret is null or secret = '');

notify pgrst, 'reload schema';
