-- Run once in Supabase: SQL Editor -> New query -> paste -> Run
-- Safe to run more than once, and works even if an older "signatures" table already exists.

create table if not exists public.signatures (
  id uuid primary key default gen_random_uuid(),
  user_id uuid default auth.uid(),
  name text not null default '',
  role text not null default '',
  img text not null default '',
  created_at timestamptz not null default now()
);

-- if an older signatures table existed, bring it up to date
alter table public.signatures add column if not exists user_id uuid default auth.uid();
alter table public.signatures add column if not exists name text not null default '';
alter table public.signatures add column if not exists role text not null default '';
alter table public.signatures add column if not exists img text not null default '';
alter table public.signatures add column if not exists created_at timestamptz not null default now();
alter table public.signatures alter column user_id set default auth.uid();
alter table public.signatures alter column name set default '';

do $$ begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='signatures' and column_name='image_url') then
    alter table public.signatures alter column image_url drop not null;
    alter table public.signatures alter column image_url set default '';
  end if;
end $$;

alter table public.signatures enable row level security;

drop policy if exists "signatures_all_authenticated" on public.signatures;
create policy "signatures_all_authenticated" on public.signatures
  for all to authenticated using (true) with check (true);

-- which signature each document uses
alter table public.contracts   add column if not exists signature_id uuid references public.signatures(id) on delete set null;
alter table public.samples     add column if not exists signature_id uuid references public.signatures(id) on delete set null;
alter table public.debit_notes add column if not exists signature_id uuid references public.signatures(id) on delete set null;

notify pgrst, 'reload schema';
