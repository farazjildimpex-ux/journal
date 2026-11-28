-- Mail page (v99): a proper mailbox on top of the outreach tables.
-- Inbox: outreach_inbox gains who it was sent to, attachments (names only; the file is read from the mailbox when opened),
-- a star and a bin. Sent from other devices: mail_sent, read from the mailbox's Sent folder. Emails written by hand use
-- outreach_drafts with step 'manual'; their attached files wait in mail_files until sent.
alter table public.outreach_inbox add column if not exists to_addrs text;
alter table public.outreach_inbox add column if not exists cc_addrs text;
alter table public.outreach_inbox add column if not exists attachments jsonb;
alter table public.outreach_inbox add column if not exists starred boolean not null default false;
alter table public.outreach_inbox add column if not exists deleted_at timestamptz;
alter table public.outreach_drafts add column if not exists cc text;
alter table public.outreach_drafts add column if not exists attachments jsonb;
alter table public.outreach_drafts add column if not exists deleted_at timestamptz;
create table if not exists public.mail_sent (
  id uuid primary key default gen_random_uuid(),
  uid bigint,
  message_id text unique,
  in_reply_to text,
  to_addrs text,
  cc_addrs text,
  subject text,
  body text,
  attachments jsonb,
  sent_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.mail_sent enable row level security;
drop policy if exists "mail sent all" on public.mail_sent;
create policy "mail sent all" on public.mail_sent for all to authenticated using (true) with check (true);
create table if not exists public.mail_files (
  id uuid primary key default gen_random_uuid(),
  draft_id uuid not null,
  name text not null,
  type text,
  size integer,
  data text not null,
  created_at timestamptz not null default now()
);
create index if not exists mail_files_draft on public.mail_files(draft_id);
alter table public.mail_files enable row level security;
drop policy if exists "mail files all" on public.mail_files;
create policy "mail files all" on public.mail_files for all to authenticated using (true) with check (true);
