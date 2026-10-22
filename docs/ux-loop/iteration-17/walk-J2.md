# Walk J2 (uxl17-J2): long raising and operating journeys

Target: demo stack web :5381, 1440x900, Maya Chen (Mock). Screenshots: /tmp/uxloop17/J2/. Console: no errors on any page walked (only vite/React DevTools debug lines).
Walked as adapted journeys (the demo cannot upload a 1.2 GB zip or run real Carta sign-in).

## Story verdicts

- STORY-DRM-109 / DRM-018 (data room prep for a seed round, adapted: allow, upload SAFE + note, Auto-sort, ask the agent): PASS with findings. Steps actual 9 / ideal 14 (zip, video and password-zip steps BLOCKED: no large files on demo).
- STORY-DRM-121 (quarter-end clean-up): SKIPPED (needs Gmail import and Box).
- STORY-CAP-106 (Carta connect and first donut): BLOCKED (real Carta sign-in). The already-connected Investors page was walked instead.
- STORY-CAP-015/017 (cap table after a SAFE): FAIL on first view (J2-03), PASS after a Finance visit. Steps 6 / ideal 4.
- STORY-LEG-007 (Monday legal check: see dates, Ask agent, mark done, undo): PASS. Steps 4 / ideal 3 (Deadlines is a second click; the page opens on Contracts).
- STORY-APP-385/386 (turn on Allow changes, ask for payment, approve): PASS, excellent. Steps 6 / ideal 5. Deny branch not exercised (one fresh thread, one payment).
- STORY-APP-162/169/174 (new bot, skill, routine, test run): PASS with findings. Steps 14 / ideal about 10.

## What is excellent

- Payment card (J2 step 45-48): one plain sentence "Send $1,200.00 to Acme Servo Supply (Mock) from MOCK Checking ..1111?", the amount on the primary button, Deny beside it, Details collapsed, then "Approved here. Waiting for Mercury" and a follow-up telling her to finish in Mercury. The Allow-changes dialog now says "move money".
- Legal Deadlines: one click Ask agent sends a prefilled question; Done gives an Undo line and the sidebar badge clears at once.
- Data room: uploads auto-file and tag themselves; Auto-sort has Undo ("Sorted 33 items"); agents say honestly when a file is still indexing.
- Routine editor: "Next run Sun, Nov 1, 9:00 AM" and Run history make the schedule verifiable; Test run works in 8 s.
- New bot name field is focused and selected, with a "Saved" confirmation.

## Findings

| id | sev | cat | summary | suspected file |
|---|---|---|---|---|
| J2-01 | P2 | flow | Auto-sort pre-checks all 33 moves (including files already in sensible folders) behind one "Apply 33 changes"; a first-time user cannot review that many. Observed (08-autosort2.png). Fix: default-check only unfiled items, list the rest as optional. | apps/web/src/components/data-room (Sort files dialog) |
| J2-02 | P2 | flow | Auto-sort created a second folder named "Cap table" (Fundraising / Cap table and Investors / Cap table), plus an overlapping top-level Investors and Fundraising. Observed (09-applied.png, 80-dr-final.png). Fix: reuse an existing same-named folder or disambiguate in the proposal. | data room sort proposal (server) |
| J2-03 | P2 | bug | Investors on first visit showed Equity raised "-" and no SAFE list, even though SAFEs exist (Mercury); after visiting Finance (and the sidebar), the same page showed Equity raised $250,000, "$50,000 committed" and a "SAFEs, if converted at cap" block. Observed (20-investors.png vs 70-cartamenu.png, 71-inv-bottom.png). Suspected: the Mercury SAFE sync runs only from the Fundraising overview call, not when Investors loads. Fix: trigger the same throttled sync from the Investors read. | apps/api/src/fundraising.ts (syncQuietly in fundraisingOverview) |
| J2-04 | P2 | flow | One file ("MOCK Board Minutes - October.pdf") sat in "Reading text 1" for roughly 10 minutes, then the strip vanished and the file stayed "Not tagged" with no reason or retry. During that time the Data room and Legal agents hedged ("one file is still indexing, so I couldn't confirm"). Observed (12-strip.png, 33-legalanswer.png, 80-dr-final.png). Fix: time out a read, mark the file failed with Try again, and do not let one pending file qualify every answer. | data room processing worker |
| J2-05 | P2 | flow | A pending money approval leaves no trace once she leaves the chat: no toast on Finance (nothing matched "approval" in page text), and the "Needs your answer" row sits inside the collapsed "Page agents" group. Observed (47-finance.png). Suspected: dismissApprovalToasts on chat open removes the pending entry and nothing re-raises it. Fix: when leaving a chat with an unanswered approval, re-enqueue its toast, or badge the Page agents group. | apps/web/src/lib/approval-toasts.ts (markApprovalChatOpen / dismissApprovalToasts) |
| J2-06 | P2 | flow | The Mercury agent chat is reachable only through a "Mercury agent" link inside the "Used by" list on the integration page, which is long (13 switches) and reads as a bot-access list. No "Open Mercury agent" button next to the Allow-changes switch. Observed (43-allowed.png). Fix: add an "Ask Mercury agent" button in the Agent card. | apps/web integration detail page (Agent section) |
| J2-07 | P2 | flow | Routine run for "Month-end investor update" (instruction "draft the update ... save it to my drafts", skill attached) returned only a figures summary relayed from the Finance agent; no draft was produced or saved. Observed (62-testrun.png). Possibly a demo-model limit; unverified with a real model. Fix: confirm the routine's skill instructions reach the run. | routine runner / skill injection |
| J2-08 | P3 | copy | Routine schedule "Every month at 9:00 AM" does not say which day; only the "Next run Sun, Nov 1" line reveals it is the 1st, while the journey is a month-END update. Observed (60-month.png, 61-routinesaved.png). Fix: show "on the 1st" in the picker label. | routine schedule picker |
| J2-09 | P3 | visual | The header button named "Routines" uses a monitor icon (looks like "computer"), and its panel opens with an empty region above a bare "Update Writer's computer" label. Observed (55-routines.png). Fix: use a clock/repeat icon and hide the computer section when empty. | bot header toolbar, routines panel |
| J2-10 | P3 | copy | Finance says spending is "up 1% vs Sep 1-22" while the routine answer says "up 0.5%" for the same figures ($20,484 vs $20,380). Observed (47-finance.png, 62-testrun.png). Fix: use one rounding rule. | finance formatting vs agent prompt |
| J2-11 | P3 | flow | The signed SAFE Maya files in the Data room is not reachable from the Acme contact or the Investors page; Acme's row has only "-" (Mercury is the only SAFE record, by decision), so there is no path from document to investor. Observed (23-dana.png). Not a bug under the Pass-12/16 decisions; noted for the story's step count. | n/a |
| J2-12 | P3 | visual | After Done on a deadline the Undo line occupies a full-height empty row (about 88 px) with the plain "Undo" word, leaving a gap in the list. Observed (34-done.png). Fix: collapse the row to a compact inline notice. | apps/web LegalDeadlines |
| J2-13 | P3 | flow | The legal Contracts tab shows the insurance term ending Dec 2, 2026 while its deadline note says "renews on December 1". Likely seed data. Observed (30-legal.png, 31-deadlines.png). | demo seed |

Counts: P0 0, P1 0, P2 7, P3 6. Geometry audit run on Data room and Legal; only table-cell false positives and short sidebar rows, no overflow (pageOverflowX 0).
