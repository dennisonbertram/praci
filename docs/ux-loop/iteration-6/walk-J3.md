# Walk J3: phone width (375x812) sweep

Target: mock-data demo stack, web port 5381. Viewport 375x812 with touch emulation (`pointer: coarse` confirmed true via CDP `Emulation.setTouchEmulationEnabled`; agent-browser `set device` alone did not set it). Screenshots: `/tmp/uxloop6/J3/`. Page overflow measured with the geometry audit on Chief, Inbox, Finance, Data room and Settings: 0 px horizontal overflow everywhere.

## Story verdicts

| Story | Verdict | Steps actual/ideal |
|---|---|---|
| Phone sign-in (landing, Sign in, email + password) | PASS | 4/4 |
| Sidebar drawer (open, pages, user menu, Settings) | PASS (Settings first open slow, see J3-06) | 3/3 |
| Inbox triage (list, More, Archive + Undo, open message, More > Ask agent, Reply with draft) | PASS with friction (J3-02, J3-03, J3-04) | 7/6 |
| Finance overview (cards, chart, breakdown, upcoming, subscriptions) | PASS with one touch-target finding (J3-01) | 2/2 |
| Data room browse and preview | PASS with caveat (J3-07, J3-10; PDF body not renderable in headless, J3-11) | 3/3 |
| Agent chat with an approval (Investor Relations question card; Inbox agent starters) | PASS (J3-05); the Send-reply approval card in the email panel was already "No longer active", so a live send approval was not exercised | 3/3 |
| Settings (General, Privacy and approvals) | PASS (J3-08) | 4/3 |

Not tried: sending an email, live send approval, PDF page navigation, real on-device iOS keyboard behaviour.

## Excellent
- No horizontal overflow on any screen; no wrapped controls (the audit's `wrappedControls` hits on Settings buttons are false positives, the screenshot shows single-line labels).
- Touch targets measured with `pointer: coarse`: message dialog buttons, composer toolbar, chat React/Reply/More, question-card options, starter chips, preview dialog icons, menu items are all 44 px.
- Inbox More menu and the message "More" menu (Reply all, Forward, Mark unread, Ask agent) fit the screen. Ask agent opens the panel full width with Reply with draft; the draft fills in correctly.
- Question card in chat gives immediate "Answered: ..." feedback and a "Thinking" status.
- Mail-limit error state ("Your mail didn't load / Gmail is limiting requests right now / Try again") is clear and recoverable.

## Findings

| ID | Sev | Cat | What happened vs expected | Evidence | Suspected location | Proposed fix |
|---|---|---|---|---|---|---|
| J3-01 | P2 | a11y | Finance Subscriptions rows are 37 px tall on touch (vendor link 18 px). The intended `pointer-coarse:h-11` on the row loses to `group-data-[compact]/table:h-auto`. Expected 44 px. Observed (computed height 37px, rows [37,53,37,37,57,37,37]). | 14-finance3.png | `packages/ui-web/src/components/ui/table.tsx:47`, `apps/web/src/pages/Finance.tsx:963` | Make the coarse height apply to compact tables (for example `pointer-coarse:group-data-[compact]/table:min-h-11`). |
| J3-02 | P2 | bug | Inbox "Needs reply" unread count changed 4 -> 7 -> 5 across screenshots with the same visible rows and no mark-read action between 06 and 07. Observed; cause suspected (count from a different source than the rows). | 06-inbox.png, 07-more.png, 08-archived.png | `apps/web/src/pages/Inbox.tsx` (section header count) | Derive the section count from the same list that renders the rows. |
| J3-03 | P2 | visual | Inbox content jumps while loading: the To do card appears about 2-4 s after the list and pushes "Needs reply" down (heading top 186 -> 206 px, plus the card height); the space-name line also appears late on Inbox and Data room. Observed. | 06-inbox.png vs 08-archived.png | `apps/web/src/pages/Inbox.tsx` | Reserve the To do card/space-name height or show a skeleton until both are known. |
| J3-04 | P2 | flow | Reply with draft: the composer opens fully empty (no From/To/Subject/body, grey Send) for over 2 s, then fills. No loading cue, so a fast user can start typing into a field that is then replaced. Observed. | 12-replydraft.png, 12b.png | `apps/web/src/components/inbox/ComposeEmail.tsx` | Show the composer with a "Preparing draft" skeleton and disable the body until the draft arrives. |
| J3-05 | P3 | copy | Chat status reads "Starting the computer". Maya has no "computer" concept here. Observed. | 21-q.png | agent run status string (web chat status) | Use "Starting up" / "Getting ready". |
| J3-06 | P3 | perf | Dev stack: cold loads show full-screen "Opening Praci..." for several seconds; Data room list was still skeletons at 4 s and loaded by ~7 s; the first Settings open after load took more than 5 s with no feedback (the second open took ~0.3 s). Likely Vite on-demand compile; not verified on a production build. | 15-dataroom.png, 20-inboxagent.png, 22-settings.png | n/a (dev server) | Re-measure on a production build; add a spinner on lazy dialog opens if still slow. |
| J3-07 | P3 | a11y | Row checkboxes (Inbox 16 px, Data room 18 px) have a ~42 px hit area (measured by elementFromPoint), just under 44. Observed. | 06-inbox.png | `packages/ui-web` checkbox `::after` (42px) | Raise the coarse hit area to 44 px. |
| J3-08 | P3 | visual | Settings: the close X sits on its own row below the section selector, using about 40 px of the 812 px screen, and scrolling content passes under it. Observed. | 22b, 25-settings2.png | Settings dialog layout | Put the X in the same row as the section selector. |
| J3-09 | P3 | flow | Two sidebar rows are both named "Inbox agent" in different spaces. Tapping the one under "Mail rate-limited" silently switched the active space, and the Inbox then showed that space's mail-limit error. Observed. | 20b.png, 27-mailfail.png | `apps/web` sidebar chat rows / space switch | Show the space name on the chat page header when it differs from the last active space, or after a space switch. |
| J3-10 | P3 | a11y | After closing the file preview on touch, a blue focus ring stays on the Data room row. Observed. | 17.png | data room row focus restore | Restore focus without `:focus-visible` styling after pointer-initiated opens. |
| J3-11 | P3 | flow | The PDF preview body was a blank dark box (blob iframe, 311x487) in headless Chromium, which has no PDF viewer. On iOS Safari an iframe PDF generally shows only the first page; suspected, not verified. The preview also spends 487 of 690 px on that frame. Unverified. | 16-preview.png | Data room preview dialog (iframe `blob:...#toolbar=0`) | Test on a real iPhone; if only page 1 shows, offer "Open in new tab" as the primary action on touch. |
