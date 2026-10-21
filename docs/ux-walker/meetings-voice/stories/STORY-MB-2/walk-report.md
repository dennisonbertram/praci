# Walk report: STORY-MB-2

Verdict: FAIL (static iPhone-frame mockup, judged against native iOS conventions; 390px spot-check not applicable).

Findings: 4 total. Severity {'high': 1, 'medium': 2, 'low': 1}. Kind {'plan': 2, 'mockup': 2}.

## Steps

### Step 1
Key rejected state: key stays in the secure field as 22 dots, Connect row still active, line 'Granola rejected this key' under the group. Geometry audit: clean. The line is 13 px and rendered in neutral gray (computed rgb(142,142,147)), not the destructive color; the Disconnect row elsewhere uses red. It is small and low in contrast against black and easy to miss.
Screenshot: screenshots/step-1.png

## Flow Log

Ideal 3 steps (paste, Connect, read error and take the alternative). Mockup draws the result of step 2 only. Dead end: the line gives no cause (Pro plan has no API access, typo, revoked) and no next action; Live questions says Connected in the same frame, so the alternative is on screen but is not pointed to. No hesitation in the mockup itself; the story shows the user retrying the same key twice.

## Findings

- F-MB-2-1 [high, plan, NEW] 'Granola rejected this key' gives no cause and no next step. A Pro-plan user can never succeed and the alternative (live questions) is not mentioned.
- F-MB-2-2 [medium, mockup, NEW] The rejection line is gray 13 px, not destructive red, so it reads as a hint, not an error. Contrast of gray on black is about 6:1 which passes, but it is the weakest element on the screen.
- F-MB-2-3 [medium, plan, NEW] Offline, rate limited (429) and needs_reconnect later are not drawn on mobile (web draws Rate limited). Revoked key later: user sees it only by opening Integrations, no badge.
- F-MB-2-4 [low, mockup, NEW] The key field is read-only dots after rejection in the web version and editable here; with dots the user cannot see whether the paste was truncated. No clear-field control.
