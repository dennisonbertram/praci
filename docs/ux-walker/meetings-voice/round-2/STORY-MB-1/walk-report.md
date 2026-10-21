# STORY-MB-1: Paste a Granola API key from the phone (round 2)

**Verdict: PASS**. Walked the current mockup and plan on 2026-10-20 in session uxw2-flow.

## Steps
1. Integrations list now has a GRANOLA group under Slack with the key field and Connect inline, no detail page (screenshots/step-empty.png). Steps 2-4 of the old story (search for tile, Add, MCP address) are outdated: no tile or Add button.
2. Connect is dimmed while the field is empty; "Business plan" footer below.
3. Connecting... (dimmed row), Syncing with Disconnect, then "Synced 42 meetings" with Disconnect (screenshots/steps-empty-connecting-syncing-connected.png).
4. Settings to Integrations navigation is the existing screen, not redrawn.

## Geometry
Run on docs/granola/mockup.html#screen-mobile with the phone frame measured directly (390 x 780 pt frame). Rows 44-63 pt, body 17 px, section header/footer 13 px, large title 34 px, glass back 40 pt. No overflow or spill.

## Native iOS check (mobile frame)
Grouped inset list, uppercase 13 pt section header, 17 pt row text, centered link rows, red Disconnect, large title, round glass back button, home indicator: all match iOS. Gaps against iOS: status bar is three dots, glass back is 40 pt (44 pt recommended), no spinner beside Connecting..., Disconnect acts without an iOS confirmation alert.

## Flow log
Ideal 4 steps (Settings, Integrations, paste, Connect); mockup supports 3 of them with the first existing. After Connected there is no pointer to the next action (ask the agent).

## Round-1 findings
- F-MB-1-1 (high): **fixed**. Granola group is on the Integrations screen without searching (FX-30).
- F-MB-1-2 (medium): **fixed**. "Live questions" group removed.
- F-MB-1-3 (low): **fixed**. Connect is dimmed when empty (screenshot step-empty.png).
- F-MB-1-4 (medium): **fixed**. Connecting, Syncing and Connected states drawn.
- F-MB-1-5 (low): **fixed**. Glass back drawn and the comment says the frame is a native List with a SecureField. Remaining small gaps in N3.
- F-MB-1-6 (low): **fixed**. Plan S6: meetings.connect trims the key server-side.

## New findings
- F2-MB-1-1 [plan, low] After "Synced 42 meetings" the phone shows nothing about the Granola agent; plan keeps the agent link web-only. The user must know to open the bot list.
- F2-MB-1-2 [plan, low] Disconnect is a red row that acts at once. iOS convention is a confirmation alert for destructive rows. Meetings are kept (D4) so harm is small.
- F2-MB-1-3 [mockup, low] Native fidelity gaps: glass back is 40 pt, status bar dots, no activity indicator on Connecting...
