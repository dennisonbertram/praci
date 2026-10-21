# Iteration 3 problems: fix clusters

Sources: verifiers R1-R3 (`walk-R*.md`, pass-2 clusters C1-C32), journey walkers J1-J3, flow critique (`flow.md`), visual inspectors V1-V3. Pass-1 and pass-2 problem files, `docs/ux-flow/report.md` and `docs/ux-visual/problems.md` were read so that fixed or decided items are not raised again. A pass-2 cluster whose criteria still fail appears as a cluster that names its old id under 'Pass'.

Owner decisions: no iteration-1 or iteration-2 file records an answer. Decided by the merged work: Hide amounts only in the account menu, Settings split into General and Privacy and approvals, the page is called Apps, consent asked once per area, touch rule 44 px on coarse pointers. The tour length is still open (pass 2 built 'keep nine, reorder'); it is raised again as C11. Items that need an answer carry `needs_product_decision`.

Verification of claims against the code (checkout HEAD 80c70f036): confirmed Shell.tsx:4037 `max-h-[40vh]`, ActivityList.tsx:135 has no `shrink-0` (C1 cause), Inbox.tsx:1354 `min-h-28`, use-data-room-list.ts:35 `POLL_MS = 3_000`, Welcome.tsx:25 `<br />`, Legal.tsx:280 links to the unfiltered Data room, approval-ask.ts:288 fallback strings, finance-fake-tools.ts serves `getRecipients` but no single-item `getRecipient`/`getAccount` seen, AccountAccess.tsx:89 `scrollIntoView`, OwnershipDonut.tsx frameH. Not verified in code (marked suspected in the cluster): C4 mail tool mounting, C15 slow loads (dev stack, several walkers), C13 hand-off prompt location. Nothing was dropped as wrong; pass-2 clusters C9 (Storybook, 1498/1498 clean), C11 (width caps) and C1 (tour placement) were verified as met and are not raised.

Ranking: P0 first, then score = severity weight (P1 4, P2 2) x reach (1-3) / effort (XS 1, S 2, M 3).

## Clusters

### C1 Activity section in the sidebar opens at 9 px high and cannot be seen (P0, rank 1, score 24.0)
- Root cause: ActivityList.tsx:135 wraps the section in a div with max-h-[40vh] overflow-y-auto and no shrink-0. It sits in the workspace column, a scrolling flex column (Shell.tsx:~4219), so flex shrinks it to its padding. Verified in code: the class list has no shrink-0. This is the pass-2 C17 fix regressing or never taking effect.
- Findings: V3-01, R2-01
- Found by: R2, V3
- Evidence: observed by 2 walkers; DOM 8-9 px vs 249 scrollHeight; class verified in code
- Reach: Every user; the only place that says an agent needs an answer
- Files:
  - apps/web/src/pages/ActivityList.tsx:135 (add shrink-0)
  - apps/web/src/pages/ActivityList.test.tsx (assert the wrapper keeps its height in a flex column)
- Acceptance:
  - At 1440x900 and 375x812 [data-testid=activity-list] has clientHeight >= 120 px when it has rows.
  - Header, Filter toggle and Status filter visible; inner list scrolls.
  - Test renders the section inside a flex-col overflow-y-auto parent and asserts height > 0.
- Needs product decision: no
- Dependencies/conflicts: None. One-line fix; do first. Shares Shell.tsx sidebar region with C2 only by proximity.
- Pass: pass2 C17 (criteria not met, new bug); effort XS

### C2 Sidebar Pages list is clipped at 40vh, rows overprint it, labels are low contrast (P1, rank 2, score 6.0)
- Root cause: Shell.tsx:4037 caps the Pages group at max-h-[40vh] (360 px at 900 px tall) while seven 46-50 px rows need 384 px. Artifacts is half cut at 1440x900, hidden at 1280x800 and in the 375 drawer, with no scroll cue. The chat list scrolls under the Pages box with no divider or clip, so rows overprint it. Bot rows use two avatar slots (52 vs 56 px). Section labels use text-muted-foreground/60 (2.93:1).
- Findings: V1-01, V1-02, V1-13, V2-01, V2-02, V3-02, FLOW-02, R1-02, R1-03, R1-04, R2-19, J1-05, J3-01
- Found by: FLOW, J1, J3, R1, R2, V1, V2, V3
- Evidence: observed by 8 reporters, measured clientH/scrollH 360/384, 320/384, 325/384; max-h-[40vh] verified at Shell.tsx:4037
- Reach: Every user, every page, and the drawer on phones
- Files:
  - apps/web/src/pages/Shell.tsx:4037 (remove cap or use min(content,50vh)); row height 46->40 px; opaque bottom border on Pages box
  - apps/web/src/pages/Shell.tsx:~4321 (label colour token >= 4.5:1)
  - apps/web/src/pages/Shell.tsx bot row avatar slot (one fixed slot and height)
- Acceptance:
  - All seven pages fully visible at 1440x900, 1280x800 and in the 375x812 drawer, or a bottom fade appears when the box scrolls.
  - No chat row text overlaps the Pages box (divider or clip); bot row height spread is 0 px.
  - Section labels measure >= 4.5:1.
- Needs product decision: no
- Dependencies/conflicts: Same file as C14, C3, C28 and C15 (Shell.tsx); land C2 first, then rebase. C28 changes the chat list, so keep to the Pages box here.
- Pass: pass2 C6 (not met), pass1 C1; effort S

### C9 AI data sharing and Legal consent: duplicate labels, dead-end message, shown twice (P1, rank 3, score 6.0)
- Root cause: AiDataSharing.tsx:167 titles both switches 'Bots, mail, files and contracts', distinguished only by a raw model slug; the consent card says 'The text is sent to the AI model that runs your bots' without naming the data; opening Privacy shifts layout (CLS 0.0113). In the Legal chat the message 'Legal needs your permission to read your documents' has no Allow control in the thread; the same sentence shows twice (bubble and red bar, Allow only on the bar). Legal shows the consent card above a populated table, and Scan now is disabled without a reason.
- Findings: R1-07, R1-13, R3-11, J2-06, J3-10, FLOW-05, V1-04, V2-16
- Found by: FLOW, J2, J3, R1, R3, V1, V2
- Evidence: observed by 8 reporters
- Reach: Every user who opens Privacy, Legal or the Legal chat
- Files:
  - apps/web/src/components/AiDataSharing.tsx:167 (model display name as title; skeleton reserves height)
  - apps/web/src/components/ApprovalRulesSettings.tsx:131
  - apps/web/src/pages/Legal.tsx (hide card once consent exists; reason on disabled Scan now; card names data sent)
  - apps/web/src/pages/shell/composer-error.tsx (show message once, Allow inside it)
  - packages/contracts/src/legal.ts message text -> render as an action card in the thread
- Acceptance:
  - Each AI switch is titled by model display name (no slug as only differentiator).
  - Consent card names the data sent (sender, subject, preview, or document text) in one line.
  - Consent-required message appears once, with an Allow button inside it, in chat and on the bar.
  - CLS < 0.01 opening Privacy and approvals.
  - Disabled Scan now has a stated reason.
- Needs product decision: yes. Show one switch for the model in use and put the backup model behind an Advanced fold (FLOW-05), or keep one row per model labelled by display name (R1-07, matches ask-once-per-area)? Recommended: one row per area labelled by purpose, model name as small text; hide the backup row unless a backup is set.
- Dependencies/conflicts: Legal.tsx shared with C10; AiDataSharing only here.
- Pass: pass2 C4, C2 (not met), pass1 C16; effort S

### C14 Agent finished/failed toasts cover content on every page (P1, rank 4, score 6.0)
- Root cause: Toast host in Shell stacks up to three toasts (~360 px) over the open drawer, composer, Ask panel, Finance rows, Legal Done/Dismiss buttons and Data room chart for ~10-20 s; background routine toasts appear 6+ times in 10 minutes; rows reorder under the finger so a tap landed on the wrong agent.
- Findings: J3-05, J1-14, J2-13, V2-19, V3-15
- Found by: J1, J2, J3, V2, V3
- Evidence: observed by 5 walkers
- Reach: Every user with a running agent; worst on phones
- Files:
  - apps/web/src/pages/Shell.tsx toast host (position, cap)
  - toast sources for 'finished' events
- Acceptance:
  - Phones show at most 1 toast, positioned above the composer, never over the drawer.
  - 'Finished' toasts for an agent the user is not viewing are shown in the sidebar row only; failures keep a toast with View.
  - Toasts do not cover the open Ask panel's last message.
- Needs product decision: no (Default taken: finished = sidebar only, failure = toast.)
- Dependencies/conflicts: Shell.tsx (C2, C3, C15).
- Pass: pass2 C2 (toast part), pass1 C33; effort S

### C3 Touch targets under 44 px on phones (33 controls counted) (P1, rank 5, score 4.0)
- Root cause: Pass-2 C8 applied the 44 px rule only under pointer-coarse. With coarse pointer emulated, 33 controls stay under 44x44: hamburger and drawer icons 32 px (Shell.tsx h-8 w-8), composer 'Message' 28 px, Inbox pile tabs 25 px high, Compose/Cleanup/Filter 28-40 px, thread dialog buttons 28 px, chat Reply/React/More 28 px, Data room view toggles and Add files 32-34 px, preview icon buttons 28 px (PreviewActions size icon-sm), settings switches 32x18, Skip tour/Next 28 px, sign-in text links 24 px.
- Findings: R1-06, J3-02, V2-22, V1-11
- Found by: J3, R1, V1, V2
- Evidence: observed, measured by script (R1: 33 controls, J3 list)
- Reach: Every phone user, every page
- Files:
  - packages/ui-web (button icon sizes, switch) coarse-pointer min 44 px incl. hit-area pseudo-element
  - apps/web/src/pages/Shell.tsx hamburger/drawer header/composer/message actions
  - apps/web/src/components/inbox/InboxPileTabs.tsx, InboxMessageDialog.tsx
  - apps/web/src/components/data-room/PreviewActions.tsx:124, pages/DataRoom.tsx header
  - apps/web/src/components/tour/TourPopover.tsx buttons
  - apps/web/src/pages/Auth.tsx link padding + aria-invalid
  - touch-context Playwright script over 7 pages
- Acceptance:
  - Touch context (hasTouch, pointer: coarse) at 375x812 over chat, Inbox, Finance, Legal, Cap table, Data room, Contacts, Settings finds 0 visible controls under 44x44 (offenders printed).
  - Settings switches have a 44 px hit area.
  - Sign-in/sign-up links are 44 px tall.
- Needs product decision: no
- Dependencies/conflicts: Touches Shell.tsx (C2, C14), Inbox files (C17), DataRoom (C6). Land last of those, or per-file after each.
- Pass: pass2 C8 (not met); effort M

### C4 Mail agents report no mail access while the Inbox page lists the mail; failed runs take minutes (P1, rank 6, score 4.0)
- Root cause: Gmail card says Connected and the Inbox lists mail, but the Gmail, Founder mail, Sales mail and Inbox agents answer that mailbox tools are unavailable or the browser is signed out. The Inbox agent then delegates through Founder/Sales mail agents for 70 s to 5 min before giving up, and 'Reply to Morgan' never produces an approval card. Suspected: mail tools are not mounted for the demo mailbox / a connection made in chat, so the page reads a cache the agents cannot reach. Not traced to a line; file list is the starting point.
- Findings: J1-01, R2-02, R2-03, FLOW-10, V2-18
- Found by: FLOW, J1, R2, V2
- Evidence: observed by 4 walkers; cause suspected (demo runtime), also pass-2 C22 unmet
- Reach: Every user who asks an agent about mail; first-run Gmail connect
- Files:
  - packages/adapters/src/builtin-tools.ts (mail tools vs demo mailbox seed)
  - apps/api/src/inbox-agent.ts (delegation loop, hop cap, first-failure message)
  - apps/api seed for pending mail_send approval card
  - connect-card success handler (mount tools after connect)
  - apps/web/src/components/chat (collapse agent-to-agent rows, merge consecutive failure bubbles)
- Acceptance:
  - 'What needs my reply today?' returns a list matching the Needs reply count (18) within 30 s, or one plain failure message after the first failed read.
  - After connecting Gmail in chat, the next question about mail is answered from that mailbox.
  - Delegation is capped at 2 hops; no raw message ids in user-visible text.
  - A reply request produces a mail_send approval card in the demo.
- Needs product decision: no
- Dependencies/conflicts: Independent of other clusters. Needs the mock mailbox seed; do not change real Gmail paths.
- Pass: pass2 C22 (not met), pass1 C14; effort M

### C5 Money approval card still says 'a recipient' and 'an account'; Mercury writes-off dead end (P1, rank 7, score 4.0)
- Root cause: approval-ask.ts:258-290 resolves names with getRecipient and getAccount, but the emulated Mercury (finance-fake-tools.ts:110-131) serves getRecipients (line 131) and not the single-item calls, so the lookup fails and the fallback strings 'a recipient' / 'an account' show (verified: fallback at approval-ask.ts:288). With writes off, the Mercury agent says it cannot pay and never names the 'Allow changes in Mercury' switch. After Deny, the model raised a second identical card.
- Findings: R2-16, J2-01, J2-02, J2-03
- Found by: J2, R2
- Evidence: observed by 2 walkers; fallback string verified in code; emulator gap verified for getRecipients, single-item calls not found
- Reach: Every founder approving a payment
- Files:
  - packages/adapters/src/finance-fake-tools.ts:110-131 (add getRecipient, getAccount)
  - packages/adapters/src/approval-ask.ts:255-290 (on failed lookup show the raw id, not 'a recipient')
  - packages/contracts/src/integration-agent.ts (writes-off message names Apps > Mercury > Allow changes)
  - packages/adapters denied-tool result text (do not retry)
- Acceptance:
  - Approval card headline reads 'Send $1,200.00 to Acme from Checking?' on the demo.
  - On lookup failure the headline contains the id, never 'a recipient'.
  - Writes-off reply names where to turn writes on.
  - After Deny exactly one card exists (unit test on denied result).
- Needs product decision: no
- Dependencies/conflicts: Related to C26 (card component). Different files; no conflict.
- Pass: pass2 C21 (not met); effort S

### C6 Data room layout breaks at narrow widths and on phones (P1, rank 8, score 4.0)
- Root cause: With Preview open the list is ~110 px and names read 'MOCK SAFE -...' or 'MO C...'; search results at 390 px show the name in a narrow cell (ItemRows.tsx:238-300); the phone header stacks title, toolbar, workspace, search and two filter rows (~300-370 px of 812) before the first file; the processing strip wraps to 3 lines and repeats the failure shown on the row; Import and Add files are two add controls; Type column truncates while Name has dead width; Stats chart stretches few buckets to 410 px bars and keeps list-only filters.
- Findings: J2-04, R2-06, R2-07, R2-08, V3-03, J3-04, V3-04, V3-06, V3-07, V3-16, FLOW-06
- Found by: FLOW, J2, J3, R2, V3
- Evidence: observed by 5 reporters
- Reach: Every Data room user, all phone users
- Files:
  - apps/web/src/pages/DataRoom.tsx (header, panel widths, Import into Add files menu, filters behind one button on phones)
  - apps/web/src/components/data-room/ItemRows.tsx:238-300 (name on its own line)
  - apps/web/src/components/data-room/Preview.tsx (collapse folder tree / min list width)
  - apps/web/src/components/data-room/ProcessingStrip.tsx:34,57,108,130 (one line, nowrap, hide 0% bar, count filters to Failed)
  - apps/web/src/components/data-room/DataRoomStats.tsx:118-146 (cap bar width, title 'by document date')
- Acceptance:
  - File names fully readable (>= 20 characters) with Preview open at 1440 and with Preview plus the agent panel open.
  - At 375x812 the first file starts above y=450; strip is one line.
  - One add control in the header.
  - A failed file is announced once (row), strip shows a single count.
  - Stats bars max 24 px wide with a title naming the date used.
- Needs product decision: no
- Dependencies/conflicts: Same files as C7 (use-data-room-list, ProcessingStrip, DataRoom.tsx) and C3 (touch sizes). Do C6 and C7 in one branch or C6 first.
- Pass: pass2 C19, C18 (not met); effort M

### C15 Cold load and bootstrap: blank sidebar, long 'Opening Praci…', repeated spaces.list (P1, rank 9, score 4.0)
- Root cause: Hard loads show 'Opening Praci…' or 'Still opening… Try again' for 9-29 s, the sidebar is empty for 6-9 s and logout waits ~20 s before /sign-in. One tab made 96 /rpc/spaces/list calls in ~5 min. /integrations/setup showed bare 'Loading…' for 14 s. Likely inflated by the dev server and several walkers, so cause is suspected, not diagnosed.
- Findings: R1-10, J1-03, J1-12, J2-07, J3-06, V1-19, V2-20, V3-12, R3-05
- Found by: J1, J2, J3, R1, R3, V1, V2, V3
- Evidence: observed on dev stack; suspected
- Reach: Every user on every cold load (if it holds on a production build)
- Files:
  - apps/web/src/pages/Shell.tsx bootstrap (sidebar skeleton immediately; redirect to sign-in on session failure)
  - apps/web/src/App.tsx:118-128 (shell skeleton for /integrations/*)
  - spaces.list caller (fetch once, share via cache; poll >= 30 s)
  - apps/web/src/pages/Inbox.tsx first fetch size
- Acceptance:
  - First measure on a production build and record timings.
  - Sidebar skeleton paints within 200 ms of navigation; logout reaches /sign-in in < 2 s.
  - < 10 /rpc/spaces/list calls in 5 minutes of light use.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx shared (C2, C14); do measurement first, then fix only what holds.
- Pass: pass1 C38 (partly); effort M

### C26 Chat thread and approval card behaviour (P1, rank 10, score 4.0)
- Root cause: Opening an agent with 'Needs your answer' shows a blank thread then opens at the NEW divider with the question hidden; after answering an ask card focus goes to BODY; the thinking timer counts from the question time ('12m 4.5s'); the draft-skill Approve/Discard sit clipped at the panel bottom with no chat card; mobile PDF preview is scaled to ~5 px text; composer placeholder wraps at 375; Finance chat header takes 120 px on phones; empty Computer preview is a black 213 px block.
- Findings: V2-15, R2-15, R2-20, J2-11, J2-12, V2-17, V2-27, J3-11
- Found by: J2, J3, R2, V2
- Evidence: V2-15 observed once (load race suspected); others observed
- Reach: Anyone answering an agent
- Files:
  - apps/web/src/components/chat/ scroll anchor (open at pending question/approval)
  - apps/web/src/components/AskCard.tsx:~142 (focus composer after send)
  - chat thinking timer
  - apps/web/src/pages/Shell.tsx computer panel and bot skills list (sticky Approve/Discard; chat card for draft skill)
  - attachment preview component
- Acceptance:
  - A thread with a pending question opens scrolled to it.
  - After answering, document.activeElement is the composer.
  - Thinking timer starts at resume.
  - Draft skill has Approve/Discard in chat.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx shared; AskCard.tsx also in C5 indirectly.
- Pass: pass2 C21 (not met); effort M

### C11 First-run tour: still nine stops, popover issues, competes with Connect cards (P2, rank 11, score 3.0)
- Root cause: FirstRunTour.tsx steps array defines nine steps; pass 2 reordered them top to bottom and ended in the composer (the 'keep nine, reorder' option) but the product question was never answered. Tour opens while Connect Gmail/Calendar cards are on screen; step 3 popover hides Finance/Legal, step 9 hides Apps; at 375 the first Escape closes the drawer and not the tour; the step-9 ring is clipped at the bottom.
- Findings: R1-01, R1-12, FLOW-01, J1-07, V1-12
- Found by: FLOW, J1, R1, V1
- Evidence: R1 observed (9/9); FLOW suspected from code; V1 observed
- Reach: Every new user
- Files:
  - apps/web/src/components/tour/FirstRunTour.tsx (steps array)
  - apps/web/src/components/tour/TourPopover.tsx (~:98 Escape ends the tour first; inset ring)
  - apps/web/src/components/tour/FirstRunTour.test.tsx (step count and order)
  - apps/web/src/components/tour/*.stories.tsx
- Acceptance:
  - Step count equals the decision (<= 3 if cut) and the test asserts it.
  - Tour starts only after Connect cards are answered or skipped.
  - Escape ends the tour before the drawer closes; ring not clipped at 375.
  - Last step action ends the tour and focuses the composer.
- Needs product decision: yes. Cut the tour to three stops (Chief with an example question, Pages, Apps) ending in the composer (recommended, asked in passes 1 and 2), or record 'keep nine' as final and close the cluster?
- Dependencies/conflicts: Same files as nothing else; independent.
- Pass: pass2 C3 (decision still open), pass2 C1 (met), pass1 C20; effort S

### C24 Landing hero and auth page polish (P2, rank 12, score 3.0)
- Root cause: Welcome.tsx:25 hard <br /> leaves 'cash,' orphaned at 375; the Sign up CTA is ~1.2:1 against the page and no stronger than the Sign in link; sign-in/up links are 24 px tall, inputs lack aria-invalid, hint is 11 px; a typed reset link with a bad token still shows 'Choose a new password' over 'Invalid token'.
- Findings: J3-08, V1-10, V1-11, R2-18
- Found by: J3, R2, V1
- Evidence: observed; <br /> verified at Welcome.tsx:25
- Reach: Every visitor
- Files:
  - apps/web/src/pages/Welcome.tsx:22-28 (text-wrap: balance, filled Sign up)
  - apps/web/src/pages/Auth.tsx:354-416 (heading 'Reset link expired', aria-invalid, link padding)
- Acceptance:
  - No single-word line at 375; Sign up has a filled inverse style.
  - Invalid reset link heading reads 'Reset link expired'.
  - Error inputs have aria-invalid.
- Needs product decision: no
- Dependencies/conflicts: Link padding overlaps C3.
- Pass: pass2 C16 (met, residual); effort S

### C7 Data room polling, keyboard cost and skeleton flash (P1, rank 13, score 2.7)
- Root cause: use-data-room-list.ts:35 POLL_MS=3000 polls each processing item every 3 s on top of the 10 s processing poll (13 requests in 31 s, limit 1 per 10 s; verified POLL_MS and setInterval at :222). Filter change clears rows so skeletons flash for 0.2-0.5 s. Each of 50 rows plus its menu is a tab stop (~100 stops; 12 Tab presses from search to first row because the strip precedes rows). On phones the first Escape on a preview only closes the tooltip of the focused 'Open in new tab'.
- Findings: R2-04, R2-05, R2-09, V3-11, J3-03
- Found by: J3, R2, V3
- Evidence: observed, resource timing and Tab walk; POLL_MS verified in code
- Reach: Every Data room user with a processing file; keyboard users
- Files:
  - apps/web/src/components/data-room/use-data-room-list.ts:35,222 (poll processing endpoint only, back off, keep previous rows on reload)
  - apps/web/src/components/data-room/DataRoom list rows (roving tabindex, arrow keys)
  - apps/web/src/components/data-room/ProcessingStrip.tsx DOM order after rows
  - apps/web/src/components/data-room/PreviewActions.tsx:163 (initial focus on Close)
- Acceptance:
  - <= 1 Data room request per 10 s while one file is Reading (measured over 31 s).
  - Changing a filter keeps the old rows until the new page arrives (row count never 0).
  - <= 3 Tab presses from search to first row; arrow keys move between rows.
  - One Escape closes the preview.
- Needs product decision: no
- Dependencies/conflicts: Same files as C6; combine branches.
- Pass: pass2 C18, C19 (not met); effort M

### C8 Cap table donut card is ~490 px tall and pushes the holders table below the fold (P1, rank 14, score 2.7)
- Root cause: OwnershipDonut.tsx:259-261 (frameH) reserves drill-down height at rest, leaving a ~190-200 px blank band; holders table header lands at y=730-843 with the agent panel open. Rows are 37/53/69 px; default tab All mixes holders, option grants and investors with no shares; Investors tab shows Shares and Ownership as dashes while the SAFE amount is small grey text; drill-down never names the class and percent differs from the table without a label; option pool shows 1,600,000 vs 600,000 available.
- Findings: R2-10, R2-11, R2-12, J1-11, J2-09, J2-10, FLOW-04, V3-05, V3-13
- Found by: FLOW, J1, J2, R2, V3
- Evidence: observed by 8 reporters; frameH verified in code
- Reach: Every cap table / raise user (board prep)
- Files:
  - apps/web/src/components/cap-table/OwnershipDonut.tsx:259,349-361 (size card to content at rest; compact layout below ~700 px)
  - apps/web/src/pages/CapTable.tsx (44 px rows, default tab Shareholders, Investors columns Amount and Cap/discount, 'Option pool (600,000 available)', drill-down heading and 'of class')
- Acceptance:
  - Holders table header at y <= 700 at 1440x900 with the agent panel open.
  - Donut card height <= 260 px at rest.
  - One row height (44 px); default tab shows only holders with shares.
  - Investors tab shows Amount instead of empty Shares/Ownership.
  - Drill-down heading names the class.
- Needs product decision: no
- Dependencies/conflicts: CapTable.tsx only plus OwnershipDonut; Storybook story for the card must be updated (pnpm design-system).
- Pass: pass2 C20 (not met), pass1 C27; effort M

### C16 Inbox Cleanup suggests live contacts; Digest cards are tall; header icons unlabeled (P1, rank 15, score 2.7)
- Root cause: Cleanup lists Sam Samplesworth (pilot customer) and Riley Testwell (bookkeeper) as sweep candidates; and in another mailbox state says 'Nothing to clean up' while Newsletters has 8 mails, with no explanation. Digest cards are 143 px with Open on its own row and a summary repeating the subject. Cleanup, Digest, Filter and Compose are icon-only with no tooltip within 1 s; sidebar has ~35 tab stops before main.
- Findings: J1-04, J1-10, V2-05, V2-06, V2-07
- Found by: J1, V2
- Evidence: observed; J1-04 data-dependent (CleanupSenderRow exclusion was claimed in pass 2 and R2 could not test it)
- Reach: Everyone doing a Monday inbox reset
- Files:
  - apps/web/src/components/inbox/InboxCleanup.tsx:258-262 (exclude replied-to senders and Important pile; show reason; empty state says what counts)
  - API sender-stats query
  - apps/web/src/components/inbox/ digest card (~72 px, Open on title row)
  - apps/web/src/pages/Inbox.tsx header (tooltips on hover and focus)
- Acceptance:
  - No sender the user replied to or saved as a contact appears in Cleanup; each row states why it is listed.
  - Empty state names the rule and links to Newsletters.
  - Digest cards <= 80 px.
  - Header icons show a tooltip on hover and focus.
- Needs product decision: no
- Dependencies/conflicts: Inbox.tsx shared with C17.
- Pass: pass2 C12 (not verifiable then), pass1 C9; effort M

### C10 Legal page: scan-failed banner first, wrapped rows, blank graph, unchecked-docs link (P2, rank 16, score 2.0)
- Root cause: Legal.tsx:~194 puts 'Last scan failed: OpenRouter did not accept your key' above all content (vendor name, placed before the tiles); on the demo the Data room agent works with the same session so the Legal scan credential path may differ (unknown). The '6 documents not yet checked' link (Legal.tsx:280) goes to /app/data-room unfiltered (verified: DATA_ROOM_PATH). Contract rows are 73 px with two-line wraps; Graph tab is blank ~8 s; 'Marked done. Undo' line shifts the list by 30 px.
- Findings: R3-02, J1-06, J2-05, J2-14, V2-14
- Found by: J1, J2, R3, V2
- Evidence: observed; credential cause unknown
- Reach: Every Legal user
- Files:
  - apps/web/src/pages/Legal.tsx:194,279-280 (dismissible banner under the tiles; plain 'The AI key was rejected'; link with a 'not checked by Legal' filter)
  - apps/web/src/pages/legal/* (contract type badge, graph skeleton)
  - apps/web/src/components/legal/LegalDeadlines.tsx (reserve undo line height)
  - packages/adapters/src/legal-agent.ts (which key the scan uses on the demo)
- Acceptance:
  - The unchecked-documents link opens a Data room view listing exactly those files.
  - Failure notice sits under the tiles, is dismissible and has no vendor name unless the user is in Settings.
  - Graph tab shows a skeleton within 100 ms.
  - Marking a deadline done moves the list 0 px.
- Needs product decision: no
- Dependencies/conflicts: Legal.tsx shared with C9; do C9 first.
- Pass: pass2 C25 (partly), pass1 C39; effort S

### C12 Hide amounts: runway months hidden in one place, shown in others (P2, rank 17, score 2.0)
- Root cause: With Hide amounts on, the Runway card shows '24.2 mo' but 'Until •••'; Finance and Chief text still say 'October 2028' and '24.2 months'; the sidebar badge '24 mo' disappears. mask-currency.ts:64-90 and maskPinFigures disagree with the cards. Data room preview behaviour could not be judged (stub PDF).
- Findings: R3-01
- Found by: R3
- Evidence: observed
- Reach: Founders who share their screen
- Files:
  - packages/chat-ui/src/mask-currency.ts:64-90
  - apps/web/src/lib/hide-amounts-preference.ts (maskPinFigures)
  - apps/web/src/pages/finance/FinanceRunway.tsx and Finance cards (one shared constant)
- Acceptance:
  - One shared constant states whether runway months and run-out date are amounts; card, pin, sidebar and chat text follow it (test table over the surfaces).
- Needs product decision: yes. With Hide amounts on, hide money only (recommended: months and date stay visible everywhere) or money plus runway months and date?
- Dependencies/conflicts: mask-currency.ts only.
- Pass: pass2 C24 (not met); effort S

### C13 Chief and routine results lag the delegate's answer (P2, rank 18, score 2.0)
- Root cause: Chief replies 'I don't have the current runway figure yet; Finance is checking' and its sidebar preview keeps that text after the Finance agent posts 24.2 months. A routine test run shows 'Done, 13s' while Chief says the figure has not come back; the Mercury reply says $472,420 and Finance shows $1,633,220 (demo seed). Connecting Gmail creates a 'Gmail agent' with no message saying so.
- Findings: J1-08, J1-09, J2-08, R2-17
- Found by: J1, J2, R2
- Evidence: observed by 3 walkers; locations suspected
- Reach: Every founder asking Chief about money
- Files:
  - Chief hand-off prompt (packages/adapters or apps/api agent prompt; not located)
  - apps/web/src/pages/Shell.tsx sidebar preview source (latest message in thread)
  - apps/web/src/pages/RoutineRunHistory.tsx (mark done after delegated replies)
  - connect-card success handler (one Chief line)
  - demo seed: Mercury balance vs Finance
- Acceptance:
  - After a hand-off returns, Chief posts the figure; sidebar preview shows the latest message.
  - Routine run is 'Done' only after delegated replies arrive, or says 'waiting on Finance agent'.
  - Demo Mercury and Finance balances agree.
- Needs product decision: yes. Should Chief wait for the delegate and post the figure itself (recommended), or keep the hand-off and only fix the preview?
- Dependencies/conflicts: None.
- Pass: pass2 C15 (partly), pass1 C13; effort M

### C17 Inbox sorting state, counts and mobile first screen (P2, rank 19, score 2.0)
- Root cause: Inbox.tsx:1354 uses min-h-28 (112 px, verified) for the 'Sorting your mail…' line but the consent card is ~62 px, so the list jumps 52 px and leaves a dead band for the 1-2 minute sort; rows vanish under the pointer (54, 50, 48, 44) with no progress count; 'Needs reply' went 6 to 14 and badge says 12 vs section 14; reply showed 'Sending… Undo' then 'Sending…' with no Undo for ~10 s; two tab rows plus To-do take 500 px of 812 on phones; thread actions are six equal outline buttons.
- Findings: V2-03, V2-04, J1-02, J1-13, J3-07, V2-23, V2-25, FLOW-11
- Found by: FLOW, J1, J3, V2
- Evidence: observed by 5 reporters; min-h-28 verified at Inbox.tsx:1354
- Reach: Every Inbox user, first-run sort
- Files:
  - apps/web/src/pages/Inbox.tsx:~1348-1358,1467 (match card height or inline; 'Sorting 12 of 54'; defer removals; one count definition)
  - apps/web/src/pages/Inbox.tsx header/tab rows (account choice into Filter chip)
  - apps/web/src/components/inbox/InboxMessageDialog.tsx (Reply the single filled button)
  - inbox send path (keep Undo until Sent)
- Acceptance:
  - List y changes by <= 8 px between consent and sorting.
  - Progress text shows N of M; rows stay until sorting ends.
  - Badge and section counts equal.
  - Undo visible until 'Sent'.
  - At 375 the first mail row starts above y=400.
- Needs product decision: no
- Dependencies/conflicts: Inbox.tsx shared with C16, C3.
- Pass: pass2 C23 (partly), pass1 C25; effort M

### C18 Search: Cmd+K and sidebar search miss contacts, Task board, and show a false empty state (P2, rank 20, score 2.0)
- Root cause: Cmd+K for 'Halcyon' returns documents and chats but not the 3 contacts whose organization matches; Cap table holders, artifacts and Task board are not searched (appPages has no Task board entry, Shell.tsx:2007-2032); sidebar search shows 'No matches' for ~4 s before results; results are squeezed into 316 px and repeat 'Message'; typing after Cmd+K went to the sidebar field.
- Findings: R1-05, R1-15, V3-10, FLOW-09
- Found by: FLOW, R1, V3
- Evidence: observed
- Reach: Every user who searches
- Files:
  - apps/web/src/pages/shell/command-palette.tsx (add contacts, holders, artifacts, Task board)
  - apps/web/src/pages/Shell.tsx:2007-2032 appPages + sidebar search (Searching… from first keystroke)
- Acceptance:
  - 'Halcyon' returns the 3 contacts; 'task' returns Task board.
  - 'No matches' appears only after the request settles.
  - Cmd+K focuses the palette field, not the sidebar field.
- Needs product decision: no (Default taken: palette is the one search surface; sidebar search keeps existing behaviour.)
- Dependencies/conflicts: Shell.tsx shared with C2.
- Pass: pass2 C7 (not met); effort S

### C19 Settings bugs: Voice provider unclear, Delete account scrolls dialog chrome away, notice misaligned, no aria-modal (P1, rank 21, score 2.0)
- Root cause: Voice shows an API key field and Connect with four providers and none selected (VoiceSettingsOverlay.tsx:89,:265 silently defaults catalog[0]). AccountAccess.tsx:89 calls scrollIntoView on the form, which scrolls the whole dialog so nav and title go blank. The Voice notice renders outside the padded pane (x=380 vs 412). Settings dialog has no aria-modal and #root is not inert.
- Findings: V1-03, R3-03, R3-04, V1-20
- Found by: R3, V1
- Evidence: observed; scrollIntoView call verified at AccountAccess.tsx:89, wrong-ancestor cause suspected
- Reach: Anyone setting up voice or deleting an account
- Files:
  - apps/web/src/pages/VoiceSettingsOverlay.tsx:89,265 (selected state, 'ElevenLabs API key', 'Connect ElevenLabs')
  - apps/web/src/components/AccountAccess.tsx:87-89,205 (scroll the content pane only)
  - apps/web/src/pages/AccountSettingsOverlay.tsx (notice inside padding; aria-modal; inert)
- Acceptance:
  - A provider is visibly selected and named in the form.
  - Delete account expansion keeps nav and title visible.
  - Notice aligns with content (x equal).
  - Dialog has aria-modal and the background is inert.
- Needs product decision: no
- Dependencies/conflicts: AccountSettingsOverlay.tsx shared with C20.
- Pass: pass2 C29 (partly), C28; effort S

### C23 Finance: one vendor shows two figures; overview long; sub-page headers; crypto total (P2, rank 22, score 2.0)
- Root cause: Globex Cloud shows $2,016 'Usual per month' in the list and $1,728 'Monthly avg, last 6 full months' on detail (metrics.ts); KPI tiles break 3+2 at 1280 and wrap 2+2+1 with Ask open; overview is 1343 px (target < 1300); Crypto page never shows the $105,250 total on the overview; sub-pages use a two-row header and truncate the workspace name; Subscriptions table uses 70% of the card; partial month drawn as a falling dashed line; mobile Spend wraps counterparty to 3 lines.
- Findings: R1-09, R1-14, R3-08, V2-08, V2-09, V2-10, V2-11, V2-12, V2-13, V2-24
- Found by: R1, R3, V2
- Evidence: observed
- Reach: Every Finance user
- Files:
  - apps/web/src/pages/Finance.tsx:512 (KPI grid 5 columns from @3xl), subscriptions table, chart height
  - apps/web/src/pages/finance/FinanceCrypto.tsx (total at top)
  - packages/core/src/finance/metrics.ts (one window or labelled windows)
  - apps/web/src/pages/finance/FinanceSpend.tsx mobile layout
- Acceptance:
  - List and detail show the same figure, or labels name different windows ('Median, 3 months' vs 'Average, 6 months').
  - Five KPI tiles never leave a lone tile at 1280 or with Ask open.
  - Overview < 1300 px at 1440x900.
  - Crypto page leads with $105,250.
- Needs product decision: no
- Dependencies/conflicts: Finance.tsx only (C12 touches Finance cards).
- Pass: pass2 C10, C26 (partly), pass1 C29; effort M

### C25 Copy and small chrome leftovers (P2, rank 23, score 2.0)
- Root cause: First run still shows three Chief bubbles around the connect cards; deleting a brand-new bot asks 'What about its memories?'; '+' menu is headed 'New' but lists existing chats; Skills list shows 'inbox-search' (HIDDEN_BUILTIN_SKILLS at slash-skills.ts:11 contains it, so BotSkillsSection does not apply the set); bot panel footer mixes four styles and repeats the Computer icon; composer spans full width at 1920 while thread is 900 px; unexplained green flag on bot rows; agent avatar changes between loads.
- Findings: R1-08, R1-11, R2-13, V1-16, V1-18, FLOW-08, V2-21, J2-15
- Found by: FLOW, J2, R1, R2, V1, V2
- Evidence: observed
- Reach: New users and bot owners
- Files:
  - onboarding reply copy (one sentence above cards)
  - apps/web/src/pages/Shell.tsx delete-bot dialog, composer container width, create menu, bot row flag
  - apps/web/src/lib/slash-skills.ts:11 + components BotSkillsSection (filter hidden skills)
  - bot settings panel footer
- Acceptance:
  - One Chief bubble above the connect cards.
  - No memory question for a bot with no memories.
  - No slug in Built-in skills.
  - Composer uses the thread max width at 1920.
- Needs product decision: no
- Dependencies/conflicts: Shell.tsx shared (C2, C14).
- Pass: pass2 C5, C13 (not met); effort S

### C28 System agents crowd the chat list (P2, rank 24, score 2.0)
- Root cause: Of 11 chat rows, 8 are page or integration agents that each page already opens with Ask; the '+' picker repeats them. One mail question involves three threads.
- Findings: FLOW-03
- Found by: FLOW
- Evidence: observed
- Reach: Every user with page agents
- Files:
  - apps/web/src/pages/Shell.tsx chat list (~4191): group pageAgentKind and integration agents into one collapsed row with an unread dot for approvals
- Acceptance:
  - Chat list shows Chief and user-made bots; page agents sit in one collapsed group showing a dot when any needs an answer.
- Needs product decision: yes. Collapse page and integration agents under one 'Page agents' row (recommended; proposed in pass 2), or keep the flat list?
- Dependencies/conflicts: Chat list in Shell.tsx (C2, C18).
- Pass: pass2 FLOW-01 (not adopted); effort M

### C20 Settings density and structure: sparse sections, weak active state, mobile tabs, duplicate credential actions (P2, rank 25, score 1.3)
- Root cause: Fixed 760 px dialog leaves Usage, Updates, Memory and Voice 60-90% empty; active nav row and selected segment are barely different; at 375 the tab strip cuts 4 of 7 tabs; General is 8+ stacked cards; Models has nested scrollers and three ways to change a credential; 'Add email attachments' card sits in Privacy; time zone and notifications are set in several places; the 'Hide amounts' menu line repeats its label.
- Findings: V1-05, V1-06, V1-07, V1-08, V1-09, J3-09, FLOW-07, FLOW-13, FLOW-14, V1-17
- Found by: FLOW, J3, V1
- Evidence: observed
- Reach: Every user who opens Settings
- Files:
  - apps/web/src/pages/AccountSettingsOverlay.tsx:252-270 (size to content, active nav fill, full-screen on phone with a list)
  - apps/web/src/components/AutoFileEmailSetting.tsx -> Data room Import menu
  - Models section (one scroll region, one primary key action)
  - segmented control in packages/ui-web
  - apps/web/src/pages/Shell.tsx user menu (remove second line)
- Acceptance:
  - Dialog height follows content for Usage/Updates/Memory.
  - Active nav item has a filled background.
  - At 375 sections are a list or select; no clipped tab.
  - Models shows Disconnect and a Replace key fold when connected.
- Needs product decision: yes. Merge Usage and Updates into General (recommended) or keep seven sections and only size them to content?
- Dependencies/conflicts: AccountSettingsOverlay.tsx shared with C19; do C19 first.
- Pass: pass2 C29, pass1 C18; effort M

### C21 Apps page: placeholder letter logos, ragged grid, no shared page header (P2, rank 26, score 1.3)
- Root cause: About 10 apps show a letter or initials where others show logos; sections fill 2 of 3 columns; Coinbase has no 'Used by' row and only Blockscout has an overflow menu; 'Used by' is avatars only; 'Add a custom connection' button repeats the wording; the page has no 56 px header bar.
- Findings: V1-14, V1-15, R3-06
- Found by: R3, V1
- Evidence: observed
- Reach: Every user opening Apps
- Files:
  - apps/web/src/components/integrations/IntegrationsHome.tsx
  - apps/web/src/components/integrations/CustomConnectionDialog.tsx:485
  - shared page header component
- Acceptance:
  - Every card has a logo or one consistent neutral glyph.
  - Grid auto-fills; every connected card has the same footer and overflow.
  - Title sits on the shared 56 px header.
- Needs product decision: no
- Dependencies/conflicts: Page header component also used by C22.
- Pass: pass2 C27 (partly), pass1 C23; effort M

### C22 Artifacts and Contacts: generic cards, header mismatch, table width, kinds, no Ask (P2, rank 27, score 1.0)
- Root cause: Artifacts: all cards share one document icon, 184 px tall, jargon badges (MD, CSV, HTML), CSV header 'Value usd', no company name or divider in the header, grid default on phones. Contacts: table stops at x=1368 while the button ends at x=1411, Email truncated without title, 'Other' kind for 6 of 14 (customer, counsel, bookkeeper), no Ask button.
- Findings: V3-08, V3-09, V3-14, V2-26, R3-07, R2-14, FLOW-12
- Found by: FLOW, R2, R3, V2, V3
- Evidence: observed
- Reach: Artifacts and Contacts users
- Files:
  - apps/web/src/components/ArtifactFileCard.tsx and artifacts grid (type icon, Doc/Sheet/Page labels, list default on phones, 'Value (USD)')
  - apps/web/src/pages/Artifacts.tsx header (shared header)
  - apps/web/src/pages/Contacts.tsx (fill width, title on email, Customer/Advisor kinds, Ask for Chief)
- Acceptance:
  - CSV and MD cards have different icons.
  - Contacts table right edge aligns with the header button at 1440 and 1920.
  - Kind includes Customer and Advisor; a customer is not 'Other'.
  - Contacts header has Ask (or documented reason).
- Needs product decision: no (Default taken: add Ask to Contacts for Chief.)
- Dependencies/conflicts: Shared header with C21.
- Pass: pass2 C14 (partly), C30; effort S

### C27 Data room Auto-sort failure and Send to agent list (P2, rank 28, score 1.0)
- Root cause: Auto-sort runs ~3 min over 50 files and ends with 'The model could not sort your files' with no reason, no Models link, and a disabled 'Apply 0 changes' still shown. Send to agent lists 10 agents flat, omits the Data room agent and includes an email-thread agent.
- Findings: R3-09, R3-10
- Found by: R3
- Evidence: observed
- Reach: Data room users with a bad key
- Files:
  - apps/web/src/components/data-room/AutoSortDialog.tsx (provider reason, 'Open Models settings', hide Apply on error, fail fast on auth)
  - apps/web/src/components/data-room/SendToAgent.tsx (page agents first, hide thread agents)
- Acceptance:
  - Auth error fails within 10 s with the reason and a Models link.
  - Apply hidden on error.
  - Send to agent lists Data room, Legal, Finance, Chief first and no thread agents.
- Needs product decision: no
- Dependencies/conflicts: Data room folder; no overlap with C6/C7 files.
- Pass: pass2 C32 (partly blocked); effort S

## Deferred items
- J1-15 (P3, docs): the catalog (`docs/ux-paths/app/catalog.md`) needs a note that the demo cannot show the model step or Connect your apps for STORY-APP-309 and 319. Docs only.
- FLOW-14 (P3): time zone and notifications set in several places; folded into C20 as a P3 line, no separate fix.
- Dev-stack timings (R1-10, J1-12, J2-07, V2-20, V3-12) are grouped in C15 but need a production-build measurement before any code change.
- Pass-1 deferred items (UXV-5 tablet shell, UXV-6 integration detail structure, UXV-8 Gmail writes, UXV-10, UXV-11, UXV-12) were not re-walked this pass and stay deferred.

## BLOCKED or not walkable (need data or a real account)
- STORY-APP-309 model sign-in: demo has a default model; also needs a real provider account.
- STORY-APP-319 steps 1-7, STORY-APP-209 Mercury path for a fresh user: no model or Connect-your-apps step for non-owners on the demo.
- STORY-INB-109 steps 3-6 (Spam pile), STORY-INB-022 suspicious wire email, Archive all 8 click (did not register): no such data in the mailbox.
- Pass-2 C12 Cleanup interaction (list empty), C23 Archive all count/Undo, attachment chip/too-large state, quoted-original preview: no demo data.
- Pending Approve/Deny tap on phone (J3), "Always allow" action (R2), pending mail_send card: no unanswered approval in the seed and agents cannot run without a valid model key.
- C32 Auto-sort grouping, Apply N moves, Sources card; C25 Overdue colour and failed-load header; C31 routine 'Saved for 2 s'; C29 mobile tab fade; C28 Dismiss tooltip: demo model key rejected or no data.
- Real Gmail/Calendar/Carta connect, Light theme, 200% zoom, Data room zips (STORY-DRM-109), quarter-end clean-up (DRM-121), Finance stories FIN-019..036, APP-212/214/024/145: not walked (time or real accounts).

## Counts by severity

- Clusters: 28 (P0 1, P1 13, P2 14, P3 0)
- Raw findings: 164 across the 10 files (after merging: every finding id except J1-15 maps to one cluster). One P0 (V3-01, also R2-01). Per file: (R1 15, R2 20, R3 11, J1 15, J2 15, J3 11, FLOW 14, V1 20, V2 27, V3 16 findings = 164).
- Clusters needing a product decision: C9, C11, C12, C13, C28, C20
- Clusters that reopen a pass-2 cluster whose criteria were not met: C1, C2, C3, C4, C5, C6, C7, C8, C9, C11, C12, C13, C16, C18, C21, C25, C26
