# Visual review V1 (iteration 17)

Scope: sign-in, sign-up, first-run (Chief question card, Connect cards), first-run tour, app shell and sidebar, Settings, Integrations, bot settings panel.
Target: mock-data demo stack only (web :5381). Session uxl17-V1 (founder login) and uxl17-V1-new (fresh sign-up, walker-v1@northwind.example.test). Screenshots: /tmp/uxloop17/V1/. Audits: layout-audit.js and geometry-audit.js run on every page and viewport (JSON saved next to the screenshots as *.layout.json, *.geo.json).

Method notes
- No page-level scroll at 1440x900, 1920x1080, 1280x800, 1024x800, 768x800, 375x812 on any page (pageScrollY 0, pageOverflowX 0).
- layout-audit "lowContrast" rows for sidebar text (ratios 1.23 and 1.32) are false positives from background detection. Measured by hand: 11px "Pages" label 7.2:1, timestamps 5.2:1, row subtitles 5.5:1, "Needs your answer" 9.5:1, orange bubble text 5.9:1. All pass.
- Touch-target sizes were NOT filed: agent-browser has no touch emulation (`set device` leaves `pointer: coarse` false), so measurements would be invalid.
- Light theme not checked: `media light` did not change the app theme in this session. Unverified.
- BLOCKED: Gmail and Google Calendar "Connect" cards (first-run) and every Integrations "Connect" start an OAuth/provider flow. I clicked Airtable once: it opened a new tab to the mock provider (pipedream.example.test), the demo then showed "Airtable connected". Real provider steps not attempted.
- State I changed on the demo: connected Airtable, created and deleted an empty folder "Board prep", opened the "Reconnect needed" space (its Chief greeted me on first use), signed up one user.

## Verdict per page and viewport

| Page | 1440x900 | 375x812 | Other |
|---|---|---|---|
| Landing | Excellent. Centered, one primary action. | Excellent. | |
| Sign in | Excellent. Tab order email, password, show, forgot, submit, sign up. | Excellent. | |
| Sign up | Good. Inline errors; layout shifts 52px on error (V1-07). | not captured | |
| First-run Chief card + Connect cards | Good. Copy awkward (V1-03). | Good. | |
| First-run tour | Good. Nine stops, fixed spot, names the item. | Good. Card overlaps drawer edge but reads. | |
| App shell + sidebar | Good, fits one screen. Pinned Pages block squeezes chat list on short screens (V1-04). | Good. Drawer works. | 1920x1080 good; 1280x800 chat list scroll area only 284px |
| Settings (General, Privacy, Models, Memory) | Good. Fixed height, inner scroll. Small inconsistencies (V1-08). | Good. Nav becomes a select. | 1280x720 inner scroll works |
| Settings close behavior | See V1-02 (one unreproduced failure). | | |
| Integrations | Good. Dense grid, filters, search, empty state with custom-connection fallback. Small affordance inconsistencies (V1-09, V1-10). | Good. Single column cards. | |
| Bot settings panel | Good at >=1280. Below 1280 it overlays the chat and hides Send (V1-01). | Full width panel not captured. | 1180, 1024, 768 broken |

## Findings

| id | page | sev | cat | observed vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|
| V1-01 | Bot settings panel, shell at 768-1180px wide | P1 | flow (norms L2, L6) | Observed. Opening "Chief settings" at 1180, 1024 or 768 wide lays the 384px panel over the chat instead of beside it. Message text is cut at the panel edge and the composer Send button is hidden (Send right edge 985px, panel left edge 640px at 1024; 857 vs 896 at 1280 still fits). No scrim, so it looks like a broken layout. Expected: Send always visible, or a clear modal overlay. | /tmp/uxloop17/V1/40-shell-1024.png, 40-shell-768.png, 41-shell-1180.png | apps/web/src/pages/ResizableSidePanel.tsx:84 (`absolute ... xl:relative`) | Below xl, either dim the chat with a scrim and trap focus, or push the chat narrower with a min width and keep the composer inside it. |
| V1-02 | Settings dialog | P1 | bug (I3, I7) | Observed once, not reproduced. After visiting General, Privacy, Models and Memory and resizing 375 to 1440, Escape, the X button and a programmatic close all closed the dialog and it reopened about 300ms later (poll: closed for 3 samples of 100ms, then open), until a page reload. The accessibility refs changed on each attempt. After a reload I could not reproduce it in 4 attempts (Escape, Models, Memory, resize then Escape). | timeline sampled via eval; screenshot /tmp/uxloop17/V1/z3.png shows dialog still open | Suspect apps/web/src/pages/Shell.tsx settingsOpen state (lines 856, 3687, 7147), cause not identified | Needs a reproduction from another walker; check what re-calls openSettings after onClose (rpc.me refresh, search param effect at ~2476). |
| V1-03 | First-run Chief question card | P2 | copy (C1) | Observed. "What do you want me on first?" is not natural English. Expected a plain question such as "What should I work on first?". | /tmp/uxloop17/V1/32-onboard-1.png | apps/api/src/onboarding.ts:157 | Reword to "What should I work on first?" (update the e2e and unit strings that quote it). |
| V1-04 | App shell sidebar | P2 | visual (L1, D2) | Observed. The Pages block is pinned and takes 400px of the sidebar. The chat list under it scrolls inside 384px at 900px high and only 284px at 800px high (3 chats visible, 506px of content). On a 720px laptop the list is about 200px. Expected: the sidebar as a whole stays usable on a short screen. | /tmp/uxloop17/V1/12-shell-1280.png; scroller 506 vs 284 in shell1280.layout.json | apps/web/src/pages/Shell.tsx sidebar, `rk-scroll rk-scroll-fade-y` container | Let the whole sidebar scroll under short heights, or cap the pinned Pages block and collapse it on heights below 800. |
| V1-05 | App shell, chat | P2 | a11y (I7) | Observed. Each message has React, Reply, Remember and More buttons in the tab order. In the demo Chief thread the composer is tab stop 59, 42 stops after the header Routines button (118 focusable elements). Keyboard users must tab through every message toolbar to reach the composer. Expected: one stop per message or a shortcut to the composer. | tab-order counts via eval on /app/<chief> at 1440x900 | message toolbar in apps/web/src/pages/shell (message actions) | Make the toolbar a single roving-tabindex group, or add a "Skip to composer" link next to "Skip to content". |
| V1-06 | Chat bubbles | P3 | visual (H4) | Observed. The user's own bubbles use the bot's identity colour (teal with Chief, orange with Investor Relations), the same colour as that bot's avatar. Large saturated blocks dominate a monochrome app, and the speaker is told apart only by alignment. This may be intended; contrast is fine (5.9:1). | /tmp/uxloop17/V1/29-ir-bot.png, 05-shell-1920.png | chat bubble styles in apps/web/src/components (user message) | Consider a neutral ink bubble for the user and keep identity colour for the bot avatar only. Design decision, not a defect. |
| V1-07 | Sign up | P3 | visual (L5) | Observed. Submitting empty adds an error line under each field and moves the button down 52px (Create account at y=613 becomes 665). Expected: reserve space for the error line or use an inline icon. | /tmp/uxloop17/V1/30-signup-1440.png vs 31-signup-empty-submit.png | sign-up form component | Reserve a fixed-height message slot under each field. |
| V1-08 | Settings | P3 | visual (L5, H5) | Observed. The first card starts at y=167 on General and Privacy but y=150 on Models (17px jump when switching tabs). Memory shows bare text with no card, unlike the other sections. | /tmp/uxloop17/V1/16-settings-privacy-1440.png, 17-settings-models-1440.png, 18-settings-memory-1440.png | apps/web/src/pages/SettingsOverlay.tsx and the Models and Memory panes | Give every pane the same top padding and wrap Memory content in a card. |
| V1-09 | Integrations | P3 | visual (H5, D3) | Observed. Only Blockscout and Coinbase show a "..." menu; Gmail, Carta, Mercury, Brex and the newly connected Airtable show none, and Coinbase has no "Used by" row so its card is shorter. Expected one consistent card anatomy (or a stated reason a card cannot be disconnected). | /tmp/uxloop17/V1/22-integ-connected.png | apps/web/src/pages/Integrations.tsx connected card | Show the same overflow control on every connected card; hide "Used by" consistently or reserve its row. |
| V1-10 | Integrations connect success | P3 | flow (I2, I7) | Observed. The "Airtable connected" dialog has only a Done button, and after Done the focus ring lands on the account button (Maya Chen) instead of the Airtable card or the page. Expected: focus returns to the new card, and the dialog names a next step (for example which bot can now use it). | /tmp/uxloop17/V1/21-integ-after-popup.png, 22-integ-connected.png | apps/web/src/pages/Integrations.tsx (connected dialog) | Return focus to the new card; add one line naming what changed. |
| V1-11 | Sidebar scroller | P3 | visual (D2) | Observed. The scroll fade draws a visible grey band 25-30px tall above the Integrations row (y~750-785 at 1440x900) over the last list row, and the space header sits flush against the top fade edge. Expected: fades that are invisible when there is nothing to hide. | /tmp/uxloop17/V1/03-after-login.png, z-crop.png | apps/web/src/styles.css:65 `.rk-scroll-fade-y` (16% foreground gradient) | Use a transparent-to-background mask and only show it when content is scrolled. |
| V1-12 | Shell header and sidebar | P3 | visual (H5, C1) | Observed. Two clock-style icons mean different things: sidebar "Activity" (history icon, x=217) and header "Routines" (clock, x=1400). | /tmp/uxloop17/V1/03-after-login.png | Shell.tsx header and sidebar toolbar | Give Routines a calendar-repeat or refresh icon. |

## Excellent as is

- Landing, sign-in and sign-up: one focal action, calm hierarchy, correct tab order, working Show password, clear inline validation messages ("Enter a valid email", "At least 8 characters.") that keep typed values.
- Shell fits one screen at 1280x800, 1440x900 and 1920x1080 with inner scroll only; no horizontal overflow at 375, 768, 1024.
- Sidebar: clear badges (Inbox 14, Legal 1, Data room failed count with accessible names such as "Inbox, 14 unread"), pinned Pages menu with "Show in sidebar" checkboxes, Create menu, inline folder rename and an empty folder that deletes without a confirm.
- Account menu: grouped, "Log out" separated, tour reachable from it.
- First-run flow: the answered question card collapses to the chosen option, then Chief offers Gmail and Calendar connect cards in plain words.
- First-run tour: nine stops, fixed card position, each card names its item, works inside the mobile drawer at 375.
- Settings: fixed dialog height, inner scroll, selected nav item is obvious (fill and weight), mobile nav becomes a select, destructive "Delete account" is distinct but not dominant.
- Integrations: dense three-column grid, filter chips, search with a useful empty state ("No integrations match." plus "Add a custom connection"), custom-connection dialog with a disabled Connect until a URL is given.
- Bot settings panel at >=1280: tidy single column, Audience as a two-way segmented control, Advanced folded away, "Clear conversation" at the bottom in destructive red.
- Muted text contrast measured 5.2:1 to 9.5:1 everywhere sampled.
