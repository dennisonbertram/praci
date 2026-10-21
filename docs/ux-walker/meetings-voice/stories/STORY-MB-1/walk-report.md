# Walk report: STORY-MB-1

Verdict: FAIL (static iPhone-frame mockup, judged against native iOS conventions; 390px spot-check not applicable).

Findings: 6 total. Severity {'high': 1, 'medium': 2, 'low': 3}. Kind {'plan': 2, 'mockup': 4}.

## Steps

### Step 1
Granola mockup #screen-mobile, Key card Empty. Geometry audit: clean (only the harness state pills differ in width). LOOK pass: grouped list, large title, back chevron, secure field row, Connect row. Rows 44 px. Nothing wrapped or clipped. Looks like iOS Settings; no Liquid Glass element (plain back text, flat gray grouped rows).
Screenshot: screenshots/step-1.png

### Step 2
Typed a key into the secure field: dots show, caret visible. Connect row is full strength although the field was empty a moment ago (web draws it disabled when empty). No paste affordance or keyboard drawn.
Screenshot: screenshots/step-2.png

### Step 3
Tapped Connect: state jumps straight to Connected: 'Synced 42 meetings, 3 minutes ago' plus a red Disconnect row. No Verifying state and no success cue. 3 minutes ago is shown for a sync that just began. The 'Live questions / Signed in with Granola / Connected' group above is unchanged and already says Connected before any key exists.
Screenshot: screenshots/step-3.png

## Flow Log

Ideal 4 steps (Settings, Integrations; Granola tile; paste; Connect). Mockup draws 2 of them (paste, Connect). Steps 1-2 (reach the Granola page from Integrations) have no surface; the back chevron says Integrations but the list is not drawn. Hesitation: the Live questions group reads Connected while Sync is empty, so the user cannot tell which group the key belongs to. Duplicated info: 'Connected' appears twice in Connected state (live questions row, then sync row).

## Findings

- F-MB-1-1 [high, plan, JF-3] Steps 1-2 (Settings, Integrations list, finding the Granola tile) have no mocked surface; the mobile page is drawn as if already open. Mobile integrations only lists server catalog tiles, and Add starts OAuth, which is wrong for a key connector.
- F-MB-1-2 [medium, mockup, JF-32] 'Live questions: Signed in with Granola, Connected' group is drawn on mobile though mobile has no Granola MCP tile; it also reads Connected above an empty key field.
- F-MB-1-3 [low, mockup, NEW] Connect row has no disabled style while the key field is empty (web card disables it).
- F-MB-1-4 [medium, mockup, NEW] Web card has Entering, Verifying and Rate limited states; mobile draws only Empty, Connected, Key rejected. After tapping Connect there is no busy state or success cue.
- F-MB-1-5 [low, mockup, NEW] No Liquid Glass or native back-button treatment: back is plain text with a chevron, rows are flat dark fills, status bar shows three dots in place of signal, wifi and battery. Acceptable for a wireframe; AGENTS.md asks for native controls and Liquid Glass.
- F-MB-1-6 [low, plan, NEW] Plan does not say the pasted key is trimmed (password managers add trailing newlines).
