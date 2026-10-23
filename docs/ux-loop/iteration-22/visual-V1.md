# Iteration 22 - visual inspector V1

Scope: sign-in, sign-up, landing, first-run tour (fresh user), app shell and sidebar (Pages menu, space and bot menus), Settings (all sections), Integrations, bot settings panel. Mock-data demo stack only. Viewports 1440x900, 375x812, 1920x1080 and 1280x800 for the shell. Touch checks used CDP touch emulation (`pointer: coarse` confirmed true). Layout audit and geometry audit were run on every state. Screenshot file names are listed per finding; the files are kept outside the repo.

Notes on the run: the demo account is shared with other walkers, so sidebar contents changed during the run (new bots, extra spaces, a persistent approval toast). Findings below do not depend on that data except V1-02, which needs a pending approval toast. The BLOCKED list is at the end.

## Verdicts

| Page / state | 1440x900 | 375x812 | Verdict |
|---|---|---|---|
| Landing | Clean, centered, one primary action | Wraps to three lines, still fine | Excellent (one P3) |
| Sign in | Clean; errors inline, values kept | Clean; long email scrolls inside field | Excellent |
| Sign up | Clean; per-field errors, hint stays visible | Clean | Excellent |
| Reset password | Not captured at 1440 | Heading wraps to two lines, 74 px gap above button | Good (P3) |
| Fresh-user first run (Chief + first-question card) | Compact, one card, one question | Not captured separately | Good |
| First-run tour | Fixed spot, names the item, 9 stops | Card sits below the account row inside the drawer; drawer is closed at start so the tour is invisible until opened | P2 on phone |
| Shell + sidebar | One screen at 1280, 1440, 1920 (pageScrollY 0); inner panels scroll | Drawer shows 1 chat row plus "+12 more" under touch sizing | Good on desktop, P2 on phone |
| Pages menu, Create menu, account menu, space menu, bot menu | Compact, labelled, Escape returns focus to the trigger | Not separately checked | Excellent |
| Settings General | Two columns; reflows when Chat display opens | Full-height sheet with section select | P2 |
| Settings Privacy and approvals | Clear; switch states legible | Not captured | Good |
| Settings Models (own model, voice) | Dense, two panes | Not captured | Good (two P3) |
| Settings Memory | Minimal | Not captured | Good |
| Settings deep link `/app/settings` | Does not open Settings in 4 of 5 loads | Does not open | P1 |
| Integrations | Three-column grid, clear groups | Single column, 44 px buttons | Good; P2 when a toast is pending |
| Connect dialog (Kraken, API key form) | Compact, focus lands in first field | Not captured | Good |
| Bot settings panel | Compact, Audience control, "Off in Settings" shown | Not captured | Excellent |
| Cmd+K palette | Lists Pages, Integrations, Settings; page agents hidden | n/a | Excellent |
| Light theme (Integrations) | Good contrast, same layout | n/a | Good |

## Findings

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Suspected location | Proposed fix | Status |
|---|---|---|---|---|---|---|---|---|
| V1-01 | Shell, `/app/settings` | P1 | bug | Opening `/app/settings` in a fresh page load shows the chat, not Settings. Expected: Settings opens (Pass-21 decision). It opened once, early in the run, then failed in 5 later loads at 1440 and 375, also for `/app?settings=general`. | settings-deeplink-retest.png (URL ends as the chat route, no dialog); snapshot has no Settings navigation | `apps/web/src/App.tsx:249` redirects to `/app?settings=general`; the effect at `apps/web/src/pages/Shell.tsx:2549` reads it, but the first-thread redirects at `Shell.tsx:1459` and `:1475` navigate to `/app/<id>` without keeping the query. Race is suspected, not proven. | Carry the search string through the `firstThreadRoute` redirects, or read `settings` before navigating. | Observed; cause suspected |
| V1-02 | Integrations (any page with no composer) | P2 | visual | With one approval toast pending, the main column pads the bottom by 202 px (`--toast-page-reserve`), but the card is about 97 px tall and floats 97 px above the window edge. The content scroller ends at y=698 and an empty band of about 100 px sits under the toast, so about 22% of the page height is lost on a tool surface (L1, L3, D2). | light-integ3.png; measured: scroller 56+642, parent `main` padding-bottom 202px, toast card y 706-803 | `packages/ui-web/src/components/ui/notification-toaster.tsx:208-211` computes `window.innerHeight - viewport.top + GAP` from the toast viewport, not the card | Reserve only the card height plus its offset, or anchor the card 16 px from the bottom so the reserve matches. | Observed (measured) |
| V1-03 | Settings General | P2 | visual | Expanding "Chat display" reflows the page: the Language and time zone card jumps from the left column to the top of the right column, and Notifications, Usage and Account move down. Layout shifts under the pointer (L5). | settings-1440.png vs settings-chatdisplay.png | `apps/web/src/pages/AccountSettingsOverlay.tsx:157` uses CSS `columns-2` (balanced columns reflow when a card grows) | Use two explicit columns (left: Appearance, Chat display, Language; right: Notifications, Usage, Account) or a grid with fixed placement. | Observed; cause read from code |
| V1-04 | Phone drawer | P2 | flow | In the drawer with touch sizing (46 px rows) the nine Pages take about 60% of the height, so the bot list shows one chat and "+12 more". Tapping "+12 more" scrolls the Pages out of view. A phone user with 13 chats sees one (I5, D2). | touch-drawer.png, drawer-375.png, drawer-more-375.png | Sidebar list clamp in `apps/web/src/pages/Shell.tsx` (the "+N more" row) | Keep Pages compact (collapsed by default on phone) or let the drawer scroll as one list. | Observed |
| V1-05 | Chat on phone | P2 | visual | Every message on a phone gets its own row holding a lone "..." button, adding about 28 px per message, so the thread is roughly a fifth taller. Expected: the "..." sits inline with the timestamp or the bubble (D5). | touch-shell-375.png, touch-drawer.png | Message action row in `apps/web/src/pages/Shell.tsx` | Place the button in the bubble's top-right or the group timestamp line. | Observed |
| V1-06 | First-run tour, phone | P2 | flow | The tour is running at 375 but the drawer is closed, so nothing on screen explains the tour; the card exists only inside the drawer, below the account row. Opening the drawer focuses Search and shows its focus ring, which would raise the keyboard on a real phone (suspected). On desktop the card sits above Integrations. | tour-375.png (left: no tour visible, right: drawer with card below the account row) | `apps/web/src/components/tour/FirstRunTour.tsx`, `TourPopover.tsx` | On phone, open the drawer for the first stop or show the card as a bottom sheet; do not autofocus Search. | Observed; keyboard effect suspected |
| V1-07 | Tour card | P3 | visual | The card keeps a fixed 40 px text block, so single-line steps leave an empty band of about 40 px between the text and the buttons. The card is also about 600 px from the item it names at the top (Search); the fixed spot is the owner's decision, so only the empty band is reported. | tour-montage.png, firstrun-after-dismiss.png | `apps/web/src/components/tour/TourPopover.tsx:202` (`min-h-10`) | Use `min-h-5`, or size to the longest line of the two-line stops. | Observed |
| V1-08 | Models settings | P3 | visual | "Connect API key" is a secondary button that is disabled, but it renders as bright bold text with no fill, so it reads as enabled while "Test API key" beside it reads as disabled. The Voice tab's "Connect ElevenLabs" uses a grey filled style instead (H5, I8). | settings-own-model.png, settings-voice.png | `apps/web/src/pages/ModelSettingsOverlay.tsx:1158-1176` | Give disabled secondary buttons one dimmed treatment; align the two Connect buttons. | Observed |
| V1-09 | Settings Memory | P3 | copy | "Outside memory service" is jargon for a first-time founder (C1). | settings-memory.png | `apps/web/src/pages/MemorySettingsOverlay.tsx:232` | Rename to a plain phrase after the owner approves the copy. | Observed |
| V1-10 | Settings General | P3 | visual | The notifications card has no heading while Appearance, Usage and Account do; the "Browser notifications" label sits alone in a card (H5). The Delete account form's "Current password" label touches its input (other labels have about 8 px). | settings-1440.png, settings-delete.png | `apps/web/src/pages/AccountSettingsOverlay.tsx` | Add a heading or merge with Language; add the standard label gap. | Observed |
| V1-11 | Switches | P3 | a11y | Off-state switch tracks are dark grey on the dark card (about 1.5:1, estimated from the image), so the boundary is weak; the thumb carries the state. Rows are 44 px tall under touch (checked), so the target is fine. | switch-zoom.png | switch component in `packages/ui-web` | Raise the off-track border contrast to 3:1. | Observed (contrast not computed) |
| V1-12 | Landing | P3 | visual | The "Sign up" and "Sign in" pair sits about 17 px left of the headline's center at both 1440 and 375, because the ghost "Sign in" has invisible padding. | signin-1440.png, auth-375.png | Landing component in `apps/web/src` | Center the group on the visible edges or give "Sign in" symmetric padding. | Observed |
| V1-13 | Reset password, phone | P3 | visual | The heading wraps to two lines at 375 and the gap between the email field and "Send reset link" is 74 px (54 px on sign-up). Logo-to-heading spacing also differs between pages. | auth-375.png | Auth page layout | Smaller heading or no reserved message line; one shared auth spacing. | Observed |
| V1-14 | Sidebar | P3 | visual | The space header ("NORTHWIND ROBOTICS") is partly covered by the top fade of the chat list when the list is scrolled by a few pixels. | menu-space.png, light-integ3.png | `rk-scroll-fade-top` on the chat list | Start the fade below the sticky header. | Observed |
| V1-15 | Integrations | P3 | visual | Connected cards place the action button above "Used by", while Popular cards place it at the bottom; Carta's icon tile is dark while the others are white; only Blockscout and Coinbase show a "..." menu, so a user cannot see how to disconnect Gmail, Carta, Mercury or Brex (H5, I6). Whether those four have a disconnect path elsewhere was not checked. | integ-1440.png | Integrations card component | One card layout, one icon tile style, the same menu on every connected card. | Observed |
| V1-16 | Connect dialog | P3 | a11y | The Kraken dialog labels its fields only with placeholders ("API key", "Private key"); the labels vanish once typed. Accessible names exist. | integ-kraken.png | Connect dialog component | Add visible labels. | Observed |
| V1-17 | Phone chat | P3 | a11y | Inline chat links ("Open Finance", "MOCK Q3 Board Deck") measure 100x21 and 160x21 under pointer: coarse (I4, 44 px touch norm). | touch-shell-375.png; measured with CDP touch emulation | `.rk-chat-app-link` styles | Add vertical padding or a 44 px hit area under `@media (pointer: coarse)`. | Observed (measured) |

Not defects (audit noise): the contrast audit's 1.2-1.3 ratios on the sidebar labels and the skip link come from transparent backgrounds in the script; the rendered text is legible. The "wrapped control" on the sign-in button is a false positive.

## Excellent as is

- Landing, sign-in and sign-up: one primary action, plain labels, inline per-field errors in words, values kept after an error, show-password toggle, a hint that stays visible ("At least 8 characters").
- App shell: one screen at 1280x800, 1440x900 and 1920x1080 with no page scroll (pageScrollY 0); the chat and panels scroll inside.
- The phone drawer sizes rows to 46 px under touch; Integrations buttons are 44 px; Settings becomes a full-height sheet with a section select.
- Pages menu, Create menu, account menu, space menu and bot menu: short, labelled, destructive item last and red, Escape returns focus to the trigger.
- Cmd+K palette: pages first, Integrations and Settings listed, key hints at the foot.
- Bot settings panel: Name, Description, Notifications ("Off in Settings"), Audience, Skills, Advanced in one compact column.
- First-question card for a fresh user: three clear choices, one dismiss.
- Settings Privacy and approvals: one switch per area with a sentence saying what is sent.
- Light theme: same hierarchy and good contrast.
- The approval toast on phones sits above the composer and does not push the layout.

## BLOCKED / not covered

- OAuth connect flows (Google, Slack, Notion, GitHub, Linear, "Sign in with OpenRouter"): not attempted.
- Onboarding "model" and "Connect your apps" screens: `/onboarding` redirects a signed-up user straight to the app on this stack, so there was no separate screen to inspect; model choice lives in Settings and app connection in Integrations.
- Settings Privacy, Models and Memory at 375 were not individually captured; the sheet and section select were checked on General only.
- 200% zoom and `prefers-reduced-motion` were not tested.
- Tab order was sampled on Integrations only (focus rings present on every stop); a full order check on the shell was not completed because the first stop depended on prior focus.
