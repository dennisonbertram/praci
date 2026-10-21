# Walk J1: long first-run and daily journeys

Session uxl5-J1, mock-data demo stack (web :5381), 1440x900 unless noted. Fresh invented user "Maya Chen" (sign-up, random password, not recorded here). Screenshots: `/tmp/uxloop5/J1/`.

## Story verdicts

| Story | Verdict | Steps actual / ideal | Note |
|---|---|---|---|
| STORY-APP-209 First day: sign-up to "when do we run out?" | PASS with friction | 13 / 14 | Sign-up, A card, Gmail Connect, Mercury (Finance > Add account > Mercury), ask Chief all worked. Emulated Gmail and Mercury connect in one click. Chief answered in about 25 s: "Nov 9, 2028, 24.6 months", matching the Finance Runway page. Steps 10, 11, 13, 15, 16 only partly walked. Friction: see J1-01, J1-02, J1-03. |
| STORY-APP-309 Sign-up to first answer with a subscription model | BLOCKED (steps 2 to 7, 10 to 12) | n/a | The demo has a default model, so "Connect a model" never appears and needs real provider sign-in anyway. Steps 1, 8, 9 (account created, Chief created with greeting, first question answered) were observed. |
| STORY-APP-319 First-day journey: model sign-in to connected app | PARTLY BLOCKED | 10 / 12 | The "Connect your apps" onboarding step did not appear (demo server does not need setup). The tour (steps 8 to 12) ran with 8 stops, not nine (J1-02). Gmail was connected from the Chief card instead. |
| STORY-INB-022 First morning, empty to clear Inbox | PASS with friction | about 14 / 18 | Allow sorting, read Needs reply, open Morgan's thread, Reply, Send, Undo toast, Sent, row moved out of Needs reply, To do item resolved itself. Attachment filing (steps 11 to 12) and keyboard help (15) not walked. See J1-04, J1-05, J1-06. |
| STORY-INB-040 Monday catch-up on a phone | PASS (layout only) | n/a | Viewed 390x844 Inbox: no horizontal overflow, To do card and Needs reply readable. Touch-target sizes not judged (no pointer: coarse emulation run). Archive/swipe steps not walked. |
| STORY-APP-211 Board prep (Cap table, Finance, Data room, Legal, Hide amounts) | PARTLY PASS | about 8 / 12 | Fresh user has no Carta, Legal or Data room content, so board-prep steps 3, 4, 6, 7 could not run. Hide amounts, Runway and Chief answer checked (praise below). See J1-07. |
| STORY-APP-203 Chief runway, then Finance Runway | PASS | 3 / 3 | Chief and the Runway page agree (24.6 mo, Nov 9, 2028). |
| STORY-APP-210, 212, 213, 214 | SKIPPED | n/a | Out of scope for this pass (need Carta host, Legal content, real phone). |

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| J1-01 | STORY-APP-209 step 5, 319 | P1 | flow | Observed: after choosing "Run my company", Chief posts Gmail and Calendar "Connect" cards that have no Skip or dismiss. The tour (and its "Ask Chief anything" stop) does not open until both cards are answered or Maya types. She left the chat for Finance and the tour still did not start; it opened later, on a different page (Inbox). Expected: the first-run tour starts predictably, or the cards can be dismissed. | `07-connect-click.png`, `10-finance2.png`, `15-inbox-15s.png` | `apps/web/src/pages/Shell.tsx:864-869` (`tourOpen` waits on `connectCardsOpen`); `components/tour/FirstRunTour.tsx:9-16` | Let the tour start once the focus question is answered, or add a "Not now" on the Connect cards so they stop blocking it. |
| J1-02 | First-run tour | P2 | flow | Observed: the tour showed 1/8 to 8/8, not nine stops, when it opened on the Inbox page. The "Ask Chief anything. To approve emails and purchases before they happen, turn on Action confirmations in Settings." stop was silently dropped. Owner decision says nine stops. Expected nine. | `tour-1.png` to `tour-8.png` (text of each stop captured) | `Shell.tsx:4722` (`data-tour="sidebar-chat"` only set when that chat is the selected row); `FirstRunTour.tsx:66-70` | Anchor the chat stop to the Chief sidebar row regardless of which page is open. |
| J1-03 | Tour last stop "Ask a question" | P1 | flow | Observed: from the Inbox page, "Ask a question" opened the Inbox agent (a new page agent, "Page agents 2" appeared) with "What should I do first this week?" prefilled. Its chips are mail-only. Expected: ask Chief, the general assistant the tour and greeting introduce. | `17-after-tour.png` | `Shell.tsx:5144-5150` (`active?.id ?? bots[0]?.id`) | Always open the personal Chief bot for the tour question. |
| J1-04 | Inbox after Connect, first load | P2 | perf | Observed: Inbox showed grey skeleton rows at 5 s and 15 s and the list at about 25 s (first sync of the mock mailbox). About 14 `inbox/refresh` POSTs fired in that time. No text said mail was being fetched. Cause of the repeated refresh calls is suspected, not confirmed. | `13-inbox-1s.png`, `14-inbox-5s.png`, `16-inbox-25s.png`; network log | `apps/web/src/pages/Inbox.tsx` (refresh effect) | Show "Reading your mail..." under the skeleton and collapse duplicate refresh calls. |
| J1-05 | Inbox sorting after Allow | P2 | perf / copy | Observed: "Sorting your mail..." spinner ran about 125 to 140 s for 11 messages (real model). The stall line ("taking longer than usual") never appeared in that time, while the status line pushes the whole list down about 38 px when it appears and again when it goes. Expected: some progress or the stall message within a minute or so. | `22-sorting-1s.png` to `25-sorting-3min.png` | `Inbox.tsx:1419-1424` (`sorting && stalled`) | Lower the stall threshold, and reserve the status line height so the list does not jump. |
| J1-06 | Inbox group headings | P2 | copy | Observed: headings show "Needs reply 7" and "Earlier 2" above about 10 and 9 rows. The number is the unread count (matches the sidebar badge), not the row count, and is not labelled. Expected: a number beside a heading reads as how many rows are in it. | `29-inbox-bottom.png` | `components/inbox/InboxRow.tsx:94-101` | Drop the number, or write "7 unread". |
| J1-07 | Legal, first visit | P1 | flow / copy | Observed: the tour says "Keep contracts here" but the Legal page opens with a yellow banner "Legal runs on Muse Spark 1.2 and needs your own OpenRouter key. The space's shared OpenRouter access can't be used for Legal.", a disabled "Scan now" with no reason, and three zero tiles. A first-time founder meets a model name, "space" and a key she cannot get from the product. Expected: say what she needs to do in plain words, or hide the zero tiles until it works. | `42-Legal.png` | `apps/web/src/pages/Legal.tsx:428` | Reword to "Legal needs an OpenRouter key to read your contracts" with one button, and hide the stat tiles until a key exists. |
| J1-08 | Finance Runway page | P3 | visual | Observed: the page uses the top half; the chart ends at y 490 and the lower 400 px is empty. | `36-runway.png` | n/a | Let the chart take available height or add the financing-excluded list when present. |
| J1-09 | Hide amounts | P3 | flow | Observed: the only control is a checkbox in the user menu and nothing on screen says amounts are hidden except the masked dots. Before a board call she cannot see at a glance if it is on. Suspected, not user-tested. | `37-usermenu.png`, `38-hidden-runway.png` | `Shell.tsx` user menu | Optional: a small "Amounts hidden" indicator while on. |
| J1-10 | Chief thread, Connect cards | P3 | visual | Observed once: after navigating away and back, the Gmail and Calendar card logos were empty squares (`/logos/simple/*.svg` requests stayed pending on the dev server). Probably dev-server load, not confirmed. | `39-chief-hidden.png` | n/a | Recheck on a built bundle. |

## Praise (observed)

- Sign-up to a greeting plus a four-choice question in about 4 s; wording is clear, one primary action.
- Connecting Gmail and Mercury is one click each and the result shows at once ("Connected", then the Finance dashboard).
- Chief answered the runway question with the same figures as the Finance Runway page, with an "Open Finance" link.
- Reply flow in Inbox is smooth: Reply, type, Send, "Sending... Undo", "Sent", the reply appears in the thread, the row moves out of Needs reply and the matching To do item resolves itself.
- Hide amounts masks money in the Runway page, the Chief reply, the Inbox list and Finance, and keeps months and dates visible (matches owner decision). The hidden chart says why.
- Empty Cap table and Data room pages have one clear action each. Unknown URLs show a clear "Page not found" with a way back.

## Not covered

- Real model, OpenRouter and ChatGPT sign-in; real "Connect your apps" step; Carta, Legal content, Data room files; attachment filing; keyboard shortcuts; Undo of the Archive; touch-target measurements (no pointer: coarse emulation was run, so none are claimed).
- The sidebar Inbox badge showed 12, then 11 after reading one message; consistent.
