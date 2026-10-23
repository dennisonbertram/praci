# Walk R2, iteration 23: verify iteration-22 clusters C11 to C20

Walker uxl23-R2, mock-data demo stack, desktop 1440x900 and phone 375x812 with touch emulation (pointer: coarse measured true). Signed in as the seeded demo founder; two extra invented users (walker-r2-N, walker-r2c-N at northwind.example.test) were created to see the first-run flow. Screenshots are in the walker's temp folder (names below).

## Verdicts

| Cluster | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| C11 Inbox rows | PARTIAL (3 of 4 criteria pass) | 4/4 | After Allow, sorted Inbox: "Show 18 more" left edge x=385 vs sender column x=384 (04-inbox-sorted.png). Filter > Unread says "14 results" and the sidebar badge says 14 (06-unread.png). At 375 px rows in "Earlier" show the words "Important" and "Action" before the subject (11-inbox-375b.png). FAIL: collapsed To do card measures 56 px at 375, criterion is 48 px at most (10-inbox-375.png). Cleanup empty state not reached. |
| C12 Phone drawer and tour | PASS | 5/4 | With 4 chats the drawer lists all of them without "+N more" and Pages are collapsed to the current page (12-drawer-375.png); focus lands on "Close menu", not Search. New user at 375: tour did not start while the first-question card was open; after dismissing, the drawer opened by itself with tour card 1/9 visible (76-phone-tour.png). Desktop new user: tour card appeared right after dismissing the card (72-after-dismiss.png). Only 4 chats were available, so the 13-chat case was not tested. |
| C13 Phone chat actions and links | PASS with a regression (R2-23-01) | 2/2 | The "..." now sits on the timestamp line, no extra row per message (13-chat-375.png). Inline chat links measure 45 px (one line) and 68 px (two lines) tall under touch emulation. |
| C14 Data room | PASS | 4/4 | 1440: seeded names do not wrap and rows are 56 px (the failed-file row is 77 px because it carries the error and Replace file) (20-dr-1440.png). Stats: chips start at x=344, the content edge; chart baseline reads 0 (21-dr-stats-1440.png). 375: Filters sits beside the folder picker, search field is 44 px (14-dr-375.png, 15-dr-stats-375.png). Full screen is absent for a .txt note and present for PDFs that have an inline preview. |
| C15 Investors on phone | PASS | 3/3 | The audit request title wraps to two lines in full, buttons under it; no bare dash in Contacts; the SAFE block has column headings "Amount" and "At cap" (16-inv-375.png, 18-inv-375c.png). |
| C16 Settings General | PASS | 4/4 | Expanding Chat display moved Language and time zone down inside its own column only; the right column stayed put (31-settings-open.png). Notifications card has a heading. Delete account label spacing matches other labels (32-delete.png). In Models, the disabled Test and Connect API key buttons are dimmed (34-models2.png). Off-state switch tracks are visible but still faint on the dark card (see R2-23-06). |
| C17 Delegation outcome | PARTIAL | 2/2 | A New Bot thread created by another walker today shows "Messaged Inbox agent" followed by a reply, so the silent case did not recur (60-newbot.png, 61-inbox-agent.png). A waiting or failed state could not be forced on the demo, so those states are unobserved. See R2-23-05 about the reply wording. |
| C18 Slow loads | PASS | 2/2 | Investors showed 17 skeleton blocks in the first paint and was complete after about 2 s. Finance Burn settled in 2 s. Legal Graph rendered immediately. The 20 s "Still loading / Try again" line (commit 1ae9fbd68) was not observable because nothing was slow. |
| C19 Space switcher heading | PASS | 3/3 | Legal's switcher menu is headed "Company" (53-legal-switch.png). The old string is gone from application source. |
| C20 Artifacts | PASS | 3/3 | All ten grid cards are 72 px including the v2 card (40-artifacts.png). Card titles and descriptions carry title attributes. List: Added column ends at x=1412, flush with the dividers (41-artifacts-list.png). Split view: no repeated relative time, divider runs full height (42-artifacts-split.png). |

Console: no page errors reported by agent-browser. Geometry audit on Inbox at 1440: no page overflow; only the known uneven rows from sidebar flex rows.

## Findings

| id | page | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R2-23-01 | Chief chat, first-question card, phone (C13 regression) | P1 | bug | OBSERVED: the card's Dismiss X (44x44 at x 265, y 334) is overlapped by the message "..." button (44x44 at x 274, y 317). Tapping the visible X opens the React / Reply / Copy / Remember menu instead of dismissing the card. Expected the X to dismiss. A first-time phone user cannot dismiss the card by tapping its X, and the tour only starts after it. | 73-phone-new.png, 75-x-tap.png, measured rects | message action button placement in the shell transcript (apps/web/src/pages/shell/transcript.tsx, Shell.tsx) for non-text blocks such as the question card | Do not render the corner "..." button on cards that have their own controls, or put it on the timestamp line only. |
| R2-23-02 | Inbox, phone | P3 | visual | OBSERVED: collapsed To do card is 56 px at 375, C11 asked for 48 px or less. | 10-inbox-375.png | apps/web/src/pages/Inbox.tsx To do card padding | Trim vertical padding on the collapsed card at phone width. |
| R2-23-03 | Artifacts grid | P3 | copy | OBSERVED: the versioned card shows "MOCK Investor Update -..." with v2, so the month is cut off; only a hover title shows the full name, and touch has no hover. | 40-artifacts.png | apps/web/src/pages/Artifacts.tsx card title with line-clamp-1 beside the version badge | Let the badge sit on the description row, or allow the title two lines while holding the card at 72 px. |
| R2-23-04 | Data room list 1440 | P3 | visual | OBSERVED: Type column truncates "Investor docume..." while Name has spare width. | 20-dr-1440.png | apps/web/src/components/data-room/ItemRows.tsx column widths | Give Type a little more width (about w-36). |
| R2-23-05 | Chat delegation | P2 | flow | OBSERVED: the Inbox agent answered "Sent to Priya" for a delegated send, with no approval card, no tool record and no mail evidence in the thread, although new users have "Ask before sending external email" on. SUSPECTED: scripted mock-model text, so this may be demo-only; not verified whether any mail went out. | 61-inbox-agent.png | Inbox agent reply path (apps/api) | Check that "Sent" appears only after a send result; if the mock cannot send, have it say a send needs approval. |
| R2-23-06 | Settings General | P3 | visual | OBSERVED: off-state switch tracks are visible but low contrast on the dark card; not measured (visual estimate only). | 32-delete.png | packages/ui-web switch | Compute the off-track contrast and raise the border to 3:1 if below. |

## Summary counts

PASS 8 (C12, C13 with regression R2-23-01, C14, C15, C16, C18, C19, C20), PARTIAL 2 (C11, C17), FAIL 0, BLOCKED 0. Findings: P1 1, P2 1, P3 4.

Praise: the phone drawer and tour now work together (the tour opens the drawer itself and waits for the first-question card). The Data room list at 1440 is calm and even, and Investors paints skeleton rows at once.
