-- Optional: run once in Supabase -> SQL Editor -> New query -> Run.
-- Lets the app read the exact database size for the Usage page.
create or replace function public.journal_usage() returns json language sql security definer set search_path=public as $$ select json_build_object('db',pg_database_size(current_database())) $$;
grant execute on function public.journal_usage() to authenticated;
