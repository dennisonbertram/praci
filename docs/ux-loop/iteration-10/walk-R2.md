# Walk R2 (iteration 10): verify pass-9 clusters C11-C20

Method: agent-browser session uxl10-R2 on the mock demo (web 5381). Desktop 1440x900 (and 1920x1080 for C16); phone checks at 375x812 with CDP touch emulation (pointer: coarse true, maxTouchPoints 5). Screenshots in /tmp/uxloop10/R2/. Geometry audit run on Inbox (only sidebar name/time rows flagged, intentional). The demo was shared with other walkers, so some chat state changed while I walked.

## Verdicts

| Cluster | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| C11 drawer Search, palette | PASS | 3/3 | After tapping drawer Search at 375 coarse, activeElement is the palette input; all eight pages show (c11-2.png). |
| C12 Data room on phone | PASS (zoom unverified) | 4/4 | Full screen now fills the viewport (c12-4.png); list/grid toggles share the folder row; grid shows 4 cards in 812 px. PDF zoom not checkable: the demo PDF is 193 bytes and blank, and the viewport meta allows zoom. Text-card preview still sits under the "..." button (c12-2.png). |
| C13 Bot settings panel | PASS | 6/6 | Sticky header, boxed Advanced, skill and Notifications rows 44+ px under coarse, External shows one line and Internal none, schedule submenu abuts its parent (right edge 1081 vs parent left 1077; opens leftward). Details in findings. |
| C14 Routines panel | FAIL | 3/3 | Create a routine text button is visible. But the monitor button and panel header still say "Computer and routines" / "Computer is on" over a black box (c14-fin3.png), and the routine form has no skill picker (c14-form.png). The demo fake sandbox reports running, so the black box is possibly a demo artifact; the title is not. |
| C15 Mercury integration page | PASS | 3/3 | One switch only, no Create agent, no Used by list, Reconnect and Disconnect sign-in sit in a "..." menu. Switch opens a confirm dialog; layout did not shift (Remove button stayed at y=338). I did not confirm the dialog. |
| C16 Legal page | PARTIAL | 4/4 | PASS: title and table left edge x=398 at 1920 on Inbox, Legal, Finance; header shows "Scanning..." not "Not scanned yet"; rows all 37 px. FAIL: Parties still truncates ("Northwind Robotics (Mock), ...") while Term and Renewal show mostly dashes; the "not yet checked" link has no underline or color (computed text-decoration none). |
| C17 Chat run rows | PARTIAL | 5/5 | PASS: agent-to-agent rows are pills with chevron; overlay shows no ids. FAIL: a running tool row reads "Legal upsert node" (c17-legal.png). Tool rows were otherwise collapsed so the other labels were not checked. |
| C18 Free text with open ask | PASS | 3/3 | New user's Chief: typing text with the card open removes the card and sends one bubble (c18-2.png). On Investor Relations the card shows "Answered: <text>" plus one user bubble with the same text (c18-1.png), which is a small duplication. |
| C19 Hide amounts per user | PARTIAL | 8/5 | PASS: a second user sees Hide amounts unchecked; storage is keyed by user id and synced to the server. FAIL: with amounts hidden Finance shows only "$•••" and no visible control or note to turn it off (c19-1.png). |
| C20 Inbox filter menu | PARTIAL | 4/4 | PASS: 8 top-level items, "Gmail Updates" is a separate name, no duplicate Newsletters; compose, Cleanup and Filter are all 36 px wide; search hit shows a snippet with a highlighted match (c20-3.png). Not met: each row still has 2 tab stops (row, select), so the 5th row takes about 10 Tabs, not 5. |

Counts: PASS 5 (C11, C12, C13, C15, C18), PARTIAL 4 (C16, C17, C19, C20), FAIL 1 (C14), BLOCKED 0, SKIPPED 0.

## Findings

| id | page/story | sev | cat | what happened vs expected | evidence | suspected code | fix | status |
|---|---|---|---|---|---|---|---|---|
| R2-10-01 | C14 Routines | P2 | copy | The bot's monitor button is still "Computer and routines" and the panel header says "Computer is on" with a black preview, so routines still hide behind a computer name. Expected "Routines" when no computer is in use. | c14-fin3.png; button aria-label at Shell.tsx:5729 | apps/web/src/pages/Shell.tsx:5729 | Title the panel "Routines" and hide the preview until frames arrive. | Observed (black box may be a demo fake-sandbox artifact) |
| R2-10-02 | C14 Routine form | P3 | flow | The routine form has Name, Instruction and "Choose when it runs" but no way to pick a bot skill. | c14-form.png | routine form in Shell.tsx | Add a skill picker listing the bot's skills. | Observed |
| R2-10-03 | C19 Finance | P2 | flow | With Hide amounts on, Finance shows only "$•••". Nothing says amounts are hidden or offers a one-click way back. Expected a visible control. | c19-1.png | Finance.tsx header | Add a small "Amounts hidden - Show" control in the Finance header when hidden. | Observed |
| R2-10-04 | C16 Legal | P2 | visual | Parties still truncates while Term, Renewal and Status columns are mostly empty. | c16-1440.png; th widths Parties 203, Term 182, Renewal 182 | Legal contracts table column widths | Give Parties a larger min width and shrink Term/Status. | Observed |
| R2-10-05 | C16 Legal | P3 | visual | The "1 Data room document not yet checked by Legal" link looks like plain text (underline none). | c16-1440.png | Legal.tsx header | Style it as a link (underline on hover at least, link color). | Observed |
| R2-10-06 | C17 Chat | P2 | copy | While a Legal run is working the row reads "Legal upsert node" (internal tool name). | c17-legal.png | tool label mapping in transcript.tsx | Map tool names to verb phrases such as "Updating the contract list". | Observed (other tools not seen) |
| R2-10-07 | C20 Inbox | P3 | a11y | Rows have 2 tab stops each (row button and select); 5th row takes about 10 Tabs. Improved from 6 stops, AC target not met. | Tab walk output | Inbox row component | Make select appear only on focus within the row button, or use roving tabindex. | Observed |
| R2-10-08 | C20 Inbox | P3 | visual | Toolbar icon buttons are 36x28 while Ask is 69x32, so heights differ. | button boxes | Inbox.tsx toolbar | Make icon buttons 36x32. | Observed |
| R2-10-09 | C20 Inbox search | P3 | visual | Searching "robot MAC" highlights only "robot", not "MAC". | c20-3.png | Inbox search snippet | Highlight every query term. | Observed |
| R2-10-10 | C13 Bot panel | P3 | visual | When scrolled, content from the previous section shows in a band above the sticky "Chief settings" header (c13-4.png top 10 px). | c13-4.png | bot-panel.tsx header padding | Give the sticky header a background that covers the band, or top:0 with no gap. | Observed |
| R2-10-11 | C13 Bot panel | P3 | copy | The External line reads "Talks to people outside your company. Private tools are turned off." It does not mention that outside sharing needs approval. | c13-ext.png | bot-panel.tsx | Add "Sharing asks you first" if that is the behavior. | Observed |
| R2-10-12 | C18 Ask card | P3 | flow | On Investor Relations a typed answer shows both "Answered: <text>" on the card and a separate user bubble with the same text. | c18-1.png | composer submit path | Show it once. | Observed |
| R2-10-13 | C15 Mercury | P3 | visual | In the "..." menu "Disconnect sign-in" wraps to two lines. | c15-3.png | AppDetail.tsx | Widen the menu. | Observed |
| R2-10-14 | C12 Data room phone | P3 | visual | In grid view a text card's preview text runs under the "..." button, and thumbnails of PDFs are empty icons. | c12-2.png | data-room grid card | Reserve space for the button. | Observed |
| R2-10-15 | Direct load | P2 | perf | Opening /app/legal directly showed "Opening Praci..." for over 14 s, then "Still opening... Try again" for a while, before it loaded on a second navigation. API health was 200 and instant. The demo had several walkers, so this may be load. | c16-1440.png | not traced | Re-measure on an idle stack. | Observed once, cause unknown |

Excellent: C11 palette focus and full page list; C15 Mercury page (single switch, tidy "..." menu); C12 full-screen preview and toggle row; per-user Hide amounts storage that survived sign-out and a second user.

Cleanup: I turned Hide amounts on and then off for mock-founder, set the Investor Relations audience to External then back to Internal, and created one throwaway user (walker-r2-*@northwind.example.test) on the demo.
