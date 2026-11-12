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
