# Visual inspection V1 (iteration 7)

Scope: sign-in, sign-up, onboarding (first chat), first-run tour, app shell and sidebar, Settings (all five sections), Integrations, bot settings panel, email agent panel.
Target: mock-data demo stack only. Viewports 1440x900, 375x812, shell also 1920x1080. Screenshots are in /tmp/uxloop7/V1/.

## Measurement caveats (read first)

- The host was overloaded during the run (load average about 300). Load-time numbers are not valid evidence. They are listed as observations only.
- agent-browser device emulation did not set `pointer: coarse` (matchMedia returned false after `set device`). Per the owner rule, no touch-target findings are filed. Desktop-pointer sizes are not used as evidence.
- The layout audit reports contrast ratio 1.32 for all sidebar text. This is an audit artifact (translucent backgrounds); the text is clearly legible in screenshots. Not filed.
- Not reachable on the demo: model onboarding step (a system model is configured), the Devin-style secret request card and Provide secret dialog, held "Share with {name}?" cards, and the "Reply with draft" button (the mock agent answers with plain text, so no mail_send card appears). Connect buttons were not pressed (OAuth). /integrations/connected opened outside a popup redirects to /app/integrations (fine).
- Chief's sidebar status was driven by another inspector on the shared stack ("Retrying: setup", "Thinking"). Not a finding.

## Verdicts

| Page | 1440 | 375 | 1920 | Verdict |
|---|---|---|---|---|
| Landing | clean | not run | n/a | Excellent |
| Sign in | clean, no overflow | clean, targets read well | n/a | Excellent (one 4px icon offset, V1-08) |
| Sign up | clean | clean | n/a | Excellent (V1-08) |
| First chat / onboarding | good | good | n/a | Good (V1-15) |
| First-run tour (9 stops) | good, tooltip hides target neighbours | tooltip detached from target | n/a | Needs work (V1-01, V1-02, V1-14) |
| App shell and sidebar | one screen, inner scroll only | drawer works, no overflow | chat column capped, calm | Good (V1-09, V1-10, V1-16) |
| Settings General | fits, content scrolls inside | select replaces tab list | n/a | Good (V1-04, V1-12, V1-17) |
| Settings Privacy and approvals | clean | not run | n/a | Good (V1-03) |
| Settings Models / Memory / Voice | loads, sparse | not run | n/a | Fair (V1-03, V1-11) |
| Integrations | good grid, one screen | descriptions truncated | n/a | Good (V1-05, V1-06, V1-07, V1-13) |
| Bot settings panel | good | not run | n/a | Good (V1-08b, V1-18) |
| Email agent panel | good | not run | n/a | Good, reply action unverified (V1-19) |

Layout audit results: `pageScrollY` is 0 and `pageScrollX` is 0 on every page and viewport (L1, L6 pass). No offscreen primary actions. No overlapping text, no horizontal overflow.

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| V1-01 | First-run tour, stop 5 | P2 | copy | Observed. Tooltip says "see who owns what in Cap table", but the sidebar item and page are named "Investors". The tooltip (anchored under Legal) also covers the Investors, Contacts and Data room rows, so the place it names is hidden. Norm C1 (one concept, one name), H5. | tour-5-1440.png | apps/web/src/components/tour/FirstRunTour.tsx:50 | Name the item as it appears ("Investors") and place the tooltip beside the nav, not over the rows below the target. |
| V1-02 | First-run tour at 375 | P2 | flow | Observed. On mobile the tooltip is a fixed card at the top or bottom of the viewport. At stop 9 it sits at the top while the highlighted account button is at the bottom; at stop 7 it covers the drawer's Search, close and + buttons. Norm P1/L7 (action near what it acts on). | tour375-7.png, tour375-9.png (tooltip y=16 vs target y~760) | apps/web/src/components/tour/FirstRunTour.tsx | Anchor the card to the nearest side of the target (above it for bottom targets, below for top targets). |
| V1-03 | Settings: Privacy, Models, Memory; bot panel | P2 | visual | Observed. Three disclosure styles: "Advanced" in AI data sharing is a bare `<summary>` with no marker or chevron (looks like a caption), Models and Memory use a small triangle, General and the bot panel use a chevron row. Norm I1, H5. | set-privacy-1440.png, set-models2-1440.png, set-memory-1440.png, set-general 1440 | apps/web/src/components/AiDataSharing.tsx:182 | Use one disclosure component (chevron row) everywhere. |
| V1-04 | Settings General | P3 | visual | Observed. Selected state differs: avatar choice uses a white outline ring, segmented controls use a filled white pill. Norm H5. | settings-1440.png | apps/web/src/pages (Settings General) | Use the filled pill for all single-choice controls, or the ring for all. |
| V1-05 | Integrations at 375 | P2 | visual | Observed. In the Connected list the descriptions truncate with an ellipsis ("Read balances and trans...", "Wallet balances an...", "Read exchange bal...") and there is no way to read the rest. The "Open Finance" buttons take about half the row. Norm C4. | integ-top-375.png | apps/web/src/components/integrations/IntegrationsHome.tsx (connected row) | Let the description wrap to two lines and shorten the button to "Open". |
| V1-06 | Integrations | P3 | visual | Observed. Nine cards use the same generic grid icon (Carta, Linear, Airtable, Treg, Devin, Granola, Wispr Flow, iMessage, iMessage on your Mac), so they cannot be told apart at a glance. Carta is a connected card. Norm H5/I6. | integ2-1440.png, integ-bottom-1440.png | apps/web/src/components/integrations/IntegrationsHome.tsx | Add brand marks, or a letter tile with the app's initial. |
| V1-07 | Integrations, Connected group | P3 | visual | Observed. Blockscout and Coinbase show a "..." menu, others do not; Coinbase has no "Used by" row; the "Open Finance" button x position moves (612 vs 930 vs 1281) between cards. Norm L4, H5. | integ2-1440.png | same file | Reserve the menu slot on every card and keep a fixed "Used by" row height. |
| V1-08 | Sign in / sign up | P3 | visual | Measured. Show-password icon centre is y=545, input centre is y=549 (4px high). The button is `inset-y-0 my-auto` inside a wrapper that likely includes the label. Norm H6. | signup-1440.png; eval: input 525-573, button 523-567 | apps/web/src/pages/Auth.tsx:277 | Position the button relative to the input box only (wrap the input, not the label). |
| V1-08b | Bot settings panel | P3 | visual | Measured. "Nothing remembered yet" starts at x=1087, while "None yet" above it and the labels start at x=1077 (10px indent). Norm H6. | bot-chief-adv2-1440.png | bot settings panel (Memory section) | Remove the extra left padding. |
| V1-09 | Create, Page options, account menus | P3 | visual | Observed (from screenshots, about). Row pitch differs: Create menu about 36-43px with a separator after "New bot", account menu about 33px, Page options 28px. Norm H5, D3. | create-1440.png, account-1440.png, pagesmenu-1440.png | menu components in Shell.tsx | Use one menu item height; keep "New bot" the same style as its siblings. |
| V1-10 | App shell keyboard focus | P3 | a11y | Measured via `getComputedStyle`. Focus is visible everywhere, but three styles are used: 2px solid outline (Chief row, Page agents), box-shadow ring (Actions for Chief, account button), and the browser default `outline: auto 1px` (Archived, Integrations). Norm I7, H5. | focus check output | sidebar row components | Use one focus-visible ring class on all sidebar controls. |
| V1-11 | Bot settings panel, Advanced | P3 | visual | Observed. Section labels use three weights: Name and Description are gray regular, Notifications, Skills, Computer, Model, Thinking are white bold, Open work and Memory are lighter. Norm H3, H5. | bot-chief-adv-1440.png | bot settings panel | One label style. |
| V1-12 | Settings General | P3 | visual | Measured. The content area is 683px high with 747px of content; "Delete account" is cut in half at the fold and no scrollbar shows. Fixed height is an owner decision; only the clipped button affordance is reported. Norm I1. | settings-1440.png; scroller 683/747 | Settings dialog body | Add a bottom fade (as the sidebar already has) or order the content so a whole row ends at the fold. |
| V1-13 | Settings Privacy, Advanced | P3 | copy | Observed. Expanding Advanced shows one switch named "GPT-6 Luna" with no description. A first-time founder cannot tell what it shares. Norm C1. | set-privacy-adv-1440.png | apps/web/src/components/AiDataSharing.tsx:190 | Show what the model is used for ("Used for contracts") under the name. |
| V1-14 | First-run tour, stop positions | P3 | visual | Measured. Tooltip x is 10, 17, 10, ..., 27 across stops while the highlight ring is at x=0-320 at stop 9 and touches the window edge. Norm L4. | tour-9-1440.png | FirstRunTour.tsx | Use one anchor x for all sidebar stops. |
| V1-15 | First chat | P3 | copy | Observed. "What do you want me on first?" reads as a missing word. | onb2-1440.png | Chief onboarding question text | "What should I start with?" |
| V1-16 | App shell / Integrations | P3 | visual | Observed. The first load shows a different skeleton (list rows) from the one the Integrations page then shows (cards), and the 3x2 card skeleton precedes the real grid. Load timing not measured (host overloaded). Norm L5. | connected-1440.png, integ-1440.png | boot skeleton in App.tsx | Use one skeleton shape per page. |
| V1-17 | Settings Memory | P3 | flow | Observed. The page promises "What your bots remember between chats" but shows only a collapsed "Advanced: connect an outside memory service" row; the rest is empty. Norm D2, C4. | set-memory-1440.png | Settings Memory section | Show a per-bot memory count, or move the page under Advanced. |
| V1-18 | Bot settings panel | P3 | copy | Observed. "Disabled tools" shows the raw identifier `web_search` in a monospace field; "Skills" shows an empty box, then "Built-in skills (11)" appears a moment later (small layout shift). Norm C1, L5. | bot-chief-adv-1440.png | bot settings panel | Show readable tool names; render the skills row with its final height. |
| V1-19 | Email agent panel | P3 | flow | Partly unverified. The agent's draft is plain text with no action under it. "Reply with draft" only renders when a mail_send card is pending (EmailAgentPanel.tsx:176), which the mock model does not produce, so it could not be observed. The hover "Reply" arrow in the panel replies in the chat, and the email toolbar also has "Reply"; same word, two meanings. Norm C1. | email-agent-new2-1440.png, email-agent-more-1440.png | apps/web/src/components/inbox/EmailAgentPanel.tsx:176 | Re-check with a real card; rename the chat action "Reply in chat" or hide it in this panel. |
| V1-20 | Sidebar footer vs account menu | P3 | flow | Observed. "Integrations" is both a sidebar footer button and an account-menu item. The owner decision covers the menu entry; the footer duplicate is unaddressed. Norm C2. | shell-1440.png, account-1440.png | Shell.tsx sidebar footer | Confirm the footer button is intended; if not, remove it. |
| V1-21 | Palette, sidebar status | P3 | visual | Observed. The palette's active row has a blue left bar, and "Working..." and "Needs your answer" are blue text, in an app documented as monochrome with status colours destructive, success, warning. Norm H4. | palette-1440.png, shell-1440.png | palette item styles | Use ink for the active row; use the warning colour for "Needs your answer". |
| V1-22 | Settings General | P3 | copy | Observed. The notifications switch is labelled only "Browser". | settings-1440.png | NotificationSettings.tsx:66 | "Browser notifications". |
| V1-23 | Cold boot (suspected) | P3 | perf | Suspected, load-confounded. Under the overloaded host `/app` stayed an empty dark page for 30s with no text. There was no loading indicator before the app script ran. Norm I2. | slowboot.png | apps/web/index.html | Put a static "Opening Praci..." line in the HTML shell. |

## Excellent as is

- Landing, sign-in and sign-up: one centred column, three fields, one high-emphasis button, labels above fields, Show password and Forgot password reachable, tab order name, email, password, show, submit, link, visible focus on each. No overflow at 375.
- Layout discipline: no page scroll and no horizontal scroll on any page at 1440, 1920 or 375. Long content (chat, Integrations, Settings) scrolls inside its panel.
- Sidebar: Pages list is compact, unread, due-soon and failed-file badges are small and in words for screen readers ("Inbox, 15 unread", "Data room, 1 file failed"); folders and the "Page agents" and "Email chats" rows collapse; the Pages menu is a clear "Show in sidebar" checklist.
- Settings Privacy and approvals: three action confirmations, two on by default, plain labels.
- Bot settings: Audience (Internal or External) is progressive. Choosing External reveals "Talks to people outside your company. Private tools are turned off." and a "Can message" list, so the consequence appears at the moment it matters. No Title field. Model picker reads "System model".
- First-run tour: nine stops, "n/9" counter, Skip tour on every stop, Back from stop 2, "Done" on the last.
- Integrations: Connected group first, each with "Open Inbox/Finance/Investors" and "Used by" bot avatars; category chips and search; "Add a custom connection" last.
- Email dialog: Reply is the one high-emphasis action; Archive, Ask agent and More are secondary; earlier messages collapse into one list. The email agent panel opens beside the message without losing it.
- Mobile: Settings turns the section list into a single select; the drawer sidebar keeps the same rows.
