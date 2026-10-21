# STORY-019 flow critique: first run with no model connected

Target: planned native iPhone app (epic #427; phases #415, #417, #421). Judged against boards, not running code. Boards are the Duo outer display (466x678 pt), so "standard iPhone" fit is itself unverified.

Screenshots read: `PG-A-Home.png`, `PG-B-Settings.png`, `PG-B-Models.png`, `PG-B-NewBot.png`, `PG-A-Thread.png`, `PG-B-SignIn.png` (all in the board screenshot folder).

## 1. Friction scorecard

| Measure | Result |
|---|---|
| Steps as designed | 14 |
| Story's stated ideal | "14 — see below; an ideal flow would pre-empt the dead end with a single prompt on Home." The number and the sentence disagree: 14 is the designed path, not the ideal. |
| Steps with a board | 7 of 14: sign-in handoff (1, PG-B-SignIn), Settings (3), Models list (4), New bot sheet (8-9), thread with composer and working line (11-12). |
| Steps with no board | 2 (the `needsModel` prompt), 1's empty state, 5 (provider key entry), 6 (Home after connecting), 10 (empty greeting and suggestions), 13-14 (first reply on Home). |
| Dead ends | Step 1-2: Home shows nothing that says a model is missing. Catalog confirms "no banner, no empty-state variant, no deep link". The user must already know to open Account > Settings > Models. Step 6: after connecting, the user lands on an empty Home with no next action. |
| Needless decisions | Choice of provider with no recommendation (Models shows Hosted, Local server, Subscription sign-in). Title and Description fields on New bot (PG-B-NewBot) are optional but shown. Which New menu entry to pick (New bot vs group vs space). |
| Re-entry of known data | None found. Key entry is secret and cannot be prefilled. |
| Detour | Steps 3-6 (Account, Settings, Models, provider, back out of Settings) are 4 taps of navigation to reach one form, then 1 to return. |

Extra steps versus a pre-empted flow (see section 3): 5 steps. Heuristics failed: 1 step economy, 5 dead ends, 6 shortest path to value, 11 progressive disclosure.

## 2. Take-away pass per screen

**Home, empty state (no board).** `PG-A-Home.png` shows only a populated Home; there is no empty variant. Catalog text is "Tap + to create a bot", which names a "+" that the board labels as New and gives no action. Remove that line. Replace with a single row/action "Connect a model" while `needsModel` is true, then "Create a bot" once it is false. One prominent action: today there is none besides the floating plus button, which is the wrong target (a bot without a model fails on first send). Fact stated twice: none.

**Settings (`PG-B-Settings.png`).** Rows for Voice, Integrations, AI data sharing, Archived bots, Change password are irrelevant to this journey but are fine in a general settings page; do not remove. Models row already shows its current value ("Model A"); in the no-model case it would need a "Not connected" value, which is not drawn. No prominent action, correct for a list.

**Models (`PG-B-Models.png`).** Shows the connected state only. "Default model" and "Thinking" rows are not usable until a provider exists, so on first run they should be hidden (progressive disclosure). "Add a server" with an address field and "Find models" competes with the three providers; for a first-run user this is advanced and should be collapsed. The green line "Now using Model A." restates the Model row directly above it (fact twice). Provider detail and key entry have no board.

**New bot sheet (`PG-B-NewBot.png`).** Name, Title, Description. Only Name is needed to create a bot (story step 8 types a Title as well). Remove Description and Title from first creation, or collapse them behind "More". One prominent action: the round check button at bottom left is the single bright control, and it is right. The empty lower two thirds of the sheet is wasted space, which supports a shorter form.

**Thread (`PG-A-Thread.png`).** Floating composer, working line "Inbox agent is working" in blue, one approval card with Deny/Allow. For a first message the board is adequate, but the empty first-run state (greeting, suggestions) is not drawn. The Allow button is the prominent action inside the card; correct for that moment, not applicable to a plain first message. Working line and stop control: board shows the line but no visible stop control (gap).

**Sign in (`PG-B-SignIn.png`).** Out of scope beyond handoff. It is minimal: SSO, email, password, one prominent Sign in. The error line "Could not continue" is shown in the resting state of the mockup; fine as a state example.

## 3. Simpler version

Goal: user is chatting with a working bot in 8 steps, one of them optional.

1. Sign in finishes; Home loads.
2. Home empty state shows one prominent button, "Connect a model" (shown only while `needsModel` is true). New screen, needs a board.
3. Tap it: opens Models as a sheet directly, skipping Account and Settings. Show only the providers list, with Hosted provider first and labeled "Recommended" if that is the product's real default. Hide Default model, Thinking and Add a server until a provider is connected.
4. Enter the key on the provider page; on success the sheet closes itself (no manual Close step).
5. Home empty state now shows the one prominent button "Create a bot".
6. New bot sheet with Name only; check button creates it and opens the thread directly (skip the return to Home and the extra tap on the row).
7. Type the first message in the composer.
8. Reply streams; Back returns to Home with the preview line.

This removes: steps 3-4 detour (Account, Settings, Models push), step 6 (manual close), step 7's New menu hop (two taps become the empty-state button), step 8's Title field, and step 10 (tap bot row). Net: 14 down to 8, a saving of 6, with no loss of control: Settings > Models remains the canonical long-term route, and the empty-state button is only an accelerator to the same screen (heuristic 13).

Needs from design: Home empty-state board with both variants, Models first-run variant, provider key form, thread empty state. Reuse "Connect a model" as the same action at send-time error and in Legal (catalog P3 recommendation).

## 4. Beauty check

- `PG-A-Home.png`: glass is limited to the side toolbar capsules (avatar, bell/search/pages group) and the plus button; Inbox and Activity cards and rows are solid. Follows the rule. Groups: two glass capsules plus the plus button, within the limit of three. One prominent control: the plus button (light fill). Correct for the populated state; wrong target for the empty state as noted.
- `PG-B-Settings.png`, `PG-B-Models.png`: lists and grouped cards are solid with consistent rounded corners and row spacing; the single glass element is the back/close button. Consistent type (large title, 13 pt grey section labels). The green status text on Models is the only off-palette-looking accent, but it matches the success color token usage; acceptable.
- `PG-B-NewBot.png`: sheet is solid, the grabber and close/check buttons are the glass/prominent layer. Corner radii of the sheet and the nested field rows look concentric. Spacing between label and field is consistent. Flaw: large empty area below three fields.
- `PG-A-Thread.png`: glass only on the title pill, side toolbar, and floating composer; bubbles and the approval card are solid. One prominent action (Allow). Follows the rules.
- I did not measure radii numerically; judgments are from the screenshots.

## 5. Verdict: convoluted

Reasons: 14 steps against a stated ideal that the catalog itself says should be about 8; a dead end at the very first step (no screen tells the user a model is missing); 7 of 14 steps have no board; the Models and New bot screens each show controls the first-run user does not need. The existing boards for sign-in, thread and New bot are clean; the problem is the missing first-run handoff, not visual quality.
