# Walk J1 (iteration 12): long journeys, first run and daily paths

Session uxl12-J1, 1440x900, demo stack web :5381. Screenshots in /tmp/uxloop12/J1/.
First-run stories used a fresh invented sign-up (walker-j1-*@northwind.example.test). Daily-path stories used the seeded demo founder (read-only; no mail archived, no approvals answered). Hide amounts was switched on and back off once on that account.

## Story verdicts

| Story | Verdict | Steps actual / ideal | Note |
|---|---|---|---|
| STORY-APP-001 sign-up to first useful chat | PASS | 8 / 5 | Sign up, form, focus card A, Connect Gmail (tour starts), first question. Honest answer with an "Open Finance" link when no bank is connected. Model step and "Connect your apps" step never appear (see BLOCKED). |
| STORY-APP-209 sign-up to "when do we run out?" | PASS | 13 without the tour (22 with 9 Next clicks) / 14 | Open Finance, Add account, Mercury, Runway page, Ask Finance agent, "What is our runway?" Page and agent agree (24.6 mo, Nov 10, 2028). Chief was not re-asked after the bank was connected. |
| STORY-APP-309 / 319 model sign-in then Connect your apps | BLOCKED | n/a | Demo server already has a model and needs no integration setup, so both steps are skipped; ChatGPT/OpenRouter sign-in is a real provider step. Tour and first question were walked inside 001/209. |
| STORY-INB-022 first morning with Inbox | PARTIAL | 6 of 18 | Connect (via Chief card), Allow, Reply and Send to Priya all work. Sorting never finishes on the demo (no model): ~70 s of "Sorting your mail..." then "Sorting is taking longer than usual. Your mail is below." with "Try sorting again" (matches the 15 s dim / 60 s stall design). Sorted features (Needs reply, To do card) seen on the seeded account instead. |
| STORY-INB-109 Monday-morning inbox reset | PARTIAL | 6 / 24 | Walked read-only: Important with To do + Needs reply, Newsletters, Digest, Cleanup. No Spam tab on this seed. Archive, Unsubscribe and Skip-inbox steps not run (shared mailbox). |
| STORY-APP-211 runway check and board prep | PASS (read-only) | 11 / 12 | Finance, Runway (with Count crypto), Investors, Data room (Board Minutes visible), Legal Deadlines, Hide amounts on and off. Inbox reply, talking-points and Done steps skipped. |
| STORY-APP-024 Monday across the app | SKIPPED | n/a | Same pages as 211 and INB-109. |
| STORY-APP-213 / STORY-INB-040 phone | SKIPPED | n/a | Scope was 1440x900. |

## Praise (observed)

- Chief answers "When do we run out of money?" with the real reason (no bank connected) and a one-click "Open Finance" link, not a made-up number.
- Finance empty state ("No accounts yet", one Add account button) then Mercury connect lands on a full dashboard in about 4 s; Runway page gives cash, burn, run-out date and a clear projection line, and its Count crypto breakdown explains why numbers differ from Finance.
- Hide amounts masks money everywhere it appears (cards, chart annotation, Upcoming list, even the Chief sidebar preview) while leaving months of runway; "Amounts hidden - Show" is a clear way back.
- Tour has nine short, plain stops with Back and Skip tour; sign-up form is minimal and clean.
- Sorted Inbox (To do card, Needs reply with one-line summaries) is excellent for a Monday catch-up.

## Findings

| id | story / page | sev | cat | what happened vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|
| J1-01 | APP-001/209, Chief connect cards | P2 | a11y | Observed: the Gmail and Google Calendar cards each have a button named just "Connect" (aria-label null), so a screen reader hears two identical buttons; the app name is only in sibling text. Expected: "Connect Gmail". | 05-focus.png; eval of button aria-labels returned null for both | apps/web/src/pages/shell/message-cards.tsx:259-266 (AppConnectCard) | Add aria-label={t`Connect ${name}`} to the button. |
| J1-02 | INB-109, Inbox Newsletters (first open) | P2 | perf | Observed once: first open of the Newsletters tab showed 5 skeleton rows for about 30 to 35 s before 5 senders appeared; later tab switches were instant. The demo was shared by parallel walkers, so the size of the delay is unconfirmed. Expected: rows in a few seconds or a "Loading newsletters" line. | 42-news.png, 42b-news.png, 43-news-loaded.png (polled skeleton count: 5 until about 30 s) | Inbox pile list fetch, apps/web/src/pages/Inbox.tsx (pile query) | Re-measure on an idle stack; if confirmed, prefetch the Newsletters/Updates piles after the Important list loads. |
| J1-03 | Legal Deadlines | P3 | copy | Observed: notice rows show a raw ISO date in the sentence ("Renews automatically on 2026-12-10.") while the row date reads "Nov 10, 2026". The seeded Insurance row also says "renews on December 1" above "Renews automatically on 2026-12-02" (seed text, but the two lines contradict). Expected: one date format, same as the rest of the page. | 55-deadlines.png | packages/adapters/src/legal-tools.ts:412 (toISOString().slice(0, 10)) | Format the date as "Dec 10, 2026" (same formatter as the due date). |
| J1-04 | Chief after connecting a bank | P3 | flow | Observed: the answer "I can't estimate your runway because no bank account is connected" and its sidebar preview stay as Chief's latest message after Mercury is connected and runway is 24.6 mo; Chief never says the bank is now connected. Expected: Maya returning to Chief sees a current answer or a nudge to re-ask. Suspected (not tried): re-asking gives the right answer. | 10-finance-empty.png, 15-answer.png (Chief row still shows the old preview) | Chief thread / onboarding cards (apps/api/src/onboarding.ts) | After the first bank account connects, have Chief post one line ("Mercury is connected. Runway is X months.") or re-run the pending question. |
| J1-05 | Finance agent answer | P3 | copy | Observed: the reply shows a summary card (Cash, Burn, Runway, Spent) and then a paragraph repeating the same numbers, with unrounded cents ($1,622,420.55) beside the page's $1,622,421. Expected: card or sentence, not both; same rounding as the page. | 15-answer.png | Finance agent response composition (apps/api finance tool card + prose) | Keep the card, shorten the prose to the run-out date and the burn window. |
| J1-06 | First-run tour | P3 | visual | Observed: with no scrim, the tour popover sits over Chief's greeting and the focus card text at stops 3, 5 and 7 (Inbox, Legal, Chief), hiding the start of the sentence. Expected: popover clear of the content, or the content dimmed. | 07-tour3.png, 07-tour5.png, 07-tour7.png (tourA.png, tourB.png) | apps/web/src/components/tour/FirstRunTour.tsx (popover placement) | Offset the popover further right of the sidebar so it does not cover the chat column text. |

## Not findings / environment

- No model on the demo: sorting never completes for a fresh user, so INB-022 steps 4 to 14 cannot be walked there.
- Onboarding model and apps steps are skipped on this server (STORY-APP-309/319 BLOCKED).
- Browser console: only vite and React DevTools info lines; no errors during the walk (one CDP navigate timeout on a page-to-page open, not reproduced).
- Geometry audit (Finance, Inbox, Legal, Investors, Data room): no page overflow; hits were sidebar name/time rows and Legal table names wrapping to two lines, which are intended.
- Cleanup on the seeded account says "Nothing to clean up" and offers "Open Newsletters" (by design, hands off to the Newsletters pile).
- Owner-decided items not reported: Integrations in sidebar and account menu, Mercury approval toast bottom-right, dimmed rows after 15 s of sorting.
