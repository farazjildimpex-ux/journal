# Invoice reader and Gmail inbox: one-time setup

## 1. Supabase
SQL Editor, paste and run `supabase-mailbox.sql` (safe to run again). Run it again after updating, it creates your fixed secret.

## 2. Vercel environment variables (Settings, Environment Variables), then redeploy
- ANTHROPIC_API_KEY  : from console.anthropic.com (needs a little prepaid credit)
- SUPABASE_SERVICE_KEY : Supabase, Project Settings, API, service_role key (keep it private)
- MAIL_SECRET is no longer needed. The secret is created once by supabase-mailbox.sql, saved in your database and shown in Settings, Email inbox (same on every device).
- ANTHROPIC_MODEL (optional) : the reader uses claude-haiku-5-5 (cheapest). If it ever misreads an invoice, set this to claude-sonnet-5-5 and redeploy. No code change needed.
Upload the `api` folder with the app.

## 3. Gmail
Sign in to the Gmail that receives your forwards, open script.google.com, New project.
In the app, Settings, Email inbox, tap "Copy script" and paste it in. Save, choose `setup` and Run once, allow access.
It checks the inbox every 5 minutes and labels what it has sent "Journal-done".

## Use
Forward the final invoice / packing list, bill of lading or airway bill to that Gmail (no label needed).
Open Settings, Email inbox, tap Review and approve.
- Same invoice number as a saved one: treated as a revised invoice, the saved invoice is updated after you press Save.
- Bill of lading / airway bill: matched to the invoice it names (or the invoice on the same contract); the bill type, number and shipping date are updated after you approve. Same bill number again just updates it.

Invoice form: the grey box also takes a file directly (drag, drop or choose).
