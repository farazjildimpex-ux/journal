// Vercel serverless function: the research engine behind the Intelligence page.
// One company at a time, in short steps so no single request runs long. The run's state lives in intel_runs,
// written as the signed-in user. With "bg" the server drives the steps itself after answering (waitUntil), handing
// over to a fresh request before the time limit, so the research goes on when the app is closed or the page changes;
// the app only watches intel_runs. Older apps still call "step" themselves.
// Needs ANTHROPIC_API_KEY on Vercel. Optional: INTEL_MODEL (default Sonnet).
const { envv } = require('./_env');
const { getPage, toText, pageDate } = require('./_web');
const { waitUntil } = require('@vercel/functions');

const SB_URL = 'https://ethhzxagxejxfxkzgndk.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aGh6eGFneGVqeGZ4a3pnbmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MDQwNjIsImV4cCI6MjA2NDI4MDA2Mn0.FMCc_AwksmDGQqGdCoazcxIJ7i3635fkrJinx5gNucA';
const MODEL = process.env.INTEL_MODEL || 'claude-sonnet-5-5';
const MAXSTEP = 9, MAXSEARCH = 10, PAGE_CHARS = 4000, READS = 2;
// Searches only ever land on sites that publish customs records, so none is spent on company websites or news.
const TRADE_SITES = ['importgenius.com', 'panjiva.com', 'importyeti.com', 'volza.com', 'trademo.com', 'tendata.com', '52wmb.com',
  'eximpedia.app', 'seair.co.in', 'exportgenius.in', 'infodriveindia.com', 'cybex.in', 'tradeimex.in', 'zauba.com',
  'connect2india.com', 'marketinsidedata.com', 'nbd.ltd', 'tradesns.com', 'exportimportdata.in'];
const clean = v => String(v == null ? '' : v).replace(/\s+/g, ' ').trim();

/* ---------- Supabase, as the person who is signed in ---------- */
async function sbq(tok, path, opts) {
  const o = opts || {};
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    method: o.method || 'GET',
    headers: Object.assign({ apikey: SB_KEY, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' }, o.headers || {}),
    body: o.body ? JSON.stringify(o.body) : undefined
  });
  const t = await r.text();
  let j = null; try { j = t ? JSON.parse(t) : null; } catch (e) {}
  if (!r.ok) throw Object.assign(new Error((j && (j.message || j.error)) || 'The database refused that.'), { status: 502 });
  return j;
}

/* ---------- UN Comtrade: free public preview, no key, country totals only ---------- */
const M49 = {
  'afghanistan': 4, 'albania': 8, 'algeria': 12, 'argentina': 32, 'australia': 36, 'austria': 40, 'bangladesh': 50, 'belarus': 112,
  'belgium': 56, 'bosnia and herzegovina': 70, 'brazil': 76, 'bulgaria': 100, 'cambodia': 116, 'canada': 124, 'chile': 152, 'china': 156,
  'colombia': 170, 'croatia': 191, 'cyprus': 196, 'czechia': 203, 'czech republic': 203, 'denmark': 208, 'dominican republic': 214,
  'ecuador': 218, 'egypt': 818, 'estonia': 233, 'ethiopia': 231, 'finland': 246, 'france': 251, 'georgia': 268, 'germany': 276, 'ghana': 288,
  'greece': 300, 'guatemala': 320, 'honduras': 340, 'hong kong': 344, 'hungary': 348, 'iceland': 352, 'india': 699, 'indonesia': 360,
  'ireland': 372, 'israel': 376, 'italy': 380, 'japan': 392, 'jordan': 400, 'kenya': 404, 'latvia': 428, 'lithuania': 440, 'luxembourg': 442,
  'malaysia': 458, 'malta': 470, 'mexico': 484, 'morocco': 504, 'myanmar': 104, 'nepal': 524, 'netherlands': 528, 'new zealand': 554,
  'nigeria': 566, 'north macedonia': 807, 'norway': 579, 'pakistan': 586, 'peru': 604, 'philippines': 608, 'poland': 616, 'portugal': 620,
  'romania': 642, 'russia': 643, 'russian federation': 643, 'saudi arabia': 682, 'serbia': 688, 'singapore': 702, 'slovakia': 703,
  'slovenia': 705, 'south africa': 710, 'south korea': 410, 'korea, republic of': 410, 'republic of korea': 410, 'spain': 724,
  'sri lanka': 144, 'sweden': 752, 'switzerland': 757, 'taiwan': 490, 'thailand': 764, 'tunisia': 788, 'turkey': 792, 'türkiye': 792,
  'uganda': 800, 'ukraine': 804, 'united arab emirates': 784, 'uae': 784, 'united kingdom': 826, 'uk': 826, 'united states': 842,
  'united states of america': 842, 'usa': 842, 'uruguay': 858, 'uzbekistan': 860, 'vietnam': 704, 'viet nam': 704, 'zimbabwe': 716
};
const ALT = { 251: 250, 757: 756, 579: 578 };
const HSN = {
  '4104': 'Bovine leather, tanned (wet blue and crust)', '4105': 'Sheep or lamb leather, tanned', '4106': 'Goat, pig or other leather, tanned',
  '4107': 'Bovine finished leather', '4112': 'Sheep or lamb finished leather', '4113': 'Goat or other finished leather',
  '4114': 'Patent and metallised leather', '4203': 'Leather apparel and accessories', '4202': 'Bags and cases',
  '6403': 'Footwear with leather uppers', '6404': 'Footwear with textile uppers', '6406': 'Shoe uppers and parts'
};
const cCode = c => M49[String(c || '').toLowerCase().replace(/\s*\(.*\)\s*$/, '').trim()] || 0;

async function comtrade(code, hs, year) {
  const u = 'https://comtradeapi.un.org/public/v1/preview/C/A/HS?reporterCode=' + code + '&period=' + year +
    '&partnerCode=699&flowCode=M&cmdCode=' + hs + '&motCode=0&partner2Code=0&customsCode=C00&includeDesc=true';
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 9000);
  try {
    const r = await fetch(u, { headers: { Accept: 'application/json' }, signal: ctl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    const rows = (j && (j.data || j.dataset)) || [];
    if (!rows.length) return null;
    let value = 0, wgt = 0;
    rows.forEach(x => { value += Number(x.primaryValue || x.PrimaryValue || 0) || 0; wgt += Number(x.netWgt || x.NetWgt || 0) || 0; });
    return { value, weight: wgt, rows: rows.length };
  } catch (e) { return null; } finally { clearTimeout(t); }
}

async function tradeLook(country, hs, year) {
  const code = cCode(country);
  if (!code) return { ok: false, note: 'No UN country code is known here for "' + country + '", so the trade figures could not be looked up.' };
  const yr = Number(year) || (new Date().getFullYear() - 1);
  let got = await comtrade(code, hs, yr);
  if (!got && ALT[code]) got = await comtrade(ALT[code], hs, yr);
  if (!got && yr > 2015) got = await comtrade(code, hs, yr - 1);
  if (!got) return { ok: false, note: 'UN Comtrade returned nothing for ' + country + ', HS ' + hs + ', ' + yr + '. Treat this as unavailable, not as zero trade.' };
  return {
    ok: true, country, partner: 'India', hs, hs_name: HSN[hs] || '', year: yr,
    value_usd: Math.round(got.value), weight_kg: Math.round(got.weight),
    source_name: 'UN Comtrade', source_url: 'https://comtradeplus.un.org/TradeFlow?Frequency=A&Flows=M&CommodityCodes=' + hs + '&Partners=699&Reporters=' + code + '&period=' + yr,
    note: 'Country-level import total for ' + country + ' from India. This is an aggregate statistic about two countries, not about this company.'
  };
}

/* ---------- what the model may do ---------- */
const CLAIM = { type: 'string', enum: ['verified', 'supported', 'possible', 'unavailable'] };
const CONF = { type: 'string', enum: ['high', 'medium', 'low'] };
const S = { type: 'string' };
const TOOLS = [
  { type: 'web_search_20250305', name: 'web_search', max_uses: MAXSEARCH, allowed_domains: TRADE_SITES },
  {
    name: 'read_page', description: 'Read one public web page and get its text back. Use it on pages worth reading in full: the company website, a supplier or sustainability list, an exhibitor directory, a filing, a news article.',
    input_schema: { type: 'object', properties: { url: { type: 'string' }, why: { type: 'string', description: 'A few words on what you expect to find.' } }, required: ['url'] }
  },
  {
    name: 'record', strict: true, description: 'Record the trading partners, what is traded, and whether it fits. Call this once.',
    input_schema: {
      type: 'object', additionalProperties: false,
      properties: {
        direction: { type: 'string', enum: ['imports', 'exports'], description: 'imports: who this company buys from. exports: who this company sells to.' },
        business: { type: 'string', description: 'One sentence on what the company is.' },
        links: {
          type: 'array', description: 'The trading partners in the direction asked, one row each, only as a page shows them.',
          items: { type: 'object', additionalProperties: false, properties: { name: S, kind: { type: 'string', enum: ['supplier', 'customer', 'indian_supplier', 'exporter', 'tannery', 'trader', 'agent', 'forwarder'] }, country: S, shipments: { type: 'string', description: 'The count the page shows for this partner, copied exactly.' }, last_date: { type: 'string', description: 'The latest shipment date the page shows, copied exactly.' }, note: { type: 'string', description: 'Product or volume the page shows for this partner.' }, claim: CLAIM, confidence: CONF, source_name: S, source_url: S, source_date: S }, required: ['name', 'kind', 'claim', 'confidence'] }
        },
        buys: {
          type: 'array', description: 'What is traded in that direction: for imports, what they buy; for exports, what they sell. As the record words it.',
          items: { type: 'object', additionalProperties: false, properties: { product: S, hs: S, from: { type: 'string', description: 'For imports, where it comes from. For exports, where it goes.' }, qty: { type: 'string', description: 'Volume or weight as printed.' }, last_date: S, source_name: S, source_url: S, claim: CLAIM, confidence: CONF }, required: ['product', 'claim', 'confidence'] }
        },
        fit: {
          type: 'object', additionalProperties: false, properties: {
            verdict: { type: 'string', enum: ['strong', 'partial', 'none', 'unclear'] },
            why: { type: 'string', description: 'One or two sentences naming the products on both sides.' },
            match: { type: 'array', items: S, description: 'What we sell that they trade in.' },
            miss: { type: 'array', items: S, description: 'What they trade in that we do not sell.' }
          }, required: ['verdict', 'why']
        },
        next_move: { type: 'string', description: 'One practical sentence: what to offer them, or what to check next.' },
        sources_tried: {
          type: 'array', description: 'Every page or site tried and what it gave, including the empty ones.',
          items: { type: 'object', additionalProperties: false, properties: { source: S, url: S, found: { type: 'string', enum: ['partners', 'shipments', 'profile', 'nothing', 'blocked'] }, note: S }, required: ['source', 'found'] }
        }
      },
      required: ['direction', 'links', 'buys', 'fit', 'next_move', 'sources_tried']
    }
  }
];

const SYS = `You find the trading partners of one company for JILD IMPEX, a leather sourcing agency in Chennai, India, that supplies Indian finished leather, linings, uppers and leather products to buyers overseas.

Only three things matter, nothing else:
1. Its trading partners in the direction asked. For a company outside India: who it imports from, Indian suppliers first. For a company in India: who it exports to, its foreign buyers.
2. What is traded in that direction: the product as the record words it, the HS code, the volume, the latest date.
3. Whether that lines up with what JILD IMPEX sells, and the one thing to do next.
No company history, no management, no certifications, no marketing copy.

The partner pages have already been opened for you and are in the first message. Read them first. If they name partners, call record straight away without searching.
Then search. Every search only returns pages from customs-data sites (ImportGenius, Trademo, Tendata, 52wmb, Volza, Eximpedia, Panjiva, ImportYeti, NBD and similar), so search the company by name and read what the results show. Customs records often spell names differently from the company itself: German ü becomes ue (Klümpen is KLUEMPEN), dots and "& Co." disappear, "GmbH & Co. KG" becomes "GMBH CO KG". Search those spellings too. Most of these sites refuse page reads, so rely on what the search results themselves show; use read_page only for importgenius.com pages, and you may build an ImportGenius address from a spelling you found (www.importgenius.com/importers/<name-with-hyphens> for a buyer, /suppliers/<name> for a shipper). Stop once you have the partners.

Rules
- Record only what a page shows. Copy names, counts, weights and dates exactly as printed. Never fill in what a paywall hides. Never guess.
- Never invent a partner, a shipment, a date or a quantity, and never claim access to a paid database.
- A partner row is one named company. "Three unnamed suppliers" or a list of countries is not a partner: put what is known about unnamed suppliers into buys or into a partner's note. The partner's country is the one the page prints for that company; never assume a country from the product or the port.
- Every partner and product line carries the page address it came from, a claim and a confidence. claim: verified (the page states it about this company), supported (more than one source), possible (one weak source), unavailable (nothing found).
- List every source tried in sources_tried, including the empty ones.
- If nothing is published, say so. An honest "nothing published" is a useful answer.

fit: strong when they trade in what we sell, partial for some of it, none when they do not, unclear when there is not enough to tell. Name the products on both sides.
next_move: one practical sentence, such as which product to offer them, or which partner to look at next.

Short plain lines, the way one trader writes to another.`;

/* ---------- the partner pages, fetched before the model starts ---------- */
const slug = n => String(n || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
const TRIM = /-(s-?p-?a|s-?r-?l-?s?|srl|spa|gmbh|bv|nv|sa|sas|sarl|ltd|limited|llc|inc|co|kg|ag|ab|as|oy|plc|pvt|sl|slu|lda)$/;
// Customs records spell the legal form both ways, so try "-spa" and "-s-p-a" before giving up.
function altSlug(a) {
  if (/-s-p-a$/.test(a)) return a.replace(/-s-p-a$/, '-spa');
  if (/-spa$/.test(a)) return a.replace(/-spa$/, '-s-p-a');
  if (/-s-r-l$/.test(a)) return a.replace(/-s-r-l$/, '-srl');
  if (/-srl$/.test(a)) return a.replace(/-srl$/, '-s-r-l');
  return '';
}
// An Indian company: who it exports to. Anyone else: who it imports from.
// /suppliers/ is the company as a shipper (its buyers); /importers/ is the company as a buyer (its suppliers).
function seedUrls(names, indian) {
  const sl = [];
  const add = x => { if (x && sl.indexOf(x) < 0 && sl.length < 3) sl.push(x); };
  (names || []).forEach(n => { const a = slug(n); add(a); add(altSlug(a)); add(a.replace(TRIM, '')); });
  const G = 'https://www.importgenius.com/';
  const out = [];
  sl.forEach((x, i) => {
    if (indian) {
      out.push(['ImportGenius, as exporter', G + 'suppliers/' + x]);
      if (i === 0) out.push(['ImportGenius India, as exporter', G + 'india/exporters/' + x]);
    } else {
      out.push(['ImportGenius, as importer', G + 'importers/' + x]);
      if (i === 0) { out.push(['ImportGenius India, as buyer', G + 'india/importers/' + x]); out.push(['ImportGenius, as exporter', G + 'suppliers/' + x]); }
    }
  });
  return out.slice(0, 6);
}
async function seedFetch(names, indian) {
  const list = seedUrls(names, indian);
  const got = await Promise.all(list.map(async ([nm, u]) => {
    const p = await getPage(u, 9000);
    if (!p) return { nm, u, text: '', blocked: true };
    const t = toText(p.html), head = t.slice(0, 2500);
    if (/just a moment|checking your browser|attention required|enable javascript and cookies|access denied|verify you are human/i.test(head)) return { nm, u, text: '', blocked: true };
    return { nm, u, text: /no (results|records|shipments) found|page not found|404/i.test(head) ? '' : t.slice(0, 3200) };
  }));
  return got;
}

/* ---------- the model turn ---------- */
async function turn(key, messages, force, noWeb) {
  const body = {
    model: MODEL, max_tokens: 4000, system: [{ type: 'text', text: SYS, cache_control: { type: 'ephemeral' } }],
    tools: noWeb ? TOOLS.filter(t => t.name !== 'web_search') : TOOLS, messages
  };
  if (force) body.tool_choice = { type: 'tool', name: 'record' };
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body)
  });
  const j = await r.json();
  if (!r.ok) throw Object.assign(new Error((j && j.error && j.error.message) || 'The research step failed.'), { status: 502 });
  return j;
}

// What the step just did, for the progress line on screen.
function noteOf(blocks) {
  const q = [], u = [];
  blocks.forEach(b => {
    if (b.type === 'server_tool_use' && b.input && b.input.query) q.push(b.input.query);
    if (b.type === 'tool_use' && b.name === 'read_page' && b.input) u.push(b.input.url);
    if (b.type === 'tool_use' && b.name === 'trade_lookup' && b.input) u.push('UN Comtrade, HS ' + b.input.hs);
  });
  if (q.length) return 'Searched: ' + q.slice(0, 3).join(' · ');
  if (u.length) return 'Reading ' + u.slice(0, 2).map(x => String(x).replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)).join(', ');
  return 'Thinking it through';
}

async function runTools(blocks) {
  const out = [];
  let reads = 0;
  for (const b of blocks) {
    if (b.type !== 'tool_use' || b.name === 'record') continue;
    let content = '';
    if (b.name === 'read_page') {
      if (reads >= READS) content = 'Not read: too many pages in one step. Ask for it again in the next step if it still matters.';
      else {
        reads++;
        const p = await getPage((b.input || {}).url, 8000);
        content = p ? ('PAGE ' + p.url + (pageDate(p.html) ? '\nPage date: ' + pageDate(p.html) : '') + '\n' + toText(p.html).slice(0, PAGE_CHARS))
          : 'That page could not be read: it blocked the request, timed out, or is not a public web page. Record it in sources_tried as blocked, use whatever the search result itself showed, and do not guess the rest.';
      }
    } else if (b.name === 'trade_lookup') {
      const i = b.input || {};
      content = JSON.stringify(await tradeLook(i.country, String(i.hs || '').slice(0, 6), i.year));
    } else content = 'Unknown tool.';
    out.push({ type: 'tool_result', tool_use_id: b.id, content });
  }
  return out;
}

/* ---------- the handler ---------- */
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const akey = envv('ANTHROPIC_API_KEY');
  const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok) return res.status(401).json({ error: 'Please sign in again.' });
  try {
    const u = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + tok } });
    if (!u.ok) return res.status(401).json({ error: 'Please sign in again.' });
  } catch (e) { return res.status(502).json({ error: 'Could not check your sign in.' }); }
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  b = b || {};

  try {
    if (b.action === 'trade') {
      return res.status(200).json(await tradeLook(clean(b.country), clean(b.hs).slice(0, 6), b.year));
    }

    if (b.action === 'start') {
      if (!akey) return res.status(500).json({ error: 'Research is not set up yet. Add ANTHROPIC_API_KEY in Vercel and redeploy.' });
      const key = clean(b.key).slice(0, 200);
      const company = clean(b.company).slice(0, 200);
      if (!key || !company) return res.status(400).json({ error: 'No company given.' });
      const kind = b.kind === 'monitor' ? 'monitor' : 'investigate';
      const names = (Array.isArray(b.names) ? b.names : []).map(clean).filter(Boolean).slice(0, 4);
      const sites = (Array.isArray(b.sites) ? b.sites : []).map(clean).filter(Boolean).slice(0, 3);
      const known = clean(b.known).slice(0, 6000);
      const sell = clean(b.sell).slice(0, 900);
      const indian = /^\s*india\b/i.test(clean(b.country));
      const pages = await seedFetch([company].concat(names), indian);
      const hit = pages.filter(x => x.text);
      const ask = [
        'Company: ' + company,
        names.length > 1 ? 'Also written as: ' + names.join(' / ') : '',
        'Country: ' + (clean(b.country) || 'not stated'),
        sites.length ? 'Website: ' + sites.join(', ') : '',
        '',
        indian
          ? 'This is an Indian company. Find who it EXPORTS to: its foreign buyers, what it ships them, how much and when. direction is exports.'
          : 'This company is outside India. Find who it IMPORTS from: its suppliers, Indian ones first, what it buys from them, how much and when. direction is imports.',
        '',
        'What JILD IMPEX sells: ' + (sell || 'Indian finished leather, linings, uppers, and leather products.'),
        '',
        hit.length
          ? 'Partner pages already opened for you (read these first; if they name partners, call record now without searching):'
          : 'The partner pages below were opened and had nothing on this company. Try a few searches, then call record.',
        ...pages.map(x => '\n--- ' + x.nm + ' · ' + x.u + '\n' + (x.text || '(nothing on this company here)')),
        '',
        known ? (kind === 'monitor'
          ? 'Already on file from the last check. Report the partners and products as they stand now, and say in next_move what is new since then, or that nothing is:\n' + known
          : 'Already on file:\n' + known) : ''
      ].filter(x => x !== '').join('\n');
      const seeds = pages.map(x => ({ source: x.nm, url: x.u, found: x.text ? 'profile' : x.blocked ? 'blocked' : 'nothing', note: x.text ? 'Opened by the app; partners read from it' : x.blocked ? 'The site refused the app' : 'No page under this name' }));
      const state = { messages: [{ role: 'user', content: [{ type: 'text', text: ask, cache_control: { type: 'ephemeral' } }] }], step: 0, searches: 0, seeds };
      const row = await sbq(tok, 'intel_runs', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: { key, kind, status: 'running', model: MODEL, state }
      });
      if (b.bg) waitUntil(drive(tok, akey, row[0].id, originOf(req)));
      return res.status(200).json({ run_id: row[0].id, status: 'running', step: 0, note: 'Starting' });
    }

    if (b.action === 'step') {
      if (!akey) return res.status(500).json({ error: 'Research is not set up yet. Add ANTHROPIC_API_KEY in Vercel and redeploy.' });
      const id = clean(b.run_id);
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'No run given.' });
      const r = await stepRun(tok, akey, id);
      return res.status(r.code || 200).json(r.body);
    }

    if (b.action === 'drive') {
      if (!akey) return res.status(500).json({ error: 'Research is not set up yet. Add ANTHROPIC_API_KEY in Vercel and redeploy.' });
      const id = clean(b.run_id);
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'No run given.' });
      const got = await sbq(tok, 'intel_runs?id=eq.' + id + '&select=id,status');
      if (!got || !got[0]) return res.status(404).json({ error: 'That run is gone.' });
      if (got[0].status === 'running') waitUntil(drive(tok, akey, id, originOf(req)));
      return res.status(200).json({ ok: true, status: got[0].status });
    }

    return res.status(400).json({ error: 'Unknown request.' });
  } catch (e) {
    return res.status(e.status || 502).json({ error: e.message || 'That did not work.' });
  }
};

/* ---------- one step of a run, and the driver that runs the steps on the server ---------- */
async function stepRun(tok, akey, id) {
  const got = await sbq(tok, 'intel_runs?id=eq.' + id + '&select=*');
  const run = got && got[0];
  if (!run) return { code: 404, body: { error: 'That run is gone.' } };
  if (run.status !== 'running') return { body: { status: run.status, step: run.steps, note: 'Finished', result: (run.changes || {}).result || null } };
  const st = run.state || { messages: [], step: 0, searches: 0 };
  const last = st.step + 1 >= MAXSTEP;
  let j;
  try {
    try { j = await turn(akey, st.messages, last, st.noWeb); }
    catch (e1) {
      if (st.noWeb || st.step > 0 || !/web.?search|server tool|tool type|not supported/i.test(String(e1.message || ''))) throw e1;
      st.noWeb = true; j = await turn(akey, st.messages, last, true);
    }
  } catch (e) {
    await sbq(tok, 'intel_runs?id=eq.' + id, { method: 'PATCH', body: { status: 'failed', error: String(e.message || e).slice(0, 400), finished_at: new Date().toISOString() } });
    return { code: 502, body: { status: 'failed', error: e.message || 'The research step failed.' } };
  }
  const blocks = j.content || [];
  const used = ((j.usage || {}).server_tool_use || {}).web_search_requests || 0;
  st.searches += used; st.step += 1;
  st.messages.push({ role: 'assistant', content: blocks });
  const rec = blocks.find(x => x.type === 'tool_use' && x.name === 'record');
  if (rec) {
    const tried = (rec.input.sources_tried || []), seen = new Set(tried.map(x => x.url).filter(Boolean));
    rec.input.sources_tried = (st.seeds || []).filter(x => !seen.has(x.url)).concat(tried);
    await sbq(tok, 'intel_runs?id=eq.' + id, {
      method: 'PATCH', body: { status: 'done', steps: st.step, searches: st.searches, state: null, changes: { result: rec.input }, finished_at: new Date().toISOString() }
    });
    return { body: { status: 'done', step: st.step, searches: st.searches, result: rec.input } };
  }
  const results = await runTools(blocks);
  if (results.length) st.messages.push({ role: 'user', content: results });
  else if (j.stop_reason === 'pause_turn') { /* a long search turn: send it straight back, untouched */ }
  else if (j.stop_reason === 'end_turn' || j.stop_reason === 'max_tokens') st.messages.push({ role: 'user', content: [{ type: 'text', text: 'Now call record with everything you have. Leave out nothing you established, and be plain about what you could not find.' }] });
  // keep the cache marker on the newest block only
  st.messages.forEach((m, i) => { if (Array.isArray(m.content)) m.content.forEach(c => { if (c && c.cache_control && i < st.messages.length - 2) delete c.cache_control; }); });
  const tail = st.messages[st.messages.length - 1];
  if (tail && Array.isArray(tail.content) && tail.content.length) { const c = tail.content[tail.content.length - 1]; if (c && typeof c === 'object' && c.type !== 'tool_result') c.cache_control = { type: 'ephemeral' }; }
  st.note = noteOf(blocks); st.at = Date.now();
  // stopped from the app while this step ran: keep it stopped
  const now = await sbq(tok, 'intel_runs?id=eq.' + id + '&select=status');
  if (!now || !now[0] || now[0].status !== 'running') return { body: { status: (now && now[0] && now[0].status) || 'stopped' } };
  await sbq(tok, 'intel_runs?id=eq.' + id, { method: 'PATCH', body: { state: st, steps: st.step, searches: st.searches } });
  return { body: { status: 'running', step: st.step, searches: st.searches, note: st.note } };
    }
const BUDGET = 150000;   // hand over to a fresh request well before the function's time limit
const originOf = req => 'https://' + String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
async function drive(tok, akey, id, origin) {
  const t0 = Date.now();
  try {
    for (let i = 0; i < MAXSTEP + 2; i++) {
      const r = await stepRun(tok, akey, id);
      if (!r.body || r.body.status !== 'running') return;
      if (Date.now() - t0 > BUDGET) {
        await fetch(origin + '/api/intel', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok }, body: JSON.stringify({ action: 'drive', run_id: id }) });
        return;
      }
    }
  } catch (e) {
    try { await sbq(tok, 'intel_runs?id=eq.' + id, { method: 'PATCH', body: { status: 'failed', error: String(e.message || e).slice(0, 400), finished_at: new Date().toISOString() } }); } catch (e2) {}
  }
}
module.exports._t = { cCode, tradeLook, noteOf, HSN, slug, seedUrls, TOOLS, SYS };
