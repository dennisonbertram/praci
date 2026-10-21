# Fundraising mockup: visual critique, round 2 (report only)

Target: `docs/fundraising/mockup.html` (37 views). Session `ux-visual-fundraising-r2`. The mockup and plan were not edited, and nothing was committed or filed.

Coverage:
- All 37 views at 1400 and 390 (light), as full-page screenshots.
- The main five (investors, inv-native, editor, fundraising, portal) also at 1024, and in dark at 1400 and 390.
- 89 screenshots in total, all opened with Read. They are in `round-2/screens/`, named `{width}-{view}.png` and `{width}-dark-{view}.png`.
- `layout-audit.js` ran on every screenshot; raw output is in `round-2/audit/` (one JSON per screenshot).
- Extra measurements: `round-2/audit/targets-measure.txt` (every button, link and input size on the five main views at 1400 and 390) and `round-2/audit/dialogs-390.txt` (dialog geometry).

The audit's own "small target" check only flags targets under 24px. The 36px and 44px thresholds below come from my own measurements.

Not tested, because the mockup is static: hover, focus, keyboard order, and the Updates "…" menu (no view opens it).

Light-mode screenshots were taken with the browser forced to light, dark with it forced to dark. The 390 "scrim stops at 844px" in full-page dialog screenshots is a capture artifact (fixed overlay), not a defect.

## Part 1. Round-1 fix verification

All 36 "fixed" items were checked against the new screenshots and measurements.

### Confirmed (32)

F-01 (phone cap table keeps holder, percent and amount sub-line), F-03 (row "…" stays in the row), F-04 (Options swatch and bar segment visible in both themes), F-05 (editor is a page in the shell, labels above fields on phone), F-06 (Close round only in the round menu), F-07 (amount column right-aligned; see N-05 for a remaining misalignment), F-08 (awaiting deposit only in Attention), F-09 (phone header on one row), F-10 (SAFEs card not stretched), F-12 (Ask is outline), F-13 (Mercury line is a button-with-menu), F-14, F-15, F-16 (distinct font sizes on Investors are now 11/12/13/18/22; 9 and 10px gone), F-17 (bordered Needs-attention on both pages; see N-02), F-18, F-19 (2px gap between bar segments), F-20, F-21 ("…" in every cap-table row), F-22, F-25, F-28, F-30 (Passed is a button), F-31, F-32 (portal shows the newest update open, earlier as rows), F-33 (Sign out is 44px on phone), F-34, F-35, F-36, F-37.

F-11, F-02 and F-26 are listed with the partial items below.

### Not actually fixed or only partly fixed

| Id | Status | Evidence |
|---|---|---|
| F-38 | Not fixed (marginal) | Bot avatar "I" (white on `--bot` #a8691f) measures 4.46:1 in `audit/1400-investors.json`, below the 4.5:1 needed for 11px bold text. Improved from 2.92, but still fails in both themes. |
| F-27 | Not fixed at 1024 | "Body fills the height" holds at 1400 and 390, but at 1024x768 the editor footer is cut off: Send is at y 750 to 783 in a 768px viewport (`screens/1024-editor.png`; `main` scrolls 762 vs 727). |
| F-02 / F-11 | Fixed as scoped, but below the stated threshold | Row buttons and icon buttons are 36px on phone (measured: `btn.s` 36, `ib` 36, Ask 36x36, Send 58x36). The brief requires 44px for primary phone actions; see N-07. |
| F-23 | Could not verify | The reminder was moved into the Updates "…" menu, but no view opens that menu, so the menu content cannot be seen. |

### Skipped by decision (not re-litigated)

F-24, F-29 and F-39. F-26 is partial by design (the "Jump to TBD" action was skipped); the TBD prompt itself is confirmed in `screens/1400-ed-tbd.png`.

## Part 2. New findings

Counts: 1 blocker, 2 must-fix, 12 should-fix, 9 nice.

### Blocker

**N-01. All dialogs overflow the phone viewport, so their primary buttons are cut off.**
- Evidence (measured at 390px): every `.dlg` is 420px wide, left 16, right 436, 46px past the screen edge (`audit/dialogs-390.txt`). Save sits at right 419, so it is clipped. Views affected: Add prospect, Send SAFE (plain), Send SAFE (different terms), SAFE cover summary (Print clipped), Close round ("Close roun"), Start a round ("Sta"). See `screens/390-fund-prospect.png`, `390-safe-dialog.png`, `390-safe-terms.png`, `390-fund-close.png`, `390-fund-start.png`, `390-safe-cover.png`.
- Why it matters: Send SAFE is a core journey (FR-037 onward), and on a phone the user cannot see or reliably tap the action, and inputs such as Amount are clipped ("$50,0").
- Cause: `.scrim` is a grid with `place-items:center`, so the `max-width:100%` on `.dlg` resolves against a track sized to the 420px content.
- Fix: give `.scrim` `grid-template-columns:minmax(0,1fr)` and set `.dlg` to `width:min(420px,100%)`.

### Must-fix

**N-02. The failed-send state reports the wrong status and has no way forward.**
- Evidence: in `screens/1400-ed-failed.png` and `390-ed-failed.png` the header chip still reads "Sending" (the markup shows the same chip for sending and failed), although every recipient is resolved. The footer is gone, so the only control is the per-row Retry. The row also grows when Retry appears (about 5px of layout shift on the Body field at 390).
- Why it matters: this is the recovery path of the main update journey (FR-010, FR-016). The user is told the send is in progress when it is not.
- Fix: show "1 failed" in the header chip, keep a footer with "Retry failed" (one primary) and "Done", and reserve the Retry slot in each row.

**N-03. Typed-in mode gives no way to remove or edit a holder's row.**
- Evidence: `screens/1400-inv-native.png`. Read-only mode has a "…" on every row; edit mode drops the column, so there is no delete or reorder and the Option pool row has no row action.
- Why it matters: FR-004 (type the cap table by hand) cannot be completed or undone from this UI.
- Fix: keep the "…" column in edit mode with Remove (and Move if needed), disabled on the Option pool row.

### Should-fix

**N-04. Fundraising shows two filled primary buttons.**
- Evidence: Attention "Open" and pipeline "Send SAFE" are both filled in `screens/1400-fundraising.png` and `390-fundraising.png`. This breaks H1; the Investors page has one filled button.
- Fix: keep only the Attention "Open" filled and make "Send SAFE" outline. When Attention is empty, the Send SAFE row button can be filled.

**N-05. The pipeline amount column is not aligned.**
- Evidence: measured right edge of amounts at 1400 is 667 for "$50,000" (row with a Send SAFE button), but 761 for "$250,000", "$200,000" and "—". At 390 it is 223 against 317. The button pushes the amount left.
- Fix: put the row button in its own fixed-width slot after the amount, or place the button in the sub-line.

**N-06. The dialog action label does not match the title.**
- Evidence: "Send SAFE · Ravi Mehta" ends in "Save" (`screens/1400-safe-dialog.png`, `1400-safe-terms.png`); "Start a round" ends in "Start"; "Add prospect" ends in "Save".
- Fix: use the verb the user chose: "Send SAFE" (or "Create SAFE") for the SAFE dialogs, "Add" for Add prospect.

**N-07. Primary phone actions are 36px, not 44px.**
- Evidence (measured at 390): Send 58x36, Open draft 36 high, Send SAFE 36, Ask 36x36, empty-state buttons 36, dialog Save and Cancel 36 (`audit/targets-measure.txt`, `audit/dialogs-390.txt`).
- Fix: at max-width 900px set the primary button of each view and every dialog button to a 44px minimum height; keep 36px for secondary row buttons.

**N-08. On a phone, the first Action item wraps to five lines.**
- Evidence: `screens/390-investors.png` shows "Audit request · Northwind Ventures Fund II" and its sub-line split across about 6 short lines because the "Draft ready" tag, "Open draft" button and "…" share the row. This is the most urgent card on the page and it is the tallest.
- Fix: on phone, stack: title and sub-line full width, then tag, button and "…" on one row beneath.

**N-09. Connection and failure states look like plain text.**
- Evidence: "Connect Mercury", "Reconnect Mercury" (`screens/1400-fund-nomercury.png`, `1400-fund-reconnect.png`) are muted 13px text with no border, caret or hover cue, yet they are the way to connect, a core setup step. "Last read failed · Sheet as of Sep 30" and "Sync failed" (`1400-inv-failed.png`, `1400-fund-sync.png`) are small amber text only; no inline notice or Retry. The menu caret renders as a tiny dot.
- Fix: render these as the same bordered source button as "Carta · as of Sep 30" with a visible chevron; for failures add a one-line notice with Retry above the content.

**N-10. Typed-in table: header and value alignment, and unlabeled phone fields.**
- Evidence: in `screens/1400-inv-native.png` the "Shares" and "Invested" headers are left-aligned over right-aligned inputs (header at x 806 and 1050, values end at 1034 and 1278), unlike read mode where they are right-aligned. On phone (`390-inv-native.png`) Shares and Invested inputs have no labels once filled, so the two numbers cannot be told apart.
- Also: the read table says "Seed Preferred" and the editable select says "Preferred".
- Fix: right-align the Shares and Invested headers in edit mode; add small labels above the phone inputs; use the same security names in both modes.

**N-11. Native form controls break the monochrome token system.**
- Evidence: the recipient and MFN checkboxes are the browser's blue (`screens/1400-editor.png`, `1400-safe-terms.png`, also in dark); selects use native chrome. Checkboxes are 13x13px (`audit/1400-editor.json`). There is no `accent-color` in the file.
- Fix: use the shadcn Checkbox and Select (as AGENTS.md "UI system" requires); at minimum set `accent-color:var(--primary)` and make the whole row the 36px target.

**N-12. Under-size touch targets that are not primary.**
- Evidence (measured): Contacts chips 27px high at both widths; recipient rows 32px with a 13px checkbox; inputs and selects 27 to 33px; inline links "Find in Finance" 85x15 and "Link to Mercury SAFE" 112x16 (the Mercury hand-off action itself); "SAFEs, if converted at cap ›" 175x19 (`audit/targets-measure.txt`).
- Fix: raise chips, inputs and selects to 36px on phone, make the Mercury link a 32px text button, and make the SAFEs heading row the link target.

**N-13. No visible confirmation after Send or Send SAFE.**
- Evidence: `screens/1400-inv-sent.png` only removes the October draft from Action items and adds a row in Updates, which is below the fold; `1400-safe-mercury.png` adds a Draft SAFE row and removes the prospect, with no message and no pointer to the Mercury step.
- Fix: show one transient toast ("Sent to 4", "SAFE drafted. Link it in Mercury") with an Undo or a "Link" action.

**N-14. Editor footer is clipped at 1024x768.**
- Evidence: Send measured at y 750 to 783 against a 768px viewport (see F-27 above, `screens/1024-editor.png`).
- Fix: make the editor body a flex column whose footer is pinned and whose Body field shrinks (min-height 160px).

**N-15. Token drift from the Finance mockup.**
- Evidence: `--warning` is #92610f here vs #b7791f in `docs/finance/mockup.html`; `--success` #276749 vs #2f855a; `--bot` #a8691f vs #e8743b (the same Investors/Finance bot avatars get different identity colors); `--bot2` and `--bot3` exist only here. These are page-local overrides of what should be shared tokens.
- Fix: take the values from `@rakazo/ui-tokens`; if the darker values are needed for contrast, raise them in the shared token source and update Finance.

### Nice

- **N-16.** "5.0% · holdings 95.0%" ends at x 1351 but the percent column above ends at x 1315 (`screens/1400-investors.png`); align it to the column.
- **N-17.** On phone, "SAFEs, if converted at cap ›" wraps onto a second line ("cap ›") against its right-hand figure (`390-investors.png`); shorten to "SAFEs at cap ›" or stack.
- **N-18.** Editor: the Draft chip sits at the far right (x 1327) while the form column ends at 1028, so the status is detached from the title on wide screens.
- **N-19.** TBD prompt: "Back" next to the "← Investors" header back is ambiguous; use "Keep editing".
- **N-20.** Send SAFE terms dialog: the Governing state label sits 14px under the checkbox row, tighter than the 20px between other groups.
- **N-21.** Investors empty state: three equal outline buttons with no hierarchy and no primary; "Connect Carta" is the recommended path (W-04 asks it not be filled, but a visual order cue would help).
- **N-22.** "Sending…" disabled button is white on #8a8a8a, about 3.5:1; use a lower-opacity primary instead.
- **N-23.** Phone Contacts rows differ in height (with and without an organization sub-line: 44 vs 38px); give rows a fixed min-height.
- **N-24.** Closed-round view shows only the summary card; the round's prospects and SAFEs are not reachable from it, so the page ends after one 70px card (`screens/1400-fund-closed.png`).

## What is excellent as is

- Portal pages are clean, well-spaced and readable in both themes: one clear action per state, 44px Sign out and Email me a link on phone, text measure about 60 to 70 characters (`screens/1400-portal.png`, `390-portal.png`, `1400-link-dead.png`).
- Investors page: one clear focal point (Action items), five distinct font sizes, no horizontal overflow in any view, right-aligned numeric columns in read mode.
- Dark mode: no new contrast failures in the main five at 1400 or 390 (audit flags only the "I" avatar); the inverted primary button, bar and tag colors all read well.
- Menus and row menus are consistent across Investors and Fundraising: same width, 32px item height, same placement.
- No view has horizontal page scroll or an off-screen primary action (audit `offscreenPrimary` empty for every view), apart from the dialog overflow in N-01.

## Round 2 resolution

Counts: 24 items fixed (21 new plus F-38, F-02/F-11, F-23; F-27 is the same fix as N-14), 1 partly fixed (N-15), 2 skipped (N-21, N-22).

| Id | Result | How or why |
|----|--------|-----------|
| N-01 | fixed | Dialog width `min(420px,100%)`, `max-width: calc(100vw - 32px)`, scrim `minmax(0,1fr)`; verified in 390 px screenshots of every dialog view. |
| N-02 | fixed | Header chip Partly sent, footer "3 of 4 sent" and Done, Retry slot reserved. |
| N-03 | fixed | Row menu with Delete holder in editable rows; the pool row has none. |
| N-04 | fixed | One filled button: Send SAFE; Start a round takes it when there is no round; Attention uses an outline Mark funded. |
| N-05 | fixed | Amount column fixed; the Send SAFE slot follows it (own line on a phone). |
| N-06 | fixed | Buttons read Add prospect, Start a round, Send SAFE. |
| N-07 | fixed | Primary buttons and dialog buttons 44 px at 900 px and below. |
| N-08 | fixed | Action rows stack on a phone. |
| N-09 | fixed | Source and Mercury lines are bordered buttons with a caret; failure states keep the amber text and offer Refresh in their menu. No separate notice line (less chrome). |
| N-10 | fixed | Headers right-aligned; phone inputs labeled; "Preferred" legend in typed-in mode. |
| N-11 | fixed | Checkboxes 18 px with `accent-color`, selects themed with tokens (real build uses shadcn Checkbox and Select). |
| N-12 | fixed | Chips, inputs 36 px and links 32 px on a phone; recipient rows 44 px. |
| N-13 | fixed | Toasts "Sent to 4" and "Draft SAFE added". |
| N-14, F-27 | fixed | Editor footer is sticky; body has a minimum height of 160 px. |
| N-15 | partly fixed | `--warning`, `--success`, `--bot` now equal the Finance mockup and extra bot tokens are gone. The Finance values give about 3.9:1 for small warning text on white; the shared token source needs a decision. |
| N-16, N-17 | fixed | Group figure is "5.0%" only, aligned to the column. |
| N-18 | fixed | Draft chip sits beside the title. |
| N-19 | fixed | "Keep editing". |
| N-20 | fixed | Governing state gets 12 px top margin. |
| N-21 | skipped | W-04 decision: no filled source button. |
| N-22 | skipped | Disabled Sending button is deliberately dim. |
| N-23 | fixed | Table rows 44 px on a phone. |
| N-24 | fixed | Closed round keeps pipeline and SAFEs. |
| F-38 | fixed | Avatar text is #111 on `--bot` (orange); the Finance agent avatar is neutral grey. |
| F-02/F-11 | fixed | See N-07. |
| F-23 | fixed | Reminder menu drawn (`inv-reminder`). |
