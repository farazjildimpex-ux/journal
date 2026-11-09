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
- Computer Orderbook page (9 Nov): .obk status tiles (data-xst filter; stOk honours obSt on tab 3), .obr rows grouped by month (obPageList/obRow2) with supplier avatar from contacts (cbOf) and 'for <buyer>'; new ICON set (contract with signature, letter = leather hide with stitching (an envelope looked like email, a stamped page looked like a contract), debit note % receipt). Home orderbook panel keeps the compact rows (obRow).
- Settings on the computer hides pages that are in the side menu (Contacts, Reports, Worksheets, Invoice mail). Invoice mail page = approvals only; Gmail setup = Settings > Invoice mail setup (SV 'mailset').
- PWA: manifest background/theme #FFFFFF, shortcuts ?go=new|orders|pending (mGoParam after login), beforeinstallprompt -> More > Install; iPhone -> Add to Home Screen help.
- Orderbook flag icons (invoice / BL / AWB, obIcons -> .obi) must not share a class with the type icon (.obty). BL/AWB flags need a bill number (flagOf). Home rows use --orc with a 70px icon column.

## Phone app, look B (9 Nov 2026, chosen from three previews)
Faraz rejected the pastel/dark-bar phone draft (too many colours, dark bottom bar, tick boxes) and chose look B: calm white, the computer's blue, grouped lists.
- Root class `html.phx` is set under 900px (boot script and resize). Do not use `.ph`, `.sc`, `.cl`, `.bk` for phone classes: they are taken (PDF header, settings cards, etc.).
- Light only on the phone: the saved dark theme is ignored under 900px and Display has no dark mode switch there.
- Font Figtree (same as the computer), weights 400/500/600, 700 only for page titles and the weekday. Page background white. Cards: white, 1px #ECEEF2 edge, soft shadow, radius 14. Blue #2F6BFF for actions, the current page, links and counts. Colour otherwise only for status, document type and small flat icons.
- Grouped lists are the main block (`.mlist2`, `.mgrp`, `.ux-list`): rows split by hairlines, meta line small grey above a 15.5px title.
- Bottom bar: plain white, four icons with small names (Home, Orders, Pending, More), blue for the current page, blue count badges. No + button in the bar.
- Home (larger type than other pages): starts with the greeting; "Weekday, d Month" (tap opens the calendar) with the search icon on the right of that line; no avatar. Today list with a blue + (new entry) and an "Earlier entries" row; Follow-ups list; Actions tiles (Pending actions, Orderbook, Buyer replies or Emails to approve, Invoice mail).
- No tick boxes or hold-to-complete anywhere on the phone. Tapping a journal entry or follow-up slides its options open underneath (Conversation/Open, Follow up or Done); Done has Undo.
- Home entries: no meta line; a flag (follow-up) and a chat icon with the entry count sit on the right of the title line.
- Swipe left/right (pages only) moves Home > Orders > Pending > More; on Earlier, Search and Buyers a swipe right goes back. Swipe never acts on a card. Days change by tapping (calendar, Earlier entries), not by swiping.
- Every full-screen page has one header row (phLarge / mBackBar): a round bordered back button (.pbk; ✕ for forms and a second close), the title with a small subtitle beside it, actions on the right. No large scrolling titles and no bare chevrons (Faraz disliked both).
- Contracts, letters, debit notes: header row = back, number + type/supplier, and a status ring on the right (tap it for the status menu); tabs are a sliding segmented switch; no track line; bottom buttons 42px with 13.5px text so "Mark completed" fits.
- Conversations (phone and computer): subtitle "N entries · since <date>", centred date chips (dates only, never clock times), no side line or tiles, Edit / Mark done or Follow up / Delete per entry, and an "Add to this conversation" bar.
- Orderbook: segmented type control, one status strip (Issued / Inspected / Completed), Overdue and Due this week chips, rows grouped by month. Each row: logo and status centred; number; "SUPPLIERMARK to BUYERMARK" (supMark); article · colour (o.ac); then the due line, or the document date when nothing is due.
- Cards use a firmer edge (--pe #E3E6EB) and shadow than the first look-B pass; dividers inside lists stay light (--pl). Pending: one strip (Documents / Payments / Couriers), grouped lists.
- Forms everywhere on the phone (entry form, login, settings, rules) use the contract-form look: a white section, small grey label, value text, light line between rows. Every <select> is turned into the contract form's pull-down (phSel keeps the real select underneath). Pop-up menus use the same card as that pull-down.
- More has no profile row (company details live in Settings).
- Pending rules are drawn as a flow (prFlow): When → Only if → Starts → Adds to Pending (with an example) → Strikes off when; vertical on the phone, left to right on the computer; tapping a step flashes its field.
