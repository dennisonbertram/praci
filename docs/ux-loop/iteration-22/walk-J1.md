# Walk J1, long journeys: first run, Monday inbox, runway before a board meeting

Walker session uxl22-J1. Target: mock-data demo stack, 1440x900. Date 2026-10-23.
The first-run journeys used fresh invented sign-ups (walker-j1-N@northwind.example.test, random passwords, not recorded).
The Monday inbox and runway journeys used the seeded mock founder. Screenshots are kept outside the repo (file names are cited below).
The demo server has a default model and needs no integration setup, so the model step and the "Connect your apps" step never appear.

## Story verdicts

| Story | Verdict | Steps actual / ideal | Notes |
|---|---|---|---|
| STORY-APP-001 sign-up to first useful chat | PASS | 6 / 5 | Landing, 3 fields + Create, focus card A, Connect Gmail (one click, emulated), question, plus one consent card ("Share your chats and mail with the AI model...") before the first answer. Reply was correct and fast (6 s). |
| STORY-APP-209 first day to "when do we run out?" | PASS (partial) | n/a | Walked steps 1-5, 9, 10, 12 and 15 (Gmail connect, sort, runway answer). Mercury connect and Carta skipped: the seeded founder already has them. Chief and the Finance page agreed (24.2 months, Oct 27, 2028). |
| STORY-APP-309 model sign-in first run | BLOCKED | n/a | Demo has a default model, so no "Connect a model" step; the real sign-in needs a provider account. |
| STORY-APP-319 model to connected app, tour, first question | FAIL | 14 / 12 | The apps step is BLOCKED (not shown on this server). Tour (9 stops) and first question pass. FAIL because the first Inbox after connecting mail shows a blank page for about 24 s (J1-01). |
| STORY-APP-211 board prep | PASS (partial) | 11 walked | Walked: Inbox mail from the investor, Finance, Runway, Finance agent answer ("Tell the board: ..."), Legal, Investors, Hide amounts and Show. Not walked: Data room search, Forward to counsel, Carta agent, reply send (shared state). |
| STORY-INB-022 first morning, empty to clear Inbox | FAIL | 6 walked | Connect, Allow, sorting reached. Blocked by J1-01 (blank list for 24 s). Reply, archive, file-to-Data-room steps not walked (they change shared mail). |
| STORY-INB-109 Monday inbox reset | PASS (partial) | 9 walked | Piles, Needs reply, message dialog, Newsletters groups, Digest, Cleanup, Filter > Unread and Clear walked. BLOCKED on the seed: no Spam tab, Cleanup is empty ("Nothing to clear" line shown), so spam, archive-all, skip-inbox and unsubscribe steps cannot be walked. I did not run "Archive all" in Digest so the shared seed stays intact. |
| STORY-INB-040, STORY-APP-144 phone journeys | SKIPPED | n/a | Brief fixes 1440x900. |
| STORY-APP-146 server owner setup, STORY-APP-210/212/213/214 | SKIPPED | n/a | Outside the three assigned journeys; 146 needs a fresh install. |

## Owner decisions confirmed on screen
- Dismissing the first-question card offers the tour (32-after-dismiss.png), and Skip tour leaves the one-tap chip "What should I do first this week?" in Chief's composer (33-skip.png).
- Cleanup explains in one line why it is empty (15-cleanup.png).
- Hide amounts hides money only; Runway months stay; the Finance header shows "Amounts hidden - Show", and the sidebar preview of Chief also hides the figure (27-hidden.png).
- Needs reply shows five rows with "Show 16 more" (11-inbox.png). To do collapses to one line.
- User chats ask for AI consent before the first model call (06-firstq.png). The Inbox consent card appears before any sorting.
- Tour has nine stops, each card names its item and keeps a fixed spot (tour-grid.png).

## Excellent
- Finance: Cash, burn, runway and the Runway page agree to the digit; the run-out date is shown and "Count crypto" is explained in one line (20-finance.png, 21-runway.png).
- The Finance agent's reply to "what should I tell the board" gives a sentence Maya can read out and matches the page (23-answer.png).
- The open-mail dialog is compact: Reply, Archive, Ask agent, "..." (12-open.png).
- Empty states for a new account (No mail connected / No accounts yet) each have one clear action (34-empty-inbox.png, 35c.png).
- Connecting Gmail from the empty Inbox returns to the Inbox by itself after Done (37-after-connect.png).
- No console errors in any step; page overflow measured 0 on the Chief screen (geometry audit, the "overflow spills" it reported are the hover action bars of chat bubbles, not defects).

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| J1-01 | Inbox first load after Connect mail; STORY-INB-022 step 2, STORY-APP-319 step 13 | P1 | flow | OBSERVED, reproduced twice. After "Gmail connected" and Done, the Inbox shows only the "Let Praci sort your mail" card and an empty page below it. Nothing says mail is loading. The list appeared about 24 s later (polled each second: rows 0 until t=24 s). At about 19 s a "Try again" button shows, still with no explanation. A first-time user reads this as "my mail did not load" and may click Not now or leave. Expected: a visible "Loading your mail" cue beside the consent card. | 37-after-connect.png (3 s), 38-inbox-wait.png (10 s), 42-t7.png, 43-t18.png | apps/web/src/pages/Inbox.tsx:1763 (skeleton `hidden` while the consent card shows, comment says "blank bars look stalled"); LOAD_STUCK_MS at :840 | Show one quiet "Loading your mail..." line (spinner) under the consent card while the first list loads, instead of hiding all loading feedback. |
| J1-02 | App shell cold load (direct URL after sign-up) | P2 | perf | OBSERVED intermittently. A full-page skeleton (sidebar and page) stayed for about 8 s on /app/finance and 12 s or more on /app/inbox for brand-new accounts; the same load took 1 s on retry. The server was shared with other walkers, so contention is a likely cause (SUSPECTED, not measured on an idle stack). | 35-empty-fin.png, 35b-empty-fin.png, 41-t18.png | not traced (bootstrap and bots/list RPCs all returned 200) | Re-measure on an idle stack; if it holds, show the sidebar from cached or minimal data first. |
| J1-03 | Tour start; STORY-APP-317/319 | P3 | flow | OBSERVED. The tour opens by itself, not at a clear moment: for the first user it appeared a few seconds after she clicked Connect Gmail in chat (05-gmail.png); for a user who never used the chat card it opened over the Inbox while she read it (46-sorted2.png). The catalog expects the tour on landing. Skip tour is one click, so the cost is small. | 05-gmail.png, 46-sorted2.png | tour trigger in apps/web/src/pages/Shell.tsx (not located) | Start the tour only when the first-question card is answered or dismissed, as decided in pass 11, and not on later pages. |
| J1-04 | Tour popover | P3 | visual | OBSERVED. Each popover has a fixed height, so a short line such as "Search: Find any page, chat or email." leaves about 60 px of empty space above Skip tour / Next, and the card sits about 600 px below the Search box it explains. The fixed spot is an owner decision; only the empty gap is a defect. | tour-grid.png, 05-gmail.png | tour popover component (not located) | Size the card to its text and keep its anchor corner. |
| J1-05 | Inbox, Filter > Unread | P3 | flow | OBSERVED. "14 results - Unread" but the sidebar badge reads 13 unread. One of the 14 rows is an archived message (badge "Archived"). The badge explains the row, but the two numbers disagree. | 18-unread.png vs the sidebar badge | apps/web/src/pages/Inbox.tsx (filter query includes archived) | Leave archived mail out of the Unread filter, or say "14 results, 1 archived". |
| J1-06 | Newsletters Digest; STORY-INB-109 step 8 | P3 | copy | OBSERVED. The catalog says Maya "reads three summaries"; each Digest card shows the sender, the subject and the first line, not a summary. The cards work, and "Archive all 8 messages from 5 senders" is clear. This may be a catalog wording issue rather than a product defect. | 14-digest.png | n/a | Reword the catalog step, or generate a one-line summary per card if summaries are intended. |

## Counts
Stories: 7 walked (3 PASS partial or full, 2 FAIL, 1 BLOCKED, plus 1 PASS partial for APP-209), 3 groups SKIPPED.
Findings: 6 (P0 0, P1 1, P2 1, P3 4). Bugs 0, flow 3, copy 1, visual 1, perf 1.
Not verified: real Gmail first-sync time (the 24 s is the demo emulator), phone width, desktop app, model sign-in.
