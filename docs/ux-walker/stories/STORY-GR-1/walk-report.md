# Walk report GR-1: Gmail rate-limits the sync (notice)

Screenshots cited here are kept locally and not committed; the written findings are the record.
Result: FAIL (1 high, 1 low). Viewport 1280x800 plus one 390x844 check. Space "MOCK DEMO DATA — Mail rate-limited", session uxw-gr.

## Flow log
1. Switched space, clicked Inbox (step-0-space.png, step-1-loading.png). First open showed "No mail" with no notice (step-2-notice.png, step-3-after-wait.png); 15 s wait did not change it.
2. Reload: notice "Your mail didn't load / Gmail is limiting requests right now. Try again in a minute. / Try again" (step-4-reload.png). Matches the story text; no Reconnect Gmail button.
3. Polled the page every 3 s: notice stayed about 25 s, then switched to "No mail" with no action (step-6-no-mail-after-30s.png). Reload alternates between notice and "No mail".
4. Return after visiting Finance: notice at 1 s and 7 s (step-5-return-*.png).
5. Mobile 390x844: "No mail" first, notice after another reload (mobile-notice.png); notice wraps to two lines, fits, no overflow.

## LOOK/MEASURE
Notice screen: centered icon, title, one line, one button; one primary action; notice appears once. Geometry audit: pageOverflowX 0, no spills, no wrapped controls; the unevenRows hits are sidebar chat rows (name vs time width), intentional. Console: no errors.
Clarity of "Gmail is busy"-style notice: clear and plain. Not duplicated.

## Findings
See findings.json. Main one: F-GR-1-001, notice vanishes after the 30 s pause and the page claims "No mail" while Gmail still returns 429.

## Skipped
- GR-3 (notice clears): not reachable on the unmodified demo stack; its throttled account never recovers and needs a failNext(429) hook.
- GR-4 (Reply fallback): not reachable; the throttled space has no cached mail and other spaces never fail.
