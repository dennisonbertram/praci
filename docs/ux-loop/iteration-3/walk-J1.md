# Walk J1: long journeys (first run, Monday inbox, runway before the board)

Stack: mock-data demo (web 5381), 1440x900. First run walked as a fresh invented sign-up (maya-j1-N@northwind.example.test); later steps as the demo founder account. Screenshots: /tmp/uxloop3/J1/. Parallel walkers share the demo founder account, so chat threads and toasts there include other walkers' activity.

## Verdicts

| Story | Verdict | Steps actual / ideal | Notes |
|---|---|---|---|
| STORY-APP-309 (model sign-in long journey) | BLOCKED | n/a | Server has a default model, so the "Connect a model" step never shows for a new user. Provider sign-in also needs a real third-party account. |
| STORY-APP-319 (model, Connect apps, tour, first question) | FAIL (partly walked) | 9 / 12 | No model step, no "Connect your apps" step (new user is not the deployment owner). Sign-up went straight to Chief. Tour, Gmail connect and first question walked. Gmail connected in one click, yet the answer said mail tools were unavailable (J1-01). |
| STORY-APP-209 (first day, sign-up to runway) | FAIL (partly walked) | Gmail, Inbox, Allow, reply walked as a fresh user; Mercury and Cap table steps walked on the founder account | Fresh user has no Mercury path in the demo (Add account not walked). Runway answer checked on the founder account instead. |
| STORY-INB-022 (first morning: connect, sort, reply) | PASS with friction | about 12 / 18 | Sorting took about 2 minutes (J1-02). A replied thread correctly left "Needs reply". No wire-transfer email exists in this mailbox, so the "suspicious" step was not walkable. |
| STORY-INB-109 (Monday-morning reset) | PARTIAL | about 8 / 24 | Walked Important, Newsletters, Digest, Cleanup only. No Spam pile exists in this mailbox, so steps 3-6 SKIPPED. Cleanup shows two people, not bulk senders (J1-04). |
| STORY-APP-211 / APP-203 (runway before board) | PASS with friction | about 9 / 12 | Finance, Runway drill-down, Finance agent answer, Chief answer and Hide amounts all agree on 24.2 months and Oct 2028. Legal opens on a scan-failed banner (J1-06). |

Skipped: STORY-INB-023, 024, 040 (phone). STORY-APP-211 steps 2, 6, 8, 13 (Reply all with undo, Data room search, Forward, live arrival).

## What is excellent

- Finance and Runway pages: four to five KPI tiles, one chart, a cash breakdown. Runway 24.2 mo, run-out Oct 25 2028, sidebar "24 mo", Finance agent and Chief all match. Tiles reflow to 2x2 beside the Ask panel and to a single column at 390px with no horizontal scroll.
- Hide amounts masks tiles, chart, breakdown, upcoming list, sidebar glance and chat previews; the chart says why it is hidden.
- Reply flow: Undo toast, the sent reply appears under "Later in this conversation", and the thread leaves "Needs reply".
- First-run focus card then a 9-step tour with Skip tour on every step but the last; the last step's "Ask a question" fills the composer.

## Findings

| ID | Story / page | Sev | Cat | What happened vs expected | Evidence | Suspected code | Fix | Status |
|---|---|---|---|---|---|---|---|---|
| J1-01 | APP-319, APP-209 | P1 | bug | Gmail card shows "Connected" and the Inbox lists mail, but the Gmail agent replied "the mailbox tools aren't available here, and the browser is signed out", and Chief's answer says it has no task list. Expected: a connected account that agents can read, or a clear "not ready yet". | 10-first-answer.png, 11-first-answer2.png | agent tool mounting for a connection made in chat (cause not traced) | Mount mailbox tools when the connect card succeeds, or have Chief say Gmail is still syncing. | observed (cause suspected: demo runtime) |
| J1-02 | INB-022 | P2 | perf/flow | After Allow, "Sorting your mail…" ran about 2 minutes (still on at 70 s, gone by 130 s). The list below stays unsorted with a 130 px gap under the spinner and no estimate. | 15-sorting.png, 17-sorted-60s.png | apps/web/src/pages/Inbox.tsx:1358 | Show the unsorted list tight under a compact status line with "usually under a minute"; sort in chunks. | observed |
| J1-03 | all pages | P2 | perf | One tab made 96 /rpc/spaces/list calls plus 22 computer/updates in about 5 minutes of light use. | net.txt (734 requests) | polling or per-render spaces.list in Shell | Fetch once and share via cache, or poll no faster than every 30 s. | observed (count), cause suspected |
| J1-04 | INB-109 | P1 | flow | Cleanup lists Sam Samplesworth (pilot customer, "annual contract" thread) and Riley Testwell (bookkeeper) as sweep candidates ("33% read"). Archiving them would bury live business mail. Expected: bulk senders only, or a reason shown. | 28-cleanup.png | apps/web/src/components/inbox/InboxCleanup.tsx and the API sender-stats query | Exclude senders Maya has replied to or in the Important pile; show why a sender is listed. | observed |
| J1-05 | APP-319 | P2 | visual | The sidebar Pages list is capped at 40vh and clips "Artifacts" in half at 900px high while about 280 px of sidebar below the chat list is empty. | 05-wait.png (Artifacts cut at y=410) | apps/web/src/pages/Shell.tsx:4037 (max-h-[40vh]) | Let Pages grow to its content, cap only when the chat list needs the room. | observed |
| J1-06 | APP-211 | P2 | copy/flow | Legal opens with "Last scan failed: OpenRouter did not accept your key. Replace OpenRouter key" before any content. Probably the demo's model key. For Maya it is the first thing on a board-prep page. | 39-legal2.png | apps/web/src/pages/Legal.tsx:194 | Keep it, but place it in a dismissible banner under the stat tiles. | observed (demo key suspected) |
| J1-07 | APP-319 | P2 | flow | The tour (9 steps) opens only after the focus card is answered, then runs at the same time as the Connect Gmail and Calendar cards in chat. Step 3 covers Finance and Legal rows; step 9 sits over the Apps pill. Two prompts compete. | 07-after-A.png, tour-3.png, tour-9.png | apps/web/src/components/tour/FirstRunTour.tsx steps; Shell.tsx:820 | Cut to about 5 steps (search, Inbox, Finance, Apps, account) and delay Connect cards until the tour ends. | observed |
| J1-08 | APP-209 | P2 | copy | Connecting Gmail from the chat card silently creates a "Gmail agent" in the sidebar with no message saying so. Later Chief reports "Messaged Gmail agent". | 09-connect-gmail.png | connect-card success handler | Chief posts one line: "I added a Gmail agent that reads your mail." | observed |
| J1-09 | APP-209 | P2 | flow | Chief's sidebar preview stays "I don't have the current runway figure yet…" even after Finance replied with 24.2 months in the same thread. The first message is a non-answer. | 40-chief.png, 36-runway-answer.png | Chief delegation reply and sidebar preview source | Hold Chief's reply until the delegate answers, or take the preview from the latest message in the thread. | observed |
| J1-10 | INB-109 | P2 | visual | Digest cards are 143 px tall with the Open button on its own row; the "summary" repeats the subject line. Five cards fill the screen. The Digest and Cleanup icons in the header have no visible labels. | 26-digest.png, 25-newsletters.png | apps/web/src/pages/Inbox.tsx (digest card) | Put Open on the title row (about 80 px cards); label or tooltip header icons. | observed |
| J1-11 | APP-211 | P2 | layout | Cap table donut takes about 490 px with two legend rows; the shareholder table, the content for board prep, starts below the fold at 900 px. | 37-cap.png | apps/web/src/pages/CapTable.tsx | Shrink the donut to about 200 px and put the legend beside it. | observed |
| J1-12 | all pages | P2 | perf/visual | Cold load of a deep link or logout shows a blank sidebar (only Apps and the user row) and skeletons for several seconds. After "Log out" the blank shell read "Opening Praci…" for about 20 s before /sign-in. Direct /app/legal and /app/finance took 7 to 9 s to fill the sidebar. | 30-stuck.png, 38-legal.png, 41-hidden.png | Shell.tsx bootstrap | Render the sidebar skeleton immediately and redirect to sign-in as soon as the session check fails. | observed (timings approximate, polled once) |
| J1-13 | INB-022 | P2 | flow | Sending a reply showed "Sending… Undo", then "Sending…" with no Undo for about 10 s before "Sent". | 21-sent.png, 22-sent2.png | inbox send path | Show "Sent" once the server accepts, or keep the undo window visible. | observed |
| J1-14 | APP-211 | P3 | visual | Toasts from other agents ("Mercury agent finished", "Chief finished") sit over the bottom-right of the Ask panel and cover the end of the answer. | 35-ask-panel.png, 36-runway-answer.png | toast container position | Offset toasts to avoid the open agent panel, or stack them above the composer. | observed (toasts came from parallel walkers) |
| J1-15 | APP-309, APP-319 | P3 | flow | The model step and "Connect your apps" step never appeared. Fresh sign-up goes directly to Chief, so the catalog's Steps 1-7 are unreachable on the demo. Catalog needs a stack note. | 03-after-create-1s.png | docs/ux-paths/app/catalog.md | Add a "demo cannot show model step or Connect your apps" note to STORY-APP-309 and 319. | observed |

Counts: 15 findings (P0 0, P1 2, P2 11, P3 2).
Console: no errors on any screen walked (only Vite and React DevTools info).
Not verified: mobile (390px) beyond Finance; Archive all 8 in Digest (button click did not register in my test); Mercury connect on a fresh user.
