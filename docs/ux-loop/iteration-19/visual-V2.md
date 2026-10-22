# Visual inspection V2 (iteration 19)

Group V2: Inbox, Finance, Legal, agent chat, Artifacts. Mock-data demo stack (web port 5381), signed in as the seeded mock founder.
Viewports: 1440x900, 375x812, shell at 1920x1080. Screenshots are in `/tmp/uxloop19/V2/` (outside the repo).
Both audit scripts were run on every state (layout-audit.js and geometry-audit.js); pageScrollX was 0 and pageScrollY was 0 on every surface.

Limits of this pass:
- Touch emulation (`pointer: coarse`) was not available in agent-browser (device presets did not set it, and 375 wide has no preset), so no touch-target findings are made. `apps/web/src/styles.css` already raises buttons and tabs to 44 px under `(pointer: coarse)`.
- Approval cards could not be exercised: the demo has no model, and another walker owns the pending approval thread. I viewed that thread and the approval toast without acting on them.
- The low-contrast list from layout-audit.js (ratios of about 1.3 on all sidebar text) is a false positive: the audit reads a transparent background on a dark theme. The text is clearly legible in the screenshots, so none of it is reported.

## Verdict per page and viewport

| Page / state | 1440x900 | 375x812 |
|---|---|---|
| Shell and sidebar | Good. Sidebar list scrolls inside itself; one row (Archived / Page agents) sits half under the fade at the bottom | Good (drawer) |
| Inbox, Important | Good once sorted; layout jumps when sorting finishes (V2-01) | Good |
| Inbox, Newsletters and Digest | Excellent | not walked |
| Inbox, Cleanup | Good, one-line reason as decided | not walked |
| Inbox thread dialog and attachment preview | Good; preview has a dead band (V2-07) | Good; sender name wraps badly (V2-06), cell text cut (V2-09) |
| Finance overview | Dense and clear; main column scrolls (V2-02) | Header status row breaks (V2-03) |
| Finance, Accounts | Excellent, fits one screen | not walked |
| Legal, Contracts | Term column wraps every row (V2-04) | Good (cards) |
| Legal, Deadlines | Three buttons on every row (V2-05) | not walked |
| Agent chat (Chief, Investor Relations, a delegated thread) | Good; bar and toast overlap (V2-08) | Good |
| Artifacts (grid, list and preview) | Good | Good |
| 1920x1080 shell (Finance) | Content centred at a 1440 max width, no stretch, correct | n/a |

## Findings

| id | page | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| V2-01 | Inbox, Important | P2 | flow (L5) | Observed. Rows first render under Today / Earlier headings with "Sorting your mail..." on top. When sorting finishes, the whole list is replaced by a To do box plus "Needs reply" and "Other mail today" groups, and every row moves by about 150 px. The founder can be mid-click on a row. Expected a stable list, or a skeleton until triage is ready. | `inbox-1440.png` (before) and `inbox-1440b.png` (after); the "Sorting your mail..." text was still present more than 15 s after load on this stack | `apps/web/src/pages/Inbox.tsx:1668` and `:1743` | While sorting, keep the unsorted rows dimmed in one flat list under the label, and reserve the To do box height so the swap does not shift rows. |
| V2-02 | Finance overview | P2 | visual (L1) | Observed. The page does not scroll, but the main column does: client height 900, scroll height 1274 (and 1080 vs 1274 at 1920x1080). The Subscriptions card starts at the fold (y 873) at both sizes, so a 1920x1080 screen still cannot show the page whole. Expected KPI row, chart and the three lists to fit one screen, or a fixed header with panels scrolling inside. | `fin-1440.png`, `fin-1440-b.png`, `fin-1920.png`; layout-audit scrollers entry | `apps/web/src/pages/Finance.tsx` (page layout under the sticky header) | Cap the chart height (now about 270 px) and make Breakdown / Upcoming / Subscriptions a fixed-height row whose lists scroll, or move Subscriptions behind its own page link. |
| V2-03 | Finance overview, phone | P1 | visual / copy | Observed. The status row under the title is broken on a 375 px phone: "Northwind ..." and "synced j..." are both truncated, and the note "1 non-USD transaction not counted" wraps onto three lines with a leading bullet. The row takes about 95 CSS px and the sentence is unreadable. Expected one short line, or the note moved into the Accounts page. | `finance-375.png` | `apps/web/src/pages/Finance.tsx:396-470` (meta row: company menu, source link, nonUsdNote) | On phones hide the note (it already lives on Accounts / Spend) and show only a dot plus "synced just now" under the title. |
| V2-04 | Legal, Contracts | P2 | visual (D1, H6) | Observed. The Term column is about 175 px wide, so "Dec 2, 2025 - Dec 2, 2026" wraps to two lines in all 10 rows, and Renewal wraps too. Rows are 57 px high instead of about 36 px, while Contract and Parties have spare width. Expected single-line rows on a dense table at 1440. | `legal-1440.png` | `apps/web/src/pages/Legal.tsx` (contracts table column widths) | Give Term and Renewal `whitespace-nowrap` and let Contract shrink, or shorten the term to "Dec 2025 - Dec 2026". |
| V2-05 | Legal, Deadlines | P2 | visual (D5, H1) | Observed. Every one of the 9 deadline rows shows three equal-weight buttons (Ask agent, Done, Dismiss), so 27 buttons compete for attention and Dismiss sits right next to Done with no weight difference. The overdue row also says "Overdue by 5 days" and "Oct 17, 2026" in red (same fact twice). Expected one primary action per row, the rest in a menu or on hover. | `legal-dl-1440.png` | `apps/web/src/pages/Legal.tsx` (deadline row actions) | Keep a checkbox-style Done as the only visible control; move Ask agent and Dismiss into a "..." menu or show them on row hover and focus. |
| V2-06 | Inbox thread, phone | P3 | visual | Observed. In the 375 px thread header the sender name breaks mid-name ("Halcyon" / "Security <address>") because the address is inline with the name. Expected name on one line, address below it. | `thread-375.png` | thread header component in `apps/web/src/pages/Inbox.tsx` (sender line) | Put the address on its own line below the name at phone width. |
| V2-07 | Inbox attachment preview, desktop | P3 | visual (D2) | Observed. The CSV preview dialog is a fixed 360 px tall panel; a 3-row sheet leaves about 180 px of empty grid, and the dialog covers the open email body behind it. Expected the dialog to fit its content up to a maximum. | `preview-1440.png` | attachment preview dialog (sheet viewer) | Size the preview to content with a max-height. |
| V2-08 | Delegated agent chat | P2 | visual (L3, L4) | Observed. In "J3 phone walker" the full-width "Open Inbox agent" bar (x 340 to 1412) is wider than the composer (x 428 to 1328) and is partly covered by the approval toast at bottom right. The same destination is also offered by the "Messaged Inbox agent" chip and the link in the reply (the in-chat link is an owner decision; the bar is separate). Expected the bar to align with the composer and no overlap. | `appr-1440.png` | `apps/web/src/pages/Shell.tsx:4322` | Align the bar to the composer width (max-w of the thread column) and drop it, or keep it only when the toast is not showing. |
| V2-09 | Inbox attachment preview, phone | P3 | a11y / flow (C4) | Observed. The CSV cells are cut with an ellipsis ("Do you encrypt data at rest? (MOCK..."). The full text exists only in a `title` attribute, which touch users cannot see. Expected wrapped cells or tap to expand. | `preview-375.png`; cell `title` present, `scrollWidth > clientWidth` true | sheet preview cell renderer | Let cells wrap at phone width. |
| V2-10 | Legal, Contracts | P2 | flow (I6) | Observed. "32 Data room documents not yet checked by Legal" is plain text (cursor auto, no link or button). It reports an unfinished job but does not offer the next step; Scan now sits far away in the header. Expected a link or inline "Scan now" next to the count. | `legal-1440.png` | `apps/web/src/pages/Legal.tsx:303-309` | Turn the sentence into a button that starts the scan, or append a "Scan now" link. |
| V2-11 | Finance overview | P3 | copy (C1) | Observed. "Out so far this month, not over" reads as an odd phrase (it means the month is not finished). Expected plain wording such as "Spent so far this month". | `fin-1440.png`, `finance-375.png` | `apps/web/src/pages/Finance.tsx:382` | Change to "Spent so far this month" and drop "not over". |
| V2-12 | Finance overview | P3 | visual (H6) | Observed. The Breakdown card title sits at y 548 and the Upcoming title at y 544, because the Category / Vendor pill is taller than the Upcoming header. Cards beside each other should share one baseline. | `fin-1440.png` | `apps/web/src/pages/Finance.tsx` (Breakdown and Upcoming card headers) | Give both header rows the same fixed height. |
| V2-13 | Inbox header | P3 | visual (H6) | Observed. In the header toolbar the Ask button is 32 px tall and the Cleanup, Filter and Compose buttons are 28 px tall (measured). | layout measurement at 1440 | `apps/web/src/pages/Inbox.tsx` header actions | Use one button height. |
| V2-14 | Artifacts, opened item | P3 | visual (L5) | Observed. Opening an artifact removes the list/grid toggle from the header, so the header changes between list and detail views. The list pane truncates titles ("MOCK All-hands Notes - Oc...", "MOCK Investor Updat..." beside the v2 badge) with no full title on hover noted. | `art-1440.png`, `art2-1440.png` | `apps/web/src/pages/Artifacts.tsx` | Keep the toggle visible, or widen the list pane. |
| V2-15 | Inbox hover row | P3 | visual | Observed. On hover the four row actions (24 px each) are drawn over the end of the subject text with no fade, so the subject is cut at the icon edge ("...are s"). Sizes are acceptable (24 px). | `hover-1440.png` | Inbox row hover toolbar | Add a background gradient behind the toolbar, or reserve its width. |

## Excellent as is

- Finance overview at 1440: KPI row, burn chart, Breakdown and Upcoming have clear hierarchy, right-aligned money, and a legible legend. Cash accounts in the Accounts page add up to the Cash tile ($1,633,221, checked by hand).
- Finance, Accounts: fits one screen, a total chart plus two grouped lists, with a clear back control.
- Inbox Newsletters and Digest: scannable, one clear bulk action with the count named ("Archive all 8 messages from 5 senders"), and the Open buttons are consistent.
- Inbox Cleanup empty state: one line that says why it is empty, plus the one next action.
- Inbox thread dialog: compact, Reply is the single high-emphasis button, previous / next / close present, Escape closes the preview and returns focus to the attachment, and the focus ring is visible (3 px).
- Legal on phone: the table becomes readable cards with value on the right.
- Artifacts on phone: clean list with search and filter pinned above it.
- Chat on desktop and phone: grouped bubbles, timestamps as dividers, composer pinned at the bottom, the question card with its two answers is clear.
- Skip link, logical tab order from sidebar to main content, and no horizontal overflow at 375 or 1920 on any page walked.
