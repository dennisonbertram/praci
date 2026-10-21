# Walk report: STORY-GS-4

Result: FAIL
Session: uxw-granola. Mockups opened via file:// in dark mode at 1280x900 (desktop) and 390x844 (spot-check).
Findings by severity: {'high': 2, 'medium': 1, 'low': 1}. By kind: plan 3, mockup 1.

## Steps

0. Tile (step-0-tile.png): Granola tile with Live questions Connected and 'Sync · Business plan / Add key'. Same screen as GS-1 step 1.
1. Detail page (step-1-detail.png): MCP panel (Connected, Disconnect) above the key card. Matches step 1 only for the case MCP is connected; order is MCP first, key second, so Jonas would reach the MCP control (positive; resolves the story's edge case on page order). Geometry: clean.
2-3. Pasting a wrong token and pressing Connect: same rejected state as GS-2 (not repeated).
4. Plan hint is only 'Business plan' on the label (F-1).
5-6. MCP connect and OAuth: no surface for the unconnected state (F-2).
7-8. Agent questions: GS-1's agent screen applies; no free-plan limitation or to-do-needs-key message drawn (F-2).
Mobile 390x844 spot-check (mobile-390-detail.png): reflows, Disconnect wraps under the badge, no overflow. Pass.
Geometry results: Geometry audit: pageOverflowX 0, no overflow spills, no wrapped controls; only unevenRows hit is the mockup's own state-pill switcher (not product UI).
Flow Log: actual 8 steps vs ideal 2. Extra steps come from the wrong-key attempt (steps 2-4) caused by no plan cue. Duplicated path: two Granola connection sections (F-3).

## Findings

- F-GS-4-01 [high, plan, JF-4] Step 4: a free or Pro user sees a key field and no explanation that the key route needs Business beyond the small muted 'Business plan' suffix on the section label. The mockup, not the plan, adds that hint; the plan says the card explains nothing, so the two disagree.
- F-GS-4-02 [high, plan, NEW] Steps 5 to 8: journey breaks, no surface for the MCP route when it is not connected. The mockup draws Live questions as already Connected on every screen, so the free user's actual decision (press MCP connect) is not shown. Step 8 (no to-dos for MCP-only users) has no surface either.
- F-GS-4-03 [medium, plan, NEW] Two ways to connect Granola on one page with no stated difference except the two small section labels 'Live questions' and 'Sync'.
- F-GS-4-04 [low, mockup] Tile shows both 'Connected' and 'Add key' in one card; for a free user the visible 'Add key' CTA invites the dead-end step the story describes.
