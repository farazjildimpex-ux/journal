-- Quality certificate (v95): the fields typed or changed by hand on an invoice's certificate
-- (bundles, L/C, destination, ...). Everything else is filled from the contract and the invoice.
alter table public.invoices add column if not exists qc jsonb;
