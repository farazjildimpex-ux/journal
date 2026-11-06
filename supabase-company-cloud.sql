-- Already applied to your project. Only needed if you ever set up a fresh Supabase project.
alter table public.companies add column if not exists logo text;
alter table public.companies add column if not exists profile jsonb;
