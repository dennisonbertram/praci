# UX Flow Report: planned native iPhone app

Generated 2026-10-20 by `/ux-flow` for epic #427. Six journeys and one redundancy pass. Everything here is a finding about planned design, not shipped behavior.

## Run Summary

| Metric | Value |
| --- | --- |
| Target | Planned native SwiftUI iPhone app (epic #427, phases #412 to #426) |
| Evidence source | No native code exists. The "app" walked was the 40 design boards in `docs/design-system/ios/boards/`, rendered locally with a preview shim (not the real canvas runtime) and screenshotted. Boards are static, so each step was judged against the board that defines it. A screen with no board is recorded as a finding. |
| Journeys critiqued | 6 (STORY-019, 043, 047, 064, 076, 085) of 105 catalog stories |
| Verdicts | 0 minimal, 3 acceptable (043, 064, 085), 3 convoluted (019, 047, 076) |
| Redundancy findings | 6 duplicate paths, 9 duplicate information, 6 overlapping features, 8 hierarchy and naming, 12 cross-board consistency rows (11 findings, 1 pass) |
| Main cause of friction | Missing boards, not long flows. Most journeys depend on steps with no board. |
| Not verified | Row heights, radii and spacing are estimates from 466 x 678 screenshots. DS-04, DS-05 and DS-06 are tall and were read downscaled. No board exists for Compose, consent, global search, Account detail, offline or connect-a-model, so those steps could not be judged. |

"Actual" is the step count the catalog and boards describe. "Ideal" is the count after the simplification proposed in the journey file (`docs/ios-native/ux/flow/journeys/`).

## Friction Scorecard

| Journey | Steps actual / ideal | Needless decisions | Re-entry of known data | Dead ends | Verdict |
| --- | --- | --- | --- | --- | --- |
| STORY-019 First run with no model connected | 14 / 8 | 3: provider choice with no recommendation; optional Title and Description on New bot; which New menu entry | None | 2: Home never says a model is missing; after connecting, Home has no next action | Convoluted |
| STORY-043 Long founder session (attach, reply, fail, recover) | about 24 / about 20 (catalog says 22) | 2: Attach menu asks "Photo library or File" four times; "max 4" shows only after opening the menu | None found; carry-over of composer text, chips and queue on unfold is not drawn | 1: a long offline wait has no visible next action | Acceptable |
| STORY-047 Fix the recipient list, edit and send | 7 / 3 | 2: edit form versus telling the agent; two label pairs (Save/Send, Deny/Allow) on one card | Yes: a known contact retyped as comma-separated text | 3: abandoned edit, invalid email, removing the only recipient | Convoluted (minimal if the composer route replaces the edit screen) |
| STORY-064 Full triage session on the inner display | 24 / 19 | 2: Filter and "Important only" detour; ask the agent, then abandon it to compose by hand | Yes: payroll recipient, subject and body typed by hand | 4: selection after Archive; "Inbox zero" in two panes; abandoned agent route; message and agent thread both claim the detail pane | Acceptable |
| STORY-076 Month-end handoff (computer, artifact, page, list, routine) | 22 / 14 | 1: "Skip / I'm done" right after the task is finished | None | 2: routine does not say which run it belongs to; leaving Computer while holding control has no rule | Convoluted |
| STORY-085 Four pages on Duo, inner display and laptop pose | 20 / 20 | 0 | None (where Hide amounts state lives is not shown) | 1: folding to the outer display with an agent thread open has no defined result | Acceptable |

Steps with no board: 019 has 7 of 14; 043 has 8 of 15; 047 has 6 of 7; 064 has about 9 of 24; 076 lacks the handoff prompt, the pre-control Computer state and every laptop-pose screen; 085 has 9 of 20.

## Redundancy Map

Condensed from `docs/ios-native/ux/flow/redundancy.md`; ids match that file.

| Ids | Redundancy | Recommendation |
| --- | --- | --- |
| D1 | Two claimed routes to the Inbox agent; the Personnel row the catalog relies on is not drawn | Decide: Personnel row, or reached only from Inbox. State it in the catalog. |
| D3, H7 | No drawn route from the outer display to Finance, Legal, Cap table or Data room | Draw it. Cheapest: the domain agent row opens its page first, chat second. |
| D5 | Four routes to fix a missing model, one destination board | One "Connect a model" action that opens Models and returns. |
| D6, C9 | New bot and New space are sheets; New group is a pushed page | Sheets for all three. |
| D2 | Bell and "See all" both mean "what needs me" | Keep both only if they open the same screen. |
| D4, H4 | Integrations has three names | One label: "Integrations". |
| H1 | Boards say Rakazo; epic and Expo say Praci | Praci (sign-in copy already changed in this run). |
| H2 | "Agent" and "bot" for one object | Pick one word; "agent" matches the most-seen rows. |
| I1, I2, I5, C6 | Runway and cash drawn by five renderers with three label sets; "Runway summary" is both agent page and artifact; artifact title shown twice | One tile component and label set; decide whether page and artifact are one object; drop the repeated heading. Equal tile widths already fixed. |
| F1, I3, H8 | A domain has up to three entries (page, domain agent, vendor agent); deadline count in three places | Personnel holds agents only; pages open from inside the agent; count on the page row only. |
| F2 | Page, list, artifact and Data room file are four output surfaces | Product decision needed. |
| F3, C1 | Mail approval card has three title and button sets | One pair for mail: Save and Send. |
| F4 | Six search controls; the global one has no result screen | Scope rule: global in sidebar, local in each list, one control. |
| F5 | Global device-voice setting and per-bot "Read replies aloud" use the same words | State which wins. |
| F6, C5 | Filter, "Important only", sections and chips all classify mail; Hide amounts on a list with no amounts | Drop chips on rows users swipe away; Hide amounts only where amounts appear. |
| I6 to I9 | Unlabeled "42"; two unread dots on one row; Title and Description hold one sentence; avatar initials differ for one account | Label or drop the count; one dot; one field on phone; align sample data. |
| C2, C3, C4, C7, C8, C11, C12 | Bot identity differs by board; Home differs between boards; three mail-row heights; four status treatments; glass and prominent-action counts exceed README rules | Bot identity fixed on New group in this run. The rest need a board pass before Swift copies them. |

## Simplification Proposals

Ranked by (centrality of journey x steps or elements removed) divided by effort. Effort: S = board edit or decision, M = new or reworked screens, L = new flow.

### 1. Connect a model from Home in one prompt
- **Now:** a new user with no model sees nothing on Home, goes Account, Settings, Models, provider, back out, then creates a bot (14 steps). The first send fails.
- **Proposed:** while no model is connected, Home shows one prominent "Connect a model" action that opens Models as a sheet and closes itself on success; then "Create a bot" with Name only, opening the thread directly. Hide Default model, Thinking and Add a server until a provider is connected.
- **Saves:** 6 steps (14 to 8), one dead end, two optional fields on first run.
- **Effort:** M. Needs Home empty state, first-run Models variant, provider key form, thread empty state.
- **Evidence:** `docs/ios-native/ux/flow/journeys/STORY-019.md`; `docs/ios-native/ux/flow/redundancy.md` (D5); F-first-run-home-016, F-thread-021.
- **Phase issue:** #415 (with #421 Models, #417 send-time error).

### 2. One label pair for the mail approval card
- **Now:** one card reads "Send reply" with Deny/Allow on one board and "Re: Pilot timeline" with Save/Send on two others. "Allow" sounds like permission to run, not to send mail.
- **Proposed:** Save and Send plus the subject-line title on every board; tool approvals stay a separate card.
- **Saves:** one conflicting label set; affects every user who approves an email.
- **Effort:** S.
- **Evidence:** `docs/ios-native/ux/flow/redundancy.md` (F3, C1); `docs/ios-native/ux/flow/journeys/STORY-047.md`; F-thread-008.
- **Phase issue:** #417.

### 3. Edit a draft by telling the agent; skip the edit screen in the first release
- **Now:** fixing a recipient list takes 7 steps and needs an edit-and-send screen with no board (Cc parsing, validation, discard rules).
- **Proposed:** the user types "Add Jordan on Cc and make it 10:30" in the composer; the agent replaces the draft with a new card and the old card shows "Replaced". Direct editing, if wanted later, is a native sheet with one "Done".
- **Saves:** 4 steps (7 to 3), one undrawn screen, the invalid-email and unsaved-edit cases.
- **Effort:** S.
- **Evidence:** `docs/ios-native/ux/flow/journeys/STORY-047.md`; F-thread-012.
- **Phase issue:** #417.

### 4. Draw the outer-display route to Finance, Legal, Cap table and Data room
- **Now:** no board reaches the four pages on the outer display (the one critical walker finding), although the README says every page keeps the same features on every display.
- **Proposed:** the domain agent row opens its page first and chat second, as the inner sidebar does; show the glance value once.
- **Saves:** one dead end across four pages and two of the three entries per domain.
- **Effort:** S to M.
- **Evidence:** `docs/ios-native/ux/flow/redundancy.md` (D3, F1, I3, H7); `docs/ios-native/ux/flow/journeys/STORY-085.md`; F-finance-settings-001.
- **Phase issue:** #424 (Home row in #415).

### 5. Remove status chrome and repeated controls no journey uses
- **Now:** "Carta is connected / Reconnect" while healthy; Legal scan card repeating the Deadlines tab; refresh buttons on all four pages; unlabeled "42"; Newsletter and Junk chips; Team/Private picker while holding control; "working" line while an approval is pending; second unread dot on the outer Inbox.
- **Proposed:** remove each, or show it only in the state where it matters. Refresh on open and pull to refresh.
- **Saves:** about 8 elements across 6 screens, no step added.
- **Effort:** S.
- **Evidence:** journeys STORY-085, 064, 076, 047; `docs/ios-native/ux/flow/redundancy.md` (I6, I7, C5); F-finance-settings-021, F-inbox-computer-012.
- **Phase issue:** #424, #418, #420, #417.

### 6. Merge Release and "I'm done"; link the page to the routine
- **Now:** after releasing Computer the user answers "Skip / I'm done", confirms, closes, then goes Back to the thread and Home to reach the routine (22 steps).
- **Proposed:** while a handoff is pending, Release reads "I'm done" and releases in one tap, with "Skip" as a text button. One menu entry on the agent list opens Routines. Hide the Team/Private picker while holding control.
- **Saves:** 8 steps (22 to 14) and the Back-then-Home detour.
- **Effort:** M.
- **Evidence:** `docs/ios-native/ux/flow/journeys/STORY-076.md`; F-duo-013, F-inbox-computer-015.
- **Phase issue:** #420.

### 7. Attach with one multi-select picker; disable Plus at the limit
- **Now:** the Attach menu opens four times and asks "Photo library or File" each time; at four chips it opens and then says "(max 4 attachments)".
- **Proposed:** menu offers Photos and Files, both multi-select; Plus is greyed at four chips; a progress ring on each chip; swipe-to-reply as an accelerator.
- **Saves:** about 4 taps (24 to 20) and the late error.
- **Effort:** M. Needs boards for the Attach menu, chip progress, disabled Plus, long-press menu.
- **Evidence:** `docs/ios-native/ux/flow/journeys/STORY-043.md`; F-thread-003, F-thread-002.
- **Phase issue:** #417.

### 8. Ask the agent to draft new mail from an open message
- **Now:** to email the payroll provider about an open message, the user opens the agent, abandons it, opens Compose and types three fields (steps 18 to 21).
- **Proposed:** "Ask Inbox agent" carries the message as context and returns a prefilled card. Manual Compose stays for new mail. Define selection after Archive and Send as "next row down". Drop the Filter and "Important only" detour from this story.
- **Saves:** 5 steps (24 to 19) and three typed fields.
- **Effort:** M. Needs reply composer, compose, Archive control and two-pane "Inbox zero" boards.
- **Evidence:** `docs/ios-native/ux/flow/journeys/STORY-064.md`; F-inbox-computer-001, F-duo-003.
- **Phase issue:** #418.

### 9. One name for each thing
- **Now:** Rakazo/Praci; agent/bot; Integrations/Connect apps; "Chat settings"/"Bot settings"; Retry/Try again; "Other mail today"/"Today" and "Earlier".
- **Proposed:** Praci, one of agent or bot, Integrations, Bot settings, Try again, one Inbox section naming.
- **Saves:** 6 naming conflicts, cheap now and expensive after Swift strings exist.
- **Effort:** S. Praci on sign-in, Bot settings and Try again are already applied; agent-or-bot and the Inbox section names remain.
- **Evidence:** `docs/ios-native/ux/flow/redundancy.md` (H1, H2, H4); `docs/ios-native/ux/catalog.md` (Copy and naming conflicts); F-first-run-home-007, -024, -027.
- **Phase issue:** #414, #415.

### 10. One Runway source: one tile component, one artifact-or-page decision
- **Now:** runway and cash are drawn five times with three label sets and different tile sizes; the artifact title appears twice on one screen; "Runway summary" is both an agent page and an artifact.
- **Proposed:** one tile component, one label set ("Burn", not "Spend"); decide whether page and artifact are one object; remove the repeated heading and the sentence restating runway; link both to the Finance page.
- **Saves:** 4 renderers, 2 repeated texts, and the Desk versus PG-B-Finance contradiction.
- **Effort:** M.
- **Evidence:** `docs/ios-native/ux/flow/redundancy.md` (I1, I2, I5, C6); journeys STORY-076, 085; F-duo-015, F-duo-016.
- **Phase issue:** #420, #424.

## Already Minimal

- Sign-in, thread and New bot sheets: one prominent action each (STORY-019).
- Composer: Plus, text field, and a mic that swaps to Send, so one trailing action; the failed bubble states "Not sent / Retry" once (STORY-043).
- Inner-display Inbox (`Inner`, `Split`): follows the glass and prominent-action rules with Send as the one bright button (STORY-064, 085).
- Routine, Agent list, Agent page: one prominent action each (STORY-076).
- Finance, Legal, Cap table, Data room outer pages: glass only on the side strip; one chat bubble as the prominent action (STORY-085).
- Bottom-left prominent action position is consistent (redundancy C10).
- STORY-085 has zero forced steps on the happy path.

## Where the evidence is thin

- Every proposal that adds a screen depends on a board that does not exist; saved step counts are design targets, not measurements.
- Step counts for STORY-043 and STORY-064 are approximate.
- Sizes and spacing are screenshot estimates; measure in the design tool first.
