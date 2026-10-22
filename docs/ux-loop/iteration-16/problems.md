P0: 0, P1: 2, P2: 12, P3: 7

# Iteration 16 problems: fix clusters

Sources: R1-R3 (verify pass-15 clusters C1-C25), J1-J3 (journeys; J3 at 375 px with a real coarse pointer), FLOW, V1-V3 (visual), all on the mock demo stack (web 5381). Iterations 1-15, docs/ux-flow and docs/ux-visual were read. Findings were deduplicated, checked against code where cheap, and clustered by root cause. A pass-15 cluster whose criteria are not met has a 'Reopens' line. Rank: P0, then severity x reach / effort.

Owner decisions respected and not re-raised: tour stays nine stops with a fixed card; the page is called Integrations (sidebar and account menu); consent asked once per area; 44 px on coarse pointers; Legal row actions Ask agent / Done / Dismiss (V2-12 dropped); approval toasts persist, bottom-right; Settings in five sections with Memory under Advanced; no model step on the demo; Carta-only agent for the cap table; Mercury is the only SAFE record; Hide amounts hides money in app UI only; no cache for Integrations (revisit skeleton expected).

Environment caveats: the demo is shared by about ten walkers, so Hide amounts, counts and load times changed under everyone. Only J3 had a true coarse pointer. Latency findings are inflated by load and were lowered.

Severity calls: no P0 (no money moved wrongly, no data lost on a verified path). P1 only where a founder on a core journey ends with no way forward: C1 (an approved email fails with internal wording and no recovery, seen by J3 and V2 on the first try) and C2 (Draft reply on an audit request gives no outcome, so a second click is likely). Lowered from reported P1: V2-01 Legal Graph 24 s (load, page does load) to P3 in C19; V2-02 'Open the document' plain text in a chat reply to P2, not clustered below because it needs tracing (see Deferred); J1-01 first sort stall (scripted model, retry exists) to P2 in C12.

## Pass-15 cluster verification (R1-R3)

- Met: C2 Ask agent covers mail (R1), C3 Data room row vs badge (R1), C7 phone tour (R1), C11 Legal phone cards and Reopen (R2), C12 Activity (R1, R2), C13 scan feedback (R2), C15 toast vs docked chat (R2), C16 raised figure (R1, R2), C17 empty Investors/Fundraising (R2), C18 Inbox skeleton and filter (R1, R2), C21 palette and focus (R3), C22 axe (R3), C25 Contacts at 1920 and empty state (R1, R3), C1 chat reply masking (R1, V1), Storybook smoke 1747/1747 (R3).
- Not met (reopened): C9 Data room list (here C6), C10 Finance chart (C9), C11 Legal table alignment (C3), C19 request counts (C19), C20 touch and GTM link (C8, C5), C23 Models card and Advanced group (C15), C24 routines heading/icon (C10), C14 Mercury link (C17), C6 Settings during load (C11), C8 Integrations first frame (C20).
- Unverified: coarse-pointer hit areas for C3, C5 (no emulation for R1, R2, V1-V3), C24 new Mercury chat suggestions (thread already used), Reply From line.

## Fix clusters, ranked

### C1 [P1] A delegated email send fails with internal wording ('connected account') and no way to recover
- Rank: 1. Effort: S.
- Finding ids (found by): J3-01 (J3), V2-03 (V2)
- Root cause: mail send resolves the account only when the model passes it; with more than one mail account (or when inference fails) the tool returns a developer sentence, the card prints it, and the failed card has no Open in composer button because onOpenComposer is passed only when the card carries a connectionId or accountFromThread.
- Verification: OBSERVED by J3 (card 'Not sent' with raw text) and V2 (another walker's thread). Code CONFIRMED: mail-tools.ts:700-705 returns the developer sentence; transcript.tsx:1768 gates onOpenComposer on block.mail.connectionId || accountFromThread. Why the account is missing on some delegated sends is not traced (V2: intermittent).
- Files to change:
  - packages/adapters/src/mail-tools.ts:693-705 (resolve the account on the server: use the account of the thread/draft, else the default account; if still ambiguous return a plain question, not 'Pass account (the address from the row's acct: field)')
  - apps/web/src/pages/shell/transcript.tsx:1768-1783 (always pass onOpenComposer for a mail approval card; fall back to the draft's own account)
  - apps/web/src/components/MailApprovalCard.tsx:476-486 (failed state: plain sentence plus 'Open in composer' and 'Try again')
  - tests: packages/adapters mail-tools test and MailApprovalCard.test.tsx
- Reach: Anyone who asks an agent to send mail on an install with two or more mail accounts, or when the approval is relayed from another bot. Core daily journey; J3 and V2 each hit it on the first or second try.
- Acceptance criteria:
  - A mail_send from a bot with two connected accounts and no account argument either sends from the account the draft/thread belongs to or asks which account in plain words; the string 'acct:' never reaches the card or the agent reply.
  - A failed send card shows a plain reason and an 'Open in composer' button in every case (with and without connectionId); clicking it opens the composer with To, Subject and body filled.
  - Unit test: mail_send without account on two accounts does not return the developer message; card test: failed card renders the button with no connectionId.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C14

### C2 [P1] Investors 'Draft reply' on an audit request ends with no visible result
- Rank: 2. Effort: S.
- Finding ids (found by): J2-01 (J2)
- Root cause: onDraftAudit only calls rpc.investors.audits.draft and refreshes; the agent's answer lives in the closed Ask panel and the row has no 'working' or 'ready' state beyond the 15 s button label, so the button returns to 'Draft reply' as if nothing happened.
- Verification: OBSERVED by J2 on the demo (outcome text depends on the scripted model). Code CONFIRMED: Investors.tsx:1162-1166 only calls the rpc through auditAction; no panel open and no result state.
- Files to change:
  - apps/web/src/pages/Investors.tsx:1162-1166 (open the Investors agent panel when a draft starts, or surface the outcome)
  - apps/web/src/components/investors/ActionItems.tsx:78-126 (row states: Drafting, Draft ready / Needs your input with the agent's one-line reason)
  - apps/api audit draft handler (return a status the row can show)
- Reach: Every founder answering an auditor or investor confirmation request from Investors (STORY-CAP-019). The button is the only entry point.
- Acceptance criteria:
  - After clicking Draft reply the Ask panel opens on the audit conversation (or the row shows 'Draft ready' / 'Needs your input: <reason>') within 20 s; the button never returns to its idle label without an outcome on screen.
  - A second click while a draft is running does nothing and the row says it is running.
  - Component test for the three row states.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C18

### C3 [P2] Legal contracts table: names still truncate while Term and Renewal have spare width; Status column shifts the layout; page jumps when the scan banner goes
- Rank: 3. Effort: S. Reopens: iteration-15 C11.
- Finding ids (found by): J1-05 (J1), J2-02 (J2), FLOW-07 (FLOW), V2-04 (V2), V2-05 (V2), R1-09 (R1), R2-01 (R2), R2-02 (R2), V2-06 (V2)
- Root cause: Fixed percentage columns give Contract 15-19% and Term/Renewal 22% each, so the row identity is the narrowest column; the Status column and the 'not yet checked' banner appear and disappear and move everything.
- Verification: OBSERVED by 6 walkers. Code CONFIRMED: LegalContracts.tsx:175-181 widths 15/11/7/22/22/8/15 with Status shown. Deadline-count dip (R2-02) is observed once, cause suspected.
- Files to change:
  - apps/web/src/pages/legal/LegalContracts.tsx:170-185 (colgroup: Contract about 26%, Parties about 17%, Term and Renewal to content; keep the same widths whether or not Status shows; render Active as the same pill or hide the pill for all normal states; center pills so baseline spread is 1 px)
  - apps/web/src/pages/Legal.tsx (reserve the banner row or fold 'N documents not yet checked' into the header status line)
  - apps/api Legal scan merge (write deadlines in one transaction so the Deadlines count does not dip 9 to 8 to 9)
  - Legal graph component (minimum rendered label size about 11 px at 1440)
- Reach: Everyone who opens Legal; seen by 6 of 10 walkers. Reopens pass-15 C11 (spread 3 px on pill rows, names still cut).
- Acceptance criteria:
  - At 1440 'MOCK Insurance Policy - ...' shows at least 30 characters; no contract name is cut while Term or Renewal has more than 60 px of free space.
  - Column x positions are identical before and after a scan adds a Draft/Unknown row.
  - Baseline spread of cell text is at most 1 px on every row including pill rows.
  - Scan finishing does not move the tabs by more than 4 px; Deadlines count never drops during a scan.
  - Graph labels render at 11 px or more at 1440.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C4 [P2] Inbox mail dialog and send feedback: Add to Data room gives no message, Sending... lingers, Reply all on one recipient, repeated Sent text, To do card jumps
- Rank: 4. Effort: S.
- Finding ids (found by): J1-02 (J1), J1-06 (J1), J1-07 (J1), J1-09 (J1), J1-10 (J1), V2-07 (V2), V2-08 (V2), V2-13 (V2)
- Root cause: MailAttachments sets state to 'added' but shows no message (only downloads have a status line); the send toast keeps 'Sending...' after Undo expires; More always offers Reply all; the agent repeats the Sent fact three times; the To do card drops its rows when Show more is expanded; the dialog leaves an 8 px right gutter beside the agent panel.
- Verification: OBSERVED by J1 and V2. MailAttachments.tsx code CONFIRMED; the rest not located.
- Files to change:
  - apps/web/src/components/inbox/MailAttachments.tsx:121-138 and :454-459 (status line 'Added to Data room')
  - send queue / toast (hide once Undo expires or show Sent when accepted)
  - mail dialog More menu (hide Reply all for one recipient)
  - apps/web/src/components/inbox/InboxMessageDialog.tsx:148 (cap width at 100vw - left - 24px)
  - apps/web/src/components/inbox/EmailAgentPanel.tsx (hide the thread card when the mail is visible)
  - apps/web/src/pages/Inbox.tsx:1071-1076
- Reach: Daily inbox users. Only J1-02 is P2: the user cannot tell whether the click worked.
- Acceptance criteria:
  - Add to Data room shows 'Added to Data room' within 1 s.
  - The Sending toast disappears within 2 s of the provider accepting.
  - Reply all is absent for a single-recipient mail.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C12, C16

### C5 [P2] GTM is handled differently from every other page: cannot be hidden, missing from Cmd+K pages, adds an empty 'GTM agent' chat, and its page layout is unfinished
- Rank: 5. Effort: S.
- Finding ids (found by): FLOW-01 (FLOW), FLOW-02 (FLOW), FLOW-05 (FLOW), R1-06 (R1), R1-07 (R1), R2-05 (R2), V3-11 (V3)
- Root cause: The sidebar renders GTM by hand outside the pages array (Shell.tsx:4607-4620 has no gtm entry), so the Pages menu and the palette's page list never see it; pageAgentKind has no gtm key so the auto-created GTM agent shows as a loose top-level chat; the row is a button, not a link; the Channels table has no cell padding and an empty 'Written by GTM agent' box shows.
- Verification: OBSERVED by 5 walkers. Code CONFIRMED: Shell.tsx:4607-4618 pages array lacks gtm while :4680 checks hiddenPages for it; PageAgentIntro.tsx:9-16 has no gtm key.
- Files to change:
  - apps/web/src/pages/Shell.tsx:4607-4620 (add gtm to the pages list so the menu, hiding and the palette share it; add Settings and Integrations to the palette page list if the owner agrees)
  - apps/web/src/pages/Shell.tsx:4680-4690 (render the GTM row as SidebarPageLink with an href)
  - apps/web/src/components/PageAgentIntro.tsx:9-16 (add the gtm spawn key to PageAgentKind/pageAgentKind so it folds into Page agents)
  - GTM page Channels table (cell padding like Legal/Contacts; hide the empty 'Written by' box)
- Reach: Every user: GTM is in the sidebar for all; FLOW found it on opening the page once.
- Acceptance criteria:
  - The Pages menu lists GTM and unchecking it hides the row; Cmd+K shows GTM once under Pages and the agent once.
  - Opening /app/gtm on a space with no GTM chat does not add a top-level chat row; the agent appears under Page agents.
  - The GTM sidebar row is an <a href> (open in new tab works).
  - Channels table cells have the same left inset as the Contacts table; no empty caption box.
- Needs product decision: true. Should Cmd+K also list Settings and Integrations as pages (V3-11)? Recommended: yes, one line each.
- Depends on: none. Conflicts (shared files): C7, C8, C10, C14, C16, C19

### C6 [P2] Data room list: Type and Parties truncate while Name has hundreds of empty pixels; failed row shows Delete next to the folder tag
- Rank: 6. Effort: S. Reopens: iteration-15 C9.
- Finding ids (found by): V3-01 (V3), V3-09 (V3), J2-06 (J2), J3-04 (J3), R1-08 (R1), V3-13 (V3), V3-14 (V3)
- Root cause: Type and Parties are narrow fixed columns; Name takes the slack (about 800 px dead at 1920). On a failed row the Delete button sits inline in the Name cell above the reason, and the reason is hidden when the preview pane is open. Unreadable files correctly offer Delete only (ItemRows.tsx:269-284).
- Verification: OBSERVED by 5 walkers. FLOW-06 'add Try again' is dropped: ItemRows.tsx:269-284 already offers Try again for transient failures and Delete only for unreadable files (by design).
- Files to change:
  - apps/web/src/components/data-room/ItemRows.tsx (column widths: Name capped, Type and Parties take the slack; failed row: reason under the name at every width, Delete in the row menu or on its own line, one signal on phone at most 64 px; Type cell 'Unreadable' instead of blank)
  - apps/web/src/components/data-room/FilterBar.tsx (counts beside Type/Party options)
  - apps/web/src/pages/DataRoom.tsx (upload toast names the destination folder)
- Reach: Everyone with a Data room; the failed-row part affects anyone with one unreadable file. Reopens pass-15 C9.
- Acceptance criteria:
  - At 1440 and 1920 'Investor document' and party names show without ellipsis when Name is wider than 400 px.
  - A failed row is at most 56 px at 1440 and 64 px on phone, shows its reason in the list, and has one delete path.
  - Upload toast reads 'Uploaded to <folder>'.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C7 [P2] First-run tour waits for Chief's connect cards, can disappear on reload, and highlight/copy details
- Rank: 7. Effort: S.
- Finding ids (found by): J1-03 (J1), J3-08 (J3), V1-03 (V1), V1-04 (V1), V2-17 (V2)
- Root cause: tourOpen requires !connectCardsWaiting, so an unconnected Calendar card on Chief keeps the tour from starting until the user leaves Chief; tour state is not kept across reload; the step-1 and step-9 rings are cut by the viewport edge; step 1 text repeats the control name.
- Verification: OBSERVED J1 (tour only began on Inbox) and J3; cause CONFIRMED in code: Shell.tsx:2781-2790 connectCardsWaiting.
- Files to change:
  - apps/web/src/pages/Shell.tsx:2781-2795 (start the tour once the first question is answered or any connect card is connected, or let a dismissed card release it)
  - tour state in Shell.tsx (keep the step across reload; the account menu 'Take the tour' stays)
  - tour highlight ring (inset on viewport/sidebar edge); drop 'Search:' prefix; left-align counter without Skip
- Reach: Every new user. Tour stays nine stops with a fixed card (owner decision).
- Acceptance criteria:
  - After connecting one app and answering the first question the tour starts on Chief without opening another page.
  - Reload during the tour restores the same step.
  - Rings are fully inside the viewport at steps 1 and 9.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C5, C8, C10, C14, C16, C19

### C8 [P2] Touch and keyboard hit areas: drawer page rows are 40 px, Inbox row hover is not touch-guarded, Resize handle has no focus ring, failed-file badge is 19x25
- Rank: 8. Effort: S. Reopens: iteration-15 C20.
- Finding ids (found by): J3-02 (J3), R2-05 (R2), V3-06 (V3), V3-07 (V3)
- Root cause: Page rows lack pointer-coarse:min-h-11; InboxRow uses hover:bg-muted unguarded; the folder resize separator and the sidebar badge button miss focus-visible and minimum size.
- Verification: OBSERVED (J3 measured 295x40). Code CONFIRMED for InboxRow.tsx:314 hover. Reopens pass-15 C20.
- Files to change:
  - apps/web/src/pages/Shell.tsx (SidebarPageLink around :4674: pointer-coarse:min-h-11)
  - apps/web/src/components/inbox/InboxRow.tsx:314 (hover:bg-muted to [@media(hover:hover)]:hover:bg-muted)
  - apps/web/src/components/data-room/ResizableFolders.tsx (focus-visible ring)
  - Data room sidebar badge button (24x24 minimum, 44 px coarse)
- Reach: All phone users (every drawer visit); J3 measured it with a real coarse pointer.
- Acceptance criteria:
  - With pointer: coarse each drawer page row is at least 44 px high.
  - Tapping an Inbox row on touch leaves no sticky hover background.
  - Tab onto Resize folders shows a visible ring; the failed badge is at least 24x24 px.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C5, C7, C10, C14, C16, C19

### C9 [P2] Finance burn chart still draws the partial month as two dots that read as '8'; quarter and year views start empty; bars are 33 px wide
- Rank: 9. Effort: M. Reopens: iteration-15 C10.
- Finding ids (found by): R1-02 (R1), R2-08 (R2), FLOW-04 (FLOW), V2-11 (V2), J3-05 (J3), J3-06 (J3), V2-10 (V2)
- Root cause: The current-month point is drawn as two stacked circles (actual and projected) 6 px apart; the quarter range starts at the first data quarter in 2025 with empty periods; the year range uses a third of the width and the y labels are clipped; the bar buttons have no 44 px hit area.
- Verification: OBSERVED in all three passes by 5 walkers; V2-10 (repeat of $7,500 on the Rent page) is P3 polish. Code location components/finance/charts.tsx not opened line by line.
- Files to change:
  - apps/web/src/components/finance/charts.tsx (partial month: one dashed segment ending in one dot with a tooltip; trim leading empty periods; left padding for y labels; inset the Financing label 8 px and anchor it to its marker; pointer-coarse hit areas of 44 px)
  - apps/web/src/pages/finance/FinanceBurn.tsx
  - apps/web/src/pages/finance/ (category page: skip the Vendors card when there is one vendor)
  - charts.layout.test.tsx, charts.stories.tsx
- Reach: Every Finance visit, desktop and phone. Seen by 5 walkers across 3 passes; reopens pass-15 C10.
- Acceptance criteria:
  - At 1440 and 375 the Oct* point renders as a single mark; no two circles within 8 px of each other.
  - Quarter view's first plotted quarter has data; Year view fills the plot width and no y label is clipped.
  - With coarse pointer each month control is at least 44 px wide.
  - Layout test fails if two markers overlap.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C10 [P2] Routines: Test run reports Done when the bot only delegated; Test run is disabled with no reason; computer heading and monitor icon remain on a routines-only panel
- Rank: 10. Effort: M. Reopens: iteration-15 C24.
- Finding ids (found by): J2-04 (J2), R3-16-04 (R3), R3-16-03 (R3), J2-08 (J2)
- Root cause: A routine run is marked Done as soon as the bot has messaged a peer, not when the peer answers; Test run is disabled until a schedule is saved with no hint; the chat header uses a Monitor icon for Routines and the panel prints an empty "{bot}'s computer" heading.
- Verification: J2-04 OBSERVED on the scripted demo model (wording may differ with a real model); runner not located. R3 items OBSERVED; Shell.tsx:5958 Monitor icon CONFIRMED.
- Files to change:
  - routine runner / run-status code in apps/api (status 'Waiting on <agent>' until the peer replies)
  - apps/web/src/pages/RoutineSchedule.tsx and the routine editor (tooltip 'Save a schedule first', or allow Test run on an unsaved routine)
  - apps/web/src/pages/Shell.tsx:5958 (Clock/Calendar icon for the Routines panel), computer panel heading (hide when no screen exists)
- Reach: Anyone who creates a routine; run status is the only proof it worked. Reopens pass-15 C24 (heading and icon).
- Acceptance criteria:
  - A routine whose run only delegated shows 'Waiting on Inbox agent' and becomes Done after the reply.
  - Disabled Test run shows why on hover and focus.
  - Routines-only panel has no empty computer heading and uses a clock/calendar icon.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C5, C7, C8, C14, C16, C19

### C11 [P2] Settings: Escape does not close the Memory section; Settings does nothing while an agent chat or GTM page is still loading
- Rank: 11. Effort: S. Reopens: iteration-15 C6.
- Finding ids (found by): V1-02 (V1), R1-03 (R1)
- Root cause: Escape is cancelled when panelBusy is true; MemorySettingsOverlay reports busy only while an action is pending (pending !== null), so the V1 explanation does not fit the code and the real cause is not found. The Settings open handler appears to depend on route data.
- Verification: OBSERVED twice by V1; R1 saw 0 of 3 opens during loading. Cause SUSPECTED only; V1's busy theory does not match MemorySettingsOverlay.tsx:100.
- Files to change:
  - apps/web/src/pages/SettingsOverlay.tsx:226-237 (reproduce Escape on Memory, find who sets busy or who keeps focus)
  - apps/web/src/pages/MemorySettingsOverlay.tsx:100-108
  - account menu Settings open handler in Shell.tsx
- Reach: Keyboard users; anyone clicking Settings during a slow chat load. Reopens pass-15 C6.
- Acceptance criteria:
  - With Memory selected, one Escape closes the dialog unless a save is in flight.
  - Account menu > Settings opens within 200 ms on an agent chat that is still loading.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C12 [P2] First mail sort for a new user can stall for over a minute, and the sorted result puts most mail under Needs reply
- Rank: 12. Effort: M.
- Finding ids (found by): J1-01 (J1), J1-04 (J1), J3-07 (J3)
- Root cause: Suspected: triage starts late after consent, and the demo classifier is permissive. Not traced; the sort wait text exists (pass-15 C18).
- Verification: OBSERVED once for a fresh user (70 s); cause SUSPECTED. Needs a run on a real model to be a verified defect.
- Files to change:
  - apps/api inbox triage job start (start on the Allow click; log time to first result)
  - triage prompt/threshold (Needs reply only for mail that asks a question)
  - apps/web/src/pages/Inbox.tsx (hold group moves while a menu or dialog is open)
- Reach: Every new user's first Inbox visit. Lowered from J1's P1: scripted demo model, a 'taking longer' message and 'Try sorting again' exist, and the wait was in the same range recorded as deferred in pass 15 (FLOW-01/J1-01).
- Acceptance criteria:
  - On the demo, first sort finishes in under 30 s after consent or a time-based note appears by 15 s.
  - Under 40% of a 24-mail mailbox lands in Needs reply.
  - Rows do not move under an open row menu.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C4

### C13 [P2] Data room preview is blank on a phone for a PDF
- Rank: 13. Effort: S.
- Finding ids (found by): V3-02 (V3)
- Root cause: The preview embeds the PDF blob in an iframe with #toolbar=0; mobile browsers do not render PDFs in iframes, and the frame shows no fallback.
- Verification: OBSERVED by V3 at 375; cause (iframe PDF on mobile emulation) SUSPECTED, not confirmed on a real phone.
- Files to change:
  - apps/web/src/components/data-room/Preview.tsx (below the md breakpoint or when the iframe load cannot be confirmed, show the thumbnail plus Open and Download)
- Reach: Phone users previewing any PDF in the Data room (J3 saw other previews fine).
- Acceptance criteria:
  - At 375 a PDF preview shows either the document or a thumbnail with Open and Download; never an empty frame.
  - Desktop preview is unchanged.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C14 [P2] A page agent that asks another agent to do something leaves the founder to find where to approve
- Rank: 14. Effort: M.
- Finding ids (found by): J3-03 (J3), R2-04 (R2)
- Root cause: The approval card is created in the delegate's thread. The delegating chat only shows 'Waiting for approval' and a small inline 'Open Inbox agent' link; the link is two 21 px lines on a phone and, once, did not navigate from the docked chat.
- Verification: OBSERVED by J3 (card in other thread); R2-04 observed once, not reproduced. Code location transcript.tsx rk-chat-app-link not opened in detail.
- Files to change:
  - apps/web/src/pages/shell/transcript.tsx (rk-chat-app-link: render a full-width 'Review email' / 'Open Mercury agent' button with 44 px height when a delegate has a pending ask)
  - apps/web/src/pages/Shell.tsx (docked-chat link handler: navigate or open that agent in the dock)
  - apps/web/src/components/ChatComposer (placeholder names where approval is needed)
- Reach: Anyone using Chief or a page agent to send mail or pay (core flow). J3 and R2 each hit it.
- Acceptance criteria:
  - With an approval pending in a delegate, the delegating chat shows a button that opens that thread in one click, 44 px high on coarse pointer.
  - From a docked chat the button changes the route to the agent (test with Open Mercury agent).
  - R2-04 re-test: link click never leaves the URL unchanged.
- Needs product decision: false
- Depends on: C1 (same mail approval flow, different files). Conflicts (shared files): C1, C5, C7, C8, C10, C16, C19

### C15 [P3] Settings and bot-panel hierarchy: Models section floats without a card, the expanded Advanced group looks like top-level fields, and small control mismatches
- Rank: 15. Effort: S. Reopens: iteration-15 C23.
- Finding ids (found by): V1-01 (V1), R3-16-01 (R3), V1-07 (V1), R3-16-02 (R3), V1-08 (V1), V1-10 (V1), V1-11 (V1), J2-07 (J2), V1-09 (V1)
- Root cause: Models is a sentence plus a button without the card style General uses; expanded Advanced fields use the same left edge and weight as the top level; the two selects differ; the long bot name wraps the panel title; skill fields are inset 10 px.
- Verification: OBSERVED by V1, R3, J2. No code check beyond file names.
- Files to change:
  - apps/web/src/pages/ModelSettingsOverlay.tsx and SettingsOverlay.tsx (card with 'Model' title)
  - apps/web/src/pages/shell/bot-panel.tsx (indent or divide the Advanced group; truncate the title; skill form width)
  - General selects: one select component for Language and Time zone
  - Privacy: style 'Per model and documents' as a link
- Reach: Anyone opening Settings or a bot panel; cosmetic. Reopens pass-15 C23 (Models card, Advanced group).
- Acceptance criteria:
  - Models uses the same card as General.
  - Expanded Advanced fields are indented at least 12 px or under a divider.
  - An 80-character bot name keeps a one-line header of fixed height.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C16 [P3] Sidebar, Activity and phone chat polish
- Rank: 16. Effort: S.
- Finding ids (found by): V2-09 (V2), V2-19 (V2), V3-12 (V3), V2-14 (V2), V2-15 (V2), V2-16 (V2), V1-12 (V1)
- Root cause: Sidebar rows and panels size to content: the Working indicator wraps titles, Activity takes 190 px, Page agents sit under the fade; phone Inbox and email panel have small alignment gaps.
- Verification: OBSERVED. V1-12 (eight font sizes) is a token cleanup, deferred.
- Files to change:
  - apps/web/src/pages/Shell.tsx sidebar chat row (indicator in the status line)
  - sidebar Activity panel (cap height, scroll)
  - apps/web/src/components/inbox/EmailAgentPanel.tsx (remove 12 px indent)
  - chat scroll container (top fade)
  - Inbox header (space name in header on phone)
- Reach: All users; cosmetic.
- Acceptance criteria:
  - Working state does not change row height.
  - Activity panel is at most 40% of the sidebar list.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C4, C5, C7, C8, C10, C14, C19

### C17 [P3] Mercury and payment copy sends the founder to Integrations for a recipient problem; the resolved recipient name changes without notice
- Rank: 17. Effort: XS. Reopens: iteration-15 C14.
- Finding ids (found by): R1-05 (R1), R2-03 (R2), J2-10 (J2)
- Root cause: The payment-refusal text ends with an 'Open Integrations' action that cannot add a bank recipient; the approval card shows the resolved name 'Acme Servo Supply (Mock)' for a request 'Acme (Mock)' without saying so.
- Verification: OBSERVED by R1, R2, J2. Reopens pass-15 C14 for the link; the card text not code-checked.
- Files to change:
  - apps/api executor.ts payment refusal (drop the Integrations link for 'no matching recipient'; say 'Add it in Mercury')
  - Mercury requestSendMoney card (show 'You asked for: <name>' when the resolved name differs)
- Reach: Anyone paying a new payee through the agent.
- Acceptance criteria:
  - The no-recipient reply has no Integrations link.
  - When the resolved recipient differs from the asked name the card shows both.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C18 [P3] Raised-money figure is explained on no page when a SAFE exists in Legal but not in Mercury; Contacts and Investors columns unclear
- Rank: 18. Effort: S.
- Finding ids (found by): FLOW-03 (FLOW), J2-09 (J2), R2-07 (R2), V3-08 (V3), V3-05 (V3)
- Root cause: Equity raised counts only funded Mercury SAFEs (owner decision), so Investors and Fundraising show nothing while Finance and Legal show $250,000; Investors contact rows show a '-' column; Contacts, Artifacts, Investors and Fundraising lack the space name that Legal/Finance/Inbox show; Contacts table does not meet the header gutter; Artifacts grid cards are half empty.
- Verification: OBSERVED. FLOW-03 depends on the demo's empty Mercury SAFE list.
- Files to change:
  - apps/web/src/pages/Fundraising*.tsx (empty SAFE card: '1 SAFE found in Legal' link)
  - apps/web/src/pages/Investors.tsx contacts list (amount or drop column)
  - apps/web/src/components/PageHeader.tsx (space name on every page)
  - Contacts table width; Artifacts grid card
- Reach: Founders with several spaces or a SAFE only in Legal.
- Acceptance criteria:
  - Fundraising empty SAFE card names a SAFE found in Legal when one exists.
  - Every page header shows the space switcher when there are several spaces.
- Needs product decision: true. When a Legal contract is a SAFE but Mercury has none, may Fundraising mention it (a hint only, not counted in Equity raised)? Recommended: yes, as a link.
- Depends on: none. Conflicts (shared files): C2

### C19 [P3] Cold load and refetch: bots/list and routines/list fire several times per load; slow first frames have no words
- Rank: 19. Effort: M. Reopens: iteration-15 C19.
- Finding ids (found by): R1-04 (R1), R2-06 (R2), V2-01 (V2), V3-04 (V3), V3-15 (V3), V2-18 (V2), V3-03 (V3)
- Root cause: Shell, sidebar and page components each own their query, so one reload issues 4-5 bots/list, 4-18 routines/list and 3 bootstrap calls; the Legal Graph, search and category pages show a bare skeleton or spinner for many seconds under load.
- Verification: OBSERVED counts by R1 and R2 (18 routines/list, 5 bots/list). Latency numbers are environmental; re-measure on an idle production build.
- Files to change:
  - apps/web/src/pages/Shell.tsx and sidebar data hooks (one shared query per key)
  - apps/web/src/pages/legal/ graph (text 'Building graph...' after 2 s; profile the request)
  - command palette (results per source as they arrive; 'Searching...' with words; truncate titles at the end)
- Reach: All users on a loaded server; walkers measured on a shared demo with about ten sessions, so absolute times are inflated. V2-01 reported P1 is lowered to P3 for that reason (the page does load).
- Acceptance criteria:
  - One cold load makes at most 2 bots/list and 2 routines/list calls (pass-15 criterion of 1 each was not met: 5 and 4).
  - A wait over 2 s shows words, not only a skeleton.
  - Search result titles keep their start.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): C5, C7, C8, C10, C14, C16

### C20 [P3] Integrations page: letter tiles for several apps, search and chips missing in the first frame on revisit
- Rank: 20. Effort: S. Reopens: iteration-15 C8.
- Finding ids (found by): V1-05 (V1), V1-06 (V1), R1-01 (R1)
- Root cause: Apps without a logo use gray letter tiles; the page header (search, chips) renders after its data query; the skeleton chips differ from the loaded chips.
- Verification: OBSERVED; repeat of pass-15 C8 minus the cache criterion.
- Files to change:
  - apps/web/src/pages/Integrations*.tsx (IntegrationsHome: header outside the data branch; one tile style; equal card height)
- Reach: Anyone opening Integrations; the no-cache decision from pass 15 stands (skeletons on revisit are expected).
- Acceptance criteria:
  - Search and chips are in the first frame; card heights in a row match.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

### C21 [P3] Agent-written text: third-person relay to the user, no action on a drafted Legal notice
- Rank: 21. Effort: S.
- Finding ids (found by): J1-08 (J1), J2-05 (J2)
- Root cause: Model output: Chief tells the user 'Maya's mail'; the Legal agent drafts a non-renewal notice as plain chat text with placeholders and no Open in composer action.
- Verification: OBSERVED on the scripted demo model; prompts not located.
- Files to change:
  - Chief delegation prompt (address the user as 'you')
  - Legal agent instructions / tools (offer Open in composer)
- Reach: Occasional; model dependent.
- Acceptance criteria:
  - Relay replies say 'your mail'.
  - A drafted notice offers one action to open it in the composer.
- Needs product decision: false
- Depends on: none. Conflicts (shared files): none

## Deferred items (not in a cluster)
- V2-02 chat reply ends with 'Open the document' as plain text (P2): the link is likely blanked by urlTransform in packages/chat-ui/src/markdown.web.tsx:465 when the artifact tool emits a non-app href. Not traced to the emitting tool, so it needs a one-hour investigation before it can be a cluster; the artifact is reachable from Artifacts.
- J1-11 deadline text 'renews December 1' against term ending Dec 2: demo seed data.
- J1-12 empty Cleanup view (J1 says sparse, V2 says compact and good): conflicting, no action.
- V1-12 eight font sizes and off-scale spacing: token cleanup with a large diff and no user-visible defect.
- V3-10 phone Data room has no Grid or Stats view: owner decision on parity; recorded only.
- V3-05 Artifacts grid card size and V3-08 Contacts table width are inside C18 as P3; the rest of V3 P3 items were merged where they share files.
- J1-03 aside: Calendar connect card on Chief is the suspected tour block (in C7).
- J2-05 (Legal draft has no action) and J1-08 are model-text items in C21.
- R1-10 investor update draft is blank for about 6 s then shows 'Saving...' with no edit: P3, update page not located; fold into the next Investors pass.
- R1-02 C10 note about 'Hide amounts' percent strings: met (hidden entirely).
- Not verified live: pass-14/15 C14 delegated payment on a real model, C5 coarse hit areas, C4 send/undo toast on replied rows.

## BLOCKED stories
- STORY-APP-319 model step and Connect your apps (demo has a model and configured apps); STORY-CAP-106 Carta connect; Gmail/Calendar/Brex/Box/Slack/Notion OAuth.
- STORY-DRM-103/104/105 zip failures and DRM-109 large zip, video and password zip (need crafted files).
- Touch-target checks for R1, R2, V1, V2, V3 (pointer: coarse stayed false); only J3 measured them.
- STORY-APP-211 steps 1, 2, 4, 8-14 (reply-all, Carta prompt, forward, Chief talking points), STORY-APP-024, FIN-019..021/036 (model-dependent or shared data).
- Phone width for Legal, GTM, Investors, Fundraising; Updates pile; new Mercury agent suggestions; real Mercury approval; voice; native iOS.

## Counts by severity
- Clusters: 21 (P0 0, P1 2, P2 12, P3 7)
- Distinct finding ids in clusters: 97
- Needs a product decision: C5, C18
- P1: C1, C2
- P2: C3, C4, C5, C6, C7, C8, C9, C10, C11, C12, C13, C14
- P3: C15, C16, C17, C18, C19, C20, C21
