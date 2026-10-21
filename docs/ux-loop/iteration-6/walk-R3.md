# Walk R3: verify pass-5 clusters C19 to C27

Target: mock-data demo stack (web :5381), Maya Chen (Mock), 1440x900 (1920x1080 for one Data room check), dark theme. Screenshots: /tmp/uxloop6/R3/. Console: no errors seen. Storybook smoke: 1573 of 1573 stories rendered cleanly (built from the worktree). Three walkers shared the demo user and the stack was slow (chat opens showed a skeleton for 8 to 15 s; /finance/runway once showed "Still opening... Try again"), so timings are not trusted.

Touch: the device emulation I tried reported `pointer: coarse` = false, so no touch-target or phone findings are made (invalid per owner rule). Phone layout of C22 (repeated heading) and C23 (selected row after archive on touch) is SKIPPED. OAuth not attempted.

## Verdicts

| Cluster | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| C19 Inbox agent with a failed account | PASS | 3 / 2 | Reply starts "I could not read Old mail, so this may be incomplete. No messages needing a reply today were listed. You can reconnect Old mail in Settings." No Reconnect button in the chat (text only). |
| C20 Composer after consent | PASS | 3 / 3 | Chip send opened the consent card, composer empty, arrow dim. A typed send while the ask is pending shows "Answer the pending ask first." and restores the draft (correct). Not reproduced. |
| C21 Sidebar | PARTIAL | n/a | Badges have names ("Inbox, 14 unread", "Legal, 1 due soon", "Data room, 1 file failed"): PASS. Pages options menu opens beside the list, rows stay visible: PASS. Chats are one roving group: 12 Tab presses to the page: PASS. But the Pages rows are not reachable by Tab at all (R3-01). A row is still half hidden under Integrations, with a fade (R3-06). |
| C22 Settings | PARTIAL | n/a | "Server apps" is now "Integration sign-in" but still shown to a non-admin. Browser notification switch still in Privacy and approvals. Models still has three folds (Data room search model, Advanced, Replace key). General scroller 683 vs 725 (42 px), confirms R1-05. Memory and Voice empty panel is the fixed-height decision: not a finding. |
| C23 Inbox menus, Digest | PARTIAL | n/a | Filter group now "Gmail tabs" with "Gmail Updates"; active filters show a check and a Clear row: PASS. Digest toggle sits on the tab row with an outline: PASS. Attachment name not cut: PASS. Digest still lists each message as a card (5 cards for 3 senders): FAIL (R3-04). Touch row highlight not tested. |
| C24 Data room polish | PASS | n/a | Menu reads Upload files, From email, From Box. At 1920 Parties shows full names and Name is capped. Stats bars have tooltips ("Dec 2025: 9") and aria-labels. Add files tooltip gone after the menu closes. Failed grid card shows Failed, reason, Try again. |
| C25 Finance polish | PARTIAL | n/a | Sub-pages are one header row. Breakdown and Upcoming cards same height. Runway no longer empty below. Chart labels do not touch. Stat card grids still differ (Accounts 2 wide cards, Burn 1 full-width card, Runway 4 cards) (R3-05). Content x is 344 on Finance and Data room, 356 on Inbox. |
| C26 Chat cards and seed | PARTIAL | n/a | Relayed text now shows as one "Messaged Finance agent" line: PASS. Consent and question cards both 576 px, bubbles 640 px (R3-07). Mail card width and "Alex" signature not verified (chat opens too slow). "MOCK DEMO DATA" row not rechecked. |
| C27 Bot panel, landing | PARTIAL | n/a | Landing mark now has an outline ring: PASS (contrast estimated, not measured). Bot panel footer is a list of text rows with red Clear last: improved. Right edges not within 2 px (chevron 1412 vs Add skill and switch 1419). Computer box and group-chat pill not checked. |
| New: email agent panel | PASS with one FAIL | 5 | More menu has Ask agent, side panel opens with "Email thread - 1 message". Answer says it cannot see the email and sends the user to Settings, AI data sharing (R3-02). |
| New: Audience setting | PASS with copy gap | n/a | Internal / External segmented control on a non-Chief bot, absent on Chief (R3-03). |
| Storybook smoke | PASS | n/a | 0 failing stories of 1573. |

## Findings

| id | page | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R3-01 | Sidebar, keyboard | P2 | a11y | Observed: Tab from Collapse Pages goes to Page options then Chief; the seven Pages rows have tabindex -1 and only ArrowDown from Page options reaches them. Expected one Pages row in the tab order. | Tab walk (12 stops), eval: Inbox/Finance/Legal/Cap table buttons tabIndex -1 | apps/web/src/components/SidebarPagesGroup.tsx (roving tabindex has no active item until focused) | Give the first (or current) page row tabindex 0. |
| R3-02 | Inbox email, Ask agent | P1 | flow | Observed: after Ask agent on an open email, the agent replies "I can't tell whether it needs a reply because the email wasn't shared with me. Please allow mail access in Settings -> AI data sharing". Other chats show an Allow card, and the user just chose this email. Expected the thread is shared by the action, or an Allow card appears in the panel. | e-answer.png, c19-d.png (consent card in other chat) | email agent panel in Inbox.tsx / Shell.tsx; consent gating | Treat Ask agent as sharing that thread, or show the same Allow card in the panel. |
| R3-03 | Bot settings, Audience | P2 | copy | Observed: Audience shows Internal / External with no hint what changes; buttons have aria-pressed but no group label. Expected a short reason revealed on selection. | c27-ir.png | apps/web/src/pages/shell/bot-panel.tsx | Add a group label and one line shown under the chosen option. |
| R3-04 | Inbox Digest | P3 | flow | Observed: Digest shows one card per message (5) for the same 3 senders listed in Newsletters, so it repeats the list. Acceptance asked for a one-line summary per sender. | c23-news.png, c23-digest.png | apps/web/src/pages/Inbox.tsx Digest view | Group by sender with one summary line each. |
| R3-05 | Finance sub-pages | P3 | visual | Observed: stat cards use a different grid on each sub-page (2 / 1 full-width / 4); content starts at x=344 on Finance and Data room, 356 on Inbox. | c25-acc.png, c25-burn.png, c25-runway.png | apps/web/src/pages/finance/*, PageHeader.tsx | One stat grid with a fixed column count; one page gutter. |
| R3-06 | Sidebar | P3 | visual | Observed: with the Northwind space open, the "Legal agent" row is cut in half by the Integrations row; only the fade hints at scroll. Suspected seed-dependent. | c19-open.png | apps/web/src/pages/Shell.tsx rk-scroll-fade-bottom | Stronger fade or snap scroll so no row is cut. |
| R3-07 | Chat cards | P3 | visual | Observed: consent and question cards 576 px, message bubbles 640 px. | eval widths on Investor Relations chat | shell chat card containers | Use the bubble max-width for cards. |
| R3-08 | Settings | P3 | copy | Observed: Browser notification switch still under Privacy and approvals; Models still has three folds; "Integration sign-in" card is shown to a non-admin; General scrolls 42 px. | c22-set1.png, c22-e162.png, c22-e163.png | SettingsOverlay.tsx, ApprovalRulesSettings.tsx, AccountSettingsOverlay.tsx:254 | Move the switch to General, merge folds, hide sign-in for non-admins, trim General height. |
| R3-09 | Inbox agent chat | P3 | copy | Observed: while the AI-sharing card waits for the user, the sidebar row first read "Working..." then "Needs your answer". Observed once. | c20-b.png, c19-f.png | Shell.tsx status line | Show "Needs your answer" as soon as the ask opens. |
| R3-10 | Chat and Finance load | P2 | perf | Observed: chat open stayed on skeleton for 8 to 15 s; Finance runway deep link showed "Still opening... Try again". Suspected cause: three walkers on the dev stack, so not confirmed. | c26-mail.png, c25-runway.png | n/a | Re-measure on an idle stack. |
| R3-11 | Sidebar, email chats | P3 | flow | Observed: each Ask agent or mail-agent thread adds a chat row ("[MOCK] Q3 board deck", "[MOCK] Quick question...") between space chats, pushing real bots down. Suspected design question. | c24-1920.png | Shell.tsx chat list | Group email threads under one collapsible row. |

## Excellent

- Inbox agent now leads with "I could not read Old mail, so this may be incomplete."
- Filter menu check marks plus a Clear row; Digest toggle aligned and outlined.
- Data room stats bars have tooltips and labels; Add files menu wording is clear; 1920 columns fixed.
- Relayed agent messages collapse to one "Messaged Finance agent" line.
- The pending-ask send error "Answer the pending ask first." is clear and keeps the draft.
