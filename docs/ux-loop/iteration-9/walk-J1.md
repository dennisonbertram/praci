# Walk J1: long journeys (first run, Monday inbox, runway before a board meeting)

Session uxl9-J1, demo stack web :5381, 1440x900. Fresh invented user (walker-j1-N@northwind.example.test) for the first-run paths; mock-founder for seeded board-prep pages. Screenshots: /tmp/uxloop9/J1/. Console: only vite debug lines, no errors.

## Story verdicts

| Story | Verdict | Steps actual / ideal | Notes |
|---|---|---|---|
| STORY-APP-001 sign-up to first useful chat | PASS | 7 / 5 (Sign up, form, Create, pick A, Connect Gmail, Skip tour, ask) | Landed in Chief in about 3 s. No model step and no "Connect your apps" step on the demo (server already has a model). |
| STORY-APP-209 first day to "when do we run out?" | PASS with friction | 11 / 14 | Mercury connected in one click, Finance showed 24.6 mo. Chief's first answer ("can't see your cash") stayed in the thread; re-asking took about 70 s via the Finance agent and matched the page (Nov 10, 2028). |
| STORY-APP-309 sign-up to first answer with a subscription model | BLOCKED | 0 | Needs a server with no default model and ChatGPT/OpenRouter sign-in (real provider). Model step never appears on this demo. |
| STORY-APP-319 model sign-in to connected app, tour, first question | PASS (partial) | 9 / 12 walked | Model step and "Connect your apps" step absent (BLOCKED: server config). Tour (9 stops), Gmail connect from Chief card, first question walked. Tour waits until the focus card is answered and Gmail card resolved: sensible. |
| STORY-APP-211 board prep | PASS (partial) | 8 of 14 steps | Walked Finance Runway, Hide amounts, Chief, Legal Deadlines, Investors, Data room. Skipped reply-all, Carta agent prompt, forward, new-mail notice. |
| STORY-APP-024 Monday across the app | SKIPPED | n/a | Overlaps INB-022/APP-211; time. |
| STORY-INB-022 first morning, empty to clear Inbox | PASS with friction | 12 / 18 | Connect from Chief card (not Inbox), Allow, sort (needed retry), open, reply, send. Archive, filing, keyboard help not walked. |
| STORY-INB-109 Monday reset (piles, Digest, Cleanup, Spam) | PARTIAL / BLOCKED | 6 / 24 | Updates, Newsletters, Digest, Cleanup walked. Spam tab absent (no spam in this mailbox) so steps 3-6 BLOCKED; no unsubscribe flow in Cleanup (single sender). |

## Praise (observed)
- Welcome and sign-up are short; one form, straight into Chief with a focus question (s01-s05).
- Connecting Gmail from the card in chat is one click and starts the tour; Mercury from Finance "Add account" is one click and shows a full dashboard (s07, s12).
- Cash, burn, runway, run-out agree across Chief, Finance and Runway page (24.6 mo, Nov 10, 2028).
- Hide amounts masks cards, chart axis labels and the money inside Chief's chat text, and leaves runway months and dates (s35, s36).
- Inbox first-load copy "First sync can take a minute" sets expectation; reply dialog and sent thread update work (s17, s27).
- Legal Deadlines and Contracts tables are clear (s41, s42).

## Findings

| id | page/story | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| J1-01 | INB-022 step 3 | P2 | flow | Observed: after Allow on a fresh mailbox the sort ran about 45 s, then showed "Sorting is taking longer than usual", and only "Try sorting again" produced the piles and To do (about 2 min total). Expected sorting to finish on the first attempt. May be demo model latency; one sample. | s19-s22 | apps/web/src/pages/Inbox.tsx:1520 | Retry stalled sorts automatically once before showing the notice. |
| J1-02 | APP-001, all pages | P2 | copy | Observed: lone-space user sees the sidebar heading "PERSONAL" and a "Personal" chip on Finance and Legal, but not on Investors, Data room or Contacts. Pass-8 decision says Personal stays hidden until a second space or member exists. | s05, s11, s37 | apps/web/src/pages/Shell.tsx:1923 (soleSpaceTitle "Personal"), pages/shell/space-sidebar.ts:84 | Hide the heading and page chip when there is one space; if intended, show the chip on every page. |
| J1-03 | APP-211 step 11-14 | P2 | flow | Observed: Hide amounts is stored in browser localStorage. After sign-out and sign-in as another user every figure was "$•••" with no explanation or visible indicator that amounts were hidden. Expected a visible state and a per-user setting. | s35, s40 | apps/web/src/lib/hide-amounts-preference.ts:11 | Key the preference by user and show a small "Amounts hidden" control in the page chrome. |
| J1-04 | APP-209 step 7, Legal first visit | P2 | flow | Observed: before Allow, Legal is an empty page with a single consent card and no hint of what Legal will show (contracts, deadlines). Expected a one-line preview of the result. | s37 (Legal tile) | apps/web/src/pages/Legal.tsx | Show the empty Contracts/Deadlines tabs under the consent card. |
| J1-05 | INB-109 step 10 | P2 | flow | Observed: Cleanup listed only "Riley Testwell" (bookkeeper, "6 emails, 83% read"), a real contact in important threads, with no reason shown; the five newsletter senders were absent. Expected senders worth cleaning up, with a reason. Cause unknown (seed data vs heuristic). | s32 | Cleanup sender query (suspected, not traced) | Show why a sender is suggested and exclude senders in the Important pile. |
| J1-06 | APP-209 step 12 | P3 | flow | Observed: Chief's earlier answer "I can't see your cash balance" stays after Mercury is connected; Maya must re-ask. Reply then took about 70 s through "Messaged Finance agent". Expected a nudge or auto-refresh. | s09, s14, s15 | n/a | After a bank connects, have Chief post a one-line "Mercury connected" note with the runway. |
| J1-07 | Legal after Allow | P3 | copy | Observed: header says "Not scanned yet" while the button says "Scanning..." and the body says "Reading your Data room..." (empty room). Contradictory for about 20 s. | s38 | apps/web/src/pages/Legal.tsx:240,332 | Drop "Not scanned yet" while a scan is running. |
| J1-08 | INB-022 step 3 | P3 | flow | Observed: pile tabs Important/Updates/Newsletters show with "Important" selected before sorting is allowed, and the Important tab lists all mail (invoice, newsletters). | s18 | apps/web/src/pages/Inbox.tsx | Hide the tabs until sorting is allowed. |
| J1-09 | APP-319 step 11 | P3 | copy | Observed: tour step 8 "Connect Gmail, Calendar and more in Integrations..." after Gmail was already connected. Popovers also cover chat text on steps 4-7. | tour-montage.png | apps/web/src/components/tour/FirstRunTour.tsx:68 | Say "Connect more apps" when one is connected. |
| J1-10 | APP-209 step 14 | P3 | visual | Observed: Runway chart ends at Sep 2028 at about $100k while Run-out says Nov 10, 2028; the line never reaches $0. | s33 | Runway chart range (not traced) | Extend the axis to the run-out date. |
| J1-11 | Sidebar | P3 | visual | Observed: each page visit adds a page agent (Inbox, Finance, Investors, Legal); four 56 px rows make the sidebar scroll and clip the "PERSONAL" heading at 900 px high. | s38 | apps/web/src/pages/Shell.tsx (Page agents folder) | Collapse Page agents by default. |
| J1-12 | Chief thread | P3 | copy | Observed: a run step is labelled "Task catalog 5.8s", an internal term. | s08 | tool-step label (not traced) | Label as "Looking up agents" or hide. |
| J1-13 | INB-022 step 7 | P3 | perf | Observed: after Send, Undo vanished at about 6 s but "Sending..." stayed about 10 s more with no Sent confirmation, only the new row in the thread. | s25-s27 | Inbox send toast | Show "Sent" when done. |
| J1-14 | Inbox header | P3 | visual | Measured with geometry-audit: toolbar icon buttons widths [36, 36, 28, Ask 69]; the compose button is narrower than its siblings. | geometry output | apps/web/src/pages/Inbox.tsx header | Give the compose icon the same 36 px box. |
| J1-15 | Legal Deadlines | P3 | copy | Observed: every row repeats "Ask agent / Done / Dismiss"; the difference between Done and Dismiss is unexplained. | s42 | apps/web/src/pages/Legal.tsx | Tooltip or fold Dismiss into a row menu. |

Counts: P0 0, P1 0, P2 5, P3 10.
