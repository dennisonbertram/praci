# Walk R3: verify pass-4 clusters C20 to C29

Target: mock-data demo stack (web :5381), Maya Chen (Mock), Northwind Robotics. Desktop 1440x900 and 1280x800; phone checks at 375 wide with real touch emulation (`pointer: coarse` confirmed true in every touch measurement; an early batch measured without it was discarded and redone). Screenshots: /tmp/uxloop5/R3/. Console: no errors. Storybook smoke: 1564 of 1564 stories rendered cleanly (built from the worktree at ae433a358; the demo itself runs from the main checkout at 4a1d3edb1).

Note: other walkers share the same demo user, so Chief chat and the bot list changed during the walk. I created one bot ("New Bot") and one fresh user (walker-r3@northwind.example.test) on the demo. Connect buttons (OAuth) were not clicked: BLOCKED.

## Verdicts

| Cluster | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| C20 Integrations cards | FAIL (partial) | n/a | Desktop 1280: no button wraps (PASS). 375: page 3062 px (target 2200), connected card about 135 px (target 72). Footers differ (R3-04, R3-05). Apps pill with logos: not found in the shell, not verified. |
| C21 Artifacts and Contacts | PASS | n/a | Both have Ask (opens Chief), no byte sizes, shared PageHeader, customers show Kind Customer. |
| C22 Finance layout | PASS | n/a | With Ask open at 1280 the KPI rows are 3 and 2 tiles; smallest text 11 px; Accounts and Burn use one back control, workspace name not truncated. |
| C23 Data room agent files | FAIL (partial) | DRM-019: about 20 clicks / 6 | File names in agent reply open the preview (PASS). Ticking 3 rows shows Download and Send (email composer with 3 attachments, works). No Send to agent for several files, no select-all, selection cleared on search change (R3-01, R3-02). |
| C24 Bot settings panel | PASS with one open item | n/a | New skill has Name, Description, Steps fields; Routines above the computer; title "New Bot's computer". Footer still has three styles (R3-06). Footer shift not measured. New bot is still created on the first click (pending decision), but the flow reads well. |
| C25 Touch targets | PASS | n/a | At 375 coarse nothing under 44 px on drawer, Inbox, Finance, Legal, Cap table, Contacts, Artifacts, Integrations, bot panels, Data room preview (all five buttons 44x44). Exception outside listed scope: R3-08. |
| C26 Data room list | FAIL (partial) | n/a | Failed file shows once in the list (strip is one line) PASS; grid card shows reason PASS; single Filters button on phone PASS; first document at y=320 on 375 (target 220) FAIL (R3-03); Auto-sort partial (R3-09). |
| C27 Landing and sign-in | PARTIAL | n/a | Touch: eye button 44x44, Forgot password 44 high PASS. Mark circle 1.11:1 against page, eyes 14:1 (R3-07). |
| C28 Sidebar polish | PASS | n/a | Create menu has 3 entries; opening Inbox leaves Page agents collapsed; 375 drawer opens with Activity closed. |
| C29 Seed and onboarding | PASS | n/a | Contact kinds match; "Run my company" reply names Gmail and Calendar cards and links Finance, Cap table and Data room for the rest. |
| Storybook smoke | PASS | n/a | 0 failing stories. |

## Findings

| id | page | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R3-01 | DRM-019, Data room | P2 | flow | Observed: no select-all; ticks vanish whenever the search or a filter changes, so documents cannot be collected across the four searches the story needs. 12 contracts needed 12 clicks. Expected 6 steps. | drm-contracts.png; after typing a search the selection bar was gone and 0 boxes ticked | apps/web/src/pages/DataRoom.tsx:414 (effect clears checkedIds on queryKey) | Add a select-all header box and keep ticks across query changes (clear only on folder change or explicit Clear). |
| R3-02 | Data room selection bar | P2 | copy | Observed: bar offers Download and "Send" (opens the email composer). Acceptance asked for Send to agent for all ticked files; Send to agent exists only in the single-row menu. "Send" alone does not say it is email. Suspected: right-click on a ticked row acts on one file (not tested). | c23-selected.png, c23-send.png | apps/web/src/components/data-room/SelectionBar.tsx:39; SendToAgent.tsx | Add "Send to agent" for the selection and label the mail action "Email". |
| R3-03 | Data room, 375 | P2 | visual | Observed: toolbar uses five rows (hamburger, title with actions, search with Filters, folder chips, sort); first document at y=320 (was about 385); "Northwind Robotics" wraps under the action buttons instead of beside the title. Expected first document above y=220. | c26-m.png; tr top 320 | apps/web/src/components/data-room/FilterBar.tsx; PageHeader.tsx | Put search and Filters on the title row, move folder and sort into the Filters sheet. |
| R3-04 | Integrations, 375 | P2 | visual | Observed: page 3062 px tall (target 2200); a connected card is about 135 px (target 72) because status, action and Used by take separate rows. | c20-m.png; scrollHeight of the scroller 3062 | apps/web/src/components/integrations/IntegrationsHome.tsx | Put status chip and Used by on one line beside the action; one row per connected card. |
| R3-05 | Integrations, 1440 | P3 | consistency | Observed: Gmail and Carta cards have no overflow menu, Coinbase has no Used by row; four connected cards carry the same "Open Finance" button. | c20-apps.png | IntegrationsHome.tsx | Same footer on every connected card; one Open Finance link, not four. |
| R3-06 | Bot settings | P3 | visual | Observed: footer still shows Advanced (chevron row), Export (plain text) and Clear conversation (red text), three styles. Footer shift when the panel opens not measured. | c24-settings.png | apps/web/src/pages/shell/bot-panel.tsx:693 | Render the three as one list of identical rows, destructive one last. |
| R3-07 | Landing | P3 | a11y | Observed: mark circle is bg-muted, 1.11:1 against the page; only the eyes (14:1) are visible. Acceptance asks 3:1 for the mark. | c27-landing-m.png, pixel contrast | apps/web/src/pages/Welcome.tsx:13-17 | Use a lighter circle token or an outline with 3:1 contrast. |
| R3-08 | Data room list, 375 touch | P2 | a11y | Observed: row Select checkbox is 18x18 with about 22 px hit area on a coarse pointer, and it looks like a file icon, so ticking is not discoverable. | m-data-room2.png, crop-select.png; hit test | apps/web/src/components/data-room/ItemRows.tsx:276 | Make the tick area at least 44x44 on pointer-coarse. |
| R3-09 | Data room Auto-sort | P3 | flow | Observed: with nothing ticked it starts "Reviewing 50 files" at once with a file list and no instruction about scope. Acceptance asked for one view plus an instruction. | c26-autosort.png | Data room Auto-sort dialog | Add one line "Sorting all 50 files. Tick files to sort fewer." before it starts. |
| R3-10 | Phone pages | P3 | layout | Observed: Inbox, Data room, Integrations put the hamburger alone on a row above the title (about 55 px), while Chief has it inline. | m-inbox.png, c26-m.png | PageHeader.tsx | Put the menu button inline with the title on phone. |
| R3-11 | Demo seed | P3 | copy | Observed: Cap Table Summary.csv preview header reads "MOCK DEMO DATA. holder"; artifact tables show "Mock demo data" as a data row; Cascade Robotics is Won at 0. | c23-preview.png, c21-art-open.png | packages/testkit/src/cli/demo/data.ts | Drop the marker from data rows; give the won deal a value. |
| R3-12 | Sidebar Page options | P3 | flow | Observed (question, not a defect claim): menu lists Devin while the page is hidden until connected. Suspected only. | c28-pageopts2.png | Shell.tsx Page options menu | Hide the Devin entry until connected, if the owner decision applies to the menu. |

## Excellent

- New bot flow: one click creates the bot, name is selected for typing, and the bot opens with a single question.
- Onboarding "Run my company" reply states what to connect and links the other pages.
- File names in agent replies open the preview in the right folder; the selection bar's Send attaches all ticked files.
- Finance with the Ask panel open keeps two clean KPI rows; sub-pages share one back control.
- Touch targets on phone are now clean on every listed screen.
