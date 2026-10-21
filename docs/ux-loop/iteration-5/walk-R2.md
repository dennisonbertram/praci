# Walk R2 (iteration 5): verify pass-4 clusters C11-C19

Target: mock-data demo stack (web :5381), 1440x900 desktop plus 375x812 checks. Screenshots in /tmp/uxloop5/R2/. Dev-server timings, not a production build. Pointer-coarse touch emulation was not run, so no touch-target findings.

## Verdicts (steps actual/ideal)

- C11 tour: PASS (9 stops kept; step 7 copy now says "turn on Action confirmations in Settings", matching the three switches that read off; at 375 one Escape ends the tour and leaves the drawer open). Walk 12/12.
- C12 Inbox: PASS (first mail row at y=217 at 1440 and y~370 at 375 with consent card; one tab row; account choice moved into Filter menu; sidebar badge reads "14 unread" and matches; "Digest" is a labelled toggle but only on the Newsletters tab). 3/3.
- C13 Legal consent: PASS (composer disabled with "Allow access on the page to ask" while the page Allow is the only Allow; after Allow the composer enables and no stale error remains). Held-message single re-send not testable (no message can be held). 3/3.
- C14 Models: PASS (Connected, Disconnect, Replace key fold closed by default, model shown once; provider list has no inner scroll at 375). 4/4.
- C15 Cap table: PASS with one defect (header and Add contact stay fixed, agent panel closed on first open, 9 holder rows visible, SAFE note present, header and body text start at the same x). Donut legend share counts are clipped, see R2-02. 2/2.
- C16 Deadlines: FAIL (partial) ("Ask agent" on every row works and sends the row as context; Active chip gone; but identical first lines remain). 4/4.
- C17 Palette: PARTIAL (agents no longer rank first; match highlighted in documents; key-hint footer present; artifact name matches the Artifacts page; but first result for "pilot" and "bolt" is a contact with no visible match). Sidebar-search "Message" label not re-checked (UNVERIFIED). 4/3.
- C18 Loading: PASS (thread skeleton visible at ~155 ms; spaces.list 2 calls in ~4 min; Apps detail shows skeleton at 1-2 s on a dev server, content by ~4 s). Not a production build.
- C19 Ask focus: PASS for focus (activeElement stayed the composer at 1 s, 6 s and 10 s) and hand-off (one "Messaged Carta agent" row). Approval card body font NOT VERIFIED (no approval card reached; the run fails on the placeholder API key).

## Praise
- Cap table now fits header, tiles, SAFE note and nine rows in one 1440x900 view.
- Legal deadlines: Ask agent / Done / Dismiss row actions are clear; overdue pill is strong.
- Palette footer and highlighting read well; tour copy now matches Settings.

## Findings

| id | page | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R2-01 | Legal Deadlines (C16) | P2 | copy | Observed: three rows start "Send non-renewal notice" (plus "Renews automatically"); contract name only on line 2, and "Due in N days" sits inline on some rows and on line 2 on others. Expected unique first line. | s10-deadlines.png | apps/web/src/pages/Legal.tsx (deadlines list) | Put the contract name in the title ("Send non-renewal notice: Cobalt Cloud Hosting") and always render the due text in one place. |
| R2-02 | Cap table donut card (C15) | P2 | visual | Observed: share counts in the legend clip at the card edge ("8,400,0", "1,600,0"); text right edge 1429 vs card right 1412 at 1440. | s15-cap.png | apps/web/src/components/cap-table/OwnershipDonut.tsx (legend row) | Let the legend column shrink (min-w-0, truncate name) or drop the count column when narrow. |
| R2-03 | Command palette (C17) | P2 | flow | Observed: for "pilot" the first result is a contact (Sam Samplesworth) and for "bolt" Robin Prospect, with no visible reason; the highlighted matches are in Documents below. | s18-pilot.png, s19-bolt.png | apps/web/src/pages/Shell.tsx palette ranking/rows | Show the matched field (company or email snippet) under a contact hit, or rank name matches first. |
| R2-04 | Legal contracts table (C16) | P3 | visual | Observed: the "Status" column is now empty for every row but keeps its header and width. | s07-legal.png | apps/web/src/pages/Legal.tsx contracts table | Remove the column, or show a chip only for non-Active contracts as the cluster intended. |
| R2-05 | Legal Overdue KPI (C16) | P3 | flow | Observed: Overdue 1 in red is not clickable and does not lead to the overdue deadline (the pill is on the Deadlines tab only). | s07-legal.png | apps/web/src/pages/Legal.tsx KPI tiles | Make the KPI switch to Deadlines with the overdue row first. |
| R2-06 | Inbox Digest (C12) | P3 | visual | Observed: the Digest toggle appears only on the Newsletters tab, has no button outline and sits 3 px higher than the tab pill. | s06-news.png | apps/web/src/pages/Inbox.tsx:1292-1306 (-mt-2 offset) | Align to the tab row and give it the same outline as the tabs. |
| R2-07 | Settings > Privacy and approvals (C11) | P2 | flow | Observed (ambiguity): after pressing Allow on the Legal consent card, "AI data sharing: Bots, mail, files and contracts" stays off for both models. Expected: one consent state, or copy that explains the difference. | s14-priv.png | apps/web/src/components/ApprovalRulesSettings.tsx and Legal consent state | Link the two states, or relabel one of them. Needs a product answer on whether they are separate by design. |
| R2-08 | Agent run errors (C19) | P3 | copy | Observed: the Legal agent says the model provider did not accept the API key (Settings > Models); the Investor Relations agent says "This agent could not finish. Try again." with Retry, although the cause is the same key. Retry cannot succeed. | s11-askagent.png, s24-handoff.png | apps/web/src/pages/shell composer error mapping | Use the same key-error message and Settings link in every thread. |
| R2-09 | Sidebar badge (C12) | P3 | bug | Observed: Inbox badge shows 13 on load, 14 after opening Inbox, 13 after a reload. Suspected cache versus live count. | s03-inbox.png, s27 | apps/web/src/pages/Shell.tsx badge source | Use one source for the badge and list count. |
| R2-10 | Integrations detail (C18) | P3 | visual | Observed: the Mercury detail header shows a generic grid glyph while the Integrations card shows the Mercury logo. | s26-mercury.png vs s25-integ.png | apps/web/src/components/integrations/McpDetail.tsx | Reuse the card's logo component. |
| R2-11 | Tour end (C11) | P3 | copy | Observed: the last stop's primary button is "Ask a question" (opens the Inbox agent panel) rather than a finish action; stop 9 is not a clear end. | s03-inbox.png | apps/web/src/components/tour/FirstRunTour.tsx | Label the button "Done"; keep Ask as a secondary link, or note this is intended. |

## Not covered
- C17 sidebar search "Message" label, palette bottom fade.
- C19 approval card body font, hand-off after an approval.
- C13 held-message re-send exactly once.
- C18 spaces.list on a production build; Finance Accounts skeleton.
- Touch targets (no pointer: coarse emulation run).
