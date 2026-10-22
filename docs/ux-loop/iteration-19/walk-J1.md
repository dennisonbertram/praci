# Walk J1: long journeys (first run, Monday inbox, runway before a board meeting)

Session uxl19-J1 (and uxl19-J1b for one tour re-check). Target: mock-data demo stack, web 5381, 1440x900, plus one 390x844 spot check.
Account: fresh sign-up (invented walker user at northwind.example.test) rather than the seeded founder, because the first-run path only exists for a new user. The password was never printed or stored.
Screenshots: /tmp/uxloop19/J1/ (01 to 33). Console: no errors on any screen walked (only the React DevTools info line).

## Story verdicts

| Story | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| STORY-APP-309 model sign-in with a false start | BLOCKED | n/a | Demo already has a default model (GPT-6 Luna). A new sign-up goes straight to Chief; there is no "Connect a model" step. Provider sign-in is a real third-party step anyway. Settings > Models shows "Your bots use OpenAI: GPT-6 Luna" with "Use my own model" (observed). |
| STORY-APP-319 first day: model, Connect your apps, tour, first question | PARTIAL / PASS for what exists | about 24 / 12 | New user is a non-owner here, so there is no "Connect your apps" onboarding page (STORY-APP-316 path). Landing: Chief greeting plus "What should I work on first?" card. Walked: pick A, Connect Gmail (one click, connected in under 3 s), 9-stop tour (Search, Create, Inbox, Finance, Legal, Data room, Chief, Integrations, Account), ask Chief, consent card, answer. Tour clicks (9) are most of the count; the nine stops are an owner decision. |
| STORY-APP-209 first day to "when do we run out?" | PASS | about 17 / 14 | Chief's first answer (no bank yet) links straight to Finance ("Open Finance"), Finance shows "No accounts yet / Add account", Mercury connects in one click and the dashboard shows in under 4 s. Asking Chief again delegates to the Finance agent and returns the same figures (24.6 months, Nov 10, 2028). Dead-end recovery is good. |
| Runway check before a board meeting (STORY-APP-211, finance part) | PARTIAL | n/a | Finance, Runway page, Finance agent chips ("What is our runway?"), Hide amounts (money hidden, runway months and date kept, "Amounts hidden - Show" in the header) all work and agree with each other. Cap table, Legal deadline, Data room and board-minutes steps not walkable: a fresh user has no Carta, contracts or files (Investors and Legal show clear empty states). Investors owned by another session. |
| STORY-INB-022 first morning | PARTIAL / PASS | about 12 / 18 | Gmail was connected from Chief's card rather than the Inbox empty state. First sync took roughly 60 s (skeleton plus "First sync can take a minute"). Sorting ran without a second consent because the chat consent already covered it. Reply to Priya: Reply, type, Send, "Sending... Undo", then "Sent" inside the thread; the row left "Needs reply" (14 to 13 in the sidebar) and moved to "Other mail today", which settles the UNVERIFIED note in step 13. Not walked: suspicious-sender archive, attachment filing, keyboard shortcuts. |
| STORY-INB-109 Monday inbox reset | PARTIAL | n/a | Demo mailbox has no Spam tab (nothing in spam), one Cleanup sender and 5 newsletter groups. Walked: Needs reply (5 rows plus "Show 17 more"), Newsletters, Digest (8 messages from 5 senders, "Archive all"), Cleanup open and Back (returns to the Digest view, state kept). No destructive actions run. Spam, unsubscribe, History steps not walkable on this data. |
| STORY-APP-144, 145, 146, 172, 025, 210, 212, 213, 214, 024; STORY-INB-023, 024, 040, 118 | SKIPPED | n/a | Outside the three journeys assigned; 213 and INB-040 need a phone-only walk (only a spot check at 390 px was done: Inbox fits, no horizontal scroll). |

## Praise (observed)

- Chief's "no bank account yet" answer ends with an Open Finance link, and the Finance empty state then names the next step. Cash, burn, runway and run-out date match across Finance, the Runway page, the Finance agent card and Chief's reply.
- Typing in the sidebar Search opens Cmd+K and keeps the typed text.
- Reply flow: Sending with Undo, then Sent in the thread, then the row leaves Needs reply with the count updated.
- Hide amounts keeps runway months and date visible and shows "Amounts hidden - Show".
- Tour card keeps one fixed spot, names the item it explains, and ends with a clear "Done".

## Findings

| id | story / page | sev | category | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| J1-01 | STORY-INB-022, Inbox after connecting Gmail | P3 | perf | Observed: after the first Inbox open, grey skeleton rows plus "First sync can take a minute" stayed for roughly 60 s (still skeleton at about 25 s); a reload later loaded in 4 s. The copy sets expectations, but there is no progress and no other content. The sidebar Inbox row shows no count until it finishes. Likely the emulator's first sync, so real Gmail timing is UNVERIFIED. | 19-inbox.png (skeleton), 23-list-after.png (loaded) | apps/web/src/pages/Inbox.tsx (first sync state) | Show a count or a "Fetching your latest mail" line that updates as messages arrive instead of an unchanging skeleton. |
| J1-02 | STORY-APP-319, tour start | P3 | flow | Observed twice (two fresh accounts): the tour did not appear after landing, nor after choosing "Run my company" (waited 30 s+); it opened over the sidebar about 3 s after clicking Connect on Gmail. This follows the code ("starts once one is connected or another page is open"), but a person who picks A and then reads the Gmail and Calendar cards never sees it until they connect or leave Chief, and it appears abruptly after an unrelated click. | 04-run-company.png (no tour), 05-connect-gmail.png and 33-b-tour.png (tour appears after Connect) | apps/web/src/pages/Shell.tsx:2794-2803 (connectCardsWaiting) | Offer the tour when the focus card is answered, as it already is when the card is dismissed, so the start is tied to an action she just took on the card. |
| J1-03 | Runway page (STORY-APP-211) | P3 | copy | Observed: Finance cards say "3-mo avg, after revenue" under Monthly burn and "Until November 2028" under Runway; the Runway page shows the same numbers with no basis caption, so someone preparing for a board meeting cannot tell from that page how burn was computed. Chief's answer states "average monthly spending ... (July-September 2026)". | 11-mercury.png vs 12-runway.png | apps/web Finance runway page component (cards without sublabels) | Reuse the Finance card sublabels on the Runway cards, or add one line "Based on the last 3 months' average burn". |
| J1-04 | Inbox header, Cleanup | P3 | visual | Observed: the Cleanup entry is an icon-only button with a checklist glyph that looks like a to-do control (the To do card sits right below). The name "Cleanup" exists only as the accessible name and tooltip (tooltip not checked). SUSPECTED: a first-time user will not find it. | 19-inbox.png (icon at 1229,40) | apps/web/src/pages/Inbox.tsx (header buttons) | Use a broom or list-filter glyph distinct from To do, or show the word on wide screens. |

No P0 or P1 problems found on these journeys. Counts: P0 0, P1 0, P2 0, P3 4.

## Not verified

- Real Gmail first-sync time, real Mercury sign-in, any provider sign-in (model step). Connections on the demo stack complete in one click, so the dialog and popup steps of STORY-APP-312 were not exercised.
- Touch-target sizes (no pointer: coarse emulation run).
- Geometry audit flagged 28 px "spill" on the page header container and two "wrapped" stat tiles on Finance; screenshots show no visible defect (stat tiles are meant to be two lines), so not logged.
