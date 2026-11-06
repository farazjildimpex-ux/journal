// Receives documents from the Gmail script, reads them and stores them for approval in the app.
// Vercel environment variables needed: ANTHROPIC_API_KEY, SUPABASE_SERVICE_KEY. (The secret is stored in Supabase mail_settings; MAIL_SECRET in Vercel still works if you set it.)
const { readDocs } = require('./_reader');
const SB_URL = 'https://ethhzxagxejxfxkzgndk.supabase.co';

const sbf = (path, opt = {}) => fetch(SB_URL + '/rest/v1/' + path, {
  ...opt,
  headers: {
    apikey: process.env.SUPABASE_SERVICE_KEY, Authorization: 'Bearer ' + process.env.SUPABASE_SERVICE_KEY,
    'Content-Type': 'application/json', ...(opt.headers || {})
  }
});
const crypto = require('crypto');
const same = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const addr = s => { const m = String(s || '').match(/[\w.+'-]+@[\w.-]+\.\w+/); return m ? m[0].toLowerCase() : ''; };
const allowedFrom = (from, list) => {
  if (!list || !list.length) return true;
  const a = addr(from);
  return list.some(x => { x = String(x || '').trim().toLowerCase(); return x && (x === a || (x[0] === '@' && a.endsWith(x)) || (x.indexOf('@') < 0 && a.endsWith('@' + x))); });
};

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const key = process.env.ANTHROPIC_API_KEY, svc = process.env.SUPABASE_SERVICE_KEY;
  if (!svc) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY is not set in Vercel. Add it under Settings, Environment Variables (Production), then Redeploy.' });
  const sent = String(req.headers['x-mail-secret'] || '');
  if (!sent) return res.status(401).json({ error: 'Wrong secret' });
  let b = req.body;
  if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  if (!b) return res.status(400).json({ error: 'Bad request' });

  try {
    const sr = await sbf('mail_settings?id=eq.main&select=*');
    const srj = await sr.json();
    if (!sr.ok) return res.status(502).json({ error: 'Could not read settings from Supabase. Check SUPABASE_SERVICE_KEY is the service_role key. ' + String((srj && srj.message) || '').slice(0, 120) });
    const set = (srj || [])[0] || { enabled: true, allowed: [] };
    const good = [set.secret, process.env.MAIL_SECRET].filter(Boolean);
    if (!good.length) return res.status(500).json({ error: 'No secret yet. Run supabase-mailbox.sql in Supabase once, then open Settings, Email inbox in the app.' });
    if (!good.some(x => same(x, sent))) return res.status(401).json({ error: 'Wrong secret' });
    if (b.ping || set.enabled !== false) {
      await sbf('mail_settings?id=eq.main', { method: 'PATCH', body: JSON.stringify({ last_check: new Date().toISOString() }) });
    }
    if (set.enabled === false) return res.status(200).json({ ok: true, skipped: 'disabled' });
    if (b.ping) return res.status(200).json({ ok: true });
    if (!key) return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not set in Vercel.' });
    if (!allowedFrom(b.from, set.allowed)) return res.status(200).json({ ok: true, skipped: 'sender' });

    const mid = String(b.messageId || '');
    if (!mid) return res.status(400).json({ error: 'No message id' });
    const ex = await (await sbf('mail_inbox?message_id=eq.' + encodeURIComponent(mid) + '&select=id&limit=1')).json();
    if (Array.isArray(ex) && ex.length) return res.status(200).json({ ok: true, skipped: 'duplicate' });

    const files = Array.isArray(b.files) ? b.files.slice(0, 4) : [];
    if (!files.length) return res.status(200).json({ ok: true, found: 0 });
    const docs = (await readDocs(files, key)).filter(d => d.doc_type && d.doc_type !== 'other');
    const rows = docs.map((d, i) => ({
      message_id: mid, idx: i, status: 'pending', kind: d.doc_type,
      subject: String(b.subject || '').slice(0, 300), sender: String(b.from || '').slice(0, 200),
      received_at: b.date || new Date().toISOString(),
      doc_number: (d.doc_type === 'invoice' ? d.invoice_number : d.bill_number) || null,
      file_name: files.map(f => f.name).join(', ').slice(0, 300), data: d
    }));
    if (rows.length) {
      const ins = await sbf('mail_inbox?on_conflict=message_id,idx', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify(rows) });
      if (!ins.ok) return res.status(502).json({ error: 'Could not save: ' + (await ins.text()).slice(0, 200) });
    } else {
      // nothing useful in this mail: remember it so it is not read again
      await sbf('mail_inbox?on_conflict=message_id,idx', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify([{ message_id: mid, idx: 0, status: 'ignored', kind: 'other', subject: String(b.subject || '').slice(0, 300), sender: String(b.from || '').slice(0, 200), received_at: b.date || new Date().toISOString(), data: {} }]) });
    }
    return res.status(200).json({ ok: true, found: rows.length });
  } catch (e) {
    return res.status(e.status || 502).json({ error: e.message || 'Failed' });
  }
};
