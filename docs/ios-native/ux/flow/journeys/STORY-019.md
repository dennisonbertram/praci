# STORY-019 flow critique: first run with no model connected (round 2)

Previous round: acceptable in round 1 (8 steps against an ideal of 6; no board for the no-model handoff). Re-traced on the current boards. Judged against boards, not running code.

Boards read: `PG-B-SignUp`, `PG-A-HomeNoModel` (4 frames), `PH-Home` (Connected and No model), `PG-A-ThreadStates` (First message, No model), `PG-B-Consent`, `PG-A-Home`.

## 1. Friction scorecard

| Measure | Result |
|---|---|
| Steps as drawn | 7: sign up (one form), tap Connect a model, paste key, Connect, tap Message Chief, type and send, read reply |
| Ideal | 6 (same, with sign up counted as the form submit and no separate tap into Connect if Home opened the sheet itself) |
| Steps with no board | 1 of 7 by default path: sign-up to Home handoff (loading) is not drawn but is trivial. Local server and Subscription forms, and a Connect loading state, are not drawn |
| Dead ends | None. Failed key has a red inline state (frame 3). Sending before connecting shows "Not sent: No model connected" with a Connect link and "the message sends when it succeeds" |
| Needless decisions | Provider choice remains, but "API key / Recommended" is preselected, so the default user decides nothing |
| Re-entry | None. The consent sheet before first send is gone; the data line under Connect covers it, and AI data sharing in settings holds the toggle |
| Detour | None |

## 2. Take-away pass per screen

- `PG-A-HomeNoModel` frame 1: one prominent button ("Connect a model"). Chief row is dimmed and says "Connect a model to chat". Pages list is not needed yet but is quiet. Nothing to remove.
- Frame 2: provider list, labelled "API key" field, Connect (one prominent), one data-sharing line with Privacy details. The line is needed (it replaces a sheet). No fact is stated twice.
- Frame 3: red field and "Key not accepted." Connect stays enabled. Correct.
- Frame 4: "Model A connected." with one prominent "Message Chief". New button now appears. Correct next action.
- `PH-Home` No model: same card, no New button, no Activity. Matches the Duo frame.
- `PG-A-ThreadStates` First message: greeting plus three suggestions and a focused composer. No model: the red "Not sent" line with Connect.
- `PG-B-Consent`: now covers speech only, not this journey.

## 3. Simpler version

The drawn version is already close to it. Only trim: when connecting succeeds, open the Chief thread with the composer focused instead of returning to Home with a card (saves one tap). Optional, since the card is a clear accelerator.

## 4. Beauty check

Glass only on side-strip capsules and the New button; card, rows and sheets are solid; one prominent action per frame; Chief uses the shipped teal hexagon; radii are concentric on card, sheet and button; the name "Praci" is correct on sign up. "Model A" is a placeholder for the connected provider's name, expected in a mockup. Passes.

## 5. Verdict: minimal

The default path is 7 steps, one more than ideal, with every state a first-run user can hit drawn. Remaining items are undrawn non-default providers and small copy mismatches.

## ISSUES

- STORY-019-R2-1 (medium): `PG-A-HomeNoModel.dc.html` frame 2. At step 3, picking Local server or Subscription is offered, but the sheet draws only the API key field. A user choosing either sees no drawn address field or "Sign in" button. Fix: add two small frames, Local server with an "Address" field and Subscription with a "Sign in" button replacing the key field; Connect stays the one prominent action.
- STORY-019-R2-2 (low): `PG-A-HomeNoModel.dc.html` frames 2 and 3. At step 4 there is no Connect-in-progress state, so a slow connection looks like a dead tap. Fix: add a frame with a spinner in the Connect button and the field disabled.
- STORY-019-R2-3 (low): `PG-A-HomeNoModel.dc.html` frame 4, `PG-A-ThreadStates.dc.html` First message. After connecting, the Chief row previews "Hello! How can I help?" but the thread opens with an empty greeting plus suggestions, so the preview reads as a sent message. Fix: preview "Say hello to Chief" until a real message exists, or show the same greeting line in the thread.
- STORY-019-R2-4 (low): `PG-A-HomeNoModel.dc.html` frame 4. The "Model A connected." card has no stated end of life. Fix: remove the card after the first message is sent.
