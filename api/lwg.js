// Vercel serverless function: reads the public LWG supplier directory for the Buyers page.
// Two jobs: "page" returns one page of the list, "detail" returns details for a few companies.
// The app asks slowly (a few calls at a time) so the directory is never hit hard.
const SB_URL = 'https://ethhzxagxejxfxkzgndk.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aGh6eGFneGVqeGZ4a3pnbmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MDQwNjIsImV4cCI6MjA2NDI4MDA2Mn0.FMCc_AwksmDGQqGdCoazcxIJ7i3635fkrJinx5g';
const BASE = 'https://directory.leatherworkinggroup.com/hs/serverless/api/';
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function lwgGet(path, tries) {
  let last;
  for (let i = 0; i < (tries || 3); i++) {
    const r = await fetch(BASE + path, { headers: { 'User-Agent': 'Journal-buyer-research/1.0', Accept: 'application/json' } });
    if (r.status === 429 || r.status >= 500) { last = r.status; await sleep(1200 * (i + 1)); continue; }
    if (!r.ok) throw Object.assign(new Error('The LWG directory answered ' + r.status + '.'), { status: 502 });
    return r.json();
  }
  throw Object.assign(new Error(last === 429 ? 'The LWG directory is busy. Try again in a minute.' : 'The LWG directory is not answering right now.'), { status: 502 });
}
const cleanCountry = c => String(c || '').replace(/\s*\(.*\)\s*$/, '').trim();
const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok) return res.status(401).json({ error: 'Please sign in again.' });
  try {
    const u = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + tok } });
    if (!u.ok) return res.status(401).json({ error: 'Please sign in again.' });
  } catch (e) { return res.status(502).json({ error: 'Could not check your sign in.' }); }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  body = body || {};
  try {
    if (body.action === 'page') {
      const after = /^\d{1,6}$/.test(String(body.after || '')) ? String(body.after) : '';
      const j = await lwgGet('get-suppliers?limit=100&page=1' + (after ? '&after=' + after : ''));
      if (!j || !j.success) throw Object.assign(new Error('Unexpected answer from the LWG directory.'), { status: 502 });
      const rows = (j.suppliers || []).map(s => ({
        id: String(s.id), name: clean(s.name), site_type: clean(s.site_type), rating: clean(s.rating),
        country: cleanCountry(s.country), country_raw: clean(s.country), cert_until: s.cert_until || null
      }));
      const p = j.pagination || {};
      return res.status(200).json({ rows, total: p.total || 0, next: p.hasMore ? String(p.nextCursor || '') : '' });
    }
    if (body.action === 'detail') {
      const ids = (Array.isArray(body.ids) ? body.ids : []).map(String).filter(x => /^\d{5,20}$/.test(x)).slice(0, 8);
      if (!ids.length) return res.status(400).json({ error: 'No companies given.' });
      const rows = [];
      for (const id of ids) {
        const j = await lwgGet('get-company?id=' + id);
        const c = j && j.company;
        if (!c) { rows.push({ id, missing: true }); continue; }
        const addr = [c.address_line1, c.city, c.postcode, c.county].map(clean).filter(Boolean).join(', ');
        rows.push({
          id, urn: clean(c.urn), domain: clean(c.domain).toLowerCase(), website: clean(c.website),
          phone: clean(c.contact_phone), address: addr, city: clean(c.city),
          animals: clean(c.animal_types).split(';').map(clean).filter(Boolean).join(', '),
          materials: (c.material_types || []).map(m => ({ animal: m.animal_type, type: m.material_type, cond: m.material_condition })),
          cert_until: c.audit_expiry || null
        });
        await sleep(250);
      }
      return res.status(200).json({ rows });
    }
    return res.status(400).json({ error: 'Unknown request.' });
  } catch (e) {
    return res.status(e.status || 502).json({ error: e.message || 'Could not reach the directory.' });
  }
};
