// Vercel serverless function: researches one company from its own public website (and its LWG page when one exists).
// Reads a few pages, then Claude writes a short, source-linked profile. Never guesses email addresses.
// Needs ANTHROPIC_API_KEY on Vercel. Optional: RESEARCH_MODEL (default Haiku, cheap).
const dns = require('dns').promises;
const net = require('net');
const SB_URL = 'https://ethhzxagxejxfxkzgndk.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aGh6eGFneGVqeGZ4a3pnbmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MDQwNjIsImV4cCI6MjA2NDI4MDA2Mn0.FMCc_AwksmDGQqGdCoazcxIJ7i3635fkrJinx5gNucA';
const MODEL = process.env.RESEARCH_MODEL || 'claude-haiku-5-5';
const UA = 'Mozilla/5.0 (compatible; Journal-buyer-research/1.0)';

const slug = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

// Only public web hosts. Blocks local and private addresses, also after redirects.
async function safeHost(host) {
  host = String(host || '').toLowerCase();
  if (!host || host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.localhost')) return false;
  const bad = ip => /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) || ip === '::1' || /^f[cd]/i.test(ip) || /^fe80/i.test(ip);
  if (net.isIP(host)) return !bad(host);
  try { const r = await dns.lookup(host, { all: true }); return r.length > 0 && r.every(a => !bad(a.address)); } catch (e) { return false; }
}
async function getPage(url, ms) {
  let u; try { u = new URL(/^https?:\/\//i.test(url) ? url : 'https://' + url); } catch (e) { return null; }
  if (!/^https?:$/.test(u.protocol) || !(await safeHost(u.hostname))) return null;
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), ms || 7000);
  try {
    const r = await fetch(u.href, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.5', 'Accept-Language': 'en,it;q=0.8,es;q=0.6' }, redirect: 'follow', signal: ctl.signal });
    const fu = new URL(r.url || u.href);
    if (!r.ok || !(await safeHost(fu.hostname))) return null;
    const ct = String(r.headers.get('content-type') || '');
    if (ct && !/text\/html|text\/plain|xml/i.test(ct)) return null;
    const html = (await r.text()).slice(0, 600000);
    return { url: fu.href, html };
  } catch (e) { return null; } finally { clearTimeout(t); }
}
const decode = s => s.replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function toText(html) {
  return decode(html.replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ').replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ')).replace(/[ \t\f\v]+/g, ' ').replace(/\n\s*/g, '\n').trim();
}
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g;
const JUNK = /(\.(png|jpe?g|gif|webp|svg|css|js)$|sentry|wixpress|example\.|yourdomain|domain\.com|@2x|noreply|no-reply|donotreply|privacy@|abuse@|webmaster@|postmaster@)/i;
function emailsOf(html) {
  const found = new Set();
  const de = decode(html).replace(/\s*\[\s*at\s*\]\s*|\s*\(\s*at\s*\)\s*/gi, '@').replace(/\s*\[\s*dot\s*\]\s*|\s*\(\s*dot\s*\)\s*/gi, '.');
  (de.match(EMAIL) || []).forEach(e => found.add(e.toLowerCase().replace(/^mailto:/, '')));
  [...html.matchAll(/mailto:([^"'?\s>]+)/gi)].forEach(m => { try { found.add(decodeURIComponent(m[1]).toLowerCase()); } catch (e) {} });
  return [...found].filter(e => !JUNK.test(e) && e.length < 80);
}
function pickLinks(html, base, host) {
  const out = []; const re = /<a\b[^>]*href=["']([^"'#]+)["'][^>]*>([\s\S]*?)<\/a>/gi; let m;
  while ((m = re.exec(html)) && out.length < 40) {
    let u; try { u = new URL(m[1], base); } catch (e) { continue; }
    if (u.hostname.replace(/^www\./, '') !== host.replace(/^www\./, '')) continue;
    const label = toText(m[2]).toLowerCase();
    const s = (u.pathname + ' ' + label).toLowerCase();
    let score = 0;
    if (/contact|contatt|kontakt|contacto|contactez/.test(s)) score = 3;
    else if (/about|chi-siamo|azienda|company|qui[eé]nes|nosotros|who-we|profile|history|storia/.test(s)) score = 2;
    else if (/product|prodott|articol|leather|pelli|pelle|cuoio|collection|catalog/.test(s)) score = 1;
    if (score) out.push({ href: u.href, score });
  }
  const seen = new Set();
  return out.sort((a, b) => b.score - a.score).filter(x => (seen.has(x.href) ? false : seen.add(x.href))).slice(0, 4).map(x => x.href);
}
function lwgSlugs(name) {
  const n = clean(name).replace(/\s*\(.*?\)\s*/g, ' ').replace(/\s+[-–—]\s+(trader|agent|manufacturer)$/i, '');
  const v = new Set([slug(n)]);
  v.add(slug(n.replace(/\bS\.?R\.?L\.?\b/i, 'S.r.l.')));
  v.add(slug(n.replace(/\bS\.?R\.?L\.?\b/i, 'S R L')));
  v.add(slug(n.replace(/\bS\.?P\.?A\.?\b/i, 'S.p.A.')));
  return [...v].filter(Boolean);
}
async function lwgPage(names) {
  for (const nm of names) for (const sg of lwgSlugs(nm)) {
    const r = await getPage('https://www.leatherworkinggroup.com/get-involved/our-community/certified-suppliers/' + sg + '/', 6000);
    if (!r) continue;
    const text = toText(r.html);
    const c = text.match(/Contact\s*\n?\s*([^\n]{2,80})\n\s*Email/i), em = emailsOf(r.html).filter(e => !/leatherworkinggroup/.test(e));
    if (em.length || c) return { url: r.url, contact: c ? clean(c[1]) : '', emails: em };
  }
  return null;
}

const TOOL = {
  name: 'record_company_profile',
  description: 'Record what the pages say about this company. Use only what is written on the pages.',
  input_schema: {
    type: 'object',
    properties: {
      business_type: { type: 'string', enum: ['manufacturer', 'tannery', 'trader', 'agent', 'brand', 'unclear'], description: 'manufacturer = makes finished goods (shoes, bags, upholstery, garments). tannery = makes leather. trader = buys and sells leather or goods. agent = commission agent or broker. brand = designs and sells under its own name.' },
      summary: { type: 'string', description: 'Two short sentences in plain English: what the company does and who it sells to.' },
      buys: { type: 'array', items: { type: 'string' }, description: 'What they buy or use: leather types, animals, articles (e.g. goat lining, cow upper leather). Only if stated.' },
      sells: { type: 'array', items: { type: 'string' }, description: 'What they make or sell.' },
      animals: { type: 'array', items: { type: 'string', enum: ['cow', 'goat', 'sheep', 'buffalo', 'pig', 'exotic', 'other'] } },
      markets: { type: 'array', items: { type: 'string' }, description: 'Countries or regions they sell to or work with, if stated.' },
      site_language: { type: 'string', description: 'Main language of the website, for example Italian.' },
      contacts: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, role: { type: 'string' }, email: { type: 'string' } }, required: ['name'] }, description: 'People named on the pages. Email only if printed next to or linked to that person.' },
      notes: { type: 'array', items: { type: 'string' }, description: 'At most 3 short things worth knowing before writing to them, such as certifications, brands they supply, or a named buyer. Nothing generic.' },
      facts: { type: 'array', items: { type: 'object', properties: { fact: { type: 'string' }, source_url: { type: 'string' } }, required: ['fact', 'source_url'] }, description: 'The 3 to 6 most useful facts, each with the page address it came from.' },
      unclear: { type: 'array', items: { type: 'string' }, description: 'What you could not find out.' }
    },
    required: ['business_type', 'summary', 'unclear']
  }
};
const PROMPT = `You are researching a company so a leather exporter can write a short, honest introduction. Below is text copied from the company's website pages and, when available, its Leather Working Group (LWG) listing.
Rules:
- Use only what is written in the text. Never invent a fact, a person, a product or an email address.
- If the site does not say what they buy, leave "buys" empty and say so in "unclear".
- business_type: judge from the text and the LWG member type, and say "unclear" when the evidence is thin.
- Each fact must carry the address of the page it came from.
- Keep every sentence short and plain.`;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const key = require('./_env').envv('ANTHROPIC_API_KEY');
  if (!key) return res.status(500).json({ error: 'Research is not set up yet. Add ANTHROPIC_API_KEY in Vercel and redeploy.' });
  const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok) return res.status(401).json({ error: 'Please sign in again.' });
  try {
    const u = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + tok } });
    if (!u.ok) return res.status(401).json({ error: 'Please sign in again.' });
  } catch (e) { return res.status(502).json({ error: 'Could not check your sign in.' }); }
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  b = b || {};
  const names = (Array.isArray(b.names) ? b.names : [b.name]).map(clean).filter(Boolean).slice(0, 4);
  const country = clean(b.country).slice(0, 60), lwgType = clean(b.type).slice(0, 60), animals = clean(b.animals).slice(0, 120);
  const sites = (Array.isArray(b.sites) ? b.sites : [b.site]).map(clean).filter(Boolean).slice(0, 3);
  if (!names.length) return res.status(400).json({ error: 'No company given.' });
  try {
    const pages = []; let emails = [];
    const hostOf = s => { try { return new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s).hostname; } catch (e) { return ''; } };
    const site = sites.find(s => hostOf(s) && !/^n\/?a$/i.test(s));
    if (site) {
      const home = await getPage(site, 8000);
      if (home) {
        pages.push(home);
        const host = new URL(home.url).hostname;
        const more = pickLinks(home.html, home.url, host);
        const got = await Promise.all(more.map(l => getPage(l, 7000)));
        got.filter(Boolean).forEach(p => pages.push(p));
      }
    }
    const lwg = await lwgPage(names);
    let text = '';
    if (lwg) text += `LWG listing (${lwg.url})\nContact person: ${lwg.contact}\nEmails printed: ${lwg.emails.join(', ')}\n\n`;
    text += `Company name on LWG: ${names.join(' / ')}\nCountry: ${country}\nLWG member type: ${lwgType}\nLWG animals: ${animals}\n\n`;
    pages.forEach(p => { text += `--- PAGE ${p.url}\n${toText(p.html).slice(0, 5000)}\n\n`; emails = emails.concat(emailsOf(p.html)); });
    if (lwg) emails = emails.concat(lwg.emails);
    const dom = site ? hostOf(site).replace(/^www\./, '') : '';
    emails = [...new Set(emails)].sort((a, c) => (c.endsWith('@' + dom) ? 1 : 0) - (a.endsWith('@' + dom) ? 1 : 0)).slice(0, 8);
    text += 'Email addresses printed on the pages: ' + (emails.join(', ') || 'none') + '\n';
    if (!pages.length && !lwg) return res.status(200).json({ ok: false, reason: 'no_pages', emails: [], pages: [], profile: null });
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, tools: [TOOL], tool_choice: { type: 'tool', name: 'record_company_profile' }, messages: [{ role: 'user', content: PROMPT + '\n\n' + text.slice(0, 26000) }] })
    });
    const j = await r.json();
    if (!r.ok) throw Object.assign(new Error((j && j.error && j.error.message) || 'The research step failed.'), { status: 502 });
    const t = (j.content || []).find(c => c.type === 'tool_use');
    if (!t) throw Object.assign(new Error('No profile came back.'), { status: 502 });
    const prof = t.input;
    const printed = new Set(emails);
    (prof.contacts || []).forEach(c => { if (c.email && !printed.has(String(c.email).toLowerCase())) c.email = ''; });
    return res.status(200).json({ ok: true, profile: prof, emails, lwg: lwg ? { url: lwg.url, contact: lwg.contact } : null, pages: pages.map(p => p.url) });
  } catch (e) {
    return res.status(e.status || 502).json({ error: e.message || 'Research failed.' });
  }
};
module.exports._t = { emailsOf, pickLinks, lwgSlugs, toText, safeHost };
