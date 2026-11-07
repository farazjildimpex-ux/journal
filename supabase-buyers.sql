-- Buyers > Find buyers: stores the LWG directory list. Run once in the Supabase SQL Editor.
create table if not exists lwg_companies (
  id text primary key,
  name text not null,
  site_type text,
  rating text,
  country text,
  country_raw text,
  city text,
  domain text,
  website text,
  phone text,
  address text,
  animals text,
  materials jsonb,
  urn text,
  cert_until date,
  detail_at timestamptz,
  first_seen timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table lwg_companies enable row level security;
create policy "lwg read" on lwg_companies for select to authenticated using (true);
create policy "lwg insert" on lwg_companies for insert to authenticated with check (true);
create policy "lwg update" on lwg_companies for update to authenticated using (true) with check (true);
