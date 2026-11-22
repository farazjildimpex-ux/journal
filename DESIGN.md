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
- Pending actions are rule-driven (PDEF defaults; user rules in table pending_rules row 'main' = {list, removed}; new built-in rules get appended unless removed). A rule = {to: contract|letter, text with {no} {supplier} {buyer} {awbbl} {days} {due}, start (issued, inspected, invoice, shipped, payment, paydue+days, delivery+days | letter, letterdue+days), done (invoice, bill, paid, payment, debit, inspected | courier | tick), terms / not (comma words matched on payment terms)}. Only Issued/Inspected contracts and open letters. Data-driven items show a round marker and strike off only from the data; 'tick' items have a square tick box (pending_done), ticked go to the bottom struck out, can be put back; items ticked in the last 30 days can be shown. Done items stay struck out for 3 days (today and the two days before).
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
- Font Figtree (same as the computer), weights 400/500/600, 700 only for page titles and the weekday. Page background white. Cards: white, 1px edge, soft shadow, radius 14. The app colour (Blue #2F6BFF by default; Display > App colour offers Indigo, Violet, Teal, Graphite) for actions, the current page, links and counts. Colour otherwise only for status, document type and small flat icons.
- v61 (9 Nov): Faraz tried a crisper look (grey page, bold section titles with colour badges, separate entry cards, red counts) and went back to this white look from his own screenshot: plain Today / Follow-ups / Actions titles, entries in one white card with full-width lines, two lines of each note (tap for the whole note and the icon buttons), the 36px +, plain bottom bar with blue counts. Do not bring the crisp look back unless he asks.
- Home section titles: 20px bold with a small solid badge in front (Today blue journal icon, Follow-ups amber flag, Actions violet bolt). No numbers beside the titles (Faraz found the date and count confusing); Follow-ups keeps "N open" on the right. Follow-up rows show no date (Faraz: not needed); the follow-up flag is amber everywhere (follow-up = amber, done = green).
- Home Today and Follow-ups: every entry is its own white card with 12px between cards (no lines between entries; a long day looked cramped as one block). Earlier entries is its own card too.
- Home tiles: the line under the title takes the colour of what it says (amber to do, green all clear or new replies, red overdue, violet to approve, app colour for invoice mail).
- Bottom bar: keep the plain bar Faraz likes (v58/59): white, the current page's icon and name in the app colour, grey for the others, blue count badges, no box or pill behind the current page (a pill behind only the icon left the name outside and looked broken).
- Lines between rows in grouped lists (Orderbook, Pending, More, Settings) run the full width of the card. Inset lines (starting after the logo) looked odd to Faraz; do not use them.
- Do not use .msc as a class name on the phone: it is the Invoice mail secret row.
- Grouped lists are the main block (`.mlist2`, `.mgrp`, `.ux-list`): rows split by hairlines, meta line small grey above a 15.5px title.
- Bottom bar: plain white, four icons with small names (Home, Orders, Pending, More), the app colour for the current page, blue count badges. No + button in the bar.
- Home (larger type than other pages): starts with the greeting; "Weekday, d Month" on one line with the weekday bold and the date in regular weight, both in ink (not the app colour; Faraz likes it this way), tap opens the calendar; a plain search icon on the right of that line (no circle); no avatar. Today list with a blue + (new entry) and an "Earlier entries" row; Follow-ups list; Actions tiles (Pending actions, Orderbook, Buyer replies or Emails to approve, Invoice mail).
- No tick boxes or hold-to-complete anywhere on the phone. Tapping a journal entry or follow-up slides its icon buttons open underneath (Conversation, Follow up or Done, Edit, Delete); Done has Undo.
- Home entries: no meta line; a flag (follow-up) and a chat icon with the entry count sit on the right of the title line.
- Swipe left/right (pages only) moves Home > Orders > Pending > More; on Earlier, Search and Buyers a swipe right goes back. Swipe never acts on a card. Days change by tapping (calendar, Earlier entries), not by swiping.
- Every full-screen page has one header row (phLarge / mBackBar): a round bordered back button (.pbk; ✕ for forms and a second close), the title with a small subtitle beside it, actions on the right. No large scrolling titles and no bare chevrons (Faraz disliked both).
- Contracts, letters, debit notes: header row = back, number + type/supplier, and a status ring on the right (tap it for the status menu); tabs are a sliding segmented switch; no track line; bottom buttons 42px with 13.5px text so "Mark completed" fits.
- Conversations (phone and computer): subtitle "N entries · since <date>", centred date chips (dates only, never clock times), no side line or tiles, Edit / Mark done or Follow up / Delete per entry (phone: icon buttons that slide out when the entry is tapped; computer: text buttons on hover), and an "Add to this conversation" bar.
- Orderbook: segmented type control, one status strip (Issued / Inspected / Completed), Overdue and Due this week chips, rows grouped by month. Each row: logo and status centred; number; "SUPPLIERMARK to BUYERMARK" (supMark); article · colour (o.ac); then the due line, or the document date when nothing is due.
- Cards use a firmer edge (--pe #E3E6EB) and shadow than the first look-B pass; dividers inside lists stay light (--pl). Pending: one strip (Documents / Payments / Couriers), grouped lists.
- Forms everywhere on the phone (entry form, login, settings, rules) use the contract-form look: a white section, small grey label, value text, light line between rows. Every <select> is turned into the contract form's pull-down (phSel keeps the real select underneath). Pop-up menus use the same card as that pull-down.
- More has no profile row (company details live in Settings).
- Pending rules are drawn as a flow (prFlow): When → Only if → Starts → Adds to Pending (with an example) → Strikes off when; vertical on the phone, left to right on the computer; tapping a step flashes its field.
- Round header buttons hold real SVG icons (PBK back, PCL close); never a text glyph (Android minimum font size pushed glyph + icon off centre).
- Journal rows (v59): Today and Follow-ups use one row (mRow): title (up to 2 lines), on the right a flag/tick and chat count (Follow-ups: the date instead of the flag), then up to 3 lines of the note (mCmp tidies blank lines and spaces). Tap: the whole note (up to 14 lines, then "Read the whole note in the conversation") and icon-only buttons slide out (mXa: Conversation, Follow up or Done, Edit, Delete on the right). Earlier, Search and phone Conversation entries use the same buttons; in the Conversation they stay hidden until the entry is tapped. Computer keeps text buttons on hover.
- Delete always asks twice (armAsk): first tap turns the button red ("Delete?" on icon buttons, "Tap/Click again to delete" on text buttons) for 3 seconds; second tap runs the save animation, then the row collapses (out()).
- Save animation (heavyRun): every save, approve and confirmed delete turns into a spinner, then a green tick, then the page changes. Functions report success with fin(fn); a run that gets no answer for 25 seconds gives the buttons back. New save or delete buttons must be added to the heavy list.
- Home + button: 28px circle (tap area 44px).
- Orderbook status strip has four cells: Issued, Inspected, Completed, This week. Overdue stays a chip. Due text uses the Display overdue colour (--od-ink), not bright red.
- Invoice mail: saving the invoice opened from Review marks that mail applied, plus any other waiting copy of the same invoice number (mailDone); mailSync updates the counts on Home, the bar, More and the computer menu at once.
- Invoice fill (impFill): the invoice's own selection wins over the contract's; impNorm turns "COL - NUT" into colour NUT; price differences are listed. Reader prompt keeps every selection on its own line.
- Floating glass docks (v62, 10 Nov): the phone bottom bar and every `.sheet.tall>.tc2` button bar float 14px from the sides above the safe area (--dkb), radius 30 / 24, translucent white (--glass) with backdrop blur and the --glsh ring and shadow. The scroller under a dock gets extra bottom padding. The bar itself stays plain inside (no pill behind the current page, blue counts).
- + buttons (Home, Orderbook): 32px rounded square (radius 10) in the app colour, not a circle (Faraz, 10 Nov).
- v63 (10 Nov): status strips (Orderbook, Pending) select like the bottom bar: no box, the name turns to the app colour and the other cells fade to 50%. Pending rows centre the icon on the text. Conversation text is 17/16px; its dock holds two buttons on the phone (Link an entry, Add entry), not a fake text box.
- Invoice form (v63): every line has an editable Price (placeholder = contract price) with the contract price beside it for reference. A typed price that differs from the contract is a price change automatically (hidden data-padj is set by calcInv); no switch, reason optional. Totals show "Value at contract price" and "Difference from contract" only when they differ; "Invoice value" is always editable. impFill fills the invoice's own price on lines where it differs, sets the invoice value to the document total when the lines do not add up, and explains both as notes, never as errors.
- v64 (10 Nov): start tips (`.stip`, startTip): a new blank contract asks for the buyer first, a new letter for the supplier; the tip leaves once the party is filled. Debit note in edit mode with no invoice shows "Choose the invoice" at the top (dnPrompt lists the contract's invoices; a new debit note with exactly one un-debited invoice is filled automatically). dnPick brings in every contract on the invoice. Buyer / supplier pull-downs end with "+ Add a new contact" (qcOpen: a small pop-up over the form, never leaves the form).
- Inbox (v68, 11 Nov): laid out like a mail app. List = `.omlist` of `.oml` rows (unread dot, sender bold, date + chevron right, subject, two-line grey preview), a search field and Replies / Opt-outs / Automatic tabs above it (`.omtb`, selected one turns the app colour, the others fade). Opening a message (outMsg) marks it read, shows it on its own page with an in-page "‹ Inbox" button (the header back button is hidden by `.sheet.tall .th-h .x[data-*back]{display:none}`), quoted older emails collapsed behind "Show the earlier emails", then Write a reply and Mark as unread. Search filters the list in place (omPaint) so the field keeps focus.

## Mail screens (v69)
- Inbox, Emails to approve and Sent mail share one shell: `mvWrap(top,rows,right)`.
- Computer (900px and wider): `.mvpn` two panes. List on the left (`.mvpl`, rows are `.oml`), the chosen email on the right (`.mvpr`, `#mvright`) with its buttons on top in `.mvtop > .mvta`. Clicking a row only refreshes the right pane.
- Phone: a tight list, tap opens a page with an in-page back button (`.ombk`); buttons sit under the email in `.mvacts`.
- Write it again opens `.ds.mvrw` (one edit box, quick choices, Rewrite / Cancel). Never rewrite without showing this box.
- `outPace()` puts one plain line on top saying whether sending is on and how many approved emails wait.
- Use `.ds` cards, `.btn` / `.btn.ghost`, `.ei` edit boxes, `.fbpt` hints, `.impw2` warnings. No new button or field styles.

## Phone mail pages and Buyers (v70)
- One email on the phone = `mvPhone(title,sub,body,dock,back)`: round back button returns to the list (`data-mvback`), buttons live in the floating glass dock (`.tc2.mvdk`), primary on the right. No in-page back links, no stacked full-width buttons.
- After Approve or Skip the next waiting email opens; when none are left the list shows.
- Buyers country page on the phone: companies are `uxRow` rows in one card (`fbRowP`); filter / research / write tools fold into one row (`data-fbtools`, `.fbtl`).

## v71: landing page, /app, computer forms
- `index.html` is the public company page (own palette and fonts in `fonts/`; it is not part of the app's design system). The app is `app.html`, served at `/app` and `/login` (rewrites in `vercel.json`). The landing page sends the installed app (standalone mode, or `?go=`) straight to `/app`. `robots.txt` keeps crawlers out of `/app` and `/api`.
- Computer forms use `dfm([html],[html],[html,1]…)`: two cells per row in the order of the printed document, `[html,1]` takes the full width. Contract: Supplier | Contract, Buyer | Very important, Specifications, Lines, Terms. Letter: Supplier | Sample, Specifications, Lines, Notes. Debit note: Supplier & buyer | Debit note, Invoice | Contracts, Commission.
- Very important notes: `noteList()` is the one place that decides numbering (form, view, PDF). Hand-typed numbers are never changed; otherwise lines are numbered automatically. Notes are stored without numbers.

## v72
- Contract on the computer: `dfm([Contract,1,'one'],[Supplier+Buyer],[Very important],[Specifications,1],[Lines,1],[Terms,1])`. `.dfc.one` puts six fields on one line.
- Phone Home: each entry is its own card (`.mh .mlist2 > .mli`); journal row buttons: Delete left (`.rm`), Edit / Conversation / Follow up right with tinted icons (`.c-sl`, `.c-bl`, `.c-or`), icons `xedit`, `xconv`, `xbell`, `xdone`.
- Never rename a class with a blanket search and replace: `.mli.mlx` (Home, Earlier entries) was broken that way in v69.
- Drafted emails show `outWhy(d)` (`.mvwhy`): why the offer, facts used, research. Buyer replies: `data-ounoi` (Not interested / Contact again, uses `outreach_suppress`), `data-oujr` (Note in journal).
- Email writing rules live in `api/draft.js` (short, buyer first, one offer, one question).

## v73
- Anything read back from `lwg_research.profile` or `outreach_drafts.basis` may be a plain string where a list is expected. `outWhyIn` coerces every field; `outWhy` and `mvDraft` catch so one bad record can never stop a page opening.
- Before any deploy run `node scratchpad/syntax.js`: it parses every inline script. A plain apostrophe inside a single-quoted version note broke the whole app once.

## v74
- `obOpen` starts true only on the computer. The phone Orderbook lists everything, newest first, grouped by month, `MOBN` 30 at a time with `data-mobm`. The `Open only` chip (`data-obo`, `.mch.op`) narrows it; a status tile clears it.
- `.mch` is tinted like a warning by default, so a plain filter chip needs its own colours (`.mch.op`).
- Phone Home: `mFuList` shows the first `MFUN` follow-ups with a Show all row (`data-mfum`); `.msec small` sits beside the + button.

## v75
- Both pages carry `<link rel="manifest">` and register `sw.js`: the app is installable from `/` as well as `/app`, and the manifest starts it at `/app`. The landing page keeps the apple-mobile-web-app metas so an iPhone Add to Home Screen opens the app, through the standalone redirect in `index.html`.

## v76
- `payExp(contract, invoices)` is the one place that decides when money is expected: CAD / letter of credit = the days in the terms from the latest BL or AWB date; before shipment = proforma or invoice date + 2 days; anything else returns null. The Payments page (`payExpHTML`, `.pexd`) and the Pending rule `paydue` both use it, so they can never disagree.
- An airway bill number gets a Track link (`billRow`, `.kv .trk`); a bill of lading gets none.

## v76 (continued)
- `askBox({title,text,yes,no,go})` is the one yes/no popup: same `.impb` backdrop and `.impc` card as the New contact box, buttons in `.qcb`. Use it for any "do you also want to…" question; never invent another dialog.
- `askStatus(o,status,why)` asks before changing a contract status. Fired after an invoice is saved (Issued → Inspected), after a payment clears the invoice, and after a shortfall is marked settled (→ Completed).
- A shortfall is never written off silently: `payment_settled_at` on the contract is set only when the user answers the question on the Payments page (`.nbask`). `payOpen()` and the pending rule both read it.
- AWB: `AWBA` maps the 3-digit prefix to the airline and, where the page is known, its tracking page. `awbInfo()` formats the number; the Track button copies it.

## v77
- `impNm(a,b)` compares two document numbers: equal, or one is a prefix of the other once stripped to letters and digits (at least 5 characters). A bill usually names an invoice short, without its date. Use it instead of `impNk(a)==impNk(b)` wherever a bill is matched to an invoice.
- `mailBill` looks an invoice up four ways: by contract numbers, by exact invoice number, by `ilike` on each number, and finally across the last 400 invoices with `impNm`.

## v79 — Track as a link, and Home one day at a time

**AWB Track.** The installed app drew `window.open(url,'_blank','noopener')` as a half-height
panel that never painted (iOS standalone). The control is now a real
`<a class="trk" href target="_blank" rel="noopener">`, so the browser itself takes the link,
and a small listener copies the number on the way out (no `preventDefault`). The row is
`.kv.awbr`, forced to `display:block` over the 36%/1fr `.ds>.kv` grid so the number, the
airline and the two pills (`Track with <airline>`, `Copy number`) stack full width under the
label. The old `data-awburl` branch in the click handler is gone; `data-copy` does the copy
button. Destination is still the carrier page on trackandtrace.com (no aggregator with a
documented number-in-URL format could be verified), so the paste is still one step.

**Home, day by day.** `MHD` is the day Home is showing ('' means today) and `MHSW` is the
mode flag. `mhD()`/`mhSh(n)` read and step the day, never past today. Hold anywhere on `.mh`
that is not an input, link or button for 520ms (`MLP`, cancelled by a 12px move) and
`mSwMode` flips the mode: the greeting becomes "Day by day", a banner appears (`.mdsw`,
tap it to leave), and `+`, "Earlier entries", Follow-ups and Actions are hidden because they
belong to today. While the mode is on, the existing touchend swipe calls `mDay(±1)` instead
of `mGo`, with `inl`/`inr` giving it the same slide as a page change. Holding again, tapping
the banner, or leaving the tab (`mGo` resets `MHSW`/`MHD`) puts the page swipe back.
`LPC=Date.now()` in `mSwMode` swallows the tap that ends the hold — the same guard the
`.tstk` long-press uses — so the first tap after a hold does nothing for 700ms.
`.mh` is `user-select:none` and its `contextmenu` is prevented, or iOS turns the hold into a
text selection.

Tests: `scratchpad/v7/day.py` (22), `scratchpad/v7/awb.py` (12).
`wh/ptest2.py` fixtures now compute the two payment dates from today instead of hardcoding
them, since the mock dates its invoices relative to the clock.

## v80 — the bottom bar carries the days, and a second tap opens the conversation

The v79 hold is gone: `MBAR` (`#mbar`) takes its own `touchstart/move/end`, and a horizontal
swipe of 36px or more calls `mDayGo(±1)`, which turns day mode on the first time and steps
the day after that. `swOk` ignores touches that start on `#mbar` while `tab==0`, so the bar
swipe never drags the pages along; on any other tab the bar still swipes between pages as
before. The swipe's own tap is swallowed by a capture listener on the bar alone (`DSWT`,
400ms) instead of the global `LPC`, which used to eat the next tap anywhere for 700ms.

Leaving: `nonRoot()` now counts `MHSW`, so `mSwMode(1)` pushes a history entry through
`navSync()` and the Android back gesture pops it — `popstate` calls `mSwMode(0)` before the
tab-0 branch, so back returns to today instead of closing the app. The banner is three
controls (`.mdsa` arrows with `data-dstep`, `.mdsc` Back to today), so the days can be
tapped as well as swiped; the forward arrow is `disabled` on today.

`data-mday` was already taken by the calendar day cells — the arrows use `data-dstep`.
Check an attribute name the same way as a class name before using it.

**Double tap.** `mEx` now mirrors `cardTap`: the same `tap={id,at}` state, 340ms, second tap
closes the row and calls `thread(id)`. Putting it in `mEx` rather than a document listener
keeps the gesture inside the row's own handler, so a second tap that lands on a button of
the strip that just slid open still does what that button says.

Test: `scratchpad/v7/day2.py` (28). `v7/day.py` covered the hold and is superseded.

## v81 — Intelligence: deep research on one company, with its evidence

A third mode on the Buyers page (`lmode=='intel'`), beside Clients and Find buyers. Nothing
was removed: the 6 clients and their follow-up history, the LWG directory sync, the cheap
country sweep and the outreach machinery all stay as they were. The mode switch is now
rendered in Find buyers too — it was missing there, so there was no way back to Clients.

**Tables** (migration `intel_centre`): `intel_profiles` (one per company, keyed like
`lwg_research.group_key`: `d:<domain>` or `n:<namekey>`), `intel_findings` (one line of
evidence each, with source name, URL, source date, claim type and confidence),
`intel_links` (relationship edges), `intel_runs` (history, and the run state while it works),
`intel_usage` (searches per month and the cap), `trade_stats`. RLS matches the lwg tables.

**`api/intel.js`** is the engine, and it runs in short steps so no single request runs long:
`start` writes a run row with the opening message, then the app calls `step` until the run
says done. Each step is one model turn plus whatever client tools it asked for. Tools:
Anthropic's server-side `web_search_20250305` (`max_uses` 10, which counts across the whole
run because the steps are one turn), `read_page` (the SSRF-guarded fetcher in `_web.js`,
3 pages a step), `trade_lookup` (UN Comtrade's free public preview, no key, country totals
only), and `record` for the structured result. The system prompt carries the evidence rules:
claim types, never inventing a shipment, never presenting an inference as a relationship,
never claiming access to paid customs data, and `none_found` as the honest answer. Prompt
caching is on the system block and the newest user block; `pause_turn` is sent straight back
untouched, as the docs require, and search results keep their `encrypted_content`.

**What is actually knowable.** ImportYeti is US sea imports, website only, no free API.
UN Comtrade and Eurostat are country aggregates with no company names. EU customs publishes
no company-level import records. So the shipments panel states which of `records`,
`aggregate` or `none_found` it is, and the page says plainly where records exist at all.

**The client** holds the diff, so research accumulates instead of being overwritten:
`inSave` matches new findings against stored ones on section + normalised text, inserts only
what is new, and touches `last_seen` on the rest. "Check for anything new" is the same engine
with `kind:'monitor'`, and it says "Nothing new since last time" when that is the truth.
Hide marks a line `hidden` rather than deleting it.

**Cost** is visible: `intel_usage` counts searches a month, the page shows the fee at
$10/1,000, and `inInvestigate` refuses once the cap is reached. Default cap 300.

Test: `scratchpad/v8/intel.py` (39), with `/api/intel` stubbed in the page.
`v3/mock8.js` now matches upserts on `key` for intel_profiles and `ym` for intel_usage.

## v82 — the trade-partner hunt

v81 shipped an engine that mostly read the company's own website, and a prompt that told it
`none_found` was the honest answer for European buyers. That was wrong, and Faraz was right
to say so. Checked by hand: `importgenius.com/suppliers/<slug>` gives, free and without a
login, a company's importers and suppliers by name with the main port, the most recent
shipment date, container counts, weights and recent product descriptions — for
3C Lavorazione Pelli, one of our own LWG rows, that is 82 shipments, 11 partners and five
named customers. `panjiva.com/<Company>/<id>` names customers with counts, dates and HS
codes. Trademo lists buyers by name and country. Seair publishes Indian export rows (no
company names). Volza refuses server-side fetches, so its search snippets are the fallback.

Changes: the system prompt leads with the hunt and names the sources and their URL shapes;
`start` seeds the opening message with importgenius and eximpedia addresses built from the
company name, which `read_page` can open without spending a search; the budget is 26
searches, 18 steps, 4 reads a step, 6,500 characters a page; `_web.js` sends a browser
user agent, because these sites serve nothing to an obvious robot; `intel_links` carries
`shipments` and `last_date`; `intel_profiles.sources_tried` records every source tried and
what it gave, including the dead ends, so a thin answer is explainable.

The no-invention rules are unchanged: copy counts and dates exactly, record only what a page
shows, never fill in what a paywall hides, never claim access to a paid database.

UI: a Trade partners table above the opportunity, and a "Where I looked" panel.
Default monthly cap 1,000 searches (about $10 in search fees). Test: `scratchpad/v8/intel.py` (42).

## v83 — the lookup answers one question, cheaply, and the drafts use it

Faraz: "I don't care about the full research of a company… for a foreign company its import
partners, for an Indian company its export partners… the Claude API usage is excessive."

**Direction.** `start` reads the country: India means exports (who it ships to), anything
else means imports (who it buys from). `seedUrls(names, indian)` picks the pages to match.
ImportGenius `/suppliers/<slug>` is the company as a shipper, so it lists its buyers — that
is the verified page, and it is what an Indian exporter's export partners look like.
`/importers/<slug>` is the company as a buyer (its suppliers); `/india/importers/` and
`/india/exporters/` are tried too. Unverified paths are cheap to try: a failed fetch costs
nothing. Slugs are tried both ways for the legal form (`-spa` and `-s-p-a`), because the
customs record decides which one exists.

**Cost.** The server fetches up to six pages before the model starts and puts their text in
the first message. Default model is now `claude-haiku-5-5` (INTEL_MODEL overrides), with 7
steps, 6 searches and 3 page reads at most. The brief says: if the opened pages name
partners, call record without searching. `trade_lookup` is gone from the model's tools
(country statistics were not what he wanted). If the organisation has web search switched
off, the first step retries without it and still reads the opened pages.

**Schema.** `record` requires only direction, links (partners with count and latest date as
printed), buys (what is traded in that direction), fit, next_move and sources_tried. The old
essay fields are optional and no longer asked for; old profiles still render.

**Page.** The profile opens with the fit and the next move, then "Who they import from" or
"Who they export to", then "What they buy" or "What they sell". "No partners published" is
stated outright, with where it looked. The dashboard is four counters. The connections
diagram no longer repeats the partner list under itself.

**Drafts.** `outGen` calls `inEnsure(g)`, which returns the stored lookup or runs one
(quietly) if there is none or it predates the fit field; over the monthly limit it returns
null and the draft goes ahead without it. `inTradeFor` sends the drafter partners, products
and fit without source links. `api/draft.js` gets a TRADE RECORDS block: the records choose
the offer, and are never quoted — no shipment data, no supplier names, no "I looked you up".
The draft's `basis.trade` is shown on the approval page.

**Home.** The hidden hold-to-swipe mode is gone (`MHSW` removed). A week strip (`.mwk`,
Monday first) sits under the date: tap a day, swipe the strip for a week, swipe the bottom
bar for a day. Days with entries carry a dot; days after today are disabled. `mSet(day,dir)`
is the one way to move; `nonRoot()` counts `MHD`, so the back gesture brings today back.

**Class clash, again.** The strip's today marker was first called `.td`, which is the
journal's date divider (`margin-left:34px`), and squeezed the selected day into a sliver.
It is `.mwt` now. Grep for `^\.name{` as well as `[ ,}]\.name` before using a class name.

Tests: `v8/intel2.py` (29) replaces `v8/intel.py`; `v7/day2.py` (30) covers the strip.

## v84 — what the production runs showed, and the fix

Read `intel_runs` before changing anything. Faraz's three lookups were all Arnold Klümpen
(Kevelaer). The two Sonnet runs (v81/v82) found the right picture — imports mainly from
Pakistan (Eastern Leather, M S Dada, Muhammad Shafi Tanneries), plus Bangladesh, India,
Turkey, Colombia; and sales into India (Suri Shoes, Model Tanners, Super Tannery) — but
wrote it all into prose fields. `links` and `findings` came back empty, so the page showed
an essay and no partners. The v83 Haiku re-check filled `links`, but with "Three unnamed
suppliers", a list of countries, and a partner put in India on doubtful evidence, and it
omitted fit and next_move although the schema required them. Its summary then replaced the
better one.

So: Sonnet is the default again (INTEL_MODEL overrides); the `record` tool is `strict: true`
with `additionalProperties: false` on every object, so the rows have to be filled in;
web_search carries `allowed_domains` limited to customs-data sites (`TRADE_SITES`), so no
search lands on news or the company's own site; 10 searches, 9 steps, 2 page reads (most of
these sites refuse server reads — the search results carry the facts). The brief now names
customs spellings (ü→ue, "GmbH & Co. KG"→"GMBH CO KG"), says a partner row is one named
company with the country the page prints, and allows building ImportGenius addresses from a
spelling found. Pages the server opened are reported by the server (`st.seeds`, Cloudflare
challenge pages counted as blocked) and merged into `sources_tried`.

Client: `inSave` merges a re-check into the stored summary (links and buys unioned, fit and
next move kept unless replaced), writes newer country/count/date back onto a known partner,
and checks against all rows including hidden ones (`IN.linkAll`), so a hidden partner is
never re-inserted. `inHide` also removes the partner from `summary.links`, which is what
the drafter reads. `inEnsure` does not repeat a lookup under a day old.

The three rows from the Haiku run were set `hidden` (not deleted) and dropped from the
Klümpen summary.

Home: no greeting; the journal gets its own header button (`.mjnb` — not `.msb`, which is
search, and which a shared class made ambiguous); the selected day glows (radial tint,
blue type) like the bottom bar's active tab; cards use `--pcard` with a press on the `scale`
property (the entrance animation holds `transform`); no coloured edge. Journal page: sorted
by date then time, "Yesterday" named by `dlf`, sticky blurred day headers.

Tests: `v8/intel2.py` (34), `v7/day2.py` (32), `v3/mtest4.py` (80) updated for the header.
