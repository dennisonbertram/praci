# J5: Read with context (STORY-032, 033, 034, 038, 051)

Walked at 1440x900 against the live inbox, read-only. The walk was cut short after the coordinator reported Gmail 429 rate limits, so j/k stepping was sampled only a few times. Screenshots (outside the repo): J5-01-list.png, J5-02-open.png, J5-03-after-j.png, J5-04-closed.png. Items marked "code" come from reading source, not from the browser.

## Friction Scorecard

| Story | Goal | Actual steps | Ideal | Notes |
|---|---|---|---|---|
| 032 find earlier messages | see what was said before | 1 open, then no route; give up or ask agent / go to Gmail | 2 (open, read prior messages inline) | Dead end. Measured in J5-02-open.png: header, three action rows, one message body. No "Thread", count or earlier-message control. Only context is whatever quoted text the sender's client included, shown inside the iframe (measured, same screenshot). |
| 033 j/k neighbours | read the next messages | 1 open + 1 key per message | same | Works mechanically (code: `InboxMessageDialog.tsx:157-173`, `Inbox.tsx:358-364`; URL replaced, history length unchanged, measured idx stayed 1). But see "j target" below. |
| 034 deep link / Back | return to a message | open (push, `inboxList` state), Esc/Back returns in one step (measured: URL back to `/app/inbox`, history idx 1 to 0) | 3 | Good for list-opened. Deep-link case from code only: close uses replace, so Back leaves the app (`Inbox.tsx:352-357`). Reload with `?mail=` not exercised in the browser. |
| 038 recipients | see all recipients | hover for native tooltip | 1-2 | Code: `to` and `cc` share one truncated line, full text only in `title` (`InboxMessageDialog.tsx:234-243`). Measured: the short recipient line fit, truncation not triggered, so not exercised. |
| 051 close, keep place | Esc then j | 2 | 2 | Measured: Esc returned to `/app/inbox` and focus landed on a row button. The list had scrolled to the focused row. |

Measured: opening a message does NOT clear the unread dot. The row was still "(unread)" after open and close (snapshot after reload), and the dialog showed a "Mark read" button after open (J5-02-open.png). That differs from Gmail, where opening marks read. It is consistent with the read-only rule but surprising for users, and it costs a click per message in a triage pass.

Possible defect, measured but not root-caused: j from the second row of Needs reply did not move to the third row. In three samples it went to the last loaded row (row 139 of 139 in the DOM), then to a different non-adjacent message; a further j did nothing. Code builds `ids` as needsReply + today + earlier (`Inbox.tsx:255-258`), which should be adjacent, so the order may change under polling (STORY-033 edge case) or a row is duplicated across groups. Needs an owner to reproduce; treat as suspected.

Decisions the user makes: which of 3 chevron/j meanings applies (it is across threads, not within); whether to risk Archive in the same row as Reply. Re-entry: after a dead end the user must go to Gmail and search again.

## Take-away Pass

Dialog (J5-02-open.png):
- Chevron up/down: labelled "Previous/Next message" but they move across threads. Keep (j/k duplicate them), but rename "Previous/Next in list".
- Sender address in brackets beside the name: useful for trust, could move to a tooltip. Low value.
- Subject title wraps to 2 lines at 20px and takes more height than the sender line. Fine.
- Action row: Reply, Reply all, Forward, Archive, Mark read, five equal outline buttons, no primary action. Reply all appears even for single-recipient mail (code: unconditional, line 254).
- The dialog is 768px wide of 1440px (measured 336 to 1104). The list is about 700px wide and the right side holds only a floating "Create Inbox agent" chip (J5-04-closed.png), so a split reading pane would use free space and make prev/next/close unnecessary.
- Email body sits in a bordered iframe inside the dialog, creating two scroll areas (dialog and iframe). Measured in J5-02-open.png: the quoted history starts below the fold of the iframe.

List (J5-01-list.png): no thread count or "N messages" marker on rows whose subject starts "Re:".

## The Simpler Version

1. Click a row. The message opens in a right-hand reading pane (or the existing dialog), unread dot clears on open (or after a short delay).
2. Header shows sender, date, recipients on one line with a "Details" toggle.
3. Earlier messages in the thread appear below as collapsed one-line items ("Sender, date, first words"), newest expanded. One click expands.
4. j/k moves between threads; Esc returns focus to the list row.

Concrete changes:
- Add thread view: data from existing thread id on rows (`Inbox.tsx:260` groups use `threadId`); render in `InboxMessageDialog.tsx:277-301`. Needs an API call listing thread messages (apps/api/src/inbox.ts); not present today.
- Add a thread count badge on rows (`InboxRow.tsx`).
- Mark read on open (or after dwell) in `Inbox.tsx:openMessage` (line ~347) via `setRead`; keep "Mark unread" in the dialog. Product decision, flagged.
- Rename chevron labels (`InboxMessageDialog.tsx:191,201`).
- Hide Reply all unless the message has more than one other recipient (line 254).
- Make recipients an expandable "Details" instead of a hover-only `title` (lines 234-243), so keyboard and touch users can read them.
- Investigate the j target issue (`Inbox.tsx:255-258`, `goToMessage` at 358).

## Clarity Issues

- Chevrons say "message" but mean "row"; users looking for thread history will press them first (STORY-032 step 4-6).
- No signal that a thread has more than one message; a "Re:" subject is the only hint.
- Unread dot persists after opening, so the user cannot tell what has been seen without Mark read.
- Recipient list is hidden behind a tooltip that keyboard and touch cannot reach.
- Same subject and sender appear on the row, the dialog title and the reply header (once-and-only-once violation, minor).
- Deep-link Back exits the app (code only, not exercised).

Verdict: convoluted for the context-finding goal (a dead end, no thread view, plus a possible j-navigation defect), acceptable for plain open/close/Back (matches ideal).
