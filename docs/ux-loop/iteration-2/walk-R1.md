# Walk R1: verify pass-1 clusters C1-C13

Target: mock-data demo stack (web :5381, API :3308), signed in as the demo founder at 1440x900 unless stated. Screenshots: /tmp/uxloop2/R1/. Method: each cluster's acceptance criteria checked on the live stack (measured where possible), plus a re-walk of the cluster's main flow.

Caveat: other walkers share this demo account. During the walk another session changed the Finance runway setting (page showed 25.3 mo with stablecoins, later back to 24.2 mo) and posted messages in the Finance agent chat. The 25.3 mo reading is therefore not counted as a defect. I changed the account time zone to Los Angeles for the C4 check and set it back to New York; I created and deleted one test routine.

## Verdicts per cluster

| Cluster | Criterion | Verdict | Evidence |
|---|---|---|---|
| C1 | sidebar scrollTop 0, Pages rows y >= 0 on full load of finance/contacts/inbox (14+ chats) | met | scrollTop 0, Pages rows at y 90-390 on all three (eval); c1-inbox.png |
| C1 | switching space brings its header into view | met | c1-space2.png |
| C1 | unit/Storybook test that scroll target is the header row | not met | data-sidebar-current is on the header button (Shell.tsx:4272) but no test references it |
| C2 | "legal" in sidebar search and Cmd+K lists Legal | met | c2-search.png, Cmd+K "nda" returns Legal |
| C2 | hidden page absent from sidebar search and Cmd+K | met | hid Cap table: absent from both; restored |
| C2 | empty Cmd+K shows Pages above Bots | met | c2-cmdk.png |
| C2 | "Search mail for" only when query is not a page name | met | "legal" shows no mail row; "alex" does |
| C3 | Mercury send-money approval reads "Send $1,200.00 to <recipient> from <account>" | not met (code) | approval-ask.test.ts expects "Mercury: Request send money -> $1,200.00": amount and currency fixed, but no recipient or account name |
| C3 | no mcp__/raw ids in title or body; raw args behind Details | partly | Details disclosure exists (AskCard.tsx:142); test asserts detail still contains "tool: mcp__finance-mercury__requestSendMoney" |
| C3 | allow-changes dialog says money can move | BLOCKED | Mercury has no agent section on the demo; Carta text only says "makes changes" |
| C3 | unit test over money, MCP, connector, built-in tool | partly | money, MCP and built-in covered; no connector case found |
| C3 | denied/waiting step shows no duration | BLOCKED | demo model refuses payments ("I can't initiate payments"), so no live approval could be produced |
| C4 | account zone LA -> Create Routine shows Pacific | met | c4-create.png ("Pacific Daylight Time") |
| C4 | saved routine stores LA | partly | label stays Pacific after save (c4-saved.png); stored value not read from the API |
| C4 | existing routine zone changeable or stated fixed | not met | c4-adv.png: Advanced holds only Model; zone is a bare label |
| C4 | unit test for default zone | met | local-timezone.test.ts |
| C5 | zero-hit search shows "No results" with Clear search within 2 s | partly | "No results" in about 1 s; only the input's X clears it (no Clear search button) (c5-search.png) |
| C5 | poll tick does not start another request; idle rate < 1 per 10 s with a stuck file | not met | 5 data-room requests every 3 s (processing, folders, items/list, facetValues, item) plus spaces/list = about 20 per 10 s; use-data-room-processing.ts unchanged since its first commit |
| C5 | Reading job older than limit becomes Failed | not met / unverified | "MOCK Board Minutes" still Reading with spinner, age unknown |
| C6 | "N couldn't be read" lists failed files in one click | met | c6-failed2.png |
| C6 | failed preview: heading, reason, Try again above fold, no PDF frame | met | c6-preview.png |
| C6 | Retry sets row to Reading immediately | not met | toast "Reading ... again" and itemRetry 200, but row still "Failed" at 0.4 s and 12 s (c6-retry.png) |
| C6 | one status strip; counts do not wrap at 375 or with preview | partly | one strip; at 375 "Processing 1 / file" wraps (c7-375.png) |
| C6 | stories for failed strip/preview/tile | not checked | |
| C7 | Bolt and Halcyon pilot agreements distinguishable with preview open | met | full names visible (c7-preview.png) |
| C7 | no toolbar layout shift on load | met | search box y 76 and h1 y 20 constant from first paint; rows appear at y 209 |
| C7 | at 375 first file row above y=400 | met | y 369 (c7-375.png) |
| C7 | list capped near 1200 at 1920 | met | table width 1184 |
| C8 | no Newsletter badge outside Newsletters, or counts agree | met | 0 badges in Important/Updates; Newsletters pile holds the 5 newsletter senders (c8-e2174.png) |
| C8 | pile tab count equals rows | n/a | tabs show no counts |
| C8 | Digest toggle does something visible | met | c8-digest.png |
| C9 | Cleanup lists no sender the user wrote to | met | 2 senders (was 23); neither is in the sent mail seed |
| C9 | action bar hidden until selection; Select all exists | met | c9-clean.png, c9-sel.png |
| C9 | undone history shows "Undone" | not checked | |
| C9 | at 390: name truncates after address; checkbox hit area >= 44 px | not met | checkbox 16x16, row 36 px; name and address both truncate (c9-390.png) |
| C10 | "imessage" shows tiles, no "No apps match" | met | |
| C10 | active chip keeps matching connected apps | met | Finance chip keeps Mercury, Brex, Blockscout, Coinbase (c10-chip.png) |
| C10 | second switch "Let other agents use <App> directly" + hint | met | Carta detail |
| C10 | one column count at 1440 | met | 3 columns in every section |
| C11 | each legend row opens its breakdown | partly | Common opens it (c11-leg2.png); Option pool row is a focusable element with no role and no action |
| C11 | skeleton until connection check completes, never contacts-only layout | not met | timeline: skeleton 0-0.5 s, contacts-only table 0.6-1.1 s, cap table at 1.2 s (c11-flash.png) |
| C11 | sort direction named as an action | met | button "Sort ascending" |
| C12 | one runway/cash/burn set in fixture | met | grep of demo data: 24.2 mo, $1,633,221, $67,621 everywhere |
| C12 | Finance agent and Runway page quote the same run-out date | met | agent: Oct 25 2028; page: "Until October 2028", 24.2 mo, $1,633,221 |
| C13 | Chief returns Finance figures or hands off | partly | Chief replied "For runway, ask the Finance agent here: Open Finance." No figures; Gmail/Mercury were already connected on this stack |
| C13 | APP-209 step 14 regression | not checked | |

Totals over 49 criteria: met 25, partly 8, not met 9, blocked 2, not checked or n/a 5.

## Story verdicts (re-walk)

- C1 sidebar load (V1-01 and others): PASS, 1 step (load page) vs ideal 1.
- C2 find Legal (FLOW-01): PASS, 2 steps (open search, type) vs ideal 2.
- C3 approve a payment (W2-03): BLOCKED, demo model refuses payments.
- C4 create routine (W2-01): PARTIAL, 6 steps vs ideal 4 (name, instruction, trigger menu, schedule, Save); zone shown correctly.
- C5 search Data room (V3-01): PASS for display; FAIL for polling.
- C6 failed file (W4-01): PARTIAL, 2 steps to the failed file; retry feedback missing.
- C7 preview two similar contracts (W4-02): PASS.
- C8 Newsletters (W3-01): PASS.
- C9 Cleanup (V2-03 area): PARTIAL, mobile hit areas.
- C10 find iMessage / filter chips: PASS; Mercury "allow changes" dialog BLOCKED.
- C11 cap table legend and load: FAIL (layout flash).
- C12 runway consistency: PASS.
- C13 Chief runway question: PARTIAL (hand-off only).

## Findings

| id | story/page | sev | cat | what happened vs expected | evidence | suspected location | fix |
|---|---|---|---|---|---|---|---|
| R1-01 | C5 Data room | P1 | perf | Observed: with one file stuck in Reading, the page sends processing, folders, items/list, facetValues and item every 3 s (about 20 requests per 10 s). Expected under 1 per 10 s and a Reading job timeout. | resource-timing log over 18 s | apps/web/src/components/data-room/use-data-room-processing.ts:44-48 (POLL_MS tick dispatches DATA_ROOM_CHANGED; file unchanged since first commit) | Poll only the processing endpoint and reload list/folders/facets only when its counts change; back off; fail Reading jobs after a limit. |
| R1-02 | C11 Cap table load | P1 | bug | Observed: contacts-only table (Sort: Name, Name/Email/Kind) shows for about 0.5 s before the cap table layout, after a skeleton. Expected skeleton until the connection check finishes. | c11-flash.png; 100 ms timeline | apps/web/src/pages/CapTable.tsx (layout chosen before the connection check resolves; suspected) | Keep the skeleton until the check resolves; render the contacts-only layout only when it confirms no Carta connection. |
| R1-03 | C6 Failed retry | P1 | flow | Observed: Try again shows a toast and itemRetry returns 200, but the row stays "Failed" at 0.4 s and after 12 s. Expected Reading at once. | c6-retry.png, c6-retry2.png | apps/web/src/pages/DataRoom.tsx (retry handler; suspected: no optimistic status update) | Set the row to Reading on click and let polling correct it. |
| R1-04 | C3 Approval card | P1 | copy | Mercury send-money title is "Mercury: Request send money -> $1,200.00": no recipient, no account; body still carries "tool: mcp__finance-mercury__requestSendMoney" in its unfolded text. Expected "Send $1,200.00 to <recipient> from <account>". Suspected from the unit test; no live approval could be produced. | packages/adapters/src/approval-ask.test.ts:18-55 | packages/adapters/src/approval-ask.ts describeApprovalAction | Resolve recipient and account names for known money tools and print "Send $X to A from B"; keep the tool id only under Details. |
| R1-05 | C9 Cleanup at 390 px | P2 | a11y | Observed: checkbox 16x16, row 36 px high; sender name and address both truncate. Expected hit area >= 44 px and name kept. | c9-390.png, eval | apps/web/src/components/inbox/InboxCleanup*.tsx | Make the whole row the 44 px label; truncate the address only. |
| R1-06 | C4 Routine editor | P2 | flow | Observed: existing routine shows "Pacific Daylight Time" as a plain label; Advanced contains only Model. Expected a way to change the zone or text saying it is fixed. | c4-adv.png | apps/web/src/pages/RoutineEditor.tsx | Make the label a zone select or add "Runs in <zone>" with a change link. |
| R1-07 | C6 Data room strip at 375 | P2 | visual | Observed: "Processing 1 file" wraps to two lines next to the file name. Expected no wrapping counts. | c7-375.png | apps/web/src/components/data-room/ProcessingStrip.tsx | Add whitespace-nowrap to the counts and truncate the file name instead. |
| R1-08 | C5 Data room empty search | P2 | flow | Observed: "No results" has no Clear search action (only the input X; the Failed-filter variant has "Clear filters"). Expected a Clear search button. | c5-search.png | apps/web/src/pages/DataRoom.tsx empty state | Add a Clear search button to the empty state. |
| R1-09 | C1 test | P3 | flow | No unit or Storybook test pins the scroll target to the header row. | grep: no test references data-sidebar-current | apps/web/src/pages/Shell.test.tsx | Add a Shell test asserting scrollIntoView is called on the header button. |
| R1-10 | C13 Chief runway | P2 | flow | Observed: Chief answers "For runway, ask the Finance agent here: Open Finance." with no figure; the link target (page or agent chat) is unclear. Expected the cash and runway figures or a clear hand-off. | c13-chief.png | Chief handoff text in the agent prompt/tools | Have Chief quote the Finance page's cash and runway, with the link as a footnote. |
| R1-11 | C11 legend | P3 | a11y | Observed: Option pool legend row is focusable (tabindex) but has no role and does nothing on click. Expected a button or not focusable. | snapshot: generic "Option pool (Mock)16.00%1,600,000" [focusable] | apps/web/src/components/cap-table donut legend | Render non-drillable rows without tabindex, or open a pool breakdown. |
| R1-12 | C9 Cleanup suggestions | P2 | flow | Observed: the only two Cleanup suggestions are Riley Testwell (bookkeeper, 83% read) and Sam Samplesworth (pilot customer), both saved in Contacts. Expected saved contacts to be left out. Suspected from the contact list. | c9-clean.png | apps/api cleanup sender query | Exclude senders who are in Contacts. |
| R1-13 | C10 Apps filter | P3 | flow | Observed: the "Finance" chip stays selected after leaving and returning to Apps, hiding Gmail and Carta. Expected the filter to reset. | c10-chip.png; Carta link missing after return | apps/web/src/pages/Integrations*.tsx | Reset the chip on page entry. |
| R1-14 | Sidebar (out of scope, seen) | P3 | visual | Sidebar switches from a flat list to "Apps / Workspace" section groups after opening Computer and routines, and a "Carta agent" row has a "C" letter tile. | c4-create.png | apps/web/src/pages/Shell.tsx | Not investigated. |

Praise: sidebar now loads at the top with Pages visible; Cmd+K shows Pages first and respects hidden pages; Data room failed row sits at the top with Try again, and the failed preview is clear; Data room cleanup of layout (full file names with preview open, 1184 px cap, stable toolbar); Newsletters pile and Digest work; Cleanup is down from 23 rows to 2 with a Select all and an action bar that appears only on selection; Carta's "Let other agents use Carta directly" copy; Finance agent, Runway page and seed now agree.
