create table if not exists lwg_research (
  group_key text primary key,
  company text,
  country text,
  domain text,
  business_type text,
  profile jsonb,
  emails jsonb,
  lwg jsonb,
  pages jsonb,
  status text not null default 'done',
  researched_at timestamptz not null default now()
);
alter table lwg_research enable row level security;
create policy "lwg research read" on lwg_research for select to authenticated using (true);
create policy "lwg research insert" on lwg_research for insert to authenticated with check (true);
create policy "lwg research update" on lwg_research for update to authenticated using (true) with check (true);
