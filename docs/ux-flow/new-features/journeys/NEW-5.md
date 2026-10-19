# NEW-5: Recovering when Gmail is rate-limited

Stories: GR-1, GR-2 (docs/ux-paths/topics/new-gmail-rate-limit.md). GR-3 and GR-4 were not reachable on the demo stack, so nothing below about a populated inbox or a recovered Gmail has been seen (marked suspected).
Evidence: docs/ux-walker/stories/STORY-GR-1/ and STORY-GR-2/ (walk-report.md, findings.json, all screenshots opened).
Assumption from the brief: a fix is in progress so the notice persists until a successful sync. The "No mail" finding (F-GR-1-001) is therefore treated as being fixed elsewhere and not critiqued again.

## Friction Scorecard

| Measure | Result | Evidence |
|---|---|---|
| Steps, ideal vs actual | Ideal 1 (press Try again, or nothing at all). Actual 1 click, then a wait of about 13 s with a failure that looks the same as before. | GR-2 walk-report: inbox/refresh answered after about 13 s; step-3-after.png is identical to step-1-notice.png |
| Decisions a default could carry | One. The user must decide when to press Try again, and the screen gives no time to base that on ("in a minute", real pause 30 s). The app already retries by itself: it re-syncs when the tab becomes visible and about once a minute (story GR-2 alternate paths, from code, suspected as user-visible), and the walker saw an automatic refresh about 30 s after the click (GR-2 flow log, item 3). | step-4-reload.png; GR-2 walk-report |
| Re-entry | None. No data is typed. | - |
| Needless confirmations | None. | - |
| Dead ends | One soft one. Pressing Try again while still limited returns the identical screen, so the user cannot tell whether anything happened and has nothing else to do. | step-3-after.png vs step-1-notice.png (F-GR-2-002) |
| Hesitations | (1) "Try again in a minute" while the real pause is 30 s: the user may wait longer than needed or press early. (2) The button greys and shows "Trying again..." for up to about 13 s with no spinner, so it can look stuck. (3) Title "Your mail didn't load" names no cause; the cause is only in the line below. | step-2b-trying.png; F-GR-1-002, F-GR-2-001 |

Overall: the happy path is short and the notice itself is already plain. The friction is in the feedback after the click, not in the number of steps.

## Take-away Pass

Screen: full-page notice (step-4-reload.png, desktop; mobile-notice.png, 390 px).
- Icon (mail with warning mark): decoration, but it marks the state at a glance. Keep.
- Title "Your mail didn't load": needed as the headline. Keep.
- Line "Gmail is limiting requests right now. Try again in a minute.": the cause is needed once. The second sentence duplicates what the button says and gives a time that is wrong. Removing "Try again in a minute." loses nothing the button does not already say.
- Button "Try again": the one primary action. Keep.
- Page chrome (search box, view, filter, compose, Ask): present and active while there is no mail. Search and filter act on mail that did not load. Whether they work is not shown by the walker, so this is suspected, not confirmed. Low priority; leave as is because the controls are standard on this page.
- Sidebar: unrelated to this state. Nothing to remove.

No other element is repeated. The notice appears once at both widths (GR-1 walk-report, LOOK/MEASURE).

Screen: "Trying again..." state (step-2b-trying.png). The only change is dimmed label text and a wider button (about 82 to 108 px, F-GR-2-001). Nothing to remove; something is missing (progress).

## The Simpler Version

1. Maya opens Inbox. The notice shows: title, one line "Gmail is limiting requests right now.", one button.
2. The app retries on its own when the pause ends. Maya does not have to do anything.
3. If she presses Try again, the button shows a spinner and "Trying again..." with a stable width.
4. If the retry fails, the line changes briefly to say it just tried ("Still limited. Tried just now.") so the click has a visible result. The notice remains.
5. When a sync succeeds, mail loads and the notice goes.

Concrete changes (in order of value):
1. Add the existing small spinner to the button and a min-width, so "Trying again..." does not look frozen or shift (F-GR-2-001). Small, local to Inbox.tsx.
2. After a failed retry, change the line (for example "Still limited. Tried just now.") so a retry is visible (F-GR-2-002).
3. Remove the time from the copy: "Gmail is limiting requests right now." Either no number, or "a few seconds" if a number must stay (F-GR-1-002). Removing is preferred under the repo's copy rule.
4. Suspected, not seen: if the page already re-syncs on its own when the pause ends, say nothing about waiting at all. This needs the in-progress fix to land before it can be judged.

Not recommended: a countdown. It adds a moving element and new copy for a 30 s pause that retries itself.

## Clarity Issues

1. "Try again in a minute" is wrong by about a factor of two (30 s pause per story code; the walker measured about 13 s for a retry). High confidence; evidence F-GR-1-002.
2. Title and cause are split: "didn't load" is generic and "Gmail is limiting requests" is the real reason. Acceptable because the two lines read together as one message; leave.
3. The retry wait is silent: "Trying again..." does not say it may be waiting on Gmail's pause, so up to about 30 s can look like a hang (story GR-2 step 2, F-GR-2-001). Fixed by the spinner; a new sentence is not needed.
4. A failed retry looks identical to no retry (F-GR-2-002).
5. Not assessed: the populated-inbox variant (red line above rows with a small Try again). It was not reachable, so its clarity is suspected only.

## Verdict: acceptable

One click for the happy path, a plain notice, one primary action. Two missing pieces of feedback (progress, retry result) and one wrong number are the only issues. Nothing structural.
