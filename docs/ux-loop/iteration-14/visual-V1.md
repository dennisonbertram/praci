# Visual inspection V1 (iteration 14)

Scope: sign-in, sign-up, first-run (fresh user), tour, app shell and sidebar, Settings, Integrations, bot settings panel. Mock-data demo stack only. Viewports 1440x900, 375x812 (390x844 device emulation once), 1920x1080 for the shell. Screenshots are in /tmp/uxloop14/V1/ (outside the repo).

Limits: agent-browser device emulation did not set `pointer: coarse` (measured false), so no touch-target findings are made. The demo account is shared with other walkers, so sidebar contents (New Bot, approval toast, a space named "Reconnect needed") changed during the walk and are not reported as defects. Audit "lowContrast 1.32" hits on sidebar text are false positives (transparent background) and were ignored.

## Verdicts

| Page | 1440 | 375 | Notes |
|---|---|---|---|
| Landing / Sign in / Sign up | Excellent | Excellent | Single column, one primary action, inline validation errors, no overflow. |
| First run (Chief + "What do you want me on first?") | Excellent | Good | Card then Connect cards; see V1-09. |
| Tour (desktop) | Good | Below (V1-04) | Fixed card per Pass-13 decision. |
| App shell + sidebar | Excellent | Good | 1920 also fine; page never scrolls, inner panels scroll. See V1-05. |
| Settings (General, Privacy, Models, Memory) | Good | Good | Mobile uses a section dropdown; Models tab is empty (V1-07). |
| Integrations | Good | Below (V1-03) | |
| Bot settings panel | Below (V1-01) | not walked | |

## Findings

| id | page | sev | cat | status | what happened vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|---|
| V1-01 | Bot settings > Advanced > Workspace | P1 | visual (H6, C4) | observed | "Shared with your other bots" is clipped on the left ("hared with your other bot") in the segmented control; the label needs 174px in a 166px button (`white-space: nowrap; text-overflow: clip`). Expected the full label. | /tmp/uxloop14/V1/botset-adv-1440.png; eval scrollWidth 174 vs clientWidth 166 | apps/web/src/pages/shell/bot-panel.tsx (near line 102, the Workspace toggle group) | Shorten to "All bots" / "Only this bot", or let the label wrap. |
| V1-02 | Bot settings > Workspace / Disabled tools | P3 | copy (C1) | observed | "Workspace" sits next to the space concept and "Disabled tools" is internal wording; a first-time founder has no hint what either changes. Audience (Internal/External) also has no one-line effect text. | botset-adv2-1440.png, newbot-1440.png | bot-panel.tsx | Rename "Workspace" to "Files and notes" or add a one-line hint; same for Audience. |
| V1-03 | Integrations at 375 | P2 | flow (C3) | observed | The connected Brex card shows no "Connected" chip on a phone, only "Open Finance"; desktop shows the green chip. Status must be legible at every width. Also the iMessage card says "Through a Photon project" (jargon). | integ-375.png vs integ-1440.png | apps/web/src/components/integrations (card status chip hidden at narrow width) | Keep the status chip on narrow cards; rephrase the iMessage subtitle. |
| V1-04 | Tour at 375 | P2 | visual (L3, I1) | observed | In the mobile drawer the tour card is anchored under each highlighted row, so it hides the rows below: step 3 (Inbox) covers Finance, Legal, Investors; step 4 (Finance) covers Legal, the next stop. The card also jumps each step, unlike the fixed spot decided in Pass 13. ~400px of empty drawer space is below. | tour-375-3.png, tour-375-4.png | apps/web/src/components/tour/TourPopover.tsx lines 184-190 (top placement when anchored in drawer) | On phones pin the card to the bottom of the drawer (same fixed spot as desktop). |
| V1-05 | Sidebar keyboard | P2 | a11y (I7, A2) | observed | Page rows (Inbox..Artifacts) have tabindex -1; Tab goes Page options -> first chat row, so the main navigation is reachable only with Arrow keys (ArrowDown from Page options works). No role or hint announces that. | eval tabIndex -1 on Inbox; focus trace | apps/web/src/components/SidebarPageLink.tsx (roving tabindex) | Expose the list with an explicit role (menu/listbox) and aria-label, or keep the first page row at tabindex 0. |
| V1-06 | Settings > Privacy > AI data sharing | P3 | copy (C1) | observed | Two different things are called "Advanced": the disclosure under "Allow AI models" (reveals GPT-6 Luna and Documents) and the left-nav group (Memory). The in-page one is low-contrast grey text with a small chevron. | set-privacy-adv-1440.png | Settings privacy section | Rename the in-page one "Per model and documents" or make it a stronger link. |
| V1-07 | Settings > Models (default) | P3 | visual (D2) | observed | Tab holds one sentence and one button; ~85% of the dialog is empty. After "Use my own model" the tab switches to a dense two-column layout and the provider column width changes between Model (310px) and Voice (280px), so content shifts. | set-models-1440.png, set-voice-1440.png | Settings models section | Accept the fixed height but align the provider column widths; optional: show "Use my own model" inline. |
| V1-08 | Settings > Models > own model | P2 | copy (C1, C2) | observed | OpenRouter row says "Included" while the same pane says "Uses your OpenRouter API key. Praci does not pay for model usage." The two statements contradict. "Your bots use OpenAI: GPT-6 Luna" repeats the Model dropdown value. The Advanced disclosure uses a native triangle while the rest of the app uses chevrons. | set-models-own-1440.png | Settings models section | Drop "Included" for BYOK-only state; remove the repeated sentence; use the shared chevron disclosure. |
| V1-09 | First run card | P3 | visual (H5) | observed | After choosing "Run my company" the card collapses to a one-row summary with a disabled-looking check (low contrast, looks greyed out) rather than a chosen state. Good flow otherwise. | onboard2-1440.png | first-question card component | Render the chosen row at normal contrast. |
| V1-10 | Tour copy | P3 | copy (C2) | observed | Step 8 reads "Integrations: See what bots can reach, and add more in Integrations." The name is repeated. | tour step 8 text | apps/web/src/components/tour/FirstRunTour.tsx | "Integrations: See what bots can reach and add more." |
| V1-11 | Sign-up | P3 | visual (L5) | observed | Submitting an empty form adds three error lines and the vertically centred form jumps up ~26px. | signup-empty-1440.png vs signup-1440.png | sign-up page | Reserve error line height or top-align the form. |
| V1-12 | Settings > General | P3 | visual (H5) | observed | Selected state differs by control: Theme and Sidebar density use a filled pill, Avatars uses an outlined card with a thick white ring that reads as focus. "Request export" is a button but "Change password" is a chevron row. | settings-1440.png | Settings general section | Use one selected style and one row pattern. |
| V1-13 | Chat at 375 | P3 | visual (L5) | observed (device emulation, no hover) | Under the first message the four message actions (react, reply, remember, more) show with no gap above the card below, and they are not collapsed to one "..." as decided in Pass 10. May only be the emulation (pointer reported fine). Not confirmed on real touch. | drawer-touch-375.png | chat message action bar | Verify on a real phone; if confirmed, collapse to "...". |
| V1-14 | Sidebar spaces | P3 | copy (C1) | suspected | A space is named "Reconnect needed" with a lock and Rename/Delete menu, which reads as a warning, not a space. Probably a name another walker or fixture set. | reconnect2-1440.png | n/a | Check the demo seed; no change if it is test data. |

No P0 found.

## Excellent as is

- Landing, sign-in, sign-up: calm, one primary action, visible labels, inline validation with plain messages, show-password control, 404 page with one clear action.
- First-run Chief card with lettered options, then Gmail and Calendar Connect cards in the same thread. Fits one screen at 1440 and 375.
- App shell: one-screen layout at 1440, 1920 and 375 (pageScrollY 0, no horizontal overflow); sidebar badges (unread, due soon, failed file); Pages menu with "Show in sidebar" checkboxes; Create menu (New bot, New group, New space); account menu with five clear items; Escape returns focus to the account button.
- Settings dialog: fixed height with inner scroll, section dropdown on phones, plain labels, red Delete account kept small.
- Integrations: search, category chips, status chips on desktop, consistent card grid.
- Bot settings: avatar, name, description, notifications and Audience control are clear; Clear conversation is visibly separate in red.
- Tour on desktop: fixed card, names the item, ring on target, Skip/Back/Next, 9 stops.
