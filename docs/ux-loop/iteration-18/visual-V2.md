# Visual inspection V2 (uxl18-V2): Inbox, Finance, Legal, agent chat

Target: mock-data demo stack, http://127.0.0.1:5381, signed in as the mock founder. Viewports: 1440x900, 375x812, and 1920x1080 for the shell. Screenshots: `/tmp/uxloop18/V2/`.

Method notes and limits:
- `layout-audit.js` was run on every captured state. Its low-contrast list reports ratios of about 1.3 for nearly all dark-theme text; that is a false positive (transparent background resolved to white), so no contrast findings are made.
- The browser session has no touch emulation (`pointer: coarse` stayed false even with the iPhone device preset). Touch-target measurements are therefore invalid and none are reported. The `.rk-tap` 44 px rule in `apps/web/src/styles.css` only applies under coarse pointer.
- Other walkers used the same demo account at the same time. Some sidebar content, the "Amounts hidden" state, the approval toast and extra mail came from them.
- Not covered: Cmd+K, Finance sub-pages other than Accounts and Burn, Legal contract detail, Newsletters tab.

## Verdict per page and viewport

| Page | 1440x900 | 375x812 | 1920x1080 |
|---|---|---|---|
| Inbox (Important, sorted) | Good. Fits one screen, inner list scrolls. Tour card covers the lower sidebar (V2-05). | Good. Rows stack to two lines, tabs and search clear. | Good. Centered content, equal gutters. |
| Inbox Updates tab | Good. One group per sender. | Not captured. | Not captured. |
| Inbox Cleanup (empty) | Good. One line says why it is empty. | Not captured. | n/a |
| Email dialog and attachment preview | Good. Escape returns focus to the row. | Good. Full-screen sheet. | n/a |
| Finance overview | Very good. Dense, one primary region per row, inner scroll only. | Good. Cards reflow to one and two columns. Minor inset (V2-14). | Good. Hidden amounts state also fine (V2-15). |
| Finance Accounts and Burn | Good. Small floating header card (V2-12), burn legend colors (V2-06). | Not captured. | n/a |
| Legal Contracts | Truncated key columns (V2-01). | Good. | n/a |
| Legal Deadlines and Graph | Heavy repeated buttons (V2-07), tangled graph (V2-10). | Not captured. | n/a |
| Agent chat with approval card | Approval card is clear. Hover toolbar clipped (V2-03). | Good. Card fits, truncates the address with an ellipsis. | n/a |
| Artifacts and viewer | Works; low density (V2-13). | Not captured. | n/a |

## Findings

All findings are observed unless marked suspected.

| ID | Page | Sev | Cat | What happened vs expected | Evidence | Suspected location | Proposed fix |
|---|---|---|---|---|---|---|---|
| V2-01 | Legal, Contracts table, 1440 | P2 | visual | Term ("Dec 2, 2025 – Dec 2, 2…") and Renewal ("Auto-renews, 30 days no…") are cut off with an ellipsis, while the Value and Next deadline columns have spare room. The most decision-relevant text is the part that is hidden. Norm C4 (truncation hides content). | `legal-1440.png` | `apps/web/src/pages/legal/LegalContracts.tsx:162-169` (fixed colgroup 28/19/16/17/8/12 percent) | Give Term and Renewal more width (take it from Contract and Parties) or let those two cells wrap to two lines. |
| V2-02 | Agent chat opened by direct URL, 375 | P2 | flow | Opening the long Inbox agent thread by URL showed "Still opening… Try again" after about 8 s with a skeleton header that has no menu button, so Maya has no way to navigate until the chat loads. "Try again" worked within 2 s. Load was slow while several walkers used the stack; cause not isolated (suspected: long thread fetch). Norms I2, I6. | `inboxagent-375.png` | Not located | Render the header (menu button, title) while the thread loads, so navigation is always available. |
| V2-03 | Agent chat with settings panel open, 1440 | P2 | visual | On the newest wide Mail card, the time and hover toolbar (react, reply, remember, More) sit to the right of the 600 px card and run into the panel edge, so the More button is cut off. Norm L6. | `sent-1440.png` (toolbar at x about 960-1055, last button clipped) | Message row layout in the chat message component (wide card plus side toolbar) | Place the toolbar under or over the card when the column is narrower than card plus toolbar. |
| V2-04 | Approval card, Send click | P2 | flow, copy | After Send on a mail approval card the card showed "Sending…", and the originating chat later said the email "was not sent because a mail account must be chosen" with only an "Open Inbox agent" link. The card never showed a From account or a chooser, so the failure was predictable. Compatible with the pass-16 decision (plain words); this notes that the message gives no control to fix it. Norm I3. | `chat-375.png`, `sent-1440.png` | Mail approval card (From selection) | Show the sending account on the card, and when more than one exists let Maya pick it before Send. |
| V2-05 | Tour card, 1440x900 | P3 | visual | The first-run tour card sits over the lower sidebar and hides the "Page agents" count row and the rows under it. The fixed spot is an owner decision; this records the side effect at 900 px height. | `home-1440.png`, `inbox-1440.png` | Tour card positioning | If the card must stay fixed, reserve space in the sidebar scroll area while the tour runs. |
| V2-06 | Finance Burn, "Where it went" | P2 | visual, a11y | The stacked bar uses seven near-identical grays, and each row's legend square is also gray, so segments cannot be matched to categories. The same data is also drawn a second time as per-row bars about 115 px wide in a 515 px card. Norms H4, A1, C2. | `fin-burn-1440.png` | Burn page breakdown component | Drop the stacked bar or the row bars; keep one encoding, with the label adjacent to the mark. |
| V2-07 | Legal Deadlines | P3 | visual | Each of nine rows carries three buttons (Ask agent, Done, Dismiss); two are equal-weight outlines. Norms I5, D5. | `legal-deadlines-1440.png` | Legal deadlines row component | Keep Done visible, move Ask agent and Dismiss into a row menu or show them on hover and focus. |
| V2-08 | Legal, "N Data room documents not yet checked by Legal" | P3 | visual | A bordered rounded box with text on the left and an empty right side, in the same style as clickable cards, but it has no action. Norm I1. | `legal-1440.png` | `apps/web/src/pages/Legal.tsx:300-312` (`justify-between` with one child) | Make it plain muted text, or add the action (for example "Scan now") on its right. |
| V2-09 | Legal loading, 375 (seen once; screenshot not kept) | P3 | visual | The loading skeleton showed two rows of two tiles plus a large panel, while the loaded page is tabs plus a contract list, so the layout shifts when data arrives. Low confidence. Norm L5. | Seen in a 375 capture that was overwritten | Legal skeleton component | Shape the skeleton like tabs plus list rows. |
| V2-10 | Legal Graph | P3 | visual, perf | Contract order does not follow company order, so edges cross heavily and Northwind fans into every contract. "Building graph…" showed for more than 5 s. Norm D2. | `legal-graph-1440.png` | Legal graph layout | Sort the contract column by its company's row to cut crossings; show the graph from cached data while it lays out. |
| V2-11 | Inbox, 1440 and 1920 | P3 | visual | "Show 15 more" starts 11 px to the right of the group headings ("Needs reply") and rows above it. Norm H6. | `inbox-1920.png`, `hover-row.png` | Inbox "Show more" button padding | Remove the button's horizontal padding or use a negative margin to align the text edge. |
| V2-12 | Finance Accounts and Burn headers | P3 | visual | The summary card (Total cash, Monthly burn) is about 170 px wide at the left with an empty band to its right; the page reads as unbalanced. Norm D2. | `fin-cash-1440.png`, `fin-burn-1440.png` | Sub-page header layout | Put the figure in the header row, or span the card across the page. |
| V2-13 | Artifacts, 1440 | P3 | visual | Grid cards are about 150 px tall with an empty lower band; the viewer's frame is about 90 percent empty for a short document; the list pane touches the sidebar edge while the header title is inset 28 px; the list and grid toggle disappears when a document is open, so the header changes. Norms D1, L4, L5. | `artifacts-1440.png`, `artifact-1440.png` | Artifacts page grid and viewer | Reduce card height to content, add a left gutter to the list pane, and keep the toggle visible. |
| V2-14 | Legal header at 375, Finance period tabs at 375 | P3 | visual | In Legal the space name and "Last scan" line starts at x=25 while content starts at x=16. In Finance the period tabs start at x=46 while the figure below starts at x=30. Norm H6, L4. | `legal-375.png`, `finance-375.png` | `SpaceName` padding; Finance period tab container | Align both to the page gutter. |
| V2-15 | Finance Breakdown with Hide amounts on, 1920 | P3 | visual | With amounts hidden the row bars disappear, leaving labels at the far left and `$•••` about 650 px to the right with nothing connecting them. Norm D4. | `finance-1920.png` | Breakdown row layout | Cap the row width, or keep a muted bar track. |
| V2-16 | Sidebar chat rows | P3 | a11y | The "New Bot" row preview begins with a small green flag glyph that has no visible label; its meaning is unclear (not investigated further, accessible name not verified). Norm C3, A2. | `artifacts-1440.png` | Sidebar chat row | Confirm what the glyph means; add a text label or remove it. |
| V2-17 | Create menu | P3 | flow | Choosing "New bot" with Enter opened the new chat, but the Create menu stayed open over the sidebar until Escape. Mouse selection of the other items closed it. Keyboard-only; may be specific to the driven browser. Norm I7. | `newbot-1440.png` | Create menu component | Close the menu on item activation for both keyboard and mouse. |

## Excellent as is

- Finance overview at 1440x900: five equal summary cards, one chart, then two peer panels. Only the inner scroller scrolls (page scroll 0), and every figure link opens a sub-page with a back button. The Accounts total (1,633,221) equals the sum of its five accounts.
- Inbox sorted view at 1440 and 1920: grouped by Needs reply / Other mail today / Earlier with counts, five rows plus "Show N more", one date column, quiet reason pills, equal outer gutters.
- Inbox on 375: two-line rows, search and tabs reflow with no horizontal scroll, drawer is a clean 315 px sheet.
- Cleanup empty state: one line says why it is empty and offers one next step.
- Email dialog and attachment preview: clear hierarchy (Reply primary, Archive and Ask agent secondary), attachment preview offers Add to Data room and Download, and Escape returns focus to the originating row.
- Mail approval card in chat: one high-emphasis Send, quiet Discard, an Edit link, and a More menu. At 375 the long address truncates without breaking the card.
- Legal on 375: contract list collapses to a readable two-line pattern with value on the right.
- Chart and sub-page navigation on Finance: "Finance" back button, title and company switcher stay in the same place on every sub-page.
