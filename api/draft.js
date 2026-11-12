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
      confidence: { type: 'string', enum: ['good', 'thin'], description: 'thin = research gave little to personalise with.' },
      angle: { type: 'string', description: 'One plain sentence for the sender: why this offer was chosen for this company.' }
    },
    required: ['subject', 'body', 'language', 'offered', 'based_on', 'confidence']
  }
};
const STEPS = {
  intro: 'First email to someone who does not know the sender. Follow SHAPE OF A FIRST EMAIL.',
  follow1: 'A follow-up about 4 working days after the first email, which got no reply. It must give something NEW and useful, not a reminder: a different catalogue item that fits them, a concrete detail (thickness, selection, delivery time) from the CATALOGUE, or an offer to send cuttings. One short line may refer to the earlier email; never write "just following up", "bumping this" or "did you see my email". End with one easy question, different from the first email. Use the same language format as the previous email (English plus their language if the previous email had both). 40 to 70 words per language.',
  reply: 'A reply to the message the buyer just sent (INCOMING MESSAGE below). Answer exactly what they asked or said, warmly and briefly (60 to 140 words). Reply in the language they wrote in, one language only, no English plus translation. If they ask for prices, specifications, samples or anything not in the CATALOGUE or SENDER FACTS, do not invent it: say you will send it shortly and ask for one detail that helps (article, quantity, thickness). Do not repeat the first email.',
  follow2: 'A last, very short and kind note about 10 days after the first email. Say you do not want to disturb them, leave the door open, make it easy to say no or to ask for the price list later. Use the same language format as the previous email. 25 to 45 words per language. No new offer.'
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
  try { return res.status(200).json({ ok: true, email: await generate(b, key) }); }
  catch (e) { return res.status(e.status || 502).json({ error: e.message || 'Failed.' }); }
};
async function generate(b, key) {
  const s = b.settings || {}, co = b.company || {}, step = STEPS[b.step] ? b.step : 'intro';
  if (!clean(s.catalogue)) throw Object.assign(new Error('Add what you can supply in Settings > Outreach first.'), { status: 400 });
  if (!co.profile && step === 'intro') throw Object.assign(new Error('Research this company first.'), { status: 400 });
  const prompt = `You write outreach emails for ${clean(s.sender_name, 80) || 'the sender'} of ${clean(s.company, 120) || 'a leather sourcing agency'}.

GOAL: get a reply. Not a sale, not a meeting: one short answer from a busy leather buyer who has never heard of the sender and reads this on a phone, often in his second language.

WHAT WORKS (from large studies of cold email; follow all of it)
- SHORT. A first email is 55 to 95 words per language, 4 to 6 short sentences. Every extra sentence lowers the chance of a reply.
- ABOUT THEM FIRST. The first sentence after the greeting is one concrete thing noticed about their business, taken from RESEARCH. Never open with who the sender is ("My name is", "I am writing to", "I came across your contact", "I would like to introduce").
- DO NOT PITCH. No list of services, no "we help companies", no adjectives about quality or price. One relevant offer, said plainly.
- PLAIN WORDS. Write as a person writes to a colleague: common words, sentences under 18 words, no idioms, no jargon, no exclamation marks. A 12-year-old should understand it.
- ONE EASY QUESTION at the end, about interest, that can be answered in one line. Good: "Is this something you buy at the moment?", "Would a few cuttings be useful?", "Who looks after lining purchases at your company?". Never ask for a call or a meeting. Only one question in the whole email.
- SUBJECT: 2 to 5 words, specific to what is offered or to them, written like an internal note. No numbers, no question mark, no "introduction", "partnership", "opportunity", "from India". Example shape: "Goat linings for your range".

SHAPE OF A FIRST EMAIL
1. Greeting.
2. One sentence: what you noticed about them, attributed to where you saw it ("I saw on your website that ..."). One fact, in your own words.
3. One or two sentences: who the sender is and why that matters to THIS company, built only from INTRODUCTION and SENDER FACTS. If SENDER FACTS names a relevant country, customer type or certificate, use the one that fits them best.
4. One sentence: the 1 or 2 catalogue items that fit what they seem to use. Give a price only if the CATALOGUE gives it.
5. The one easy question.
6. "Best regards," and nothing after it.

HARD RULES
- Offer ONLY items from the CATALOGUE, at most 2, and only those that fit the RESEARCH. If nothing fits well, offer the closest one, ask what they are looking for, and set confidence "thin".
- Never state a price, volume, certification or customer unless it is written in the CATALOGUE or SENDER FACTS.
- Say only things about the buyer that are in RESEARCH, and say them as something you saw, not as a verdict on their business: "I saw on your website that you finish cow leather for footwear", not "You make footwear leather" and not "It appears your company is a trader". Do not label them (trader, manufacturer, agent). Do not ask them to correct you. Do not quote founding years or history.
- Speak to them as "you". Never write the company name in the body.
- GREETING: if a named person is known for this recipient, "Dear Mr/Ms Surname," only if the gender is certain, otherwise "Dear FirstName,". If no person is known, write only "Hello,". Never "Dear Sir or Madam", never "Dear Sir", never "Hi <company> team".
- No flattery ("impressive", "leading", "renowned"), no "I hope this finds you well", no "turbulent times", no pressure, no "looking forward to your positive reply".
- Fit the offer to the company type without naming the type: a maker cares about specification and consistent supply; a trader about range and reliable delivery; a brand about quality and small lots; an agent about working together.
- Plain text only. No bullet points, no bold, no links.
- Before you finish, count the words of each language version. If a first email is over 95 words, cut it.
- LANGUAGE (does not apply to a reply, which uses only the language of the incoming message): if the company is in an English-speaking country, or no local language is clear, write English only. Otherwise write the SAME email twice in one message: the English version first, then a line with three dashes (---), then the version in the company's own language (Italian for Italy, Spanish for Spain, and so on, taken from the research language or country). Keep both natural and equivalent. The subject line is English, a slash, then the local-language subject. Set language to e.g. "English + Italian".
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
${b.current ? 'CURRENT DRAFT (the sender asked for it to be written again: write a clearly different, better version, and follow his change request below exactly)\n' + clean(b.current, 3000) + '\n' : ''}${b.current ? 'CHANGE REQUESTED BY THE SENDER' : 'Other notes from the sender'}: ${clean(b.note, 600) || '(none)'}`;
  {
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
    return e;
  }

}
module.exports._write = generate;
