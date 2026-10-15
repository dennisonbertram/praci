# J2: Triage pass (STORY-029, STORY-025, STORY-024)

Critic ID J2, 1440x900, read-only walk of a real mailbox. Screenshots (outside the repo) are cited by filename only. "Measured" means observed in the browser or counted in the DOM. "Suspected" means inferred from code or an unreproduced observation. The walk was stopped early at the coordinator's request because the mail provider began rate limiting (see "Walk limits").

Verdict: **convoluted** for a 130+ row triage pass. Each row costs 2 to 3 decisions, nothing tells the user how much is left, and the list ends without a cue. Single-row interactions are clean.

## Walk limits

- Not exercised (read-only walk): Archive, Mark read/unread, Mark noise/important, Reply. These are evaluated from code only.
- Hover icons were seen (J2-04-hover.png), not clicked.
- Rapid j/k inside the dialog was cut short (rate limit). One observation is unreliable: in one run, pressing `j` inside the open dialog from the second row ended on a row near the end of the list (selection index 138 of 139). I could not reproduce it cleanly, and my own earlier hung commands may have queued key presses. Treat as suspected and worth a separate check. Code shows `j` in the dialog moves to `ids[openIndex+1]` (`InboxMessageDialog.tsx:166`, `Inbox.tsx:688-689`).

## Friction Scorecard

| Measure | Actual | Ideal | Evidence |
|---|---|---|---|
| Rows in list | 139 (5 Needs reply, 42 Today, 92 Earlier at first load; 9 more after scroll counted as the same list) | A number the user is told | measured, DOM count; J2-01-top.png |
| Scroll length | 6673 px of content in a 900 px viewport, about 7.4 screens | n/a | measured, J2-02-bottom.png |
| Row height | 44 px (about 20 rows per screen) | n/a | measured, `InboxRow.tsx:128` `h-11` |
| Unread dots | 130 of 139 rows have the unread dot | A dot that separates rows | measured; dot carries almost no information here |
| Badges | 63 rows carry a badge (Newsletter, Junk, Needs attention) | Badges only where they change a decision | measured |
| Decisions per row (keyboard) | 3: open or skip, archive or leave, mark noise (mouse only) | 1: keep or clear | `inbox-keyboard.ts` has no mark key; marks are hover icons only (`InboxRow.tsx:101-105`) |
| Actions per row | 4 hover icons (archive, read, important, noise), unlabeled, no tooltip | 1 or 2 visible | measured J2-04-hover.png; `InboxRow.tsx:174-209` |
| Progress signal | None in page. Only the sidebar unread badge (131), which does not match the 139 rows | "N left in Needs reply" | measured J2-01-top.png |
| End-of-list cue | None. The last row is followed by blank space | "End of list" or "All caught up" | measured J2-02-bottom.png |
| Undo for Archive | None. Marks have an Undo toast, archive does not | Undo toast for archive | code `Inbox.tsx:301-309`, no status set; not exercised |
| Confirmations | None on archive (fine if undo existed) | Undo instead of confirm | code |
| Dead ends | Empty list says only "No mail" (`Inbox.tsx:617`) | Finished state | code |
| Re-entry | Closing a message returns focus to its row (`Inbox.tsx:390-402`) | Same | code; works as designed, clean-run check incomplete |
| Hesitations | Cannot tell why a row is in Needs reply; cannot tell critical from low | Reason visible | `inbox-groups.ts` sorts by priority but row shows none; `MailRow.reason` unused in row (per catalog STORY-025, verified `InboxRow.tsx` has no reason) |

Cost of 200 emails at current interaction cost (estimate, not measured): with keyboard only, a skim-and-archive pass is `j`,`e` per row = 2 keypresses per row, about 400 presses, with no undo and no count. By mouse, one row costs a hover plus one click on an unlabeled icon. Marking noise has no keyboard path, so silencing a repeat sender costs a mouse trip per sender. Reading one message costs Enter, read, Esc or j; there is no key that means "read, then archive and advance" except `e` inside the dialog.

Steps actual vs ideal for STORY-029: catalog ideal 18; the catalog walk has 18 steps but 5 of them (11, 12, 13, 14, 16) are recovery or workaround steps (undo hunt, search, clear filters, per-row Mark read). Suspected from the catalog, not re-walked.

## Take-away Pass

Screen: Inbox list top (J2-01-top.png)
- To do card sits above Needs reply and pushes the first row down to about y=310. Keep, but it competes with the real list for the first screen. It shows 2 items plus "3 more".
- Unread dot on 130 of 139 rows: remove or invert (show a mark only on read rows). When nearly everything is unread, the dot is decoration (`InboxRow.tsx:130-134`).
- Badges "Needs attention" (hidden in Needs reply by `hideAttention`), "Newsletter", "Junk": the Junk and Newsletter badges on 63 rows are the most useful signal for batch clearing, but they take the same visual weight as the Needs attention badge, which asks for action. Mute the Newsletter and Junk badges; keep Needs attention loud.
- "Important" toggle and "Needs reply" heading overlap in meaning (catalog STORY-030). Keep one, or rename the toggle.
- Right-hand "Create Inbox agent" button floats mid-screen at x=1250 (J2-01-top.png). It is not part of triage and draws the eye. Collapse to the header icon.

Screen: Hover state (J2-04-hover.png)
- Four ghost icons appear and cut the subject/snippet text to about 310 px. Icons have no visible label or tooltip (`InboxRow.tsx:174-190` only sets `aria-label`). Keep archive; the other three should move to the dialog or a menu.

Screen: Bottom of list (J2-02-bottom.png)
- Nothing after the last row. Add an end cue.

Screen: Message dialog (J2-05-dialog.png, J2-06-dialog-next.png)
- Dialog shows Reply, Reply all, Forward, Archive, Mark read (5 buttons) for every message, including a no-reply notification. Reply all and Forward are rare in a triage pass; collapse them.
- No position or count ("12 of 139"), so stepping with j/k gives no sense of progress.
- While the next message loads the dialog shows the title and an empty body with no spinner (J2-06-dialog-next.png, measured about 1.5 s after the keypress).
- No Mark noise in the dialog (catalog STORY-026). A person triaging by reading must close the dialog to silence a sender.

Screen: Shortcut help (J2-07-help.png, `InboxShortcuts.tsx`)
- Lists j/k/Enter/e/r/a/f/c, but omits `o` and arrow keys and says "Next message" for j without saying it also works inside the dialog. No key for mark noise or important.

## The Simpler Version

Ideal triage pass, numbered:
1. Land on the list; header line reads "5 need a reply, 134 earlier". (new)
2. `j` selects the first Needs reply row; the row shows one short reason (e.g. "Asked a question"). (new)
3. `Enter` opens it; the dialog title shows "1 of 5".
4. Reply (`r`), or `e` to archive and advance; archive shows an Undo toast.
5. Esc returns to the list with the row focused.
6. Needs reply empties; the heading changes to "Needs reply: done".
7. In Earlier, `n` marks the selected sender as noise and advances; `e` archives and advances.
8. The last row is followed by "End of list. 0 left" or a Load more control.

Concrete changes (file:line):
1. Show counts in group headings: `Inbox.tsx:644-674` pass `rows.length` into `InboxGroup` and render it in `InboxRow.tsx:52`. Gives the missing progress signal and an end state.
2. Add an end-of-list line after the Earlier group at `Inbox.tsx:674` (also the empty-state copy at `Inbox.tsx:617` should say the inbox is clear, not "No mail"). Per AGENTS.md, quote the copy in the PR and justify it.
3. Show the reason for Needs reply rows: render `row.reason` in place of the snippet inside `InboxRow.tsx:150-153` when `hideAttention` is set. The data exists on `MailRow.reason`.
4. Add an Undo toast for archive: reuse the `status` toast (`Inbox.tsx:315`, `708-721`) in `archive` at `Inbox.tsx:301-309`. This removes the main reason for hesitation after `e` (catalog STORY-024 step 5, STORY-029 step 11).
5. Add keyboard marks (for example `n` for noise): `inbox-keyboard.ts` handler near the `e` branch, call `onMark` from `Inbox.tsx`.
6. Reduce hover icons to archive plus a "More" menu (the menu already exists for touch at `InboxRow.tsx:211-241`), and add tooltips.
7. Show "N of M" in the dialog header using `openIndex` and `ids.length` (`Inbox.tsx:365`, `684-702`), and show a loading indicator in the dialog body.
8. Do not prefetch on every selection change: `Inbox.tsx:387-389` prefetches the selected message on each j/k move, and `Inbox.tsx:384-386` prefetches the first three. This is likely the cause of the rate limit noted by the coordinator (suspected from code and the coordinator's report, not independently measured). Debounce (about 250 ms) or prefetch only the next one row.

## Clarity Issues

1. The sidebar badge (131) and the list (139 rows, 130 unread dots) disagree, and neither is labeled. Measured J2-01-top.png and DOM count.
2. "Needs reply" has no reason and no priority, though the order carries priority. Suspected user confusion; evidence is the missing render in `InboxRow.tsx`.
3. Subject and snippet share one truncated line (`InboxRow.tsx:150-153`); when the subject is long the snippet is lost, and on hover the icons cut the line further (J2-04-hover.png).
4. Sender names truncate at about 13 characters at this width for long names (J2-01-top.png), which hides who a row is from for display names with a company suffix.
5. Row icons are unlabeled glyphs without a tooltip.
6. Silent no-op: with a filter or search active, `e` does nothing and nothing explains why (`Inbox.tsx:380`, `650`; catalog STORY-024 edge case). Not exercised.
7. Mixed signals in badges: "Junk" and "Needs attention" share a style family and weight with "Newsletter" (J2-01-top.png).
8. The shortcut help omits `o`, arrows and any mark key (J2-07-help.png).
