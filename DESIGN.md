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
- Desktop Home has three trial layouts (`HL`: a Dashboard, b Timeline, c Split; stored in localStorage `hlay`). Shared pieces keep their ids (#lst, #obl, #chs, #obn); new panels: #htl tiles, #hatt Needs attention, #h14 next 14 days, refreshed by hRefresh() from obRefresh(). Remove the losing layouts once Faraz picks one.
- Supplier column: full name when it fits, otherwise the contact-book mark (fitMarks()).
- Board home (HL d, default, localStorage `hlay2`): three status columns (Issued, Inspected, Completed; Sent and other open states sit in Issued, Cancelled hidden). Cards are `.bcard.ct` with data-orow (click opens), draggable; drop calls setSt() (toast with Undo). Letters and debit notes have no Inspected step.
