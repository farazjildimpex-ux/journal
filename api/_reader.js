// Shared reader: sends PDFs / photos to Claude and returns the documents found in them.
const { cleanContractRef } = require('./_contract');
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';
const num = { type: ['number', 'null'] };
const str = { type: ['string', 'null'] };

const TOOL = {
  name: 'record_documents',
  description: 'Record every business document found in the files.',
  input_schema: {
    type: 'object',
    properties: {
      documents: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            doc_type: { type: 'string', enum: ['invoice', 'bill_of_lading', 'airway_bill', 'other'] },
            invoice_number: str,
            invoice_date: { type: ['string', 'null'], description: 'YYYY-MM-DD' },
            currency: str,
            contract_numbers: { type: 'array', items: { type: 'string' } },
            lines: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  contract_no: str, article: str, description: str, colour: str, selection: str,
                  quantity: num, unit: str, pieces: num, boxes: num, rate: num, amount: num
                },
                required: ['colour', 'selection', 'quantity', 'pieces']
              }
            },
            total_quantity: num, total_amount: num,
            bill_number: { type: ['string', 'null'], description: 'Bill of Lading number or Airway Bill (AWB) number as printed' },
            shipping_date: { type: ['string', 'null'], description: 'YYYY-MM-DD shipped on board / flight / issue date' },
            carrier: str,
            invoice_numbers: { type: 'array', items: { type: 'string' }, description: 'Invoice numbers mentioned on a bill' },
            warnings: { type: 'array', items: { type: 'string' } }
          },
          required: ['doc_type', 'contract_numbers']
        }
      }
    },
    required: ['documents']
  }
};

const PROMPT = `You read export documents for a leather business. The files may be scanned, rotated, or split over several pages or files. Read everything and call record_documents with one entry per business document.

doc_type:
- "invoice": a commercial / export invoice, together with its packing list if present (an invoice and its packing list are ONE document).
- "bill_of_lading": a Bill of Lading or sea waybill.
- "airway_bill": an Airway Bill (AWB).
- "other": anything else (email text, certificates, bank papers, price lists). Do not extract details for these.

For an invoice:
- invoice_number: the exporter's invoice number exactly as printed (for example CI-005/26-27 or 725/26-27/EX).
- invoice_date: ISO YYYY-MM-DD. The day comes first. Two digit years are 20xx.
- currency: ISO code (US $ is USD, euro sign is EUR, pound sign is GBP, rupee sign is INR).
- contract_numbers: every buyer PO / order number printed (for example "JP 003", "JP 004", "CJV 892"). Return ONLY the number itself: remove labels such as "CONT NO.", "CONTRACT NO", "PO NO", "ORDER NO", "REF" and remove any date printed next to it. Example: the text "CONT NO.YRL 1109 - 01.10.2026" must be returned as "YRL 1109". Never include invoice numbers, LUT, REX, IE code, GSTIN or bank details.
- lines: one entry per article + colour + selection from the invoice breakdown (use packing list subtotals if the invoice has none). Never return individual box rows.
  - article: the printed article name or number for that line (for example LP or SNUFFED), else null. description: the printed goods description.
  - colour and selection: split labels such as "VERDE -GH" into colour VERDE and selection GH, and "BLACK ABC" into colour BLACK and selection ABC.
  - quantity: main invoiced quantity (SQ.FT or similar) as a plain number, with unit.
  - pieces: number of pieces; if sides and hides are shown separately add them. Boxes are not pieces (put them in boxes).
  - rate and amount when printed. contract_no only when the document makes it explicit for that line.
- total_quantity and total_amount: the document totals.

For a bill_of_lading or airway_bill:
- bill_number: the B/L number or AWB number exactly as printed (keep dashes and spaces such as 176-1234 5675).
- shipping_date: shipped on board date, flight date or date of issue, as ISO date.
- carrier: shipping line or airline.
- invoice_numbers: invoice numbers mentioned in the description or marks.
- contract_numbers: buyer PO numbers mentioned, if any.

Never invent values. Use null when something is not printed. Warnings: list ONLY real problems the user must act on, such as a figure you could not read, two documents that disagree, or a total that does not add up. Each warning is one short sentence, at most 3 warnings. Never write confirmations ("matches", "is consistent", "read as"), never comment on date order, and never warn about blank net or gross weights. Dates are day first (DD.MM.YYYY): 06.11.2026 is 6 November 2026 and 01.10.2026 is 1 October 2026. If nothing is wrong, return an empty list.`;

async function readDocs(files, key) {
  const content = [];
  for (const f of files) {
    const mime = String(f.mime || '');
    if (mime === 'application/pdf') content.push({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: f.data } });
    else if (/^image\/(jpeg|png|webp|gif)$/.test(mime)) content.push({ type: 'image', source: { type: 'base64', media_type: mime, data: f.data } });
    else { const e = new Error('Unsupported file type: ' + mime); e.status = 400; throw e; }
  }
  content.push({ type: 'text', text: PROMPT });
  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL, max_tokens: 6000,
      tools: [TOOL], tool_choice: { type: 'tool', name: 'record_documents' },
      messages: [{ role: 'user', content }]
    })
  });
  const j = await r.json();
  if (!r.ok) { const e = new Error((j && j.error && j.error.message) || 'The reader failed.'); e.status = 502; throw e; }
  const t = (j.content || []).find(c => c.type === 'tool_use');
  if (!t) { const e = new Error('The reader did not return any data.'); e.status = 502; throw e; }
  const docs = Array.isArray(t.input.documents) ? t.input.documents : [];
  const uniq = a => [...new Set(a.filter(Boolean))];
  docs.forEach(d => {
    if (Array.isArray(d.contract_numbers)) d.contract_numbers = uniq(d.contract_numbers.map(x => cleanContractRef(x)));
    if (Array.isArray(d.lines)) d.lines.forEach(l => { if (l && l.contract_no) l.contract_no = cleanContractRef(l.contract_no); });
  });
  return docs;
}

module.exports = { readDocs };
