# Visual inspection V1 (iteration 20)

Scope: sign-in, sign-up, first-run tour, app shell and sidebar, Settings, Integrations, bot settings panel, Cmd+K.
Target: the demo stack only (web :5381). A fresh user (Maya Chen at northwind.example.test) for sign-up and the tour, the seeded mock founder for everything else.
Viewports: 1440x900 and 375x812 for every page, plus 1920x1080, 1280x800 and 720x450 (200% zoom) for the shell. Screenshots are in /tmp/uxloop20/V1/ (outside the repo).
Both audit scripts were run on every page state. Dark theme was the default; light theme was checked on the shell and Integrations.

Limits:
- The demo stack went down for about 6 minutes mid-session and came back with a freshly seeded database. A one-off "Working..." that never ended on the first sign-in attempt happened just before that outage; it did not reproduce twice afterwards, so it is not reported as a bug.
- `agent-browser` cannot emulate `pointer: coarse` (`set device "iPhone 12"` still reports `coarse: false`), so no touch-target size is reported as measured. V1-01 is derived from code plus a non-coarse measurement and is marked suspected.
- Onboarding (model, Connect your apps) was NOT OBSERVED: `/onboarding` redirects straight to the app for both the mock founder and a fresh user. Real provider steps are BLOCKED by the rules.
- Connect buttons (OAuth) were not clicked.

## Verdicts

| Page | 1440x900 | 375x812 | Notes |
| --- | --- | --- | --- |
| Landing | Excellent | Excellent | One focal point (Sign up), no scroll. |
| Sign in | Good (V1-12) | Good | Inputs keep values on error, error text sits above the button with no layout shift, tab order is sensible. |
| Sign up | Excellent | Excellent | "At least 8 characters." explains the disabled button. |
| First-run tour (9 stops) | Good | Good (V1-04) | Desktop card keeps one bottom-left spot and each stop names its item. The ring on the target is clear. Shown again for the freshly seeded founder, as expected. |
| App shell and sidebar | Good (V1-02, V1-03, V1-14) | Good | No page scroll at 1920x1080, 1440x900, 1280x800, 375x812 or 720x450. Lists and chat scroll inside panels. At 720x450 the sidebar shrinks to "+8 more" honestly. |
| Settings (4 sections plus Memory) | Good (V1-05, V1-13, V1-15) | Good (V1-16) | Fixed height; focus order is nav, Advanced, Close, content; Escape returns focus to the account button. Phone sheet uses a section dropdown. |
| Integrations list | Excellent | Excellent | Connected apps first, "Used by" avatars, empty search offers "Add a custom connection". A fresh user sees Gmail first under Popular. Light theme also clean. |
| Integrations detail (Gmail) | Good (V1-07, V1-08, V1-09) | Good (V1-01, V1-10) | |
| Bot settings panel | Good (V1-06, V1-11) | Good (V1-10) | Audience control, Skills and Advanced are in a sensible order. |
| Cmd+K | Excellent | not run | Lists the pages, Integrations and Settings, with a key legend. |
| Onboarding | NOT OBSERVED | NOT OBSERVED | See limits. |

## Findings

Severity: P1 a human stumbles, P2 visibly below excellent, P3 polish. Everything is observed unless marked suspected. No P0 or P1 found.

| id | page | sev | cat | What happened vs expected | Evidence | Suspected code | Proposed fix |
| --- | --- | --- | --- | --- | --- | --- | --- |
| V1-01 | Integrations detail (phone) | P2 | a11y | SUSPECTED. The "Integrations" back link is a bare link 96x20 px (measured without touch emulation). The global `pointer: coarse` rule in styles.css enlarges buttons, tabs, selects and inputs but not links, and this link has no `rk-tap` class, so on a phone it is probably a 20 px tall target (I4). | int-gmail-375.png; DOM rect 96x20; styles.css:88-110 | apps/web/src/components/integrations/AppDetail.tsx:372 (same class string in McpDetail.tsx:67, GranolaPage.tsx:33, StoredMeetingsList.tsx:52) | Add `rk-tap` to the four back links. |
| V1-02 | Shell, light theme | P2 | a11y | In light theme the sidebar's muted text is below 4.5:1: timestamps, bot previews, "Page agents", "Email chats", "+N more" measure 4.42:1 at 12-13 px, the unread count "1" 4.08:1, and the new-chat "+" icon 2.62:1 (needs 3:1). Dark theme passes everywhere (the only miss is the "+" at 3.52, above 3:1). | shell-light-1440.png; computed colors resolved through a canvas (muted rgb 108,108,112 on sidebar rgb 236,236,233) | packages/ui-tokens (light `muted-foreground` / sidebar tokens) | Darken light `muted-foreground` about 6% on the sidebar surface and give the "+" icon the full foreground color. |
| V1-03 | Sidebar bot list | P3 | visual | When the list overflows, the "+N more" bar cuts the next group header in half ("RECONNECT NEEDED" is sliced mid-letter) instead of fading out (L5, H6). | botmenu-1440.png, shell-light-1440.png | Sidebar bot-list scroller (`rk-scroll-fade-y`) and the "+N more" row in apps/web/src/pages/Shell.tsx | Apply the bottom fade mask above the "+N more" bar, or hide a header that would be clipped. |
| V1-04 | Tour, phone | P3 | visual | The tour card sits inside the drawer below the account row. Its height changes between stops (one line versus three lines plus "Ask Chief"), so the Integrations and account rows jump up to 38 px as you press Next (Integrations at y=599 on stop 4, y=561 on stop 9). On stop 9 the ring on the account row touches the card (L5). | tourm4-375.png, tourm9-375.png | Tour card component (search for "Skip tour" in apps/web/src) | Give the card a fixed min-height that fits the longest stop, or float it over the list. |
| V1-05 | Settings > General | P3 | visual | Carry-over from iteration 19 (V1-02, still present). With Chat display expanded the left column is much taller and scrolls under a fade, while the right column ends at y=500 and leaves a large empty band (D2, L4). | set-chat-1440.png | apps/web/src/pages/SettingsOverlay.tsx (two-column General layout) | Move Chat display to the right column under Usage, or lay the cards out as one flowing list. |
| V1-06 | Bot settings | P3 | visual | The Notifications switch is drawn fully ON while the line under it reads "Off in Settings". The caption is the owner's decision; the switch still looks live (C3, H5). | bots-1440.png, bots-375a.png | apps/web/src/pages/shell/bot-panel.tsx:545 | Draw the switch in its disabled style while browser notifications are off, keep the caption. |
| V1-07 | Integrations detail | P3 | copy | Each Gmail account shows two switches, each with a sentence that restates the switch ("Off: the agent only reads. On: it can also make changes, and asks you before each one."). With two accounts that is four sentences of explanation in one view. AGENTS.md says copy that repeats the interface should be removed or revealed only when relevant (C4). | int-gmail-1440.png | apps/web/src/components/integrations/IntegrationAgentSection.tsx:102 and :128 | Keep one short hint per switch, or move the Off/On explanation into the switch's info tooltip. |
| V1-08 | Integrations detail | P3 | visual | "Connected 10/22/2026" uses the browser's numeric date, while the rest of the app writes "Oct 21" (H5). | int-gmail-1440.png | apps/web/src/components/integrations/AppDetail.tsx:110 (`toLocaleDateString()` with no options) | Format with the shared short-date helper ("Oct 22, 2026"). |
| V1-09 | Integrations list | P3 | flow | The "..." menu on a connected app card has one item, "Manage", which opens the same page as the card title. The popup also covers the card's "Open Inbox" button while open (I5, C2). | int-menu-1440.png | apps/web/src/components/integrations/parts.tsx:98 | Remove the one-item menu, or make the card title the only route to the detail page and put Disconnect here. |
| V1-10 | Phone, sheets and detail pages | P3 | flow | The persistent approval toast sits at the bottom of the screen. With the bot settings sheet or an Integrations detail page open there is no composer, so the toast covers content (the Skills row, the second Gmail account) until it is dismissed (L3). Owner decision: toasts persist and sit above the composer; this is only about where it goes when no composer is showing. | bots-375a.png, int-gmail-375.png | apps/web/src/components/AppToaster.tsx | On phones, when a full-height sheet or page is open, dock the toast to the top edge or collapse it to a "1 needs approval" pill. |
| V1-11 | Bot settings > Advanced | P3 | visual | The Workspace segmented control wraps "Shared with your other bots" onto two lines, so it is 54 px tall next to the 32 px Audience control, and the unequal segments look uneven (H6, D3). The heading "Workspace" is also a second name for what the rest of the app calls a Space (C1). | bots-adv-1440.png | apps/web/src/pages/shell/bot-panel.tsx:100 | Shorten to "Shared" / "Only this bot" and rename the heading to match the Space wording. |
| V1-12 | Sign in | P3 | visual | "Forgot password?" floats about 46 px below the password field and 55 px above the button, so it reads as belonging to neither (D4). | signin2-1440.png | apps/web/src/pages/SignIn.tsx (form spacing) | Pull the link to 8 px under the field and keep the large gap before the button. |
| V1-13 | Settings > Memory | P3 | visual | The page opens with the collapsed "Outside memory service" disclosure, above the actual list of remembered items ("Nothing remembered yet"). An advanced option is placed ahead of the content (H1, I5). | set-mem-1440.png | apps/web/src/pages/MemorySettingsOverlay.tsx:226 | Show the remembered items first and put the outside-service disclosure below them. |
| V1-14 | Shell headers | P3 | visual | A chat header is 55 px tall (title centered at y=27) while every page header (Inbox, Finance, Legal, GTM, Investors, Fundraising, Contacts, Data room, Artifacts, Integrations) centers its title at y=40 in a 69 px band. Switching from a chat to a page moves the title down 13 px. Integrations also draws a divider under its header while Inbox does not (H5, L5). | Measured on all ten pages; shell2-1440.png vs pg-Inbox-1440.png and int-1440.png | Shell page header components (apps/web/src/pages/Shell.tsx and each page) | Use one header height token for chat and pages, and either draw the divider everywhere or nowhere. |
| V1-15 | Settings, phone | P3 | visual | The phone sheet insets the content by about 33 px on each side (8 px sheet margin, 24 px padding), leaving 309 px of 375 for the cards (D1). | set-general-375.png, set-priv-375.png | apps/web/src/pages/SettingsOverlay.tsx (sheet padding) | Use 16 px side padding on phones. |
| V1-16 | Signed-out pages | P3 | perf | The welcome and sign-in pages call `notifications/pendingApprovals` and `notifications/subscribe` while signed out. Each returns 401 (twice each in the log), so it is console and network noise. | agent-browser network log on `/` | apps/web/src/components/AppToaster.tsx:53 (mounted before auth is known) | Mount the toaster poller only when a session exists. |

## Excellent as is

- Landing and Sign up: one focal point, nothing to scroll, disabled-button reason shown as plain hint text.
- Sign-in error state: both fields keep their values, the red message appears above the button without moving it, and the focus ring is clear at 375 px.
- First-run card "What should I work on first?": three plain choices, one close button.
- Tour on desktop: fixed bottom-left card, the same button positions on every stop, and a ring on the item it names.
- Cmd+K: Pages, Integrations and Settings, with a key legend and a focus trap.
- Settings: the focus order and Escape return focus to the account button; the phone dropdown replaces the tab list cleanly; "Per model and documents" reveals two clear switches.
- Integrations list: connected apps first with "Used by" and a direct "Open ..." action, filter chips, and an empty-search result that offers "Add a custom connection". Light and dark both read well.
- Not-found page: a short statement and one button back.
- Shell fit: no page scroll at 1920x1080, 1440x900, 1280x800, 375x812 or 720x450; the account menu, pages menu ("Show in sidebar") and bot context menu are well grouped, with Delete last and in red.
- Bot settings: Audience as a two-option segmented control, Skills with a clear "Add skill", and Advanced collapsed by default.

## Audit false positives

- `lowContrast` rows of ratio about 1.2-1.4 for sidebar labels and the "Skip to content" link come from the script not resolving `oklab()` colors; the canvas-based check above shows dark theme passing.
- `overlaps` between sidebar rows and settings nav buttons are the blurred page behind the settings dialog.
- `overflowSpills` of 124 px on chat bubbles and `wrappedControls` on the Sign in button are the bubbles' hidden hover toolbar space and a "Working..." state label, not visible defects.
- `smallTargets` for "Resize sidebar" (8x900) and the 1x1 skip link are intended.
