# STORY-019 flow critique: first run with no model connected (round 3)

Previous round: round 2 verdict minimal (7 steps against an ideal of 6; four low or medium gaps: Local server and Subscription forms, Connect pending state, Chief preview text, card end of life). Re-traced on the current boards. Judged against boards, not running code.

Boards read: `PG-B-SignUp`, `PG-A-HomeNoModel` (9 frames), `PH-Home` (Connected, No model), `PG-A-ThreadStates` (First message, No model), `PG-B-Consent`.

## 1. Friction scorecard

| Measure | Result |
|---|---|
| Steps as drawn | 7 from Home: tap Connect a model, paste key, tap Connect, tap Message Chief, type, Send, read reply. Before Home: fill 3 fields, Create account, Open Mail, tap the link (all drawn up to the link) |
| Ideal | 6 from Home (open Chief straight after Connect saves the "Message Chief" tap) |
| Steps with no board | 2: getting an API key from the provider (off-app, only a text instruction), and the return from the confirmation link to Home. The Connect sheet on a standard iPhone has no board |
| Dead ends | None. Wrong key, pending, local, subscription, and sharing-off states are now drawn |
| Needless decisions | None for the default user: API key is preselected |
| Re-entry | None |
| Detour | Leaving the app to create a key is the largest cost in the journey and is undrawn |

All four round 2 issues are fixed: Local server, Subscription, and Connecting frames exist; the Chief row says "Say hello to Chief"; the card is gone in "After the first message".

## 2. Take-away pass per screen

- `PG-A-HomeNoModel` frame 1: one prominent "Connect a model". Nothing to remove.
- API key frame: Connect sits in the sheet header as the one prominent action. The data-sharing line and Privacy details are needed. "Create a key in your Model A account under API keys." is the only guidance and is plain text.
- Local server frame: address is prefilled with `http://localhost:11434`. On a phone, localhost is the phone itself, which contradicts "a model server on this network". The line "sends your messages and attachments to Model A" is wrong for a local server (it names the cloud provider).
- Subscription frame: the header Connect is disabled and the full-width "Sign in" is a dark secondary button, so no action is visually prominent.
- Connecting frame: spinner in the Connect capsule and dimmed fields. Correct.
- After connecting: one prominent "Message Chief"; New appears in the strip. Correct.
- After the first message: card removed. The Chief row still previews "Hello! How can I help?" at 2:59 PM, which is the greeting, not the thread's latest line.
- `PH-Home` No model: Inbox shows "3 need reply" and the pages show "6 mo runway", "2 deadlines", "Online" for an account with no integrations. The Duo frame correctly shows none.
- `PG-A-ThreadStates`: First message and No model are clear. Sharing-off (`PG-B-Consent`, `PG-A-HomeNoModel` last frame) gives a Turn on path with one prominent action.

## 3. Simpler version

After a successful Connect, open the Chief thread with the composer focused, and keep the Home card only as the path for users who close the sheet. That removes one tap. Provide a "Get a key" link in the sheet so the user does not have to recall where keys live.

## 4. Beauty check

Glass only on strip capsules, the New button, and sheet header controls; card, rows, and sheet are solid; one prominent action per frame except the Subscription frame (see R3-3); Chief uses the shipped teal hexagon; the name "Praci" is correct on sign up; radii are concentric. "Model A" is the expected mockup placeholder. Passes apart from the issues below.

## 5. Verdict: minimal

Every state on the path is drawn and the default path is one tap over ideal. Remaining items are copy and consistency defects plus the missing standard iPhone sheet.

## ISSUES

- STORY-019-R3-1 (medium): `PG-A-HomeNoModel.dc.html` API key frame. At step 2 the user must leave the app to create a key, and the sheet only says "Create a key in your Model A account under API keys." Fix: make that line a link labelled "Get a key" that opens the provider's key page, and keep the field ready for paste on return.
- STORY-019-R3-2 (medium): `PG-A-HomeNoModel.dc.html` Local server frame. The prefilled `http://localhost:11434` points at the phone itself, and the data line names Model A. Fix: leave the Address field empty with placeholder "http://192.168.1.20:11434", and for Local server change the data line to "Your messages and attachments go to this server."
- STORY-019-R3-3 (low): `PG-A-HomeNoModel.dc.html` Subscription frame. At step 2 no action is prominent: header Connect is disabled and "Sign in" is a gray secondary button. Fix: style "Sign in" as the one prominent button and hide the disabled header Connect for this choice.
- STORY-019-R3-4 (medium): `PH-Home.dc.html` (frame Connected and No model), `PG-A-HomeNoModel.dc.html` Connect sheet. The journey device is a standard iPhone but the Connect sheet, its error, and the After connecting state are drawn only on Duo. Fix: add the Connect sheet (API key, error, connecting) and the "Model A connected." card as frames on `PH-Home`.
- STORY-019-R3-5 (low): `PH-Home.dc.html` No model frame. A new account with no integrations shows "3 need reply", "6 mo runway", "2 deadlines", and "Online". Fix: remove the counts and status text from this frame to match the Duo frame.
- STORY-019-R3-6 (low): `PG-A-HomeNoModel.dc.html` "After the first message" frame. The Chief row still reads "Hello! How can I help?" after the user has sent a message. Fix: show the first line of the latest message or reply instead (step 12).
- STORY-019-R3-7 (low): `PG-B-SignUp.dc.html` Hand-off frame. After "Open Mail" and the confirmation link, the return to Home is not drawn, so the journey from install to Home has an undrawn step. Fix: add a "Confirmed" frame or note that the link opens the app directly on Home with the no-model card.
