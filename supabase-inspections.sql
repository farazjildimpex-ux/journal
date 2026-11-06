-- Run once in Supabase -> SQL Editor -> New query -> Run.
-- Inspections are stored on the contract, the price-adjustment reason on the invoice.
alter table public.contracts add column if not exists inspections jsonb not null default '[]'::jsonb;
alter table public.contracts add column if not exists payments jsonb not null default '[]'::jsonb;
alter table public.invoices add column if not exists price_note text;
