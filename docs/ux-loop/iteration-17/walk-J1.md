# Walk J1: long journeys (first run, Monday inbox, runway check)

Target: mock-data demo stack (web :5381), 1440x900. Sessions: uxl17-J1 (fresh invented sign-up, walker-j1-<n>@northwind.example.test) and uxl17-J1-founder (seeded mock founder). Screenshots: /tmp/uxloop17/J1/.
Not walked: phone width, Cleanup/Digest bulk actions (they change shared demo state), Spam tab (hidden, no spam on the seed).

## Story verdicts

- STORY-APP-001 (sign up to first chat): PASS, 6 actual / 5 ideal (Sign up, form, Create account, pick A, Connect Gmail, question). Form goes straight to Chief with no intermediate loading screens. One extra click: the AI consent card after the first question (owner decision).
- STORY-APP-319 (model, Connect your apps, tour, first question): PARTIAL. The model step and the "Connect your apps" onboarding page do not occur on the demo (server already has a model, no provider setup). BLOCKED for those two steps. The tour and first question were walked: tour starts after Gmail connects, nine stops, Done, then question, Allow, reply in about 10 s. 22 clicks with the tour (9 Next/Done), 13 if skipped, vs ideal 12.
- STORY-APP-002 (focus card): PASS. Card collapses to the choice with a check, Chief posts connect cards. Catalog text is stale (five choices; now three: Run my company, Day-to-day work, Research & writing).
- STORY-INB-109 (Monday inbox reset): PARTIAL. Walked Important pile, To do card, Show more, open email, reply, Newsletters, Digest, Cleanup. Not walked: Spam, Archive all, unsubscribe. Verdict FAIL on step 10 (Cleanup empty while newsletters exist).
- STORY-INB-022 (first morning, reply to two): PARTIAL PASS. Reply flow works: Reply, type, Send, "Sending... Undo", "Sent" in the thread after about 10 s. Replied thread stays in Needs reply (new mock reply arrives).
- Runway before the board meeting (STORY-FIN-001/006 path, from the Priya email "check runway before Friday"): PASS, 5 steps (Inbox, open email, Finance, Runway card, Ask). Runway 24.2 mo = $1,633,221 / $67,621, consistent on both pages, run-out date shown, crypto toggle explained. Finance agent returned a hiring scenario (16.2 mo, about 8 months less) in about 55 s with visible progress.

## Findings

| id | sev | cat | what happened vs expected | evidence | suspected location | fix |
|---|---|---|---|---|---|---|
| J1-01 | P2 | flow | Finance header says "Mercury, Brex - synced just now" and Cash "5 bank accounts"; a non-USD account is left out of Cash and runway, but the note ("1 non-USD not counted") is screen-reader-only and in a hover tooltip. A founder quoting runway to a board does not see that cash is understated. Observed (DOM check). | /tmp/uxloop17/J1/f12-finance.png | apps/web/src/pages/Finance.tsx:442-446 (compare FinanceSpend.tsx:193, which shows it visibly) | Show "1 account not counted" as visible text next to the sync status or under Cash. |
| J1-02 | P2 | flow | Cleanup says "Nothing to clean up" while Newsletters lists 5 senders and Digest offers "Archive all 8 messages from 5 senders". Maya cannot tell why. Observed; cause (contacts or threshold rule) suspected. | f22-cleanup.png, f21-digest.png | Cleanup page/server sender query | Say why (for example "senders need 3+ messages") or include newsletter senders. |
| J1-03 | P3 | visual | Clicking "Show 14 more" in Needs reply shrinks the To do card from 2 rows + "2 more" to 1 row, because tasks whose mail is now listed move into row chips. Surprising and hard to trace; on hover the row chip is replaced by action icons. Observed (reproduced twice). | f02-inbox.png vs f03-showmore.png | apps/web/src/components/inbox/TodoCard.tsx, InboxRow.tsx:163 | Keep the card stable, or animate the hand-off; keep the chip visible on hover. |
| J1-04 | P3 | flow | Tour starts as soon as Gmail connects while the Calendar card is still unconnected; the popover appears bottom-left, far from the card she just used. Matches code comment (starts once one app is connected). Observed. | 05-connect-gmail.png | apps/web/src/pages/Shell.tsx:2791 | Wait until both cards are answered or a short delay, or leave as designed. |
| J1-05 | P3 | copy | Digest cards show subject plus snippet, not a summary, so "newsletters as a one-minute read" is only partly true on the demo (model summaries may differ with a real model). Suspected. | f21-digest.png | Digest card component | Verify with a real model; label as "Preview" if no summary. |
| J1-06 | P3 | flow | Important pile lists about 35 rows including $420 and $1,850 invoices, conference slots and a legal notice under Earlier; Needs reply has 19 rows (9 unread). Monday triage is long. Mock-data sorting without OpenRouter, so suspected demo artefact. | f05-scrolled.png | triage rules | None needed unless it reproduces on real mail. |
| J1-07 | P3 | flow | Catalog stories APP-001/002/319 describe steps that no longer exist (model step, Connect your apps page, five focus choices). | catalog.md:7140, 10907 | docs/ux-paths/catalog.md | Update the stories. |

## Praise

- Sign-up to a useful Chief thread with three fields and no filler screens; Gmail connect on the card flips to Connected immediately.
- Tour cards keep one spot, name the item they explain, ring the sidebar row; 9 stops, Skip always visible.
- Runway page: run-out date, cash split (bank, stablecoins, other crypto, in runway), clear "Count crypto" toggle.
- Email dialog: Reply, Archive, Ask agent in one row; undo toast on send; sent message appears in the thread.
- Geometry audit on Chief and Inbox: no page overflow, no wrapped controls (the only spill hits are the hover toolbar).
- Console clean (no errors) on all walked screens.

Counts: P0 0, P1 0, P2 2, P3 5.
