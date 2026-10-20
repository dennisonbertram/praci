# Walk report: STORY-IF-8

Result: FAIL
Session: uxw-granola. Mockups opened via file:// in dark mode at 1280x900 (desktop) and 390x844 (spot-check).
Findings by severity: {'high': 1, 'medium': 1, 'low': 1}. By kind: plan 2, mockup 1.

## Steps

1. Inbox (step-1-empty.png): To do card, one muted line 'No follow-ups from meetings yet'. Matches the ideal path, but not today's page (F-1). Geometry: clean.
2. 'Connect mail' button path: not drawn (F-1).
3. Granola card status 'Synced 12 meetings, 3 min ago': the key card Connected state exists (GS-1 screenshots) but with 42 meetings and no link to the Inbox sentence.
4. Empty-state wording: drawn; failure vs nothing not separated (F-2).
Mobile 390x844 spot-check (mobile-390-empty.png): card fits, no overflow. Pass.
Geometry results: Geometry audit: pageOverflowX 0, no overflow spills, no wrapped controls; only unevenRows hit is the mockup's own state-pill switcher (not product UI).
Flow Log: actual 1 step in the mockup vs ideal 1; real path has 3-4 because of the 'Connect mail' detour (F-1). Hesitation at step 2. Duplicated information: sync count on the card vs empty Inbox with no relation stated.

## Findings

- F-IF-8-01 [high, plan, JF-1] Steps 1-2: the mockup shows 'To do / No follow-ups from meetings yet' alone, but today Leo's Inbox shows 'No mail connected / Connect mail' and the To do card returns null when empty. The drawn state does not exist in the plan or code path, so the first thing Leo sees (a Gmail prompt) is not drawn.
- F-IF-8-02 [medium, plan, NEW] 'No follow-ups from meetings yet' does not distinguish 'sync still running', 'digest failed silently' and 'no commitments found'. Leo cannot tell failure from nothing.
- F-IF-8-04 [low, mockup] The empty card sits in the top-left of a large pane (about 300 px tall page with 60 percent empty); acceptable for a mockup, but the empty state has no visual anchor.
