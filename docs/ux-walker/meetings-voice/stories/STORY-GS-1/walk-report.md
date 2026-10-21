# Walk report: STORY-GS-1

Result: FAIL
Session: uxw-granola. Mockups opened via file:// in dark mode at 1280x900 (desktop) and 390x844 (spot-check).
Findings by severity: {'high': 1, 'medium': 5, 'low': 3}. By kind: plan 4, mockup 5.

## Steps

1. Integrations tile (screenshots/step-1.png): Granola tile with Live questions Connected and 'Sync · Business plan / Add key'. Matches story step 1 (letter logo). Badge wrap noted (F-8). Geometry: clean.
2. Detail page (step-2.png): Live questions panel, then 'Sync · Business plan' card with 'Granola API key' field and disabled Connect. Story expectation met; card is visible before MCP-only users decide. Geometry: clean.
3. Entering and Verifying (step-3-entering.png, step-3-verifying.png): field masked, button reads 'Connecting…' and the field is disabled. Meets story step 3; the plan has no such text (mockup invented it), so this is a plan gap resolved only in the mockup.
4. Connected (step-4-connected.png): 'Synced 42 meetings, 3 minutes ago' with Disconnect. No first-sync state, no agent link (F-1, F-2). The Live questions panel is absent on this screen (F-3).
5. Agent creation: no surface (F-2).
6. Reopen after a minute: no distinct state drawn (F-1).
7. Agent answer (step-7.png): tool chip 'Searched meetings', two sentences each cited 'Pricing review, 12 Oct'. Matches the plan. Geometry: clean. Empty-store wording ('no synced meetings') not drawn.
8. Follow-up 'Who else was on that call?': not drawn.
9. Inbox with to-dos (step-9.png): To do card with three items, due labels, 'From:' lines. Layout is the meeting-only page, not the mail user's (F-6).
10. Tick (step-10.png): checkbox fills and text strikes through; the row does not fade out as the note claims (mockup shows only the strike).
Mobile 390x844 spot-check (mobile-390-detail.png): detail page reflows, Disconnect wraps under the badge, no overflow. Pass.
Geometry results: Geometry audit: pageOverflowX 0, no overflow spills, no wrapped controls; only unevenRows hit is the mockup's own state-pill switcher (not product UI).
Flow Log: actual 10 steps vs ideal 4 (paste, Connect, ask, Inbox). Extra steps come from reopening the page to learn sync state (step 6), finding the agent in the bot list (step 7; no link from the card), and no auto-navigation to Inbox. Hesitations: step 3 (no feedback text in plan), step 5 (agent unannounced), step 6 (is 41 everything?). Duplicated information: sync count on card vs agent answer vs Inbox; two Disconnect buttons (F-3).

## Findings

- F-GS-1-01 [high, plan, JF-6] Step 4/6: no first-sync state. After 'Connecting…' the card jumps to 'Synced 42 meetings, 3 minutes ago'; the first-sync-running and '0 meetings so far' states are not drawn, so Maya cannot tell if 42 is complete or a first batch.
- F-GS-1-02 [medium, plan, JF-18] Step 5: journey breaks, no surface tells Maya the Granola agent now exists or links to it. The Connected card has only the status line and Disconnect.
- F-GS-1-03 [medium, plan, NEW] Detail page (and 390px spot-check) shows two identically labelled red 'Disconnect' buttons once the key is connected (Live questions and Sync) with no scope in the label. Screen 2 draws the Sync card alone, so the pair is never drawn together.
- F-GS-1-04 [low, plan, NEW] Tile and detail use 'Live questions' and 'Sync · Business plan' as section labels. A first-time user does not know that 'Sync' is the route that gives Inbox to-dos, and the tile button 'Add key' does not say what a key is for.
- F-GS-1-05 [medium, mockup] Mockup tile and sidebar show Granola 'Connected' for Live questions and a 'Granola agent' already in the sidebar, but GS-1's persona has never connected Granola. The first-time state (tile unconnected, no agent) is not drawn.
- F-GS-1-06 [medium, mockup] Step 9: GS-1's user has mail with triage on (To do on the Important pile), but the Inbox mockup draws the meeting-only layout ('no mail account'). The mail + meeting Inbox is not drawn for this story (IF-2 not mocked).
- F-GS-1-07 [low, mockup] Disabled 'Connect' renders as a mid-grey solid button with dark text in dark mode, which looks more enabled than disabled.
- F-GS-1-08 [low, mockup] Integrations tile: the 'Connected' badge on the Granola tile wraps onto its own line under 'Live questions' (the row's min-width forces a wrap), while the Slack tile's badge sits on one line. Tile contents look uneven.
- F-GS-1-09 [medium, mockup] To-do checkboxes are 16x16 px and citation chips about 19 px tall, below the 32 px minimum for touch targets (desktop mockup).
