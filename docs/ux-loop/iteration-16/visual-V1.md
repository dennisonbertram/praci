# Visual inspection V1 (iteration 16)

Group V1: sign-in, sign-up, onboarding, first-run tour, app shell and sidebar, Settings, Integrations, bot settings panel.
Target: mock-data demo stack (web 5381, API 3308). The mock founder was used for the shell, Settings, Integrations and bot panel. A fresh invented user (walker-v1-N@northwind.example.test, throwaway password) was used for sign-up, onboarding, the tour and the long-name test. Screenshots are in /tmp/uxloop16/V1/ (outside the repo).

Method: layout-audit.js and geometry-audit.js at 1440x900, 1920x1080, 1280x800 and 375x812; Tab and arrow-key order in the sidebar; menus, dialogs, long text.

## Not walked or unverified

- Touch targets: agent-browser device emulation did not turn on `pointer: coarse` (matchMedia returned false), so no touch-target finding is made. Code check only: the dropdown menu items carry `pointer-coarse:min-h-11` (packages/ui-web/src/components/ui/dropdown-menu.tsx:88).
- Onboarding "Connect a model" and "Connect your apps" screens: a fresh sign-up goes straight to Chief with the first-question card ("What do you want me on first?"); no model or connect step appears on this demo. No verdict beyond that card.
- Connect/OAuth (Gmail, Slack, etc.): BLOCKED by instruction.
- Clear conversation confirmation: not clicked.
- Light theme only glanced at by forcing the class (not through Settings); no verdict.

## Verdicts

| Page | 1440x900 | 375x812 | 1920x1080 / 1280x800 |
|---|---|---|---|
| Landing, sign-in, sign-up, error states | Excellent | Excellent | n/a |
| First-run tour | Good (V1-03, V1-04) | Excellent (card now fixed at y=694 for steps 1-8) | not walked |
| Chief first-question card | Excellent | Excellent | n/a |
| App shell, sidebar, Pages and Create menus, account menu | Excellent | Excellent | 1920 excellent; 1280 with panel open is tight (V1-09) |
| Settings: General, Privacy and approvals, Models, Memory | Good (V1-01, V1-02) | Good | n/a |
| Integrations | Good (V1-05, V1-06) | Good | n/a |
| Bot settings panel | Good (V1-07, V1-08) | Good | Good at 1920; V1-09 at 1280 |

L1 holds everywhere: `pageScrollY` is 0 and `pageScrollX` is 0 on every surface at all four sizes; no horizontal overflow at 375; long content scrolls inside the sidebar list, the chat, Settings and the Integrations grid. `offscreenPrimary` is empty on every surface.

## Fixed since iteration 15 (observed)

- Hide amounts now masks the result card ("Cash -> $•••") as well as the sentence.
- Phone tour card keeps one spot for steps 1-8 and a taller card bottom-aligned at step 9; the drawer rows stay visible above it.
- Privacy and approvals no longer flashes OFF: both "Ask before" switches are ON at 0.4 s.
- General > Account is stacked like the other cards, with a card title and normal-weight row labels.
- Bot panel header has a divider and scrolled content is clipped cleanly under it.
- The `Chat display` link row and the Sidebar density/Avatars choices render as consistent cards.

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|
| V1-01 | Settings > Models | P3 | visual (H5, D2) | Observed. Content is one sentence ("Your bots use OpenAI: GPT-6 Luna.") and one button, with no card, while General and Privacy put each group in a card. About 85% of the 760px dialog is empty. | /tmp/uxloop16/V1/settings-models-1440.png | Models section in apps/web/src/pages/SettingsOverlay.tsx | Wrap in the same card with a "Model" title, or accept as is because it is a one-choice page. |
| V1-02 | Settings > Memory, Escape key | P2 | bug (I7) | Observed twice. With Memory selected, the first Escape does nothing (dialog stays open, focus stays on the nav item); a second Escape a few seconds later closes it. From General, one Escape closes it. Expected: Escape always closes unless a save is really in progress. | Repro: open Settings, expand Advanced, click Memory, wait 3 s, press Escape, dialog still open. | SettingsOverlay.tsx:231-237, `onOpenChange` cancels the close while `panelBusy` (`memoryBusy`) is true. Suspected: the Memory panel reports busy during its initial load and clears late. | Report busy only while a write is in flight, not during the initial read. |
| V1-03 | First-run tour, steps 1 and 9 at 1440 | P3 | visual | Observed. The highlight ring around Search (step 1) and the account row (step 9) is cut by the left and bottom viewport edges, and at step 9 it is wider (0-319 px) than the 316 px sidebar. | /tmp/uxloop16/V1/tour9-1440.png | tour highlight ring | Draw the ring inset for rows that touch the viewport or sidebar edge. |
| V1-04 | First-run tour, step 9 | P3 | visual (H6) | Observed. The card has no "Skip tour", so "9/9" sits at x=103 with an empty gap on its left instead of at the card edge. The button row (Back, Done) stays bottom-aligned, which is good. | /tmp/uxloop16/V1/tour9-1440.png, m-tour9-375.png | tour card footer | Left-align the counter when Skip tour is absent. |
| V1-05 | Integrations | P3 | visual (H5) | Observed (repeat of iteration 15). Carta, Treg, Devin, Granola, Wispr Flow and both iMessage entries use gray letter tiles ("C", "T", "D", "G", "W", "P", "M") while other apps use real logos. Cards also differ in height: Coinbase has no "Used by" row so its card is shorter than neighbours. The scrolling grid is clipped hard under the title with no divider. | /tmp/uxloop16/V1/integ-1440.png, integ-bottom-1440.png | Integrations cards (IntegrationsHome) | Use one placeholder tile style and fix card height in a row; add a divider under the sticky title. Letter tiles look like a missing-logo fallback (suspected). |
| V1-06 | Integrations, loading state | P3 | visual (L5) | Observed. The loading skeleton shows five filter chips (All, Finance, Social, Equity, Tools) and a 3-column grid of 111 px cards; the loaded page for the mock founder has four chips (no Equity) and cards of different heights, so the chips change and the grid shifts. Per the owner decision the skeleton itself is expected. | /tmp/uxloop16/V1/integ-1440.png (first capture after click) vs the loaded capture | Integrations page skeleton | Build the skeleton from the same chip list, or show no chips until loaded. |
| V1-07 | Bot settings panel > Advanced open | P3 | visual (H2) | Observed (repeat). Opened Advanced shows Workspace, Open work, Model, Thinking, Read replies aloud, Disabled tools and Credentials with the same label weight as top-level sections (Notifications, Audience, Skills), directly under a lighter "Advanced" row with no indent or divider. | /tmp/uxloop16/V1/bot-adv-1440.png | bot-panel.tsx Advanced block | Indent the group or draw a divider so it reads as the contents of Advanced. |
| V1-08 | Bot settings panel with a long bot name | P3 | visual (L5) | Observed. With an 80-character name the panel title wraps to two lines ("...Operations Team (EMEA, APAC a settings"), the header grows by 13 px and the avatar, Name and Description move down at the moment the "Saved" tag appears. Expected: a fixed header height. | /tmp/uxloop16/V1/longtext-1440.png | bot-panel.tsx header | Keep the title to one line with `truncate` and a `title` attribute. |
| V1-09 | Chat plus bot panel at 1280x800 | P3 | visual (L7) | Observed. With the bot panel open, the chat column is 524 px wide (41%), narrower than the sidebar and panel together (700 px). A persistent "needs an answer" toast covers one whole user bubble. Pass-9 puts toasts bottom-right until dismissed, so only the width is new. | /tmp/uxloop16/V1/shell-1280.png | shell layout (sidebar 316 + panel 384 fixed) | Let the panel overlay the chat below about 1400 px, or narrow it to 320 px. |
| V1-10 | Settings > Privacy and approvals | P3 | flow (I1) | Observed. "Per model and documents" is the only way to reach per-model consent and looks like a gray caption (no underline, small chevron). A founder scanning for a Documents consent line may miss it. Suspected, not user-tested. | /tmp/uxloop16/V1/settings-privacy-1440.png | Privacy section | Give it link or button styling at normal text size. |
| V1-11 | Settings > General | P3 | visual (H5) | Observed. The Language select (native) and Time zone select (custom button) have different chevron weights and the Time zone control is a few px wider in the chevron gap. | /tmp/uxloop16/V1/settings-general-1440.png | General section selects | Use the same select component for both. |
| V1-12 | Whole shell (type and spacing scale) | P3 | visual (H3, D3) | Observed (layout-audit). Eight font sizes (11, 12, 13, 14, 15, 16, 21, 24 px) with 13/14/15 side by side; off-scale spacing 6, 9, 10, 11, 14, 18, 22. Screens look consistent, so this is polish. | layout-audit output at 1440x900 | sidebar and Settings classes | Collapse to two or three body sizes from the scale. |

Contrast note: layout-audit reports ratios of about 1.2-1.4 for nearly all dark text. This is the tool resolving a transparent background, not a defect; the screenshots show strong contrast. No axe run this pass.

## Excellent as is

- Landing, sign-in and sign-up: one focal action, inline per-field errors that keep typed values ("Enter your name", "Enter a valid email", "At least 8 characters.", "Invalid email or password"), show-password control, clean at 375.
- Chief first-question card: three plain choices with one-line explanations, dismiss button named "Dismiss", and the tour begins when it is dismissed.
- Tour: nine stops; desktop card fixed at y=680 and phone card fixed at y=694, each naming the item it explains and ringed on that item.
- Sidebar: fixed Pages group above a scrolling spaces list, words plus color for status ("Needs your answer", "Working...", "Waiting for the model..."), badges with distinct meaning, one Search opening the palette, roving arrow-key navigation through pages and chats.
- Pages menu, Create menu, account menu: icons, checkmarks, a separate Log out, nothing duplicated.
- Settings dialog: fixed height with inner scroll, phone swaps the nav for a select with the four sections, no horizontal scroll, "Advanced" is a native details element so it works by keyboard.
- Integrations: clear Connected / Popular / category sections, "Open Inbox/Finance" beside connected apps, "Used by" avatars, one-column phone layout with "Show more".
- Bot panel: Audience Internal/External segmented control, Model picker labelled "System model", 80-character name limit enforced.
- Shell at 1920 and 1440: composer pinned, 900 px chat column centered, sidebar fixed at 316 px.
