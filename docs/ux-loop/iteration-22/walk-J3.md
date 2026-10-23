# Walk J3: phone width (375x812) sweep

Session uxl22-J3, mock-data demo stack, signed in as the seeded mock founder. Touch emulation was on for the whole walk (`pointer: coarse` and `hover: none` both true, 5 touch points, set through the browser debugging protocol because agent-browser has no flag for it). Touch targets were measured with a script that lists visible interactive elements under 44 px; the geometry audit was run on the signed-in Chief screen. Page overflow was 0 px on every screen walked. The console showed no errors.

## Story verdicts

| Journey | Verdict | Steps (actual / ideal) | Note |
|---|---|---|---|
| Sign-in | PASS | 5 / 4 (open, Sign in link, email, password, submit) | Form is clear, show-password eye, 44 px fields. Lands on Chief with history. |
| Sidebar drawer | PASS | 1 / 1 | All 44+ px rows, badges readable, Integrations and account at the bottom. |
| Inbox triage (open, Archive, Undo, Cleanup) | PASS | 4 / 4 | Archive returns to the list with an Undo toast; row checkboxes have a 44 px hit area. |
| Finance overview | PASS | 1 / 1 | Cards, chart (44 px month links, scrolls sideways), Breakdown and Upcoming read well. |
| Data room browse and preview | PASS with notes | 3 / 3 | Preview sheet fine; Full screen adds nothing for this file (J3-04). |
| Agent chat with approval (email agent: Draft a reply, choose account, Send) | FAIL | 6 / 5 | Card ends as "Not sent" with no reason (J3-01). |
| Settings (General, Privacy and approvals) | PASS | 2 / 2 | `/app/settings` opens Settings; switches have a 58x44 hit area. |

Pass-21 items seen working at phone width: header has no bottom borders; the To do card is collapsed; Cleanup explains in one line why it is empty; the Finance chart has 44 px month targets; email actions show text labels (Reply, Archive, Ask agent) rather than bare icons.

## Findings

| ID | Sev | Cat | What happened vs expected | Evidence | Suspected code | Proposed fix |
|---|---|---|---|---|---|---|
| J3-01 | P1 | flow | Observed: after choosing a From account and tapping Send on the email agent's approval card, the card turned into "Not sent" with an "Open in composer" button and no reason. The agent then said it was still "checking the holdings before drafting a factual confirmation", as if nothing failed. Expected: a failed send names its cause (the demo mailbox shows "needs reconnect" and "rate-limited" rows) and the agent reports the failure. The cause on the demo is not confirmed. | 20-sent.png, 22-sent3.png | `apps/web/src/components/MailApprovalCard.tsx:537` (error line only renders when `mail.error` is set) | Show a default reason ("Your mail account could not send this. Reconnect it in Integrations") when the outcome is failed and no error text exists, and make the agent report failed sends. |
| J3-02 | P3 | flow | Observed: with two sender accounts, Send is greyed out until From is chosen, and nothing says why except the "Choose an account" placeholder. Expected: preselect the account the mail arrived on, or label the disabled state. | 18-draft.png, 19-account.png | `MailApprovalCard.tsx` sender select (about line 367) | Preselect the account that received the thread. |
| J3-03 | P3 | visual | Observed: Data room search field is painted about 32 px tall next to the 44 px Filters and view buttons (hit area is 44). Expected: same painted height. | 12-dataroom.png | Data room header search input styles | Give the search input the same painted height as its neighbours. |
| J3-04 | P3 | flow | Observed: Preview's Full screen button opens a screen identical in content to the compact preview (icon, Open, Download) for MOCK-q3-board-deck.pdf. Probably caused by the 717-byte fixture file; suspected, not confirmed. Expected: Full screen hidden when there is nothing more to show. | 13-preview.png, 14-preview-expanded.png | data room preview dialog | Hide Full screen when the file has no inline preview. |
| J3-05 | P3 | visual | Observed: the collapsed To do card is about 70 px tall for a single line of text ("To do 4"), so it still pushes the first rows down a phone screen. | 06-inbox.png | Inbox To do card | Reduce the card's vertical padding to a row height of 44 to 48 px. |
| J3-06 | P3 | visual | Observed: on the empty Cleanup screen the "Open Newsletters" button sits about 8 px under the sentence; it looks attached to the text rather than a separate action. | 09-cleanup.png | Cleanup empty state | Add 16 px of space above the button. |
| J3-07 | P3 | a11y | Observed: the inline "Open Finance" link in a Chief reply is 100x21 px, below 44 px on touch. Links in running text may be exempt; the agent writes the link in chat by decision (pass 17). | geometry measurement | chat markdown link style | Add vertical padding to chat links on coarse pointers. |
| J3-08 | P3 | perf | Suspected: right after navigating to `/sign-in` signed out, the first screenshot was an empty dark page; the form appeared by the next snapshot a few seconds later. Duration not measured. | 02-signin.png | auth route load | Measure; show the form (or the logo) immediately. |

Excellent at phone width: the drawer (every row 44 px with clear badges), the Inbox row checkboxes (16 px box with a 44 px hit area), the switches (32x18 with a 58x44 hit area), the Finance chart month links, and the full-screen email agent with a clear back arrow.

## Not covered

Skipped: Hide amounts at phone width, Inbox pile tabs beyond Important, Settings Models and Memory, the secret-request card, the Share-with held card. No BLOCKED stories. The email approval walk used the demo mailbox only; the archived mail was restored with Undo.
