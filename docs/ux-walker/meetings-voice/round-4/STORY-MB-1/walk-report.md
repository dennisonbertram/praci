# STORY-MB-1: Paste a Granola API key from the phone

Round 4 walk, session uxw4-flow, static mockups only (features unbuilt). Dark mode, 1280x900 with a 390x844 spot-check. Phone frames judged against native iOS conventions (grouped list, large title, glass back control, full-width action button, destructive row, group header and footer).
Surfaces walked: docs/granola/mockup.html#screen-mobile (Key card: Empty, Typing, Connecting, Syncing, Connected, Disconnected)

**Verdict: PASS** (no high or critical finding; every step the plan defines can be taken in the mockup)

## Outdated story steps (plan decisions followed)
- Step 4 and the edge case "Synced {n} meetings, {relative time}": the plan shows the relative time only when a sync is late or failed, so the phone row reads "Synced 42 meetings".
- Step 5 (open the Granola agent from the bot list): no phone frame; the plan keeps the agent link web-only for the first release.
- Step 1 says the first row "Rakazo keeps your meetings and to-dos." shows "while disconnected". The plan (granola.md, Disconnect) shows it only after a Disconnect, not on first use; the mockup does the same.

## Steps

- Step 1 [pass]: Integrations: a "Granola" group header, one secure row "Granola API key · Business plan" with the placeholder "API key", a full-width Connect (dimmed), and the footer "Sends your meeting notes and transcripts to your AI model." (step-empty.png). Native check: the stacked caption over the field is a Form-style row; iOS would put the label at the left and the field at the right, but the placeholder now marks it as an input.
- Step 2 [pass]: Typing: keyboard drawn with a "go" key, list scrolled so the field, Connect and footer stay above the keyboard; Connect is enabled (step-typing.png).
- Step 3 [pass]: Connecting: field disabled, button shows an activity indicator and "Connecting...", footer stays (step-connecting.png).
- Step 4 [pass]: Syncing row with an activity indicator, then "Synced 42 meetings" and a separate destructive Disconnect group; the key field is gone (step-syncing.png, step-connected.png).
- Step 5 [note]: Agent chat and Inbox are covered by MB-3; no meetings screen, by design.
- Disconnected [pass]: first row "Rakazo keeps your meetings and to-dos." inside the group, then the key row and Connect (step-disconnected.png).

## Geometry audit
geometry-audit.js per state at 1280x900 and 390x844: pageOverflowX 0, no overflow spills. Flagged wrappedControls are the 44 pt glass back glyph and the one-word Connect action (tall native button, not a wrapped label). Measured on the phone: back 44x44, action button 48 pt, rows 52 to 63 pt, check/to-do hit areas 44x44, subtitle and footer 13 to 14 px.

## 390x844 spot-check
390x844: phone frame fits, no horizontal scroll; Typing state keeps field and Connect above the keyboard (mobile-check-390.png).

## Flow Log
Ideal 4 (Integrations, find Granola group, paste, Connect). Actual 4 with the group visible immediately, no detail screen. No hesitation. Disconnect is a red row that acts at once (decided FX-63; plan: no confirmation because meetings are kept).

## Round-3 findings
- F3-MB-1-1 (medium): fixed. The empty, typing, disconnected and reconnect-needed key fields show the placeholder "API key" (step-empty.png, step-typing.png). One state still lacks it, see F4-MB-2-1.
- F3-MB-1-2 (low): fixed. "Rakazo keeps your meetings and to-dos." is now the first row of the group (step-disconnected.png).

## New findings
- F4-MB-1-1 (low, mockup): In the Disconnected state the first row "Rakazo keeps your meetings and to-dos." breaks at the hyphen of "to-dos", leaving "dos." alone on the second line. Fix: Use a non-breaking hyphen (to&#8209;dos) or let the row text wrap before "to-dos".
