-- Pending actions: items you tick off by hand on the computer Home (safe to run again)
create table if not exists pending_done (
  key text primary key,
  done_at timestamptz not null default now()
);
alter table pending_done enable row level security;
drop policy if exists "pd all" on pending_done;
create policy "pd all" on pending_done for all to authenticated using (true) with check (true);
