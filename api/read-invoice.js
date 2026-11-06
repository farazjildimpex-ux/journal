// Vercel serverless function: reads an invoice / packing list (PDF or photo) for the invoice form.
// Needs ANTHROPIC_API_KEY on Vercel.
const { readDocs } = require('./_reader');
const SB_URL = 'https://ethhzxagxejxfxkzgndk.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aGh6eGFneGVqeGZ4a3pnbmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MDQwNjIsImV4cCI6MjA2NDI4MDA2Mn0.FMCc_AwksmDGQqGdCoazcxIJ7i3635fkrJinx5gNucA';

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const key = require('./_env').envv('ANTHROPIC_API_KEY');
  if (!key) return res.status(500).json({ error: 'The reader is not set up yet. Add ANTHROPIC_API_KEY in Vercel (Settings, Environment Variables) and redeploy.' });
  const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok) return res.status(401).json({ error: 'Please sign in again.' });
  try {
    const u = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + tok } });
    if (!u.ok) return res.status(401).json({ error: 'Please sign in again.' });
  } catch (e) { return res.status(502).json({ error: 'Could not check your sign in.' }); }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const files = body && Array.isArray(body.files) ? body.files.slice(0, 4) : [];
  if (!files.length) return res.status(400).json({ error: 'No file received.' });
  try {
    const docs = await readDocs(files, key);
    const inv = docs.find(d => d.doc_type === 'invoice');
    if (!inv) {
      const o = docs.find(d => d.doc_type !== 'other');
      return res.status(422).json({ error: o ? 'This looks like a ' + o.doc_type.replace(/_/g, ' ') + ', not an invoice. Forward it to your Gmail inbox instead.' : 'No invoice found in this file.' });
    }
    return res.status(200).json(inv);
  } catch (e) {
    return res.status(e.status || 502).json({ error: e.message || 'Could not reach the reader. Try again.' });
  }
};
