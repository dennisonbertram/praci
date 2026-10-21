# UX Flow Critique, round 3: Granola and Wispr Flow (2026-10-20)

Evidence: the current plans (`docs/plans/granola.md`, `docs/plans/wispr-flow.md`) and both mockups opened in a browser (session uxf3). Every count is as planned or as mocked; nothing is built or user-tested. Screenshots are in `round-3/screens/` and are not committed. Journeys: GS-1, IF-1, IF-2, MX-8, WF-6, WF-7, MB-1, MB-5.

## Verdict

Round 2 introduced no new steps and no new decisions in any of the eight journeys. All seven round-2 items (N1 to N7) are fixed. The added strings pass the take-away test. Four low-severity issues remain, all in wording or mockup consistency (R3-1 to R3-4), and one maintainer-decided risk is noted (R3-5).

## Scorecard (actual / ideal)

| Journey | Round 2 | Round 3 | Change |
|---|---|---|---|
| GS-1 (key to first answer; to the to-do) | 6 / 5; 7 / 6 | 6 / 5; 7 / 6 | none; the gap is still the agent-link click (FX-35 rejected auto-open) |
| IF-1 (meeting-only Inbox) | 2 / 2 (+1 Allow if consent off) | 2 / 2 | the +1 is gone: Connect records consent and a meeting-only user never sees the mail prompt |
| IF-2 (mail + meetings) | not scored | 1 / 1 on All; 1 / 1 on an account tab | none |
| MX-8 (both sources) | 13 / 12 with the agent question; 10 / 9 without | 13 / 12; 10 / 9 | none |
| WF-6 (choose Flow) | 7 / 7 web; 7 / 7 phone | 7 / 7; 7 / 7 | none |
| WF-7 (daily cap) | not scored | 1 / 1 to continue by typing (4 if the user disconnects Flow) | none |
| MB-1 (key on phone) | 4 / 4 | 4 / 4 | none |
| MB-5 (Flow row on phone) | not scored | 5 / 5 (Settings, Voice, Flow row, paste, Connect) | none |

Needless decisions: 0 in every journey. Confirmations: one (the Delete dialog, which guards an irreversible delete). Dead ends are unchanged and recorded as deliberate in the plans.

## Round-2 items

| Item | Status | Evidence |
|---|---|---|
| N1 consent for a meeting-only user | Fixed | Granola S6 records consent at Connect. Every Connect state shows "Sends your meeting notes and transcripts to your AI model." (`g-key-empty`, `g-key-entering`, `g-key-rejected`, `g-key-reconnect`, `g-key-disconnected`). The meeting-only Inbox frames show no mail consent prompt (`g-inbox-todos`, `g-inbox-empty`); the prompt appears only with a mail account (`g-inbox-consent`). "AI data sharing off" links to the setting (`g-key-aioff`). |
| N2 "text near the cursor" | Fixed | The sentence reads "Sends your recordings and workspace names to Wispr Flow." on web (`w-voice-empty`, `w-voice-rejected`) and phone (`w-mob-key`, `w-mob-rejected`), and "recordings and workspace names" on the AI data sharing row (`w-consent`). The only remaining "near the cursor" is plan line 56, which describes today's consent text. |
| N3 phone checkmark | Fixed | The checkmark stays on "This device"; the Flow row shows "Transcribing" (`w-mob-connected`). Matches plan S3a. |
| N4 "From:" prefix | Fixed | Rows read "Pricing review, 12 Oct" (`g-inbox-todos`, `g-mob-inbox-todos`, `w-meet-inbox`). Plan S5 says "no From: prefix". The strings remaining in the mockup files are HTML comments. |
| N5 cap alert in the normal state | Fixed | `w-call-normal` shows the heard text only; `w-call-cap` shows the cap line. |
| N6 MCP sign-in above the key card | Fixed | "Sign in with Granola" sits above the key card in the empty, entering, rejected, offline, connected, reconnect, disconnected and AI-off states (`g-key-*`, `g-integrations-detail`). |
| N7 "Business plan" on the phone | Fixed | It follows the field label, with no footnote and no key link (`g-mob-empty`). The plan says so in the mobile bullet. |

## Added strings: take-away test

| String | Where | Result |
|---|---|---|
| "Sends your meeting notes and transcripts to your AI model." | Under Connect, every state where Connect shows | Keep. Connect is the consent act, so removing it records consent with no disclosure. One line, and gone once connected. |
| "Reconnect needed" | Card status, tile status, phone group row | Keep. It is the only signal that stored data is going stale. See R3-2 for the red line beside it. |
| "AI data sharing off" | Card and phone status | Keep. It is the only explanation for an agent that stays silent. See R3-1 for the phone. |
| "Transcribing" | Flow row on web and phone | Keep. Without it the user cannot tell that Flow replaced the speak-and-transcribe provider as the listener. The word is a continuous verb on a resting row, so recheck it if users read it as a live microphone. |
| "Daily voice limit reached. You can keep typing." | Call card | Keep. It states the block and the recovery in one line. See R3-3 for the composer. |
| Delete dialog: title, "Removes this meeting and its to-dos from Rakazo. Your note in Granola is not changed.", Cancel, Delete | Citation popover | Keep. The action is irreversible, so it earns a confirmation, and the second sentence answers the one fear a deleter has. |
| "Rakazo keeps your meetings and to-dos." | Card and phone group, while disconnected | Keep. Disconnect has no dialog, so this is the only place the user learns that the data stayed. See R3-5. |
| MCP sign-in above the key card | Detail page | Keep. Free and Pro users need it, and it also answers questions about meetings older than the 90-day store. It adds no step for a key user. |
| "Get a key in Granola" | Beside the empty field | Keep. The field is unusable without it. |

## New findings

All are low severity. None adds a step, a decision or a dead end.

- **R3-1, phone shows two status rows when AI data sharing is off.**
  - Target: Granola mockup `#screen-mobile`, state "AI data sharing off"; plan S6, "Consent missing" bullet.
  - Evidence: `g-mob-aioff` shows "Synced 42 meetings" and "AI data sharing off" as separate rows. Web (`g-key-aioff`) shows only the latter.
  - Smallest fix: on the phone the "AI data sharing off" row replaces the "Synced" row, and the plan bullet says "replaces" for both surfaces.
- **R3-2, the passive Reconnect state says the same thing twice.**
  - Target: plan S6, `needs_reconnect` bullet; mockup states "Reconnect needed" on web (`g-key-reconnect`) and phone (`g-mob-reconnect`).
  - Evidence: the warning row "Reconnect needed" and the red line "Granola rejected this key" both show before the user has tried anything.
  - Smallest fix: draw the red line only after a failed Connect attempt. The passive state is status, field, key link, Connect and Disconnect.
- **R3-3, the cap frame draws a composer inside the call card that the normal frame does not, and the plan says the card "keeps" one.**
  - Target: Wispr mockup `#screen-call` cap state; plan S3a, "Daily cap".
  - Evidence: `w-call-cap` versus `w-call-normal`. `apps/web/src/components/call/CallCard.tsx` has no input. The card is rendered in `Shell.tsx:5190`; I did not check where the thread composer sits relative to it.
  - Smallest fix: remove the drawn composer from the cap frame and reword the plan to "the thread composer stays available below the card".
- **R3-4, two Disconnect buttons when both Granola routes are connected, and that state is not drawn.**
  - Target: Granola mockup `#screen-api-key`; add a "Both connected" state.
  - Evidence: the MCP block and the key card each carry a Disconnect when connected (`g-key-mcp` shows one block; no frame shows both).
  - Smallest fix: draw the state. The two status lines already differ ("Connected" and "Synced N meetings"); if they read as ambiguous, add nothing and show Disconnect only on the key card.
- **R3-5, a decision to confirm, not a defect: Disconnect says the data stays, and the only removal is one meeting at a time.**
  - Target: plan S6, "Disconnect" and the Retention decision.
  - Evidence: a user who disconnects to remove their data finds the sentence "Rakazo keeps your meetings and to-dos." and would need one citation-popover delete per meeting (42 in the mockup).
  - Smallest fix: none now, because the maintainer decided permanent retention. Revisit with a bulk delete if users ask.

Mockup drift (not friction): the phone Voice list in the Wispr mockup omits Fish Audio, which the web list shows.

## Journey walk, summary

- GS-1: Integrations, tile, paste, Connect, agent link, question. The page order puts "Sign in with Granola" first. It is the top enabled control, but Connect is the only action that matters once a key is pasted, so there is no extra step.
- IF-1: Inbox, tick. The "Syncing", empty and "No follow-ups from meetings yet" states are one line each. The "Connect mail" card stays below the To do card for a meeting-only user, which was accepted in round 2.
- IF-2: one To do card on All and on each account tab. Mail and meeting rows differ only by the detail line, as decided in FX-22.
- MX-8: both sources feed one list; either agent answers any meeting question.
- WF-6, MB-5: provider row, paste, Connect. The Flow row never takes the checkmark. The rejected-key line is the existing "Could not connect this voice provider".
- WF-7: the cap line replaces the heard text, Mute is disabled in the DOM, typing continues.
- MB-1: the Granola group is a plain settings group on the Integrations screen; no detail page, no key link.

Not tried: the mockups are static, so the real connect, sync, consent and call behavior is unverified.
