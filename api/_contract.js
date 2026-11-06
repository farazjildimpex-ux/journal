// Shared with index.html (same function). Cleans contract numbers read from an invoice.
function cleanContractRef(s, dateOnly) {
  // "CONT NO.YRL 1109 - 01.10.2026" -> "YRL 1109". Drops a leading label (Cont No, PO No, Order No, Ref...) and a trailing date.
  let t = String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  const MON = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i, SEP = /([-–—,;:(]|\b(?:dated?|dt)\b\.?:?)\s*$/i;
  const tails = [
    [/^(.*?)(\s*[-–—,;:(]\s*|\s+)(?:(?:dated?|dt)\b\.?\s*:?\s*)?\(?\s*(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{4}|\d{2})\s*\)?$/i, m => +m[3] <= 31 && +m[4] <= 12],
    [/^(.*?)(\s*[-–—,;:(]\s*|\s+)(?:(?:dated?|dt)\b\.?\s*:?\s*)?\(?\s*(\d{1,2})(?:st|nd|rd|th)?[\s.-]+([A-Za-z]{3,9})[\s.,-]+(\d{4}|\d{2})\s*\)?$/i, m => +m[3] <= 31 && MON.test(m[4])],
    [/^(.*?)(\s*[-–—,;:(]\s*|\s+)\(?\s*(\d{4})-(\d{2})-(\d{2})\s*\)?$/i, m => +m[4] <= 12 && +m[5] <= 31]
  ];
  for (const [re, ok] of tails) {
    const m = t.match(re);
    if (!m || !ok(m)) continue;
    const plain = !/[-–—,;:(]/.test(m[2]) && !/dated?|dt/i.test(m[0].slice(m[1].length));
    const yr = re === tails[2][0] ? m[3] : m[5];
    if (plain && String(yr).length < 4) continue;       // a bare "27/25-26" is a contract number, not a date
    const head = m[1].replace(/[\s\-–—,;:(]+$/, '').replace(SEP, '').trim();
    if (head) { t = head; break; }
  }
  if (dateOnly) return t;
  const LAB = /^(?:(?:buyer'?s?\s+)?(?:cont(?:ract)?|p\.?\s?o\.?|purchase\s+order|order|ord|ref(?:erence)?)\b\.?\s*(?:no\b\.?|nr\b\.?|number\b|#)?\s*[.:#\-–]*\s*)+/i;
  const u = t.replace(LAB, '').trim();
  return u || t;
}
module.exports = { cleanContractRef };
