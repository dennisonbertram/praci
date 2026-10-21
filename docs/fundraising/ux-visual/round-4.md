# UX visual review, round 4

Scope: all 50 mockup views at 1400px and 390px in light mode, and the 14 views changed in round 3 also in dark mode at both widths. Screenshots are in `docs/fundraising/ux-visual/round-4/screens/` (128 files, named `<width>-<view>.png` and `<width>-dark-<view>.png`). At 1400px the app shell scrolls inside `main`, so I also took taller `1400-tall-*.png` captures of the Investors views so that menus below the first screen are visible. Raw `layout-audit.js` output for every capture is in `round-4/audit/` (128 JSON files). Tap-target measurements are in `round-4/audit/targets-390.txt` (every element under 44px high) and `targets-1400.txt` (links under 24px high). I opened every screenshot with the image reader.

Audit totals: page scroll X is 0 in all 128 audits; `offscreenPrimary` is empty in all 128; the only overlaps reported are popovers and dialogs sitting over content, which is intended. Contrast hits are only the known `--warning` and `--success` tag items (3.5 to 4.35:1), not re-raised.

## Part 1. Round 3 items

Counts: 24 of 25 round-3 items are confirmed fixed, 1 is not fixed.

### Not actually fixed

| Id | Status | Evidence |
|---|---|---|
| N-07 (every button 44px on a phone) | Not fixed for menus and four other controls | The resolution table says "every button and icon button is 44px". Measured at 390 (`audit/targets-390.txt`): every popover menu item is 190x33 (all menu views, for example `390-fund-safemenu.png`, `390-inv-contactmenu.png`); the source buttons "Carta · as of Sep 30", "Mercury · 5 min ago" and "Connect Mercury" are 142x32 or 116x32; the "Passed 1 ›" toggle is 60x28 (every Fundraising view); "Different terms" is 91x32 (`390-safe-dialog.png`); "YC documents ›" is 98x19 (`390-safe-cover.png`). The primary buttons, empty-state buttons, Retry, Mark funded and Keep editing are now 44px (confirmed). See new finding W-01. |

### Confirmed fixed

N-12 ("Find in Finance" and "SAFEs, if converted at cap ›" are no longer in the sub-44 list at 390 and not under 24px at 1400), N-16 (group percent "5.0%" ends at x 1315 like the other rows in `1400-investors.png`, and in `390-investors.png`), V3-01 (one sentence "The sheet could not be read." and no truncated chip, `1400-inv-nosnap.png`, `390-inv-nosnap.png`), V3-02 for the date (no "Oct / 20" split; the separator is hidden before "Link to Mercury SAFE" on a phone; a trailing dot remains, see V4-03), V3-03 (dead-link page left aligned), V3-04 (editor subject and email subject share the format "Example Robotics · <month> update"), V3-05 (Open buttons are 44px in the Action items and Updates cards), V3-06 (dark scrim 60%, dialogs clearly separated in `1400-tall-dark-inv-copylink.png`, `390-dark-inv-addcontact.png`), V3-08 (Finance avatar is no longer in the low-contrast list; disabled recipient checkboxes are empty outlined boxes in `1400-dark-editor.png`). Round-2 items N-01 to N-24 that I re-checked on the changed views still hold: one filled button per Fundraising view, dialogs fit 390, failed send shows "Partly sent", "3 of 4 sent" and Done, closed round keeps the pipeline.

V3-07 and N-15 (shared `--success` and `--warning` tokens) stay skipped as agreed.

Round-3 changed views checked specifically: `safe-link`, `inv-updmenu`, `inv-copylink`, `inv-addcontact`, `inv-changed`, `inv-failed`, `inv-nosnap`, `fund-safemenu`, `fund-closed`, `fundraising`, `editor`, `ed-nogmail`, `link-dead`, `investors`, in light and dark at both widths. Layouts match between themes; no clipped dialogs, no off-screen primary action (the editor footer is sticky, Send is visible in the 844px viewport), no overflow.

## Part 2. New findings

Counts: 0 blocker, 0 must-fix, 2 should-fix, 5 nice.

### Should-fix

- **W-01. Remaining phone targets under 44px, and two desktop links under 24px.** The brief requires 44px for every action on a phone and at least 24px for desktop links. Failing at 390: all popover menu items (33px, the only way to reach Mark sent, Cancel SAFE, Link to Mercury SAFE, Resend link, Revoke, Delete, Mark done, Stage moves, Reminder choices), the source/Mercury buttons (32px; for "Sync failed" this is the route to Reconnect), "Passed 1 ›" (60x28), "Different terms" (91x32), "YC documents ›" (98x19). Failing at 1400 (`audit/targets-1400.txt`): "Different terms" 91x19 and "YC documents ›" 98x19. Round 2 recorded the 32px menu items as consistent but never set them against the 44px rule. Fix: `.pop button` and `.src` at `min-height:44px` below 900px; the same `.lnk.b`-style padding for "Different terms", "Passed" and "YC documents"; `min-height:24px` for the two links on desktop. Filter chips and form inputs at 36px were accepted in round 2 and are not counted here.
- **W-02. Typed-in cap table clips the Shares number on a phone.** At 390 the Shares input is 75px wide and its content is 80px (`scrollWidth` 80 against `clientWidth` 73), so the last digit of every seven-digit value is cut: "3,300,00", "2,800,00", "1,400,00", "1,100,00" in `390-inv-native.png`, `390-inv-changed.png`, `390-inv-notsaved.png`, `390-inv-native-menu.png`. Measured on `inv-native`. A founder typing the cap table in on a phone cannot see the number they entered, and a larger share count would lose more digits. Round 3 only noted that the Security select shortens "Seed Preferred" (still true: "Seed Preferre"). Fix: give the Shares input at least 96px (for example `.erow` grid columns of `1fr 1.2fr` for the second row) or put Shares on its own row; allow the Security select to take the width it needs.

### Nice

- **V4-01. Dark-mode radio.** `1400-dark-safe-link.png` and `390-dark-safe-link.png`: the unselected radio is a solid white disc and the selected one has a grey dot in a ring, so the unselected option looks like the chosen one. The mock sets `accent-color` without `color-scheme: dark`. The shipped shadcn radio should have a visible outline when unselected.
- **V4-02. Partly sent header chip on a phone.** `390-ed-failed.png`: the "Partly sent" chip wraps under the title onto its own line and pushes the form down about 22px compared with the other editor states. Shorten to "Failed" or let the title truncate.
- **V4-03. Dangling separator.** `390-inv-partly.png`: "Tom Okafor failed ·" ends a line and "Investors · Oct 20" starts the next, the same pattern V3-02 fixed on Fundraising.
- **V4-04. Dead-link sent state is centered, dead-link form is left aligned.** `1400-link-sent.png`, `390-link-sent.png`: after the form submits, the message moves to the center and on a phone leaves the orphan "spam." on its own line. Left align it like `link-dead`.
- **V4-05. Typed-in header crowding at desktop.** `1400-inv-native.png`: header "Invested" ends at x 1243 and "Fully diluted" starts at x 1251, an 8px gap, so the two read as one phrase. Right-pad the Invested header by one grid gap.

## What is excellent as is

- Portal views at both widths and themes: one primary action per state, 44px Open, Download, Email me a link, and no sub-44 target on any portal view except the email mock link.
- Every dialog fits 390 and keeps Cancel and the primary button on one row with 44px height.
- The single filled button per Fundraising view holds across no-round, closed round and no-Mercury states.
- Dark mode: tokens, tags, scrim and checkboxes are consistent across the 14 views; no view shows an unreadable region beyond the known warning and success tags.
- Editor footer is sticky on a phone, so Send, Send anyway and Done stay in view.

## Round 4 resolution

| Id | Status | Change |
|----|--------|--------|
| N-07 / W-01 | fixed | Rule stated once in README "Pages" (Tap targets). Phone: popover items, source buttons, chips, inputs, text links, "Passed 1 ›", "Different terms", "YC documents ›" are 44 px; desktop links 24 px. |
| W-02 | fixed | Typed-in rows stack as label and value pairs on a phone; full-width values, nothing clipped (`inv-native`). |
| V4-01 | fixed | Radios drawn with an outline when unselected; `color-scheme: dark` set. |
| V4-02 | fixed | Editor back button is an arrow only on a phone; the Partly sent chip stays on the title row. |
| V4-03 | fixed | Partly sent row: failed name on its own line on a phone, separator hidden. |
| V4-04 | fixed | `link-sent` is left aligned like `link-dead`. |
| V4-05 | fixed | Fully diluted column widened to 96 px; headers no longer touch. |
