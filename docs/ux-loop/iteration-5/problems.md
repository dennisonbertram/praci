P0: 0, P1: 5, P2: 16, P3: 6

# Iteration 5 problems: fix clusters

Sources: R1-R3 (verify pass-4 clusters C1-C29), J1-J3 (journeys), FLOW, V1-V3. Earlier files (`docs/ux-flow/report.md`, `docs/ux-visual/problems.md`, iterations 1-4 problems) were read; items already decided or fixed are not raised again. A cluster that reopens an iteration 4 cluster says so under "Reopens".

Owner decisions respected (not raised): tour stays nine stops; Devin hidden until connected; the page is called Integrations; consent asked once per area; 44 px on coarse pointers; Hide amounts in the user menu; Settings in five sections with a fixed height; palette is the one search surface; Legal row actions Ask agent / Done / Dismiss.

Verification against the code (checkout ae433a358): confirmed Shell.tsx:864-869 (tour waits on connectCardsOpen), :4223 (static Devin entry), :4722 (data-tour only on the selected row), :5144-5150 (onAsk uses active?.id), :5462 (Suspense fallback null); bot-picker.tsx:49-60 (stopPropagation on keydown); OwnershipDonut.tsx:500,632 (w-20 shrink-0 share count in an absolute legend); Legal.tsx:428 banner text; LegalContracts.tsx:154 Status header; DataRoom.tsx:414 (selection cleared on queryKey); AutoSortDialog.tsx:159,249; SelectionBar.tsx:39; repos.ts:359 (includeDelegatedReplyText: false); mcp-connector.ts:156 (changes-off text); composer.tsx:425-452 (draft restored when onSend returns false). Not verified (marked suspected): toast styling and error mapping (C4), where Chief drops the changes-off reason (C5), the inbox refresh loop (C8), V2-01 cause (C20), J2-06 indexing lag, J3-07 (R1 identified the row as seeded), all dev-server timings (C14). Conflicts between walkers: R1-05 (General scrolls 42 px) against V1 (General fits): re-measure; R2-05 against J2 (Overdue tile): dropped.

## Clusters (ranked: P0 first, then severity x reach / effort)

### C1 Cap table donut legend clips the share counts ('8,400,0') at 1440 and 1280 px (P1, rank 1, effort XS)
- Root cause: OwnershipDonut.tsx lays the legend out absolutely (left/top/width from mainLegend) and gives the share-count column a fixed w-20 shrink-0 in a card that does not shrink, so content (551 px) is wider than the container (526 px) when the agent panel is closed. At 1280 the percent column clips too. Verified in code: the legend ul is absolute with style left/top/width, and both share-count spans are w-20 shrink-0 (lines 500 and 632).
- Findings: V3-01, J2-01, R2-02, FLOW-06
- Found by: V3, J2, R2, FLOW
- Evidence: observed by 4 walkers; code verified
- Reach: Every founder who opens Cap table with the agent panel closed (the default on first open); the figure that is cut is an ownership share count
- Files:
  - apps/web/src/components/cap-table/OwnershipDonut.tsx:481 (absolute legend), :500 and :632 (w-20 shrink-0 share-count spans): let the legend column shrink (min-w-0, truncate the name) or wrap the count under the percent when the card is under about 530 px
  - apps/web/src/components/cap-table/OwnershipDonut.stories.tsx (add a 526 px and a 440 px card story)
- Acceptance:
  - At 1440x900 (panel closed) and 1280x800 the legend text right edge is at or inside the card clip edge for every row; no share count is cut (no '8,400,0').
  - At 375 and 1920 the legend still fits.
  - A story renders the donut in a 440 px and a 526 px wide card without clipping.
- Needs product decision: false
- Dependencies/conflicts: OwnershipDonut.tsx is also touched by C18 (Cap table summary and phone layout); merge C1 first.
- Reopens: iteration 4 C15 (criteria not met: legend clipped)

### C2 Create (+) menu: focus lands on the hidden 'About groups' button and Escape cannot close the menu (P1, rank 2, effort XS)
- Root cause: The info buttons inside the Create menu call onKeyDown={(e) => e.stopPropagation()}, which swallows Escape and Tab before the popover's dismiss handler sees them, and they are the first tabbable nodes, so they take initial focus. The Pages options menu has no such button and closes normally. Verified in code: bot-picker.tsx lines 49-60 (and the same pattern on the other info buttons).
- Findings: V1-01
- Found by: V1
- Evidence: observed by 1 walker (3 Escape presses, DOM check after each); code verified
- Reach: Every keyboard and switch-access user who creates a bot, group or space
- Files:
  - apps/web/src/pages/shell/bot-picker.tsx:49-60 and the other picker-info-* buttons (stop propagation only for Enter and Space; let Escape and Tab bubble)
  - apps/web/src/pages/shell/bot-picker.tsx (initial focus on the first command item, not the info button)
  - apps/web/src/pages/shell/create-menu-focus.test.tsx (extend)
- Acceptance:
  - Opening the Create menu by click or Enter puts focus on 'New bot', not on an info button.
  - Escape closes the menu from every item including each info button, and focus returns to the Create trigger.
  - Enter on an info button still opens its info and does not select the row.
  - Test covers open, Escape and focus return.
- Needs product decision: false
- Dependencies/conflicts: None. bot-picker.tsx is not edited by another cluster.
- Reopens: none (new; iteration 4 C3 fixed the header tab order, this is the menu)

### C3 First-run tour waits on the Connect cards, drops the Chief stop when you are on another page, and 'Ask a question' opens the wrong agent (P1, rank 3, effort S)
- Root cause: Three code paths. (1) tourOpen requires !connectCardsOpen(messages), and the Gmail/Calendar Connect cards have no Skip, so the tour does not start until both are answered or the user types; it then opens on whatever page she wandered to. (2) data-tour='sidebar-chat' is set only on the selected chat row (Shell.tsx:4722), so from Inbox the Chief stop has no anchor and the tour shows 8 stops, not the nine the owner decided on. (3) onAsk uses active?.id ?? bots[0]?.id (Shell.tsx:5144-5150), so from the Inbox page it opens the Inbox page agent and prefills 'What should I do first this week?' there. The last button is also labelled 'Ask a question' with no Done (FirstRunTour.tsx:97 passes doneLabel). Verified in code: lines 864-869, 4722, 5144-5150 and FirstRunTour.tsx:97.
- Findings: J1-01, J1-03, J1-02, V1-05, R2-11
- Found by: J1, V1, R2
- Evidence: observed by 3 walkers (J1 on a fresh user, V1 on desktop and phone, R2); code verified
- Reach: Every new user (first-run journey); phone and desktop
- Files:
  - apps/web/src/pages/Shell.tsx:864-869 (do not wait on connectCardsOpen once the focus question is answered, or start the tour on the Chief page only and keep it pending until she is there)
  - apps/web/src/pages/Shell.tsx:4722 (anchor data-tour='sidebar-chat' on the personal Chief row whether or not it is selected)
  - apps/web/src/pages/Shell.tsx:5144-5150 (onAsk always opens the personal Chief bot)
  - apps/web/src/components/tour/FirstRunTour.tsx:97 and apps/web/src/components/tour/TourPopover.tsx:125,144 (last step button 'Done'; the prefilled question becomes a secondary text link 'Ask Chief')
  - apps/web/src/components/tour/FirstRunTour.test.tsx
- Acceptance:
  - A fresh user who answers the focus question and leaves the Connect cards pending sees the tour start within 2 s without typing, on the Chief page.
  - The tour shows nine stops (1/9 to 9/9) regardless of which page is open when it starts.
  - The last step has a button named 'Done' that ends the tour; 'Ask Chief' (if kept) opens the Chief bot with the prefilled question, never a page agent.
  - At 375 the same holds and every tour button is at least 44 px.
  - Unit test: tour opens with a pending Connect card present.
- Needs product decision: false
- Dependencies/conflicts: Shell.tsx header and sidebar regions are also edited by C16 (run status lines) and C21 (sidebar); keep this change to tourOpen, the data-tour attribute and onAsk.
- Reopens: iteration 4 C11 (tour length and copy: copy fixed, last step and start condition not met)

### C4 Failure and approval toasts are translucent, cover the controls they announce, show raw proxy errors and repeat the page banner (P1, rank 4, effort M)
- Root cause: NotificationToaster (the one path from server notifications to toasts) uses a translucent surface, a bottom stack that sits over the composer, approval card buttons and table columns, has no close control, is shown for background agents the user is not looking at, and passes unknown provider text straight through ('upstream connect error or disconnect/reset before headers...'). The composer error bar uses a different message for the same key failure ('This agent could not finish. Try again.' with a retry that cannot succeed) than the toast and the Legal agent. Code location of the toast styling and the error mapping not read in full; the single mount is apps/web/src/components/AppToaster.tsx and the component is packages/ui-web/src/components/ui/notification-toaster.tsx.
- Findings: V2-05, J3-06, V2-06, J2-09, V1-14, V3-15, J2-08, R2-08
- Found by: V2, J3, J2, V1, V3, R2
- Evidence: observed by 6 walkers; styling and mapping suspected (not read line by line)
- Reach: Every user while any agent fails or asks for approval; the toast sits over the Send/Discard buttons of an approval card on phone
- Files:
  - packages/ui-web/src/components/ui/notification-toaster.tsx (opaque surface, close button, on phone dock at the top and never over the drawer footer; offset above composer height on desktop)
  - apps/web/src/components/AppToaster.tsx (skip the toast when the same agent's approval card or error banner is already on screen; decide scope for background agents)
  - apps/web/src/lib/notification-delivery.ts (map unknown provider errors to the friendly sentence; raw text behind 'Details')
  - apps/web/src/pages/shell/composer-error.tsx and the Legal page failed-scan banner in apps/web/src/pages/Legal.tsx (same key-rejected message and Settings link in every thread; no toast when the banner shows)
  - packages/ui-web/src/components/ui/notification-toaster.test.tsx and stories
- Acceptance:
  - At 375x812 with an 'Inbox agent needs approval' toast showing, the card's Send and Discard buttons are tappable (toast does not overlap them); same for the composer text line and the drawer Integrations row.
  - Toast background is opaque (no text visible through it) in dark and light themes; each toast has a close button of at least 44 px on touch.
  - No toast text contains 'upstream connect error', 'reset reason' or a stack/HTTP string; the same cause shows the same sentence in toast, composer bar and Legal banner.
  - When the Legal page already shows 'Last scan failed' with Replace key, no second toast is raised.
- Needs product decision: true. Should failure toasts from background agents (not the page the user is on) become a sidebar badge instead of a toast (recommended), or stay as toasts with the fixes above?
- Dependencies/conflicts: Independent files except composer-error.tsx (also in C16) and Legal.tsx (also in C10); do C4 before C10 and C16.
- Reopens: iteration 3 toast cluster (still overlapping content) and iteration 4 C2 (composer error bar)

### C5 Chief payment refused with 'Allow changes in Mercury' off gives no reason or link; the Finance agent says it cannot verify a switch that is on (P1, rank 5, effort M)
- Root cause: When changes are off, the connector returns a one-line tool text (mcp-connector.ts:156: 'Changes are off for ... The user can turn on "Allow changes".'), but Finance relays it to Chief as 'could not complete the $300 payment ... not confirmed as made' and Chief repeats it without the reason or a link to the Mercury page. Separately R1-08 and J2-05 saw Finance say it could not verify the switch right after it was turned on, and the Mercury page re-lays out when the switch is confirmed (the first switch element is replaced). The shared demo account was being used concurrently, so J2-05's 'Denied without a click' is not conclusive. Verified in code: mcp-connector.ts:156 holds the reason text; where Chief/Finance drop it is not located (Finance agent prompt in packages/adapters/src/builtin-skills.ts and the delegation result mapping in executor.ts).
- Findings: R1-02, R1-08, J2-05, R1-07, J2-15
- Found by: R1, J2
- Evidence: R1-02 observed twice; R1-08 observed once; J2-05 observed but not conclusive (shared account); cause of dropped reason not located
- Reach: Anyone who asks Chief or Finance to pay or change something in Mercury (and Brex or Box, same code path)
- Files:
  - packages/adapters/src/mcp-connector.ts:156 (keep the structured 'changes_off' reason in the result so callers can branch on it)
  - packages/adapters/src/builtin-skills.ts and packages/adapters/src/executor.ts (Finance and Chief relay the reason: 'Changes in Mercury are off. Open Mercury to turn them on.' with an Open Mercury link)
  - apps/web/src/components/integrations/McpDetail.tsx (keep the switch element stable and reserve the agent card space when the switch is confirmed)
  - apps/web/src/components/integrations/IntegrationAgentSection.tsx
  - approval card Details renderer: amount, recipient and account as labelled rows instead of the raw tool id and JSON (J2-15)
  - packages/adapters/src/*.test.ts (reply test for changes-off and for a just-enabled switch)
- Acceptance:
  - With Allow changes off, asking Chief to pay $300 returns a reply that says changes are off and links to the Mercury page; the reply never says only 'could not complete'.
  - Immediately after turning the switch on, the next payment request reaches an approval card (no 'cannot verify' reply); a test enables the switch and asserts the capability is read at call time.
  - Confirming the switch does not move it vertically (y stays within 2 px) or replace its DOM node.
  - Approval card Details shows labelled rows (Amount, To, From account) and no tool id.
- Needs product decision: false
- Dependencies/conflicts: None on the web side except McpDetail.tsx (also in C13 for the header logo); do C5 first.
- Reopens: iteration 4 C6 and C5 (criteria partly not met)

### C6 Page options still lists 'Devin' (checked) although the page is hidden until Devin is connected (P2, rank 6, effort XS)
- Root cause: The Page options menu array is static and includes { key: 'devin' } (Shell.tsx:4223) while the sidebar row is gated on glance.devinConnected (Shell.tsx:4293). The owner decision (hide Devin until connected) was applied to the sidebar and Cmd+K but not to this menu. Verified in code: line 4223.
- Findings: R1-03, V1-02, R3-12
- Found by: R1, V1, R3
- Evidence: observed by 3 walkers; code verified
- Reach: Every founder who has not connected Devin (menu ghost item)
- Files:
  - apps/web/src/pages/Shell.tsx:4218-4228 (drop the devin item from the pages array until glance.devinConnected)
  - apps/web/src/pages/Shell.test.tsx or the SidebarPagesGroup test
- Acceptance:
  - With no Devin connection the Page options menu has no Devin entry; after connecting it appears.
  - Menu entries equal the sidebar rows plus the pages that can be added.
- Needs product decision: false
- Dependencies/conflicts: Shell.tsx; one-line change, safe to merge before C3 and C21.
- Reopens: iteration 4 C8 (criteria 'no Devin in Page options' not met)

### C7 Data room: no select-all, ticks vanish on every search or filter change, Auto-sort proposes everything unticked, 'Send' does not say email (P2, rank 7, effort M)
- Root cause: (1) DataRoom.tsx:414 clears checkedIds on every queryKey change, so a selection cannot be built across several searches; there is no select-all box. (2) SelectionBar.tsx:39 offers Download and 'Send' (opens the email composer); Send to agent exists only in the single-row menu. (3) AutoSortDialog.tsx:159 labels 'Reviewing N files' with the visible filtered list while the plan covers the whole room, and every proposed change starts unchecked with no select-all (footer 'Tick a change to apply it', line 249), so applying 34 moves is 34 clicks. Verified in code: lines 414, 159, 249 and SelectionBar.tsx:39.
- Findings: R3-01, R3-02, J2-02, J2-03, R3-09
- Found by: R3, J2
- Evidence: observed by 2 walkers; code verified
- Reach: Data room users in diligence (story DRM-019 took about 20 clicks against 6 ideal)
- Files:
  - apps/web/src/pages/DataRoom.tsx:414 (clear the selection on folder change or explicit Clear only; add a select-all header checkbox for the visible rows)
  - apps/web/src/components/data-room/SelectionBar.tsx:39 (add 'Send to agent' for the selection; rename 'Send' to 'Email')
  - apps/web/src/components/data-room/SendToAgent.tsx (accept several files)
  - apps/web/src/components/data-room/AutoSortDialog.tsx:159,249 (state the scope in words, 'Sorting all 50 files. Tick files to sort fewer.'; add Select all and pre-tick or one-click apply)
  - apps/web/src/components/data-room/*.test.tsx
- Acceptance:
  - Ticking 12 contracts across 4 different searches keeps all 12 ticked; selection clears only on folder change or Clear.
  - A select-all box in the list header ticks all visible rows and shows the count.
  - With 3 ticked files the bar offers Download, Email and Send to agent, and Send to agent hands all 3 to the agent.
  - Auto-sort names its scope (all files or the ticked ones) before it starts, and its Select all applies the full plan in 2 clicks.
- Needs product decision: false
- Dependencies/conflicts: DataRoom.tsx also touched by C17 (processing state) and C24; do C7 first. ItemRows.tsx is shared with C11.
- Reopens: iteration 4 C23 and C26 (acceptance not met)

### C8 Inbox first load and sorting give no progress; heading numbers are unlabelled unread counts; Undo disappears before 'Sent' (P2, rank 8, effort M)
- Root cause: (1) First sync shows grey skeleton rows for about 25 s with about 14 inbox/refresh POSTs and no text (J1-04; the repeated refresh effect is suspected, not confirmed). (2) 'Sorting your mail...' runs 125-140 s with no stall message (threshold in Inbox.tsx:1419-1424 'sorting && stalled') and the status line shifts the list 38 px. (3) InboxRow.tsx:94-101 prints the unread count next to a group heading, so '7' above 10 rows reads as a row count. (4) The undo window timer ends about 1.7 s before the toast changes from 'Sending...' to 'Sent' (R1-04). (5) The sidebar badge reads 13, 14, 13 (cached versus live count).
- Findings: J1-04, J1-05, J1-06, R1-04, R2-09
- Found by: J1, R1, R2
- Evidence: J1-04/05/06 and R1-04 observed (R1-04 three times with 50 ms polling); refresh-loop cause and R2-09 cause suspected
- Reach: Every user at first connect of Gmail and every morning sort
- Files:
  - apps/web/src/pages/Inbox.tsx (refresh effect: dedupe calls; 'Reading your mail...' under the skeleton; :1419-1424 lower the stall threshold; reserve the status line height; send toast keeps Undo until it reads Sent)
  - apps/web/src/components/inbox/InboxRow.tsx:94-101 (drop the number or write '7 unread')
  - apps/web/src/pages/Shell.tsx (sidebar Inbox badge reads the same source as the list count)
  - apps/web/src/pages/Inbox.test.tsx
- Acceptance:
  - While the first sync runs the Inbox shows 'Reading your mail...' text, and a mock mailbox load sends at most 2 inbox/refresh calls.
  - If sorting takes over 30 s the stall line appears; the list does not move more than 2 px when the status line appears or disappears.
  - Group headings show either no number or '7 unread'; the number never exceeds the rows below it unlabelled.
  - Undo stays visible until the toast reads Sent (polled at 50 ms: no frame with 'Sending...' and no Undo).
  - Sidebar badge and Inbox header count are equal after reload and after opening Inbox.
- Needs product decision: false
- Dependencies/conflicts: Inbox.tsx is also edited by C23 (menus and digest); do C8 first. Shell.tsx badge line only, small.
- Reopens: iteration 4 C9 (Undo before Sent not met) and C12 (badge counts differ)

### C9 AI-sharing consent: two switches with the same title, raw model strings on the card, and a Legal Allow that leaves the Settings switch off (P2, rank 9, effort S)
- Root cause: AiDataSharing.tsx:177-179 gives both switches the label 'Bots, mail, files and contracts' and tells them apart only by a small model name (GPT-6 Luna, Muse Spark 1.2). The chat consent card shows the raw string 'OpenRouter (openai/gpt-6-luna, forwarded to its provider)' although a prettifier exists at AiDataSharing.tsx:104. After 'Allow' on the Legal card, the Settings > Privacy switches stay off (R2-07), so two consent states exist with no explanation. Consent per area was decided in iteration 4 and is not reopened here; only labels and the link between the two states are. Verified in code: the label line and the prettifier line.
- Findings: FLOW-01, V1-07, R2-07, J3-09, V2-02
- Found by: FLOW, V1, R2, J3, V2
- Evidence: observed by 5 walkers; code verified for the labels and prettifier; R2-07 is an ambiguity needing the owner
- Reach: Every user who meets a consent card (Inbox, Legal, Data room, agent chats) and Settings > Privacy
- Files:
  - apps/web/src/components/AiDataSharing.tsx:104 and :177-179 (primary label 'Allow GPT-6 Luna' / 'Allow Muse Spark 1.2'; one short line for data categories; card title uses the prettifier: 'Allow your mail to be sent to GPT-6 Luna (via OpenRouter)?')
  - apps/web/src/components/ApprovalRulesSettings.tsx and the Legal consent state (only if the owner says the two states are one)
  - apps/web/src/components/AiDataSharing.test.tsx
- Acceptance:
  - The two Settings switches have different primary labels.
  - No consent card shows 'openai/' or 'forwarded to its provider'.
  - After Allow on the Legal card, Settings shows a state that matches (or the labels explain why they differ).
- Needs product decision: true. Is the Legal consent (Muse Spark 1.2) meant to be a separate switch from the general consent (GPT-6 Luna)? If yes, relabel only; if no, one consent covers both (recommended: relabel now, merge later).
- Dependencies/conflicts: AiDataSharing.tsx is not edited by another cluster; Legal.tsx change for the card itself belongs to C10.
- Reopens: iteration 4 C1 area and FLOW-03 (partly)

### C10 Legal first visit: key-and-model banner in jargon, Scan now disabled with no reason, empty Status column, repeated first lines on deadlines (P2, rank 10, effort M)
- Root cause: Legal.tsx:428 banner names 'Muse Spark 1.2', 'OpenRouter key' and 'the space's shared OpenRouter access' for a user who has never chosen a model; 'Scan now' (Legal.tsx:250) is dimmed with no hint; the consent card (:276) sits above a full table; LegalContracts.tsx:79,154 renders a Status header with nothing in active rows; deadline rows start with the same first line ('Send non-renewal notice') with the contract name on line 2 and the due text in two places; the undo line pushes the list 25 px; the banner button is 4.2:1 contrast; the 'not yet checked' link is a 12 px footnote. Verified in code: Legal.tsx:428 text and LegalContracts.tsx:154 Status header. J2 observed the Overdue tile as a working link, so R2-05 (tile not clickable) is dropped as contradicted.
- Findings: J1-07, FLOW-02, J2-07, V2-04, R2-04, R2-01, J2-16, V2-19, V2-20
- Found by: J1, FLOW, J2, V2, R2
- Evidence: observed by 5 walkers; code verified for banner text and Status header
- Reach: Every first visit to Legal (a tour stop points there)
- Files:
  - apps/web/src/pages/Legal.tsx:250,276,428 (plain-words banner: 'Legal needs an OpenRouter key to read your contracts' with one button; hide Scan now and stat tiles until a key and consent exist; render the 'not yet checked' prompt as a banner row with a 'Check now' button; destructive foreground at full opacity on 'Replace key')
  - apps/web/src/pages/legal/LegalContracts.tsx:79,154 (hide the Status column when every contract is active)
  - apps/web/src/pages/legal/LegalDeadlines.tsx (title 'Send non-renewal notice: Cobalt Cloud Hosting'; due text in one place; reserve the Undo line height)
  - apps/web/src/pages/Legal.test.tsx
- Acceptance:
  - No Legal banner contains 'Muse Spark', 'space' or 'shared OpenRouter access'.
  - With no key or no consent there is one action on the page, and it is not a disabled button without a reason.
  - No empty Status column appears when all contracts are active.
  - No two deadline rows share the same first line; Undo does not move the list by more than 2 px.
  - 'Replace key' text contrast is at least 4.5:1.
- Needs product decision: false
- Dependencies/conflicts: Legal.tsx also touched by C4 (banner/toast duplicate); merge C4 first. LegalDeadlines row actions stay (iteration 4 C16 decided Ask agent, Done and Dismiss on each row; V2-08 is not raised).
- Reopens: iteration 4 C16 (identical first lines, empty Status column) and C13

### C11 Touch targets under 44 px on switches, selection checkboxes and Finance subscription rows (P2, rank 11, effort M)
- Root cause: Switch rows in Settings > Privacy and approvals, Settings > Advanced and the bot Notifications row are 32x18 pills with a plain div label (not a label element), 32 to 36 px row pitch; Inbox/Data room row checkboxes are 16x16 and 18x18 (about 22 px hit area), in Inbox invisible until a row is selected and sitting over the unread dot; Finance subscription vendor links are 18 px high in 37 px rows with only the link tappable. All were measured under pointer: coarse emulation. Verified in code: bot-panel.tsx:486-495 (Switch beside a div), ItemRows.tsx:276, InboxRow.tsx:284-289, Finance.tsx:957-990 as cited by walkers (not each re-read).
- Findings: V1-03, J3-03, J3-01, R3-08, J3-02
- Found by: V1, J3, R3
- Evidence: observed under real coarse-pointer emulation by 3 walkers
- Reach: All phone users; mis-taps on 'Action confirmations' change whether bots ask before sending email or paying
- Files:
  - apps/web/src/components/ApprovalRulesSettings.tsx and apps/web/src/components/AiDataSharing.tsx (each switch row a label with min-h-11 under pointer-coarse)
  - apps/web/src/pages/AccountSettingsOverlay.tsx:292-330 (Advanced switches)
  - apps/web/src/pages/shell/bot-panel.tsx:486-495 (Notifications row)
  - apps/web/src/components/inbox/InboxRow.tsx:284-289 and apps/web/src/components/data-room/ItemRows.tsx:276, DriveRow.tsx:43 (44 px hit area; a visible way to enter selection on touch)
  - apps/web/src/pages/Finance.tsx:957-990 (row-wide link, 44 px rows on coarse)
- Acceptance:
  - At 375 with pointer: coarse, every switch row in Settings and the bot panel has a tappable area of at least 44 px height spanning the label.
  - Row selection checkboxes in Inbox and Data room have at least 44x44 hit areas and do not overlap the unread dot.
  - Finance subscription rows are 44 px high and tapping anywhere in the row opens the vendor.
  - A geometry audit at 375 coarse lists zero controls under 44 px on these screens.
- Needs product decision: false
- Dependencies/conflicts: Touches InboxRow.tsx (C8, C23), ItemRows.tsx (C7), Finance.tsx (C25); apply C11 after those, or keep to class-name changes.
- Reopens: iteration 4 C25 (remaining gap: switches and list checkboxes)

### C12 Phone page headers: hamburger on its own row, five-row Data room toolbar, truncated Finance company menu, 3-line thread subject (P2, rank 12, effort M)
- Root cause: PageHeader.tsx on phone renders the hamburger as a separate 55 px band above the title on Inbox, Data room and Integrations (Chief has it inline). The Data room toolbar uses five rows (title with actions, search with Filters, folder chips, sort), pushing the first document to y=320 (target 220). The Finance header truncates the company menu to 'Northwind Ro...' beside the sync status. The Inbox thread subject is 20 px and wraps to 3 lines. Cause is layout, not logic.
- Findings: R3-03, J3-04, R3-10, V2-14, J3-05, V2-15
- Found by: R3, J3, V2
- Evidence: observed by 3 walkers at 375
- Reach: All phone users; every page with a header
- Files:
  - apps/web/src/components/PageHeader.tsx (hamburger inline with the title on phone)
  - apps/web/src/components/data-room/FilterBar.tsx (search and Filters on the title row; folder and sort inside the Filters sheet)
  - apps/web/src/pages/Finance.tsx:~403-430 (status text drops to a dot on phone so the company name shows in full)
  - apps/web/src/components/inbox thread dialog header (16 px, 2-line clamp on narrow screens)
- Acceptance:
  - At 375x812 the Data room first document starts above y=220 and the 'Northwind Robotics' subtitle stays beside or under the title on the same block.
  - Inbox, Data room and Integrations have the menu button on the title row (no separate band above it).
  - The Finance company name is not truncated at 375.
  - Thread subject is at most 2 lines at 375.
- Needs product decision: false
- Dependencies/conflicts: PageHeader.tsx is shared by every page (also read by C25 for sub-page headers); do C12 before C25. FilterBar.tsx shared with C7/C24.
- Reopens: iteration 4 C26 (phone toolbar target y=220 not met) and C22

### C13 Integrations on a phone is 3062 px tall; connected cards differ in footer; Mercury detail shows a generic icon (P2, rank 13, effort M)
- Root cause: Connected cards at 375 stack status, action and 'Used by' on separate rows (about 135 px each, target 72), giving a 3062 px page against a 2200 px target; action buttons have different widths; Gmail and Carta cards have no overflow menu, Coinbase has no Used by row, four cards repeat 'Open Finance'; McpDetail.tsx renders a generic grid glyph where the list card shows the Mercury logo.
- Findings: R3-04, V1-06, R3-05, V1-08, R2-10, J2-11
- Found by: R3, V1, R2, J2
- Evidence: observed by 4 walkers
- Reach: Every user who looks for an app on a phone; all users see the footer and logo inconsistency
- Files:
  - apps/web/src/components/integrations/IntegrationsHome.tsx (one row per connected card at phone width: status chip and Used by beside the action; shared min button width; same footer slots on every connected card; one Open Finance link)
  - apps/web/src/components/integrations/McpDetail.tsx (reuse the card's logo component in the header)
  - apps/web/src/components/integrations/*.stories.tsx
- Acceptance:
  - At 375 the Integrations scroll height is at most 2200 px with the demo seed; a connected card is at most 72 px.
  - Every connected card at 1440 has the same footer slots; Mercury detail header shows the Mercury logo.
  - No two Open buttons differ in width on a phone.
- Needs product decision: false
- Dependencies/conflicts: McpDetail.tsx also edited by C5; merge C5 first.
- Reopens: iteration 4 C20 (375 height 3062 against 2200 target not met)

### C14 Lazy pages and cold loads show a blank area, an unshaped grey block or 'Still opening...' (P2, rank 14, effort S)
- Root cause: Shell.tsx:5462 wraps the lazy pages in <Suspense fallback={null}>, so the route chunk load shows nothing (Artifacts blank 2 to 3 s, Contacts one grey block about 5 s); a hard load of /app/finance and /app/inbox once stayed on a skeleton or blank for over 10 s (suspected dev-server load from shared walkers); Activity shows an empty band 'Loading activity...' about 4 s. Verified in code: fallback={null} at Shell.tsx:5462.
- Findings: V3-02, R1-09, V2-18, V3-14, V1-15
- Found by: V3, R1, V2, V1
- Evidence: V3-02 observed with code verified; R1-09 and V2-18 observed once each and suspected dev-server load; timings are dev-server only
- Reach: Every page navigation on first visit; worst on slow connections
- Files:
  - apps/web/src/pages/Shell.tsx:5462 and the other Suspense fallbacks (shared list skeleton)
  - apps/web/src/pages/Contacts.tsx (skeleton shaped like rows)
  - apps/web/src/pages/ActivityList.tsx:109 (skeleton, two-line summaries)
  - apps/web/src/lib (bootstrap: retry once automatically before showing 'Still opening...')
- Acceptance:
  - Navigating to Artifacts or Contacts shows a row skeleton within 100 ms (no blank main area frame at 100 ms).
  - A bootstrap request that fails once is retried once before 'Still opening...' appears.
  - Activity shows a skeleton, not an empty band, while loading.
  - Re-measure on a production build and on an idle stack before closing; do not claim a speed fix from dev-server timings.
- Needs product decision: false
- Dependencies/conflicts: Shell.tsx line 5462 region; independent of C3 and C21 hunks.
- Reopens: iteration 4 C18 (loading states: partly met)

### C15 Two search surfaces answer differently; contact hits show no reason; sidebar results repeat and lack dates (P2, rank 15, effort M)
- Root cause: Cmd+K (command-palette.tsx) lists Pages, Contacts, Documents and agents; the sidebar Search (SpaceSearch.tsx) lists Documents, Mail and Chats from another result set. Contact rows in the palette show no company or email and no highlight, so 'pilot' and 'halcyon' rank a contact first for no visible reason. Sidebar chat results carry an identical 'Message' badge, repeat the same chat with no date and cut document names.
- Findings: V3-03, V3-04, V3-05, R2-03
- Found by: V3, R2
- Evidence: observed by 2 walkers
- Reach: Every user who searches (Cmd+K or sidebar)
- Files:
  - apps/web/src/pages/shell/command-palette.tsx (show organization or email as secondary text and highlight the matched part; rank name matches first)
  - apps/web/src/pages/SpaceSearch.tsx:85 (drop the Message badge; group snippets per chat with a date; highlight the match; two-line names)
  - apps/web/src/pages/shell/command-palette.test.ts
- Acceptance:
  - Searching 'halcyon' shows the matching field (company or email) under each contact hit, with the match highlighted.
  - A chat appears once per query with a date and the highlighted snippet; no row carries a bare 'Message' badge.
  - Palette and sidebar return the same documents for the same query (or the sidebar box opens the palette).
- Needs product decision: true. Should the sidebar Search box be replaced by the Cmd+K palette (recommended; iteration 4 already called the palette the one search surface) or stay as a second surface fed by the same results?
- Dependencies/conflicts: Independent files; SpaceSearch.tsx and command-palette.tsx are not edited by another cluster.
- Reopens: iteration 4 C17 (match reason: contacts still without)

### C16 Run status: sidebar preview shows the user's question instead of the delegate's reply; status wording differs between sidebar and chat; two identical 'Inbox agent' rows; a run can show 'Thinking 9m' (P2, rank 16, effort M)
- Root cause: packages/db/src/repos.ts:359 builds the sidebar preview with includeDelegatedReplyText: false, so a Chief-to-Finance hand-off keeps the user's question as the preview (verified in code). The sidebar run label ('Waiting for the computer...') and the thread header ('Thinking', 'Reading data room item') come from two sources. Two sidebar rows are both named 'Inbox agent' with no preview, and Ask opens the other thread. J3-07 saw 'Thinking 9m 49.7s' on 'Finance helper (mock)', which R1 identified as seeded data that has shown 'Working...' since seed time; a run that never times out or reports failure is suspected, not shown on a real run.
- Findings: R1-01, J2-13, J3-10, J3-07
- Found by: R1, J2, J3
- Evidence: R1-01 observed, code verified; J2-13 and J3-10 observed; J3-07 suspected (seeded row)
- Reach: Everyone who asks Chief something that is delegated; anyone with two page-agent threads
- Files:
  - packages/db/src/repos.ts:359 (preview includes the delegated reply when the final answer came from a delegate)
  - apps/web/src/lib/run-phase.ts and apps/web/src/lib/roster-status.ts (one status source for sidebar and thread header)
  - apps/web/src/pages/Shell.tsx (page-agent row naming; Ask opens the thread the row opens)
  - packages/db/src/repos.test.ts
- Acceptance:
  - After Chief delegates to Finance and Finance answers, the Chief row preview shows the Finance reply text.
  - A run's sidebar label and thread header label never name different phases at the same time.
  - Two page-agent threads are not both named 'Inbox agent' with empty previews; Ask opens the thread the sidebar row opens.
  - J3-07: a real run that exceeds a stated limit ends with an error in its thread (confirm with a non-seeded run first; otherwise close as seed noise).
- Needs product decision: false
- Dependencies/conflicts: Shell.tsx hunks differ from C3 and C21; composer-error.tsx is C4.
- Reopens: iteration 4 C2 (sidebar preview criterion not met)

### C17 Data room: a file can stay on 'Reading' forever with no age, timeout or Try again; the strip repeats the row; the agent answers before indexing finishes (P2, rank 17, effort S)
- Root cause: 'MOCK Board Minutes - October.pdf' stayed on 'Reading' for over 10 minutes and the strip 'Processing 1 file' never cleared (J2-04, V3-16; may be a seeded row, but the list has no timeout handling for any stuck row). The processing banner repeats the row's badge (FLOW-09). The Data room agent said it found no formation records 40 s after an upload because the new file was probably not yet indexed (J2-06, suspected).
- Findings: J2-04, V3-16, FLOW-09, J2-06
- Found by: J2, V3, FLOW
- Evidence: J2-04 and V3-16 observed (same row, may be seed data); J2-06 suspected
- Reach: Data room users with a slow or failed read; diligence questions
- Files:
  - apps/web/src/components/data-room (processing strip: show elapsed time; hide when 3 or fewer files are processing)
  - apps/web/src/pages/DataRoom.tsx (a row processing longer than a limit becomes Failed with Try again)
  - Data room agent tool result (say 'N files are still being indexed' while any file is processing)
  - apps/web/src/components/data-room/*.test.tsx
- Acceptance:
  - A file in 'Reading' longer than the limit shows Failed with Try again, and the strip clears.
  - With 1 or 2 files processing, no strip repeats the row badge.
  - Asking the agent while a file is indexing includes the 'still being indexed' note.
- Needs product decision: false
- Dependencies/conflicts: DataRoom.tsx also in C7; merge C7 first.
- Reopens: iteration 4 C26 (processing strip) partly

### C18 Cap table: duplicate and unclear totals, holders start below the fold on a phone, rows that do not open, summary vanishes on the Investors tab (P2, rank 18, effort M)
- Root cause: '10,000,000' appears in both the Fully diluted tile and the donut centre; 'Amount raised $350,000' equals the SAFE total while the caption says SAFEs are not included. On 375 the tiles and donut take about 650 px of 812, the tab pill wraps to two rows and row meta is cut mid-word. Only rows with a saved contact open (onOpen only when contact). Switching to Investors removes the KPI/donut block so the tab bar jumps from y=380 to y=93. At 1920 the table stops at x=1368 while the toolbar spans to x=1892. The header's filled button is Add contact, the same action as the Contacts page.
- Findings: V3-09, V3-10, V3-11, J2-14, V3-17, FLOW-07
- Found by: V3, J2, FLOW
- Evidence: observed by 3 walkers
- Reach: Every cap table visit; phone users see the holders list below the fold
- Files:
  - apps/web/src/pages/CapTable.tsx:~568 (header buttons), ~900 (onOpen), summary tiles (remove one of the duplicate totals; word the SAFE note with the share tiles; keep the summary visible when tabs change; table max width)
  - apps/web/src/components/cap-table/OwnershipDonut.tsx (compact bar on phones)
  - apps/web/src/pages/CapTable.test.tsx
- Acceptance:
  - '10,000,000' appears once on the page; the SAFE caption says 'SAFEs are not in the share counts' next to the share tiles.
  - At 375 the first holder row starts above y=500 and the tab pill is one scrollable row.
  - Every holder row opens a card (read-only with 'Add as contact' if no contact).
  - Switching tabs does not move the tab bar vertically.
- Needs product decision: true. Keep 'Add contact' as the filled header button on Cap table, or make Ask the only header button and add people from Contacts and each holder row (recommended)?
- Dependencies/conflicts: OwnershipDonut.tsx also in C1 (merge C1 first); CapTable.tsx otherwise unshared.
- Reopens: iteration 4 C15 (summary and SAFE visibility partly met)

### C19 Inbox agent answers 'Nothing needs your reply today' when a mail account failed to refresh (P2, rank 19, effort S)
- Root cause: The agent's answer leads with a confident conclusion and puts the failed-account caveat second, naming 'Old mail' without explanation, while the Inbox shows 13 unread including a direct question. Likely triggered by the demo account needing reconnection, but the answer shape is the app's behaviour. Prompt or answer template not located.
- Findings: J3-08
- Found by: J3
- Evidence: observed once; cause suspected (demo mail account state)
- Reach: Anyone with a mail account that needs reconnecting (all mail agents)
- Files:
  - packages/adapters/src/builtin-skills.ts (Inbox agent instructions: when any account fails to refresh, state first that the answer may be incomplete)
  - apps/web/src/pages/Inbox.tsx (Reconnect action on the failed account)
  - packages/adapters/src/*.test.ts
- Acceptance:
  - When any account fails to refresh the reply begins 'I could not read <account>' and offers Reconnect; it never says 'Nothing needs your reply' as the first sentence.
  - A test with one failing account asserts the order.
- Needs product decision: false
- Dependencies/conflicts: builtin-skills.ts also in C5; separate hunks.
- Reopens: none

### C20 Composer keeps the typed text and an active send arrow after a consent-gated send (P2, rank 20, effort S)
- Root cause: composer.tsx:425-452 clears the draft, then restores it when onSend returns false (an untouched draft is put back so a retry reuses the nonce). A send that opens the AI-sharing consent card appears in the thread yet the callback probably returns false, so the text returns to the composer and a second send would duplicate the request. Suspected, not traced: the first repro used fill plus Enter, so a programmatic-input effect is not excluded; a keyboard-typed message in Chief did clear.
- Findings: V2-01
- Found by: V2
- Evidence: observed once in the Inbox agent chat; cause suspected from composer.tsx
- Reach: First message to any agent that needs AI-sharing consent (new users)
- Files:
  - apps/web/src/pages/shell/composer.tsx:425-452 (restore the draft only when the message was not accepted into the thread)
  - apps/web/src/pages/Shell.tsx (the onSend implementation's return value on the consent path)
  - apps/web/src/pages/shell/composer.test.tsx
- Acceptance:
  - Reproduce first with real keystrokes in the Inbox agent chat on a fresh user.
  - After sending a message that opens the consent card, the composer is empty and the send arrow is inactive, also after reload.
  - A genuine failed send (message not in the thread) still restores the draft.
- Needs product decision: false
- Dependencies/conflicts: composer.tsx; Shell.tsx onSend region, separate from other clusters.
- Reopens: none

### C21 Sidebar: 89 tab stops before the page, ambiguous badges, cut-off empty spaces, Pages options menu covers the rows it edits (P2, rank 21, effort M)
- Root cause: Each chat row has two tab stops (row and Actions), so 89 stops precede the page content (a skip link exists). Four badges share one style but mean unread, runway, failed file and overdue deadline. The space list is cut mid-row under the pinned Integrations row (demo seed adds 'Reconnect needed', 'Empty space' headers), the weak scroll fade is the only hint. The Pages options menu opens to the right over the page rows (SidebarPagesGroup.tsx:77-83).
- Findings: V3-13, FLOW-05, FLOW-08, V2-12, V1-16, V1-12
- Found by: V3, FLOW, V2, V1
- Evidence: V3-13 observed (Tab walk); FLOW-08 and V1-16 seed-data dependent; others observed
- Reach: All keyboard users; all users with several spaces
- Files:
  - apps/web/src/pages/Shell.tsx (sidebar chat list as one roving-tabindex group; stronger bottom shadow on rk-scroll-fade-bottom; collapse a space with no bots into one line with its state in words)
  - apps/web/src/components/SidebarPagesGroup.tsx:77-83 (anchor the menu below the header row)
  - apps/web/src/pages/Shell.tsx badges (tooltip naming the reason; badge only for things that need action)
- Acceptance:
  - Tab from the sidebar header reaches the page content in at most 12 presses with the demo seed (arrow keys move within the chat list).
  - Each badge has a tooltip or accessible name stating what it counts.
  - No sidebar row is half hidden under the Integrations row at 1440x900 without a visible scroll cue.
  - The Pages options menu does not cover the page names it lists.
- Needs product decision: true. Which sidebar badges should stay: unread mail only, or also failed Data room files and overdue Legal deadlines (recommended: keep all three action badges with tooltips; drop the runway badge)?
- Dependencies/conflicts: Shell.tsx sidebar region; do after C3 and C6. Merge-conflict risk with C16.
- Reopens: iteration 4 C28 (partly)

### C22 Settings polish: empty Memory and Voice bands, repeated phone heading, 'Server apps' wording, notification switch location, three folds on Models (P3, rank 22, effort M)
- Root cause: Every Settings section uses the fixed h-[min(760px,...)] dialog (a deliberate iteration 4 fix), so Memory shows one sentence above about 560 px of empty panel. On phone the section select and the heading below repeat the section name. The 'Server apps / everyone on this server' card duplicates Integrations under another name. The Browser notification switch sits under Privacy and approvals while time zone is in General. Models has three folds for one decision and the provider list is its own scroller at 375. Walkers disagree on General: R1 measured 42 px of scroll (725 vs 683), V1 found it fits; unresolved.
- Findings: V1-04, V1-10, J3-11, V1-09, FLOW-04, FLOW-03, FLOW-10, V1-11, R1-05
- Found by: V1, J3, FLOW, R1
- Evidence: observed by 4 walkers; R1-05 conflicts with V1's General verdict
- Reach: Every user who opens Settings
- Files:
  - apps/web/src/pages/SettingsOverlay.tsx (dialog height; hide the section heading below md; provider list grows at phone width; Data room search model and Backup models under one Advanced fold)
  - apps/web/src/pages/AccountSettingsOverlay.tsx:254 and apps/web/src/pages/LocalSettings.tsx:42 (show 'Server apps' only to a server admin, or rename 'Integration sign-in')
  - apps/web/src/components/ApprovalRulesSettings.tsx (move Browser switch to General)
- Acceptance:
  - Memory and Voice show no more than 150 px of empty panel at 1440x900.
  - At 375 the section name appears once above the content.
  - A non-admin sees no 'Server apps' card.
  - General fits in the dialog without scrolling at 1440x900 (re-measure first; two walkers disagree).
- Needs product decision: true. Keep the fixed 760 px Settings height for every section (no jumping nav, recommended in iteration 4) and accept empty bands, or cap Memory/Voice at a shorter height?
- Dependencies/conflicts: SettingsOverlay.tsx; ApprovalRulesSettings.tsx also in C11 and C9.
- Reopens: iteration 4 C10 and C14 (partly met)

### C23 Inbox menus and Digest: 'Updates' used twice, Digest repeats Newsletters, selected row after archive, clipped attachment name (P3, rank 23, effort S)
- Root cause: Inbox.tsx:1197 Filter menu has a 'Gmail tabs' group with 'Updates' beside the page's own Updates pile, and no check on active filters. Digest lists the same newsletters as cards instead of a summary, 'Archive all N' shows an undo only after click, and the Digest toggle appears only on the Newsletters tab, 3 px off the tab pill with no outline (Inbox.tsx:1292-1306). After Archive on touch the next row keeps a highlighted background and a visible checkbox (InboxRow.tsx:170-171). The attachment chip cuts the filename in a 224 px chip.
- Findings: V2-03, V2-09, R2-06, J3-13, V2-16
- Found by: V2, R2, J3
- Evidence: observed by 3 walkers
- Reach: Daily Inbox users
- Files:
  - apps/web/src/pages/Inbox.tsx:1197,1292-1306 (rename group items or drop the group; check marks on active filters; Digest toggle aligned with the tab row and outlined; one-line summary per sender)
  - apps/web/src/components/inbox/InboxRow.tsx:170-171 (clear selected row when the dialog closes on coarse pointers)
  - attachment chip component (grow up to dialog width)
- Acceptance:
  - No two controls on the Inbox page are named 'Updates' with different meanings.
  - Active filters show a check in the menu.
  - After Archive on a coarse pointer no row stays highlighted.
  - An attachment name that fits the dialog is not truncated.
- Needs product decision: false
- Dependencies/conflicts: Inbox.tsx also in C8 (merge C8 first); InboxRow.tsx also C8 and C11.
- Reopens: iteration 4 C9 and C12 (Digest control)

### C24 Data room list polish: Add files menu wording, 1920 column widths, stats chart tooltip, grid card order, lingering tooltip (P3, rank 24, effort S)
- Root cause: DataRoomImportMenu.tsx:13 labels items Upload, Email, Box (Email reads like composing mail; phone trigger is a bare +); ItemRows.tsx:205 lets Name absorb spare width (about 830 px blank at 1920) while Parties stays 130 px and truncates; DataRoomStats bars have no tooltip or label; a failed grid card puts the folder after the error where others put type and date; the Add files trigger keeps a focus ring and tooltip for 40 s after the menu closes.
- Findings: V3-06, V3-07, V3-08, V3-19, J2-10
- Found by: V3, J2
- Evidence: observed by 2 walkers
- Reach: Data room users
- Files:
  - apps/web/src/components/data-room/DataRoomImportMenu.tsx:13 ('Upload files', 'From email', 'From Box')
  - apps/web/src/components/data-room/ItemRows.tsx:205 (cap Name, give Parties the spare width)
  - apps/web/src/components/data-room/DataRoomStats.tsx (hover tooltip with month and count; aria-label per bar)
  - grid card component (one field order); Add files trigger (tooltip on keyboard focus only)
- Acceptance:
  - Add files menu items read 'Upload files', 'From email', 'From Box'.
  - At 1920 Parties shows full names for the demo seed.
  - Hovering a stats bar shows month and count; each bar has an accessible label.
  - The Add files tooltip is gone within 1 s of the menu closing.
- Needs product decision: false
- Dependencies/conflicts: ItemRows.tsx also in C7 and C11; DataRoom files after C7.
- Reopens: none

### C25 Finance polish: sub-page header and gutter differ, stat cards leave dead space, chart label collision, Runway leaves the lower half empty, unequal card heights (P3, rank 25, effort S)
- Root cause: The overview header is one row while Accounts, Burn and Runway use a two-row header (title jumps 34 px); content starts at x=356 on Inbox and x=343 on Finance/Legal; sub-page stat cards are fixed about 350 px wide while Runway stretches 4 cards; the Accounts chart y-axis starts at $0 and its '$0' and first x labels almost touch; the Runway chart ends at y=490 with 400 px empty below; Breakdown (312 px) and Upcoming (338 px) cards differ in height (Finance.tsx grid items-start).
- Findings: V2-10, V2-11, V2-13, J1-08, R1-06
- Found by: V2, J1, R1
- Evidence: observed by 3 walkers
- Reach: Finance users
- Files:
  - apps/web/src/pages/Finance.tsx (grid items-stretch)
  - apps/web/src/pages/finance/* (one header height and one stat-card grid on sub-pages; chart axis offset and y-axis near the minimum for balance)
  - apps/web/src/components/PageHeader.tsx (one content gutter across pages)
- Acceptance:
  - Sub-page title position equals the overview title position (within 2 px).
  - Stat cards use the same grid on Accounts, Burn and Runway.
  - Chart axis labels do not touch.
  - Breakdown and Upcoming card bottoms are within 2 px.
- Needs product decision: false
- Dependencies/conflicts: PageHeader.tsx shared with C12 (merge C12 first); Finance.tsx also C11.
- Reopens: iteration 4 C22 (sub-page headers partly met)

### C26 Chat cards and demo seed leftovers: card widths and spacing differ, relayed agent chatter shown as assistant text, seed data signs 'Alex' and prints a mock marker as a data row (P3, rank 26, effort S)
- Root cause: Chat cards have different max-widths (consent 770, question 680, mail card 575, bubbles 640 px) and tool-line spacing of 40 px against 2 px between messages; relayed agent-to-agent text ('Message from Investor Relations (mock)') renders as assistant text; the drafted reply is signed 'Alex' while the user is Maya Chen (seed or agent memory); Cap Table Summary.csv preview and artifact tables show 'MOCK DEMO DATA' as a data row; Cascade Robotics is Won at 0 (packages/testkit/src/cli/demo/data.ts).
- Findings: V2-17, J2-17, V2-07, R3-11
- Found by: V2, J2, R3
- Evidence: observed by 3 walkers; V2-07 and J2-17 are likely seed data
- Reach: All chat users (cards); demo and screenshot viewers (seed)
- Files:
  - apps/web/src/pages/shell chat card containers (one max-width, one tool-line spacing)
  - relayed-message rendering (collapse into a one-line 'Messaged X')
  - packages/testkit/src/cli/demo/data.ts (use the display name; drop the marker from data rows; give the won deal a value)
- Acceptance:
  - Consent, question and mail cards share one max-width.
  - A relayed message shows as one 'Messaged X' line.
  - Demo mail drafts sign with the signed-in display name.
  - No data row in a demo file or table reads 'MOCK DEMO DATA'.
- Needs product decision: false
- Dependencies/conflicts: None significant.
- Reopens: iteration 4 C29 (seed leftovers) partly

### C27 Bot panel, group chat pill and landing mark polish (P3, rank 27, effort S)
- Root cause: The bot settings footer keeps three styles (Advanced chevron row, Export plain text, red Clear conversation) at bot-panel.tsx:693; right edges disagree (Notifications ends x=1420, Add skill 1409, chevron 1418) and the monitor icon appears twice with no label; 'Computer is on' shows a black 340x215 box; the group chat '3 new messages' pill covers the last message's reaction icons; the landing mark circle is bg-muted at 1.11:1 against the page (Welcome.tsx:13-17, acceptance asked 3:1).
- Findings: R3-06, V1-13, J2-12, J3-12, R3-07
- Found by: R3, V1, J2, J3
- Evidence: observed by 4 walkers
- Reach: Bot owners; landing visitors
- Files:
  - apps/web/src/pages/shell/bot-panel.tsx:693 and header (one list of identical rows, destructive last; shared right padding; one labelled monitor button; placeholder 'Nothing running' instead of a black box)
  - group chat new-messages pill (offset above the composer)
  - apps/web/src/pages/Welcome.tsx:13-17 (lighter circle token or outline at 3:1)
- Acceptance:
  - Bot panel footer rows share one style and right edge within 2 px.
  - Computer preview with nothing running shows a text placeholder.
  - The new-messages pill does not overlap message action icons.
  - Landing mark circle contrast is at least 3:1.
- Needs product decision: false
- Dependencies/conflicts: bot-panel.tsx also C11 (Notifications switch row); Welcome.tsx independent.
- Reopens: iteration 4 C24 (footer three styles) and C27 (mark contrast)

## Deferred items
- V3-12: Artifacts list: add a Type column and type filter (P3, single page, not a root cause shared with others).
- J1-09: Hide amounts: optional "Amounts hidden" indicator (P3, suspected, not user-tested).
- J1-10: Chief Connect card logos empty once on a dev server (P3, probably load, recheck on a built bundle).
- R2-05: Legal Overdue tile not clickable: dropped, J2 (STORY-LEG-007) observed the tile as a link opening the filtered Deadlines tab.
- V2-08: Legal Deadlines repeat Ask agent / Done / Dismiss on each row: dropped, iteration 4 C16 asked for these row actions and R2 praised them.
- J2-09-style background toasts: folded into C4 with a decision.
- Perf timings (J1-04, J1-05, V1-15, V2-18, V3-02): dev-server numbers on a shared stack; C8 and C14 require a re-measure on a production build and an idle stack before closing.
- Pass-1 deferred items (UXV-5 tablet shell, UXV-6, UXV-8 Gmail writes, UXV-10 to UXV-12) were not re-walked and stay deferred.
- Iteration 4 FLOW-10 second part (should Chief read the Finance summary itself): still no owner answer recorded; not raised again.

## BLOCKED or not walkable
- STORY-APP-309 (steps 2-7, 10-12) and STORY-APP-319 (model sign-in): the demo has a default model; real provider sign-in is not possible.
- Real OAuth Connect buttons (Gmail, Calendar, Carta connect STORY-CAP-017, Devin key for R1 C8 'row appears after connecting'): leave for real services.
- STORY-LEG-001 'Scan now' and STORY-LEG-017: the Legal model key is rejected in the demo; scans cannot run.
- STORY-DRM-109 zip, 600 MB video and password-zip steps: need crafted large files. STORY-FIN-022 reconnect state and STORY-APP-210, 212, 213, 214: out of scope or no fixture.
- STORY-APP-385/386 approve and deny were not conclusive: another walker shared the account (C5 needs a private-account re-walk). R1 C2 failure path (run ends without a reply) could not be triggered.
- Not covered: touch measurements by J1, V2 and V3 (no coarse-pointer emulation; R3, V1 and J3 did measure), tour at phone width by J3, C19 approval card body font, C13 held-message single re-send, Light theme, desktop-only controls, production-build timings.

## Counts by severity
- Clusters: 27 (P0 0, P1 5, P2 16, P3 6)
- Raw findings: R1 9, R2 11, R3 12, J1 10, J2 17, J3 13, FLOW 10, V1 16, V2 20, V3 18 = 136. 131 are in clusters, 5 deferred or dropped (listed above).
- Clusters needing a product decision: C4, C9, C15, C18, C21, C22
- Clusters that reopen an iteration 4 cluster whose criteria were not met: C1, C3, C5, C6, C7, C8, C9, C10, C11, C12, C13, C14, C15, C16, C17, C18, C21, C22, C23, C25, C26, C27
- P0: none. Nothing blocks work or causes data loss or a wrong payment. The five P1 clusters are a truncated ownership figure, a keyboard trap, the first-run tour, toasts over approval buttons, and a payment refusal with no next step.
