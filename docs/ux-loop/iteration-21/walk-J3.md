# Walk J3: phone-width (375x812) sweep

Walker session uxl21-J3, mock-data demo stack. Viewport 375x812 with touch emulation on (pointer: coarse and hover: none confirmed true by media query), so touch-target numbers are valid. Signed in as the seeded mock founder.

## Stories

| Story | Verdict | Steps (actual / ideal) | Note |
|---|---|---|---|
| Phone sign-in | PASS | 5 / 4 (open, Sign in, email, password, submit) | Lands in Chief. No overflow, 44 px targets, tap-friendly form. |
| Sidebar drawer | PASS | 1 / 1 | All rows 44 px high; Settings, Integrations, Hide amounts, tour, Log out in the account menu. |
| Inbox triage | PASS | 3 / 3 (open row, Archive, see Undo toast) | Archive returns to the list with an Undo toast. All row, checkbox and More targets 44x44. |
| Finance overview | PASS with finding J3-01 | 1 / 1 | Cards, period tabs and breakdown read well; no overflow. |
| Data room browse and preview | PASS | 2 / 2 (open page, tap row) | Preview opens as a card; Open, Download, Close, Full screen all 44 px. Mock PDF has no page preview (mock data). |
| Agent chat with an approval | PASS with finding J3-02 | 3 / 2 | Approval toast (full width, Dismiss 44x44) and the mail card (Edit, Send, Discard, More, 44 px) are good. I did not press Send: the card belongs to another walker's thread. |
| Settings | PASS | 3 / 3 (drawer, account, Settings) | Dialog scrolls, switch rows are 44 px labels around a 32x18 switch, the section picker is a native select. |

Every other-walker interaction avoided: I did not send, approve or discard anything on Chief or the Inbox agent. I created one bot ("J3 phone bot") to look at New bot on a phone.

## Measured

- Page horizontal overflow: 0 px on sign-in, Chief, Inbox, Finance, Data room, Settings, Privacy and the approval chat.
- Touch targets under 44 px in the viewport: none on any screen (Settings switches are 32x18 spans inside 265x44 labels; the "Per model and documents" disclosure is 187x44).
- Geometry-audit "wrappedControls" hits (Show more, tabs, Edit/Send) are single-line on screen; treated as false positives. The "overflowSpills 16 px" hits are the intentional -mx-4 sticky headers and full-bleed tables.
- Console: only vite debug lines, no errors.

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|
| J3-01 | Finance, Burn chart on Month | P2 | visual | Observed: the "Financing, Oct ↑ $250,000" label is cut in half at the top of the chart. Its second row sits at a negative y inside an overflow-hidden SVG (text top about 10 px above the SVG). Expected: the whole label visible, as on desktop. | q-chart.png; text top 304.5 vs svg top 314.5, svg overflow hidden | apps/web/src/components/finance/charts.tsx:722-745 (y = top - 12 - 14 * row) | Reserve top padding for the second label row, or force row 0 when the label would sit above the SVG. |
| J3-02 | Agent chat with an approval, phone | P1 | flow | Observed: I was in a bot's settings panel and tapped the "Inbox agent needs approval" toast. The app switched to the Inbox agent but still showed its settings panel full screen, so the approval card was hidden until I found the X. Expected: the toast lands on the card. The settings panel is carried between chats by design and covers the whole screen on a phone. | o2.png, p-approval.png, p2-approval.png | apps/web/src/pages/Shell.tsx:3900-3905 (carried "settings" panel) | When a toast or approval link opens a chat, or on screens below the docked breakpoint, close the carried settings panel. |
| J3-03 | New bot, phone | P3 | flow | Observed: New bot opens the bot's Settings panel full screen with only Name and "More settings"; to start chatting she must close it first. Expected on a phone: acceptable, but nothing says the chat is behind it. Observed only; not a confirmed defect. | o-newbot.png | apps/web/src/pages/Shell.tsx:3754-3763 | Optional: keep, since naming first was a decision; no change needed unless testing shows people stall. |

Not found / praise: sign-in screen is clean and large-tap; the drawer is clear and every row is 44 px; Inbox triage on a phone is excellent (one tap to open, labelled Reply/Archive/Ask agent buttons, Undo toast); Finance cards fit with no truncation; the approval card is complete and readable; Settings is not overwhelming.

Catalog note: catalog line 504 says Archive / Mark read show as icons only at phone width. On this build the email dialog shows labelled buttons (Reply, Archive, Ask agent, More). The catalog text may be out of date.

Unverified: sending or discarding on the phone approval card, notification switches with real browser notifications, anything needing a native device.
