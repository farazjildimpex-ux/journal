// Web Push for Journal. No Firebase project and no keys to paste anywhere: the VAPID key pair is made
// once, here, and kept in Supabase (push_keys), which only the service key can read.
// Needs SUPABASE_SERVICE_KEY (already set). A Supabase cron calls "tick" every 5 minutes with x-push-secret.
// Actions: key and test (signed-in user), tick (scheduler).
const crypto = require('crypto');
const webpush = require('web-push');
const { envv } = require('./_env');
const SB_URL = 'https://ethhzxagxejxfxkzgndk.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aGh6eGFneGVqeGZ4a3pnbmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MDQwNjIsImV4cCI6MjA2NDI4MDA2Mn0.FMCc_AwksmDGQqGdCoazcxIJ7i3635fkrJinx5gNucA';
const T = {}; // test hooks: now()
const svcKey = () => envv('SUPABASE_SERVICE_KEY');
const same = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const trim = (s, n) => { s = String(s == null ? '' : s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

async function sv(path, opt) {
  const o = opt || {};
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    method: o.method || 'GET',
    headers: Object.assign({ apikey: svcKey(), Authorization: 'Bearer ' + svcKey(), 'Content-Type': 'application/json', Prefer: 'return=representation' }, o.headers || {}),
    body: o.body === undefined ? undefined : JSON.stringify(o.body)
  });
  const t = await r.text();
  let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
  if (!r.ok) throw new Error((j && (j.message || j.error)) || ('Database said ' + r.status));
  return j;
}

// The key pair is made the first time anyone asks for it, and never again.
async function keys() {
  let r = await sv('push_keys?id=eq.1&select=*');
  if (r && r[0]) return r[0];
  const k = webpush.generateVAPIDKeys();
  await sv('push_keys?on_conflict=id', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: { id: 1, public_key: k.publicKey, private_key: k.privateKey, secret: crypto.randomBytes(24).toString('hex') } });
  r = await sv('push_keys?id=eq.1&select=*');
  return r[0];
}

// The date and time where Faraz is.
function here(tz, now) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(now).map(x => [x.type, x.value]));
  return { date: p.year + '-' + p.month + '-' + p.day, hm: p.hour + ':' + p.minute, hour: +p.hour };
}

async function sendAll(k, msg) {
  webpush.setVapidDetails('mailto:info@jildimpex.in', k.public_key, k.private_key);
  const subs = (await sv('push_subs?select=*')) || [];
  let ok = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(msg), { TTL: 60 * 60 * 24, urgency: msg.urgent ? 'high' : 'normal' });
      ok++;
      await sv('push_subs?id=eq.' + s.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { last_ok: new Date().toISOString(), fails: 0 } });
    } catch (e) {
      // 404 and 410 mean the device turned notifications off or the browser was reset: forget it
      if (e && (e.statusCode === 404 || e.statusCode === 410)) await sv('push_subs?id=eq.' + s.id, { method: 'DELETE', headers: { Prefer: 'return=minimal' } });
      else await sv('push_subs?id=eq.' + s.id, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { fails: (s.fails || 0) + 1 } });
    }
  }
  return { ok, devices: subs.length };
}

// Claim the key first, then send: two ticks running at once can never send the same thing twice.
async function once(k, qkey, kind, msg) {
  const got = await sv('push_log?on_conflict=qkey', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates,return=representation' }, body: { qkey, kind, title: msg.title, body: msg.body, url: msg.url } });
  if (!got || !got.length) return 0;
  const r = await sendAll(k, msg);
  await sv('push_log?qkey=eq.' + encodeURIComponent(qkey), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { delivered: r.ok } });
  return 1;
}

// Several of a kind at once become one notification.
async function batch(k, kind, rows, one, many) {
  if (!rows.length) return 0;
  if (rows.length <= 2) { let n = 0; for (const r of rows) n += await once(k, kind + ':' + r.id, kind, one(r)); return n; }
  return once(k, kind + ':' + rows.map(r => r.id).sort().join(',').slice(0, 300), kind, many(rows));
}

async function tick(now) {
  const k = await keys();
  const P = ((await sv('push_prefs?id=eq.1&select=*')) || [])[0] || {};
  const tz = P.tz || 'Asia/Kolkata', h = here(tz, now), hour = P.hour == null ? 9 : P.hour;
  const night = P.quiet !== false && (h.hour >= 22 || h.hour < 7);
  const morning = h.hour >= hour;
  const out = { entries: 0, calls: 0, replies: 0, mail: 0, summary: 0 };

  // 1. a journal entry's own reminder, at the time he chose (night or not: he chose it); no time means the morning hour.
  //    Three or more at once come as one. Switched off, they are marked sent so they do not pile up for later.
  {
    const due = (await sv('journal_entries?select=id,title,content,reminder_date,reminder_time&reminder_enabled=eq.true&reminder_sent=not.is.true&reminder_date=lte.' + h.date + '&order=reminder_date.asc&limit=25')) || [];
    const at = e => String(e.reminder_time || (String(hour).padStart(2, '0') + ':00')).slice(0, 5);
    const ready = due.filter(e => !(e.reminder_date === h.date && at(e) > h.hm)).map(e => Object.assign({}, e, { eid: e.id, id: e.id + ':' + e.reminder_date + ':' + at(e) }));
    if (P.entries !== false) out.entries += await batch(k, 'rem', ready,
      e => ({ title: trim(e.title, 70) || 'Reminder', body: trim(e.content, 140) || 'From your journal', url: '/app?e=' + e.eid, tag: 'rem-' + e.eid }),
      L => ({ title: L.length + ' reminders from your journal', body: trim(L.map(e => trim(e.title, 40)).join(' · '), 140), url: '/app', tag: 'rems' }));
    if (ready.length) await sv('journal_entries?id=in.(' + ready.map(e => e.eid).join(',') + ')', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { reminder_sent: true } });
  }

  // 2. a client follow-up that falls due today, from the morning hour on
  if (P.calls !== false && morning && !night) {
    const fu = (await sv('lead_followups?select=id,next_on,mode,note,leads(company_name)&next_on=eq.' + h.date)) || [];
    out.calls += await batch(k, 'call', fu,
      f => ({ title: (f.mode || 'Follow-up') + ' due today', body: trim(((f.leads || {}).company_name || 'A client') + (f.note ? ' · ' + f.note : ''), 140), url: '/app?go=clients', tag: 'call-' + f.id }),
      L => ({ title: L.length + ' client follow-ups due today', body: trim(L.map(f => (f.leads || {}).company_name || 'A client').join(', '), 140), url: '/app?go=clients', tag: 'calls' }));
  }

  // 3. a buyer replied to an outreach email (held overnight, then sent at 7)
  if (P.replies !== false && !night) {
    const since = P.last_reply_at || new Date(now.getTime() - 36e5).toISOString();
    const R = (await sv('outreach_inbox?select=id,from_name,from_addr,company,subject,created_at&kind=eq.reply&created_at=gt.' + encodeURIComponent(since) + '&order=created_at.asc&limit=30')) || [];
    out.replies += await batch(k, 'reply', R,
      r => ({ title: 'Reply from ' + trim(r.company || r.from_name || r.from_addr, 60), body: trim(r.subject || 'Open the inbox to read it', 140), url: '/app?go=inbox', tag: 'reply-' + r.id, urgent: true }),
      L => ({ title: L.length + ' buyers replied', body: trim(L.map(r => r.company || r.from_name || r.from_addr).join(', '), 140), url: '/app?go=inbox', tag: 'replies', urgent: true }));
    if (R.length) await sv('push_prefs?id=eq.1', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { last_reply_at: R[R.length - 1].created_at } });
  }

  // 4. an invoice, bill of lading or airway bill was read in from mail
  if (P.mail !== false && !night) {
    const since = P.last_mail_at || new Date(now.getTime() - 36e5).toISOString();
    const M = ((await sv('mail_inbox?select=id,kind,doc_number,sender,status,created_at&created_at=gt.' + encodeURIComponent(since) + '&order=created_at.asc&limit=30')) || []);
    const show = M.filter(m => m.status !== 'ignored');
    const nm = m => ({ invoice: 'Invoice', airway_bill: 'Airway bill', bill_of_lading: 'Bill of lading', proforma: 'Proforma' }[m.kind] || 'Document');
    out.mail += await batch(k, 'mail', show,
      m => ({ title: nm(m) + (m.doc_number ? ' ' + trim(m.doc_number, 40) : '') + ' read from mail', body: 'Tap to check it and save it to the contract', url: '/app?go=mail', tag: 'mail-' + m.id }),
      L => ({ title: L.length + ' documents read from mail', body: trim(L.map(m => nm(m) + (m.doc_number ? ' ' + m.doc_number : '')).join(', '), 140), url: '/app?go=mail', tag: 'mail' }));
    if (M.length) await sv('push_prefs?id=eq.1', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { last_mail_at: M[M.length - 1].created_at } });
  }

  // a kind that is switched off does not pile up to be sent later
  const off = {};
  if (P.replies === false) off.last_reply_at = now.toISOString();
  if (P.mail === false) off.last_mail_at = now.toISOString();
  if (Object.keys(off).length) await sv('push_prefs?id=eq.1', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: off });

  // 5. one summary in the morning
  if (P.summary !== false && morning && !night && P.last_summary !== h.date) {
    await sv('push_prefs?id=eq.1', { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { last_summary: h.date } });
    const fo = ((await sv('journal_entries?select=id&follow_up_required=eq.true&follow_up_completed_at=is.null&limit=1000')) || []).length;
    const cl = ((await sv('lead_followups?select=id&next_on=eq.' + h.date)) || []).length;
    const fresh = P.pending && P.pending_at && (now - new Date(P.pending_at)) < 36 * 36e5;
    const pn = fresh ? (+P.pending.count || 0) : 0;
    const parts = [pn ? pn + ' pending' : '', fo ? fo + ' open follow-up' + (fo == 1 ? '' : 's') : '', cl ? cl + ' client call' + (cl == 1 ? '' : 's') + ' today' : ''].filter(Boolean);
    const top = fresh ? (P.pending.top || []).slice(0, 2).map(x => trim(x, 60)) : [];
    if (parts.length) out.summary += await once(k, 'sum:' + h.date, 'summary', { title: 'Today: ' + parts.join(' · '), body: top.length ? top.join(' · ') : 'Open the app to go through them', url: '/app?go=pending', tag: 'summary' });
  }
  return out;
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (!svcKey()) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY is not set in Vercel.' });
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } } b = b || {};
  try {
    if (b.action === 'tick') {
      const k = await keys(), got = String(req.headers['x-push-secret'] || '');
      if (!got || !same(got, k.secret)) return res.status(401).json({ error: 'Wrong secret' });
      return res.status(200).json({ ok: true, sent: await tick(T.now ? T.now() : new Date()) });
    }
    const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!tok) return res.status(401).json({ error: 'Please sign in again.' });
    const u = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_ANON, Authorization: 'Bearer ' + tok } });
    if (!u.ok) return res.status(401).json({ error: 'Please sign in again.' });
    if (b.action === 'key') return res.status(200).json({ key: (await keys()).public_key });
    if (b.action === 'test') {
      const r = await sendAll(await keys(), { title: 'Notifications are on', body: 'This is how reminders, replies and invoices will reach you.', url: '/app', tag: 'test' });
      return res.status(200).json(r);
    }
    return res.status(400).json({ error: 'Unknown request.' });
  } catch (e) {
    return res.status(502).json({ error: e.message || 'That did not work.' });
  }
};
module.exports._t = { T, here, trim, tick, keys, once, batch };
