# STORY-019 flow critique: first run with no model connected (round 1)

Previous round: convoluted (14 steps, no board for the no-model handoff). Re-traced on the current boards after the gap-fix pass. Judged against boards, not running code.

Boards read (screenshots in the round 1 folder): `PG-B-SignUp`, `PG-B-SignIn`, `PG-A-HomeNoModel`, `PG-A-Home`, `PH-Home`, `PG-B-Settings`, `PG-B-Models`, `PG-B-Consent`, `PG-B-NewBot`, `PG-A-Thread`, `PH-Thread`, `PG-A-ThreadStates`, `PG-B-Account`.

## 1. Friction scorecard

| Measure | Result |
|---|---|
| Steps as drawn (Chief bot path) | 8: sign up, tap Connect a model, enter key, Connect, tap Chief, type and send, Allow data sharing, read reply |
| Steps as drawn (Create a bot path the Home card offers) | 11 (adds tap Create a bot, name, check) |
| Ideal | 6: sign up, Connect (with sharing consent folded in), tap Chief, send, read reply |
| Steps with no board | 2 of 11: first-run empty thread (greeting, suggestions); wrong-key or failed connect. Standard-iPhone no-model Home also has no board |
| Dead ends | Fixed: Home now says a model is missing and offers one action. Remaining: a failed key has no drawn state |
| Needless decisions | Provider choice (Hosted preselected, not labelled as the default); Title and Description on New bot; Create a bot vs the existing Chief row |
| Re-entry | None |
| Detour | Removed. The Account > Settings > Models detour is gone from the first-run path |

Heuristics still failing: 2 (decision economy, provider choice), 5 (no failure state), 11 (key field shown for every provider), 12/9 (Home card offers the wrong next action).

## 2. Take-away pass per screen

- `PG-A-HomeNoModel.png` panel 1: one prominent button "Connect a model". Correct. The card plus the Chief row below it ("No messages yet") is fine. Nothing to remove.
- Panel 2 (sheet): provider list, key field, Connect. The key field has no label or placeholder and is shown even when Local server or Subscription sign-in is selected, where a key does not apply. One prominent action (Connect). Correct.
- Panel 3: card says "Model connected." and offers "Create a bot" while Chief already exists in Personnel directly below. The card is the one prominent action and it points at the wrong job. "Model connected." is also stated only by the card; fine.
- `PG-B-Consent.png` first use: "Share data with Model A?" with Allow, Not now, Change in Settings. One prominent action (Allow). It is a second gate after the user already typed a message; no sign the draft is kept.
- `PG-B-NewBot.png`: Title and Description are optional and remove nothing the journey needs; two thirds of the sheet is empty. Only relevant if the user takes "Create a bot".
- `PG-B-Models.png` / `PG-B-Settings.png`: connected-state only; "Now using Model A." repeats the Model row above it. Not on the first-run path any more, so low value.
- `PG-A-Thread.png` / `PH-Thread.png`: not a first-run view (existing Inbox agent conversation). No empty-thread state exists.

## 3. Simpler version

1. Sign up lands on Home with the card "Connect a model to start chatting." and one button.
2. The sheet shows Hosted provider labelled "Recommended" with an "API key" field; picking Local server swaps the field for an address, Subscription swaps it for "Sign in". A single line under Connect states what is shared with the provider, and Connect also records that consent (removes the separate Share data sheet).
3. On success the sheet closes and the card becomes "Message Chief" (opens the Chief thread with the composer focused). "Create a bot" stays in New.
4. Type and send; the reply streams. Back shows the preview on Home.

6 steps. Settings > Models stays the long-term route; the card is an accelerator to the same screen.

## 4. Beauty check

- `PG-A-HomeNoModel`: glass only on the side-strip capsules; card, rows and sheet are solid; one prominent action per panel; Chief uses its shipped teal hexagon; concentric radii on card and button look consistent. Panel 2 dims the background correctly. Passes. The "+" button of `PG-A-Home` is absent in all three panels, so New (group, space) is unreachable in this drawn state; likely cropping, flagged low.
- `PG-B-Consent`: sheet solid, Allow is the single prominent control, Not now is quiet. Passes. Copy uses the placeholder "Model A" rather than the connected provider's name.
- `PG-B-NewBot`, `PG-B-Models`: unchanged from round 0, pass the glass and one-action rules.
- Name "Praci" is correct on sign up and sign in.

## 5. Verdict: acceptable

The dead end and the Settings detour are fixed. The path is 2 steps over ideal with no structural problem; remaining issues are the wrong next action after connecting, one avoidable consent gate, and missing failure and standard-iPhone boards.

## ISSUES

- STORY-019-R1-1 (high): `PG-A-HomeNoModel.dc.html` panel 3. At step 5 the card offers "Create a bot" while the Chief bot already sits in Personnel, so the prominent action points at a longer path (11 steps) than the one that works (8). Fix: relabel the button "Message Chief" and open the Chief thread; drop "Create a bot" from the card. If no default bot exists, remove the Chief row from the board instead.
- STORY-019-R1-2 (medium): `PG-A-HomeNoModel.dc.html` panel 2. At step 3 the key field has no label and shows for Local server and Subscription sign-in, where a key does not apply; Hosted is preselected but not marked as the default. Fix: label the field "API key", mark Hosted "Recommended", and swap the field per provider (address for Local server, a "Sign in" button for Subscription).
- STORY-019-R1-3 (medium): `PG-B-Consent.dc.html`, `PG-A-HomeNoModel.dc.html`. At step 7 a second sheet ("Share data with Model A?") interrupts the first send, after the user already typed. Fix: put one line under Connect naming the provider and what is shared, record consent on Connect, and use the name of the connected provider instead of "Model A". Keep the sheet only for later providers.
- STORY-019-R1-4 (medium): no board. The first-run thread (step 6 destination) has no empty state: no greeting or suggestions are drawn; `PG-A-ThreadStates` covers offline, failed and refused only. Fix: add an empty-thread panel to `PG-A-ThreadStates` with a one-line greeting from Chief, up to three tappable suggestions and the focused composer.
- STORY-019-R1-5 (medium): no board. Wrong key or failed connect at step 4 has no drawn state. Fix: add a panel to `PG-A-HomeNoModel` with an inline red line under the key field ("Key not accepted") and the Connect button back to enabled; the sheet stays open.
- STORY-019-R1-6 (medium): `PH-Home.dc.html`. The story's device is a standard iPhone, but the no-model card exists only on the Duo outer display. Fix: add a no-model variant to `PH-Home` with the card above Inbox and the same single "Connect a model" button.
- STORY-019-R1-7 (low): `PG-A-HomeNoModel.dc.html` panel 3. The "Model connected." card has no stated end of life. Fix: remove the card after the first message is sent, or after one tap on its button.
- STORY-019-R1-8 (low): `PG-B-NewBot.dc.html`. Title and Description are optional yet shown; the lower two thirds of the sheet is empty. Fix: show Name only, with "More" revealing Title and Description.
- STORY-019-R1-9 (low): `PG-A-HomeNoModel.dc.html`. The "+" button from `PG-A-Home` is missing in all three panels. Fix: draw it, or note that New is hidden until a model is connected.
