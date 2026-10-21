# Iteration 2 problem register

Sources: verifiers R1-R3 (`walk-R*.md`), walkers W7-W9 (`walk-W*.md`), flow critique (`flow.md`), visual inspectors V1-V3 (`visual-V*.md`). `alk-R2.md` and `alk-W8.md` are empty and were ignored. Pass-1 sources (`docs/ux-flow/report.md`, `docs/ux-visual/problems.md`, `docs/ux-loop/iteration-1/problems.md`) were read so that decided or fixed items are not raised again. A pass-1 cluster whose criteria still fail appears below as a cluster that names its old id in "Pass 1".

Owner decisions: iteration-1 `problems.md` records only the questions it asked, not the answers. What the merged pass-1 changes imply was taken as decided: Hide amounts only in the account menu (be283d08b), Settings split into General and Privacy and approvals, the page is called Apps, Import removed from the Cap table header, consent asked once per area. The tour length (tour-len) is still open. Items that depend on an answer are flagged `needs_product_decision`.

Evidence labels: observed = seen or measured by a walker; verified in code = I read the cited lines this pass; suspected = inferred. The demo stack was shared and ran at load average 20-70, so loading times are not treated as measurements.

## Verification notes (checked against code)

- Sidebar: Pages group is inside the scroll container (`Shell.tsx:3985-3996`, comment "Inside the scroll area"); R1 saw the C1 load-time fix work, FLOW-01 describes a different trigger (list scrolled after a delete), so both are true.
- Data room: `use-data-room-processing.ts:44-48` dispatches DATA_ROOM_CHANGED every 3 s while active, and `DataRoom.tsx:277-278` reloads on it. `DataRoom.tsx:407-415` retry never sets the row to Reading.
- Cmd+K: `command-palette.tsx:253` describes the scope as pages, bots and groups; placeholder is only "Search".
- Storybook: `BotSkillsSection.tsx:130-134` reads `drafts.length` from an unmocked null; `bot-panel.stories.tsx:28-29` mocks list and forBot only.
- Skills: `slash-skills.ts` has no case for devin-sessions, meeting-notes or box-files (inbox-search is only hidden from the / picker).
- Legal agent: `PageAgentIntro.tsx:5` `PageAgentKind` has no legal member.
- Setup route: `App.tsx:184-192` is outside the shell routes. Create button: `Shell.tsx:3933` has `title` only. Authorize string: `message-cards.tsx:254`. Activity filter: `ActivityList.tsx:135` shows the form while `showFilters || filtersOn`.
- Approval title: not verifiable live (demo model refuses payments); read from `approval-ask.test.ts` and `approval-ask.ts`, so marked suspected.
- Not verified in code (kept suspected): mail-agent cause, cap table loading cause, Inbox cleanup contacts query, Chief hand-off text location.

## Pass-1 cluster status after the verifiers

| Pass-1 | Status | Where it continues |
|---|---|---|
| C1 sidebar scroll | met (+1 test missing) | sidebar |
| C2 search Legal | met | cmdk (scope) |
| C3 approval card | not met | approval |
| C4 routine zone | partly | routine |
| C5 Data room polling/search | not met | dr-processing, dr-list |
| C6 failed files | partly | dr-processing |
| C7 names/preview | met | dr-list (narrow widths only) |
| C8 Newsletters | met | - |
| C9 Cleanup | partly | inbox-clean, touch |
| C10 Apps filter | met (chip persists) | apps-page |
| C11 cap legend/load | not met | cap |
| C12 seed numbers | met | - |
| C13 Chief runway | partly | chief-runway |
| C14 agents see mail | not met | mail-agent |
| C15 bot URL | met | - |
| C16 consent | partly | consent |
| C17 Models | partly | settings |
| C18 General | met | settings (polish) |
| C19 Skills/Memory | partly | bot-skills |
| C20 tour | partly | tour-place, tour-len |
| C21 first-run connect | partly | create-copy |
| C22 naming | partly | apps-page, create-copy |
| C23 logos | met | - |
| C24 setup forms | partly | setup-pages |
| C25 Inbox chrome | partly | inbox-chrome |
| C26 attachment preview | partly | inbox-chrome |
| C27 cap layout | not met | cap |
| C28 Contacts | met | contacts (new items) |
| C29 Finance | met with nits | fin-labels, fin-layout |
| C30 Data room | partly | dr-autosort, dr-list |
| C31 Routine editor | met | routine |
| C32 Approval rules | met | - |
| C33 Toasts | partly | toast |
| C34 Touch targets | blocked live | touch |
| C35 Artifacts | met | artifacts (new items) |
| C36 Hide amounts | met (entry points) | hide (consistency) |
| C37 Sidebar | partly | sidebar |
| C38 Bootstrap | blocked | deferred (perf) |
| C39 Legal | met at 1440, not at 375 | legal |

R1 totals over 49 criteria: met 25, partly 8, not met 9, blocked 2, other 5. R2: pass 3, partly 9, fail 1. R3: pass 7, partial or fail 4, blocked 2.

## Clusters (ranked)

Ranking: no P0 findings were reported. Order is severity weight (P1=3, P2=2) x reach (1-3) / effort (S=1, M=2, L=3). Ties go to the higher severity. The cluster key in brackets is a short name used in the pass-1 table above.

### C1 First-run tour covers content, stays open after its last step, and is unanchored on phones (P1) [tour-place]
- Score 9.0; effort S; pass 1: C20
- Root cause: TourPopover places itself without regard to the newest chat content, so step 1 lands on the Gmail/Calendar connect cards and the Data room folder list; on narrow screens it is pinned to the bottom (TourPopover.tsx:121 `fixed inset-x-4 bottom-4`) with no ring; the last step's action navigates but does not finish the tour. Verified in code (placement class); the unfinished-tour cause is suspected.
- Findings: V1-01, V1-02, R2-06, R2-07, W9-01, V3-01
- Found by: V1, R2, W9, V3
- Reach: Every new user (first minute), all viewports
- Evidence: observed (live, 1440 and 375); placement class verified in code
- Files:
  - apps/web/src/components/tour/TourPopover.tsx:121 (placement; ring on narrow screens)
  - apps/web/src/components/tour/FirstRunTour.tsx (start trigger after the first exchange is idle; finish on the last step's action)
  - apps/web/src/components/tour/FirstRunTour.test.tsx, TourPopover.stories.tsx
- Acceptance:
  - After the focus card is answered at 1440x900 the step-1 popover rect does not intersect the newest message or the Gmail/Calendar cards (getBoundingClientRect).
  - On the Data room the popover rect does not intersect the folder list or the first three row names.
  - At 375x812 each step shows a ring on its target and the popover does not cover the target.
  - Clicking the last step's action ends the tour: no popover or backdrop in the DOM on the Apps page.
  - Escape still ends the tour. Unit test for the finish-on-action path.
- Needs product decision: no
- Dependencies/conflicts: Same files as C3; land this first.

### C2 Raw provider errors in toasts and replies; toasts cover the chat text (P1) [toast]
- Score 6.0; effort S; pass 1: C33
- Root cause: A failed Legal run raises the toast `Legal agent failed: 401: {"message":"User not found.","code":401}` while the panel shows a plain sentence, so the toast path does not use the same mapping; the consent-required reply names OpenRouter and "Data Room consent" and has no Allow button (composer-error.tsx); the toast stack sits over the last bubble; the Contacts "Saved" notice lasts about 1.5 s at the list end.
- Findings: W7-05, W7-06, W7-07, R3-13, R3-14
- Found by: W7, R3
- Reach: Every failed agent run; every toast
- Evidence: observed
- Files:
  - apps/web/src/components/AppToaster.tsx (offset above the composer or top right; keep Dismiss visible)
  - apps/web/src/pages/shell/composer-error.tsx (plain consent message with an Allow button)
  - run-failure notification text for failed runs (map provider errors with the same function as the panel)
  - apps/api executor consent-check message
  - apps/web/src/pages/Contacts.tsx (notice as a toast, about 4 s)
- Acceptance:
  - No toast, chat reply or card contains `{"` or a status-code prefix; the toast text equals the panel text for the same failure.
  - The consent-required reply has an Allow button and no vendor name.
  - A toast never intersects the last message bubble or the composer at 1440x900 (rects).
  - Contacts "Saved X" shows as a toast for at least 4 s.
  - Unit test over the error-to-text function with a 401 JSON body.
- Needs product decision: no
- Dependencies/conflicts: Legal wording (W7-07) overlaps C25 only in message text.

### C3 First-run tour is nine stops that repeat the sidebar labels (P2) [tour-len]
- Score 6.0; effort S; pass 1: C20 (decision still open)
- Root cause: FirstRunTour.tsx:24-63 defines nine steps, in an order that is not top-to-bottom, and only the last one is an action. The pass-1 question (3-4 stops or keep nine) was never answered.
- Findings: FLOW-02, V1-24
- Found by: FLOW, V1
- Reach: Every new user
- Evidence: suspected for FLOW-02 (code only); V1-24 observed
- Files:
  - apps/web/src/components/tour/FirstRunTour.tsx:24-63
  - apps/web/src/components/tour/FirstRunTour.test.tsx
  - apps/web/src/components/tour/*.stories.tsx
- Acceptance:
  - Tour has at most 3 stops (Chief with one example question, Pages, Apps) and ends with the composer focused.
  - Test asserts the step count and order.
- Needs product decision: yes. Cut the tour to three stops that end in the composer (recommended), or keep nine and only reorder them top to bottom?
- Dependencies/conflicts: Depends on C1 (same files).

### C4 AI data sharing still lists model ids, loads late, and the disabled Scan now has no reason (P2) [consent]
- Score 6.0; effort S; pass 1: C16
- Root cause: AiDataSharing.tsx lists switches named by model slug with a vendor caption (:86,:140-165) and returns null until the status loads (:116), so the section appears 3-4 s late and shifts the page; the consent card says "the text" without saying what or whose model; Legal's Scan now is disabled with no stated reason. The ask-once-per-area design from pass 1 is implemented and not reopened.
- Findings: R2-11, V1-05, W8-04, W8-05, W8-03, FLOW-06, W7-10
- Found by: R2, V1, W8, FLOW, W7
- Reach: Every user who opens Settings or a consent card
- Evidence: observed + line numbers from walkers
- Files:
  - apps/web/src/components/AiDataSharing.tsx:50-53,86,116,140-165
  - apps/web/src/pages/Legal.tsx (header: reason on disabled Scan now; hide "Last scan" until consent)
- Acceptance:
  - Switches are labelled by purpose ("Sort and summarize mail") with the model's display name as secondary text and no vendor caption.
  - Text says what off does ("Bots cannot use this model until you allow it").
  - The section reserves its height with a skeleton; no layout shift when the status loads (CLS < 0.01).
  - Consent card names the data sent (sender, subject, preview) in one line.
  - Disabled Scan now has a title or adjacent reason.
- Needs product decision: yes. In Settings, show one row per area labelled by purpose with the model as small text (recommended, matches ask-once-per-area), or one master switch for all AI reading?
- Dependencies/conflicts: AiDataSharing.tsx only; Legal.tsx header shared with C25.

### C5 First-run and create-menu wording: three connect bubbles, Authorize vs Connect, "To:" and "Space" jargon (P2) [create-copy]
- Score 6.0; effort S; pass 1: C21, C22
- Root cause: After the focus card Chief posts three bubbles that all say connect and the cards say "Authorize" (message-cards.tsx:254) while the sidebar says Apps; the "+" picker is headed "To:" with New bot, New group, New space mixed with chats; the loading screen says "Opening your Space..." (ShellSkeleton.tsx:27); "New bot" creates a record before it is named and Delete asks about memories for a bot with none.
- Findings: R2-08, V1-19, FLOW-07
- Found by: R2, V1, FLOW
- Reach: Every new user
- Evidence: observed; strings verified for message-cards.tsx:254
- Files:
  - apps/web/src/pages/shell/message-cards.tsx:254
  - onboarding reply copy (Chief greeting)
  - apps/web/src/components/ShellSkeleton.tsx:27
  - apps/web/src/pages/Shell.tsx create menu header and delete-bot dialog
- Acceptance:
  - First-run chat shows one sentence above the cards and the buttons say Connect.
  - Loading screen says "Opening Praci...".
  - The "+" menu is headed "New" and has no "To:".
  - Deleting a bot with no memories skips the memory question (test).
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx small edits; land after C6.

### C6 Sidebar: Pages scroll away with the chats, Chief sinks, Auto-group and rename misbehave (P1) [sidebar]
- Score 4.5; effort M; pass 1: C1, C37
- Root cause: Pages group is rendered inside the same overflow-y-auto div as the chats (Shell.tsx:3985-3996, the comment says so), so any scroll of the chat list removes it; chat groups sort by last activity and Auto-group leaves Chief ungrouped below all folders; rename has no duplicate-name check (Shell.tsx:1898); bot rows use two avatar slot widths; the create button is named "+". C1 only fixed the first-load scroll, not this. Verified in code for the Pages placement and the missing aria-label (Shell.tsx:3933 has only title).
- Findings: FLOW-01, V1-09, V2-01, R3-07, R3-06, V2-24, V1-08, W9-03, R1-09, W9-12
- Found by: FLOW, V1, V2, R3, W9, R1
- Reach: Every user with more than about 8 chats; all viewports
- Evidence: observed + Pages placement verified in code
- Files:
  - apps/web/src/pages/Shell.tsx:3985-4000 (move the Pages group above the scrolling chat list)
  - apps/web/src/pages/Shell.tsx:1898 (rename: reject duplicates inline, sections and folders)
  - apps/web/src/pages/Shell.tsx:1918 autoGroupSidebar + server rpc sidebar.autoGroup (keep Chief first, keep Undo toast until dismissed)
  - apps/web/src/pages/Shell.tsx:3933 (aria-label Create)
  - apps/web/src/pages/Shell.tsx bot row (fixed 36px avatar slot, equal row height, roving focus for the Actions button)
  - apps/web/src/pages/Shell.test.tsx
- Acceptance:
  - With 20 chats and the list scrolled to the bottom the Pages rows are visible and are not descendants of the scroll container.
  - Chief is the first chat row at rest, after recency changes, and after Auto-group.
  - Renaming a section or folder to an existing name shows an inline error and changes nothing.
  - All bot rows share one height and one name x position (0 px spread, measured).
  - Group headers use one pattern (count and chevron) for Workspace, Agents and Chats.
  - Create button accessible name is "Create".
  - Test: scrollIntoView target is the space header row (data-sidebar-current).
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx is shared with C7, C21 (row status), C8, C13, C5. Land first.

### C7 Cmd+K and sidebar search cover only pages and chats and disagree with the sidebar (P1) [cmdk]
- Score 4.5; effort M; pass 1: C2
- Root cause: Palette description is "Search pages, bots and groups" and the placeholder is only "Search" (command-palette.tsx:253-264), so documents, contacts and artifacts are not searched and nothing says so; appPages order differs from the sidebar and omits Artifacts and Task board; the mail row is offered with no mail account; chat snippets print markdown. Verified in code (palette description, searchPages).
- Findings: V3-08, FLOW-08, V1-20, W8-09
- Found by: V3, FLOW, V1, W8
- Reach: Every Cmd+K and sidebar search
- Evidence: observed + verified in code
- Files:
  - apps/web/src/pages/shell/command-palette.tsx:106-113,253-264
  - apps/web/src/pages/Shell.tsx:1975-2024 (appPages order, searchPages)
  - apps/web/src/pages/SpaceSearch.tsx:148,181
- Acceptance:
  - Cmd+K "Halcyon" returns the 3 Data room documents, the 3 contacts and any artifact, grouped, in addition to chats (sidebar search already loads documents and artifacts; reuse that).
  - Empty Cmd+K lists pages in the same order as the sidebar and includes Artifacts and Task board when shown.
  - "Search mail for" is absent when no mail account is connected.
  - Chat result snippets contain no `**` or backticks.
  - Unit tests on the shared page list and on markdown stripping.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx (shared with C6). Default decision taken: include documents and contacts rather than relabel the scope.

### C8 Touch targets under 44 px on phones: the 44 px rule only applies to coarse pointers (P1) [touch]
- Score 4.5; effort M; pass 1: C34 (BLOCKED live in pass 2)
- Root cause: PR #494 sets 44 px only under `pointer-coarse`, so any narrow window or headless 375 px check sees 28-34 px; and several controls have fixed sizes outside the shared button (message actions 28 px, Compose 28 px, thread Close and prev/next 28 px, pile tabs 25 px high, Cleanup checkbox 16 px, avatar swatches 24 px). Walkers could not emulate pointer: coarse, so the code path was never exercised live.
- Findings: V2-02, V1-17, V3-11, W9-10, W9-11, R1-05
- Found by: V2, V1, V3, W9, R1
- Reach: Every phone user, every page
- Evidence: observed (measured at 375) for fixed-size controls; coarse-pointer path code-only
- Files:
  - packages/ui-web (button, switch, checkbox, dropdown-menu `pointer-coarse:` classes)
  - apps/web/src/pages/Shell.tsx composer, header, message action row
  - apps/web/src/components/inbox/InboxPileTabs.tsx, CleanupSenderRow.tsx, InboxMessageDialog.tsx (Close, prev/next)
  - apps/web/src/pages/shell/avatar-studio-popover.tsx
  - a Playwright check using a touch context (hasTouch + isMobile) at 375x812
- Acceptance:
  - A touch-context Playwright test at 375x812 over Inbox, Finance, Legal, chat, Data room, Contacts and Settings finds 0 visible interactive controls with a hit area under 44x44 (the script prints offenders).
  - Cleanup row at 390: whole row is the 44 px label, checkbox included; sender name is not truncated before the address.
  - Avatar Studio swatches 32 px or larger; shape buttons have plain names.
- Needs product decision: no
- Dependencies/conflicts: Touches Shell.tsx and Inbox files shared with C6, C12, C23. Default taken: keep 44 px for coarse pointers only; verify with touch emulation instead of widening it to narrow desktop windows.

### C9 15 Storybook stories crash in the smoke run (P2) [storybook]
- Score 4.0; effort S; pass 1: CI gate (repo rule: every story renders)
- Root cause: BotSkillsSection calls rpc.agentSkills.drafts() and does setDrafts(null) when the story mock returns null, then reads drafts.length (BotSkillsSection.tsx:96,130-134,402); the bot-panel stories mock agentSkills.list and forBot but not drafts (bot-panel.stories.tsx:28-29). DataRoomPage stories lack a default dataRoom.processing response so ProcessingStrip reads null.reading. Two stories hit a 404 asset. Verified in code.
- Findings: R3-02, R3-03, R3-04
- Found by: R3
- Reach: Every PR: CI runs the smoke check
- Evidence: observed (smoke log) + verified in code
- Files:
  - apps/web/src/pages/shell/bot-panel.stories.tsx:18-29 (add "agentSkills.drafts": [])
  - apps/web/src/pages/shell/BotSkillsSection.tsx:130-134 (treat null as empty)
  - apps/web/src/pages/DataRoom.stories.tsx:8,52-69 (default "dataRoom.processing" in load())
  - apps/web/.storybook/stubs.ts (stub the remote image or attachment URL)
- Acceptance:
  - `node .storybook/smoke.mjs` in apps/web renders 1480 of 1480 stories with no console error.
- Needs product decision: no
- Dependencies/conflicts: None.

### C10 Finance figures use different windows for one vendor, the burn chart draws financing as a ramp, labels clip (P2) [fin-labels]
- Score 4.0; effort S; pass 1: C29
- Root cause: Subscriptions "Per month" is a 3-month average, the vendor page "Monthly avg" is 6 months (metrics.ts:705-710) and neither names its window; the burn chart interpolates the Oct 13 financing into a diagonal line with a bar legend swatch (charts.tsx); the last x label is not clamped at :229; the Crypto card shows all-crypto with a stablecoin-only subtitle (Finance.tsx:803); the page name appears in both breadcrumb and H1.
- Findings: R3-10, W7-15, W7-16, W7-03, W7-04, W7-17
- Found by: R3, W7
- Reach: Every Finance visit
- Evidence: observed; metrics lines from walker
- Files:
  - apps/web/src/pages/Finance.tsx:803,959 and the subscriptions table
  - packages/core/src/finance/metrics.ts:705-710
  - apps/web/src/components/finance/charts.tsx:229 (textAnchor end on last label; financing as a dated marker)
  - apps/web/src/components/finance/ui.tsx DetailHead (drop repeated crumb)
- Acceptance:
  - List and vendor detail show the same figure for the same label, or each label names its window (3-mo avg, 6-mo avg).
  - Last x label is fully inside the svg (right edge check).
  - Financing is a marker at its date; legend swatch matches the mark.
  - Crypto headline and subtitle describe the same amount.
  - Detail pages do not repeat the page name in crumb and H1.
- Needs product decision: no
- Dependencies/conflicts: Finance.tsx shared with C26.

### C11 No maximum content width: threads and tables stretch across 1920 px screens (P2) [width]
- Score 4.0; effort S; pass 1: new
- Root cause: Page containers have no max width: chat bubbles sit 1240 px apart, Inbox rows put sender and time 1500 px apart, Finance Subscriptions leaves 750 px dead, the Data room table stops at x 1752 while chrome runs to 1900.
- Findings: V2-11, V1-22, V3-13
- Found by: V2, V1, V3
- Reach: Every user on a large monitor
- Evidence: observed at 1920x1080
- Files:
  - apps/web/src/pages/Shell.tsx (thread container, cap about 900 px centered)
  - apps/web/src/pages/Finance.tsx and Inbox.tsx page containers (about 1280-1440 px)
  - apps/web/src/components/data-room/ItemRows.tsx table width
- Acceptance:
  - At 1920x1080 the thread column is at most 900 px and centered; Inbox and Finance content at most 1440 px; Data room table fills its panel or the panel is capped (no 150 px blank gutter).
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx, Finance.tsx, ItemRows.tsx shared; small edits, land late.

### C12 Inbox Cleanup: list shifts on first select, stats have no units, saved contacts are suggested (P2) [inbox-clean]
- Score 4.0; effort S; pass 1: C9
- Root cause: CleanupActionBar renders only after a selection and pushes the list down 52 px (CleanupActionBar.tsx:26); the row ends with "3 · 33% read · Oct 18" (CleanupSenderRow.tsx:104-106); the suggestion query does not exclude senders who are saved Contacts, so both suggestions are live contacts.
- Findings: V2-06, V2-07, R1-12
- Found by: V2, R1
- Reach: Users who open Cleanup
- Evidence: observed; contacts exclusion suspected (query not read)
- Files:
  - apps/web/src/components/inbox/CleanupActionBar.tsx:26,48
  - apps/web/src/components/inbox/CleanupSenderRow.tsx:104-106
  - apps/api/src/inbox-cleanup.ts (exclude senders in Contacts)
- Acceptance:
  - Selecting the first sender moves no row (Select all y unchanged).
  - Row stat reads "3 emails, 33% read, last Oct 18"; bar buttons say what they do ("Archive future mail").
  - No sender present in Contacts is suggested (API test).
- Needs product decision: no
- Dependencies/conflicts: Touch-target fix for the same row is in C8; coordinate on CleanupSenderRow.tsx.

### C13 Bot panel and Skills: slugs shown, mislabelled gear, loose rhythm, empty box while loading (P2) [bot-skills]
- Score 4.0; effort S; pass 1: C19
- Root cause: slashSkillLabel has no case for inbox-search, devin-sessions, meeting-notes and box-files (slash-skills.ts:14, verified: none of the three non-hidden slugs appear in the file); the settings-mode header icon is a gear that acts as Show computer (Shell.tsx:5374); panel rows use mixed spacing and edge alignment (bot-panel.tsx:693); the Skills section paints an empty box before settling; the Memory empty line is bold.
- Findings: R2-03, R2-15, V1-03, V1-23
- Found by: R2, V1
- Reach: Everyone who opens bot settings
- Evidence: observed; slugs verified in code
- Files:
  - apps/web/src/lib/slash-skills.ts:14
  - apps/web/src/pages/shell/BotSkillsSection.tsx
  - apps/web/src/pages/KnowledgeSection.tsx
  - apps/web/src/pages/shell/bot-panel.tsx:693
  - apps/web/src/pages/Shell.tsx:5374
- Acceptance:
  - No expanded built-in skill shows a slug (test over the bundled skill list).
  - The computer action has a monitor icon; panel title is "<Bot> settings".
  - Panel rows follow one label-left control-right pattern on a 4 px scale; right edges equal.
  - Skills shows a skeleton row; Memory's empty line is muted.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx:5374 shared; BotSkillsSection.tsx also in C9 (null guard).

### C14 Contacts: 56 px rows scroll the page, no workspace name or Ask, "Other" kind, standing hint (P2) [contacts]
- Score 4.0; effort S; pass 1: C28
- Root cause: Contacts table rows are 56 px for one line (content 965 px at 1440x900); the header lacks the workspace name and Ask that other pages have; Kind has only Investor, Auditor, Other; the dialog always shows "Contacts are your address book. They do not change Carta."
- Findings: V3-10, FLOW-11, V3-17
- Found by: V3, FLOW
- Reach: Contacts users
- Evidence: observed
- Files:
  - apps/web/src/pages/Contacts.tsx (row padding, header)
  - apps/web/src/components/Contact* dialog (conditional hint; Customer and Counsel kinds or hide Kind until set)
- Acceptance:
  - 15 contacts fit at 1440x900 without page scroll (rows 40 px or less).
  - Header shows workspace name and Ask like the other pages.
  - Hint appears only for a contact that is also on the cap table.
  - A prospect and counsel can be filed under their own kind.
- Needs product decision: no
- Dependencies/conflicts: None.

### C15 Chief answers a runway question with a redirect instead of figures (P2) [chief-runway]
- Score 4.0; effort S; pass 1: C13
- Root cause: Chief's reply to "what is our runway" is "For runway, ask the Finance agent here: Open Finance." with no figure; the link target (page or agent chat) is unclear. The pass-1 criterion allowed either figures or a hand-off, so this is partly met.
- Findings: R1-10
- Found by: R1
- Reach: Every founder who asks Chief about money
- Evidence: observed
- Files:
  - Chief hand-off text in the agent prompt/tools (packages/adapters or apps/api agent prompt; not located)
- Acceptance:
  - Chief answers with cash and runway from the Finance data, or the hand-off names the exact destination and what it holds.
- Needs product decision: yes. Should Chief quote Finance figures itself (recommended), or keep handing off to the Finance agent?
- Dependencies/conflicts: None.

### C16 Auth pages: expired reset link shows a dead form, button names differ, error shifts the form (P2) [auth]
- Score 4.0; effort S; pass 1: new
- Root cause: An invalid reset token shows the full form with a disabled button (Auth.tsx:354-356,416); sign-in button says "Continue with email" (Auth.tsx:300); the error line pushes the form up 16 px (Auth.tsx:290); placeholders repeat labels.
- Findings: W9-07, V1-18, W9-14
- Found by: W9, V1
- Reach: Everyone who signs in or resets
- Evidence: observed
- Files:
  - apps/web/src/pages/Auth.tsx:290,300,354-356,416
- Acceptance:
  - An invalid reset link shows only the message and "Request a new link".
  - Sign-in button reads "Sign in".
  - Showing an error moves no field (y unchanged).
  - Forgot password? has a 32 px target.
- Needs product decision: no
- Dependencies/conflicts: None.

### C17 Activity section in the sidebar: filter form cannot be closed and the section squeezes the agent list (P2) [activity]
- Score 4.0; effort S; pass 1: new
- Root cause: Filter opens a four-field form that replaces the header, with no close (ActivityList.tsx:135, `showFilters || filtersOn`); Activity loads at 20 px then grows to about 250 px so the agent list shifts down to one visible row.
- Findings: W9-02, V3-09
- Found by: W9, V3
- Reach: Every user of Activity
- Evidence: observed; condition verified in code
- Files:
  - apps/web/src/pages/ActivityList.tsx:130-140
- Acceptance:
  - The Activity header and a Filter toggle stay visible with the form open; only a status select shows by default.
  - The section has a fixed max height with inner scroll and reserves height while loading (list y changes by 0 px).
- Needs product decision: no
- Dependencies/conflicts: Sidebar area of Shell.tsx; small.

### C18 Data room keeps polling a stuck file, Retry shows no change, and the failed file is announced three times (P1) [dr-processing]
- Score 3.0; effort M; pass 1: C5, C6
- Root cause: While any file is Reading, a 3 s timer dispatches DATA_ROOM_CHANGED (use-data-room-processing.ts:44-48), and DataRoom.tsx:277-278 and :208 reload the list, folders and facets on every tick (about 20 requests per 10 s); there is no limit after which a Reading job fails; retry() (DataRoom.tsx:407-415) toasts and reloads but never sets the row to Reading although its comment says it does; the strip repeats what the row already shows and is first in tab order. Verified in code.
- Findings: R1-01, R1-03, R1-07, W8-16, V3-05, FLOW-05, W8-08
- Found by: R1, W8, V3, FLOW
- Reach: Every Data room user with a slow or failed file
- Evidence: observed (resource timing, DOM) + verified in code
- Files:
  - apps/web/src/components/data-room/use-data-room-processing.ts:44-48 (poll only the processing endpoint; reload lists when its counts change; back off)
  - apps/web/src/pages/DataRoom.tsx:208,277-278 (reload listeners), :407-415 (optimistic Reading on retry)
  - apps/web/src/components/data-room/ProcessingStrip.tsx (nowrap counts, one failed link as a chip-style button, after the rows in tab order)
  - apps/api/src/data-room.ts (Reading job older than a limit becomes Failed)
  - apps/web/src/components/data-room/DropZone.tsx:45
- Acceptance:
  - With one file stuck in Reading, the Data room sends at most 1 request per 10 s over a 30 s resource-timing window.
  - A Reading job older than the limit becomes Failed with Try again (API test with a fake clock).
  - Clicking Try again shows Reading on the row within 100 ms and the row settles on the next poll.
  - At 375 and 1440 the strip counts do not wrap; the failed count appears once as a button.
  - From the search field, the first file row is reachable in 3 Tab presses or fewer.
- Needs product decision: no
- Dependencies/conflicts: DataRoom.tsx also in C19 and C32.

### C19 Data room list, search results and preview break at narrow widths and jump on load (P1) [dr-list]
- Score 3.0; effort M; pass 1: C5, C7, C30
- Root cause: Search-result rows put the name in a narrow cell and the snippet in the wide one (ItemRows.tsx:238-300, extra TableRow at ~338-360 with its own onClick), so at 390 px the name reads "MO CK" and a tap on the row text opens nothing; opening the preview narrows the list so every row restacks; the toolbar takes 340 px at 375; the list refetch drops to grey skeleton rows for 2-8 s; Import and Add files are still two header buttons; the zero-hit state has no Clear search. Observed; line numbers from the walker, not re-read.
- Findings: W8-10, W8-11, V3-06, V3-07, V3-12, R1-08, W8-07, R3-17
- Found by: W8, V3, R1, R3
- Reach: Every Data room user; phones most
- Evidence: observed (screenshots, DOM dialog count)
- Files:
  - apps/web/src/components/data-room/ItemRows.tsx:238-300,338-360
  - apps/web/src/components/data-room/Preview.tsx
  - apps/web/src/pages/DataRoom.tsx (header: Import into the Add files menu; empty-search state with Clear search; keep previous rows while refetching; filters behind one button at narrow width)
- Acceptance:
  - At 390 px a search result shows the full file name on its own line above the snippet, and a tap anywhere on the row opens the preview (dialog count 1).
  - Opening the preview does not change row layout (row heights before and after are equal).
  - At 375 the first file row starts above y=400.
  - Header has one add control (Add files with Import inside).
  - A zero-hit search shows "No results" with a Clear search button.
  - A filter change keeps the old rows visible until the new ones arrive (no skeleton flash under 1 s).
- Needs product decision: no
- Dependencies/conflicts: DataRoom.tsx shared with C18 and C32; land C18 first.

### C20 Cap table: layout flash while loading, donut card pushes the holders table below the fold, sticky header leaks (P1) [cap]
- Score 3.0; effort M; pass 1: C11, C27
- Root cause: CapTable renders the contacts-only layout until the connection check resolves (CapTable.tsx:300-320,641; observed 0.5 s); the donut card height comes from frameH (OwnershipDonut.tsx:259,353) and leaves a ~200 px empty band; the sticky header (CapTable.tsx:79 `sticky top-0`) sits about 35 px below the panel top so rows show above it; the All tab lists 14 contacts with no shares; the Option pool legend row is focusable with no action. Observed; frameH and STICKY verified in code, loading cause suspected.
- Findings: R1-02, R3-05, V3-02, FLOW-04, W9-06, V3-03, V3-04, W9-17, R1-11
- Found by: R1, R3, V3, FLOW, W9
- Reach: Every cap table visit (raise journey)
- Evidence: observed (screenshots, 100 ms timeline)
- Files:
  - apps/web/src/pages/CapTable.tsx:300-320,641 (skeleton until the check resolves), :79 (sticky offset), default tab
  - apps/web/src/components/cap-table/OwnershipDonut.tsx:259,349-353 (size the card to its content; compact layout below ~700 px container width)
  - apps/web/src/components/cap-table/*.stories.tsx
- Acceptance:
  - A 100 ms timeline from navigation shows a skeleton and then the cap table layout; the contacts-only layout never appears for a Carta-connected space.
  - At 1440x900 with the agent panel open, the holders table header is above y=700.
  - After scrolling 300 px the column header is at the panel's top edge and no row is visible above it.
  - Table rows are 44 px.
  - Default tab lists holders; non-holders sit under their own tab.
  - Option pool legend row is a button or not focusable.
- Needs product decision: no
- Dependencies/conflicts: None; CapTable.tsx is not touched by other clusters.

### C21 Approval cards: money sends show no recipient or account, "tool" jargon, focus lost, wait state unmarked (P1) [approval]
- Score 3.0; effort M; pass 1: C3, UXV-4
- Root cause: describeApprovalAction yields "Mercury: Request send money -> $1,200.00" (approval-ask.test.ts:18-55 pins it) with no recipient or account and a Details block that still holds the raw `mcp__` id; AskCard.tsx:60 labels the standing grant "Always allow this tool" at the same size as Allow once; after answering, focus falls to a checkbox in the right panel; the sidebar row for a pending question shows plain preview text; answered wording differs between cards (AskCard.tsx:25 vs :28). No live approval could be produced (demo model refuses payments), so the title cause is read from the unit test.
- Findings: R1-04, V2-03, V2-04, V2-05, V2-18
- Found by: R1, V2
- Reach: Every bot that asks before writing or paying
- Evidence: suspected for R1-04 (unit test only); observed for the rest
- Files:
  - packages/adapters/src/approval-ask.ts (describeApprovalAction: resolve recipient and account names for known money tools)
  - packages/adapters/src/approval-ask.test.ts:18-55
  - apps/web/src/components/AskCard.tsx:25-28,60,142 (labels, secondary action, role=group, focus to composer, before/after values)
  - apps/web/src/pages/Shell.tsx sidebar row status ("Needs your answer", blue, unread dot)
- Acceptance:
  - Mercury send-money title reads "Send $1,200.00 to <recipient> from <account>" (unit test with fixtures; unresolved names fall back to words, never ids); raw tool id appears only under Details.
  - "Always allow this" is a secondary text-weight action with a one-line consequence; Allow once and Deny stay primary.
  - After answering, document.activeElement is the composer; the card is role=group labelled by its question.
  - A sidebar row with a pending question shows "Needs your answer" in the blue treatment.
  - Answered cards use one wording family (Approved, Denied, Always allowed).
  - A Storybook story covers money, MCP, connector and built-in tool cards.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx row status touches the same area as C6; do after C6.

### C22 Inbox agent and Ask-agent on a thread cannot see the mail the page shows (P1) [mail-agent]
- Score 3.0; effort L; pass 1: C14 (criteria not met)
- Root cause: Observed in three sessions: the Inbox agent reports 0 messages or other threads than the page lists and says it cannot find the MSA thread that sits in Founder mail; the thread chat shows an "Email thread, 7 messages" chip but the bot asks the user to paste it. Cause not located: either the agent's mail tools read a different mailbox than the cached list the page uses, the thread text is not in the first model message, or the demo Gmail emulator seed differs. The pass-1 cluster C14 shipped but its criteria still fail.
- Findings: R2-01, R2-02, W8-01, W9-05
- Found by: R2, W8, W9
- Reach: Every Inbox agent and Ask agent user; also blocks 7 approval stories from being walked
- Evidence: observed symptom; cause suspected (may be partly the demo seed)
- Files:
  - packages/adapters/src/builtin-tools.ts (mail tools) vs apps/api/src/inbox.ts cached list
  - apps/api/src/inbox-agent.ts, apps/api/src/inbox-thread-agent.ts (thread text into the first model message)
  - demo Gmail emulator seed (one pending mail_send approval card; a needs-reply thread set that matches the page)
- Acceptance:
  - "What needs my reply today?" returns exactly the threads in the page's Needs reply group (test over the demo seed).
  - Ask agent on the MSA thread summarises it; the thread text is asserted in the first model request (unit test).
  - "Reply to Morgan about the MSA: Thursday works" produces a mail approval card in the demo.
  - The demo seed holds one pending mail_send card so INB-020, 023, 028, 035, 036 can be walked.
- Needs product decision: no
- Dependencies/conflicts: Investigate first (one hour): decide whether the defect is product code or the demo seed. No file overlap with web clusters.

### C23 Inbox chrome: digest state invisible, Archive all unlabeled, header wraps with Ask open, banner touches tabs, long attachment states (P2) [inbox-chrome]
- Score 3.0; effort M; pass 1: C25, C26
- Root cause: Digest toggle has aria-pressed but no visual state and no URL param; Archive all is a 28 px icon (InboxDigest.tsx:53); the Inbox header wraps and loses Ask under about 700 px; the consent banner has 0 px gap under the tabs and the sticky header is not opaque to its top edge (-mt-2 pt-2); attachment chip is cut at max-w-56 (MailAttachments.tsx:382); "Too large to preview" is one grey line in a full-height panel (MailAttachments.tsx:195-201); the reply-in-thread preview includes the quoted original.
- Findings: V2-08, V2-09, R2-09, V2-22, R2-12, R3-16, V2-19, R2-16, W8-12
- Found by: V2, R2, R3, W8
- Reach: Every Inbox user
- Evidence: observed
- Files:
  - apps/web/src/pages/Inbox.tsx (header at narrow pane, banner spacing, sticky background)
  - apps/web/src/components/inbox/InboxDigest.tsx:53 (label "Archive all N", Undo toast, digest=1 in URL, pressed style)
  - apps/web/src/components/inbox/MailAttachments.tsx:195-201,382
  - apps/web/src/components/inbox/InboxMessageDialog.tsx (trim quoted text in earlier-message line)
- Acceptance:
  - With the Ask panel open the header is one row and Ask stays visible.
  - Banner has at least 8 px gap under the tabs; no row is visible above the sticky header when scrolled.
  - Digest pressed state is visible and Back returns to the list.
  - Archive all shows its count and an Undo toast.
  - Attachment chip keeps the extension; too-large state shows name, size and Download.
  - Sent-reply preview stops before "On ... wrote:".
- Needs product decision: no
- Dependencies/conflicts: Inbox.tsx shared with C11.

### C24 Hide amounts masks runway, percentages and whole documents inconsistently (P2) [hide]
- Score 2.0; effort M; pass 1: C36
- Root cause: mask-currency.ts:66-90 masks runway months and run-out dates only in sentences it classifies as runway; the Finance card, Runway page and chat card show 24.2 mo while the pin shows "••• mo"; chat masks ownership percentages while the Cap table page shows them by design; the Data room preview is replaced entirely by "Hidden while amounts are hidden" (Preview.tsx). There is no rule that says what counts as an amount.
- Findings: W7-01, W9-08, W7-09, W8-14
- Found by: W7, W9, W8
- Reach: Every user who shares their screen with amounts hidden
- Evidence: observed; mask-currency.ts lines verified in code
- Files:
  - packages/chat-ui/src/mask-currency.ts:64-90
  - apps/web/src/lib/hide-amounts-preference.ts:124 (maskPinFigures)
  - apps/web/src/pages/finance/FinanceBurn.tsx, Finance cards
  - apps/web/src/components/data-room/Preview.tsx, ItemDialogs.tsx (offer Show this file or mask only images)
- Acceptance:
  - One rule, written in a shared constant, decides whether runway months, run-out date and ownership percentages are masked; cards, pins, chat text, Runway page and dashboard all follow it (test table over the surfaces).
  - A masked Data room text PDF is readable or has a one-click Show for this file.
- Needs product decision: yes. With Hide amounts on, which of these are hidden: money only (recommended), money plus runway months and date, or money plus ownership percentages in chat? And may a text document preview stay readable?
- Dependencies/conflicts: Pass-1 decision (Hide amounts only in the account menu) stands; no header chip is raised here.

### C25 Legal page: wrapped table cells, unemphasised Overdue, mobile order, failed load hides the header (P2) [legal]
- Score 2.0; effort M; pass 1: C39
- Root cause: LegalContracts lets Term and Renewal wrap and has no column gap between right-aligned Value and left-aligned Next deadline; the Overdue tile uses the neutral style; Active repeats Contracts; at 375 the banner and 2x2 tiles push the first contract to y=510-528; an error replaces the whole page (ErrorNotice early return); "4 documents not yet checked" links to the unfiltered Data room; PageAgentKind has no legal kind so the Legal agent has no starter questions (PageAgentIntro.tsx:5, verified).
- Findings: V2-13, V2-14, W7-11, V2-15, R3-08, V2-26, W7-12, W7-13, W7-21, W7-08, W9-16, FLOW-13
- Found by: V2, W7, R3, W9, FLOW
- Reach: Every Legal page visit
- Evidence: observed; PageAgentKind verified in code
- Files:
  - apps/web/src/pages/Legal.tsx:136,241-253
  - apps/web/src/pages/legal/LegalContracts.tsx
  - apps/web/src/pages/legal/LegalDeadlines.tsx
  - apps/web/src/components/PageAgentIntro.tsx:5 (add legal kind with three starter questions)
- Acceptance:
  - Contracts rows have equal height at 1440 (0 wrapped Term/Renewal cells); Value and Next deadline have at least 16 px gap.
  - Overdue tile uses the destructive color when above 0; Active tile is dropped unless it differs from Contracts.
  - At 375 the first contract title is above y=500.
  - A failed load keeps the page header and shows the error under it.
  - The unchecked-documents link opens a Data room view filtered to those files.
  - Dismiss has a tooltip; the header caption wraps or has a title; the Legal agent opens with starter questions.
- Needs product decision: no
- Dependencies/conflicts: Legal.tsx also in C4 (header).

### C26 Finance overview is 1693 px tall with header chrome, a lone tile and a duplicate figure strip in the agent chat (P2) [fin-layout]
- Score 2.0; effort M; pass 1: C29
- Root cause: Overview stacks KPIs, chart, tables and a lone Treasury yield tile (Finance.tsx:949); the header shows five status items (sync, refresh, non-USD note, two chips) that duplicate Apps; with the Ask panel open the non-USD note wraps; the Finance agent chat repeats Cash and Runway in a pinned strip and an inline card; "overlaps" is explained only by hover.
- Findings: V2-10, R3-11, V2-20, W7-14, V2-21, V2-16, V2-25, FLOW-10
- Found by: V2, R3, W7, FLOW
- Reach: Every Finance visit
- Evidence: observed
- Files:
  - apps/web/src/pages/Finance.tsx:931-960 and header
  - apps/web/src/components/finance (burn By account card, runway glossary)
  - page-agent canvas header for the pinned strip
- Acceptance:
  - Treasury yield sits in the KPI row; overview height under 1300 px at 1440x900.
  - Header status is one control ("Mercury, Brex, synced just now") and does not wrap with the Ask panel open.
  - The "overlaps" badge names the other subscription.
  - The agent chat shows Cash and Runway once.
  - Runway glossary removed or moved to hover.
- Needs product decision: no
- Dependencies/conflicts: Finance.tsx shared with C10; do C10 first.

### C27 Apps page: search hides connected apps, filter chip persists, cards differ, header scrolls away (P2) [apps-page]
- Score 2.0; effort M; pass 1: C10, C22
- Root cause: IntegrationsHome hides connected apps whenever a query exists (:407,:702) so a just-connected app yields "No apps match"; the category chip is not reset on re-entry; connected cards differ in anatomy (Coinbase "Replace key / Open", Blockscout menu); iMessage and several apps show a broken or single-letter logo (IMessageSection.tsx:199 logo null); the page title is inline at y=34 instead of the shared header bar; the sidebar pill still says "Connect apps" and iMessage cards say "(Photon)"/"(BlueBubbles)". Pass-1 chose the name Apps.
- Findings: W9-04, R1-13, V1-12, V1-13, V1-14, V1-15, W9-15, R2-13
- Found by: W9, R1, V1, R2
- Reach: Every app-connect decision
- Evidence: observed; :407 and :702 verified in code
- Files:
  - apps/web/src/components/integrations/IntegrationsHome.tsx:407,702,797
  - apps/web/src/components/integrations/IMessageSection.tsx:199
  - apps/web/src/components/ConnectAppsButton.tsx (pill label)
  - apps/web/src/pages/Integrations.tsx
- Acceptance:
  - Searching a connected app ("gmail", or an app just connected) lists it with its Connected tag.
  - Re-entering Apps resets the category chip.
  - Every connected card has icon, name, description, status, one primary button and one overflow menu; Coinbase's action reads "Open Finance".
  - No card shows a broken glyph.
  - Sidebar pill, page title and URL label all say Apps; iMessage cards drop the provider names from titles.
  - Page title sits on the shared 56 px header bar.
- Needs product decision: no
- Dependencies/conflicts: IntegrationsHome.tsx only.

### C28 Setup page opens outside the shell; Call Elio's reason is hidden behind the modal (P2) [setup-pages]
- Score 2.0; effort S; pass 1: C24
- Root cause: The /integrations/setup route is declared outside the shell routes (App.tsx:184-192), so it has no sidebar or header; the message "Connect a voice provider to call Elio." is set as a composer error while Voice settings opens over it (Shell.tsx:2466).
- Findings: R2-04, R2-05
- Found by: R2
- Reach: Admins setting up integrations; users calling Elio
- Evidence: observed; App.tsx lines verified
- Files:
  - apps/web/src/App.tsx:184-192
  - apps/web/src/pages/Shell.tsx:2466 and the Voice settings pane
- Acceptance:
  - /integrations/setup renders inside the shell with the sidebar.
  - Voice settings opened from Call Elio shows the reason at the top of the pane.
- Needs product decision: no
- Dependencies/conflicts: None.

### C29 Settings polish: uneven gaps, delete-account form below the fold, two control styles, mobile tab strip, flashes of empty states (P2) [settings]
- Score 2.0; effort M; pass 1: C17, C18
- Root cause: Privacy switches use gap-3 then a separate mt-5 block (ApprovalRulesSettings.tsx:127-150); the Delete account form expands below the visible area and leaves two buttons with one name (AccountAccess.tsx:87,205); Appearance and Sidebar density use different controls (AccountSettingsOverlay.tsx:171-185); the mobile tab strip is cut with no hint; Models shows "No providers found." for ~100 ms (ModelSettingsOverlay.tsx:1306-1316) and loading lines twice.
- Findings: V1-04, V1-07, V1-21, V1-25, R2-10, V1-16
- Found by: V1, R2
- Reach: Every Settings visit
- Evidence: observed; line numbers from walkers
- Files:
  - apps/web/src/components/ApprovalRulesSettings.tsx:127-150
  - apps/web/src/components/AccountAccess.tsx:87,205
  - apps/web/src/pages/AccountSettingsOverlay.tsx:171-185
  - apps/web/src/pages/ModelSettingsOverlay.tsx:1194,1306-1316,1565
- Acceptance:
  - The three privacy switches have one equal gap (measured).
  - Expanding Delete account scrolls the form into view and leaves one confirm button.
  - Appearance and Sidebar density use the same segmented control; density hidden below the drawer breakpoint.
  - Mobile tab strip shows an edge fade.
  - Models never shows "No providers found." before the first fetch ends (100 ms polling over 1 s).
  - One loading line; stable dialog height.
- Needs product decision: no
- Dependencies/conflicts: None.

### C30 Artifacts: CSV opens as a raw sheet, extension in viewer title, same icon and author on every card (P2) [artifacts]
- Score 2.0; effort S; pass 1: C35
- Root cause: The CSV viewer treats the header row as data with column letters and unformatted numbers; the viewer title keeps ".md" while cards drop it; MD and CSV cards share one icon plus a badge; every card shows the same author; HTML artifacts render as a white slab.
- Findings: V2-17, R3-09, V2-23, V3-15
- Found by: V2, R3, V3
- Reach: Artifact users
- Evidence: observed
- Files:
  - apps/web/src/pages/Artifacts.tsx (viewer title)
  - artifact CSV viewer (not located)
  - apps/web/src/components/ArtifactFileCard.tsx
- Acceptance:
  - CSV viewer shows the first row as header, humanised names and thousands separators.
  - Viewer title has no extension.
  - Author shows only when more than one bot produced artifacts.
- Needs product decision: no
- Dependencies/conflicts: None.

### C31 Routine editor: zone is a bare label on an existing routine; empty instruction is saved as "Check in." (P2) [routine]
- Score 2.0; effort S; pass 1: C4, C31
- Root cause: The zone is displayed but not editable on an existing routine and Advanced holds only Model (RoutineEditor.tsx); Save accepts an empty Instruction and stores a default; no Saved confirmation.
- Findings: R1-06, R3-12
- Found by: R1, R3
- Reach: Routine users
- Evidence: observed
- Files:
  - apps/web/src/pages/RoutineEditor.tsx
- Acceptance:
  - An existing routine's zone is a select (or text says it is fixed and why).
  - Empty Instruction is rejected or shown as optional with the stored default visible.
  - Save shows Saved for 2 s.
- Needs product decision: no
- Dependencies/conflicts: None.

### C32 Auto-sort review is a flat list of 60 moves; unfiled typed files get "Already tidy"; Send to agent is a flat list (P2) [dr-autosort]
- Score 1.0; effort M; pass 1: C30
- Root cause: AutoSortDialog lists every operation in one Move group, including in-folder moves, with a bare Apply (AutoSortDialog.tsx:110,247); with no matching folders it says "Already tidy." though typed files sit in the root (:210); SendToAgentMenu lists 11 agents and threads flat; Base UI warns about uncontrolled defaultValue (ItemDialogs.tsx:53,137,317; FilterBar.tsx:156,166); the Sources card is mostly empty.
- Findings: R3-01, W8-06, W8-15, W8-17, V3-14
- Found by: R3, W8, V3
- Reach: Users who sort or send documents
- Evidence: observed
- Files:
  - apps/web/src/components/data-room/AutoSortDialog.tsx:110,210,247
  - apps/web/src/components/data-room/SendToAgent.tsx
  - apps/web/src/components/data-room/ItemDialogs.tsx:53,137,317
  - apps/web/src/components/data-room/FilterBar.tsx:156,166
  - apps/web/src/components/data-room/DataRoomStats.tsx
- Acceptance:
  - Review groups moves by destination, ticks only loose items, and the button reads "Apply N moves".
  - With no destination folders the dialog says to create one first, or proposes folders.
  - Send to agent lists page agents first (Data room, Legal, Finance, Chief).
  - Console shows no Base UI uncontrolled warning when opening rename, move or date filter.
  - Sources card is sized to its content.
- Needs product decision: no
- Dependencies/conflicts: Land after C18 and C19 (same page).

## Deferred, decided and dropped items

- V1-06: Updates tab (one sentence) and Usage (one line) fill a 760 px dialog; pass-1 asked whether to drop them. Product decision.
- V1-10, V1-11: Pages rows 50 px (compact density exists); Finance badge "24 mo" has no noun. Polish, P3.
- V1-26: Timestamp formats differ (Yesterday vs Oct 19, 10:49 PM): one relative-date formatter, P3.
- V2-27: No attachment indicator in Inbox rows: known and not taken in pass 1 (the cache has no attachment field).
- FLOW-09: Merge the Inbox account row into the search menu: needs a decision; spacing part is in the inbox-chrome cluster.
- FLOW-03: Attachment checkbox belongs in the Data room, not Settings: product decision on placement.
- FLOW-12: Time zone and notification switches live in several places: suspected, desktop parts not seen.
- W7-02, W9-09: No "Amounts hidden" chip and no eye on pages: decided in pass 1 (C36, account menu only). Not re-raised.
- W7-18, W7-19, W7-22, W7-20: Count crypto has no saving label; "No receipt" has no next step; plain CSV error is unhelpful; arrow keys in the account menu (suspected tool effect). P3.
- W8-02, W8-13: Search hint only in a tooltip; MB label uses binary units. P3.
- W8-18, W9-13: Catalog drift (docs/ux-paths/catalog.md): refresh INB-002/004/006/008, APP-008/128/140/132/187/106, CAP-021, FIN-024/030/031/036, LEG-001..007 before the next walk. No code.
- R1-14: Sidebar shows section groups after opening Computer and routines: not investigated by the walker; covered by the sidebar cluster once it lands.
- R2-14, V2-12, V3-16: Cold-load and Legal Graph slowness (14 s, 25 s): measured under load average 20-70; re-measure on an idle host before acting.
- V2-23: White HTML artifact slab: probably unavoidable for sandboxed HTML; kept as a note in the artifacts cluster only.
- R3-15: DROPPED. One-character-wide Chief message: V2 and W9 both traced the same symptom to the walkers' own typing (newline per character); it renders normally after reload.
- Contrast reports: DROPPED. The audit script's 1.2-1.4 contrast ratios on sidebar and body text were checked visually by V1, V2 and V3 and are a false positive from transparent backgrounds.

## BLOCKED and SKIPPED stories (need a different setup)

- R1 (C-numbers in the R1 and R3 lines are pass-1 ids): C3 allow-changes dialog (no Mercury agent section on the demo); C3 denied/waiting step duration (demo model refuses payments, no live approval); C34 touch targets on coarse pointers (agent-browser cannot emulate); C38 slow-bootstrap Retry screen (cannot force a slow bootstrap).
- R2: real Gmail/Calendar Authorize (OAuth); "Input validation failed" error path (would send fake credentials to a third party); onboarding model step (demo has a default model).
- R3: C34 and C38 as above; C37 rail dots and hidden-pages flash; C30 Sort/Undo count equality; C36 Hide amounts on the Legal header.
- W7: FIN-001, 019, 021 (empty space, bank OAuth, statements); LEG-001, 002, 003, 005, 013, 016, 017, 018, 023, 029 (demo OpenRouter key rejected by the Legal scan with 401, no empty state); FIN-017 skipped (no statement-due banner).
- W8: INB-029 (needs SEND-FAIL seed), INB-037 (cannot deliver mail), INB-020, 023, 028, 035, 036 (no pending mail approval card, see mail-agent cluster), DRM-032 (model set), DRM-041 (retired). DRM-022 Share is a known product gap.
- W9 (109 stories): 21 BLOCKED (APP-004, 102, 104, 113-115 billing/SSO/email verification off; APP-126 notifications; APP-152 microphone; APP-176, 178-180 real OAuth; APP-189 voice key; APP-139 owner-only update; CAP-003, 004, 005 real Carta) and 46 SKIPPED (shared-data risk or 14-31 step flows: APP-025, 210 and others). APP-023 Members is a known gap.
- V1/V2/V3: real OAuth sign-ins, Import from Email or Box, native file picker uploads, Archive/Skip inbox/Archive all/Dismiss clicks (shared mailbox), Cmd+K and preview at 375, Activity at 375.
- Never walked in a browser: native mobile (Expo/iOS), Electron desktop, real Gmail Pub/Sub push.

## Counts

- Raw findings parsed from the walkers, flow and visual files: 187. P0 0, P1 17, P2 80, P3 90.
- Clusters: 32. By severity (max of members): P0 0, P1 10, P2 22, P3 0.
- Clusters needing a product decision: 4 (C3, C4, C15, C24).
- Findings placed in a cluster: 164; deferred, decided or dropped: 24.
- Clusters resting on a suspected cause: mail-agent (investigate first), approval (title cause), cap (loading cause), inbox-clean (contacts query), chief-runway (location).
