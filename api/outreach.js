// Sends approved outreach emails through the new mailbox. Nothing here writes or approves emails.
// Vercel environment variables: SUPABASE_SERVICE_KEY (already set), OUTREACH_USER, OUTREACH_PASS,
// optional OUTREACH_SMTP_HOST (default smtp.titan.email), OUTREACH_SMTP_PORT (default 465), OUTREACH_FROM_NAME, OUTREACH_SECRET.
// Actions: status and test (signed-in user), tick (scheduler, header x-outreach-secret).
const crypto = require('crypto');
const { envv } = require('./_env');
const SB_URL = 'https://ethhzxagxejxfxkzgndk.supabase.co';
const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aGh6eGFneGVqeGZ4a3pnbmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MDQwNjIsImV4cCI6MjA2NDI4MDA2Mn0.FMCc_AwksmDGQqGdCoazcxIJ7i3635fkrJinx5gNucA';
const T = {}; // test hooks
const svcKey = () => envv('SUPABASE_SERVICE_KEY');
const sbf = (path, opt = {}) => fetch(SB_URL + '/rest/v1/' + path, { ...opt, headers: { apikey: svcKey(), Authorization: 'Bearer ' + svcKey(), 'Content-Type': 'application/json', Prefer: 'return=representation', ...(opt.headers || {}) } });
const same = (a, b) => { a = Buffer.from(String(a)); b = Buffer.from(String(b)); return a.length === b.length && crypto.timingSafeEqual(a, b); };
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const TZ = { italy: 'Europe/Rome', spain: 'Europe/Madrid', portugal: 'Europe/Lisbon', france: 'Europe/Paris', germany: 'Europe/Berlin', netherlands: 'Europe/Amsterdam', belgium: 'Europe/Brussels', switzerland: 'Europe/Zurich', austria: 'Europe/Vienna', poland: 'Europe/Warsaw', romania: 'Europe/Bucharest', bulgaria: 'Europe/Sofia', greece: 'Europe/Athens', turkey: 'Europe/Istanbul', 'united kingdom': 'Europe/London', uk: 'Europe/London', ireland: 'Europe/Dublin', denmark: 'Europe/Copenhagen', sweden: 'Europe/Stockholm', norway: 'Europe/Oslo', finland: 'Europe/Helsinki', 'czech republic': 'Europe/Prague', hungary: 'Europe/Budapest', croatia: 'Europe/Zagreb', slovenia: 'Europe/Ljubljana', serbia: 'Europe/Belgrade', 'hong kong': 'Asia/Hong_Kong', china: 'Asia/Shanghai', taiwan: 'Asia/Taipei', 'south korea': 'Asia/Seoul', korea: 'Asia/Seoul', japan: 'Asia/Tokyo', vietnam: 'Asia/Ho_Chi_Minh', 'viet nam': 'Asia/Ho_Chi_Minh', thailand: 'Asia/Bangkok', indonesia: 'Asia/Jakarta', malaysia: 'Asia/Kuala_Lumpur', singapore: 'Asia/Singapore', india: 'Asia/Kolkata', pakistan: 'Asia/Karachi', bangladesh: 'Asia/Dhaka', 'united arab emirates': 'Asia/Dubai', uae: 'Asia/Dubai', egypt: 'Africa/Cairo', morocco: 'Africa/Casablanca', tunisia: 'Africa/Tunis', 'united states': 'America/New_York', usa: 'America/New_York', canada: 'America/Toronto', mexico: 'America/Mexico_City', brazil: 'America/Sao_Paulo', argentina: 'America/Argentina/Buenos_Aires', australia: 'Australia/Sydney' };
const tzOf = c => TZ[String(c || '').trim().toLowerCase()] || 'Europe/Rome';
function localParts(now, tz) {
  const p = new Intl.DateTimeFormat('en-GB', { timeZone: tz, weekday: 'short', hour: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const g = t => (p.find(x => x.type === t) || {}).value;
  return { wd: g('weekday'), hour: +g('hour') };
}
const isWeekday = wd => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(wd);
function inWindow(now, country, from, to) { const { wd, hour } = localParts(now, tzOf(country)); return isWeekday(wd) && hour >= from && hour < to; }
function istDayStart(now) { const off = 330 * 60000; return new Date(Math.floor((now.getTime() + off) / 86400000) * 86400000 - off); }
function warmCap(daysSinceFirst, userCap) { const w = daysSinceFirst < 7 ? 10 : daysSinceFirst < 14 ? 15 : 20; return Math.max(1, Math.min(userCap || 15, w)); }
function addWorkingDays(d, n) { const x = new Date(d); while (n > 0) { x.setUTCDate(x.getUTCDate() + 1); const w = x.getUTCDay(); if (w !== 0 && w !== 6) n--; } return x; }

function mailer() {
  if (T.transport) return T.transport;
  const user = envv('OUTREACH_USER'), pass = envv('OUTREACH_PASS');
  if (!user || !pass) return null;
  const port = +envv('OUTREACH_SMTP_PORT') || 465;
  return require('nodemailer').createTransport({ host: envv('OUTREACH_SMTP_HOST') || 'smtp.titan.email', port, secure: port === 465, auth: { user, pass } });
}
const fromAddr = () => { const u = envv('OUTREACH_USER'); const n = String(process.env.OUTREACH_FROM_NAME || '').replace(/[\r\n"<>]/g, '').trim(); return { name: n, address: u }; };

function dataUrl(u) { const m = /^data:(image\/[\w+.-]+);base64,(.+)$/.exec(String(u || '')); return m ? { contentType: m[1], content: Buffer.from(m[2], 'base64') } : null; }
async function pickImages(set) {
  const out = {};
  try {
    if (set.logo_id) { const r = await (await sbf('companies?id=eq.' + encodeURIComponent(set.logo_id) + '&select=logo')).json(); const d = dataUrl(r && r[0] && r[0].logo); if (d) out.logo = d; }
    if (set.sig_id) { const r = await (await sbf('signatures?id=eq.' + encodeURIComponent(set.sig_id) + '&select=img')).json(); const d = dataUrl(r && r[0] && r[0].img); if (d) out.sig = d; }
  } catch (e) { /* images are optional */ }
  return out;
}
function build(draft, set, imgs, to) {
  const sig = String(set.signature || '').trim(), opt = String(set.optout || '').trim(), body = String(draft.body || '').trim();
  const text = body + (sig ? '\n\n' + sig : '') + (opt ? '\n\n' + opt : '');
  const paras = body.split(/\n{2,}/).map(p => /^-{3,}$/.test(p.trim()) ? '<hr style="border:none;border-top:1px solid #ddd;margin:16px 0">' : '<p style="margin:0 0 12px">' + esc(p).replace(/\n/g, '<br>') + '</p>').join('');
  const att = [];
  let sigHtml = sig ? '<div style="margin-top:16px">' + esc(sig).replace(/\n/g, '<br>') + '</div>' : '';
  if (imgs.sig) { att.push({ filename: 'signature', cid: 'sigimg@jild', contentType: imgs.sig.contentType, content: imgs.sig.content, contentDisposition: 'inline' }); sigHtml += '<div style="margin-top:8px"><img src="cid:sigimg@jild" alt="" style="max-height:48px"></div>'; }
  if (imgs.logo) { att.push({ filename: 'logo', cid: 'logoimg@jild', contentType: imgs.logo.contentType, content: imgs.logo.content, contentDisposition: 'inline' }); sigHtml += '<div style="margin-top:8px"><img src="cid:logoimg@jild" alt="" style="max-height:56px"></div>'; }
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.5;color:#222">' + paras + sigHtml + (opt ? '<div style="margin-top:16px;font-size:12px;color:#777">' + esc(opt) + '</div>' : '') + '</div>';
  const from = fromAddr();
  return { from, to, subject: String(draft.subject || '').replace(/[\r\n]+/g, ' ').trim(), text, html, attachments: att, headers: { 'List-Unsubscribe': '<mailto:' + from.address + '?subject=unsubscribe>', 'Auto-Submitted': 'no' } };
}

async function userEmail(tok) {
  const u = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_ANON, Authorization: 'Bearer ' + tok } });
  if (!u.ok) return null; const j = await u.json(); return j && j.email || '';
}
async function settings() {
  const r = await (await sbf('outreach_settings?id=in.(main,send)&select=id,data')).json();
  const m = (r || []).find(x => x.id === 'main'), s = (r || []).find(x => x.id === 'send');
  return { main: (m && m.data) || {}, send: (s && s.data) || {} };
}
async function sentToday(now) { const r = await sbf('outreach_drafts?status=eq.sent&sent_at=gte.' + istDayStart(now).toISOString() + '&select=id', { headers: { Prefer: 'count=exact', Range: '0-0' } }); const c = (r.headers.get('content-range') || '').split('/')[1]; return +c || 0; }
async function firstSent() { const r = await (await sbf('outreach_drafts?status=eq.sent&select=sent_at&order=sent_at.asc&limit=1')).json(); return r && r[0] && r[0].sent_at ? new Date(r[0].sent_at) : null; }

async function tick(now) {
  const tr = mailer(); if (!tr) return { sent: 0, why: 'mailbox not connected' };
  const { main, send } = await settings();
  if (!send.enabled) return { sent: 0, why: 'sending is switched off' };
  const pre = await sbf('outreach_drafts?select=message_id,follow_due,last_error&limit=1');
  if (!pre.ok) return { sent: 0, why: 'run supabase-sending.sql in Supabase first' };
  const from = +send.hours_from || 9, to = +send.hours_to || 17;
  const fs = await firstSent(), days = fs ? Math.floor((now - fs) / 86400000) : 0, cap = warmCap(days, +send.daily_cap || 15), done = await sentToday(now);
  if (done >= cap) return { sent: 0, why: 'daily limit reached (' + done + ' of ' + cap + ')' };
  if ((T.random || Math.random)() < 0.25) return { sent: 0, why: 'pausing to space emails out' };
  const list = await (await sbf('outreach_drafts?status=eq.approved&select=*&order=approved_at.asc&limit=60')).json();
  const sup = new Set(((await (await sbf('outreach_suppress?select=email')).json()) || []).map(x => String(x.email).toLowerCase()));
  const since = new Date(now - 30 * 86400000).toISOString();
  const recent = ((await (await sbf('outreach_drafts?status=eq.sent&sent_at=gte.' + since + '&select=to_email')).json()) || []).map(x => String(x.to_email).toLowerCase());
  const rdom = new Set(recent.map(x => x.split('@')[1]));
  for (const d of list || []) {
    const em = String(d.to_email || '').trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) continue;
    if (sup.has(em) || sup.has('@' + em.split('@')[1])) { await sbf('outreach_drafts?id=eq.' + d.id, { method: 'PATCH', body: JSON.stringify({ status: 'skipped', last_error: 'On the do-not-contact list' }) }); continue; }
    if (d.step === 'intro' && (recent.includes(em) || rdom.has(em.split('@')[1]))) continue; // do not write twice to a company in 30 days
    if (!inWindow(now, d.country, from, to)) continue;
    // claim it first so two overlapping runs can never send the same email twice
    const claim = await sbf('outreach_drafts?id=eq.' + d.id + '&status=eq.approved', { method: 'PATCH', body: JSON.stringify({ status: 'sending' }) });
    const got = claim.ok ? await claim.json() : [];
    if (!got || !got.length) continue;
    const imgs = await pickImages(main), msg = build(d, main, imgs, em);
    try {
      const info = await tr.sendMail(msg);
      const done2 = await sbf('outreach_drafts?id=eq.' + d.id, { method: 'PATCH', body: JSON.stringify({ status: 'sent', sent_at: now.toISOString(), message_id: info && info.messageId || null, follow_due: addWorkingDays(now, 4).toISOString(), last_error: null }) });
      if (!done2.ok) await sbf('outreach_drafts?id=eq.' + d.id, { method: 'PATCH', body: JSON.stringify({ status: 'sent', sent_at: now.toISOString() }) });
      return { sent: 1, to: em, company: d.company };
    } catch (e) {
      const hard = /^5\d\d|rejected|mailbox unavailable|no such user|invalid recipient/i.test(String(e && (e.responseCode || e.message)));
      if (hard && e.rejected && e.rejected.length) await sbf('outreach_suppress', { method: 'POST', headers: { Prefer: 'resolution=ignore-duplicates' }, body: JSON.stringify({ email: em, reason: 'bounced' }) });
      await sbf('outreach_drafts?id=eq.' + d.id, { method: 'PATCH', body: JSON.stringify({ status: hard ? 'failed' : 'approved', last_error: String(e && e.message || e).slice(0, 300) }) });
      return { sent: 0, why: 'send failed: ' + String(e && e.message || e).slice(0, 120) };
    }
  }
  return { sent: 0, why: list && list.length ? 'nothing due right now (weekday and business hours in their country)' : 'no approved emails waiting' };
}

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  if (!svcKey()) return res.status(500).json({ error: 'SUPABASE_SERVICE_KEY is not set in Vercel.' });
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } } b = b || {};
  const now = T.now ? T.now() : new Date();
  try {
    if (b.action === 'tick') {
      const got = String(req.headers['x-outreach-secret'] || '');
      const { send } = await settings();
      const good = [send.secret, envv('OUTREACH_SECRET')].filter(Boolean);
      if (!got || !good.some(g => same(g, got))) return res.status(401).json({ error: 'Wrong secret' });
      return res.status(200).json({ ok: true, ...(await tick(now)) });
    }
    const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!tok) return res.status(401).json({ error: 'Please sign in again.' });
    const me = await userEmail(tok);
    if (me === null) return res.status(401).json({ error: 'Please sign in again.' });
    const connected = !!(envv('OUTREACH_USER') && envv('OUTREACH_PASS'));
    if (b.action === 'status') {
      const { send } = await settings(), fs = await firstSent(), days = fs ? Math.floor((now - fs) / 86400000) : 0;
      return res.status(200).json({ ok: true, connected, from: connected ? envv('OUTREACH_USER') : '', enabled: !!send.enabled, cap_today: warmCap(days, +send.daily_cap || 15), sent_today: await sentToday(now), has_secret: !!(send.secret || envv('OUTREACH_SECRET')) });
    }
    if (b.action === 'test') {
      const tr = mailer(); if (!tr) return res.status(400).json({ error: 'The mailbox is not connected yet. Add OUTREACH_USER and OUTREACH_PASS in Vercel and redeploy.' });
      if (!me) return res.status(400).json({ error: 'Your sign-in has no email address to send the test to.' });
      const { main } = await settings(), imgs = await pickImages(main);
      const msg = build({ subject: 'Test email from your outreach mailbox', body: 'Hello,\n\nThis is a test. It shows how your emails will look, with your signature, logo and opt-out line below.\n\n---\n\nBuongiorno,\n\nQuesta è una prova di come appariranno le sue email.' }, main, imgs, me);
      await tr.sendMail(msg);
      return res.status(200).json({ ok: true, to: me });
    }
    if (b.action === 'secret') {
      const { send } = await settings(); if (send.secret) return res.status(200).json({ ok: true, secret: send.secret });
      const secret = crypto.randomBytes(24).toString('hex');
      await sbf('outreach_settings', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' }, body: JSON.stringify({ id: 'send', data: { ...send, secret }, updated_at: now.toISOString() }) });
      return res.status(200).json({ ok: true, secret });
    }
    return res.status(400).json({ error: 'Unknown action' });
  } catch (e) { return res.status(502).json({ error: String(e && e.message || e).slice(0, 200) }); }
};
module.exports._t = { T, inWindow, tzOf, warmCap, addWorkingDays, build, istDayStart, tick };
