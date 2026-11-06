# Journal

Business journal PWA (Supabase + Vercel).

- `index.html`, `sw.js`, `manifest.json`: the app
- `api/`: Vercel functions (invoice reader, Gmail intake)
- `supabase-*.sql`: run once each in the Supabase SQL Editor
- `IMPORT-SETUP.md`: email inbox setup
- `DESIGN.md`: design rules, read before changing the UI

Vercel environment variables (never commit these): `SUPABASE_SERVICE_KEY`, `ANTHROPIC_API_KEY`.
Every push to `main` deploys to production.
