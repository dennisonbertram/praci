# STORY-MB-1: Paste a Granola API key from the phone

Round 3 walk, session uxw3-flow, static mockups only (features unbuilt). Dark mode, 1280x900 with a 390x844 spot-check.
Surfaces walked: docs/granola/mockup.html#screen-mobile (Key card: Empty, Connecting, Syncing, Connected, Disconnected)

**Verdict: PASS**

## Outdated story steps (plan decisions followed)
- Steps 2 to 5 describe the old flow (search, generic "Add", MCP bearer). The plan (S6, mobile) now has a dedicated Granola group on Integrations, visible without searching, with the secure key field and Connect and no generic Add. The story is outdated; the Variations paragraph already describes the new flow, which is what was walked.
- The "Live questions / Signed in with Granola" group was removed from the mobile frame.

## Steps

- Step 1 [pass]: Integrations list: Slack row, then a "Granola" header with the key group right below, no search required (gm-empty.png).
- Step 2 [pass]: Empty: label "Granola API key · Business plan", Connect dimmed, footer "Sends your meeting notes and transcripts to your AI model." (gm-empty.png).
- Step 3 [pass]: Paste, then Connect: Connecting state shows a spinner and "Connecting..." in the button, field disabled (gm-connecting.png).
- Step 4 [pass]: Syncing row with spinner (gm-syncing.png); auto-advances to "Synced 42 meetings" plus red Disconnect (gm-connected.png). Footer sentence is gone when connected.
- Step 5 [pass]: Disconnected: "Rakazo keeps your meetings and to-dos." then the empty key field and Connect (gm-disconnected.png).

## Geometry audit
Per-state phone measurements: back control 44x44, grouped rows 52 to 60 pt, Connect 48 pt, secondary text 13 pt rgb(142,142,147) on rgb(28,28,30) (about 5:1). Page audit: no overflow. No uneven rows inside the phone.

## 390x844 spot-check
The mockup is a 390 wide phone frame; at a 390x844 viewport it fits with no horizontal scroll (mobile-check-390.png).

## Flow Log
Ideal 4 (open Settings, Integrations; open tile; paste; Connect). Actual 3 on the phone (open Settings, Integrations; paste; Connect): the tile step is gone because Granola is a visible group. No hesitation points other than the empty field affordance (new finding).

## Round-2 findings
- F-MB-1-1 (high): fixed. Dedicated Granola group draws the key field and Connect directly (gm-empty.png).
- F-MB-1-2 (medium): fixed. No generic Add; see gm-empty.png.
- F-MB-1-3 (low): fixed. Footer sentence is the group footer.
- F-MB-1-4 (medium): fixed. Live questions group removed from the mobile frame.
- F-MB-1-5 (low): fixed. Synced row has a spinner while syncing (gm-syncing.png).
- F-MB-1-6 (low): fixed. Plan text and frame agree.
- F2-MB-1-1 (low): still-open. After "Synced 42 meetings" nothing on the phone points to the Granola agent; the plan keeps the agent link web-only for the first release (granola.md Surfaces).
- F2-MB-1-2 (low): still-open. Disconnect is still a red row that acts at once. The plan decides "no confirmation dialog" because meetings are kept; flagged only as an iOS-convention deviation to verify on device.
- F2-MB-1-3 (low): still-open. Back control is now 44 pt and the Connecting button now has a spinner (fixed). The status bar is still three dots instead of signal, Wi-Fi and battery glyphs (frame chrome only).

## New findings
- F3-MB-1-1 (medium, mockup): The empty Granola key field has no placeholder and no field chrome. On the phone it is a 13 pt stacked caption "Granola API key · Business plan" over blank space (59 pt row empty, 60 pt row in Reconnect needed), so it reads as a section caption rather than an input. iOS forms show a placeholder or an inline label with a trailing value. Fix: Draw the label inline at the left with a muted placeholder such as "Paste key" at the right (iOS LabeledContent/SecureField), or add a placeholder. The plan removed web placeholders; the phone needs its own decision.
- F3-MB-1-2 (low, mockup): In the Disconnected state, "Rakazo keeps your meetings and to-dos." is a bare caption between the "Granola" header and the key group. The plan says it is a plain first row of the group. Fix: Draw it as the first plain row of the group, or as a group footer.
