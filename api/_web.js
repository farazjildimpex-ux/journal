// Shared web reader: fetches a public page and turns it into plain text.
// Same guards as the buyer research: public hosts only, never anything local or private, checked again after redirects.
const dns = require('dns').promises;
const net = require('net');
const UA = 'Mozilla/5.0 (compatible; Journal-buyer-research/1.0)';

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
    const r = await fetch(u.href, { headers: { 'User-Agent': UA, Accept: 'text/html,*/*;q=0.5', 'Accept-Language': 'en,it;q=0.8,es;q=0.6,de;q=0.6' }, redirect: 'follow', signal: ctl.signal });
    const fu = new URL(r.url || u.href);
    if (!r.ok || !(await safeHost(fu.hostname))) return null;
    const ct = String(r.headers.get('content-type') || '');
    if (ct && !/text\/html|text\/plain|xml|json/i.test(ct)) return null;
    const html = (await r.text()).slice(0, 600000);
    return { url: fu.href, html };
  } catch (e) { return null; } finally { clearTimeout(t); }
}

const decode = s => String(s).replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#(\d+);/g, (m, n) => String.fromCharCode(+n)).replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#039;|&apos;/g, "'");

function toText(html) {
  return decode(String(html).replace(/<(script|style|noscript|svg|iframe)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h\d|\/tr)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' '))
    .replace(/[ \t\f\v]+/g, ' ').replace(/\n\s*/g, '\n').trim();
}

// The date a page shows for itself, when it says one plainly.
function pageDate(html) {
  const m = String(html).match(/<meta[^>]+(?:article:published_time|datePublished|dc\.date)[^>]+content=["']([^"']{4,30})["']/i)
    || String(html).match(/"datePublished"\s*:\s*"([^"]{4,30})"/i);
  if (m) { const d = new Date(m[1]); if (!isNaN(d)) return d.toISOString().slice(0, 10); }
  return '';
}

module.exports = { getPage, toText, safeHost, decode, pageDate };
