# Walk R2 (iteration 7): verify pass-6 fixes C11-C20

Target: mock-data demo stack, web 127.0.0.1:5381, 1440x900, signed in as the mock founder (existing session). Screenshots: /tmp/uxloop7/R2/. Console showed no errors or warnings during the walk.

## Verdicts

| Cluster | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| C11 Cap table (Investors) layout | PASS | 2/2 | Cards and table share x 344-1412; page fits 900 px with no scroll; skeleton matches real layout. Email column is still mostly "—" (minor). |
| C12 Holder rows / SAFE terms | PARTIAL (FAIL on row open) | 3/2 | Dialog is now titled "Save <name> as a contact"; SAFE amount shows in the Amount column on the Investors tab. Row click still opens a five-field form, and SAFE cap and date are shown nowhere except free-text Notes. |
| C13 Inbox jumping / counts | PASS (one small shift) | 2/2 | To do card is present on first paint, due labels read "Nov 19" and "Tomorrow", Needs reply count dropped 6 to 4 as I opened mail and the sidebar badge fell 11 to 9 to 8 consistently. Search box still slides right (x 416 to 533) when the space name appears. |
| C14 Data room failed / Reading rows | PASS | 2/2 | "Reading took too long" offers Try again; "isn't a readable PDF" offers Delete; a Reading row shows "Reading for N min". |
| C15 Toasts | FAIL (partly unverified) | 2/2 | Data room notice toast ("Reading <file> again") still sits bottom-right over the Ask panel's composer and the Tag card. Notice-with-button under a dialog scrim could not be triggered on the demo. Code shows NotificationToaster moved top-right z-110, so only that stack is fixed. |
| C16 Reply with the agent | PARTIAL | 8/7 (ideal 4) | "Ask agent" is now a visible button in the open email, the panel is named "Email agent", placeholder is "Ask about this email", dialog keeps its left edge when the panel opens. But a text draft still leaves no "Reply with draft" button; the agent says to copy and send. Panel opens empty with no suggestion. |
| C17 Finance sub-pages | PASS (one new clip) | 4/4 | "Count crypto" is now a real switch; crypto page has back button and header like its neighbours; hidden-amounts chart keeps its shape with masked labels; Burn marker is labelled. EUR-row total not testable (no EUR item in demo data). Financing label is clipped on the Finance home chart. |
| C18 Status vs work | FAIL | 3/3 | Carta agent sidebar preview still shows an agent-to-agent instruction ("One required step from the investor-update playbook..."). The Computer panel says "Computer is on" over an empty area with "Team Computer" and "Carta agent's computer" and nothing else. Routine-run Done vs working not reproducible (no running routine). |
| C19 Bot settings | PASS | 5/5 | No Title field; Team/Private and Internal/External selected state is a filled light pill; Computer has a one-line explanation; routine editor shows "Next run Mon, Oct 26, 9:00 AM" after save and Save becomes disabled "Saved"; Model reads "System model (...)". Audience has no explanation line. |
| C20 Integrations | PARTIAL | 2/2 | Phone scroll height 1610 px (was 2660); Mercury switch rows did not move after toggling Allow changes (y stayed 391). Connected cards still differ in footer (no menu on Gmail, Carta, Mercury, Brex; Coinbase has no Used by); Carta, Linear and Airtable still use a generic glyph. |

Out of scope but seen again (C5): the Carta agent full chat and the Data room Ask panel open in the middle of old history with a NEW divider and a "7 new messages" pill instead of at the latest message.

## Findings

| id | story/page | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| R2-01 | C16 email agent | P2 | flow | OBSERVED. Asked for a draft reply; agent answered with text and "I couldn't open an email draft for approval here, so this is ready to copy and send". No Reply with draft button, so Maya copies, closes, clicks Reply, pastes (8 actions). Expected one button that moves the draft into the reply box. | /tmp/uxloop7/R2/c16-4.png | apps/web/src/components/inbox/EmailAgentPanel.tsx:104,176 (button only for a pending mail_send card) | Show Reply with draft for the latest agent text draft too, or make the agent always create the draft card. |
| R2-02 | C15 toasts | P2 | visual | OBSERVED. Toast "Reading MOCK Board Minutes - October.pdf again" at x 1136-1424, y 754-820 overlaps the Ask panel composer and the answered Tag card. | /tmp/uxloop7/R2/c15-toast.png | Data room short-toast stack: apps/web/src/components/data-room/upload-toasts.ts, DropZone.tsx / ImportActivity.tsx (not NotificationToaster) | Anchor this stack top-right under the header like NotificationToaster, or reuse that component. |
| R2-03 | C18 sidebar | P2 | copy | OBSERVED. Carta agent row preview reads "One required step from the investor-update playbook..." which is a bot-to-bot instruction, not something Maya sent or read. Last visible chat lines are human-facing. | /tmp/uxloop7/R2/c18-sidebar.png, c18-carta-end.png | apps/web/src/pages/shell/Shell.tsx sidebar preview picker; transcript.tsx ~1465 | Skip peer-delivered messages when choosing the preview line. |
| R2-04 | C12 holder rows | P3 | flow | OBSERVED. Clicking a holder opens an editable contact form (title now "Save Alex Firmware (Mock) as a contact"; SAFE holder opens "Edit contact"). SAFE cap and date appear only in free-text Notes; Amount column shows the invested sum. | /tmp/uxloop7/R2/c12-row.png, c12-safe.png | apps/web/src/pages/Investors.tsx (row onOpen) / components/ContactDialog | Open a read-only holder card with SAFE amount, cap, date and an Add email action. |
| R2-05 | C17 finance chart | P3 | visual | OBSERVED. On Finance home the Financing marker label is cut at the right edge ("Financing, Oct ↑ $250,(") ; the Burn page shows it in full. | /tmp/uxloop7/R2/c17-fin.png vs c17-burn.png | apps/web/src/components/finance/charts.tsx | Right-align the label to the chart edge or flip it left of the marker. |
| R2-06 | C18 computer panel | P3 | copy | OBSERVED. Panel header "Computer is on", then Routines, then blank area with "Team Computer" and "Carta agent's computer" and no content or action. | /tmp/uxloop7/R2/c18-computer.png | apps/web/src/pages/shell/Shell.tsx computerStateLabel (~6822) | Say what is running or hide the empty computer pane until it has content. |
| R2-07 | C20 integrations | P3 | visual | OBSERVED. Connected cards: menu only on Blockscout and Coinbase; Used by missing on Coinbase; Carta uses the generic glyph; Linear and Airtable too. | /tmp/uxloop7/R2/c20-int.png | apps/web/src/components/integrations/IntegrationsHome.tsx | Same footer slots on every connected card; add logos for Carta, Linear, Airtable. |
| R2-08 | C19 bot settings | P3 | copy | OBSERVED. Audience (Internal / External) has no one-line explanation, while Computer (Team/Private) now has "Shares one computer with your other bots". | /tmp/uxloop7/R2/c19-digest.png | apps/web/src/pages/shell/bot-panel.tsx | Add a short helper under Audience (who the bot may message). |
| R2-09 | C14 reading age | P3 | flow | OBSERVED. Immediately after Try again the row reads "Reading for 34 min": the age counts from the first attempt. Suspected: elapsed time uses the file's created time. | /tmp/uxloop7/R2/c15-toast.png | apps/web/src/components/data-room/ItemRows.tsx | Count from the latest read start. |
| R2-10 | C13 inbox header | P3 | visual | OBSERVED. Mail search box moves right (x 416 to 533) when the space name "Northwind Robotics" appears after load. | /tmp/uxloop7/R2/c13-inbox.png vs c13-b.png | apps/web/src/pages/Inbox.tsx header | Reserve the space-name width or load it with the first paint. |
| R2-11 | C5 recheck | P2 | flow | OBSERVED. Opening the Carta agent chat and the Data room Ask panel lands mid-history at a NEW divider with "7 new messages" pill rather than at the latest message. | /tmp/uxloop7/R2/c18-carta.png, c15-toast.png | apps/web/src/pages/shell/transcript.tsx ~225-271 | On open, scroll to the end unless a real unread boundary is in view. |

## Unverified

- C15: notice with a button under a dialog scrim (no trigger on the demo).
- C17: category total with a non-USD row (no such row in demo data).
- C18: routine run history saying Done while the bot still works (no running routine).
- C14: Reading age on a genuinely stuck file (only the retry case was reachable).
- C20: Mercury page shift on the first Allow changes enable (agent already existed; later toggles did not shift).

## Praise

- Investors page: skeleton, cards and table share one width and fit one screen.
- Inbox To do card has real due labels ("Nov 19", "Tomorrow") and counts stay consistent with the sidebar.
- Bot settings: the selected segment is unmistakable; routine editor now shows the next run and a disabled "Saved" state.
- Data room failed rows offer the right action for each failure.
- "Count crypto" now looks and works like a switch.
