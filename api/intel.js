// Vercel serverless function: the research engine behind the Intelligence page.
// One company at a time, in short steps so no single request runs long: the app calls "start" once,
// then "step" until the run says done. The run's state lives in intel_runs, written as the signed-in user.
// Needs ANTHROPIC_API_KEY on Vercel. Optional: INTEL_MODEL (default Sonnet).
const { envv } = require('./_env');
const { getPage, toText, pageDate } = require('./_web');

const SB_URL = 'https://ethhzxagxejxfxkzgndk.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aGh6eGFneGVqeGZ4a3pnbmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MDQwNjIsImV4cCI6MjA2NDI4MDA2Mn0.FMCc_AwksmDGQqGdCoazcxIJ7i3635fkrJinx5gNucA';
const MODEL = process.env.INTEL_MODEL || 'claude-sonnet-5-5';
const MAXSTEP = 18, MAXSEARCH = 26, PAGE_CHARS = 6500, READS = 4;
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
  { type: 'web_search_20250305', name: 'web_search', max_uses: MAXSEARCH },
  {
    name: 'read_page', description: 'Read one public web page and get its text back. Use it on pages worth reading in full: the company website, a supplier or sustainability list, an exhibitor directory, a filing, a news article.',
    input_schema: { type: 'object', properties: { url: { type: 'string' }, why: { type: 'string', description: 'A few words on what you expect to find.' } }, required: ['url'] }
  },
  {
    name: 'trade_lookup', description: 'Country-level import totals from India, from UN Comtrade. Aggregate statistics about countries, never about one company. Use it for context on whether this buyer\'s country buys Indian leather at all.',
    input_schema: { type: 'object', properties: { country: { type: 'string' }, hs: { type: 'string', description: 'HS heading, 4 digits: 4107 bovine finished leather, 4112 sheep, 4113 goat, 4104 wet blue or crust, 6403 leather footwear, 6406 shoe uppers, 4203 leather goods.' }, year: { type: 'string' } }, required: ['country', 'hs'] }
  },
  {
    name: 'record', description: 'Record what the research established. Call this once, when the picture is clear or the search is exhausted.',
    input_schema: {
      type: 'object',
      properties: {
        legal_name: S, aka: { type: 'array', items: S }, hq: S, founded: S, size: S,
        business: { type: 'string', description: 'What the company does, in two or three plain sentences.' },
        segments: { type: 'array', items: S, description: 'Leather segments: finished leather, linings, uppers, footwear, leather goods, automotive, furniture, raw hides, wet blue.' },
        products: { type: 'array', items: S },
        markets: { type: 'array', items: S, description: 'Countries or regions they sell to.' },
        india: { type: 'object', properties: { status: { type: 'string', enum: ['confirmed', 'likely', 'none_found'] }, note: S }, required: ['status', 'note'] },
        shipments: {
          type: 'object', properties: {
            kind: { type: 'string', enum: ['records', 'aggregate', 'none_found'] },
            note: { type: 'string', description: 'Say plainly what was found and what was not available.' },
            rows: { type: 'array', items: { type: 'object', properties: { date: S, product: S, hs: S, origin: S, qty: S, supplier: S, source_name: S, source_url: S }, required: ['source_url'] } },
            stats: { type: 'array', items: { type: 'object', properties: { reporter: S, partner: S, hs: S, year: S, value_usd: S, weight_kg: S, source_name: S, source_url: S } } }
          }, required: ['kind', 'note']
        },
        findings: {
          type: 'array', description: 'Every point worth keeping, one line each, with where it came from.',
          items: { type: 'object', properties: { section: { type: 'string', enum: ['identity', 'business', 'products', 'brands', 'markets', 'sourcing', 'india', 'competitors', 'certifications', 'people', 'shipments', 'news'] }, text: S, source_name: S, source_url: S, source_date: S, claim: CLAIM, confidence: CONF }, required: ['section', 'text', 'claim', 'confidence'] }
        },
        links: {
          type: 'array', description: 'Companies, brands and countries this one is connected to, one row each. Only where a source supports it.',
          items: { type: 'object', properties: { name: S, kind: { type: 'string', enum: ['indian_supplier', 'tannery', 'exporter', 'trader', 'agent', 'competitor', 'brand', 'customer', 'supplier', 'forwarder', 'country'] }, country: S, shipments: { type: 'string', description: 'The shipment count the page shows for this pair, copied exactly. Leave empty if the page shows none.' }, last_date: { type: 'string', description: 'The date of the most recent shipment the page shows, copied exactly.' }, claim: CLAIM, confidence: CONF, source_name: S, source_url: S, source_date: S, note: S }, required: ['name', 'kind', 'claim', 'confidence'] }
        },
        opportunity: {
          type: 'object', properties: {
            verdict: { type: 'string', enum: ['pursue', 'maybe', 'skip'] },
            why: { type: 'string', description: 'Two or three sentences, built on the evidence above.' },
            offer: { type: 'array', items: S, description: 'What JILD IMPEX could put in front of them, specifically.' },
            gaps: { type: 'array', items: S, description: 'Gaps in their supplier network that a source actually shows.' },
            advantages: { type: 'array', items: S },
            next_move: { type: 'string', description: 'The one thing to do next.' },
            confidence: CONF
          }, required: ['verdict', 'why', 'next_move']
        },
        sources_tried: {
          type: 'array', description: 'Every trade-data source you searched or opened, and what it gave. Fill this in even when a source gave nothing.',
          items: { type: 'object', properties: { source: S, url: S, found: { type: 'string', enum: ['partners', 'shipments', 'profile', 'nothing', 'blocked'] }, note: S }, required: ['source', 'found'] }
        },
        unknown: { type: 'array', items: S, description: 'What could not be established, plainly.' },
        priority: { type: 'string', enum: ['high', 'medium', 'low'] }
      },
      required: ['business', 'india', 'shipments', 'findings', 'opportunity', 'sources_tried']
    }
  }
];

const SYS = `You research one company at a time for JILD IMPEX, a leather sourcing agency in Chennai, India. It supplies Indian finished leather, linings and uppers, and leather products, to buyers overseas. Faraz reads what you find and decides whether to approach the company and what to say.

The job is to find out who this company actually trades with and what it buys. Their own website is where you start, not where you stop. A report built only from their website is a failed report.

Where trade partners are published
Public company pages on trade-data sites name real trading partners, with shipment counts, dates and HS codes, and they are indexed by search engines. Work through these by name:
- importgenius.com — the richest free pages. https://www.importgenius.com/suppliers/<company-slug> lists importers and suppliers by name, with the main port, the most recent shipment date, container counts and weights, and recent shipment rows with product descriptions. The slug is the name in lower case with hyphens, so "3C Lavorazione Pelli Srl" becomes 3c-lavorazione-pelli-srl. It also has https://www.importgenius.com/india/suppliers/<slug> and https://www.importgenius.com/india/importers/<slug> for Indian customs records. Build these addresses and read them directly: that costs no search.
- panjiva.com — public company pages name customers and suppliers with shipment counts, dates and HS codes. Search the company name with panjiva to get the page address.
- importyeti.com — United States imports, free, and it names the supplier on every shipment.
- volza.com — company profile pages headed "Buyers, Suppliers, full Export Import details". They often refuse to open; when that happens use what the search result itself showed.
- eximpedia.app/companies/<slug>, trademo.com, exportgenius.in, seair.co.in, infodriveindia.com, cybex.in, 52wmb.com, tendata.com, connect2india.com — the same kind of page, different coverage. Try several, not one.
Also search the company name together with: import data, export data, shipments, bill of lading, consignee, supplier list, and its country.
Then work the Indian side, which is where our competitors show up: search for Indian exporters of this product to their country, and search the names of Indian tanneries together with this company's name. An Indian exporter already shipping to them is worth naming.
Beyond trade data: supplier and sustainability lists, fair exhibitor directories (Lineapelle, APLF, Premiere Vision, Micam), company filings, trade press, job adverts that name sourcing offices, and their customers' own supplier disclosures.

How to treat what you find
- A name printed on a public page is evidence. Record it, with the page address and the date the page shows.
- Many of these pages show a few rows and hide the rest behind a subscription. Record exactly what is shown and mark the rest as not available. Never fill in what is hidden. Never guess a count, a date, a quantity or a partner.
- Copy counts and dates exactly as the page prints them.
- If a page will not load, mark it blocked in sources_tried and use what the search result itself showed.
- Fill in sources_tried for every trade-data source you searched or opened, including the ones that gave nothing. A thin answer that shows where you looked is worth more than a confident one that does not.

You have about 25 searches. Use them. Do not call record after two or three searches because the website looked complete.

Never
- Never invent a shipment, a date, a quantity, a supplier or a purchase.
- Never present an inference as a confirmed relationship.
- Never say or suggest you have access to a paid database or to private customs records. Everything you use is a public page.
- Never treat two companies as connected because they are in the same industry, the same town or the same directory.

Evidence
Every finding carries its source name, the page address, the date the page shows if it shows one, a claim type and a confidence.
- verified: the source states it plainly about this company.
- supported: a strong inference from more than one source.
- possible: one weak or indirect source. Someone has to check it.
- unavailable: you looked and there was nothing.
Confidence is high, medium or low, and it is about how good the evidence is, not how likely the thing feels.

Shipments
- records: a page shows shipment rows, or a named trading partner, for this company. Put the partners in links with their counts and dates, and the rows in shipments.rows.
- aggregate: all you have is country-level statistics, which say nothing about this company on their own.
- none_found: only after you have worked through the sources above and they had nothing on this company. Say which ones you tried.

Write every line short and plain, the way one trader writes to another. No marketing words.`;

/* ---------- the model turn ---------- */
async function turn(key, messages, force) {
  const body = {
    model: MODEL, max_tokens: 4000, system: [{ type: 'text', text: SYS, cache_control: { type: 'ephemeral' } }],
    tools: TOOLS, messages
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
      const sl = company.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
      const seeds = ['https://www.importgenius.com/suppliers/' + sl, 'https://www.importgenius.com/india/suppliers/' + sl, 'https://www.importgenius.com/india/importers/' + sl, 'https://www.eximpedia.app/companies/' + sl];
      const ask = [
        'Company: ' + company,
        names.length > 1 ? 'Also written as: ' + names.join(' / ') : '',
        'Country: ' + (clean(b.country) || 'not stated'),
        sites.length ? 'Website: ' + sites.join(', ') : 'Website: not known, find it',
        clean(b.type) ? 'Listed in the LWG directory as: ' + clean(b.type) : '',
        clean(b.animals) ? 'LWG animal types: ' + clean(b.animals) : '',
        '',
        'Addresses built from the name, worth opening first because read_page costs no search. If one is not found, say so in sources_tried and move on:',
        ...seeds.map(x => '- ' + x),
        '',
        'What JILD IMPEX can supply: ' + (sell || 'Indian finished leather, linings, uppers, and leather products.'),
        '',
        known ? (kind === 'monitor'
          ? 'This company was researched before. Below is what is already on file. Look only for what is NEW or what has changed since then, and say plainly if nothing has changed.\n\n' + known
          : 'Some of this is already on file, so do not spend searches repeating it. Go deeper than this.\n\n' + known)
          : 'Nothing is on file yet.',
        '',
        kind === 'monitor'
          ? 'Check for new suppliers, new sourcing countries, new products, new certifications, expansion, new purchasing people, and fair participation. Then call record with the full picture, old and new together.'
          : 'Work in this order. First, who they are and what they make, from their own site. Second, and this is the part that matters, who they trade with: go through the trade-data sites named above, by name, and find their suppliers, their customers, their shipment counts and dates, and any Indian exporter already shipping to them. Third, what the country figures say. Only then call record.'
      ].filter(x => x !== '').join('\n');
      const state = { messages: [{ role: 'user', content: [{ type: 'text', text: ask, cache_control: { type: 'ephemeral' } }] }], step: 0, searches: 0 };
      const row = await sbq(tok, 'intel_runs', {
        method: 'POST', headers: { Prefer: 'return=representation' },
        body: { key, kind, status: 'running', model: MODEL, state }
      });
      return res.status(200).json({ run_id: row[0].id, status: 'running', step: 0, note: 'Starting' });
    }

    if (b.action === 'step') {
      if (!akey) return res.status(500).json({ error: 'Research is not set up yet. Add ANTHROPIC_API_KEY in Vercel and redeploy.' });
      const id = clean(b.run_id);
      if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: 'No run given.' });
      const got = await sbq(tok, 'intel_runs?id=eq.' + id + '&select=*');
      const run = got && got[0];
      if (!run) return res.status(404).json({ error: 'That run is gone.' });
      if (run.status !== 'running') return res.status(200).json({ status: run.status, step: run.steps, note: 'Finished', result: (run.changes || {}).result || null });
      const st = run.state || { messages: [], step: 0, searches: 0 };
      const last = st.step + 1 >= MAXSTEP;
      let j;
      try {
        j = await turn(akey, st.messages, last);
      } catch (e) {
        await sbq(tok, 'intel_runs?id=eq.' + id, { method: 'PATCH', body: { status: 'failed', error: String(e.message || e).slice(0, 400), finished_at: new Date().toISOString() } });
        return res.status(502).json({ status: 'failed', error: e.message || 'The research step failed.' });
      }
      const blocks = j.content || [];
      const used = ((j.usage || {}).server_tool_use || {}).web_search_requests || 0;
      st.searches += used; st.step += 1;
      st.messages.push({ role: 'assistant', content: blocks });
      const rec = blocks.find(x => x.type === 'tool_use' && x.name === 'record');
      if (rec) {
        await sbq(tok, 'intel_runs?id=eq.' + id, {
          method: 'PATCH', body: { status: 'done', steps: st.step, searches: st.searches, state: null, changes: { result: rec.input }, finished_at: new Date().toISOString() }
        });
        return res.status(200).json({ status: 'done', step: st.step, searches: st.searches, result: rec.input });
      }
      const results = await runTools(blocks);
      if (results.length) st.messages.push({ role: 'user', content: results });
      else if (j.stop_reason === 'pause_turn') { /* a long search turn: send it straight back, untouched */ }
      else if (j.stop_reason === 'end_turn' || j.stop_reason === 'max_tokens') st.messages.push({ role: 'user', content: [{ type: 'text', text: 'Now call record with everything you have. Leave out nothing you established, and be plain about what you could not find.' }] });
      // keep the cache marker on the newest block only
      st.messages.forEach((m, i) => { if (Array.isArray(m.content)) m.content.forEach(c => { if (c && c.cache_control && i < st.messages.length - 2) delete c.cache_control; }); });
      const tail = st.messages[st.messages.length - 1];
      if (tail && Array.isArray(tail.content) && tail.content.length) { const c = tail.content[tail.content.length - 1]; if (c && typeof c === 'object' && c.type !== 'tool_result') c.cache_control = { type: 'ephemeral' }; }
      await sbq(tok, 'intel_runs?id=eq.' + id, { method: 'PATCH', body: { state: st, steps: st.step, searches: st.searches } });
      return res.status(200).json({ status: 'running', step: st.step, searches: st.searches, note: noteOf(blocks) });
    }

    return res.status(400).json({ error: 'Unknown request.' });
  } catch (e) {
    return res.status(e.status || 502).json({ error: e.message || 'That did not work.' });
  }
};
module.exports._t = { cCode, tradeLook, noteOf, HSN };
