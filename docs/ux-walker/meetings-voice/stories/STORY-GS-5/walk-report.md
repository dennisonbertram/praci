# Walk report: STORY-GS-5

Result: FAIL
Session: uxw-granola. Mockups opened via file:// in dark mode at 1280x900 (desktop) and 390x844 (spot-check).
Findings by severity: {'high': 2, 'medium': 2, 'low': 1}. By kind: plan 3, mockup 2.

## Steps

1. Agent answers from stale data: no surface (F-2).
2. Integrations, Granola (step-2-rejected.png): the mockup reuses the Key rejected view. Red border, 'Granola rejected this key', Connect. No history, no Disconnect (F-1). Geometry: clean.
3. Looking for Reconnect: not drawn (F-3).
4. Paste new key and Connect: Verifying then Connected states exist (see GS-2 steps 2 and GS-1 step 4), but readonly blocks the paste (F-4).
5. 'Synced 58 meetings, just now': Connected card exists with fixed '3 minutes ago' text.
6. Agent cites today's meeting: GS-1 agent screen applies.
Mobile 390x844 spot-check (mobile-390-rejected.png): card fits, no overflow. Pass.
Geometry results: Geometry audit: pageOverflowX 0, no overflow spills, no wrapped controls; only unevenRows hit is the mockup's own state-pill switcher (not product UI).
Flow Log: actual 6 steps vs ideal 3. Extra steps: discovering the problem (step 1-2, no signal), looking for a Reconnect control (step 3), re-asking the question (step 6). Hesitations: steps 2 and 3. Duplicated information: none.

## Findings

- F-GS-5-01 [high, plan, JF-5] The needs_reconnect state reuses the first-connect rejected view: an empty-looking masked field, 'Granola rejected this key', Connect. It drops the 'Synced 42 meetings' history and the Disconnect button, so Amara cannot tell her stored meetings still exist or that the connection (and agent) are being reused. Revoked and never-connected look identical.
- F-GS-5-02 [high, plan, JF-5] Step 1 and Inbox: journey breaks, nothing outside Integrations shows that sync stopped. The agent answers from stale meetings with no marker and no notification or Inbox message exists; Amara notices only by a missing meeting.
- F-GS-5-03 [medium, plan, JF-18] Step 3: the card shows 'Connect' only; whether she must Disconnect first, and whether the same connection and agent are reused, is not drawn or stated. The MCP detail's 'Reconnect' button has no equivalent on the key card.
- F-GS-5-04 [medium, mockup] Rejected state draws the field as readonly (see GS-2 F-5), so pasting the new key as in step 4 cannot be shown.
- F-GS-5-05 [low, mockup] The explanatory sentence 'Rejected state also appears for a key that worked earlier and was revoked in Granola.' is visible under the card and reads as product text; it is also the only place the mockup admits needs_reconnect is not separately designed.
