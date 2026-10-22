# Visual inspection V1 (iteration 18)

Session uxl18-V1. Target: mock-data demo stack (web 5381). Screenshots in /tmp/uxloop18/V1/. Touch targets were measured with touch emulation (pointer: coarse, 375x812) held open through a CDP connection. Not walked: real OAuth connects (BLOCKED: Gmail/Calendar Connect cards in the first-run chat, Integrations Connect buttons).

Environment notes (not findings): other walkers share the stack, so Inbox/Data room counts, extra bots ("J3 walker", "New Bot") and a second space named "Reconnect needed" appeared during the walk. I could not tell whether that space name is seed data or created by another walker, so I did not count it.

## Verdicts

| Page | 1440x900 | 375x812 (touch) | Notes |
|---|---|---|---|
| Landing | Excellent | Excellent | Clean, one primary action. |
| Sign in / forgot password | Excellent | Excellent | Targets 44 px+, inline error, no overflow. |
| Sign up | Excellent | not walked separately (fresh user created at 375 and 1440) | Per-field errors appear together and name the fix. |
| First run (Chief greeting, first-question card, inline Connect cards) | Good | Good | Flow is clear. Connect itself BLOCKED. |
| First-run tour (9 stops) | Good | Good (buttons 44 px) | Fixed card spot works. On phone the card covers the chat list (V1-12). |
| App shell + sidebar (1440, 1920) | Good | Good | Fits one screen; only the chat list scrolls. Pages menu fine. Minor items below. |
| Settings (General, Privacy, Models, Memory) | Good | Good, one loading problem (V1-01) | Models tab has inconsistencies (V1-05, V1-06). |
| Integrations | Good | Good, small name targets (V1-02) | Placeholder icons and a repeated Connected pill (V1-03, V1-04). |
| Bot settings panel | Good | Good | Loading shift, clipped header, one odd select (V1-07..V1-10). |

## Findings

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Suspected code | Proposed fix |
|---|---|---|---|---|---|---|---|
| V1-01 | Settings > Privacy and approvals (observed at 375, 0.9 s after opening) | P2 | visual | The "AI data sharing" card shows an empty 80 px hole where the "Allow AI models" switch and the "Per model and documents" link belong. About 2 s later they pop in and the "Action confirmations" card jumps down about 60 px. Expected a visible placeholder or no shift (L5, I8). The code does render a `Skeleton` there, so the skeleton appears invisible on the card background (suspected). | m-set-Priv.png (blank) vs m-set-Priv2.png (loaded) | apps/web/src/components/AiDataSharing.tsx:346-347 | Give the skeleton a visible fill on card backgrounds, and reserve the height of the link row too. |
| V1-02 | Integrations, Connected cards (observed, coarse pointer) | P2 | a11y | The card name buttons (Gmail 133x24, Carta 167x24, Mercury 176x24, Brex 168x24, Blockscout 151x24) are 24 px tall on touch. Norm I4 asks for 44 px. | measured by eval at 375 with pointer: coarse | apps/web/src/components/integrations/IntegrationsHome.tsx (tile name button) | Make the whole tile, or a 44 px tall padded name area, the target on coarse pointers. |
| V1-03 | Integrations | P3 | visual | Several apps use a grey letter tile instead of a logo (Carta "C", Treg "T", Devin "D", Granola "G", Wispr Flow "W", iMessage "P" and "M"), next to full-colour logos. Looks unfinished (H5). | integ-1440.png, integ-bottom-1440.png | integration icon map | Ship logos for these, or use one consistent neutral glyph for all letter fallbacks. |
| V1-04 | Integrations, Connected section (observed) | P3 | copy | Every card under the "CONNECTED" heading also carries a green "Connected" pill. The same fact is shown twice (C2). The pill is the card's biggest colour accent. | integ-1440.png, m-integ2.png | apps/web/src/components/integrations/IntegrationsHome.tsx | Drop the pill inside the Connected section; keep status pills only where state differs (for example "Reconnect needed"). |
| V1-05 | Settings > Models > own model (observed) | P3 | visual | Three different disclosure markers on one panel: a down chevron ("Use your own key"), the browser's native triangle ("Model options"), a right chevron ("Data room search model") (H5). | settings-ownmodel-1440.png | apps/web/src/pages/ModelSettingsOverlay.tsx:1585 and neighbours | Use the shared chevron disclosure for all three. |
| V1-06 | Settings > Models > own model (observed) | P3 | flow | The provider list has no selected row. OpenRouter says "Included" while the text above says bots use OpenAI: GPT-6 Luna, so it is unclear which provider is active (C3). | settings-ownmodel-1440.png | apps/web/src/pages/ModelSettingsOverlay.tsx | Mark the provider of the active model as selected. |
| V1-07 | Bot settings panel (observed) | P3 | visual | The Skills section first shows an empty box, then swaps to "Built-in skills (11)", then a bot skill row appears later, moving "Advanced / Export / Clear conversation" down (L5). | bot-1440.png vs bot-adv-1440.png vs create-1440.png | apps/web/src/pages/shell/BotSkillsSection.tsx | Show a skeleton row of final height until skills load. |
| V1-08 | Bot settings panel, scrolled (observed) | P3 | visual | Scrolled content is cut mid-line under the sticky "Chief settings" header with no separator or fade ("Skills / Add skill" half visible). The Integrations list does the same under its title row. | bot-adv2-1440.png, integ-bottom-1440.png | apps/web/src/pages/shell/bot-panel.tsx (sticky header) | Add a bottom border or a short fade on the sticky header when scrolled. |
| V1-09 | Bot settings > Advanced (observed) | P3 | copy | "Disabled tools" has a select whose label is the action "Turn off a tool". A select should show a noun or a neutral prompt such as "Add a tool to turn off"; as written it reads like a button. | bot-adv2-1440.png | apps/web/src/pages/shell/bot-panel.tsx:800 | Rename the placeholder to "Choose a tool". |
| V1-10 | Sidebar Create (+) menu (observed) | P3 | visual | "New bot" is a taller row followed by a divider; "New group" and "New space" are shorter and tighter. Mixed row heights in one 3-item menu (H5, D3). | create-1440.png | apps/web/src/pages/shell/bot-picker.tsx:60-100 | Use one row height and drop the divider, or give both groups equal padding. |
| V1-11 | Settings > Memory (observed) | P3 | visual | Memory content is bare text with no card, unlike the carded General, Privacy and Models sections (H5). | settings-memory-1440.png | memory settings component | Wrap the Memory content in the same card. |
| V1-12 | Mobile drawer and tour (observed) | P3 | flow | At 812 px the nine Pages rows leave only about two chat rows visible in the drawer. During the tour the card sits over those rows and leaves a half-clipped sliver. | m-drawer.png, m-tour1.png | sidebar drawer layout | Optional: cap Pages height on phones or let the tour card sit below the drawer list. |
| V1-13 | Integrations and chips, keyboard focus (observed) | P3 | a11y | Focus ring on chips and tile buttons is 1 px grey-translucent, while sidebar controls get a 2 px solid ring. Visible but weak and inconsistent (I7, H5). | focus-crop.png | shared Button focus style | Use the sidebar's 2 px ring everywhere. |
| V1-14 | Settings > General > Usage (observed) | P3 | copy | "33,071 tokens of AI text" uses a term a first-time founder may not know (C1). | settings-1440.png | apps/web/src/pages/AccountSettingsOverlay.tsx:402 | Say "33,071 words" style units, or drop tokens and show only tasks. |

## Excellent as is

- Landing, sign-in, sign-up and forgot-password: one primary action, clear errors for each field ("Enter your name", "Enter a valid email"), 44 px targets on touch, no overflow at 375.
- Sidebar keyboard model: one roving tab stop with arrow keys crossing Pages and chats; closed phone drawer is inert and unreachable by Tab.
- App shell fits one screen at 1440x900 and 1920x1080; only the chat list and chat body scroll inside their panels.
- Settings dialog: General, Privacy and approvals, Models and Memory fit; phone version swaps the nav for a native select with a 44 px close button. All rows and switches work by tapping the label.
- First-run flow: first-question card to inline Gmail/Calendar Connect cards inside the chat is the right shortest path.
- Tour: fixed card spot, names the item it explains, 44 px buttons on phone, ring on the target.
- Account menu and Pages menu: short, labelled, with a clear checked state.
