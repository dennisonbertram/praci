# Walk J2: raising and operating (long journeys)

Walker: uxl15-J2. Target: mock-data demo stack, web port 5381, 1440x900, desktop only. Date: 2026-10-22.
Screenshots: /tmp/uxloop15/J2/ (outside the repo). Console showed no errors during the walk.

Setup notes
- Signed in as the seeded mock founder (password read from the local credentials file into a shell variable; never printed).
- Hide amounts is a per-user setting and the demo user is shared, so it flipped between hidden and shown during the walk (other walkers). I turned it to Shown for the Finance and Investors checks and did not restore it.
- State left behind on the demo: "Allow changes in Mercury" is on, a bot named "Cash watcher" with a skill and a weekly routine, one approved mock payment request (pending in Mercury, nothing moved), test files in the Data room (t.txt, t2.pdf, Halcyon-MSA.pdf, Seed-SAFE-Template.txt), the Quill SAFE assigned to Priya Placeholder, and one draft investor update.
- agent-browser's `upload` command made the product show "Upload failed. Check your connection" for every file. Uploading through the page's own file input (DataTransfer) worked and so did a direct POST, so this is a tool artifact, not a product defect. I did not log it as a finding.

## Story verdicts

| Story | Verdict | Steps actual / ideal | Notes |
|---|---|---|---|
| STORY-DRM-109 (data room prep, adapted: 2 small synthetic files, no 1.2 GB zip, no password zip) | PASS | 9 / 14 | Allow, upload, auto-tag and auto-file, Auto-sort (33 changes, Undo toast), Ask agent answered with the right file and said one file was still being indexed. The large zip, video and protected zip steps are not covered. |
| STORY-CAP-017/018 (cap table after a SAFE, then investor update) | FAIL | 8 / 7 | Investors page numbers are consistent with Fundraising and the decisions. The agent-written investor update states $350,000 raised, a figure that appears nowhere on the page (J2-01). |
| STORY-CAP-106 (connect Carta, first donut) | BLOCKED | n/a | Needs real Carta OAuth. |
| STORY-LEG-007 (Monday legal check) | PASS | 4 / 4 | Legal, Deadlines tab, Ask agent on the overdue item. Sidebar badge (1) matches the one overdue item. Notes J2-02, J2-03, J2-09. |
| STORY-LEG-001 (first week on Legal) | SKIPPED | n/a | Needs the empty-space preconditions. Only the populated page was walked. |
| STORY-APP-385/386 (approve an agent action that moves money) | PASS | 7 / 5 | Integrations, Mercury, switch, "Allow changes", open Mercury agent, ask, "Send $1,200.00". Denial path not walked. |
| STORY-APP-169/172/363 (create a bot, add a skill, add a routine, test run) | PASS | 13 / 8 | New bot, rename, Add skill, Routines, Create a routine, pick skill, schedule, Save, Test run. Notes J2-05, J2-06, J2-07. |
| STORY-FIN-019, FIN-020, FIN-022 | SKIPPED | n/a | Banks are already connected on the demo; only the dashboard and Hide amounts were read. |

## What works well
- The payment approval card reads "Send $1,200.00 to Acme Servo Supply (Mock) from MOCK Checking ••1111?", the button repeats the amount, Details gives a plain three-line breakdown, and the result says "Approved here. Waiting for Mercury". The agent then says plainly that the money has not moved. This is the best moment in the walk.
- The "Allow changes in Mercury?" dialog now says "move money and change your Mercury accounts. It asks before each change."
- The routine editor is clear: "Next run Mon, Oct 26, 9:00 AM", a "Saved" state, a skill picker inside the routine, and Run history with Done and duration.
- The new-bot flow is short: one blank greeting, an auto-selected name field, a "Saved" mark, and Skills in the same panel.
- Data room: uploads are tagged and filed on their own after Allow, Auto-sort shows a reviewable list with Undo, and the agent names the file and warns when indexing is unfinished.
- Equity raised ($250,000) counts only the Funded SAFE and shows $50,000 committed, as decided. The SAFE percentages check out against the $12,000,000 post-money cap (2.1% and 0.4%).

## Findings

| ID | Sev | Cat | Story / page | What happened vs expected | Evidence | Suspected code | Proposed fix |
|---|---|---|---|---|---|---|---|
| J2-01 | P1 | bug | CAP-018, Investors New update | Observed. "Draft with agent" wrote "The cap table records $350,000 raised." The Investors page shows Equity raised $250,000 with $50,000 committed. The agent reads the stored `amountRaisedUsd` (350000, confirmed via the capTable rpc); the page ignores it and adds up non-SAFE holders plus Funded SAFEs. An investor-facing email would carry a number the founder cannot find on screen. | 97-drafted2.png, 95-update.png; rpc /rpc/investors/capTable returns amountRaisedUsd 350000 | packages/adapters/src/builtin-tools.ts:1249 (cap_table_read); apps/web/src/pages/Investors.tsx:150-175 | Compute raised in one shared function (non-SAFE holders plus Funded SAFEs) and use it for both the page and cap_table_read. |
| J2-02 | P2 | bug | LEG-007, Legal agent panel | Observed. With the Legal agent open in the docked panel, its own "Legal agent needs an answer" toast still appeared and repeated the text already visible in the panel. The decision is that toasts clear when the chat is open. Suspected cause: the open-chat check only reads the route `/app/:botId`, so a docked page agent never counts as open. | 63-legal-answer.png | apps/web/src/components/AppToaster.tsx:75-77 and :98-102 | Also treat the bot shown in the docked panel as open. |
| J2-03 | P2 | flow | LEG-007, Legal banner | Observed. The banner "33 Data room documents not yet checked by Legal" has a Review link that opens the Data room filtered to "Legal: Not checked". The list holds handbooks, offer letters and investor updates, and has no button to run the check, so the link is a dead end. | 60-legal.png, 64-legal-review.png | apps/web/src/pages/Legal.tsx (banner); Data room `?legal=unchecked` filter | Make the banner action "Check now", or add that action to the filter chip. Scope the count to documents Legal can use. |
| J2-04 | P2 | copy | APP-385, Mercury page | Observed. Before changes are allowed the Agent card is titled "Created when you allow changes" and says "Off: the agent only reads". A title that reads as an instruction, plus a claim about an agent that does not exist yet. | 51-mercury.png | apps/web/src/components/integrations/McpDetail.tsx:337-339 | Title it "Mercury agent" and say what turning the switch on creates. |
| J2-05 | P3 | flow | APP-172, Run history | Observed. The Test run row shows the delegated message ("Please check the current Finance page and report exactl...") instead of the routine name or her instruction. The chat shows no line saying that the routine started. The answer arrived about 20 s after "Done 9.1s"; "View chat" opened it before it was there. | 82-testrun.png, 83-viewchat.png, 84-final-chat.png | apps/web/src/pages/RoutineRunHistory.tsx | Show the routine name in the row, and post a "Monday cash check ran" line at the top of the run's reply. |
| J2-06 | P3 | visual | APP-172, bot header | Observed. The header icon that opens Routines is a monitor. The panel is headed "Cash watcher's computer" over a large empty area, then Routines above it. | 75-routines.png | apps/web/src/pages/Shell.tsx (Bot computer panel) | Use a calendar or clock icon for Routines and drop the empty computer heading when there is no preview. |
| J2-07 | P3 | visual | APP-172, schedule menu | Observed. The "On a schedule" flyout opens to the left over the chat, 17 px higher than its parent row, so it looks detached. | 78-sched.png | apps/web/src/pages/RoutineSchedule.tsx | Open it below the parent item or align its top edge with the row. |
| J2-08 | P3 | visual | FIN-019, Burn chart | Observed. In the partial month column (Oct*), the Out and Revenue markers overlap and read as an "8". | 41-fin-shown.png | Burn chart component in apps/web/src/pages/Finance*.tsx (svg at 1040x180) | Offset or merge markers when two values are nearly equal. |
| J2-09 | P3 | copy | LEG-007, seed data | Observed. Insurance deadline text says the policy "renews on December 1", while the contract term ends Dec 2, 2026 and the notice date Nov 2 equals Dec 2 minus 30 days. The demo seed disagrees with itself by one day (suspected seed issue, not a code defect). | 61-deadlines.png, 60-legal.png | demo seed for Legal deadlines | Align the seed dates. |
| J2-10 | P3 | flow | APP-385, new agent chat | Observed. The Mercury agent's first chat is a blank page with no greeting or suggested question, unlike the New Bot greeting. | 54-mercury-agent.png | agent chat empty state | Show the same two or three read questions that other page agents offer. |
| J2-11 | P3 | flow | DRM-109, Auto-sort | Observed. Auto-sort proposed 33 moves, including a new sub-folder for a single file (HR / Employee handbook) and files already in the right top folder. The list has a Select all and an Undo, so it is recoverable, but it is long for a first sort. | 18-autosort2.png | data room sort proposal | Skip proposals that only create a one-file sub-folder, or group them under one "Tidy sub-folders" line. |
| J2-12 | P3 | perf | CAP-018, update draft | Observed. "Draft with agent" showed "Drafting..." for about 50 s with no progress detail, and the header showed "Saving..." the whole time. On the mock model; real model speed is unverified. | 96-drafted.png, 97-drafted2.png | apps/web/src/pages (investor update editor) | Stream the draft into the body as it arrives. |

## Not reported (other session's pages, only P0/P1 allowed)
Fundraising Round and Pipeline show only grey placeholder bars even with data loaded (looks like a stuck skeleton), the "Assign to contact" dialog does not name the SAFE, and the unlabeled "—" column in the Investors contact list is the Portal status. None is P0 or P1, so they are left for the redesign owner.

## Counts
P0: 0, P1: 1, P2: 3, P3: 8.
