-- Sending: run once in the Supabase SQL Editor.
alter table outreach_drafts add column if not exists message_id text;
alter table outreach_drafts add column if not exists follow_due timestamptz;
alter table outreach_drafts add column if not exists last_error text;
create table if not exists outreach_suppress (
  email text primary key,
  reason text,
  created_at timestamptz not null default now()
);
alter table outreach_suppress enable row level security;
drop policy if exists "sup all" on outreach_suppress;
create policy "sup all" on outreach_suppress for all to authenticated using (true) with check (true);
