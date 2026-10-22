# Visual inspection V1 (iteration 15)

Group V1: sign-in, sign-up, first-run tour, app shell and sidebar, Settings, Integrations, bot settings panel.
Target: mock-data demo stack (web 5381, API 3308). Signed in as the mock founder for the shell, Settings, Integrations and bot panel; a fresh invented user (walker-v1-N@northwind.example.test) for sign-up and the tour. Screenshots are in /tmp/uxloop15/V1/ (outside the repo).

Method: layout-audit.js and geometry-audit.js at 1440x900, 1920x1080 and 375x812; keyboard Tab order; menus and dialogs; axe via `agent-browser a11y`. Touch targets were measured with CDP touch emulation (`pointer: coarse` true, 375x812), as required.

## Not walked

- Onboarding "Connect a model" and "Connect your apps": not reachable on this demo. The server has a default model and no integration needs setup, so a fresh sign-up lands directly in Chief (`/onboarding` redirects to the bot). Code read only (`ConnectAppsStep.tsx`); no visual verdict.
- Connect/OAuth flows (Slack, Notion, etc.): BLOCKED by instruction (real providers).
- "Clear conversation" confirmation: not clicked (shared mock bot); the code sets a clear target, so a confirm is likely, but unverified.
- Phone width of the tour was walked (see V1-02); the tour at 1920 was not.

## Verdicts

| Page | 1440x900 | 375x812 | 1920x1080 |
|---|---|---|---|
| Landing / sign-in / sign-up (+ error states) | Excellent | Excellent (V1-12) | n/a |
| First-run tour | Good (V1-03) | Needs work (V1-02) | not walked |
| App shell + sidebar + Pages/Create/account menus | Excellent (V1-13) | Excellent; touch targets all >= 44px | Excellent (chat column stays 900px, sidebar fixed 316px) |
| Settings: General, Privacy and approvals, Models, Memory | Good (V1-04, V1-05, V1-07) | Good (native select for sections, dialog scrolls inside, no horizontal scroll) | n/a |
| Integrations | Good (V1-08) | Good; touch targets all >= 44px | Good (5-column grid) |
| Bot settings panel | Good (V1-06) | Good (full screen, X to close) | Good |

L1 (one screen) holds everywhere: pageScrollY 0 on every surface at all three sizes, `scrollWidth` equals viewport width at 375, long content scrolls inside Settings, the sidebar list, the Integrations grid and the bot panel.

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|
| V1-01 | Chat transcript, Hide amounts on (STORY-APP Hide amounts) | P1 | bug | Observed. With "Hide amounts" on, the sentence above a result card shows "Cash is $•••", but the card under it shows "Cash -> $1,633,221" and "Monthly burn -> $67,621" in clear text. Expected: every money value masked. | /tmp/uxloop15/V1/money-1440.png; DOM text node `$1,633,221` found raw | apps/web/src/pages/shell/transcript.tsx:1756-1759 (`<span>{line.v}</span>` in the `block.kind === "card"` branch is not passed through `maskCurrencyWhenHidden`) | Render `line.v` with `maskCurrencyWhenHidden(line.v)` and call `useHideAmounts()` in that component. |
| V1-02 | First-run tour at phone width | P2 | flow / visual (L5) | Observed. At 375px the tour card sits at the bottom for steps 1-7 (covering the Integrations and account rows in the drawer), then jumps to the top for steps 8-9, covering Search, Create and the drawer Close button. Desktop keeps one fixed spot (good, per the Pass-13 decision); phone does not. | /tmp/uxloop15/V1/tour375-2.png, tour375-8.png, tour375-9.png | tour card placement in the sidebar tour component (not located) | Keep the phone card at one edge and size the drawer list so the highlighted row stays visible above it. |
| V1-03 | First-run tour, step 9 at 1440 | P3 | visual | Observed. The highlight ring around the account row is cut off by the left and bottom viewport edges, so the ring looks broken. | /tmp/uxloop15/V1/tour9-1440.png | tour highlight ring | Inset the ring for rows touching the viewport edge (use an inner ring). |
| V1-04 | Settings > Models | P3 | visual (H5, D2) | Observed. Content is two lines ("Your bots use OpenAI: GPT-6 Luna." plus one button) with no card, unlike General and Privacy where each group sits in a card; the rest of the 760px dialog is empty. | /tmp/uxloop15/V1/settings-models-1440.png | Models section in the Settings dialog | Wrap in the same card as the other sections (heading "Model", line, button). |
| V1-05 | Settings > General | P2 | visual (H2, H5) | Observed. Inside the Account card, row labels "Export my data" and "Change password" use the same size and weight as card titles ("Appearance", "Usage"), and the card's own title "Account" sits inline beside the name instead of above like the others. Hierarchy between card title and row is lost. | /tmp/uxloop15/V1/settings-general-1440.png | General settings account card | Stack "Account" as a card title like the other cards and render row labels at body weight (not semibold). |
| V1-06 | Bot settings panel, scrolled | P2 | visual (L5) | Observed. The panel header ("Chief settings") has no background or divider; scrolled content passes behind it and collides with the title ("Skills / Add skill" cut under it). | /tmp/uxloop15/V1/bot-adv2-1440.png | apps/web/src/pages/shell/bot-panel.tsx (absolute header over the scroller) | Give the header the panel background and a bottom border once scrolled. |
| V1-07 | Bot settings panel > Advanced open | P3 | visual (H2) | Observed. Opened Advanced shows eight controls (Workspace, Open work, Model, Thinking, Read replies aloud, Disabled tools, Credentials) with the same heading weight as top-level sections (Skills, Notifications) and no indent or divider, while the "Advanced" label itself is lighter. | /tmp/uxloop15/V1/bot-adv-1440.png | bot-panel.tsx `<details>` Advanced block | Indent or separate the advanced group, or make its summary the same weight as other section titles. |
| V1-08 | Integrations | P3 | visual (H5, I1) | Observed. Some apps use real logos while Carta, Treg, Devin, Granola, Wispr Flow and both iMessage entries use letter tiles ("C", "T", "D", "G", "W", "P", "M"); the "..." menu shows on Blockscout and Coinbase only (probably custom connections) with nothing hinting why; the scrolling grid is hard-clipped under the title with no divider. | /tmp/uxloop15/V1/integ-1440.png, integ-bottom-1440.png | IntegrationsHome.tsx cards | Use one placeholder style (initial in the same tile) and a divider under the sticky title. Letter tiles are likely a missing-logo fallback, so mark as suspected. |
| V1-09 | Settings > Privacy and approvals, while loading | P2 | bug (I8) | Observed. While rules load, "Ask before sending external email" and "Ask before purchases" render OFF and the data-sharing card has an empty hole, then flip to ON after about 2 s. For safety switches, a false "off" is misleading. | /tmp/uxloop15/V1/settings-privacy2-1440.png (loading), settings-privacy3-1440.png (loaded) | Privacy section in Settings | Show a skeleton or disabled switches until the server value is known. |
| V1-10 | Chat, `/app` first load at 375 | P2 | perf / bug | Observed once. After a reload at 375 the page stayed on "Opening Praci..." and then "Still opening... / Try again" for about 10 s although the API answered /health in 1.5 ms (other walkers were active). "Try again" recovered. Cause unknown (suspected contention from parallel walkers, not confirmed). | /tmp/uxloop15/V1/bot-375.png, bot-375a.png | app bootstrap (not located) | Re-check once the stack is idle; if it reproduces, log which request stalls. |
| V1-11 | Chat composer, bot panel | P3 | a11y | Observed (axe). The composer textarea carries `role=combobox`, which is not allowed on a textarea (aria-allowed-role, minor). Also axe flags the bot panel's "Get notified when this bot finishes or needs input" text for color-contrast (serious; ratio not measured because the element was transient). | axe output in session | composer textarea; bot-panel.tsx Notifications description | Use a valid role or `aria-haspopup` on the textarea; raise the muted description color. |
| V1-12 | Sign-in / sign-up | P3 | a11y / visual | Observed. No `<main>` landmark (axe landmark-one-main, region). At 375 the h1 "Create your account" fills the full 327px width, so a longer localized title would wrap. Error text is 12px red. | /tmp/uxloop15/V1/signup-375.png, signup-err-1440.png | auth page layout | Wrap the form in `<main>`; allow `text-balance` on the h1. |
| V1-13 | Whole shell (type and spacing scale) | P3 | visual (H3, D3) | Observed (layout-audit). 8 distinct font sizes (11, 12, 13, 14, 15, 16, 21, 24 px) with 13/14/15 side by side, and off-scale spacing values 6, 9, 10, 11, 14, 18, 22. The screens look consistent, so this is polish. | layout-audit output at 1440 | sidebar and Settings classes (`text-[13.5px]`, `text-[14.5px]`) | Collapse to two or three body sizes from the scale. |
| V1-14 | Cmd+K palette footer | P3 | visual | Observed. "Enter" is shown as an icon while "Esc" is bare text with no key styling. | /tmp/uxloop15/V1/palette-1440.png | palette footer | Show both as key caps. |

Contrast note: layout-audit reports ratios of about 1.2-1.4 for nearly all dark-theme text. This is the tool resolving a transparent background, not a defect; the screenshots show strong contrast, and axe found only the one item in V1-11.

## Excellent as is

- Landing, sign-in and sign-up: one focal action, inline per-field validation that keeps what was typed ("Enter your name", "Enter a valid email", "At least 8 characters."), show-password control, correct tab order, clean at 375.
- Sidebar: fixed Pages group above a scrolling spaces list, badges with distinct meaning (unread, failed files, overdue Legal), "Needs your answer" and "Working..." status in words, Search opening the single palette, Tab order starts at Activity and walks the sidebar logically with a skip link first.
- Tour on desktop: nine stops, card stays in one spot (y=742) at every step, ring on the item it names, "Skip tour" and "Next" 28px high (desktop).
- Account menu, Pages menu and Create menu: icons, checkmarks, a separate Log out, nothing duplicated.
- Settings dialog: fixed height with inner scroll, phone version swaps the section list for a native select and fits without horizontal scroll; Light theme renders well; Advanced holds only Memory per the owner decision.
- Touch targets under `pointer: coarse` at 375: every button, link and field on Chief and Integrations is >= 44px (only an inline text link in a message is smaller).
- Integrations: clear Connected / Popular / Finance / Social / Tools / Chat / Anything else sections, "Open Inbox/Finance" next to connected apps, "Used by" avatars, responsive 1/3/5 columns with no overflow.
- Chat on desktop and 1920: composer pinned, bubbles grouped, 900px reading column centered between sidebar and bot panel.
