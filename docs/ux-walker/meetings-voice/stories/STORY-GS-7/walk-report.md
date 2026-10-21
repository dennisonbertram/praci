# Walk report: STORY-GS-7

Result: FAIL
Session: uxw-granola. Mockups opened via file:// in dark mode at 1280x900 (desktop) and 390x844 (spot-check).
Findings by severity: {'high': 2, 'medium': 3, 'low': 1}. By kind: plan 4, mockup 2.

## Steps

1. Before (step-1-before.png): Sync card 'Synced 42 meetings, 3 minutes ago' with red Disconnect; one click, no dialog (F-3). Geometry: clean.
2. After (step-2-after.png): blank key field with disabled Connect, no retention line (F-1). Geometry: clean.
3. Agent still answers: drawn in the same pane as chat with 'Searched meetings' and a citation; it shows retention only implicitly (F-1, F-5).
4. Inbox, Source disconnected (step-4-source-disconnected.png): to-dos unchanged, checkboxes usable; note below the card (F-4).
5. Delete the meetings: no surface (F-2).
6. Paste a new key later: not drawn (F-2).
Mobile 390x844 spot-check (mobile-390-after.png): stacked blocks fit, no overflow. Pass.
Geometry results: Geometry audit: pageOverflowX 0, no overflow spills, no wrapped controls; only unevenRows hit is the mockup's own state-pill switcher (not product UI).
Flow Log: actual 2 clicks to disconnect (ideal 2), but 3 further steps (agent, Inbox, hunting for delete) to learn that data stayed. Hesitations: step 2 and 5. Duplicated information: stored-data fact appears on card (none), agent and Inbox (implicit), and the existing MCP dialog 'Your data in {name} is not deleted'.

## Findings

- F-GS-7-01 [high, plan, JF-7] Step 2/3: after Disconnect the card returns to the blank key field with no line that Rakazo keeps the meetings and to-dos. The mockup's 'After' puts a chat answer and a to-do directly under the card, which shows the data survives only by juxtaposition, not by any text. Ethan expected disconnect to mean removal.
- F-GS-7-02 [high, plan, JF-7] Step 5: journey breaks, no control exists to delete stored meetings (not drawn, not in the plan). Step 6 (re-paste a key and see the old meetings again) is also not drawn.
- F-GS-7-03 [medium, plan, JF-7] Disconnect on the Connected card is a single red click with no confirmation and no undo. Because the plan says 'no confirm about data', it is unclear whether any confirm appears at all; the mockup draws none.
- F-GS-7-04 [medium, plan, JF-22] In the Inbox 'Source disconnected' state the to-dos look identical to connected ones; nothing marks them as from a disconnected source, so Ethan cannot connect the Inbox list to his disconnect. The only text is a mockup note outside the card.
- F-GS-7-05 [medium, mockup] 'After' state merges three surfaces (Integrations card, agent chat, Inbox To do card) into one pane under a sidebar that highlights 'Granola agent', with no page title or back link and 'Integrations' not highlighted. A reader cannot tell which page they are on.
- F-GS-7-06 [low, mockup] The note 'Granola was disconnected from Integrations. The to-dos stay and can still be completed.' on the Inbox screen is explanatory mockup text outside the card; it is not product copy but could be taken for it.
