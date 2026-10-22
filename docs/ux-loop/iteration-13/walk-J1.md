# Walk J1 (iteration 13): long journeys, first run and daily paths

Session uxl13-J1, 1440x900, demo stack web :5381. Screenshots in /tmp/uxloop13/J1/ (outside the repo).
First run used a fresh invented sign-up (walker-j1-N@northwind.example.test, generated password). Daily paths used mock-founder (password read from the credentials file into a shell variable, never printed). The mock-founder account was shared with other walkers, so list counts and unread flags changed during the walk and were not reported as bugs.

## Story verdicts

| Story | Verdict | Steps actual / ideal | Notes |
| --- | --- | --- | --- |
| STORY-APP-309 (sign-up, model, first answer) | BLOCKED (partly walked) | 7 with Skip tour, 15 with the full tour / 6 | The demo has a default model and the fresh user is not shown "Connect a model" or "Connect your apps" (STORY-APP-301 to 316 not reachable). Walked sign-up, focus card, connect Gmail, tour, first question, consent. |
| STORY-APP-319 (model, Connect your apps, tour, first question) | BLOCKED (partly walked) | 15 / 12 | Same reason. Tour (9 stops), Gmail connect from Chief's card, first question and consent card walked. |
| STORY-APP-209 (first day to "when do we run out") | PASS with findings | sign-up to Gmail connected 4; runway answer checked on Finance and the Finance agent | Mercury sign-in not repeated (seeded already). Chief's first answer only delegates (J1-03). |
| STORY-INB-109 / INB-022 (Monday-morning inbox) | PASS with findings | open Inbox, read, reply, archive, tabs, Cleanup, Ask agent: 9 | Spam and Digest not walked. |
| STORY-APP-211 (runway check before a board meeting) | PASS (partly walked) | Finance, Runway, Hide amounts, Investors, Ask Finance agent: 8 / 12 | Legal and Data room legs not walked (time). Hide amounts toggled on and restored off. |

## Observed good

- Focus card, connect card ("Connected" appears at once), and the consent card ("Allow" / "Not now", then "Allowed" stamp) read clearly.
- Inbox: "Needs reply" shows five rows with "Show N more"; opening a thread, Reply, Send with "Sending... Undo", then the sent message under "Later in this conversation" all worked; Archive shows an Undo toast.
- Runway is the same number everywhere: Finance card 24.2 mo, Runway page run-out Oct 26 2028, Finance agent answer. Hide amounts masks cards, chart axis and even the Chief preview in the sidebar; "Amounts hidden - Show" shows on Runway.
- No page overflow (geometry pageOverflowX 0) and no console errors on the screens walked.

## Findings

| id | story / page | sev | cat | what happened vs expected | evidence | suspected code | fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| J1-01 | STORY-APP-319 step 8, first run | P2 | flow | Observed. The tour opens as soon as the first Connect (Gmail) is clicked, while the Google Calendar card is still unanswered. Maya is mid-task and gets nine popovers on top of the chat. Expected: let her finish or dismiss the cards, or offer the tour once. | 05-connect-gmail.png | apps/web/src/pages/Shell.tsx:2748 (connectCardsWaiting only blocks until one app is connected) | Hold the tour until the connect cards are all connected or dismissed, or until the first question is sent. |
| J1-02 | First-run tour | P3 | visual | Observed. On desktop the tour card sits at the foot of the sidebar column, 600+ px from the ring for Search, "+" and Inbox. The eye has to jump. This is intended ("Next stays put") but the link between popover and target is weak. | tour-grid.png | apps/web/src/components/tour/TourPopover.tsx:171-186 | For targets in the top half, anchor the card beside the ring (keep Next in place by fixing its position inside the card). |
| J1-03 | STORY-APP-209 step 12, first question | P2 | flow | Observed on the scripted demo model, unverified with a real model. Chief answers "I asked the Inbox agent to check ... No replies have been sent." with no list. Maya must find the Inbox agent chat (collapsed "Page agents 1" row) to get the answer. Expected: Chief returns the delegated result in the same thread. | 07-answer.png | Chief delegation reply (message_bot) in the agent runtime; not located | Have Chief post the Inbox agent's result as a follow-up message, or link "Messaged Inbox agent" to it clearly. |
| J1-04 | Inbox list header | P3 | copy | Observed. "Needs reply 4 unread" counts only the five visible rows; after "Show more" the same header reads "7 unread", while the sidebar says 13. The count changes when the list is expanded. | 16-archived.png, 17-showmore.png | Inbox group header in apps/web (not located) | Count unread across the whole group, or label it "4 unread shown". |
| J1-05 | Inbox reply send | P3 | flow | Observed. After the Undo window ends the pill reads "Sending..." for about 6 more seconds with no progress and no way to cancel; the message then appears as Sent. | 14-after-send.png, 15-wait-1.png | Inbox send toast in apps/web (not located) | Show "Sent" as soon as the provider accepts, or keep Undo until then. Low priority on a real Gmail, which is faster than the emulator. |
| J1-06 | Finance dashboard, board prep | P3 | copy | Observed. "Monthly burn $67,621 (3-mo avg, after revenue)" and "$20,484 Spent so far this month" sit side by side. A founder quoting burn to a board can take the wrong one. | 30-finance.png | Finance dashboard cards | Label the second figure "Out so far this month" and keep "burn" for the average only. |

## Not covered

STORY-APP-301 to 316 (model step, Connect your apps, non-owner path): not shown on this demo. Spam, Digest, Cleanup with data, Legal deadlines and Data room legs of STORY-APP-211, phone width, touch emulation: not walked.
