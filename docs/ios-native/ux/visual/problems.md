# iOS design boards: ranked problems (round 2)

Source: round 2 audits from ux-flow (STORY-019, 043, 047, 064, 076, 085, redundancy), ux-walker (first-run-home, thread, inbox-computer, finance-settings, duo) and ux-visual (iphone, home, thread, account, inbox, pages), judged against the boards in `docs/design-system/ios/boards/`. All evidence is from static screenshots and board source.

Open counts are approximate after merging duplicates: critical 0, high about 21, medium about 100, low about 100. Raw audit totals are higher because many findings repeat.

Ranking = severity x journey centrality x reach, divided by effort. One cluster = one design decision. Clusters marked JUDGEMENT have more than one reasonable design and are decided separately; their issues are not in the fix groups.

## Ranked clusters

### C1. Send stays enabled while the agent replaces the draft (high)
- Root cause: the "Agent editing the draft" frame dims Edit but not Send.
- Issues: STORY-047-R2-1, V-iphone-R2-2, V-thread-R2-1; related low STORY-047-R2-2.
- Boards: PG-A-Thread, PH-Thread, PG-A-ThreadStates.
- Evidence: Send is bright while the tag reads "Updating".
- Acceptance: every Updating frame dims Send like Edit; "Draft replaced" shows the new card with "Cc Jordan Lee" and "10:30".

### C2. Switching space shows the old space's data (high)
- Root cause: the loading frame skeletons Activity and Personnel but not Pages counts.
- Issues: V-iphone-R2-1, V-home-R2-1.
- Boards: PH-Spaces, PG-B-Spaces, PG-A-Home (Loading frame).
- Acceptance: while "Switching to Northwind" shows, no Pages row shows a Personal count.

### C3. Model-provider consent missing or contradictory (high) JUDGEMENT
- Root cause: the "Share data with Model A?" sheet was removed. STORY-019 flow prefers a one-line notice under Connect; the thread walker wants the first-use sheet back.
- Issues: F-thread-007, F-thread-R1-004, F-thread-R2-009, V-thread-R2-12, V-thread-R2-13, V-iphone-R2-13.
- Boards: PG-B-Consent, PG-A-HomeNoModel, PH-Inbox.

### C4. Compose frames replace Send with Done (high) JUDGEMENT
- Root cause: flow accepts Edit draft then Send on the card (3 to 6 actions); visual audit says a reopened draft has no Send.
- Issues: V-inbox-R2-1, STORY-047-R2-3, V-inbox-R2-12, RED-R2-5.
- Boards: PG-A-Compose.

### C5. Inner, laptop and phone poses missing for many screens (high) JUDGEMENT on scope
- Root cause: most screens are drawn for the Duo outer display only. Choice: draw every pose, or one recipe per layout family plus one example.
- Issues: STORY-064-R2-1, 064-R2-2, 064-R2-3, 064-R2-5, STORY-085-R2-2, 085-R2-3, F-duo-001, F-duo-R2-004, F-inbox-computer-026, F-inbox-computer-R1-001, STORY-076-R2-6, STORY-043-R2-3.
- Boards: Inner, Inner-Message, Split, Desk, new PH boards.

### C6. Home order buries Inbox; Personnel not in recency order (high) JUDGEMENT on placement
- Issues: V-iphone-R2-5, V-iphone-R2-6, V-home-R2-11, RED-R2-1, F-thread-016, F-thread-019.
- Boards: PH-Home, PG-A-Home, Main, Split.
- Note: sorting by recency and matching subtitle to stamp is not in doubt (goes to fix group 1). The open choice is where Pages and Inbox sit.

### C7. Finance period control changes nothing (high) JUDGEMENT
- Issues: V-pages-R2-1, V-pages-R2-5, V-pages-R2-6.
- Boards: PG-B-Finance. Choice: make the range drive figures and chart, or remove the control and label the period.

### C8. Forms drawn only in the ideal state (high)
- Root cause: no error, loading, success, disabled-reason or keyboard frames.
- Issues: V-account-R2-1 to 8, 10, 11, 12, 15 to 18; F-finance-settings-012, R1-002, R2-002; STORY-019-R2-1, 019-R2-2; V-home-R2-2.
- Boards: PG-B-SignIn, PG-B-SignUp, PG-B-ForgotPassword, PG-B-Account, PG-B-Server, PG-B-Models, PG-B-Voice, PG-B-Integrations.
- Acceptance: each board has frames for field error, submitting and success; every dimmed primary action shows its reason; Server Save is dimmed under "This is not a Praci server".

### C9. "agent" and "bot" name the same thing (high)
- Issues: V-home-R2-3, F-duo-R2-002, F-first-run-home-R2-001, RED-R2-10, RED-R2-12.
- Decision applied: "agent" everywhere (menus, sheet titles, "Archived agents", account-deletion text). "Page" is used only for the Home Pages list and the agent page.
- Acceptance: no user-visible "bot" remains on any board.

### C10. Cleanup counts, confirm and entry disagree (high)
- Issues: V-inbox-R2-3, 4, 5, 6; RED-R2-6; F-inbox-computer-R2-002.
- Boards: PG-A-Cleanup.
- Acceptance: menu count equals ticked senders or the sender without a link is marked; confirm lists both actions and says unsubscribe cannot be undone; progress frame reads "Archiving 40 of 101" with Cancel.

### C11. Opened message hides the draft the row announced (high)
- Issues: V-inbox-R2-2. Boards: PG-A-InboxMessage.
- Acceptance: a "Draft ready" card with one prominent "Review draft".

### C12. DS-06-Chat page clipped (high)
- Issues: F-thread-R2-001, V-thread-R2-7, 8, 9, 10. Boards: DS-06-Chat.
- Acceptance: fixed 7400 px height and overflow hidden removed; all specimens visible; attach, stop glyph and approval pill match the thread boards.

### C13. Destructive chat actions lack confirmation (medium)
- Issues: F-first-run-home-R2-002, V-iphone-R2-11, V-thread-R2-5, RED-R2-13.
- Boards: PG-A-Thread, PH-Thread, PH-GroupThread, PG-A-GroupThread.

### C14. Thread composer states mislead (medium)
- Issues: V-thread-R2-2, 3, 4, 6, 14; STORY-043-R2-1, 2, 4, 6.
- Boards: PG-A-ThreadStates, PH-Thread.

### C15. Glass-group and tinted-action limits exceeded (medium)
- Issues: V-iphone-R2-8, 9, 10; V-home-R2-5, 6; V-pages-R2-15, 18, 19; RED-R2-19.
- Boards: PH-Thread, PH-Inbox, PG-A-HomeNoModel, PG-B-DataRoom, PG-A-Computer, PG-A-Routine.

### C16. Rule cards lag the boards (medium)
- Issues: F-inbox-computer-R2-001, STORY-085-R2-1, 85-R2-4, 85-R2-5, 85-R2-7, STORY-064-R2-5.
- Boards: PG-A-Rules, PG-B-Rules.

### C17. Inbox rows, toasts and chips differ per board (medium)
- Issues: V-inbox-R2-7, 8, 9, 10, 15; V-iphone-R2-7; RED-R2-8; STORY-064-R2-4.
- Boards: PH-Inbox, Sheet, Split, PG-A-InboxMessage.

### C18. Settings has no Server row; data-sharing wording vague (medium)
- Issues: F-first-run-home-R1-007, V-account-R2-13, 14, F-thread-R2-004, F-thread-R2-005.
- Boards: PG-B-Settings, PG-B-Integrations.

### C19. No call entry on threads (medium)
- Issues: F-thread-027. Default: add "Call" to the chat menu. Boards: PG-A-Thread, PH-Thread.

### C20. Pages family gaps (medium)
- Issues: V-pages-R2-2, 3, 4, 7 to 14, 16, 17, 20 to 26; F-finance-settings-R2-001; STORY-076-R2-1 to 5; STORY-085-R2-5, 85-R2-6.
- Boards: PG-B-Legal, PG-B-CapTable, PG-B-DataRoom, Desk, Desk-Computer, PG-A-Routine, PG-A-Image, PG-A-Artifact, PG-A-Artifacts, PG-A-AgentPage, PG-A-AgentList, PG-A-Computer, PH-Computer.

### C21. Creation sheets lack keyboard, discard and error states (medium)
- Issues: V-home-R2-13, 14, 15, 16; V-pages-R2-27, 28; RED-R2-14, 15.
- Boards: PG-B-NewBot, PG-B-NewGroup, PG-B-NewSpace, PG-B-BotSettings, PG-B-GroupSettings.

### C22. Layout defects, one-line fixes (medium)
- Issues: F-thread-R2-003, F-duo-R2-001, V-iphone-R2-3 (PH-GroupThread header spills 17 px); V-iphone-R2-4, V-iphone-R2-12.
- Boards: PH-GroupThread, PH-Home, PH-Computer.

### C23. Identity, status words and Activity rows disagree (medium)
- Issues: RED-R2-11, RED-R2-3, V-home-R2-7, 8, 9, 10, 12.
- Boards: PG-A-Home, PG-A-Activity, PG-B-Spaces, PG-B-Account, PG-B-Settings.
