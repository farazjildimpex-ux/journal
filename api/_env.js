// Environment values pasted from a phone often carry smart quotes, spaces or line breaks. Keep only the real key.
const envv = n => String(process.env[n] || '').replace(/[^\x21-\x7E]/g, '').replace(/^["']+|["']+$/g, '');
module.exports = { envv };
