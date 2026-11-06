/*
  Journal: Gmail reader
  Reads new mail with PDF or photo attachments in your Gmail inbox and sends it to your Journal app.
  Nothing is changed in the app until you approve it in Settings > Email inbox.
  Paste this whole file at script.google.com (New project), save, then run "setup" once.
*/
const APP_URL = 'YOUR-APP-URL';           // your app address, for example https://my-app.vercel.app
const SECRET  = 'PASTE-SECRET-HERE';       // the same text as MAIL_SECRET in Vercel
const DONE    = 'Journal-done';            // label this script adds to mail it has already sent

function post_(payload) {
  return UrlFetchApp.fetch(APP_URL.replace(/\/$/, '') + '/api/mail-intake', {
    method: 'post', contentType: 'application/json',
    headers: { 'x-mail-secret': SECRET }, payload: JSON.stringify(payload), muteHttpExceptions: true
  });
}

function checkInvoices() {
  const ping = post_({ ping: true });
  if (ping.getResponseCode() !== 200) { console.error('App said: ' + ping.getContentText()); return; }
  let off = false;
  try { off = JSON.parse(ping.getContentText()).skipped === 'disabled'; } catch (e) {}
  if (off) return; // reading is switched off in the app

  const label = GmailApp.getUserLabelByName(DONE) || GmailApp.createLabel(DONE);
  const threads = GmailApp.search('in:inbox has:attachment -label:' + DONE + ' newer_than:7d', 0, 10);
  threads.forEach(function (t) {
    let ok = true;
    t.getMessages().forEach(function (m) {
      if (!ok || m.isInTrash()) return;
      const files = []; let total = 0;
      m.getAttachments({ includeInlineImages: false }).forEach(function (a) {
        const type = a.getContentType();
        if (!/^(application\/pdf|image\/(jpeg|png|webp))$/.test(type)) return;
        const bytes = a.getBytes();
        if (bytes.length > 3 * 1024 * 1024 || total + bytes.length > 3.1 * 1024 * 1024) return;
        total += bytes.length;
        files.push({ name: a.getName(), mime: type, data: Utilities.base64Encode(bytes) });
      });
      if (!files.length) return;
      const r = post_({ messageId: m.getId(), subject: m.getSubject(), from: m.getFrom(), date: m.getDate().toISOString(), files: files });
      if (r.getResponseCode() !== 200) { ok = false; console.error(r.getContentText()); }
    });
    if (ok) t.addLabel(label);
  });
}

// Run this once. It makes the script check your inbox every 5 minutes.
function setup() {
  ScriptApp.getProjectTriggers().forEach(function (x) { ScriptApp.deleteTrigger(x); });
  ScriptApp.newTrigger('checkInvoices').timeBased().everyMinutes(5).create();
  checkInvoices();
}
