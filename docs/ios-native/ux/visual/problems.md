# iOS design boards: ranked problems (round 1)

Source: the round 1 returns from ux-flow (8 journeys + redundancy), ux-walker (5 walks) and ux-visual (6 page sets), judged against the boards in `docs/design-system/ios/boards/`. All evidence is from static screenshots and board source; nothing was clicked on a device.

Open counts are approximate after merging duplicates: critical 2, high about 40, medium about 150, low about 90.

Ranking = severity x journey centrality x reach, divided by effort. A cluster is one design decision.

## Ranked clusters

### K1. Create sheets cannot be completed (critical)
- Root cause: New bot, New group and New space were drawn as three different patterns. The commit control is an unlabeled check, there is no disabled state, and member rows have no selection state.
- Issues: V-home-R1-1 (P0), V-home-R1-16..20, F-duo-019, F-duo-020, F-duo-022, F-first-run-home-006, 008, 009, 010, 019, 020, V-pages-R1-6, V-pages-R1-20, V-account-R1-6, RED-R1-14, STORY-019-R1-8.
- Boards: PG-B-NewBot, PG-B-NewGroup, PG-B-NewSpace, PG-B-Server, PG-B-BotSettings, PG-B-GroupSettings.
- Acceptance: all three create flows are sheets with a medium detent; X on the left, a text capsule "Create" or "Save" on the right; Create is dimmed while Name is empty; NewGroup rows show a selection mark and a "2 selected" count with a 2 to 6 limit; no default state shows an error line.

### K2. Page data contradicts itself (critical)
- Root cause: the Finance chart and the Runway page were drawn per board with different names, period models and values.
- Issues: V-pages-R1-1 (P0), V-pages-R1-3, V-pages-R1-17, STORY-085-R1-1, F-duo-015, F-duo-016, F-finance-settings-006, RED-R1-15, STORY-076-R1-6.
- Boards: PG-A-AgentPage, PG-B-Finance, Desk.
- Acceptance: one chart named "Monthly burn", 12 labeled months, tabs 30 days / 90 days / 12 months that change the chart; the AgentPage line direction matches its sentence and has dated axis labels; Desk top half shows the same page.

### K3. Connect a model and AI data consent (judgement)
- Root cause: first run needs two gates (Connect, then "Share data with Model A?") and the "after connecting" card offers "Create a bot" while Chief exists.
- Issues: STORY-019-R1-1..7, 9, RED-R1-4, V-home-R1-3..6, V-thread-R1-14, V-thread-R1-15, F-thread-R1-004, F-thread-R1-006.
- Boards: PG-A-HomeNoModel, PG-B-Consent, PH-Home, PG-A-ThreadStates.

### K4. Mail draft card: how it is edited, saved, replaced (judgement)
- Root cause: the Save/Send card has no edit entry; PG-A-Compose is a send-new-mail screen; Save is ambiguous.
- Issues: STORY-047-R1-1, 3, 4, 6, F-thread-012, V-thread-R1-5, V-iphone-R1-12, RED-R1-10, V-inbox-R1-10, F-inbox-computer-R1-002.
- Boards: PG-A-Thread, PH-Thread, PG-A-Compose, DS-06-Chat, Inner.

### K5. Approval pending vs. working state and the one tinted action (judgement)
- Root cause: "is working" shows under a finished draft; the composer Send and the card Send are both prominent; a scrolled-away approval has no cue.
- Issues: V-thread-R1-2, 9, 18, F-thread-014, 015, STORY-047-R1-2, 5, V-iphone-R1-13, F-duo-006, RED-R1-16.
- Boards: PG-A-Thread, PG-A-GroupThread, PH-Thread, PG-A-ThreadStates, DS-06-Chat.

### K6. Inbox control set and prominent action (judgement)
- Root cause: Sheet, Split, PH-Inbox, Inner and the Cleanup board each draw a different action set and a different prominent action; the standard iPhone cannot reach the Inbox agent or Cleanup.
- Issues: RED-R1-7, 8, F-duo-R1-002, F-inbox-computer-R1-001, R1-004, F-inbox-computer-007, STORY-064-R1-3, F-duo-003, 004, 012, V-inbox-R1-2, 5, 15.
- Boards: Sheet, Split, PH-Inbox, Inner, PG-A-InboxMessage, PG-A-Cleanup, DS-03, DS-04.

### K7. Duo inner, half-folded and laptop poses are rule text only (judgement on scope)
- Root cause: only some pages have boards for the inner display and the laptop pose.
- Issues: F-duo-001, STORY-085-R1-2, 3, F-first-run-home-011, 023, STORY-064-R1-1, 6, F-duo-014, F-inbox-computer-014, 025, 026, F-finance-settings-007, STORY-076-R1-7.

### K8. Home is drawn four ways
- Root cause: PG-A-Home, PH-Home, Main and Split disagree on section order, Pages, Activity, counts and placeholders.
- Issues: RED-R1-1, 2, 3, 5, 11, 12, F-first-run-home-R1-003, R1-004, 015, 017, 018, 022, V-iphone-R1-1, 2, 17..21, V-home-R1-8..13, F-duo-R1-001, F-duo-008, F-duo-025, F-thread-016, STORY-076-R1-1.
- Boards: PG-A-Home, PH-Home, Main, PG-B-Spaces, PH-Spaces.
- Acceptance: one order (title, Activity, Personnel with Chief first, Pages, Artifacts) on all four; no `[N]` or `[AMOUNT]` placeholder; each agent shown once; the approval row has a pill and chevron.

### K9. Computer: watch, take control, hand off, release
- Issues: STORY-076-R1-2, 3, V-iphone-R1-3..9, V-pages-R1-7, 21, F-duo-013, F-inbox-computer-015, 016, 022, F-inbox-computer-010.
- Boards: PG-A-Computer, PH-Computer.
- Acceptance: Release (labelled "Release control" or "I'm done" while an agent waits) sits in the same slot as Take control; no X while in control; at most three glass groups.

### K10. Thread entry points and unlabeled controls
- Issues: F-first-run-home-021, F-thread-R1-001, 002, F-duo-028, V-thread-R1-6, 8, 11, STORY-043-R1-7.
- Boards: PG-A-Thread, PH-Thread, PG-A-GroupThread, new PH-GroupThread, Inner.
- Acceptance: PH-Thread has a More menu (settings, open computer, archive, delete); each header icon has an accessible name line; the composer shows "+".

### K11. Chat component states and approval safety
- Issues: V-thread-R1-1, 17, F-thread-003, 009, 013, 017, 018, 020, 024, 025, 026, STORY-043-R1-1, 2, 4..6, 8, V-thread-R1-3, 4, 10, 13, 16, F-duo-007, F-thread-R1-003.
- Boards: DS-06-Chat, PG-A-ThreadStates, PG-A-Thread, PG-A-GroupThread, PH-Thread.
- Acceptance: no standing "Always allow" on a money or send tool; attach menu, upload ring, secret card, CONFLICT, unknown block, reconnecting, empty and read-only states are drawn; "Needs approval" text is 4.5:1.

### K12. Mail screens lack states
- Issues: V-inbox-R1-1, 3, 4, 6..13, STORY-064-R1-2, 5, 7, F-inbox-computer-004, 005, 011, 013, R1-002, R1-003, STORY-047-R1-4, V-iphone-R1-22..24, RED-R1-9.
- Boards: Sheet, PH-Inbox, PG-A-InboxMessage, PG-A-Compose, PG-A-Cleanup.

### K13. Account, settings and sign-in states
- Issues: F-first-run-home-003, 005, 012, R1-001, R1-006, R1-008, RED-R1-6, RED-R1-13, V-account-R1-1..5, 7..13, F-finance-settings-008..016, F-thread-010, 011.
- Boards: PG-B-SignIn, SignUp, ForgotPassword, Account, Settings, Models, Voice, Integrations.

### K14. Pages boards: row rules, states, duplicates
- Issues: V-pages-R1-2, 4, 5, 8..16, 18, 19, STORY-085-R1-5, 7..12, STORY-076-R1-4, 5, F-finance-settings-002..005, F-inbox-computer-019, 021.
- Boards: PG-B-Legal, PG-B-CapTable, PG-B-DataRoom, PG-A-Routine, PG-A-Artifact, PG-A-Artifacts, PG-A-AgentList, PG-A-Image.

### K15. Spec boards and rule cards are stale
- Issues: F-duo-002, 010, 011, 019, 023, 026, 029, F-thread-005, 023, 028, 029, F-inbox-computer-006, 018, RED-R1-16 (glass-group wording), STORY-085-R1-6.
- Boards: DS-03, DS-04, DS-05, DS-07, PG-A-Rules, PG-B-Rules, README.

## Items sent to the owner

See `needs_product_decision` in the consolidation return: SSO account delete, call control, reactions, routine Run now, sign-up as launch mode.
