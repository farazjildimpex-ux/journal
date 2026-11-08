# Journal app: design rules

Read this before changing any UI. Keep it short and keep it true.

## Principles
1. One job per screen. The most important thing is the biggest and darkest thing.
2. Colour means something. Colour is only for status and type, never decoration.
3. Three levels of text only: Title (ink, bold), Detail (grey, regular), Caption (small grey).
4. Same thing looks the same everywhere (a contract card is a contract card on Today, Orderbook and search).
5. Every screen has a loading state, an empty state and a long-name case.

## Tokens (defined once, in the :root block of index.html)
Status colours (light / dark):
- --st-issued     #2563EB / #6D9BFF  (blue)
- --st-inspected  #C77700 / #F0A03C  (amber)
- --st-completed  #0E9F6E / #34D399  (green)
- --st-cancelled  #DC2626 / #F87171  (red)
- --st-overdue    #DC2626            --st-week #EA580C
Document type colours (existing --tc): contract blue, letter violet, debit note green.
Base: --ink, --mute, --line, --blue, --bl (tint), --surf (card), --bg2 (page).
Text levels: --ink (titles), --ink2 (names), --ink3 / --mute (details). --mute is #6B6B75 (5.3:1 on white). Do not lighten it.
Cards and tiles: 1px --edge ring plus soft shadow. Phone page background: --page (light theme).
Status chips are solid: background the status colour, text --on-st.

## Rules for any change (including by AI)
- Never type a hex colour in a new rule. Use a token. Need a new colour? Add a token here first.
- No new `!important`. If a rule does not apply, find the older rule that is winning and fix or remove it.
- Do not add a second definition of `.card`, `.ch`, `.sbox`. Edit the existing one.
- Cards use the shared card builder (`obCardX` on phone). Do not hand-build card markup elsewhere.
- Radii: 8 (small), 12 (controls), 18 (cards), 99 (pills). Spacing steps: 4, 8, 12, 16, 24.
- Text sizes (phone): 10 caption, 12 detail, 14 body, 15.5 card title, 22 page title.
- Touch targets at least 40px high. Muted text must stay at 4.5:1 contrast on its background.

## Status flow
Contract: Issued, Inspected, Completed. Letter and debit note: Issued, Completed. Cancelled is separate.

## How to ask for a change
Send a screenshot, say which screen, say what feels wrong in one line. One screen per request gives the best result.

## Layout (v2, Nov 2026)
Structure only; colours and fonts unchanged. Rules live in `<style id="v2">` at the end of the CSS.
- Phone shell: sticky top bar with the five page names as tabs (underline follows tap and swipe) and a Settings button on the right. No greeting header; Today shows the greeting as its subtitle.
- Page head: title (26px) + one line of grey subtitle + at most one action on the right.
- Grouped lists: section label (`.ux-gh`, small caps grey) above a panel (`.ux-list`) of rows (`.ux-row`, at least 52px): optional icon tile, title + one grey line, then a badge (`.ux-bd`), a number (`.ux-num`) or a chevron. Build rows with `uxRow()`; do not hand-build.
- Filters: one labelled panel (`.ux-pnl`) with chip rows; chips scroll sideways on phone, wrap on desktop.
- Desktop pages with tools and a list use two columns: tools on the left (about 340px), the list on the right (`.fbx`, `.fbx-a`, `.fbx-m`).
- Only one primary (filled blue) button per panel. Secondary actions are text links (`.ux-link`).
- Fields keep the original look (borderless with a light underline). Faraz prefers it; do not outline them.
- Cards and panels keep the soft drop shadow and entrance animation (the cards should pop). New panels (`.ux-list`) use the same shadow.
- Read-only rows (`.kv` in a `.ds`): on phone, label left (grey, about a third) and value right; addresses wrap. Edit rows (`.kv.ed`) stay stacked: label above field.
- Detail pages (contract, letter, debit note): header = back, document number, then named tabs with an underline. No page dots anywhere.
- People lists use initials avatars (`uxRow(...,{av:uxInit(name)})`). A person's page starts with quick actions (Call, Email, Edit).
- Long settings forms are split into named sections with a one-line explanation each, and one Save at the end.
- Desktop Home stays as Faraz had it (journal and orderbook side by side). Board, dashboard, timeline and widget-card (journal + Follow-ups/Due/Approve/Replies) layouts were tried on 8 Nov and rejected; do not reintroduce them.
- Desktop Home layout (approved 8 Nov, iteration on option A): journal full height on the left (unchanged); right side is the Orderbook panel (top half) and below it Pending actions (left) and Emails to approve (right). Computer view runs at 90% (html zoom .9 at >=900px; 100vh heights divided by .9; menu positions divide rects by ZF()).
- Pending actions are rule-driven (PDEF defaults; user rules in table pending_rules row 'main' = {list, removed}; new built-in rules get appended unless removed). A rule = {to: contract|letter, text with {no} {supplier} {buyer} {awbbl} {days} {due}, start (issued, inspected, invoice, shipped, payment, paydue+days, delivery+days | letter, letterdue+days), done (invoice, bill, paid, payment, debit, inspected | courier | tick), terms / not (comma words matched on payment terms)}. Only Issued/Inspected contracts and open letters. Data-driven items show a round marker and strike off only from the data; 'tick' items have a square tick box (pending_done), ticked go to the bottom struck out, can be put back; items ticked in the last 30 days can be shown. Done items stay struck for the rest of the day.
- The box beside Pending actions shows unread buyer replies first (Buyer replies, Inbox ›); once read it is Emails to approve (Review ›). Desktop Home search also filters Pending actions and that box. Phone has a Pending tab (tab 5) between Orderbook and Today.
- Desktop Home search filters in place (approved 8 Nov): journal matches from every date in the journal panel (with a count line and Clear), document matches in the orderbook panel across every status (Open chip hidden while searching, type chips still filter). No separate results page on the computer Home. Code: hsq(), jSearchHTML(), homeSearch(), sClear().
- Contacts (8 Nov): computer = two panels (list with search left, selected contact right; edit/new forms open in the right panel, cPane keeps the list). Avatars: company logo (contact_book.logo, 200px square WebP on white, margins trimmed) or initials; same avatars on the phone list and detail (cHead). Delete uses data-cdelx (data-cdel is taken by invoice contract chips).
- Phone Pending (8 Nov): page head with Rules pill; .otl tiles Documents/Payments/Couriers (filter, PPF) + Late chip (.orp); cards (.card.pac) grouped under .day headings by category (PCAT from rule.done), kicker Contract/Letter in type colour + supplier mark chip (hidden when the text names it) + due pill; Mark done/Undo only for tick rules; Done today group last.
