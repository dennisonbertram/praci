# Visual inspection V1 (iteration 19)

Scope: sign-in, sign-up, first-run tour, app shell and sidebar, Settings, Integrations, bot settings panel, Cmd+K.
Target: demo stack only (web :5381). Fresh user for sign-up and tour; the seeded mock founder for the shell, Integrations and bot settings.
Viewports: 1440x900, 375x812, and 1920x1080 for the shell. Screenshots are in /tmp/uxloop19/V1/ (outside the repo).
Both audit scripts were run on every state; their false positives are listed at the end.

## Verdicts

| Page | 1440x900 | 375x812 | Notes |
| --- | --- | --- | --- |
| Landing, Sign in | Excellent | Excellent | One-screen, focus order email, password, show password, forgot, sign in, sign up. Error state keeps inputs and does not shift the button. |
| Sign up | Excellent | Excellent | "At least 8 characters" hint is the disabled-button reason. |
| First-run tour (9 stops) | Good | Good (V1-10) | Card keeps a fixed bottom-left spot and names the item; the ring on the target is clear. |
| App shell and sidebar | Good (V1-05, V1-06) | Good (V1-01) | No page scroll at 1440x900, 1920x1080 or 375x812; the bots list and chat scroll inside panels. |
| Settings (all 5 sections) | Good (V1-02, V1-03, V1-11) | Good | Mobile is a sheet with a section dropdown; the inner panel scrolls. |
| Integrations | Good (V1-04, V1-08) | Good (V1-07) | Connected apps first, each with an "Open ..." action. |
| Bot settings panel | Good (V1-09, V1-12) | Good | Audience, Skills, Advanced, Export are in a sensible order. |
| Cmd+K palette | Excellent | not run | Falls through to "Search mail for ..." instead of an empty list. |
| Onboarding (model, Connect your apps) | NOT OBSERVED | NOT OBSERVED | `/onboarding` auto-skips on the demo (default model set, no integrations needing setup). Real provider steps are BLOCKED by the rules. |

## Findings

Severity: P1 a human stumbles, P2 visibly below excellent, P3 polish. All are observed unless marked suspected.

| id | page | sev | cat | What happened vs expected | Evidence | Suspected code | Proposed fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V1-01 | Shell, phone drawer | P2 | flow | After "Bot settings" is chosen from a row's menu in the open phone drawer, the drawer stays open on top of the settings panel. The result is hidden until the person closes the drawer. Expected: the drawer closes, as it does for page rows and new chats (I2, I6). | m-botsettings-375.png (drawer over panel), m-botsettings-375c.png (panel after closing drawer) | apps/web/src/pages/Shell.tsx:6804 (`onEdit` of BotContextMenu); other handlers around 4703-4837 call `setMobileSidebarOpen(false)` | Call `setMobileSidebarOpen(false)` in that `onEdit` (and the Routines/Duplicate handlers if they share the path). |
| V1-02 | Settings > General | P3 | visual | With "Chat display" expanded the right column is about 1.5 times taller than the left and scrolls under a fade, while the left column ends at y=565, leaving a 260 px empty band (D2, L4). | settings-chat-1440.png | apps/web/src/pages/SettingsOverlay.tsx (two-column General layout) | Put Chat display in the left column under Appearance, or lay the cards out as one masonry flow. |
| V1-03 | Settings | P3 | visual | The first card starts at a different height per section: Models y=150, Memory text y=159, General and Privacy y=167 (L5, D3). The tab content jumps up 17 px when switching. | settings-general-1440.png, settings-privacy-1440.png, settings-models-1440.png, settings-memory-1440.png | apps/web/src/pages/SettingsOverlay.tsx (per-section top padding) | Give every section the same top offset. |
| V1-04 | Integrations | P3 | visual | The page has no 56 px header row like Chief and bot pages. The title sits at y=39 (other headers y=27), and scrolled cards are cut hard at y=64 with no divider or fade (H5, L4). On a phone the title is aligned with the menu button, so this is desktop only. | integ-1440.png, integ-bottom-1440.png | apps/web/src/pages/Integrations.tsx (title row) | Use PageHeader's PAGE_HEADER_ROW and a bottom border so scrolling content clips under a line. |
| V1-05 | Shell, sidebar | P3 | visual | At 1440x900 the bots list ends mid-row: the "Page agents" group row is half cut at the scroll edge, and its text shows through the fade as a ghost line. Reads as a rendering bug although it is a scroll edge (D2). | mock-shell-1440.png | scroll container `div.rk-scroll.rk-scroll-fade-y` in Shell.tsx (sidebar) | Make the bottom fade fully opaque over the last 12 px, or snap scrolling to rows. |
| V1-06 | Shell, bot row menu | P3 | visual | With a row's menu open, the "..." button lands on the unread dot next to the time ("2:34 PM." collides) (L5, H6). | botmenu-1440.png | bot row trailing slot in the sidebar item component | Reserve a separate slot for the dot, or hide the dot while the action button shows. |
| V1-07 | Integrations, phone | P3 | visual | Connect is placed inline-right on three Popular cards but on its own row below the text on the Chat cards. Six Connected cards (about 150 px each) push Popular below the fold, so a person wanting to add an app scrolls about 900 px (H5, L4). | m-integ-top-375.png, m-integ-bot-375.png | Integrations card component (flex-wrap on action) | Keep the action in one place on phones (own row or inline, not both) and make Connected cards single-row. |
| V1-08 | Integrations | P3 | visual | Apps without a logo show a letter tile, and the iMessage cards show "P" and "M", which reads as unrelated letters (H5, C1). Treg, Devin, Granola, Wispr Flow show T, D, G, W. | integ-bottom-1440.png | the provider logo table for Integrations | Add logos or use a neutral icon; never an unrelated first letter. |
| V1-09 | Bot settings | P3 | copy | Skill descriptions are cut with an ellipsis ("Spot scam tokens and look-alike addresses in ..."). The span has no title and no expand, so the rest cannot be read (C4). | botsettings-adv-1440.png; DOM check: span scrollWidth > clientWidth, title empty | the skill row in the bot settings panel | Wrap to two lines or add a title. |
| V1-10 | Tour, phone | P3 | visual | The tour card is 343 px wide (x 16 to 359) while the open drawer is 316 px wide, so the card crosses the drawer edge onto the backdrop and the drawer's Integrations and account rows move up (L4, L5). | m-tour1-375.png | tour card in Shell.tsx / sidebar tour component | Clamp the card to the drawer width on phones. |
| V1-11 | Bot settings, header | P3 | visual | The panel title "Finance helper (mock) settings" sits at y=31 while the chat header title is at y=27 on the same row, and it is 13 px muted next to a 16 px bold title (H6, H3). | botsettings-1440.png | right panel header | Use PAGE_HEADER_ROW height and the same text style as the chat header. |
| V1-12 | Chat, "Thinking" row | P3 | a11y | "Stop" and "Try again" are 26x18 and 50x18 px underlined text buttons at 1440 (I4 wants at least 24x24). On touch the global 44 px rule applies (see unverified items). | botsettings-1440.png, layout-audit smallTargets | thinking-status component | Add 6 px vertical padding so the target is 30 px tall. |
| V1-13 | Settings | P3 | flow | Opening Settings does not change the URL (it stays /app/<chat>), so it cannot be linked or reached with the browser Back button; Escape does close it and focus returns to the account button (I6). | URL read after opening | apps/web/src/pages/SettingsOverlay.tsx | Optional: a `?settings=general` search param. |
| V1-14 | Landing | P3 | perf | The first paint of `/` is bare "Loading..." text centered on the dark background for about a second before the hero (I2). | signin-1440.png (first capture) | root route suspense fallback | Render the hero or the brand mark in the fallback. |

## Unverified and blocked

- Touch targets: agent-browser (including CDP touch emulation) did not make `pointer: coarse` match, so no touch measurements were taken. Static check only: apps/web/src/styles.css:88 raises every button, tab, select, summary and text input to 44 px under `pointer: coarse`, and Auth.tsx links have `pointer-coarse:py-3` classes. No finding is raised.
- Onboarding model step and "Connect your apps": not reachable on the demo (auto-skip). Provider sign-in is BLOCKED.
- Settings did not open in the fresh-user session after I applied `set device "iPhone 15"` earlier and then resized (clicking the menu item did nothing, three tries). It opens correctly in a clean session (mock founder, role dialog, focus moves inside, Escape returns focus). I treat this as an emulation artifact, not a product bug.
- Connecting any integration and the custom-connection submit were not tried.

## Excellent as is

- Sign-in and sign-up: one column, 48 px fields, 16 px type, a single primary button, hint text that doubles as the disabled reason, a wrong-password message ("Invalid email or password") that keeps both inputs, with no layout shift. Tab order is logical.
- The first-run tour: nine short cards, a fixed position, each names the item and the item gets a clear ring; "Ask Chief" on the last stop.
- Sidebar: the Pages block is pinned and bots scroll below it; the account menu is five items with Log out separated.
- Settings: five sections, switches grouped by meaning, mobile sheet with a section dropdown, `Advanced` is a native details element; focus lands in the dialog and returns on Escape.
- Integrations: Connected first with "Open Inbox/Finance/Investors", "Used by" avatars, equal-height cards, a clean search and filter row.
- Cmd+K: pages, Integrations and Settings listed, key hints, "Search mail for ..." as a fall-through, stable anchor while it resizes.
- Bot settings: avatar, name, description, notifications, Audience as a two-option control, skills with switches, destructive "Clear conversation" visibly separate.
- Viewport fit: no page scroll at 1440x900, 1920x1080 or 375x812 on any page checked.

## Audit false positives (no finding)

- layout-audit `lowContrast` on sidebar labels (ratio 1.3) is a measuring artifact of transparent backgrounds; the rendered text reads clearly in the screenshots.
- `smallTargets` for switch spans (32x18) and "Resize sidebar" (8 px) are hit areas around visible controls; the global rule gives switches a 44 px hit area on touch.
- geometry-audit `unevenRows` and `overflowSpills` are the hover-only message toolbar and name/time rows, not visible defects.
