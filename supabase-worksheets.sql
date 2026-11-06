-- Run once in Supabase: SQL Editor -> New query -> paste -> Run
-- Safe to run more than once. Stores the Worksheets feature in your account so it opens on every device.

create table if not exists public.worksheets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  title text not null default 'Untitled worksheet',
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.worksheets enable row level security;

drop policy if exists "worksheets_all_authenticated" on public.worksheets;
create policy "worksheets_all_authenticated" on public.worksheets
  for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
