# Walk R1 (iteration 19): verification of pass-18 clusters C1-C10

Target: demo stack (web 5381), 1440x900 unless noted. Screenshots: /tmp/uxloop19/R1/. Shared demo account, so other walkers' approvals appeared in my toasts.

## Verdicts

| Cluster | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| C1 approval toast restore | PASS (mail variant) | 6/4 | Pending mail approval: left chat, reloaded, toast back in under 16 s and names recipient. X dismiss stayed dismissed after reload. Discard removed it for good. Card shows in panel when the agent ends with no text. Mercury payment variant not run: writes are off in the demo, the agent said no approval card was created. |
| C2 Legal truncation, unchecked row | PASS | 3/3 | No truncated cell (scrollWidth check, 0). Term wraps to two lines on every row. Unchecked line is plain text, no border. One scan button. |
| C3 Finance cash note | PASS | 1/1 | Cash subtitle "5 bank accounts"; header says "1 non-USD transaction not counted" visibly; strip says "Out so far this month, not over". |
| C4 Investors equity dash | PARTLY | 1/1 | Code has a skeleton until safes load and a Try again on failure (Investors.tsx:178-195). Page showed $250,000 + "$50,000 committed". Fresh-session path and one-sync-per-window not exercised. |
| C5 Data room list | PASS | 8/6 | Type and Parties not cut, no Status column. Failed row/card: one statement plus visible Try again, Delete in menu. Uploaded bad PDF: sidebar badge 1 to 2 without reload; delete from preview: preview closed, badge back to 1. |
| C6 sidebar short screens | PARTLY | 5/3 | Needs-you rows all visible (3 observed, 227 px; code guarantees all). Collapsed group shows dot badge. NOT met: no "+N more" cue; at 1280x800 only 4 chat rows plus a cut fifth (needs 6), at 720 high 3 rows and no cue; with Activity open no chat row is visible. |
| C7 mail approval account | PARTLY | 3/3 | Card names sending account (From: sales@northwind...). Demo has one account, so the picker (MailApprovalCard.tsx:128, 348) and the fix-it button were not observed. |
| C8 first mail sort | FAIL / BLOCKED in part | 2/2 | Needs reply holds 24 of 33 mails (73%), criterion is under 40%. During-sort jumping and pre-consent bars need a fresh unsorted mailbox: BLOCKED. |
| C9 slow loads | PARTLY | 6/4 | Settings > Privacy: layout stable by 150 ms, no later shift over 8 px (sampled every 50 ms). Phone PDF preview shows Open and Download at once. Mail body load failure (forced by blocking inbox/get): clear "Could not reach the server" + Try again, but no Reply/Archive in that state; loading state shows them per code (InboxMessageDialog.tsx:455), not observed. Chat-by-URL header seen, but could not force a slow load. |
| C10 Integrations | PARTLY | 1/1 | Every connected card has a "..." menu; no Connected pills. NOT met: Carta still a letter tile "C". 44 px touch targets not measurable: agent-browser device mode gives pointer: coarse = false. |

## Findings

| id | page/cluster | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R1-01 | C6 sidebar | P2 | flow | Observed. At 1280x800 the chat list shows 4 rows and a cut fifth, at 1280x720 three, with no "+N more" cue (only a fade). With Activity open no chat row shows. Expected 6 rows or a cue. | c6-noact-800.png, c6-noact-720.png, c6-1280x800.png | apps/web/src/pages/Shell.tsx:4900 | Add a "+N more" row at the bottom of the roster scroller when rows are clipped. |
| R1-02 | C8 inbox | P2 | flow | Observed. Needs reply holds 24 of 33 mails (5 shown, "Show 19 more"); expected under 40%. Cause (mock classifier vs seed text) not traced. | text dump of inbox, c8-inbox.png | inbox sort classifier | Tighten the Needs reply rule to mail that asks a direct question or has a deadline. |
| R1-03 | C10 integrations | P2 | visual | Observed. Carta card shows a letter "C" tile; expected a logo. | c10-int.png | integrations catalog icon map | Add the Carta logo asset. |
| R1-04 | C9/C20 data room phone preview | P3 | visual | Observed. Phone PDF preview shows Open and Download twice: header icons and body buttons. | c9-phone-prev1.png | apps/web/src/components/data-room/PreviewActions.tsx | Hide the header icons or the body buttons on narrow screens. |
| R1-05 | C9 mail dialog | P3 | flow | Observed with forced failure. Error state has Try again but no Reply or Archive. | c9-mail1.png | InboxMessageDialog.tsx:455 | Show Reply and Archive in the error state too. |
| R1-06 | C2 Legal | P3 | copy | Observed. "1 Data room document not yet checked by Legal" names no file and links nowhere. Allowed by the criterion, still a dead end. | c2-legal3.png | Legal.tsx:300-314 | Link the line to the Data room failed or unchecked filter. |
| R1-07 | C2 Legal | P3 | visual | Observed. Term wraps to two lines on all 10 rows, making rows 57 px. | c2-legal2.png | LegalContracts.tsx:162-169 | Use "Dec 2025 - Dec 2026" or give Term more width. |
| R1-08 | Finance agent | P3 | copy | Observed. With Mercury writes off, the agent replies "...read-only recipient access... Open Integrations", though the switch is on the Mercury page ("Allow changes"). | c1-pay4.png | Mercury agent message | Link to the Mercury page's Allow changes instead. |
| R1-09 | C10 integrations | P3 | visual | Observed. Coinbase card has no "Used by" row; the others do. | c10-int.png | integrations card | Show the row consistently or never. |

Praise: the Legal table, Finance Cash card, and Data room failed-file row are clean; the restored approval toast names the recipient or amount ("Send $1,200.00 to Acme Servo Supply (Mock) from MOCK Checking").

## Not verified
Mercury payment toast restore, multi-account sender picker, fresh-session Investors, mail sort during sorting, slow chat and mail loading states, 44 px touch targets (no pointer: coarse emulation), C11-C20 (out of scope). Side effects on demo: Allowed Legal documents AI consent, uploaded and deleted r1-bad.pdf, one pending mail approval ("hello number 1") left open.
