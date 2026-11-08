// Vercel serverless function: writes ONE outreach email from a researched profile + the sender's offer catalogue.
// Never sends anything. Needs ANTHROPIC_API_KEY. Optional DRAFT_MODEL (default Sonnet).
const SB_URL = 'https://ethhzxagxejxfxkzgndk.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV0aGh6eGFneGVqeGZ4a3pnbmRrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDg3MDQwNjIsImV4cCI6MjA2NDI4MDA2Mn0.FMCc_AwksmDGQqGdCoazcxIJ7i3635fkrJinx5gNucA';
const MODEL = process.env.DRAFT_MODEL || 'claude-sonnet-5-5';
const clean = (v, n) => String(v == null ? '' : v).replace(/\r/g, '').trim().slice(0, n || 4000);
const TOOL = {
  name: 'write_email',
  description: 'The finished email.',
  input_schema: {
    type: 'object',
    properties: {
      subject: { type: 'string' },
      body: { type: 'string', description: 'Plain text. Greeting to sign-off. Do not add the signature or opt-out line; they are added after.' },
      language: { type: 'string', description: 'Language the email is written in, e.g. English, Italian.' },
      offered: { type: 'array', items: { type: 'string' }, description: 'Catalogue items you offered, copied exactly from the catalogue.' },
      based_on: { type: 'array', items: { type: 'string' }, description: 'The researched facts the personal parts rely on.' },
      confidence: { type: 'string', enum: ['good', 'thin'], description: 'thin = research gave little to personalise with.' }
    },
    required: ['subject', 'body', 'language', 'offered', 'based_on', 'confidence']
  }
};
const STEPS = {
  intro: 'First email to someone who does not know the sender.',
  follow1: 'A short follow-up about 4 working days after the first email, which got no reply. Add one new useful point; do not repeat the first email. Max 70 words.',
  reply: 'A reply to the message the buyer just sent (INCOMING MESSAGE below). Answer exactly what they asked or said, warmly and briefly (60 to 140 words). Reply in the language they wrote in, one language only, no English plus translation. If they ask for prices, specifications, samples or anything not in the CATALOGUE or SENDER FACTS, do not invent it: say you will send it shortly and ask for one detail that helps (article, quantity, thickness). Do not repeat the first email.',
  follow2: 'A last, very short note about 10 days after the first email. Easy to say no to. Max 45 words.'
};
module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'Use POST' });
  const key = require('./_env').envv('ANTHROPIC_API_KEY');
  if (!key) return res.status(500).json({ error: 'Not set up yet. Add ANTHROPIC_API_KEY in Vercel and redeploy.' });
  const tok = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!tok) return res.status(401).json({ error: 'Please sign in again.' });
  try {
    const u = await fetch(SB_URL + '/auth/v1/user', { headers: { apikey: SB_KEY, Authorization: 'Bearer ' + tok } });
    if (!u.ok) return res.status(401).json({ error: 'Please sign in again.' });
  } catch (e) { return res.status(502).json({ error: 'Could not check your sign in.' }); }
  let b = req.body; if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = null; } }
  b = b || {};
  const s = b.settings || {}, co = b.company || {}, step = STEPS[b.step] ? b.step : 'intro';
  if (!clean(s.catalogue)) return res.status(400).json({ error: 'Add what you can supply in Settings > Outreach first.' });
  if (!co.profile && step !== 'reply') return res.status(400).json({ error: 'Research this company first.' });
  const prompt = `You write outreach emails for ${clean(s.sender_name, 80) || 'the sender'} of ${clean(s.company, 120) || 'a leather sourcing agency'}.

GOAL: start a real business conversation with a leather buyer. The email must feel written by a person who looked at THIS company, not a mass mailing.

HARD RULES
- Offer ONLY items from the CATALOGUE, and only those that fit what this company buys, makes or sells according to the RESEARCH. Pick 1 to 3 items at most. If nothing fits well, offer the closest one and set confidence "thin".
- Never state a price, volume, certification or customer unless it is written in the CATALOGUE or SENDER FACTS. Never invent anything about the buyer; mention only facts present in RESEARCH.
- NEVER state what the company makes, buys, sells or needs as a fact. We may be wrong and their business may have changed. Phrase everything about them softly and let them correct us, for example: "We understand that you work with calf leather", "From what we have seen on your website, it appears you focus on...", "If you are currently looking for linings or upper leather...", "please correct me if I have misunderstood your range". Never write "You make...", "You buy...", "You need...".
- Speak to the company as "you" and "your company". Never refer to it in the third person by name (not "We understand that Al-Pelli has been trading..."). Say it like: "We understand you are working with cow linings and goat linings", "it appears your range includes...". Do not quote founding years or history.
- GREETING: if a named person is known for this recipient, "Dear Mr/Ms Surname," only if the gender is certain, otherwise "Dear FirstName,". If no person is known, write only "Hello," and nothing more. Never "Dear Sir or Madam", never "Hi <company> team", never "Dear Sir".
- Do not flatter. One soft sentence showing you looked at their business, then what you can offer, framed as an offer and a question ("in case it is of interest"), never as an assumption about their needs.
- Match offers to what the research suggests they might use. If they appear to make upper leather, offer the upper articles, not linings. If the research is thin, keep the offer general and ask what they are currently looking for.
- Tone by company type: manufacturer = materials, specs, consistency; trader = range, margins, speed, reliable supply; agent = a partnership, not competition; brand = quality, traceability, small lots. 
- Short: 90 to 140 words for a first email. Plain words, no hype, no "I hope this email finds you well", no "turbulent times". End with ONE easy question, not a request for a call right away unless that fits.
- LANGUAGE (does not apply to a reply, which uses only the language of the incoming message): if the company is in an English-speaking country, or no local language is clear, write English only. Otherwise write the SAME email twice in one message: the English version first, then a line with three dashes (---), then the version in the company's own language (Italian for Italy, Spanish for Spain, and so on, taken from the research language or country). Keep both natural and equivalent. The subject line is English, a slash, then the local-language subject. Set language to e.g. "English + Italian".
- Address a named person only when RESEARCH names one for the chosen recipient; otherwise a neutral greeting.
- ${STEPS[step]}
- Do not include a signature, address or opt-out line.

INTRODUCTION (how the sender introduces himself; rephrase naturally, never copy word for word)
${clean(s.intro, 1200) || '(none given: introduce him in one plain sentence using SENDER FACTS)'}

SENDER FACTS
${clean(s.facts, 1500) || '(none)'}

CATALOGUE (what can be supplied)
${clean(s.catalogue, 3000)}

SENDER'S OWN EARLIER EMAILS (match the voice, but improve them; do not copy their weaknesses)
${clean(s.samples, 5000) || '(none)'}

${step === 'reply' ? 'INCOMING MESSAGE FROM THE BUYER\n' + clean(b.incoming, 4000) + '\n' : ''}${step !== 'intro' && b.previous ? 'EMAIL ALREADY SENT\n' + clean(b.previous, 2500) + '\n' : ''}RESEARCH ON ${clean(co.name, 120)} (${clean(co.country, 60)})
${JSON.stringify(co.profile || {}).slice(0, 7000)}
Recipient: ${clean(b.to_name, 80) || '(unknown)'} ${clean(b.to_email, 120)}
Other notes from the sender: ${clean(b.note, 600) || '(none)'}`;
  try {
    let r, j;
    for (const m of [...new Set([MODEL, 'claude-haiku-5-5'])]) {   // fall back to the model the invoice reader already uses
      r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: m, max_tokens: 2400, tools: [TOOL], tool_choice: { type: 'tool', name: 'write_email' }, messages: [{ role: 'user', content: prompt }] })
      });
      j = await r.json();
      if (r.ok || ![400, 404].includes(r.status)) break;
    }
    if (!r.ok) throw Object.assign(new Error((j && j.error && j.error.message) || 'The email could not be written.'), { status: 502 });
    const t = (j.content || []).find(c => c.type === 'tool_use');
    if (!t) throw Object.assign(new Error('No email came back.'), { status: 502 });
    const e = t.input;
    // an offered item must really be in the catalogue
    const cat = clean(s.catalogue).toLowerCase();
    e.offered = (e.offered || []).filter(x => cat.includes(String(x).toLowerCase().slice(0, 25)));
    return res.status(200).json({ ok: true, email: e });
  } catch (e) { return res.status(e.status || 502).json({ error: e.message || 'Failed.' }); }
};
