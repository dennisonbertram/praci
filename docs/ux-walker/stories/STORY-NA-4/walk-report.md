# Walk report STORY-NA-4

Screenshots cited here are kept locally and not committed; the written findings are the record.

Verdict: PASS with warnings

## Flow log
Deviation: the mock completes sign-in at once. Clicking 'Connect Slack' opened a dialog at 'Step 2 of 3' (which bots can use Slack), then 'Slack connected'. No popup and no pending state, so steps 3-4 (pending/Try again) NOT WALKABLE here. Connected path walked: Slack left the Popular grid at once; leaving the page, the pill showed G G, then G G N (Slack gone, Notion in). Steps: 6 clicks vs ideal 4 (includes the bot-access step and Done). Note: this walk left Slack connected in the main demo space.

## Findings
- F-NA-4-1 (low): The final dialog repeats itself: title 'Slack connected', subtitle 'Slack is ready.', then two checklist lines ('All bots can use Slack.', 'Slack now appears under Connected.'). The last line describes what the page already shows.
- F-NA-4-2 (low): After leaving Integrations the pill first showed two logos (G, G) and about a second later three (G, G, N). The row changes width content once the new list arrives.

Screenshots: docs/ux-walker/stories/STORY-NA-4/screenshots/. Geometry audit: no overflow or wrapped controls in the areas tested (the uneven-row and spill hits were chat bubble and list rows unrelated to this topic).
Mock demo env: external logo CDN unreachable, so letter fallbacks show.
