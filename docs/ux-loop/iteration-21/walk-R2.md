# Walk R2 (iteration 21): verify pass-20 fixes C11-C20

Target: demo stack (mock data), 1440x900, signed in as the mock founder. Screenshots are kept outside the repo (file names c11.png ... c20-chief.png in the R2 folder).

## Verdicts

| Cluster | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| C11 Inbox first sort | BLOCKED | n/a | The seeded mailbox is already sorted and a fresh first sort needs a real mailbox connection. Code for the 15 s dimmed rows is present (Inbox.tsx about :798-806, :1846 opacity-60). Existing mail still shows Needs reply with 8 unread plus 14 more, about 19 of 22 Important rows (expected: existing mail keeps its sort). |
| C12 Legal agent | PASS (data) / UNVERIFIED (agent) | 3/3 | Insurance policy: term ends Dec 1, note says "renews on December 1 ... 30 days before", deadline Nov 1. Notice dates and notes agree. The removal proposal and the Inbox hand-off exist in the prompt (legal-agent.ts:21) but were not run live. |
| C13 Data room | PARTIAL FAIL | 8/8 | PASS: Stats tiles use pointer cursor, Failed is red when above zero; folder search with no results shows a "Search all items" button; Name column is 447 px of about 830 px (about 54%) while searching; dialog title is "Auto-sort". FAIL: a failed (unreadable) file's row menu is Send to agent, Share, Move, Rename, Delete, with no Replace file (R2-21-02). Stats view still leaves a gap where the search box was (R2-21-07). |
| C14 Investors agent ownership | PASS | 3/3 | Asked "How much do the founders own right now, and after the Quill SAFE converts?" The agent answered 70% today (Maya 40%, River 30%), used the page's 2.1% SAFE figure, and gave 39.2% / 29.4% / 68.5% with the source named. |
| C15 Finance charts | PARTIAL FAIL | 6/5 | PASS: the partial month Oct* is a single point with no falling line; Year view label no longer sits on a bar; all four Runway cards have a sublabel; Rent page shows the period once. FAIL: the Financing label is clipped at the top of the chart (R2-21-03); the Rent chart still omits the current month (R2-21-04). |
| C16 Routines caption | FAIL | 2/2 | Chief's Routines panel still shows "Chief's computer" over an empty area (R2-21-01). Fifth pass. |
| C17 Bot settings and routine editor | PASS | 6/6 | Notifications switch is drawn off and dim next to "Off in Settings". Enter in the Name field saves (sidebar updated while the field kept focus; name restored afterwards). Save stays "Saved" after Test run. Built-in skills are collapsed under one group. Workspace control did not appear for this one-space account, so it was not checked. |
| C18 Legal row height | PASS | 1/1 | All 10 contract rows are 40 px. New problem on the same table: R2-21-05. |
| C19 Settings polish | PASS | 6/6 | Chat display opens with a balanced two-column layout; Advanced is a real button with aria-expanded and expands with a click; Memory shows the list line before "Outside memory service"; phone cards are 343 px wide; the Usage card was non-zero so hide-at-zero was not exercised. |
| C20 Header height and divider | PARTIAL FAIL | 11/11 | Title centre is y=28 on nine pages and about y=27 in chat: PASS. The chat header draws a bottom border while page headers do not (R2-21-06). |

Not exercised: console error check, touch-emulated target sizes, the live Legal removal proposal and Inbox hand-off.

## Findings

| ID | Page/story | Sev | Cat | What happened vs expected | Evidence | Suspected location | Proposed fix |
|---|---|---|---|---|---|---|---|
| R2-21-01 | C16 Routines panel | P3 | visual | Observed: "Chief's computer" caption sits over an empty area in a bot's Routines panel. Expected: caption only when a computer preview exists. | c16-routines.png | apps/web/src/pages/Shell.tsx (computer caption near the routines panel) | Render the caption and heading only when the bot has computer content. |
| R2-21-02 | C13 Data room | P2 | flow | Observed: the row menu of the unreadable file "MOCK Signed NDA - Bolt Freight.pdf" has no Replace file and offers Send to agent. Expected: Replace file, since the file cannot be read and Try again cannot help. | c13-menu.png | apps/web/src/components/data-room/ItemMenu.tsx:55-72 (Replace only inside canRetry); format.ts:104 (canRetryItem false for unreadable files) | Show Replace file for any failed file, and hide Send to agent for it. |
| R2-21-03 | C15 Finance burn chart | P2 | visual | Observed: the "Financing, Oct 1 $250,000" label (Month) and "Financing, 2026 $250,000" label (Year) are cut off at the top of the plot. | c15-a.png, c15-year.png | finance burn chart component (Finance.tsx or components/finance) | Add top padding to the plot or place the label inside the plot area. |
| R2-21-04 | C15 Rent page | P3 | visual | Observed: the monthly chart covers Apr to Sep, while the page card says Oct 1-22 $7,500 and the table lists the Oct 1 rent. Expected: the current month appears as a partial bar. | c15-rent.png | apps/web/src/pages/finance/FinanceSpend.tsx | Include the current month as a partial bar. |
| R2-21-05 | Legal contracts table | P2 | visual | Observed: at 1440 the "Next deadline" column is cut off ("Nov 1, 2026" shows as "Nov 1, 202"); the scroll area is 1148 px wide in a 1124 px box, so a 24 px horizontal scroll hides it. Expected: all columns visible at 1440. | c18.png (measured scrollWidth 1148 vs clientWidth 1124) | apps/web/src/pages/legal/LegalContracts.tsx (column widths) | Narrow the Renewal or Parties column so the table fits 1124 px. |
| R2-21-06 | C20 headers | P3 | visual | Observed: the Chief chat header has a bottom border (56 px band) while Inbox, Finance, Legal and the other pages have none; Artifacts has a line only below its toolbar. Titles share the same y. | c20-chief.png, c20-artifacts.png | apps/web/src/pages/Shell.tsx chat header; page headers | Pick one rule: border on every header or on none. |
| R2-21-07 | C13 Data room Stats | P3 | visual | Observed: in Stats view the filter chips stay in the middle of the row with an empty gap where the search box was. | c13-stats.png | apps/web/src/components/data-room/FilterBar.tsx | Left-align the chips or keep the search box in Stats. |

Praise: the Investors agent now answers from the page figures with its source; Legal notice dates now match their notes; Settings Chat display and the phone sheet are clean; Save no longer reappears after Test run.
