# Fundraising mockup: visual critique (report only)

Target: `docs/fundraising/mockup.html`. Session `ux-visual-fundraising`. Viewports 1400x900, 1024x768, 390x844. Dark was captured first because the browser prefers dark; light was captured and audited at 1400. Screenshots are in `docs/fundraising/ux-visual/screens/` (named `{width}-{view}.png`, plus `1400-dark-*` and `1400-light-investors.png`). Raw layout-audit output is in `docs/fundraising/ux-visual/audit/*.json`. The mockup and plan were not edited. The implement phase, issue filing and committing were skipped as instructed.

Method limits: the audit ran on the six views plus the editor. Every screenshot was opened, but only a subset of screens per viewport was inspected closely (1400: investors, fundraising, portal, editor, empty, dead link, light; 1024: investors; 390: investors, fundraising, portal, editor). Portal-open and 1024 fundraising/portal were audited (no overflow, no small targets) but not studied visually. Heuristic IDs (L, D, H, C, I, A) refer to `visual-heuristics.md` in the ux-visual skill. Hover, focus and keyboard states do not exist in a static mockup and were not tested.

Measured facts used below:
- No horizontal overflow and no off-screen primary action in any view or viewport.
- At 390px, Investors page height is 1236px beyond the viewport, Fundraising 624px, editor 1236px.
- At 1400 and 1024, `main` scrolls inside its container (1247px content in a 900px viewport); the Updates, Contacts and Documents cards start below the fold on Investors.
- Distinct font sizes on Investors: 9, 10, 11, 12, 13, 18, 22 px (7 sizes; guide says about 5 or fewer).
- 8 `.btn.s` buttons are 25px tall; `.btn` is 33px, `.ask` 34px, `.chip` 27px. `td.menu` is 22x34px; `button.ib` is 24x20px.
- Low-contrast items: `td.menu` "…" 4.18 (dark) / 3.45 (light); `tag.ok` "Sent" 3.95 (dark); `tag.warn` "Draft ready" 3.64 (light); bot avatars "I" 2.92, "F" 3.35, "C" 4.17.

## Summary counts

| Severity | Count |
|---|---|
| blocker | 0 |
| must-fix | 5 |
| should-fix | 20 |
| nice | 14 |

Total 39 findings (F-01 to F-39; some IDs are cited under more than one surface).

## Top 10

1. F-01 (must-fix) Phone cap table drops the Invested column and wraps holder and security to 2-3 lines, so SAFE amounts vanish and rows are about 3x taller.
2. F-02 (must-fix) Every row action ("Open", "Send SAFE", "…") is a 25px or smaller target on phone; the primary "Send SAFE" and update "Open" miss the 44px touch minimum.
3. F-03 (must-fix) Phone `.item` rows put the "…" menu on its own line, giving a dead row under every pipeline prospect (7 extra rows, about 100px of nothing).
4. F-04 (must-fix) "Options granted" swatch and bar segment use `--border`, nearly invisible in both themes (#2a2a2a on #1f1f1f dark, #e6e6e6 on #f2f2f2 light).
5. F-05 (must-fix) The update editor is a full-screen overlay that hides the sidebar and header and has no mobile layout: an 80px label column leaves a 240px body on a 390px phone.
6. F-06 (should-fix) Fundraising has no single primary action: "Add prospect", "Close round", "Send SAFE", "Open" all compete, and "Close round" is always visible although the round is 45% funded.
7. F-07 (should-fix) Pipeline puts amounts inside description strings ("$250,000 · data room shared..."), so they cannot be scanned or aligned the way the SAFEs table amounts are.
8. F-08 (should-fix) Harbor Angels $50,000 appears three times on Fundraising (Attention, round bar legend "Signed $50k", SAFEs row) and again on Investors cap table.
9. F-09 (should-fix) Phone header wraps: "Ask" drops to its own line under the title, pushing the first card down about 40px on both pages.
10. F-10 (should-fix) The SAFEs card is half empty at 1400 and 1024 (about 280px of dead space) because the two-column grid stretches it to the pipeline height.

## Findings by surface

### Header (title, source line, Hide amounts, Add contact/Add prospect, Ask)

- **F-09 should-fix (L2, H1, I4).** At 390px the title row and "Ask" wrap onto two lines on both pages (see `screens/390-investors.png`, `screens/390-fundraising.png`). "Ask" is the filled button but sits below the secondary button, so the visual order inverts. Fix: at max-width 900px keep the head on one row: title and source line on the left, only an icon-sized "Ask" and a "+" menu on the right; move "Add contact"/"Add prospect" into the source-line menu or the empty-state.
- **F-11 should-fix (I4, A2).** Source line `span.upd` is 113x16px and `button.ib` (Hide amounts, Refresh) is 24x20px. The "Carta · as of Sep 30 ▾" menu trigger has `role=button` but is a span, 16px tall. Fix: make it a real button with at least 32px height (44px on phone) and give the icon buttons 32x32 hit areas.
- **F-12 nice (H1).** "Ask" is the filled primary on both pages while the real page task is different (Open an action item, Send SAFE). Two high-emphasis buttons per page (Ask plus "Send" in the editor) is acceptable, but a filled "Ask" next to an outline "Add contact" reads as an equal pair at 1400. Fix: make "Ask" an outline button with the chat icon in the header and keep filled only for the page's own primary action.
- **F-13 nice (C2).** The source line shows two different freshness styles: "Carta · as of Sep 30 ▾" (Investors, menu) and "Mercury · 5 min ago" plus a refresh icon (Fundraising). Same job, two patterns. Fix: use one pattern, the Investors one (a menu holding Refresh / Change source / Undo).

### KPI cards (Fully diluted, Raised)

- **F-14 should-fix (C2, D5).** "Raised $1.0M" is described as "equity · SAFEs on Fundraising" but Fundraising shows "Funded $450k" for the round, so the same word ("raised") yields two numbers and the card sends the user to another page to reconcile them. Fix: label the card "Equity raised" and drop the "SAFEs on Fundraising" subline.
- **F-15 nice (D2).** Both cards are 96px tall at 1400 with one number each; the row costs 96px of the first screen. Fix: shrink to a single stat strip (two inline stats in one card) so Cap table moves above the fold.
- **F-16 should-fix (H3).** The KPI number is 22px with sub text 11px; with 9, 10, 11, 12, 13 and 18px elsewhere there are 7 sizes. Fix: remove 9px (the caret) and 10px (tags) in favor of 11px, leaving 11/12/13/18/22.

### Action items (Investors) and Attention strip (Fundraising)

- **F-17 should-fix (H1, H5).** Action items are the most urgent content but are styled as an ordinary card with 12px grey heading; an item with a status tag plus an outline "Open" has the same weight as the Updates list below. The Attention card on Fundraising looks identical but holds a different kind of item. Fix: one shared "Needs attention" pattern: no card chrome, the first item's title bold at 13px with a filled "Open" for the single most urgent item.
- **F-08 should-fix (C2).** Harbor Angels $50,000 "awaiting deposit" is shown in the Attention strip, the SAFEs table row ("Oct 12 · awaiting deposit") and the round bar ("Signed $50k"). Fix: keep the Attention entry and remove the "awaiting deposit" text from the SAFEs row sub-line, leaving only the date.
- **F-18 nice (C4).** Item sub-lines mix punctuation separators ("Holdings as of Dec 31 · due Mar 15"). Fine at 1400 but at 390px "Open" is full-width below each item (see F-02), tripling item height. Covered by F-02 fix.

### Ownership bar (Cap table bar and legend)

- **F-04 must-fix (H4, A1).** The "Options granted" segment uses `var(--border)`. Dark: #2a2a2a segment on a #1f1f1f track (`screens/1400-investors.png`, the segment between grey and hatched is barely visible). Light: #e6e6e6 on #f2f2f2 (`screens/1400-light-investors.png`). The legend swatch has the same problem, so the "10.5%" series reads as empty track. Fix: use `--muted-fg` at 50% as a fourth tone, or add a 1px `--fg` outline, so each segment has at least 3:1 against the track.
- **F-19 nice (H6).** The hatched "Pool available" segment shows a 1px border but the others have none, and the bar has no gap between segments, so the pattern edge clips ("6.4%" segment ends with a hairline). Fix: add a 2px `--card` gap between segments.
- **F-20 should-fix (C3).** The legend wraps to two lines at 390px with the third item alone on a new row (`screens/390-investors.png`), breaking the pairing between series and percentage. Fix: use a two-column legend grid on phone.

### Holdings table (Cap table)

- **F-01 must-fix (D1, L6, C2).** At 390px the Invested column is hidden (`.hm`), so SAFE rows show "—" for shares and no amount, losing the one number a SAFE row exists to show. Holder and Security wrap to two or three lines ("Northwind / Ventures / Fund II / investor"; "Post- / money / SAFE") and rows grow to about 3x desktop height. Fix: on phone use a stacked row: holder (bold) and fully diluted percent on the first line; second line "Security · Shares · Invested" in 11px muted text; drop the three-line wrap by not using table columns below 900px.
- **F-21 should-fix (H6).** The "…" menu column has no header, is only 22px wide, and has an inconsistent presence: rows "Options granted" and "Option pool" have no menu, so the column looks ragged. The ellipsis contrast is 4.18 (dark) and 3.45 (light). The right edge also sits tight against the "Fully diluted" numbers (the percent right edge and "…" are 12px apart). Fix: render the "…" in every row (disabled rows get a muted one) as a 32x32 `.ib`, using `--muted-fg` (6b6b6b on white is 5.3:1).
- **F-22 nice (H5).** Mixed row types in one table (common holders, investors with the "investor" tag, grouped options, pool, and "SAFE" rows with "% at cap") have different semantics for the last column. Numeric alignment is correct (right-aligned, tabular figures, verified in screenshot), but "3.1% at cap" is wider than "33.5%" so percentages no longer align on the digits. Fix: set the unit text "at cap" in a muted 11px span after a fixed-width right-aligned percent column.
- The fully-diluted column right edge (1334) does not align with the "Shares" or "Invested" headers' text edges (`th.r` uses padding-left, `td.num` is right-aligned): headers sit flush with numbers, which is correct. No finding.

### Updates list and Contacts (with portal column)

- **F-23 should-fix (D3, I4).** `.item` uses a 3-column grid with a status tag and an "Open" button on every row; at 1400 the two-column layout squeezes Updates to about 530px so "Reminder: Monthly ▾" and "New update" fill the card header and the title "Updates" is pushed to the left edge with a 28px control (`screens/1400-investors.png`). Fix: move "Reminder: Monthly" into the "New update" button's menu; keep one "New update" button in the header.
- **F-02 must-fix (I4).** At 390px `.btn.s` buttons are 25px tall and "Open" stretches to the full row width under each update (`screens/390-investors.png`: three full-width buttons in Updates, one per Action item), which makes the list 3 rows of buttons. Fix: make the whole row a tappable link with a chevron and drop the per-row "Open" button below 900px; keep "Send SAFE" as a 44px button.
- **F-24 should-fix (C1, I6).** Contacts "Portal" column shows "Opened Oct 4", "Invited Oct 2" and "—" in muted text; "Priya Raman" has no organization and no portal state, and nothing says what to do (invite). The column is plain text so the user cannot act on it from the row. Fix: replace "—" with a small "Invite" text button in the portal cell; keep status text otherwise.
- **F-25 nice (D4).** Contacts filter chips (Investors 4, Board 3, Auditors 1, Other) are 27px tall `span.chip` elements (not buttons), and the active chip is solid black, the loudest element in the card. Fix: make the chips real buttons and use the sidebar-accent fill for the active state, saving the solid fill for primary actions.

### Update editor

- **F-05 must-fix (L7, L6, D2).** `.editor` is `position:fixed; inset:0` and covers the sidebar and header, so the page loses its navigation; "← Investors" is the only way back. At 390px the 80px label column leaves a 240px text area (`screens/390-editor.png`), forcing "Customers: TBD" and the bullets to wrap in a narrow column. At 1400 the form uses only the left 760px and leaves an empty right 600px (`screens/1400-editor.png`). Fix: render the editor in the main area (keep the sidebar), stack labels above fields below 900px, and let the body textarea fill the available height.
- **F-26 should-fix (H1, I3).** "Send · 1 TBD" is the only filled button, which is correct, but the label announces a blocker ("1 TBD") without saying it must be fixed first and it appears enabled; there is also no link to the TBD in the text ("Customers: TBD"). Fix: render the button as disabled-looking until TBD is resolved, and keep the count; add "Jump to TBD" as a small text button beside it.
- **F-27 nice (D1).** Textarea is a fixed 300px, so on a 900px viewport about 400px below the Send row is empty. Covered by F-05 fix (fill height).

### Round bar (Pre-seed SAFE round)

- **F-06 should-fix (H1, H2).** "Close round" is an outlined button that sits next to the cap text in the card header at all times. The round is $450k funded of $1M, so closing is not a near-term action, but it has the same weight as the page's other buttons. Fix: move "Close round" into a "…" menu on the card and show it as a button only when funded plus signed reaches the target.
- **F-28 should-fix (H3, C3).** At 390px the card title wraps ("Pre-seed SAFE / round") and "Post-money cap $8M · MFN" wraps to two lines next to "Close round" (`screens/390-fundraising.png`), and the legend's "Target $1M" falls to a third line. Fix: put the cap text under the title on phone and keep the legend on two lines.
- The bar has the same F-04 and F-19 issues but its segments are all distinct (white, grey, hatched), so those apply only to the Investors bar.

### Pipeline

- **F-07 should-fix (D5, H6).** Amounts are embedded in the description ("$50,000 · met Oct 9 · wire details", "$250,000 · data room shared Oct 15 · call Thu"); the rows have different formats (the Intro rows have no amount), so amounts cannot be scanned or summed visually, unlike the SAFEs table. Fix: add a right-aligned tabular amount column to each pipeline row and keep only the date and next step in the sub-line.
- **F-03 must-fix (L6, D2).** At 390px the third grid cell (the "…" menu) wraps onto its own row, giving a blank 40px band under all 7 prospects (`screens/390-fundraising.png`, e.g. under "Ravi Mehta", "Clearwater Fund"). Fix: use `grid-template-columns: 1fr auto` with the menu in the title row, or hide the per-row "…" below 900px in favor of row tap.
- **F-29 should-fix (H5).** Only "Ravi Mehta" shows a row button ("Send SAFE") and the other rows show only the menu, so the rows are visually uneven and the one action users take most (advance a prospect) is not offered elsewhere. Fix: show one contextual text button per row for the next step ("Schedule", "Share data room", "Send SAFE") or none; with a single row button the stage "Committed" already tells the user it is the only actionable group, so prefer none and keep "Send SAFE" inside the row menu plus the Attention strip.
- **F-30 nice (D3).** The "Passed 1 ›" stage is a closed header with no affordance beyond the chevron character and is `mute` grey (4.18 contrast). Fix: make it a button with a visible focus state.

### SAFEs list

- **F-10 should-fix (D2).** The SAFEs card contains four rows but is stretched to the pipeline's height, leaving about 280px empty at 1400 (`screens/1400-fundraising.png`) and the same at 1024. Fix: set `align-items:start` on `.cols`, or place SAFEs full width under the round bar and pipeline below.
- **F-31 nice (H6).** The "Status" header is left-aligned over tags and the "Amount" header is right-aligned over tabular numbers; numeric alignment is correct. The sub-line under the investor name ("Oct 12 · awaiting deposit") sits in bold 11px which makes the name and date appear equally heavy (the date is `.sub` but inherits `td.v` weight 600). Fix: set the sub-line to weight 400.

### Attention strip

See F-17 and F-08. The Attention card renders with a lone empty `<span>` in the middle grid column that keeps the "Open" button aligned; at 390px this stacks "Open" full width (F-02).

### Portal home (investor-facing)

- **F-32 should-fix (C4, H2).** "August update" is a card containing only "Open ›" in muted text (4.18 contrast) with no date other than in the header; it does not look clickable (I1) and the click target is the 13px text. The latest update is expanded in full while older ones collapse to a card each, which will grow one card per month. Fix: make older updates a single "Earlier updates" list of rows (title, date, chevron) at 44px height.
- **F-33 nice (D2).** The 640px column is centered with 40px top margin; footer "elena@northwind.example · Sign out" is 12px muted text with no divider and "Sign out" has no button styling. Fix: render "Sign out" as a text button, 44px high on phone.
- At 390px the portal fits with 16px gutters; "Download" is a full-width button of normal height (fine, no small targets measured).

### Portal landing (link) and dead-link view

- **F-34 should-fix (H1, I3).** Landing: a single "Open" button 79x37px (33px on the standard button plus padding), correct as the only action. Dead link: input plus "Email me a link" outline button; the button is not filled, so the only action on the page is the weakest-looking control, and the input and button are separate lines with a 10px gap. Fix: make "Email me a link" the filled `.btn.p` and give the input a visible label (placeholder-only labeling disappears when typing; there is an `aria-label` but no visible label).
- **F-35 nice (D2).** Both views leave the lower 70% of the 900px viewport empty at 1400 (`screens/1400-link-dead.png`), by design for a centered card, but the content is placed at 120px from the top, which looks top-heavy rather than centered. Fix: center vertically (margin-top 20vh).

### Empty state (Investors)

- **F-36 should-fix (H1, I5, D2).** Three equal-looking options ("Connect Carta" filled, "Use a Google Sheet", "Type it in") are presented under a bare "Investors" heading with no sentence saying what the page is for; the heading alone gives a new user no context (`screens/1400-empty.png`). This is minimal copy as AGENTS.md asks, but the sidebar stays visible and the page itself has no header row, so it does not match the populated page layout (title left, actions right). Fix: keep the standard header row ("Investors" left, "Ask" right) and put the three options as a vertical list of rows with the filled "Connect Carta" first; no explainer copy added.

### Cross-cutting

- **F-37 should-fix (H5, H4).** Mockup-only chrome: the fixed view switcher overlays the last 40px of content in every screenshot at 1400 and clips at 390px ("...estors"), covering table rows and the Contacts header (`screens/390-investors.png`, `screens/1024-investors.png`). It is not product UI but it hides real layout problems in review. Fix: reserve 48px of bottom padding on `main` and let the note scroll horizontally on phone.
- **F-38 nice (A1).** Bot avatar colors: white initials on #c98a3b (2.92:1) and #3f9b8a (3.35:1) fail 4.5:1. The tokens allow bots the identity color; use dark ink text on the lighter avatars or darken the fills.
- **F-39 nice (D3).** Spacing off-scale and near-duplicate values measured: 3, 5, 6, 7, 9, 10, 14 px (card padding 12/14, `td` padding 7, item gap 12, row gaps 6/8/10). Fix: normalize to 4/8/12/16.
- Consistency with `docs/finance/mockup.html` and tokens: the palette matches the monochrome token set (primary ink, destructive/success/warning only on tags, bot color only on avatars). No hardcoded accent colors besides bot avatars (`#3f9b8a`, `#4a7bd0`, inline in the sidebar); those should come from tokens.

## Journey impact notes

- The phone problems (F-01, F-02, F-03, F-09) hit the "check the cap table / check a SAFE / open an update on my phone between meetings" journeys most; the cap table loses the one amount a SAFE row exists to show.
- The editor problems (F-05, F-26) slow the monthly update journey: the user cannot see the sidebar or jump to the TBD blocker.
- F-06 and F-29 slow the round-management journey by giving no clear next step on Fundraising.

## Counts

blocker 0; must-fix 5 (F-01 to F-05); should-fix 20; nice 14. Counted from the severity tag on each finding line.

## Round 1 resolution

| Id | Result | Note |
|---|---|---|
| F-01 | fixed | Phone cap table keeps holder, percent and a sub-line with amount |
| F-02 | fixed | Row buttons 36 px on phone, inline, not full width |
| F-03 | fixed | Row menu stays in the row |
| F-04 | fixed | Options segment and swatch use `--ink2`, gap between segments |
| F-05 | fixed | Editor is a page in the shell; labels above fields on phone; body fills height |
| F-06 | fixed | Close round only in the round "…" menu |
| F-07 | fixed | Right-aligned amount column in the pipeline |
| F-08 | fixed | "Awaiting deposit" only in Attention; one summary per figure |
| F-09 | fixed | Phone header keeps title, "+" and icon Ask on one row |
| F-10 | fixed | Columns align to the top; SAFEs card not stretched |
| F-11 | fixed | Source line is a 32 px button; icon buttons 32 px (36 px on phone, not 44) |
| F-12 | fixed | Ask is an outline button |
| F-13 | fixed | Mercury line uses the same button-with-menu pattern |
| F-14 | fixed | "Equity raised", subline removed |
| F-15 | fixed | One card with both figures |
| F-16 | fixed | 9 and 10 px text removed |
| F-17 | fixed | Bordered Needs-attention pattern on both pages, most urgent Open filled |
| F-18 | fixed | Covered by F-02 |
| F-19 | fixed | 2 px gap between bar segments |
| F-20 | fixed | Two-column legend on phone |
| F-21 | fixed | "…" in every row (disabled where nothing applies), 32 px |
| F-22 | fixed | "at cap" moved to the group heading; percents align |
| F-23 | fixed | Reminder moved into the Updates "…" menu |
| F-24 | skipped | Nice; an Invite action in the portal cell adds a feature the plan does not have |
| F-25 | fixed | Chips are buttons; active uses the sidebar accent |
| F-26 | fixed | Plan keeps the one-time prompt; Send no longer shows the count and TBD is highlighted; "Jump to TBD" skipped |
| F-27 | fixed | Body fills the height |
| F-28 | fixed | Cap text under the title; legend wraps in two columns |
| F-29 | skipped | A Send SAFE row button is needed for W-25 and W-27; only the Committed stage has one |
| F-30 | fixed | Passed is a button |
| F-31 | fixed | Sub-line weight 400 |
| F-32 | fixed | Newest update open, earlier updates as rows that expand |
| F-33 | fixed | Sign out is a button, 44 px on phone |
| F-34 | fixed | Filled button and a visible label |
| F-35 | fixed | Landing content sits at 20vh |
| F-36 | fixed | Standard header and a vertical list; "Connect Carta" is not filled (W-04 decision) |
| F-37 | fixed | View menu in normal flow |
| F-38 | fixed | Darker avatar fills, now variables |
| F-39 | skipped | Nice; spacing scale not normalized in this pass |

Totals: 36 fixed, 3 skipped.
