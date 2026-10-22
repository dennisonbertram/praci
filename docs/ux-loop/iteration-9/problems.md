P0: 0, P1: 3, P2: 20, P3: 10

# Iteration 9 problems: fix clusters

Sources: R1-R3 (verify pass-8 clusters C1-C26), J1-J3 (journeys), FLOW, V1-V3, on the mock demo stack (checkout 60e1f6076). Read: docs/ux-flow/report.md, docs/ux-visual/problems.md, iteration 1-8 problems.md. Owner decisions respected and not raised: tour stays nine stops; Devin hidden until connected; the page is called Integrations and lives in the account menu, and the sidebar and drawer keep the Integrations row; consent asked once per area; 44 px on coarse pointers; Hide amounts is a stable checkbox row in the account menu; Settings in five sections; palette is the one search surface; Legal row actions Ask agent / Done / Dismiss; Investors rows open Edit contact and the tab names stay; Skip tour leaves an Ask Chief chip; approval toasts persist until dismissed; no model step in onboarding on the demo; Personal and New space hidden for a solo account; Memory under Advanced.

Environment: shared mock founder account and a busy stack; several findings could be interference from other walkers and are marked. The owner said another session owns Investors and Fundraising, so C7, C8 and C23 are input for that session, not for this loop's branch.

## Pass-8 clusters verified (R1-R3)
Met: C3 (Inbox on a phone), C4 (docked tables), C13 (Legal names), C15 (phone drawer), C17 (Digest, with a P3 note), C21 (Data room small items, import strip unobserved), C23 (layout shifts), C24 (Artifacts age), C26 (Inbox details except search reason). Mostly met: C1 (Email agent), C8 (consent), C9 (tour), C14 (Finance, partly checked), C19 (Settings, partly checked), C22 (focus rings, chat buttons remain). Not met and reopened below: C2 -> C6, C5 -> C3/C15/C22, C6 -> C5, C7 -> C7, C10 -> C14, C11 -> C17/C18, C12 -> C1, C18 -> C8, C20 -> C25, C25 -> C10, C16 -> C23. C9 -> C26 (placement only).

## Clusters (ranked: P0, then P1, then severity x reach / effort)

### C1 Approval toasts sit over working controls on every page and stay after the approval is answered or already on screen (P1, rank 1, effort S)
- Root cause: The toast viewport is fixed at top-16 right-4 (28 rem wide) in packages/ui-web notification-toaster.tsx:296, which is where page headers, dialog close buttons and Ask/Start-a-round buttons are. Approval toasts persist by owner decision, so each one blocks that corner until dismissed. Nothing dismisses a toast when its approval is answered or when the user already has that chat open, and several can stack.
- Findings: V2-01, V2-02, J2-02, J3-04, R2-02, R2-03, R3-9-03, V1-05
- Found by: V2-01 [V2]; V2-02 [V2]; J2-02 [J2]; J3-04 [J3]; R2-02 [R2]; R2-03 [R2]; R3-9-03 [R3]; V1-05 [V1]
- Verification: Observed by 6 walkers across Inbox dialog, attachment preview, Finance, Legal, Fundraising, Data room, Settings close button and a phone email header (Close and Reply hidden). Code confirmed: notification-toaster.tsx:296 position; AppToaster.tsx wires delivery with no dismiss-on-resolve. J2 said 'no action button': R2 observed that tapping the toast opens the Mail approval card, so that part is wrong. Persistence is an iteration-8 decision and is kept.
- Files:
  - packages/ui-web/src/components/ui/notification-toaster.tsx (viewport position: bottom-right on desktop, above the composer on phones; collapse 2 or more approvals into one 'N need approval' toast)
  - apps/web/src/components/AppToaster.tsx and apps/web/src/lib/notification-delivery.ts (dismiss the toast when its approval is answered, or when the user opens the chat that holds it)
  - packages/ui-web/src/components/ui/notification-toaster.test.tsx and .stories.tsx (cover position and collapse)
- Reach: Everyone who uses an agent that asks for approval: the toast follows them to every page.
- Acceptance criteria:
  - At 1440x900 and 375x812 an approval toast overlaps no header control, dialog close button, or primary page button on Inbox, Finance, Legal, Data room, Fundraising, Settings and the email dialog (bounding-box test).
  - The toast stays until dismissed (decision kept) but is removed within 2 s of the approval being answered, and is not shown while that approval's chat is open.
  - Three pending approvals show one toast, not three.
  - Tapping the toast still opens the approval card in one tap.
- Needs product decision: false
- Depends on: none
- Conflicts with: none (only file group; C6 touches roster-status, not the toaster)
- Reopens: iteration 8 C12

### C2 In the light theme the Chief status card (Cash, Monthly burn, Runway) prints its labels in white on a light grey card (P1, rank 2, effort XS)
- Root cause: transcript.tsx:1731 hardcodes `text-white` on the label span inside a `bg-muted` card. In dark mode it is readable; in light mode the labels are close to invisible. It also breaks the repo rule against hardcoded colors.
- Findings: V1-01
- Found by: V1-01 [V1]
- Verification: Observed (computed color rgb(255,255,255) on the light card, screenshot). Code confirmed at apps/web/src/pages/shell/transcript.tsx:1731.
- Files:
  - apps/web/src/pages/shell/transcript.tsx:1731 (use text-foreground)
  - grep apps/web/src for other `text-white`/`bg-white` on muted or card surfaces and fix any found
  - add a story or test that renders this card with the light theme tokens
- Reach: Every light-theme user who asks Chief about money, the main question on the main page.
- Acceptance criteria:
  - Computed label color on the status card has contrast of at least 4.5:1 against its background in light and dark themes.
  - `grep -n 'text-white' apps/web/src/pages/shell/transcript.tsx` returns no match on a muted or card surface.
- Needs product decision: false
- Depends on: none
- Conflicts with: C17 (transcript.tsx, different lines)

### C3 Chief says 'no bank is connected' while Mercury is connected, and does not say who can pay (P1, rank 3, effort S)
- Root cause: NOT_CONNECTED_GUIDANCE (packages/adapters/src/executor.ts:8211) tells the model to say 'no bank is connected' if none is, and 'Allow changes sets up an agent' if one is connected without an agent, but the turn never gives Chief the facts (which finance integrations are connected, whether a finance agent exists). The model guesses, and in the demo it guesses wrong. Chief's earlier 'I can't see your cash' also stays in the thread after Mercury is connected.
- Findings: R1-01, V1-03, J1-06
- Found by: R1-01 [R1]; V1-03 [V1]; J1-06 [J1]
- Verification: Observed by 2 walkers (R1, V1) with screenshots: Chief reply vs Integrations page showing Mercury Connected and Finance 'synced just now'. Code confirmed: the guidance at executor.ts:8211 is conditional text with no connected-state input. Reason the model lacks a Mercury teammate in the demo is suspected, not traced.
- Files:
  - packages/adapters/src/executor.ts (userTurnInstructions: add one line listing connected finance integrations and whether a finance agent exists, built from server state, so the guidance branches on facts)
  - the API caller that builds Chief's turn instructions (find where userTurnInstructions is called under apps/api) to supply that state
  - optional: post a one-line 'Mercury connected' note in Chief after a bank connects (J1-06)
- Reach: Anyone who asks Chief to pay or check a bank after connecting one: they are told to repeat a step they already did.
- Acceptance criteria:
  - With Mercury connected and no agent, Chief's reply names Allow changes on the Mercury page, not 'connect Mercury'.
  - With Mercury connected and an agent, Chief hands the request to that agent (a message_bot call appears) instead of refusing.
  - With nothing connected, Chief still says to connect one under Integrations.
  - Unit test over the generated instruction text for the three states (no bank / bank without agent / bank with agent).
- Needs product decision: false
- Depends on: none
- Conflicts with: none
- Reopens: iteration 8 C5

### C4 The Inbox list changes after it is visible: a To do card is inserted above the rows, and the Important tab shows unsorted mail as if final, so a tap can open the wrong message (P2, rank 4, effort S)
- Root cause: Rows are shown before sorting finishes; later sort passes insert the To do card (about 150-260 px) and regroup rows. First load waits for To do (Inbox.tsx:615-618), later passes do not. Before Allow, the pile tabs show with Important holding all mail. A stalled first sort needs a manual 'Try sorting again'.
- Findings: FLOW-05, J3-03, V2-08, J1-08, J1-01
- Found by: FLOW-05 [FLOW]; J3-03 [J3]; V2-08 [V2]; J1-08 [J1]; J1-01 [J1]
- Verification: Observed by 4 walkers (FLOW, J3, V2, J1); FLOW measured first row y=232 then y=381 and a click that opened nothing; J3 had a tap land on another message. Same jump was seen in iteration 8. Cause in Inbox.tsx is suspected from reading lines 615-618, not traced. J1-01 is one sample on demo model latency.
- Files:
  - apps/web/src/pages/Inbox.tsx (keep the 'Sorting your mail' skeleton until the first sort finishes; reserve the To do card's height or render it with the list; show later sort results as a 'New order' chip or apply them only when no row is hovered or focused; hide pile tabs until sorting is allowed; retry a stalled sort once automatically)
- Reach: Every user in the first minute after opening Inbox, and after each new sort.
- Acceptance criteria:
  - After the first paint with rows, no row moves more than 8 px vertically for 60 s without user input (position probe on the first 5 rows).
  - Before sorting is allowed, no Important/Updates/Newsletters tabs are shown.
  - A sort that stalls once retries itself once before showing 'taking longer than usual'.
  - At 375x812 a tap at a row's position within 10 s of load opens that row.
- Needs product decision: false
- Depends on: none
- Conflicts with: C20, C30 (Inbox.tsx)
- Reopens: iteration 8 FLOW-07 (not clustered)

### C5 Turning Activity on squeezes the Pages list to about 2.5 rows (1440) or removes every chat row (375); the sidebar keeps a dead band above the footer (P2, rank 5, effort S)
- Root cause: Shell.tsx:4391 caps the Pages group at `lg:max-h-[16vh]` when Activity is on (143 px), and on phones the Pages block plus Activity fill the drawer so chat rows start below the footer. Separately the roster scroller ends 36-75 px above the Integrations divider (whole-rows.ts margin) and groups like 'Needs you' and 'Email chats' sit below the fold. Activity can also show a 'Working' heading with no row.
- Findings: V3-01, R1-05, R1-06, V3-02, V2-06, V1-14
- Found by: V3-01 [V3]; R1-05 [R1]; R1-06 [R1]; V3-02 [V3]; V2-06 [V2]; V1-14 [V1]
- Verification: Observed by 4 walkers with measurements (Pages scroller client 143 of 374; chat rows at y=710 under footer at 700 at 375). Code confirmed: Shell.tsx:4391.
- Files:
  - apps/web/src/pages/Shell.tsx:4391 and :4347 area (Pages keeps its normal height; Activity takes the remaining space; on a phone collapse Pages while Activity is open or cap Activity at 3 rows)
  - apps/web/src/pages/shell/whole-rows.ts (let the scroller fill to the divider)
  - apps/web/src/pages/ActivityList.tsx (hide a heading with no rows)
- Reach: Anyone who opens Activity, and every user on a short laptop screen.
- Acceptance criteria:
  - 1440x900 with Activity open: all 8 Pages rows visible without scrolling the Pages block, and at least 5 chat rows visible.
  - 375x812 with Activity open: at least 3 chat rows visible without scrolling.
  - No heading renders without a row beneath it.
  - Roster scroller bottom is within 8 px of the footer divider.
- Needs product decision: false
- Depends on: none
- Conflicts with: C6 (ActivityList.tsx), C9, C10, C14, C28 (Shell.tsx)
- Reopens: iteration 8 C6

### C6 A payment approval waiting for the owner shows 'Working...' in the sidebar while Activity says 'Needs your answer'; the label is still defined in four files (P2, rank 6, effort S)
- Root cause: roster-status.ts maps only the `waiting_input` run status to 'Needs your answer' (lines 14-27, rosterHeldFor line 31). Mail approvals and questions now reach that status; the Mercury payment approval apparently holds the run in a different state, so the row stays 'Working...'. The same string is defined in roster-status.ts:26, PageAgentsRow.tsx:49, sidebar-glance.tsx:63, ActivityList.tsx:478, and 'Needs you' remains the Activity heading and group dot label.
- Findings: R1-02, R1-07
- Found by: R1-02 [R1]; R1-07 [R1]
- Verification: R1-02 observed over 30 s with screenshot; the status that a payment approval uses was not checked, so the mapping cause is suspected. roster-status.ts mapping confirmed by reading. Walker rated R1-02 P1; downgraded because mail approvals and questions are fixed, Activity lists the item correctly, and the toast announces it.
- Files:
  - apps/web/src/lib/roster-status.ts (map every run held on a tool approval to the held state; find the run status a payment approval produces under apps/api/src and packages/db)
  - apps/web/src/components/PageAgentsRow.tsx:49, apps/web/src/components/sidebar-glance.tsx:63, apps/web/src/pages/ActivityList.tsx:478, apps/web/src/pages/Shell.tsx:6883 (one exported label function; one name for the Activity heading and group dot)
- Reach: Anyone approving money or schedule changes through an agent.
- Acceptance criteria:
  - With a Mercury payment approval pending, the Mercury agent row reads 'Needs your answer' for the whole wait (no 'Working...').
  - `grep -rn "Needs your answer" apps/web/src` finds one definition; 'Needs you' no longer appears as a heading or dot label.
  - Unit test over roster-status for waiting_input and the approval-held status.
- Needs product decision: false
- Depends on: none
- Conflicts with: C5 (ActivityList.tsx, Shell.tsx)
- Reopens: iteration 8 C2

### C7 SAFEs are shown with different holders and totals on Investors, Fundraising and Legal; 'Equity raised' is a bare dash (P2, rank 7, effort M)
- Root cause: Investors renders SAFE rows in the cap table (Carta contacts: $350,000) and a separate 'SAFEs, if converted at cap' block from Mercury records ($300,000); Fundraising lists the Mercury SAFEs with 'Assign to contact' still offered; Legal lists a SAFE contract; Summary.raised deliberately excludes SAFE money (Investors.tsx:131) and shows a dash; the right column of the contacts list is an unlabeled dash. No page says which record it reads.
- Findings: FLOW-01, FLOW-02, J2-03, R1-08, V3-09
- Found by: FLOW-01 [FLOW]; FLOW-02 [FLOW]; J2-03 [J2]; R1-08 [R1]; V3-09 [V3]
- Verification: Observed by 4 walkers (FLOW, J2, R1, V3); numbers read from page text. Both sources are mock data, so a real account may agree; Mercury vs Carta sources differing is the structural cause. Walkers filed it P1 (J2, FLOW P2); P2 because the figures come from two different sources by design and the demo seeds them differently. The owner said another session owns Investors and Fundraising, so this cluster is input for that session.
- Files:
  - apps/web/src/pages/Investors.tsx (131 summary; SAFE rows and converted-at-cap block; contacts card near the end, row placeholders ~1368; header Add contact)
  - apps/web/src/pages/Fundraising.tsx:241-282 (say which record SAFEs come from; hide 'Assign to contact' when a contact already holds it)
  - apps/web/src/components/cap-table/ and the shared SAFE source used by both pages
- Reach: Founders raising on SAFEs, the common case.
- Acceptance criteria:
  - For one fixture, Investors and Fundraising list the same SAFE holders and the same total.
  - 'Equity raised' shows a number with a label (for example 'SAFEs $X') or a reason for no amount.
  - A person appears once on Investors; the right column of the contacts list has a header or no dash.
  - 'Assign to contact' is hidden for a SAFE that already has a contact.
- Needs product decision: true. Which page owns SAFE records: Fundraising (recommended; Investors shows only the converted percentage and links there) or Investors? Should Investors drop its contacts card in favour of a link to Contacts (recommended)?
- Depends on: none
- Conflicts with: C8 (Investors.tsx, Fundraising.tsx); another session owns these pages
- Reopens: iteration 8 C7

### C8 Empty Investors and Fundraising show static grey bars that read as a loading state that never ends, plus several ways to add the same thing; 'Draft reply' does not change when disabled (P2, rank 8, effort M)
- Root cause: Placeholders.tsx (fundraising and investors) render static grey skeleton rows 'so they read as nothing here yet'; on screen they read as loading, including next to real data. Empty Investors still offers Add contact, Ask, three source buttons, ghost stats and table, Updates and a Contacts tab strip. ActionItems.tsx:68-76 disables Draft reply while drafting but keeps the label. At 1920 the cap table stretches to 1810 px.
- Findings: FLOW-03, J2-01, V3-03, R2-05, R2-06, R2-07, V3-10, V3-08
- Found by: FLOW-03 [FLOW]; J2-01 [J2]; V3-03 [V3]; R2-05 [R2]; R2-06 [R2]; R2-07 [R2]; V3-10 [V3]; V3-08 [V3]
- Verification: Observed by 5 walkers (FLOW, J2, V3, R2); V3 checked that the updates call had already returned an empty list. Code confirmed for ActionItems.tsx:68-76. API-down case not tested. Owner said another session owns these pages.
- Files:
  - apps/web/src/components/fundraising/Placeholders.tsx and apps/web/src/components/investors/Placeholders.tsx (remove ghost bars; one plain empty line plus one action)
  - apps/web/src/pages/Fundraising.tsx:281, apps/web/src/pages/Investors.tsx:386,1147,1263,1368 (empty Investors: one 'Where is your cap table?' prompt until a source exists; hide Updates until there is one)
  - apps/web/src/components/investors/ActionItems.tsx:73-76 (label 'Drafting...' with spinner)
  - apps/web/src/components/cap-table/CapTableEditor.tsx:274 (cap the table width near 1100 px)
- Reach: Every new founder opening Investors or Fundraising; the founder with data sees ghost rows beside real rows.
- Acceptance criteria:
  - A fresh user sees one prompt and one primary action on Investors and on Fundraising; no grey placeholder rows.
  - A user with a SAFE and no round sees a one-line empty state for Round and Pipeline, not grey bars.
  - Clicking Draft reply changes the label to 'Drafting...' with a spinner until done.
  - At 1920 the cap table card is no wider than 1100 px.
- Needs product decision: false
- Depends on: none
- Conflicts with: C7 (Investors.tsx, Fundraising.tsx); another session owns these pages
- Reopens: iteration 8 C18

### C9 On a phone there is no visible way to Pin, Move, Archive, Delete or open Routines for a bot (P2, rank 9, effort XS)
- Root cause: Shell.tsx:5231 hides the row's 'Actions for X' button with `pointer-coarse:hidden`. The context menu (Shell.tsx:5069) is the only route; whether iOS Safari fires contextmenu on long press is not verified.
- Findings: V1-02
- Found by: V1-02 [V1]
- Verification: Observed under pointer: coarse in Playwright (the button resolves but is not visible; screenshot md-drawer.png). Code confirmed at Shell.tsx:5231. iOS long-press behavior is suspected, not tested on a device. Walker rated P1; bot management is not a core journey, so P2.
- Files:
  - apps/web/src/pages/Shell.tsx:5231 (show the button on coarse pointers at 44 px; keep long press)
- Reach: Phone users with more than a few bots.
- Acceptance criteria:
  - At 375x812 with touch emulation each roster row has a visible 'Actions for X' button with a hit area of at least 44 px that opens the same menu.
  - Row tap still opens the chat.
- Needs product decision: false
- Depends on: none
- Conflicts with: C5, C10, C14, C28 (Shell.tsx)

### C10 A single-space account still sees the 'PERSONAL' sidebar heading (with chevron and menu) and a 'Personal' chip on some pages (P2, rank 10, effort S)
- Root cause: The owner decision (iteration 8 C25) says Personal is hidden until a second space or member exists. 'New space' and the picker tag are gone, but sidebarGroupsForSpaces is still called with `t\`Personal\`` as soleSpaceTitle (Shell.tsx:1923; space-sidebar.ts:84-85 uses it when spaces.length is 1) and Shell.tsx:4713 shows the header when `group.title || hasSpaceActions`. The chip shows on Finance and Legal but not Investors, Data room or Contacts.
- Findings: J1-02, R3-9-01, V1-08, FLOW-06, R1-10
- Found by: J1-02 [J1]; R3-9-01 [R3]; V1-08 [V1]; FLOW-06 [FLOW]; R1-10 [R1]
- Verification: Observed by 5 walkers with screenshots; code confirmed at Shell.tsx:1923, Shell.tsx:4713, space-sidebar.ts:84.
- Files:
  - apps/web/src/pages/Shell.tsx:1923 and :4713 (no group title or space menu when there is one space and one member)
  - apps/web/src/pages/shell/space-sidebar.ts:84 (no sole-space title)
  - the Personal chip next to page titles on Finance and Legal (find with grep for the soleSpaceTitle consumer)
- Reach: Every solo founder from the first screen.
- Acceptance criteria:
  - A new one-space account shows no 'Personal' heading, chevron or menu in the sidebar and no 'Personal' chip on any page.
  - Adding a second space or member shows the heading again (unit test over sidebarGroupsForSpaces).
- Needs product decision: false
- Depends on: none
- Conflicts with: C5, C9, C14, C28 (Shell.tsx)
- Reopens: iteration 8 C25

### C11 Phone: tapping Search in the drawer opens the palette but the keyboard target is still the drawer's input; the page list is cut at seven rows (P2, rank 11, effort XS)
- Root cause: command-palette.tsx:396 uses `autoFocus` on the palette input, but the drawer's own Search input keeps focus (document.activeElement), so typing goes nowhere until the user taps again. The palette list hides Artifacts under the end of the list with no scroll cue.
- Findings: J3-01, V3-14
- Found by: J3-01 [J3]; V3-14 [V3]
- Verification: J3-01 observed with an activeElement check; V3-14 observed at 1440 and 375. Real on-screen keyboard behaviour cannot be seen in headless Chromium.
- Files:
  - apps/web/src/pages/shell/command-palette.tsx:396 (focus the input after mount, or close the drawer before opening)
  - apps/web/src/pages/Shell.tsx (drawer Search handler)
  - palette list max height (show all eight pages or add a bottom fade)
- Reach: Every phone user who starts with Search.
- Acceptance criteria:
  - At 375 with touch emulation, after tapping drawer Search, document.activeElement is the palette input.
  - The empty palette shows all eight pages or a visible scroll cue.
- Needs product decision: false
- Depends on: none
- Conflicts with: C5, C9 (Shell.tsx drawer)

### C12 Data room on a phone: Full screen preview gives the same small dialog, grid cards are 305 px tall, view toggles wrap onto their own row (P2, rank 12, effort S)
- Root cause: On phones the Full screen action enlarges nothing and the PDF stays page-width with 7 px text and no zoom (PreviewActions.tsx:142). Grid cards use a fixed thumbnail aspect (about 100 px of empty space above the name on text cards), and the list/grid/stats toggles wrap to their own row.
- Findings: J3-02, V3-05, J3-08
- Found by: J3-02 [J3]; V3-05 [V3]; J3-08 [J3]
- Verification: Observed at 375 by 2 walkers with screenshots (19-preview vs 20-expanded; dr-grid-375).
- Files:
  - apps/web/src/components/data-room/PreviewActions.tsx:142 and the preview dialog (full viewport on phones, fit width, native pinch zoom or open in the system viewer)
  - apps/web/src/components/data-room/ grid card (shorter thumbnail on phones; fit text cards)
  - data room page header (toggles in the same row or in the filters menu)
- Reach: Phone users reading a contract or checking files.
- Acceptance criteria:
  - At 375, Full screen fills the viewport and a PDF page can be zoomed to read 12 px text.
  - At 375 the grid shows at least 3 cards in 812 px of height, or phones default to the list view.
  - View toggles share the toolbar row with the folder control.
- Needs product decision: false
- Depends on: none
- Conflicts with: C29 (data-room components)

### C13 Bot settings panel: header scrolls away, Advanced group has no visual boundary, Audience 'External' is unexplained, skill form fields are inconsistent, routine schedule menu is detached (P2, rank 13, effort S)
- Root cause: bot-panel.tsx makes the whole 1378 px panel the scroller, so the title and close X scroll away (scrollTop 253 of 1378). Advanced children are not indented or boxed (12 px under the label vs 36 px between sections); Export is plain text; Disabled tools shows a grey 'Web search' that reads like a placeholder. Audience has no hint about External. The new-skill fields have mixed fills and placeholders; the schedule submenu opens detached from its parent item. Skill switches are 32x18 with an aria-label only.
- Findings: V1-04, V1-06, V1-07, V1-10, J2-14, J2-15
- Found by: V1-04 [V1]; V1-06 [V1]; V1-07 [V1]; V1-10 [V1]; J2-14 [J2]; J2-15 [J2]
- Verification: V1-04, V1-06, V1-07 observed with screenshots and a scroller probe (div.rk-scroll st=253 sh=1378); V1-10 measured under pointer: coarse; J3 measured the Settings switches as having a 44 px hit area, so only the skill and notification switches are in doubt.
- Files:
  - apps/web/src/pages/shell/bot-panel.tsx (sticky header; indent or border Advanced; Export as a link; Disabled tools as chips or 'None'; one line under Audience only after External is chosen)
  - apps/web/src/components/BotSkillsSection.tsx (switch and label in one 44 px row; consistent inputs and placeholders in the new skill form)
  - routine 'When to run' menu component (anchor submenu beside the parent item)
- Reach: Anyone who configures a bot.
- Acceptance criteria:
  - With Advanced expanded and the panel scrolled to the end, the close button is on screen (position probe).
  - Under pointer: coarse the skill and Notifications switches have a tappable row of at least 44 px height.
  - Choosing External shows one line naming the approval; Internal shows none.
  - The routine schedule submenu's left edge is within 8 px of its parent item's right edge.
- Needs product decision: false
- Depends on: none
- Conflicts with: C14 (Shell.tsx:5669 is separate; both touch the bot panel area), C1 (toast offset, no shared file)

### C14 Routines are hidden behind a monitor icon named 'Computer and routines'; a bot that never ran shows 'Computer is on' over a black box (P2, rank 14, effort S)
- Root cause: The routines entry opens the Computer panel (Shell.tsx:5669), whose header says 'Computer is on' with a large black preview even when no computer runs; Shell.tsx:3801 only hides the box when there is no screen URL. The routine form cannot pick a skill. In the demo the black box comes from a fake `fake://screen/` URL.
- Findings: J2-06, R1-13
- Found by: J2-06 [J2]; R1-13 [R1]
- Verification: J2-06 observed with screenshots. R1-13 is suspected to be a demo artifact (fake sandbox reports running with a fake screen); the real error and not-running states were not produced.
- Files:
  - apps/web/src/pages/Shell.tsx:5669 and :3801 (name the panel 'Routines' when no computer is in use; hide the preview until frames arrive; a 'Create a routine' text button instead of the bare +)
  - routine form (skill picker)
- Reach: Anyone who wants a scheduled task, a core 'bot' feature.
- Acceptance criteria:
  - For a bot with no running computer the panel title is 'Routines' and no black box is shown.
  - A text button 'Create a routine' is visible without hovering.
  - The routine form lists the bot's skills in a picker.
- Needs product decision: false
- Depends on: none
- Conflicts with: C5, C9, C10, C28 (Shell.tsx)
- Reopens: iteration 8 C10

### C15 Mercury integration page: one control would do before an agent exists, 'Create agent' shows when the agent exists, 'Reconnect' sits beside 'Disconnect' while healthy, and 'Used by' lists every per-email chat (P2, rank 15, effort S)
- Root cause: IntegrationAgentSection.tsx:33 renders the 'Allow changes' switch and a separate 'Create agent' button before any agent exists, and the layout jumps when the switch is turned on; line 126 lists each per-email chat in 'Used by'; AppDetail.tsx:129 always shows Reconnect and Disconnect sign-in.
- Findings: R1-04, J2-07, J2-16
- Found by: R1-04 [R1]; J2-07 [J2]; J2-16 [J2]
- Verification: Observed by 2 walkers (R1, J2) with screenshots; file lines from walker reading, not re-read here.
- Files:
  - apps/web/src/components/integrations/IntegrationAgentSection.tsx:33,126 (one control until an agent exists; fold per-email bots into one 'Email chats' row; reserve space for the second switch)
  - apps/web/src/components/integrations/AppDetail.tsx:129 (Reconnect under a menu while healthy)
- Reach: Every user who turns on bank writes.
- Acceptance criteria:
  - Before an agent exists the page shows exactly one setup control.
  - 'Create agent' is not shown once an agent exists.
  - Turning on Allow changes shifts no element above it (layout probe).
  - 'Used by' shows at most one row for all per-email chats.
- Needs product decision: false
- Depends on: none
- Conflicts with: none
- Reopens: iteration 8 C5

### C16 Legal page: no width cap at 1920, Parties clipped while Term has room, header link looks like plain text, 'Not scanned yet' contradicts 'Scanning...', first visit shows only a consent card (P2, rank 16, effort S)
- Root cause: Legal.tsx has no `mx-auto max-w-[1440px]` wrapper (Inbox.tsx:1198 and Finance.tsx:118 do), so its header jumps between pages at 1920. Contracts table column widths truncate Parties and wrap Contract (row heights 37-57 px). The '32 documents not yet checked' link has no link styling. Legal.tsx:240,332 show 'Not scanned yet' during a scan. Before Allow the page has no hint of the result.
- Findings: V2-04, V2-09, J2-13, V2-10, J1-07, J1-04
- Found by: V2-04 [V2]; V2-09 [V2]; J2-13 [J2]; V2-10 [V2]; J1-07 [J1]; J1-04 [J1]
- Verification: V2-04 confirmed in code (no max-w in Legal.tsx) and in screenshots; the rest observed by 2 to 3 walkers.
- Files:
  - apps/web/src/pages/Legal.tsx (centered 1440 wrapper; header link styling; hide 'Not scanned yet' while scanning; show empty Contracts and Deadlines tabs under the consent card)
  - Legal contracts table (Parties min width, Contract truncates with a title)
  - seed text: 'renews on December 1' vs row date Dec 2 (demo seed)
- Reach: All Legal users; the 1920 jump affects anyone on a large monitor.
- Acceptance criteria:
  - At 1920 the Legal title and table share left edge x with Inbox and Finance (within 2 px).
  - At 1440 no Parties value is truncated when the Term column has spare width; row heights differ by no more than 4 px.
  - While a scan runs the header does not say 'Not scanned yet'.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C17 Chat run rows show internal names and ids: 'Legal unreviewed documents 5.0s', 'Request send money', 'Task catalog', 'Mail sea...'; agent-to-agent message rows look like text but open an overlay with raw ids; a Working row stays under a pending Mail card (P2, rank 17, effort S)
- Root cause: Tool-step labels are not mapped to plain verb phrases for several tools (Task catalog, legal and Mercury tools); tool rows truncate to 'Mail sea...' with spare width; 'Message from X agent' rows have no button styling and the overlay prints audit request ids; the transcript shows 'Working... 1 tool' under a held Mail approval; agent text emails render in default link blue.
- Findings: R1-14, J1-12, J3-09, V2-07, R1-12, V2-14
- Found by: R1-14 [R1]; J1-12 [J1]; J3-09 [J3]; V2-07 [V2]; R1-12 [R1]; V2-14 [V2]
- Verification: Observed by 4 walkers with screenshots; the earlier cluster claimed raw tool names were gone (R2 saw none in Chief and Investor Relations), so coverage is partial. The label function location was not traced.
- Files:
  - tool-call row label function in apps/web/src/pages/shell/transcript.tsx (map tool names to plain labels; let the name use the full row)
  - the agent-to-agent message row and overlay component (button style with chevron; no ids in user-read copy)
  - apps/web/src/components/inbox/EmailAgentPanel.tsx (hide the working row while the run is held on an approval)
  - chat markdown link style (underlined foreground color)
- Reach: Everyone who reads an agent's work log.
- Acceptance criteria:
  - Unit test over the label function: no output contains an underscore, camelCase tool id or 'catalog'.
  - Tool rows at 375 show at least 18 characters before truncating.
  - A held Mail approval shows no 'Working...' row.
  - No visible chat text contains a message id or audit request id.
- Needs product decision: false
- Depends on: none
- Conflicts with: C2 (transcript.tsx, different lines), C18
- Reopens: iteration 8 C11

### C18 Free text typed while an ask card is open is sent as a normal message and leaves the card unanswered (P2, rank 18, effort S)
- Root cause: On a new user's Chief, the composer sends text through the normal path even when the 'What do you want me on first?' card is pending (thread-target.ts), so Chief replies and the card stays open.
- Findings: R2-01
- Found by: R2-01 [R2]
- Verification: Observed once by R2 with screenshots; thread-target.ts is the walker's suspicion, not traced. Pass-8 C11 asked for this and its criteria are unmet.
- Files:
  - apps/web/src/pages/shell/thread-target.ts and the composer submit path (route text to the pending ask's answer and mark it answered)
- Reach: Every new user at the first prompt.
- Acceptance criteria:
  - With one pending ask, typing text and sending answers the card once and creates no extra user bubble (component test).
  - With no pending ask, the composer behaves as before.
- Needs product decision: false
- Depends on: none
- Conflicts with: C17
- Reopens: iteration 8 C11

### C19 Hide amounts is stored per browser, so the next user to sign in sees every figure as '$•••' with no visible state (P2, rank 19, effort S)
- Root cause: hide-amounts-preference.ts:4-11 stores `rakazo.hideAmounts` in localStorage without a user key. After sign-out and sign-in as someone else, every figure is masked and nothing on the page says so.
- Findings: J1-03
- Found by: J1-03 [J1]
- Verification: Observed once by J1 (sign-out and in as another user). Code confirmed: storage key has no user component. Owner decision from iteration 8 fixes the label and the stable checkbox row in the account menu, so any indicator must respect that.
- Files:
  - apps/web/src/lib/hide-amounts-preference.ts (key by user id)
  - a small visible 'Amounts hidden' control on pages that show money
- Reach: Shared computers and anyone who signs in with a second account.
- Acceptance criteria:
  - Setting Hide amounts as user A and signing in as user B shows amounts for B.
  - When amounts are hidden, a visible control on Finance says so and turns it off in one click.
- Needs product decision: true. Is a small 'Amounts hidden' control on money pages acceptable next to the decided account-menu checkbox row (recommended), or should the per-user key alone fix this?
- Depends on: none
- Conflicts with: none

### C20 Inbox filter menu has two 'Updates' and two 'Newsletters'; each row has six tab stops; a search hit shows no reason; the compose icon is narrower than its siblings (P2, rank 20, effort S)
- Root cause: One filter menu holds 15 items in four groups, where Gmail's 'Updates' tab duplicates the page's Updates tab and 'Newsletters' is both a tab and a category. Each row exposes six tab stops (row, checkbox, Archive, Mark read, Mark important, Mark noise). Search results show badges but not the matched text. Toolbar icon widths are [36, 36, 28, Ask 69].
- Findings: V2-05, V2-11, R3-9-04, V3-15, J1-14
- Found by: V2-05 [V2]; V2-11 [V2]; R3-9-04 [R3]; V3-15 [V3]; J1-14 [J1]
- Verification: Observed by 3 walkers; V2-11 by Tab presses only (no screenshot); R3-9-04 and V3-15 are the same issue carried from iteration 8.
- Files:
  - apps/web/src/pages/Inbox.tsx (filter menu structure; compose icon 36 px box; search result row snippet with highlighted match)
  - the Inbox list row component (one tab stop per row, actions on focus)
- Reach: Every daily Inbox user.
- Acceptance criteria:
  - The filter menu uses each name once; fewer than 10 top-level items.
  - Pressing Tab from the list header reaches the 5th row in at most 5 presses.
  - A search result row shows a one-line snippet with the matched term marked.
  - All toolbar icon buttons are 36 px wide.
- Needs product decision: false
- Depends on: none
- Conflicts with: C4, C30 (Inbox.tsx)
- Reopens: iteration 8 C26 (search reason)

### C21 Finance: the page header scrolls away unlike Inbox; on a phone the space name is cut and 'Per month' wraps; burn bars are 22 px wide; the runway chart stops before the run-out date (P2, rank 21, effort S)
- Root cause: Finance.tsx:117-118 makes the scroller include the header (gone at scrollTop 413). Phone header row gives the sync status the space; Finance.tsx:955 'Per month' wraps; burn month columns are 22 px as tap targets; the Runway line ends at Sep 2028 at about $100k while the page says Nov 10, 2028. Upcoming expanding to 16 rows leaves a dead band beside Breakdown.
- Findings: V2-03, J3-05, J3-06, J3-07, V2-13, J1-10
- Found by: V2-03 [V2]; J3-05 [J3]; J3-06 [J3]; J3-07 [J3]; V2-13 [V2]; J1-10 [J1]
- Verification: V2-03 confirmed in code (Finance.tsx:117 scroller); others observed once with measurements. J1-10's chart range was not traced.
- Files:
  - apps/web/src/pages/Finance.tsx:117-118 (sticky header like Inbox), :955 ('Monthly' or nowrap), header row (status shrinks), cards aligned to start
  - burn chart (tap whole chart width or 44 px columns); Runway chart axis through the run-out date
  - Category page: drop the repeated Category column
- Reach: Every Finance user; the phone items affect the founder checking runway from a phone.
- Acceptance criteria:
  - Scrolling Finance 400 px keeps the title and Ask on screen.
  - At 375 the space name shows at least 12 characters and 'Per month' fits on one line.
  - The Runway chart's x axis ends on or after the run-out date.
  - Burn bar tap target at least 44 px under pointer: coarse.
- Needs product decision: false
- Depends on: none
- Conflicts with: none
- Reopens: iteration 8 C14

### C22 Payment approval card: the main button says 'Allow once' with no amount; Details starts with blank lines (P2, rank 22, effort XS)
- Root cause: AskCard.tsx:65 maps allow to 'Allow once' unless the card is a consent or share card; money cards have a headline with amount, payee and account but the button does not repeat it. The Details block has leading blank lines.
- Findings: R1-03, J3-11
- Found by: R1-03 [R1]; J3-11 [J3]
- Verification: R1-03 observed with screenshot and code confirmed at AskCard.tsx:65. J3-11 observed once.
- Files:
  - apps/web/src/components/AskCard.tsx (allow label 'Send $300.00' when the card carries an amount; trim leading blank lines in Details)
- Reach: Anyone approving a payment.
- Acceptance criteria:
  - A payment card's primary button reads 'Send $300.00' (amount from the card).
  - Non-money cards still read 'Allow once'.
  - Details text has no leading blank line (unit test).
- Needs product decision: false
- Depends on: none
- Conflicts with: none
- Reopens: iteration 8 C5

### C23 Storybook smoke fails on two Fundraising stories (P2, rank 23, effort XS)
- Root cause: `fundraising-mercurydialogs--assign-to-contact` and `fundraising-mercurydialogs--investor-email` render empty with no console error (apps/web/src/components/fundraising/MercuryDialogs.stories.tsx). 1692 of 1694 stories pass.
- Findings: R3-9-S
- Found by: R3-9-S [R3]
- Verification: Observed by R3 from a build of the main checkout. Cause not traced.
- Files:
  - apps/web/src/components/fundraising/MercuryDialogs.stories.tsx (open the dialogs in play or mount open; fix the missing state)
  - run `node .storybook/smoke.mjs` in apps/web
- Reach: CI and maintainers; the repo rule says every story must render.
- Acceptance criteria:
  - `node .storybook/smoke.mjs` in apps/web reports 0 failures.
  - `pnpm design-system:check` passes.
- Needs product decision: false
- Depends on: none
- Conflicts with: C7, C8 (Fundraising owner)
- Reopens: iteration 8 C16

### C24 Settings carries operator and rarely used items: Integration sign-in card, Models provider catalog, Voice as its own entry, mixed disclosure glyphs, uneven section padding (P3, rank 24, effort S)
- Root cause: AccountSettingsOverlay.tsx:249-265 shows 'Integration sign-in: ... everyone on this server' to every owner; Models lists seven providers, backup models and a search model although a model already works; Voice is a top-level entry that is only an API-key form; Models uses a filled triangle disclosure where the rest use a chevron; on a phone Models, Memory and Voice start 6 px under the divider while General starts 20 px.
- Findings: FLOW-07, FLOW-08, FLOW-09, V1-12, V1-13, V1-17, J3-10
- Found by: FLOW-07 [FLOW]; FLOW-08 [FLOW]; FLOW-09 [FLOW]; V1-12 [V1]; V1-13 [V1]; V1-17 [V1]; J3-10 [J3]
- Verification: Observed by 3 walkers (FLOW, V1, J3); all P3 and none blocks a journey.
- Files:
  - apps/web/src/pages/AccountSettingsOverlay.tsx:249-265 (move Integration sign-in to the Integrations overflow menu or show it after a failed connect)
  - apps/web/src/pages/ModelBackupsSettings.tsx:260 and the Models panel (one 'Use my own model' disclosure holding providers, backups, search model and Voice; 'Add a second provider to set backups')
  - Settings nav and disclosure components (one glyph, one active-row width, one top padding)
- Reach: All users who open Settings, once.
- Acceptance criteria:
  - Settings nav has General, Privacy and approvals, Models, Advanced (Voice folded into Models).
  - A fresh founder on a system model sees one line and one 'Use my own model' action on Models.
  - Disclosures use one glyph; section tops are within 2 px of each other at 375.
- Needs product decision: true. Fold Voice into Models and hide 'Integration sign-in' from the General tab (recommended)? Iteration 8 fixed Settings in five sections, so this changes a decided structure.
- Depends on: none
- Conflicts with: C19 (no shared file)

### C25 Integrations home: filter chips are a different list from the section headings, the page is 80 px taller than target at 375, card actions sit at different edges, two iMessage cards have no difference line (P3, rank 25, effort XS)
- Root cause: IntegrationsHome.tsx chips (All, Email & calendar, Chat, Docs & files, Finance, Developer) differ from section headings (Connected, Popular, Finance, Social, Tools, Anything else); connected cards put 'Open X' mid-card while popular cards right-align 'Connect'; logos mix real marks and letter tiles.
- Findings: R2-08, R2-09, V1-15
- Found by: R2-08 [R2]; R2-09 [R2]; V1-15 [V1]
- Verification: Observed by 2 walkers; the 375 height target was measured against a demo with 6 connected apps, so the comparison is approximate.
- Files:
  - apps/web/src/components/integrations/IntegrationsHome.tsx (derive chips from the section headings; align card actions to one edge; one-line difference for the two iMessage cards; tighter connected card on phones)
- Reach: Anyone opening Integrations.
- Acceptance criteria:
  - Every chip equals a section heading (test over the two lists).
  - Card action buttons share a right edge within 2 px.
  - At 375 the page height is within 5 percent of the iteration-7 value (1,610 px) for the same connected count.
- Needs product decision: false
- Depends on: none
- Conflicts with: none
- Reopens: iteration 8 C20

### C26 First-run tour popovers cover the page title at stop 1, chat text at stops 4-7, and the composer at stops 8-9; step 8 text is wrong after Gmail is connected (P3, rank 26, effort S)
- Root cause: TourPopover.tsx:150-160 places the card by anchor, so on page routes it sits over the title and over the content beside the highlighted row; the Integrations stop says 'Connect Gmail, Calendar and more' even when Gmail is connected (FirstRunTour.tsx:68).
- Findings: R1-09, FLOW-04, V1-11, J1-09
- Found by: R1-09 [R1]; FLOW-04 [FLOW]; V1-11 [V1]; J1-09 [J1]
- Verification: Observed by 4 walkers with screenshots; all P3 because the tour can be skipped and sentences match the highlights (verified in R1).
- Files:
  - apps/web/src/components/tour/TourPopover.tsx:150-160 (place beside the sidebar column; bottom-anchored stops above the composer)
  - apps/web/src/components/tour/FirstRunTour.tsx:68 ('Connect more apps' when one is connected)
- Reach: Every new user once.
- Acceptance criteria:
  - No tour popover overlaps the page title, the composer, or a chat message (bounding-box test per stop at 1440 and 375).
  - Stop 8 text does not tell a user with Gmail connected to connect Gmail.
- Needs product decision: false
- Depends on: none
- Conflicts with: none
- Reopens: iteration 8 C9

### C27 Two focus styles: chat message actions and in-message links use the browser's default outline, sign-in links use a 1px auto outline, while sidebar and fields use the ink ring (P3, rank 27, effort XS)
- Root cause: The chat message action buttons (React, Reply, Remember, More) and links, and the 'Forgot password?' and 'Sign up' links, do not use the shared focus-visible ring class.
- Findings: R3-9-02, V1-16
- Found by: R3-9-02 [R3]; V1-16 [V1]
- Verification: R3-9-02 measured on 16 Tab stops; V1-16 probe printed `outline=auto 1px`. Neither located the components.
- Files:
  - chat message action button component (apps/web/src/pages/shell/, find by label 'Reply')
  - auth page links (find under apps/web/src/pages for 'Forgot password?')
- Reach: Keyboard users.
- Acceptance criteria:
  - Each of these elements shows the same 2px ring as the sidebar controls on keyboard focus (computed style probe).
- Needs product decision: false
- Depends on: none
- Conflicts with: none
- Reopens: iteration 8 C22

### C28 Sidebar row details: an unexplained green flag next to the time, each page visit adds a 56 px page-agent row, the phone drawer close X sits between History and + (P3, rank 28, effort S)
- Root cause: The Investor Relations row shows a small green flag glyph lower than the time with no label; opening Inbox, Finance, Investors and Legal adds four 56 px 'Page agents' rows that push 'PERSONAL' out of view at 900 px; the drawer header order is Search, History, X, +.
- Findings: R2-10, V3-16, J1-11, V1-18
- Found by: R2-10 [R2]; V3-16 [V3]; J1-11 [J1]; V1-18 [V1]
- Verification: Observed by 4 walkers with screenshots; the flag's meaning is not known. V3-17 ('Ops WeeklyOps Weekly') was not reproduced and is deferred.
- Files:
  - apps/web/src/pages/Shell.tsx sidebar row (accessible name and tooltip for the flag or remove it; Page agents folded by default; drawer header order)
- Reach: All users; low impact each.
- Acceptance criteria:
  - The flag has an accessible name or is gone.
  - Page agents is collapsed by default and shows a count.
  - At 375 the drawer's close control is the first or last control in its header.
- Needs product decision: false
- Depends on: none
- Conflicts with: C5, C9, C10, C14 (Shell.tsx)

### C29 Data room desktop polish: share gives no confirmation, Auto-sort needs Select all, the 'can now read' line shifts the page 44 px, Status column wastes width, grid '...' button covers text previews, breadcrumbs are 16 px tall (P3, rank 29, effort S)
- Root cause: ItemDialogs.tsx closes Share silently and the row never shows 'Shared'; AutoSortDialog.tsx:240 starts with nothing ticked; the Allow banner line disappears and moves the page up; Status is empty for ready files; grid card '...' overlaps text previews; breadcrumb buttons are under 24 px.
- Findings: J2-08, J2-11, J2-12, V3-07, V3-13, V3-06, V3-12
- Found by: J2-08 [J2]; J2-11 [J2]; J2-12 [J2]; V3-07 [V3]; V3-13 [V3]; V3-06 [V3]; V3-12 [V3]
- Verification: Observed by 2 walkers with screenshots; the stuck 'Reading' row (J2-10, R3-9-05) is a demo seed artifact and is deferred.
- Files:
  - apps/web/src/components/data-room/ItemDialogs.tsx (toast 'Shared with X' and a 'Shared with N' line in the preview)
  - apps/web/src/components/data-room/AutoSortDialog.tsx:240 (visible Select all)
  - Data room page banner (no layout shift)
  - data room list columns and grid card; path bar padding
- Reach: Anyone preparing a data room.
- Acceptance criteria:
  - Sharing shows a confirmation toast.
  - The Allow confirmation line causes no vertical shift of the list (layout probe).
  - Status column is hidden or 80 px or less when no row needs it.
  - Breadcrumb buttons are at least 24 px tall.
- Needs product decision: false
- Depends on: none
- Conflicts with: C12 (data-room components)
- Reopens: iteration 8 C21

### C30 Inbox small items: no 'Sent' confirmation, Digest count differs from the Newsletters tab without saying why, Cleanup suggests an important contact with no reason (P3, rank 30, effort S)
- Root cause: After Send, Undo disappears at 6 s but 'Sending...' lasts 10 s more with no 'Sent'. The Digest uses a 7-day window (8 messages) while Newsletters lists 10. Cleanup listed only 'Riley Testwell' (6 emails, 83% read) with no reason.
- Findings: J1-13, R2-04, J1-05
- Found by: J1-13 [J1]; R2-04 [R2]; J1-05 [J1]
- Verification: Observed once each; J1-05's cause (seed vs heuristic) is not traced.
- Files:
  - apps/web/src/pages/Inbox.tsx (send toast 'Sent')
  - apps/web/src/components/inbox/InboxDigest.tsx ('last 7 days')
  - Cleanup sender query (reason line; exclude senders in the Important pile)
- Reach: Daily Inbox users.
- Acceptance criteria:
  - A 'Sent' state shows when the send completes.
  - The Digest button or heading names its window.
  - Each Cleanup sender shows a reason.
- Needs product decision: false
- Depends on: none
- Conflicts with: C4, C20 (Inbox.tsx)
- Reopens: iteration 8 C17

### C31 Rail mode: a 56 px top band holds only the sidebar toggle and pushes every page header down (P3, rank 31, effort XS)
- Root cause: With the sidebar collapsed to the icon rail the page header starts about 56 px lower (Investors title at y=96 instead of 40).
- Findings: V3-11
- Found by: V3-11 [V3]
- Verification: Observed at 1280 and 1920 once; rail bot avatar accessible names not checked.
- Files:
  - apps/web/src/pages/Shell.tsx rail layout (toggle inside the rail)
- Reach: Users who collapse the sidebar.
- Acceptance criteria:
  - Page header top y is the same with the rail and with the full sidebar (within 4 px).
- Needs product decision: false
- Depends on: none
- Conflicts with: C5, C9, C10, C14, C28 (Shell.tsx)

### C32 A direct link to an agent chat that cannot open ends in 'Still opening... Try again' that never recovers (P3, rank 32, effort XS)
- Root cause: Opening `/app/<agent id>` at 375 showed 'Opening Praci...' then 'Still opening... / Try again' and Try again did not recover; the Chief link worked. The agent may have been deleted by another walker.
- Findings: V2-12
- Found by: V2-12 [V2]
- Verification: Observed once; cause not confirmed, so it may be interference.
- Files:
  - bot route loader (find under apps/web/src/pages for the 'Still opening' string): show 'This agent is not available' with a link to Chief when the id does not resolve
- Reach: Anyone following an old link or notification.
- Acceptance criteria:
  - An unknown bot id shows a not-available message with a link to Chief within 3 s.
- Needs product decision: false
- Depends on: none
- Conflicts with: none

### C33 Consent card appears twice at once (page and Legal panel) and the mail card names the model while document cards say 'the AI model' (P3, rank 33, effort XS)
- Root cause: ConsentPrompt.tsx:19 renders the card in the page and in the panel; approval-ask.ts:147 titles the mail card 'Share your chats and mail with {model name}?' while document cards say 'the AI model that runs your bots'. No confirmation text follows Allow beyond 'Scanning...'.
- Findings: R1-11
- Found by: R1-11 [R1]
- Verification: Observed in code and in one screenshot; the mail card was not connectable in the walk.
- Files:
  - apps/web/src/components/legal/ConsentPrompt.tsx:19 (show once per screen)
  - packages/adapters/src/approval-ask.ts:147 (one recipient wording)
- Reach: New users on Legal and Data room.
- Acceptance criteria:
  - One consent card per screen at 1440.
  - All consent cards use one recipient phrase (grep).
- Needs product decision: false
- Depends on: none
- Conflicts with: none
- Reopens: iteration 8 C8

## Deferred items (not in a cluster)
- Load and skeleton times (V3-04, J3-12, J2-10 timing): shared busy stack; not defects until measured on an idle stack. Re-measure Artifacts cold open (41-57 s three times) first.
- J2-10 and R3-9-05: seeded 'Board Minutes' file stays on Reading in the demo; V3 saw 'Taking longer than usual' with Try again on a stuck row. Demo seed issue: seed the file Ready. Blocks verification of pass-8 C21's import strip.
- J2-05: Legal's 'Ask agent' on a payment deadline ends with 'I can't make the payment'. Question for the owner: should a payment deadline offer a hand-off to the Mercury agent (recommended), or is Legal read-only by design?
- J2-09 and V2-15: repeat approval card after Deny; inconclusive (another walker in the same chat) and agent behavior, not UI. Re-test single-user.
- V1-09: sidebar density (eight Pages rows take 42 percent of 900 px); a Compact density setting exists. Revisit after C5.
- V3-17 ('Ops WeeklyOps Weekly'): a bot created by another walker, not reproduced.
- R3-9-05 and R1-13 are demo artifacts (fake sandbox screen, stuck seed file); product fix only after a real sandbox check.
- Dropped as wrong: J2-04 (no Undo on Legal Done and Dismiss). Undo exists: apps/web/src/pages/legal/LegalDeadlines.tsx:15 keeps it for 30 s and apps/web/src/pages/Legal.test.tsx:459 and :743 test it. J2-04 was filed P1.
- Dropped as owner decision: J1-15 (Done vs Dismiss repeated on every row; row actions Ask agent / Done / Dismiss decided).
- Severity downgrades: J2-02 (P1) kept as P1 in C1 with V2-01/02; J2-03 (P1) -> P2 in C7; V1-02 (P1) -> P2 in C9; R1-02 (P1) -> P2 in C6; V2-01/V2-02 stay P1 in C1.

## BLOCKED stories
- STORY-APP-309/319 model sign-in and 'Connect your apps' (demo has a default model; Connect is real OAuth). Real OAuth Connect for Gmail, Calendar, Carta, Mercury reconnect, Brex, Devin; STORY-FIN-022 (no reconnect state); DRM-121 steps 5-6 (Import from email, Drive, Box).
- STORY-INB-109 steps 3-6 (no Spam tab in the seed) and unsubscribe flow (single Cleanup sender); STORY-APP-024 Monday across the app (skipped, overlaps INB-022).
- Held 'Share with {name}?' cards, secret request card and Provide secret dialog (no demo path); mail consent card wording (mail not connectable); Mercury payment with Allow changes on end-to-end (shared state); sent state of the held email reply (J3 script).
- Real iOS behavior: long-press context menu (C9), on-screen keyboard over the palette (C11), touch emulation in R1 and V2. Pass-8 C16 Storybook is a maintainer script (R3 ran it: C23).

## Counts by severity
- Clusters: 33 (P0 0, P1 3, P2 20, P3 10)
- Distinct finding ids in clusters: 121
- Clusters needing a product decision: C7, C19, C24
- P1: C1 (approval toast covers working controls, 6 walkers), C2 (light-theme status card labels invisible), C3 (Chief says no bank is connected while Mercury is).
