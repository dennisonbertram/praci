# Walk R3 (uxl15-R3): verify pass-14 clusters C21-C24

Target: demo stack web :5381, 1440x900 plus 375/360 phone widths. Only C21-C24 exist in iteration-14/clusters.json (24 clusters), so C25-C31 do not exist. Screenshots: /tmp/uxloop15/R3/.

## Verdicts
- C21 Contacts and Artifacts polish: PASS. Fresh user's empty Contacts shows icon, "No contacts yet", one sentence and Add contact. At 375 the second line of each row shows the organization. Artifacts filter reads "Added: Any time" by default and the menu lists Any time / Today / This week / This month. (4 steps vs 3 ideal)
- C22 Legal polish: PASS. Status column hidden when all contracts are active. Graph fits the panel at 1440 with no scroll (phone keeps a "Scroll sideways" hint). Deadlines has "Show done" / "Show open"; a closed item appears there. At 375 the Ask agent / Done / Dismiss buttons share one x on every row. (6 steps vs 5 ideal)
- C23 Layout polish: PASS. Carta menu button 124x32, menu 160 wide, no wrap. Routine schedule at 360: "at 9:00 AM" moves together to a second row, no stray wrap. Cleanup header shows one back arrow. Sign-up error ("User already exists") fills a reserved slot, field and button tops unchanged (measured 210/308/394/480/590 before and after). Routine instruction placeholder reads "What should this routine do each time it runs?". (5 steps vs 4 ideal)
- C24 Cached content: PARTIAL. Returning to Chief shows messages in the first frame (216 ms, 0 skeletons, measured in-page). Integrations still shows skeleton nodes on revisit (6 nodes for about 480 ms).
- Storybook smoke: PASS. Built storybook-static, `node .storybook/smoke.mjs storybook-static`: 1736/1736 stories rendered cleanly, no failing stories (the two AppConnect stories from C14 now pass). Note: the run takes over 10 minutes on this loaded machine.

Side effects on the shared demo: I marked the Legal deadline "Refresh the 409A valuation" done to test Show done, then clicked Show open; it cannot be reopened from the UI after the toast (see R3-02), so that deadline stays done (Deadlines count 9 -> 8). A throwaway user (walker-r3-*@northwind.example.test) was created on the demo for the empty-state check. The demo login worked normally.

Praise: Contacts empty state now matches the shared icon-title-action pattern; the Legal graph is clear and fits; sign-up error no longer shifts the form.

## Findings
| id | story/page | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R3-01 | C24 / Integrations | P3 | perf | Revisiting Integrations shows 6 skeleton nodes for about 480 ms although it was just viewed (observed, dev build). | in-page rAF sampling; c24-integrations.png | apps/web/src/pages/Integrations*.tsx query without cached data | Render cached integration list while revalidating. |
| R3-02 | C22 / Legal Deadlines | P3 | flow | A done deadline in "Show done" has no action to reopen; only the short-lived Undo toast can. Observed. | c22-done.png | apps/web/src/pages/Legal.tsx (done list near line 475) | Add a Reopen button on done rows. |
| R3-03 | C21 / Contacts empty | P3 | visual | Empty Contacts shows two identical "Add contact" buttons (header and body). Observed. | c21-contacts-fresh.png | apps/web/src/pages/Contacts.tsx:120 | Hide the header button while the list is empty, or keep and accept. |
| R3-04 | Chief chat / Hide amounts | P2 (suspected) | bug | In the Chief thread the text bubble showed "$•••" while the Cash/Burn tool card beside it showed $1,633,221 and $67,621. Later the amounts were unmasked everywhere (another walker likely toggled the per-user setting), so I could not re-check. | c23-routines2.png | tool card renderer in apps/web/src/components/ai or chat tool cards | Run tool-card values through the same amount mask; re-verify with Hide amounts on. |
