-- Inbox and replies: run once in the Supabase SQL Editor.
create table if not exists outreach_inbox (
  id uuid primary key default gen_random_uuid(),
  uid bigint,
  message_id text unique,
  in_reply_to text,
  from_addr text,
  from_name text,
  subject text,
  body text,
  received_at timestamptz,
  draft_id uuid,
  group_key text,
  company text,
  kind text not null default 'reply',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table outreach_inbox enable row level security;
drop policy if exists "inbox all" on outreach_inbox;
create policy "inbox all" on outreach_inbox for all to authenticated using (true) with check (true);
alter table outreach_drafts add column if not exists in_reply_to text;
alter table outreach_drafts add column if not exists inbox_id uuid;
alter table outreach_drafts add column if not exists replied_at timestamptz;
alter table outreach_drafts add column if not exists parent_id uuid;
