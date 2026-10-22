# Walk J1 (uxl15-J1): long journeys, first run and daily paths

Target: mock-data demo stack, web 127.0.0.1:5381, 1440x900 (plus one 390x844 check). Walker used a freshly signed-up invented user (walker-j1-*@northwind.example.test, name "Maya Okafor"), so the demo password was never read. Screenshots: /tmp/uxloop15/J1/ (01 to 35). Console: no errors or warnings in the whole walk (only Vite and React DevTools info lines).

## Story verdicts

| Story | Verdict | Steps actual / ideal | Note |
|---|---|---|---|
| STORY-APP-309 (sign-up to first answer, model sign-in) | BLOCKED (partly walked) | 5 / 6 | The demo server already has a default model, so "Connect a model" is skipped; ChatGPT/OpenRouter sign-in is a real third-party step. Sign-up to Chief's chat to first answer was walked and is clean. |
| STORY-APP-319 (model, Connect your apps, tour, first question) | PARTIAL: "Connect your apps" step BLOCKED, rest PASS | 14 / 12 | No "Connect your apps" step appeared (integrations need no setup on the demo). Tour (9 stops) and first question walked. After sign-up Chief shows the focus card, closing it opens the tour. First question hit the AI consent card once ("Allow"), then answered. |
| STORY-APP-209 (first day, sign up to "when do we run out?") | PASS | 15 / 14 | Gmail and Mercury connect instantly in the demo (no popup). Chief's second answer (24.6 mo, Nov 10 2028, $1,622,421) matches Finance and the Runway page exactly. |
| STORY-APP-211 (board prep) | PARTIAL | n/a | Walked Finance, Runway, Investors, Legal, Data room, Hide amounts as a fresh user. Carta/Legal deadlines/Data room content not seeded for a new user, so only empty states were seen (all fine). |
| STORY-INB-022 (first morning, empty to cleared Inbox) | PASS | 14 / 18 | Connect mail, auto return to Inbox, sort, reply, replied thread left "Needs reply" and its to-do vanished. Filing an attachment and keyboard shortcuts not repeated. |
| STORY-INB-040 (Monday catch-up on a phone) | PARTIAL PASS | 3 | Only the Inbox list at 390 wide was checked: no overflow, no wrapped controls, clear. Not walked: replying on the phone. |
| STORY-INB-024 (term-sheet day) | SKIPPED | | Needs forward, file and Data room steps; out of the time budget. |

## What is excellent

- Sign-up to a working Chief chat is 4 clicks with no setup screens on a configured server; Chief's runway answer when nothing is connected ("I can't calculate your runway because no bank account is connected... Open Finance") is a good dead-end-free message.
- The tour is a fixed card at bottom left, names the item it explains and highlights it (checked all nine stops).
- Connect mail returns to the Inbox by itself (`next=` parameter); the first-sync line says "First sync can take a minute".
- Inbox after sorting: To do card, "Needs reply" newest first, five rows plus "Show N more", reasons ("Urgent") on other rows. Replying removes the thread from Needs reply and clears its to-do.
- Hide amounts hides every amount in Finance and shows "Amounts hidden · Show".
- Phone Inbox is clean.

## Findings

| id | story / page | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| J1-01 | APP-319, INB-022 / Inbox first sort | P2 | perf | OBSERVED: after Connect Gmail the first sort took about 90 s on the demo (skeleton about 40 s with "First sync can take a minute", then 40+ s of "Sorting your mail..." with the raw list shown). The "taking longer than usual" line never appeared, and the rows did not look dimmed in the 45 s and 70 s screenshots (hard to judge 60% opacity). Likely a slow scripted model rather than a product defect (SUSPECTED). | 18, 19, 20, 21 png | apps/web/src/pages/Inbox.tsx:311-333, 764, 1712, 1783 | Check that `slowSort` and `stalled` actually trigger after 15 s and about a minute; show an elapsed or progress hint for sorts over 30 s. |
| J1-02 | INB-022 step 7 / reply dialog | P3 | flow | OBSERVED: after Send, "Sending... Undo" shows, then Undo disappears and "Sending..." stays for roughly 6 to 12 s with no "Sent" confirmation toast; the only confirmation is the new "Later in this conversation" row inside the open email. | 26-27, 28 png | apps/web/src/pages/Inbox.tsx (send/undo toast) | Replace the toast with "Sent" when the send completes, or hide it once the Undo window ends. |
| J1-03 | Reply dialog | P3 | copy | OBSERVED: "From" shows "Gmail <mock-founder@northwind.example.test>" (account label, not a name); the email header says "to Maya Chen (Mock)" for a user named Maya Okafor. The second is demo data (not filed). | 25, 24 png | apps/web/src/components/ (compose From line) | Show the account's display name and address instead of the provider label. |
| J1-04 | Finance burn chart | P3 | visual | OBSERVED: the Oct* column is detached from the line: two stacked hollow dots and a standing "Financing, Oct ↑ $250,000" label with a triangle at the top, with no hover. The area chart stops at Sep and leaves a large gap before Oct. Could be intentional ("so far") but reads as a broken point. | 12, 12-zoom png | apps/web/src/pages/Finance* burn chart | Connect the partial month to the line with a dashed segment, or show the Oct value as one dot with a tooltip on hover only. |
| J1-05 | Investors (first run) | note only, not filed (page owned by another session; seen as P2) | visual | OBSERVED: for a new user the cap table and the "SAFEs and funds" list stay as grey skeleton bars forever (calls return `snapshot: null` and `[]` in under a second). The three "Connect Carta / Use a Google Sheet / Type it in" buttons are above, so the user is not stuck, but it looks like endless loading. | 31, 32 png | apps/web/src/pages/Investors.tsx:416, 914-922 | Show a quiet empty line (or nothing) instead of loading bars when no cap table source exists. |
| J1-06 | APP-309/319 | P3 | flow | OBSERVED: no tour stop covers Investors, Fundraising, Contacts or Artifacts (the tour keeps nine stops by owner decision), so a new user is never told what those four rows are. Not raised as a defect, only recorded. | 05-tour-grid png | n/a | none; keep as is. |

No P0 or P1 findings. Counts: P0 0, P1 0, P2 1 (J1-01), P3 4, note 1.

## Not verified

- Model sign-in, "Connect your apps", Skip-tour "Ask Chief" chip (needs a second fresh account), attachment filing, Legal deadlines, Carta data, keyboard shortcuts, phone reply, dimmed-row opacity during the first sort.
- Mock mail arrived from the shared mock-founder mailbox, so the Inbox contents are the seeded demo data.
