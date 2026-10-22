P0: 1, P1: 2, P2: 21, P3: 7

# Iteration 6 problems: fix clusters

Sources: R1-R3 (verify pass-5 clusters C1-C27), J1-J3 (journeys), FLOW, V1-V3. Read: `docs/ux-flow/report.md`, `docs/ux-visual/problems.md`, iteration 1 to 5 `problems.md`. Items already decided or fixed are not raised again. A cluster that reopens an earlier one says so under 'Reopens'.

Owner decisions respected (not raised): tour stays nine stops; Devin hidden until connected; the page is called Integrations; consent asked once per area (the 'ask once overall' idea was dropped in iteration 4); 44 px on coarse pointers (measured only with real touch emulation); Hide amounts in the user menu; Settings in five sections with a fixed height; palette is the one search surface; Legal row actions Ask agent / Done / Dismiss; Cap table header carries only Ask; sidebar pages and chats are one roving tab stop.

## Verification against the code (checkout 834e7ddd3)

Confirmed: executor.ts:2358 (consent card only when run.trigger is 'user') and :8545 (MAIL_CONSENT_OFF wording) for C1; the placeholder path for the mail thread at executor.ts:~2395-2410 (no ask created) for C1; legal.ts modelBlocker and Legal.tsx banner for C2; MailOutbox.tsx:~17-26 (the post-undo gap is intended) for C8; table.tsx:47 against Finance.tsx:963 for C10; CapTable.tsx:729 and :848 max-w-5xl for C11; charts.tsx:87 hidden-amount box for C17; EmailAgentPanel.tsx:104 and :176 draft button condition for C16; Shell.tsx:2149 (Task board gated by a server flag, not by tickets) for C26; roster-tab-stops.ts (the sidebar tab stop is the open row by design).

Not verified (marked suspected in the cluster): the cause of R1-06 (no approval card when changes are on; the demo model is scripted), J2-01 scroll cause, J3-02 count source, J2-09 history status source, V2-04 preview source, R3-06 (seed dependent), the 4.42:1 contrast estimate, and all dev-server timings (the stack was shared and slow, load average up to 200).

Dropped or corrected after checking: R3-01 (Pages rows are not in the tab order) is the deliberate roving tab stop and PASSed in iteration 5 C21; V2-11 (repeated Legal row buttons) was decided in iteration 4; FLOW-04 'ask once overall' was dropped in iteration 4; FLOW-07 and R3-03 say Audience has no explanation but J2 and V1 saw the sentence appear when External is chosen; FLOW-02 is true only for an unreadable file (V3 found Documents in the palette); J2-15 was called walker interference but the same key rejection is listed as BLOCKED in iteration 5, so it is placed in C2 as suspected; J1-02 and J2-09 and J1-03 were lowered from P1 to P2 (scripted model, routine still completes, loaded stack).

## Clusters (ranked: P0, then P1, then severity x reach / effort)

### C1 A mail question that needs AI-sharing consent ends in a refusal with no Allow card (delegated Inbox agent and Ask agent on a thread) (P0, rank 1, effort M)
- Root cause: The consent card is built only where a mail tool is called in a run with trigger 'user' (executor.ts:2358-2395). A Chief-to-Inbox-agent run is not a user-trigger run, so it takes the triageStatus branch, returns no card, and the model is handed MAIL_CONSENT_OFF ('allow it again', executor.ts:8545), which blames the user and names a page. The Ask-agent thread path swaps the thread for a placeholder when consent is missing (executor.ts:~2395-2410), so the model never calls a mail tool and no card is ever created; it improvises 'allow mail access in Settings -> AI data sharing' as plain text.
- Findings: J1-01, R3-02, V2-01, V1-01
- Found by: J1, R3, V1, V2
- Evidence: J1-01 observed (new user, first Chief question; a repeat after Allow was still refused, suspected stale turn). R3-02 and V2-01 observed. Code verified: executor.ts:2358 (trigger === 'user'), :8545 (MAIL_CONSENT_OFF text), :2395-2410 (placeholder path). V1-01 is suspected only (reporter did not test a real blocked message; Chief answered a runway question for a fresh user), so it is folded in as the 'ask in the flow' fix.
- Reach: Every new user who connects Gmail and asks Chief or the email agent about mail: the first mail question of the first day.
- Files:
  - packages/adapters/src/executor.ts:2358-2420 (build the consent ask for delegated runs and for the placeholder-thread path, in the thread where the user asked)
  - packages/adapters/src/executor.ts:8545 (MAIL_CONSENT_OFF: say 'allow', no page name, no 're-enable')
  - packages/adapters/src/approval-ask.ts:131 (buildConsentAskBlock reuse)
  - apps/api/src/inbox-thread-agent.ts (thread agent consent hand-off)
  - apps/web/src/components/inbox/EmailAgentPanel.tsx (render the ask card in the panel)
- Acceptance:
  - With mail consent missing, 'What needs a reply from <customer> today?' to Chief shows the existing Allow card in Chief's thread (not text telling her to visit a page); one click on Allow answers the question without retyping.
  - With consent missing, Ask agent on an open email shows the same Allow card inside the panel; no reply text contains 'Settings', 'AI data sharing', 'allow it again' or 're-enable'.
  - Executor unit tests: delegated (non-user trigger) mail run and placeholder-thread run each produce a consent ask block; declined path unchanged (MAIL_CONSENT_DECLINED).
  - Browser (demo, fresh user): sign up, connect Gmail, ask Chief a mail question: 2 steps to an answer after Allow (ask, Allow) against 4 today.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C16 (EmailAgentPanel.tsx, inbox-thread-agent.ts) and C4 (consent wording); land C1 first. Same executor.ts region as C3 only by file, different functions.
- Reopens: Reopens iteration 3 C4, iteration 2 C22, iteration 1 C14 (mail agents cannot see the mail); iteration 5 C19/C20 passed for other paths.

### C2 Legal tells a new user she needs an OpenRouter key while Chief works and Settings says the space already has a model; Legal scans are rejected for key errors (P1, rank 2, effort S)
- Root cause: legal.ts decides modelBlocker from whether the Legal bot's resolved model equals LEGAL_AGENT_MODEL: if it does not, it reports 'own_key' (legal.ts:~97-120), even when a perfectly good space default model was resolved. A bot model override only runs on the user's own credential, never the space default's, so the Legal agent fails or is flagged while Chief (space default) works. The banner in Legal.tsx:~405-425 then sends her to an empty key form.
- Findings: FLOW-01, J2-15
- Found by: FLOW, J2
- Evidence: FLOW-01 observed with a fresh user, cause verified in code (legal.ts modelBlocker, Legal.tsx banner). J2-15 (Ask agent / Scan now give 'AI key was rejected' while Chief works) was blamed on walker interference, but iteration 5 BLOCKED lists the same Legal key rejection on the demo, so it is probably the same root (suspected).
- Reach: Every new user who opens Legal.
- Files:
  - apps/api/src/legal.ts:~97-120 (modelBlocker: only block when no model resolves; otherwise run on the resolved model)
  - apps/web/src/pages/Legal.tsx:~405-425 (drop the OpenRouter-key banner; keep a short 'choose model again' note only when the saved model really changed)
  - apps/api/src/legal.ts per-bot model resolution (resolveAi) used by Scan now and Ask agent
- Acceptance:
  - Fresh user with only the space default model: Legal shows no key banner; Scan now and Ask agent on a deadline run on the space default model.
  - The Legal banner text never contains a vendor name the user has not chosen; no path ends in an empty API key form.
  - Unit test on legal summary: preferred model unavailable but default resolves gives modelBlocker null.
  - Demo: Ask agent on a Legal deadline returns an answer, not 'The AI key was rejected'.
- Needs product decision: false
- Dependencies / conflicts: None (apps/api/src/legal.ts and Legal.tsx are touched only here; C29 touches Legal.tsx header lines).
- Reopens: Reopens iteration 5 C10 (Legal first visit): the consent card is fixed but the key banner still shows for a fresh user.

### C3 Paying a bill through Chief produces no approval card and no next step; the replies about Mercury, runway and payments end in plain text (P1, rank 3, effort M)
- Root cause: Three separate gaps in the payment path. (1) With Allow changes on and an active recipient, the Mercury agent asks 'confirm here if you want me to proceed' instead of calling the write tool, so no approval card exists (R1-06; cause not located, the demo model is scripted so this may be a test artifact). (2) The recipient match fails on 'Acme (Mock)' versus 'Acme Servo Supply' and the refusal contradicts itself (J2-03). (3) Chief's refusal and no-account replies end with no link (FLOW-12, FLOW-13), and the changes-off reply links to the Integrations list, not the Mercury page (R1-07).
- Findings: R1-06, J2-03, FLOW-13, FLOW-12, R1-07
- Found by: FLOW, J2, R1
- Evidence: R1-06 and J2-03 observed twice on the demo; FLOW-12/13 observed in text; R1-07 observed by href. Cause of R1-06 is not located: first step is a reproduction with the mock Mercury tool and a scripted-model-independent test. Code read: mcp-connector.ts:156 holds the changes-off text.
- Reach: Anyone who asks Chief or the Finance agent to pay or to check runway with no accounts; payments are a core Finance journey.
- Files:
  - packages/adapters/src/mcp-connector.ts:~156 (changes-off text, link to /app/integrations/mcp/<id>)
  - packages/adapters/src/builtin-skills.ts and the Finance/Mercury agent prompt (call the write tool, do not ask for chat confirmation)
  - packages/adapters/src/executor.ts (reply links for 'Open Finance', 'Open Integrations', 'Open Mercury agent')
  - finance fake-tools fixture and recipient matching (ignore a '(Mock)' suffix; return the available recipients)
- Acceptance:
  - Adapter test with the mock Mercury tool: 'Pay Acme $300' with Allow changes on creates one pending approval card naming the recipient and account.
  - With changes off, or no payment agent, the reply ends with a link that opens the Mercury page (or Integrations) in one click.
  - The no-accounts runway reply carries an 'Open Finance' link.
  - No refusal says the only recipient is X and then rejects X.
- Needs product decision: false
- Dependencies / conflicts: Same files as C1 only in executor.ts (different functions); C20 touches McpDetail.tsx for the Allow-changes switch (not this cluster).
- Reopens: Reopens iteration 5 C5 (criteria partly met) and iteration 4 C6.

### C4 AI data sharing is two model-named switches with the same subtitle; a Legal Allow leaves Settings looking off (P2, rank 4, effort S)
- Root cause: The consent store is per recipient (model), the Legal grant is a separate store (legal.consentGrant), and Settings renders one switch per recipient with one shared subtitle (AiDataSharing.tsx:104-170). Nothing links the Legal grant to the switches, so Settings contradicts the card she just allowed.
- Findings: R1-01, R1-02, FLOW-04
- Found by: FLOW, R1
- Evidence: R1-01, R1-02 and FLOW-04 observed. Code read: AiDataSharing.tsx:104-170 (per-recipient switches), ConsentPrompt.tsx:20-38 (separate Legal grant). FLOW-04 also asks for 'asked once overall'; that was dropped in iteration 4, so only the label and state mismatch is raised here.
- Reach: Everyone who opens Settings > Privacy and approvals after using the Inbox or Legal.
- Files:
  - apps/web/src/components/AiDataSharing.tsx:104-170 (distinct subtitle per switch; show the Legal grant as a row or note)
  - apps/web/src/components/legal/ConsentPrompt.tsx:20-38
- Acceptance:
  - Each switch has its own subtitle naming what uses that model; no two rows share text.
  - After Allow on the Legal card, Settings > Privacy shows a row or note for Legal that matches (checked after reload).
  - No card shows 'openai/' or a raw model id (already met).
- Needs product decision: true. Should AI data sharing be one switch that covers every model (recommended, model names under Advanced), or stay one switch per model? The earlier decision keeps consent asked once per area; this asks only about the Settings page.
- Dependencies / conflicts: Conflicts with C10 and C25 (ApprovalRulesSettings.tsx / AccountSettingsOverlay.tsx) and C1 (consent wording).
- Reopens: Reopens iteration 5 C9.

### C5 Ask panels on Data room, Cap table and Finance open in the middle of old history with a '3 new messages' pill (P2, rank 5, effort S)
- Root cause: The transcript decides 'new' from seenId and atEnd (transcript.tsx:~225-271): when the panel opens, the initial scroll does not reach the last message, atEnd is false, and messages after the last-read marker count as new, so the pill shows although nothing arrived.
- Findings: J2-01
- Found by: J2
- Evidence: Observed on three pages by J2 (screenshots cap-05, drm-05b, fin-03a); code read only, cause suspected.
- Reach: Everyone who opens the Ask panel on a page with an old thread.
- Files:
  - apps/web/src/pages/shell/transcript.tsx:~225-271 and the scroll-on-mount effect (scroll to the newest message on first render; count only messages that arrive after mount)
- Acceptance:
  - Opening the Ask panel on Data room, Cap table and Finance with an old thread shows the newest message at the bottom and no 'new messages' pill (measured scrollTop + clientHeight = scrollHeight).
  - A message that arrives while she scrolls up still shows the pill with the right count.
  - Component test for first-render position.
- Needs product decision: false
- Dependencies / conflicts: None.

### C6 First-run tour: 'Ask Chief' pastes into an existing draft, one step tells her to turn on switches that are off, popovers cover content, copy says 'agent' where the app says 'bot' (P2, rank 6, effort S)
- Root cause: The tour prefill is written into the composer without replacing or separating existing draft text; tour step text was written before Action confirmations defaults and before the 'bot' naming settled; popover placement does not avoid the composer and Connect cards.
- Findings: R1-09, V1-09, FLOW-05, V1-11, J1-08, V1-10, J1-09
- Found by: FLOW, J1, R1, V1
- Evidence: R1-09 observed (the draft survived leaving and returning; typing was appended without a space). V1-09 saw the glued message in the seeded Chief chat. FLOW-05 observed for the seeded founder only, not a fresh user. Code read: FirstRunTour.tsx:60 (step text), Shell.tsx onAsk. Tour stays nine stops (owner decision), so J1-09 is a suggestion only.
- Reach: Every new user (tour runs once at sign-up).
- Files:
  - apps/web/src/components/tour/FirstRunTour.tsx:~25-70 (step 2 and 8 say 'bot'; step 7 sentence)
  - apps/web/src/components/tour/TourPopover.tsx (placement away from composer and Connect cards)
  - apps/web/src/pages/Shell.tsx (onAsk prefill: send at once or replace an empty composer; never append to a draft)
  - apps/web/src/components/ApprovalRulesSettings.tsx (only if the decision below is yes)
- Acceptance:
  - Tour 'Ask Chief' on a composer with text keeps the old text on its own line or sends the question; the question never joins the old text.
  - Step 7 copy matches the real default of the switches it names.
  - Step 2 and 8 say 'bot'.
  - Popover for steps 3, 7, 8, 9 does not cover the greeting, composer '+' or Connect cards (bounding boxes disjoint at 1440x900).
- Needs product decision: true. Should 'Ask before sending external email' and 'Ask before purchases' default to on for new users (recommended), instead of the tour sending them to Settings?
- Dependencies / conflicts: Conflicts with C27 (FirstRunTour.tsx line 30) and C4/C10/C25 if the defaults change (ApprovalRulesSettings.tsx).
- Reopens: Reopens iteration 4 C11 and iteration 3 C11 in part (copy honesty); iteration 5 C3 passed.

### C7 First Inbox open after connecting Gmail sits on a skeleton for about 30 s; the consent banner shows only after the list loads; sorting spins 40+ s with no stall line (P2, rank 7, effort S)
- Root cause: The Inbox renders its skeleton until the first sync returns, with no copy for a first sync, and renders the consent banner only inside the loaded view (Inbox.tsx:~1385). The 30 s stall line exists for sorting but did not appear.
- Findings: J1-03
- Found by: J1
- Evidence: Observed once on a new connection (35 s) against 2 s on the seeded account on the same loaded stack; walker rated P1, lowered here because the stack was heavily shared and production timing is unmeasured. The copy and banner order do not depend on the timing.
- Reach: Every new user who connects Gmail.
- Files:
  - apps/web/src/pages/Inbox.tsx:~1385 (loading state, consent banner placement, first-sync line)
- Acceptance:
  - During a first sync the skeleton is accompanied by 'First sync can take a minute' (or equivalent) after 5 s.
  - The consent banner is visible while the list loads.
  - A sort running over 30 s shows the existing 'taking longer' row.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C13 and C8 (Inbox.tsx).

### C8 Inbox reply send: Undo and the toast vanish at 5 s and 'Sent' appears 1.5 to 3.4 s later; the reply composer is empty for 2 s (P2, rank 8, effort S)
- Root cause: MailOutbox.tsx:~17-26 deliberately hides the toast when the state is 'sending' and not undoable ('nothing to undo or to report'), which leaves a blank gap until 'Sent'. ComposeEmail opens before the draft arrives, with no loading cue.
- Findings: R1-03, J3-04
- Found by: J3, R1
- Evidence: R1-03 observed twice with 50 ms polling; code verified (the gap is intended in MailOutbox.tsx). J3-04 observed on the phone.
- Reach: Everyone who sends a reply or uses Reply with draft.
- Files:
  - apps/web/src/components/MailOutbox.tsx:~17-26 (keep a 'Sending...' toast without Undo until Sent)
  - apps/web/src/components/inbox/ComposeEmail.tsx (show 'Preparing draft' and disable the body until the draft arrives)
- Acceptance:
  - Recorded frames at 50 ms show a toast ('Undo' then 'Sending...' then 'Sent') with no frame of nothing between send and Sent.
  - Reply with draft shows a loading cue within 100 ms and the body field is disabled until the draft arrives.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C7, C13 (Inbox.tsx) only if they touch the same lines; C15 (toast viewport).
- Reopens: Reopens iteration 5 C8 (Undo criterion not met).

### C9 Each Ask agent on an email, and opening Legal, adds a permanent chat row to the main sidebar list and a second hit in search (P2, rank 9, effort M)
- Root cause: Agents created as a side effect (email thread agents via inbox-thread-agent.ts:118, the Legal page agent on first open) are ordinary bots in the space list and the palette's Bots and Chats groups, so they outgrow the sidebar and displace Chief and Page agents.
- Findings: FLOW-03, J1-07, V1-06, V2-02, R3-11, FLOW-16
- Found by: FLOW, J1, R3, V1, V2
- Evidence: Observed by FLOW, J1, V1, V2, R3; at 375 the drawer shows 3 chats after about 5 email chats (V2). Code read: inbox-thread-agent.ts:118 (createBot), Shell.tsx chat list. Rows with two-line names also have uneven heights (J1-07).
- Reach: Everyone who uses Ask agent more than a few times.
- Files:
  - apps/api/src/inbox-thread-agent.ts:~118 (mark thread agents so lists can group or hide them)
  - apps/web/src/pages/Shell.tsx (sidebar chat list and palette groups: one collapsed 'Email chats' row, or hide until unread or pending)
  - apps/web/src/pages/shell/command-palette.tsx (one result per email thread)
  - Legal page agent creation (create lazily into Page agents, not Personal)
- Acceptance:
  - After 6 Ask-agent uses, the sidebar list at 1440x900 and the 375 drawer still show Chief and the Page agents without scrolling beyond today's baseline.
  - Searching an email subject returns one result.
  - Opening Legal for a fresh user does not add a row under Personal.
- Needs product decision: true. Where should email Ask-agent chats live: one collapsed 'Email chats' row (recommended), hidden until they have an unread or pending state, or archived when the dialog closes?
- Dependencies / conflicts: Conflicts with C28 and C18 (Shell.tsx), C16 and C1 (inbox-thread-agent.ts), C27 (palette).
- Reopens: Reopens iteration 3 C28 (system agents crowd the chat list).

### C10 Touch targets under 44 px: Finance subscription rows, Settings switch rows, row checkboxes, sidebar drawer rows (P2, rank 10, effort M)
- Root cause: Coarse-pointer sizing is done per component. The compact table variant overrides the coarse row height (table.tsx:47 'group-data-[compact]/table:h-auto' beats Finance.tsx:963 'pointer-coarse:h-11'); two settings switch rows are plain divs not labels; checkbox hit areas are about 38-42 px; drawer rows are 28-40 px.
- Findings: R2-01, R2-03, R2-10, V1-03, V1-08, J3-01, J3-07
- Found by: J3, R2, V1
- Evidence: All measured with CDP touch emulation (pointer: coarse true). Code verified for table.tsx:47 and Finance.tsx:963 (class order). The owner rule is 44 px on coarse pointers.
- Reach: Every phone user.
- Files:
  - packages/ui-web/src/components/ui/table.tsx:47 (coarse min height for compact tables)
  - packages/ui-web/src/components/ui/checkbox.tsx (44 px coarse hit area)
  - apps/web/src/components/ApprovalRulesSettings.tsx (Browser notifications row as a min-h-11 label)
  - apps/web/src/pages/AccountSettingsOverlay.tsx:292-330 (Advanced rows as labels)
  - apps/web/src/components/inbox/InboxRow.tsx:284-289 and InboxSenderGroup.tsx:122 (name 'Select <sender>', 44 px hit wrapper)
  - apps/web/src/pages/Shell.tsx sidebar drawer rows (page rows, Activity, Close, Create, Actions buttons)
- Acceptance:
  - With CDP touch emulation at 375x812, Finance subscription rows, the Settings switch rows, Inbox and Data room row checkboxes (elementFromPoint hit area), and the drawer's page rows, Activity, Close, Create and Actions buttons all measure at least 44 px.
  - Each Inbox checkbox has an accessible name that includes the sender.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C4, C6, C25 (settings files) and C9, C28 (Shell.tsx).
- Reopens: Reopens iteration 5 C11 (FAIL, partial).

### C11 Cap table layout: cards span the full width but the table is capped at 1024 px; the summary takes 39% of a 1280 screen; muted line and Email column waste space (P2, rank 11, effort S)
- Root cause: The filter bar and table sit in max-w-5xl wrappers (CapTable.tsx:729, :848) while the summary cards and donut use the full width, so edges disagree; the summary block is tall for a two-slice donut; the muted holder line joins three fields that truncate on a phone; the Email column is empty for most rows; the skeleton differs from the real layout.
- Findings: V3-01, V3-02, V3-05, V3-15, V3-16, R1-10, R2-09
- Found by: R1, R2, V3
- Evidence: Observed by V3, R1, R2 with measured edges (table right 1368 against cards 1412 at 1440; 1368 against 1892 at 1920). Code verified: CapTable.tsx:729 and :848 max-w-5xl.
- Reach: Every founder who opens the Cap table.
- Files:
  - apps/web/src/pages/CapTable.tsx:729 and :848 (one shared width), ~680-730 (compact summary), ~945-965 (muted line), columns (hide Email when no holder has one), loading skeleton
  - apps/web/src/components/cap-table/OwnershipDonut.tsx (hide or collapse the donut under 3 slices)
- Acceptance:
  - Table and summary cards share the same right edge at 1280, 1440 and 1920 (difference of at most 2 px).
  - At 1280x800 the table shows at least 8 rows without scrolling; header is sticky.
  - At 375 each holder row shows kind and one detail, no truncated fragments.
  - Email column is absent when no holder has an email; the skeleton has tabs, cards and rows.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C12 (CapTable.tsx). Do C11 and C12 in one branch.
- Reopens: Reopens iteration 5 C1/C18 in layout only (legend clipping is fixed).

### C12 Cap table holder rows open an 'Add email for <name>' contact form; SAFE terms are shown nowhere (P2, rank 12, effort S)
- Root cause: Row click calls the contact dialog (CapTable.tsx:892-905, ContactDialog.tsx:161), titled after one field of a five-field form; the row name has no link affordance; SAFE amount, cap and date are not shown.
- Findings: J2-02, R2-08, V3-04
- Found by: J2, R2, V3
- Evidence: Observed by J2, R2, V3; code read.
- Reach: Every founder who clicks a holder.
- Files:
  - apps/web/src/pages/CapTable.tsx:892-905
  - apps/web/src/components/ContactDialog.tsx:161 (title 'Save <name> as a contact' when no email)
- Acceptance:
  - The dialog title never names a single field; the holder row shows a hover background or chevron.
  - Clicking a SAFE holder shows amount, valuation cap and date (if the data exists) before any contact fields.
- Needs product decision: true. Show a read-only holding card (terms plus linked contact, Edit behind an action) as a new surface, or only retitle the existing contact dialog and show SAFE terms in the row's muted line?
- Dependencies / conflicts: Same file as C11.
- Reopens: Reopens iteration 5 C18 (rows that do not open: they open the wrong thing).

### C13 Inbox list jumps while loading, and section counts change without action (P2, rank 13, effort M)
- Root cause: The To do card and the space-name line arrive after the list and push it down; the sorting row appears and clears with a different height; the Needs reply count comes from a different source than the rows (4, 7, 5 for the same rows); the sidebar badge counts Newsletters which no header shows; To do due labels show only 'Thu'.
- Findings: J1-04, V2-05, J3-03, J3-02, R1-04, V2-21
- Found by: J1, J3, R1, V2
- Evidence: Observed by J1, V2, J3 (heading top 186 to 206 px; list 12-16 px); J3-02 count drift observed, cause suspected. Code read: Inbox.tsx:~1385, :1444.
- Reach: Everyone who opens the Inbox.
- Files:
  - apps/web/src/pages/Inbox.tsx:~1385 and :1444 (fixed-height status row, reserve To do card and space-name height, derive section counts from the rendered list)
  - To do pile row (due label with date)
- Acceptance:
  - First meaningful row y does not change by more than 2 px between the first paint with rows and the settled state at 1440 and 375.
  - The Needs reply unread count equals the unread rows rendered, across 3 screenshots with no action.
  - Due labels show 'Thu, Oct 22' or 'Tomorrow'.
  - Badge versus header total explained: either a header count or tab counts.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C7, C8, C23 (Inbox.tsx).
- Reopens: Reopens iteration 5 C8 (heading numbers) in part.

### C14 A failed Data room file offers only Try again, even for 'isn't a readable PDF'; a Reading row shows no age (P2, rank 14, effort S)
- Root cause: The failed row's inline action is always retry (ItemRows.tsx:~254); Replace and Remove are only in the '...' menu; a Reading row shows no elapsed time.
- Findings: J2-05, V3-13, R2-11
- Found by: J2, R2, V3
- Evidence: Observed by J2, V3 (retry on an unreadable scan fails again); R2 for the age.
- Reach: Anyone who uploads a damaged or unsupported file.
- Files:
  - apps/web/src/components/data-room/ItemRows.tsx:~254 (Replace file as the inline action for unreadable files; Try again for transient errors)
  - same file: 'Reading for N min' after 2 minutes
- Acceptance:
  - For an unreadable-file failure the inline action is Replace file or Remove; Try again remains for transient failures.
  - A row that has been Reading over 2 minutes shows its age.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C24 (data-room components).
- Reopens: Reopens iteration 5 C17 (age criterion).

### C15 Toasts: a notice with a button sits under the dialog scrim; a toast covers the agent composer (P2, rank 15, effort S)
- Root cause: The toast layer is below the modal scrim when a dialog is open and is anchored to the right edge, over the right-hand agent panel's composer.
- Findings: V2-20, J2-06
- Found by: J2, V2
- Evidence: Observed by V2 (approval toast blurred behind an open thread) and J2; code not read.
- Reach: Anyone who gets a notice while a thread or panel is open.
- Files:
  - apps/web/src/main.tsx (Toaster mount and offset)
  - toast z-index relative to dialog overlay in packages/ui-web
- Acceptance:
  - With a thread dialog open, a toast is above the scrim and its button is clickable.
  - With the agent panel open, no toast overlaps the composer (bounding boxes disjoint).
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C8 (MailOutbox portal, z-100).
- Reopens: Reopens iteration 5 C4 in part.

### C16 Replying to an email with the agent takes seven actions, the first hidden in More; the panel is empty, nameless and its placeholder is the whole subject (P2, rank 16, effort M)
- Root cause: 'Ask agent' is a menu item, the panel opens with no suggestion, the header and the placeholder use the thread subject as the bot name, and Reply with draft appears only when a pending mail_send card exists (EmailAgentPanel.tsx:104,176). A text draft or a delegated draft leaves no button. The dialog widens and re-centres when the panel opens.
- Findings: J1-02, FLOW-06, J1-05, J1-06, V1-05, V2-03, V1-17
- Found by: FLOW, J1, V1, V2
- Evidence: Observed by J1, FLOW, V1, V2; J3 saw Reply with draft work on the phone. J1-02 is P1 for the walker but used a scripted model and the delegated-draft result is unconfirmed, so it is P2 here. Code verified: EmailAgentPanel.tsx:104 and :176.
- Reach: Anyone who uses the agent on an email.
- Files:
  - apps/web/src/components/inbox/EmailAgentPanel.tsx:104,176 (draft button for text drafts; fixed placeholder 'Ask about this email'; one 'Draft a reply' chip; agent name in the header)
  - apps/web/src/components/inbox/InboxMessageDialog.tsx (Reply with agent beside Reply; open the dialog at the wide size)
  - apps/api/src/inbox-thread-agent.ts INSTRUCTIONS (write the draft with mail_send, do not delegate)
  - email dialog header at 375 (full subject, back arrow)
- Acceptance:
  - From an open email, 'Reply with agent' then Send is 3 actions.
  - The panel header shows an agent name; the composer placeholder is one line.
  - A text draft reply offers Reply with draft.
  - The dialog does not shift its content on opening the panel.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C1 and C9 (inbox-thread-agent.ts, EmailAgentPanel.tsx); land after C1.

### C17 Finance sub-pages: a total silently leaves out a non-USD item, the hidden-amounts chart is an empty box, the burn chart has an unlabelled marker, 'Count crypto' does not look like a switch, the crypto page is unlike its neighbours (P2, rank 17, effort M)
- Root cause: Chart and toggle details written per page: the category total ignores EUR rows with no note (FinanceSpend.tsx:171); charts.tsx:87 replaces the whole chart when amounts are hidden; the financing marker has no label; the crypto toggle is a pressed-state button with a sentence beside it.
- Findings: V2-07, J1-10, J1-11, J2-14, V2-15, J1-12, V2-10, V2-13
- Found by: J1, J2, V2
- Evidence: Observed by V2, J1, J2 (three walkers on the unlabelled marker, two on the toggle). Code verified: charts.tsx:87 returns the 'Chart hidden' box. An e2e test (finance.spec.ts:435) expects a pressed button, so a switch needs the test updated.
- Reach: Anyone using Finance; Hide amounts is a stated screen-share path.
- Files:
  - apps/web/src/pages/finance/FinanceSpend.tsx:171 (non-USD note under the total)
  - apps/web/src/components/finance/charts.tsx:87 (draw the line without y values when hidden), burn chart marker label 'Financing, Oct'
  - apps/web/src/pages/finance/FinanceRunway.tsx Count crypto control (switch with on/off) and apps/web/e2e/finance.spec.ts:435
  - apps/web/src/pages/finance/ crypto page (stat card header, axis floor, thinned x labels)
- Acceptance:
  - The Rent category page shows '1 non-USD transaction not counted' next to the total.
  - With amounts hidden the Runway chart still draws the line shape and no money axis.
  - The financing marker has a visible label and sits inside the plot area.
  - Count crypto is a switch with a visible state; e2e updated.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C22 (Finance headers).

### C18 Status does not match the work: routine run says Done while the bot is still working; 'Computer is on' above an empty box; 'Starting the computer'; sidebar previews show agent-to-agent messages (P2, rank 18, effort M)
- Root cause: State labels and routine history use different sources (Shell.tsx:~6822-6835 computerStateLabel; run history status), the sidebar preview picks the last message including peer-delivered instructions (transcript.tsx:~1465 handles only the chat chip), and delegation shows 'Thinking' with no target.
- Findings: J2-09, J2-04, J3-05, R3-09, V2-04, R2-07
- Found by: J2, J3, R2, R3, V2
- Evidence: Observed by J2 (Done 36 s while 'Waiting for the computer'), J3, R3, V2, R2. The walker rated J2-09 P1; lowered here to P2 because the routine still completes and posts a summary. Code verified: computerStateLabel in Shell.tsx.
- Reach: Anyone using routines or delegated agents.
- Files:
  - apps/web/src/pages/Shell.tsx:~6822-6835 and the sidebar preview selection
  - routine run history status in apps/web/src/pages/shell/bot-panel.tsx
  - apps/web/src/pages/shell/transcript.tsx:~1465 (progress line 'Waiting on Mercury agent' with elapsed time)
  - chat status string 'Starting the computer' to 'Getting ready'
- Acceptance:
  - A routine test run shows Running until the bot's run ends.
  - A bot without a computer shows no 'Computer is on' empty box.
  - Sidebar preview never shows peer-delivered instructions.
  - A delegated wait over 10 s shows who is being waited on.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C9, C19, C28 (Shell.tsx, bot-panel.tsx).
- Reopens: Reopens iteration 5 C16 in part.

### C19 Bot settings: selected Internal/External and Team/Private look alike, Computer is unexplained, Title repeats Description, right edges disagree, routine shows no next run and its Save button re-enables (P2, rank 19, effort M)
- Root cause: Segmented controls in bot-panel.tsx:~554-575 use a lighter fill instead of the General page's filled pill; the routine editor does not show the next run or track dirty state; skill form has placeholders instead of labels; edge padding differs per row.
- Findings: V1-04, J2-12, V2-17, R3-03, FLOW-07, V1-19, J2-11, J2-13, J2-10
- Found by: FLOW, J2, R3, V1, V2
- Evidence: Observed by V1, J2, V2, R3, FLOW. Conflict: FLOW-07 and R3-03 say Audience has no explanation, but J2 and V1 observed a plain sentence when External is chosen; the explanation exists, so only the Computer control and the group label are raised.
- Reach: Anyone who creates or edits a bot.
- Files:
  - apps/web/src/pages/shell/bot-panel.tsx:~554-575 (filled selected style; aria group label; Computer line)
  - routine editor in bot-panel.tsx (next run line under When to run; Save disabled until changed; submenu alignment)
  - apps/web/src/pages/shell/BotSkillsSection.tsx (visible labels)
  - apps/web/src/pages/shell/bot-panel.tsx right padding
- Acceptance:
  - Selected segment is visibly filled; contrast between selected and unselected at least 3:1.
  - After saving a routine, 'Next run Mon Oct 26, 9:00 AM' is shown and Save stays disabled until a field changes.
  - Skill form fields have visible labels.
  - Right edges of switches and chevrons agree within 2 px.
- Needs product decision: true. Remove the Title field from bot settings because Description covers it?
- Dependencies / conflicts: Conflicts with C9, C18 (Shell.tsx/bot-panel.tsx).
- Reopens: Reopens iteration 5 C27.

### C20 Integrations: connected cards differ in footer, phone page is 2660 px tall, two apps have no logo, Mercury page shifts after Allow changes (P2, rank 20, effort M)
- Root cause: Cards compose footer slots per app (IntegrationsHome.tsx) so Gmail/Carta lack a menu and Coinbase lacks Used by; the Popular catalog is fully expanded on a phone; Linear and Airtable use the generic glyph; the Mercury switch row re-renders after the agent appears (McpDetail.tsx, IntegrationAgentSection.tsx).
- Findings: R2-04, R2-05, V1-14, R1-08
- Found by: R1, R2, V1
- Evidence: Observed by R2, V1, R1.
- Reach: Everyone who opens Integrations.
- Files:
  - apps/web/src/pages/IntegrationsHome.tsx (same footer slots and min button width; collapse Popular after 3 on a phone)
  - apps/web/src/pages/Integrations.tsx (two logos, drop the 'FIND AN APP' label, two-line descriptions)
  - apps/web/src/components/integrations/McpDetail.tsx and IntegrationAgentSection.tsx (reserve space, show checked state at once)
- Acceptance:
  - Every connected card has the same footer slots; button widths equal.
  - Phone Integrations scroll height is at most 2200 px.
  - Switching Allow changes on moves no row by more than 2 px.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C3 (McpDetail.tsx read) lightly; C26 (user menu).
- Reopens: Reopens iteration 5 C13 (FAIL, partial).

### C21 Artifacts: header wraps to three rows at 375 and shifts on load; open sheet leaves 540 px empty; empty pages keep full toolbars (P2, rank 21, effort S)
- Root cause: PageHeader holds Filters, two view toggles and Ask in one row without a phone disclosure (Artifacts.tsx:286-340); the Ask slot appears after load; the viewer card stretches to pane height.
- Findings: V3-03, V3-09, V3-12, FLOW-14
- Found by: FLOW, V3
- Evidence: Observed by V3 and FLOW.
- Reach: Anyone using Artifacts, Contacts or an empty Inbox.
- Files:
  - apps/web/src/pages/Artifacts.tsx:286-340 (view toggle into Filters at phone width; reserve Ask slot; size card to content; align type label)
  - apps/web/src/pages/Contacts.tsx and Inbox empty toolbars (hide Filters, toggle, search until items exist; drop 'Open chat')
- Acceptance:
  - Artifacts header at 375 is one row of 56 px in loading and loaded states.
  - Empty Artifacts shows no Filters or view toggle.
  - An open 5-row sheet's card height is at most content plus 24 px.
- Needs product decision: false
- Dependencies / conflicts: None.

### C22 Finance: company name missing from the phone header; space picker and stat grid differ between sub-pages (P2, rank 22, effort S)
- Root cause: Per-page headers (Finance.tsx header ~403-430, finance sub-pages) include the picker and the stat grids differently.
- Findings: R3-05, V2-14, R2-02
- Found by: R2, R3, V2
- Evidence: Observed by R3, V2, R2.
- Reach: Anyone on Finance sub-pages or on a phone.
- Files:
  - apps/web/src/pages/Finance.tsx:~403-430
  - apps/web/src/pages/finance/* and PageHeader.tsx (one stat grid; picker everywhere or nowhere; one gutter)
- Acceptance:
  - Finance at 375 shows the company name.
  - The header on Burn and Runway is identical in layout.
  - Stat card grids use the same column count rule on Accounts, Burn and Runway.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C17 (Finance pages).

### C23 Inbox Digest repeats the Newsletters list (one card per message) and its pill looks like a fourth tab (P2, rank 23, effort M)
- Root cause: The digest view renders the same rows as the pile with 'Archive all N' and no confirmation; the pill sits in the tab row with Newsletters still highlighted.
- Findings: R3-04, V2-09, V2-08
- Found by: R3, V2
- Evidence: Observed by R3 and V2 (carried from iteration 5 C23).
- Reach: Anyone who uses Newsletters.
- Files:
  - apps/web/src/pages/Inbox.tsx:~1319 (digest view, control placement)
- Acceptance:
  - Digest shows one line per sender with a count (5 messages from 3 senders gives 3 lines).
  - Digest is not drawn as a tab; only one control looks active.
  - Archive all shows an Undo toast.
- Needs product decision: true. Should Digest group by sender with a count (recommended), or be removed?
- Dependencies / conflicts: Conflicts with C7, C8, C13 (Inbox.tsx).
- Reopens: Reopens iteration 5 C23.

### C24 Data room on a phone and wide screens: view switch hidden in Filters (245 px of chrome), empty Status column, preview sheet clips metadata, Auto-sort scope unnamed, picker names truncated (P2, rank 24, effort M)
- Root cause: FilterBar.tsx:313 puts List/Grid/Stats and Sort inside a disclosure; ItemRows keeps a Status column when no row has a status; the preview sheet gives the PDF a fixed share; Auto-sort names its scope only after it starts.
- Findings: V3-06, V3-10, V3-11, R1-05, R1-11, J3-10
- Found by: J3, R1, V3
- Evidence: Observed by V3, R1, J3.
- Reach: Data room users, especially on phones.
- Files:
  - apps/web/src/components/data-room/FilterBar.tsx:313
  - apps/web/src/components/data-room/ItemRows.tsx (hide empty Status column; cap widths)
  - Data room preview sheet
  - apps/web/src/pages/DataRoom.tsx Auto-sort dialog (title 'Sort all N files' or 'Sort N selected'); selection bar menu width
  - focus restore after preview close
- Acceptance:
  - At 375 the three view icons stay visible and the chrome above the first file is at most 150 px.
  - The Status column is absent when no row has a status.
  - Auto-sort names its scope before starting.
  - No focus ring after a pointer-initiated preview closes.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C14 (data-room files).
- Reopens: Reopens iteration 5 C12/C24 in part.

### C25 Settings polish: empty Memory band shows Filter and Download, close X on its own row at 375, 'space' wording, notification switch in Privacy, three folds on Models, sign-in card for non-admins (P3, rank 25, effort S)
- Root cause: Content rows were left as built: Memory shows controls with nothing to act on; SettingsOverlay lays the X under the section select; strings use 'space' and a vendor name; the notification switch sits under consent; AccountSettingsOverlay.tsx:254 shows the server sign-in card to everyone.
- Findings: V1-02, V1-12, J3-08, V1-13, R3-08, FLOW-10, FLOW-11
- Found by: FLOW, J3, R3, V1
- Evidence: Observed by V1, J3, R3, FLOW. Conflict: V1 did not see the sign-in card for its fresh user while R3 and FLOW (mock founder) did, so admin gating differs by user and is suspected. Memory and Voice empty panel height is the owner's fixed-height decision and is not raised.
- Reach: Every Settings visitor.
- Files:
  - apps/web/src/pages/SettingsOverlay.tsx (X in the select row; Memory empty state; Models folds)
  - apps/web/src/pages/AccountSettingsOverlay.tsx:254 (hide the sign-in card for non-admins)
  - apps/web/src/components/ApprovalRulesSettings.tsx (notification switch)
- Acceptance:
  - Memory empty state hides Filter and Download and says 'your company'.
  - At 375 the X shares the select row.
  - The sign-in card is hidden for a non-admin user.
- Needs product decision: true. Move the account Notifications switch to General and let each bot's switch only mute (recommended)?
- Dependencies / conflicts: Conflicts with C4, C6, C10 (settings files).
- Reopens: Reopens iteration 5 C22.

### C26 Duplicate entry points: Integrations in the user menu and sidebar; Task board shown in user menu and palette while empty (P3, rank 26, effort XS)
- Root cause: Shell.tsx user menu repeats the sidebar footer row; the Task board entry is gated by a server flag (ticketBoardEnabled, Shell.tsx:2149) instead of whether tickets exist.
- Findings: FLOW-09, V1-16, FLOW-08
- Found by: FLOW, V1
- Evidence: Observed by FLOW and V1; code verified (Shell.tsx:2149-2155 and the user-menu block ~5130-5175).
- Reach: Everyone.
- Files:
  - apps/web/src/pages/Shell.tsx user menu (~5130-5175), appPages (~2149)
- Acceptance:
  - The user menu has no Integrations item.
  - Task board appears in the user menu and palette only when a ticket exists.
- Needs product decision: true. Hide Task board until a bot has created a ticket (same rule as Devin)?
- Dependencies / conflicts: Conflicts with C9, C18, C28 (Shell.tsx).

### C27 Command palette: Documents and Mail groups hidden below the fold, document rows have no folder line; tour and search copy promise files (P3, rank 27, effort S)
- Root cause: Group order is fixed (Shell.tsx:~2170-2210) with a hidden scrollbar; document rows lack a second line; the tour says 'any chat, file or email' (FirstRunTour.tsx:30) and a file that is stuck in Reading is not found by name (iteration 4 C7).
- Findings: V3-07, V3-08, FLOW-02
- Found by: FLOW, V3
- Evidence: V3 observed Documents (3 Halcyon contracts) in the palette, so FLOW-02's 'palette finds no file' is true only for the unreadable file 'Board Minutes' (suspected, same cause as iteration 4 C7); the copy fix is cheap either way.
- Reach: Everyone who searches.
- Files:
  - apps/web/src/pages/Shell.tsx:~2170-2210 (cap each group at 3 with Show all, or order by match; folder path line)
  - apps/web/src/components/tour/FirstRunTour.tsx:30 (copy)
- Acceptance:
  - Searching a customer name shows Documents without scrolling.
  - Document rows show the folder path.
  - A file by exact name is found, or the tour copy says 'page, chat or email'.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C6 (FirstRunTour.tsx) and C9 (palette).
- Reopens: Reopens iteration 5 C15 in part.

### C28 Sidebar polish: a row is cut under the fade, failure badge looks like an unread count, unnamed green flag, bare space headers, silent space switch (P3, rank 28, effort S)
- Root cause: Presentation details in Shell.tsx: rk-scroll-fade-bottom does not snap to rows; the page row badge uses one style for unread and failure; a pixel icon has no name; empty spaces render as lock headers; tapping a chat in another space switches the space without a cue.
- Findings: R3-06, V2-18, V3-14, V1-07, V1-15, J3-09
- Found by: J3, R3, V1, V2, V3
- Evidence: Observed by R3, V2, V3, V1, J3 (R3-06 seed-dependent). The roving tab stop (R3-01) is a deliberate design and is dropped.
- Reach: Everyone, lightly.
- Files:
  - apps/web/src/pages/Shell.tsx (scroll fade or snap, badge destructive token for failures, space header collapse, space cue)
  - packages/ui-web pixel icon in the chat row (aria-label and tooltip, or remove)
- Acceptance:
  - No sidebar row is cut mid-height at rest at 1440x900 and 1920x1080.
  - A failed-files badge uses the destructive token.
  - The flag glyph has an accessible name or is gone.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C9, C18, C26 (Shell.tsx).

### C29 Legal: the Legal badge stays at 1 after marking Done; the header stack is tall (P3, rank 29, effort S)
- Root cause: The notifications glance query is not invalidated after a deadline changes (legal.ts legalDueSoonCount, Shell.tsx glance); three stat cards plus a footnote-size link push the table to y=330.
- Findings: J2-07, V2-12
- Found by: J2, V2
- Evidence: Observed by J2 (badge still 1 after 10 s) and V2.
- Reach: Legal users.
- Files:
  - apps/web/src/pages/legal/LegalDeadlines.tsx (invalidate glance after update)
  - apps/web/src/pages/Legal.tsx:~330 (counts in tab labels, banner row with Check now)
- Acceptance:
  - The sidebar Legal badge updates within 2 s of Done.
  - Legal table starts above y=260 at 1440x900.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C2 (Legal.tsx).

### C30 Accessibility names and focus: duplicate button names, no level-1 heading, unnamed landmark, composer aria-label with a literal ellipsis, hover row actions skipped by Tab (P3, rank 30, effort S)
- Root cause: Labels were built from partial text: 'Mark ... done' omits the contract name (LegalDeadlines.tsx:232); the shell has no h1 and an unnamed aside; the composer name is the truncated bot name; Inbox row actions are tabindex -1.
- Findings: V1-18, V2-19, J2-08
- Found by: J2, V1, V2
- Evidence: Observed by V1 (axe), V2, J2. The 4.42:1 muted contrast in light theme is a canvas estimate and is suspected.
- Reach: Screen reader and keyboard users.
- Files:
  - apps/web/src/pages/legal/LegalDeadlines.tsx:232
  - apps/web/src/pages/Shell.tsx (h1, aside name, composer aria-label)
  - apps/web/src/pages/Inbox.tsx row toolbar
  - light --muted-foreground token in @rakazo/ui-tokens (only after measuring)
- Acceptance:
  - No two buttons on Legal Deadlines share an accessible name.
  - axe reports no landmark-unique or page-has-heading-one violation.
  - Tab reaches revealed row actions while the row is focused.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C28 (Shell.tsx) lightly.

### C31 Chat cards are 576 px wide while bubbles are 640 px; the question card touches the message above it (P3, rank 31, effort XS)
- Root cause: Card containers in transcript.tsx use their own max width and spacing.
- Findings: R3-07, V2-16
- Found by: R3, V2
- Evidence: Observed by R3 and V2.
- Reach: Chat users, lightly.
- Files:
  - apps/web/src/pages/shell/transcript.tsx card containers
- Acceptance:
  - Consent, question and approval cards share the bubble max width; spacing to the previous message is 20 px.
- Needs product decision: false
- Dependencies / conflicts: Conflicts with C5 (transcript.tsx).
- Reopens: Reopens iteration 5 C26.

## Deferred items (not in a cluster)
- R2-06, R3-10, V2-06, J3-06: hard-load and chat-open timings of 4 to 75 s on the shared dev stack. Not defects until measured on a production build and an idle stack; V2-06's idea of a 'Still loading...' line after about 8 s is cheap and can be added to C7 if the re-measure confirms.
- J3-11: PDF preview body blank in headless Chromium and unknown on iOS Safari. Test on a real iPhone first.
- FLOW-15: Finance first row has five tiles and a second spend figure. Needs an owner answer: keep three tiles (recommended) and move Crypto and Treasury yield to Accounts?
- R3-01: dropped, deliberate tab stop (see above).
- V2-11: dropped, decided in iteration 4.
- Carried from earlier iterations and not re-walked: UXV-5 tablet shell, UXV-6, UXV-8 Gmail writes, UXV-10 to UXV-12; iteration 4 FLOW-10 second part (should Chief read the Finance summary itself) has no recorded owner answer.

## BLOCKED stories
- STORY-APP-309 (model step) and STORY-APP-319 (model sign-in, Connect your apps step): the demo gives every new user a default model and real provider sign-in is OAuth.
- Real OAuth Connect buttons: Gmail, Calendar, Carta (STORY-CAP-017/018), Mercury, Brex, Devin.
- STORY-FIN-019/022 approval step: no fresh payment approval card could be produced on the demo (see C3); the seeded card was reviewed visually only.
- STORY-LEG-001 and STORY-LEG-017 agent steps: Legal key rejected on the demo (see C2).
- STORY-INB-109 steps 3 to 23 (Spam, Digest, Cleanup, unsubscribe): seeded mailbox lacks those tabs.
- STORY-DRM-018 drag and drop, Move dialog; STORY-DRM-109 zip and large files.
- Touch targets for R1, R3, V2, V3 (pointer: coarse not emulated; only R2, V1 and J3 measured); C3/C4 phone toasts, C12/C14 phone thread subject and bootstrap retry, C17 15-minute Reading-to-Failed and the 'still being indexed' note.
- STORY-APP-211 steps 6, 8 to 10, 13; the email agent live send approval (card was already inactive).

## Counts by severity
- Clusters: 31 (P0 1, P1 2, P2 21, P3 7)
- Raw findings: R1 11, R2 11, R3 11, J1 12, J2 15, J3 11, FLOW 16, V1 19, V2 21, V3 16 = 143. 135 are in clusters, 8 are deferred or dropped.
- Clusters needing a product decision: C4, C6, C9, C12, C19, C23, C25, C26
- Clusters that reopen an earlier cluster whose criteria were not met: C2 (it5 C10), C3 (it5 C5), C4 (it5 C9), C8 (it5 C8), C10 (it5 C11), C14 (it5 C17), C19 (it5 C27), C20 (it5 C13), C23 (it5 C23), C25 (it5 C22), C31 (it5 C26), C1 (it3 C4).
- P0: C1. A new user's first mail question is refused with text that blames her for a switch she never touched, and no Allow card appears. P1: C2 (Legal key banner contradicts Settings) and C3 (payment path has no approval card or next step). Pass-5 clusters verified as met: C1 donut legend, C2 Create menu, C6 page options, C10 Legal consent card, C15 search, C16 preview, C19 failed-account answer, C20 composer, C24 Data room menu.
