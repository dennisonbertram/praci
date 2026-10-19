# Walk report STORY-NA-6

Screenshots cited here are kept locally and not committed; the written findings are the record.

Verdict: PASS with warnings (partial)

## Flow log
Alias variation (slack/slackbot) NOT WALKABLE per story; rely on unit test. Pill showed Calendar, Drive, Slack once each (before connecting Slack); Popular had one Slack tile. Logo identity not verifiable: all three show letters. Mobile: pill in drawer shown in STORY-NA-1/NA-4 mobile screenshots.

## Findings
- F-NA-6-1 (medium): Same root cause as F-NA-1-1: with logos unavailable, Google Calendar, Google Drive and GitHub all show the letter 'G' on the Integrations tiles, so the tile logos cannot tell the apps apart; the story's check 'three different logos' fails in this environment. Not verified with real logos.

Screenshots: docs/ux-walker/stories/STORY-NA-6/screenshots/. Geometry audit: no overflow or wrapped controls in the areas tested (the uneven-row and spill hits were chat bubble and list rows unrelated to this topic).
Mock demo env: external logo CDN unreachable, so letter fallbacks show.
