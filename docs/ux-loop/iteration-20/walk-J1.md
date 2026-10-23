# Walk J1: long journeys (first run, Monday inbox, runway before a board meeting)

Session uxl20-J1, demo stack web 5381 / API 3308, 1440x900, 2026-10-22. Screenshots: /tmp/uxloop20/J1/.
First-run used a fresh invented sign-up (Maya Okafor). Inbox and Finance used the seeded mock founder.
Note: the demo stack went down for about 5 minutes mid-walk and came back reseeded (sessions, AI consent and tour state reset). Not a product finding.

## Story verdicts

| Story | Verdict | Steps actual / ideal | Notes |
|---|---|---|---|
| STORY-APP-309 (sign-up to first answer, model step) | BLOCKED (partly) | n/a | Demo server has a default model, so "Connect a model" never appeared (STORY-APP-307 path). Provider sign-in is real OAuth anyway. |
| STORY-APP-319 (first day: model, Connect your apps, tour, first question) | FAIL (minor) | 15 / 12 | "Connect your apps" step did not appear (demo needs no setup); Chief's in-chat Gmail card replaced it. Gmail connected in one click. Tour (9 stops) and "Ask Chief" worked. Extra click for AI consent after the first question. No stuck points. |
| STORY-APP-209 (first day to "when do we run out") | PASS (partial) | n/a | Runway answered by Chief/Finance agent matches the page. Mercury sign-in not walked. |
| STORY-INB-022 / 040 (Monday-morning inbox, desktop) | PASS | 12 / 18 | Allow sorting, To do card, open, reply, Sent, row leaves Needs reply (the old hesitation is fixed), Newsletters, Cleanup one-line reason. Not walked: file attachment to Data room, keyboard `?`, phone width. |
| STORY-APP-211 / 203 (runway before the board meeting) | PASS | 4 / 3 | Finance card to Runway page to Ask agent. Page and agent agree (24.2 mo, Oct 26 2028). Hide amounts, Cap table, Legal parts skipped. |

Actual steps, first run: Sign up(1), form + Create(2), pick "Run my company"(1), Connect Gmail(1), Next x8(8), Ask Chief(1), Allow(1) = 15.

## What is excellent
- Sign-up lands in Chief's chat with no dead ends; Gmail connects in one click from Chief's card; tour starts only after the first question and the Connect cards are resolved (Shell.tsx:2823).
- Runway page: Cash / Monthly burn / Runway / Run-out in four tiles, "3-mo avg, after revenue", crypto toggle. 1,633,221 / 67,621 = 24.2 months, consistent with the dashboard tile and the agent's answer.
- Reply flow: "Sending... Undo", then "Sent" in the thread; the replied thread leaves Needs reply.
- During the outage the composer showed "Not sent. Could not reach the server" and kept the text (observed).
- Cleanup empty state explains why in one line and offers "Open Newsletters".

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|
| J1-01 | Inbox, first sort (INB-022) | P3 | flow | After Allow, the list shows five blank grey bars and "Sorting your mail..." for about 30 s (measured about 25-35 s on the demo model). Maya can read nothing while she waits. Observed. Intentional by design (rows would regroup), so the cost is the wait. | 18-sorting.png, 19-sorted.png | apps/web/src/pages/Inbox.tsx:772 | After about 15 s of the first sort, show the unsorted rows dimmed (as for stalled sorts) so mail is readable. |
| J1-02 | Inbox, Important pile | P2 | flow | "Needs reply" holds 24 threads (5 shown, "Show 19 more") out of about 28 total, including routine mail. A Monday triage list this long is not a triage. Observed on the demo model; cause (model prompt vs demo data) not verified. | 20-sorted2.png, 27-list.png | triage prompt (suspected, not located) | Check the needs-reply classifier on the demo; cap or rank so Needs reply stays short. |
| J1-03 | Finance, Burn chart | P2 | visual | Current partial month ("Oct*") is drawn as a dashed drop from about $75k to about $20k, which reads as burn collapsing; the "* So far" note is tiny at the bottom-left. Observed. | 30-finance.png | apps/web/src/pages/Finance.tsx (chart, not opened) | Draw the partial month as a marker or hatched bar, or drop the connecting line to it. |
| J1-04 | Sidebar, 900 px height | P3 | visual | Second space header "RECONNECT NEEDED" is cut mid-letter at the bottom edge under the fade when Email chats and Page agents rows are present, with "+2 more" below. Observed. | 33-answer.png | apps/web/src/pages/Shell.tsx sidebar scroll area (not opened) | Let the fade end above the header, or collapse the second space by default. |
| J1-05 | Reply dialog | P3 | flow | After sending a reply, the Archive button disappears from the message dialog (Reply / Ask agent / ... remain) and the thread leaves the list. Why is not shown anywhere. Observed; cause not verified. | 26-after.png | apps/web/src/components/inbox/InboxMessageDialog.tsx (suspected) | If a reply marks the thread done, say so in the toast ("Sent. Moved out of Needs reply"). |
| J1-06 | Reply send | P3 | perf | Undo vanishes after about 5 s, then the toast reads plain "Sending..." for another 5-10 s before "Sent" appears. Observed once on the demo. | 25-sent.png | outbox.ts (suspected) | Keep the toast text honest ("Sending...") with no gap, or confirm "Sent" faster. |
| J1-07 | Tour, step 1 | P3 | copy | Step 1 card says "Search finds any page, chat or email." while the highlight is on the Search box at the top and the card sits at the bottom of the sidebar, about 650 px away; later steps name the item ("Finance: ..."). Observed. | 07-connect-gmail.png | apps/web/src/components/tour/FirstRunTour.tsx | Prefix step 1 with "Search:" like the other stops. |
| J1-08 | First run, onboarding | P3 | flow | The 9-stop tour costs 8 Next clicks before the first question (about half of the 15 steps). Observed. | 08-tour-*.png | FirstRunTour.tsx | Consider 5 stops or a visible "Skip tour" that stays on the last stop. |

Not findings: duplicate approval toast "Inbox agent needs approval" came from another walker on the shared account; scripts' geometry hits were hover toolbars and name/time rows (false positives).

## Skipped
Model sign-in and "Connect your apps" screens (not shown on this server), Slack/Calendar connect, phone-width Monday (INB-040), Data room filing (INB-022 step 12), Hide amounts and Legal/Cap table parts of APP-211, Mercury connect (APP-209).
