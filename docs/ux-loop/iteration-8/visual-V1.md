# Visual inspection V1 (iteration 8)

Scope: sign-in, sign-up, onboarding (choice card, Connect your apps), first-run tour, app shell and sidebar (Pages menu, folders, search palette), Settings (all sections), Integrations, bot settings panel. Target: mock-data demo stack only. Screenshots are in /tmp/uxloop8/V1/ (outside the repo).

Method: agent-browser, 1440x900, 375x812 and (shell) 1920x1080, with layout-audit.js on each state, Tab-order and focus-ring checks, menus, dialogs, light and dark themes. Sign-up used the invented user walker-v1a/b@northwind.example.test; the seeded mock-founder was used for the busy shell.

Environment caveat: the demo stack went down for about 10 minutes mid-walk (all /rpc calls returned 502, Settings showed "Could not reach the server"), then came back with a reset database. The host load average was about 470 for the rest of the run, so slow loads and long skeleton states were not counted as findings.

Not verified: touch targets (agent-browser cannot emulate pointer: coarse; the iPhone device profile gives a mobile UA but coarse=false, so no touch finding is made; source shows the Switch component adds a pointer-coarse hit area in packages/ui-web/src/components/ui/switch.tsx:17), the secret request card and Provide secret dialog and held "Share with {name}?" cards (no demo path triggers them without a scripted model turn; BLOCKED), the OAuth connect popup (BLOCKED; the mock Connect on Mercury and Brex completes in place), the email agent panel (outside V1 pages).

## Verdicts

| Page | 1440x900 | 375x812 | Notes |
|---|---|---|---|
| Landing | Pass | not captured | Clear, one primary action. |
| Sign in | Pass (V1-09) | Pass | Tab order correct. |
| Sign up | Pass (V1-08) | Pass | pageScroll 0, no overflow. |
| Onboarding card and Connect your apps | Pass (V1-10) | Pass | Answered state is clear. |
| First-run tour | Pass with copy issues (V1-03, V1-04) | Pass with overlap (V1-04) | Nine stops, no message sent by the tour. |
| App shell and sidebar | Pass (V1-07) | Pass | pageScrollY 0 at all three sizes; inner panels scroll. |
| Search palette | Excellent | not captured | |
| Settings | Pass with issues (V1-01, V1-02, V1-05) | Pass | Section dropdown on mobile. |
| Integrations | Pass (V1-06) | Pass | |
| Bot settings | Pass (V1-11) | Pass | |

No page had page scroll or horizontal overflow at any tested size (layout-audit pageScrollY and pageScrollX were 0 everywhere).

## Findings

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Suspected location | Proposed fix |
|---|---|---|---|---|---|---|---|
| V1-01 | Settings > General | P2 | copy | Observed: two controls are both named "Advanced" with different content. The left nav group reveals Memory; the General pane disclosure holds Stream replies, Show tool activity, Load web images. Opening the pane disclosure also expands the nav group, so one label means two things and the two are linked (C1, H5). | set-adv2.png, set-Memory-1440.png | apps/web/src/pages/AccountSettingsOverlay.tsx:274-282 (details "advanced-settings"); apps/web/src/pages/SettingsOverlay.tsx:290 | Rename the pane disclosure to "Chat display" and keep nav "Advanced" for Memory only, or do not link their state. |
| V1-02 | Settings nav | P3 | visual | Observed: the selected nested item "Memory" has a pill about 98px wide, while selected top-level items span the full nav (about 183px) (H6, L4). | set-Memory-1440.png | apps/web/src/pages/SettingsOverlay.tsx near line 290 | Give the nested row the same full-width block as the others. |
| V1-03 | Tour stops 5 and 6 | P2 | copy | Observed: stop 5 spotlights Legal but the text ends "see who owns what in Investors"; stop 6 spotlights Data room but the text adds "Artifacts holds what bots make". The highlight and the sentence disagree, and Investors and Artifacts are never highlighted (C2, I6). | tour-5-1440.png, tour-6-1440.png (tourA.png, tourB.png) | apps/web/src/components/tour/FirstRunTour.tsx:53,58 | Keep each stop's text to its highlighted page; the nine-stop count is an owner decision, so fold the Investors and Artifacts mentions into the existing stops' wording only if they get their own anchor. |
| V1-04 | Tour at 375 and 1440 | P3 | visual | Observed: on mobile the popover covers rows below the highlighted one (stop 2 hides Inbox; stops 3 and 4 hide Legal, Investors and others). At 1440, stop 9 covers the left half of the composer. All transient. | tourM.png, tour-fresh-9.png | components/tour/FirstRunTour.tsx (placement) | Place the popover on the side of the anchor away from the list on narrow screens. |
| V1-05 | Settings > General | P3 | visual | Observed twice: the Notifications section appears after the first paint (after the browser permission check), pushing Account, Export and Delete account down by about 108px (L5). One run showed "Blocked. Allow notifications for this site in your browser settings." | set-1440.png vs set-adv-1440.png; lightm.png | components/NotificationSettings.tsx | Reserve the row (skeleton) or render it hidden-until-known without reflow. |
| V1-06 | Integrations | P3 | flow | Observed: filter chips (All, Email and calendar, Chat, Docs and files, Finance, Developer) do not match the section headings (Popular, Finance, Social, Equity, Tools, Anything else), so a chip choice does not map to what the user sees (H5, I6). | integ-1440.png | apps/web/src (Integrations page categories) | Use one category list for both chips and section headings. |
| V1-07 | Sidebar | P3 | visual | Observed: the spaces scroller cuts text hard at its top edge (a half-visible "EMPTY SPACE" label at y about 428) while the bottom edge has a fade (L4). Also the new folder label starts at x=40 while the "Chats" sub-heading starts at x=38 (alignment near miss). | integ-stuck.png, folder2-1440.png | components/SidebarPages.tsx, components/sidebar-folders/ | Add a matching top fade; align folder and sub-heading left edges. |
| V1-08 | Sign up | P3 | visual | Observed: the browser's native validation bubble ("Please lengthen this text to 8 characters or more (you are currently using 5 characters).") is unthemed, long, and covers the "At least 8 characters." hint. | signup-err-1440.png | sign-up form (native minLength validation) | Validate in the page and show the existing hint in the error color. |
| V1-09 | Sign in | P3 | visual | Observed: about 55px gap between "Forgot password?" and the Sign in button, versus 16-24px elsewhere in the form (D4). | signin2-1440.png | sign-in form | Tighten to the form's 24px rhythm. |
| V1-10 | Onboarding | P3 | flow | Observed: the tour popover opens in the same moment the Connect your apps cards appear, so two prompts compete (H1). Dismissable, so low impact. | onb2-1440.png | components/tour/FirstRunTour.tsx start condition | Start the tour after the first Connect card is acted on or dismissed, or after the next visit. |
| V1-11 | Bot settings | P3 | visual | Observed: Skills and Memory render as empty bordered boxes first, then become "Built-in skills (11)" and "Nothing remembered yet" about 12px lower (I8, L5). | bot-1440.png vs bot-adv-1440.png | bot settings panel loading state | Show a labeled loading line or a skeleton of the final height. |
| V1-12 | Chat run status | P3 | copy | Observed: a long run shows "Thinking 10m 44.0s" with tenths of a second ticking and no hint after minutes. The seeded Finance helper run may be a demo artifact and the host was overloaded, so treat as suspected for real use. | fh-1440.png, shell-1920.png | chat thinking indicator | After 60s show whole seconds and a short "Still working" note with Stop. |
| V1-13 | Palette vs sidebar | P3 | copy | Observed: the same Chief chat reads "10:59 PM" in the sidebar and "Oct 21" in the search palette (H5). | searchm.png, newfolder-1440.png | command palette result row | Use the same relative time format. |
| V1-14 | Sidebar folder menu | P3 | copy | Suspected: "Auto-group" in the space menu does not say what it groups (C1). | menus.png | sidebar space actions | Rename to "Group chats into folders". |

## Excellent as is

- Landing, sign-in and sign-up: single column, one primary action, labels above inputs, correct Tab order (email, password, show password, forgot, submit), 8-character hint present.
- Onboarding choice card: after choosing, it collapses to a one-line answered row and the next step appears with real Connect buttons.
- Search palette: opens from the sidebar box, groups Pages, Mail, Chats, shows keyboard hints, highlights the match.
- Pages menu ("Show in sidebar" checklist), inline folder rename with selected text, and the Create menu are compact and clear.
- New bot panel: starts with only Name; "More settings" reveals the rest. The Audience control states its consequence ("Talks to people outside your company. Private tools are turned off."), an "External" badge appears in the chat header, and the "Can message" switches default off. Saved state is announced.
- Clear conversation asks for confirmation and says what it removes.
- Per-agent Model picker reads "System model (OpenAI: GPT-6 Luna)".
- Settings on mobile switches to a section dropdown and keeps one scroll area; Privacy shows ON defaults for external email and purchases; the master "Allow AI models" switch is off until every model is allowed.
- Integrations: connected apps move into a "Connected" band with a status chip, an "Open Inbox/Finance/Investors" action and "Used by" avatars; on mobile sections collapse behind "Show more".
- Keyboard: visible focus rings on every stop checked; the Pages list uses one tab stop with arrow-key movement; the main content is reachable after the sidebar.
- Layout: no page scroll or horizontal overflow at 1440, 375 or 1920; at 1920 the chat column stays about 900px wide and centered; light theme renders cleanly with inverted selected segments.
