# Walk R2 (iteration 8): verify pass-7 fixes C11-C20

Target: mock-data demo stack, web port 5381, 1440x900 unless noted (375x812 for phone checks, layout only, no touch emulation, so no touch-target claims). Logged in as the seeded mock founder; one fresh invented user (walker-r2-8@northwind.example.test) for the no-mail and empty-Finance states. Screenshots: /tmp/uxloop8/R2/.

Environment notes. The demo stack went down at about 22:55 (host load average above 240) and was restarted and reseeded by another process at about 22:57. Data room stories were first seen on the old stack and re-seen on the new one. The old stack returned "Could not reach the server" in Auto-sort during the outage; that was the outage, not a bug. The page loads 6 to 15 s on this host, so load timing is not counted as evidence.

## Story verdicts

The cluster file has no story ids for C11-C20, so each cluster's acceptance list was walked as the story.

| Cluster | Verdict | Steps actual / ideal | Notes |
|---|---|---|---|
| C11 Previews: no bot-to-bot instruction in sidebar, no markdown in Activity | PASS | 2 / 2 | Sidebar rows show human-facing lines (Needs your answer, Working, the bot's own message). Activity list has no `**`, `#` or backticks. The Carta agent is not in this stack, so the exact instruction-preview case was not reproduced (R2-02). |
| C12 Data room: toast, Reading age, retry, Auto-sort | PASS | 4 / 4 | Upload toast now sits top right under the header, not over the composer (it does cover the first message bubble of an open Ask panel, R2-03). Reading row shows "Reading for N min", later "Taking longer than usual" with Try again, then "Reading took too long" with Try again. Auto-sort shows a changing timer ("Looking for changes 8.2s"), then one final list that did not change (observed 16 s and 46 s). |
| C13 First-run tour | PASS (1440) / not re-run at 375 | 9 / 9 | All nine stops: card sits beside the sidebar, never over a sidebar row. After "Ask Chief" a reload does not restart the tour. On a fresh user "Skip tour" leaves an "Ask Chief" chip above the composer. Phone placement not re-checked (tour already completed for the demo user). |
| C14 Inbox Digest | PASS (partly not reproducible) | 3 / 3 | The reseed made newsletters 1 to 2 days old, so the "No newsletters in the last 7 days" state could not be shown. Digest by-sender view works; Newsletters tab filled, Digest outlined (one filled control). Archive all 3 showed "Archived 3 Undo", but I could not click Undo within my roughly 10 s of screenshot time (R2-06). |
| C15 No mail connected | PASS | 2 / 2 | New user, Inbox shows "No mail connected / Connect mail" within 1 s, no sync line, no skeleton. |
| C16 Finance narrow widths | PASS with a P3 | 4 / 4 | Empty Finance has Ask. Runway KPIs each on one line with Ask panel open at 1440. Subscriptions "Similar to" chip not clipped at 375, no horizontal page scroll. Status dot has an accessible name. Burn and Runway headers at 375 are two rows (menu row, then title row with Ask), about 115 px before content, over the 70 px target (R2-05). |
| C17 Tables in docked Ask panel | FAIL | 3 / 3 | A 5-row vendor table in the 263 px panel renders Vendor and Category as 33 px and 31 px columns, so headings and names break one letter per line (R2-01). Amount and Share columns are intact. |
| C18 Integrations | PASS with P3s | 3 / 3 | Cards have the same footer slots and button x offsets within a row (179 to 180 px). Every app has its own logo (Carta uses a letter tile). One description still ends in an ellipsis at 375 (Blockscout). Tile logos load late (empty tiles for several seconds, host-inflated). Page height at 375 measured 1,690 px against the pass-6 1,610 px (R2-07). |
| C19 Artifacts | PASS | 4 / 4 | Sheet header "Net burn (USD)" right-aligned to its cells (right edges equal at 1419 px). 10 compact rows fit at 375 (limit was 6). Hover keeps the age and adds the trash icon beside it. Delete button name is "Delete MOCK Burn by Month", no extension. |
| C20 Legal | PASS with P3s | 4 / 4 | Contract rows 37 px, all 10 visible with no scrolling. "2 Data room documents not yet checked by Legal" link is 24 px tall, no underline at rest. Done shows "Marked <full title> done. Undo" in place of the row and stays about 25 to 30 s. Sidebar Legal badge cleared after the due-soon deadline was marked done. |

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| R2-01 | C17, Finance Ask panel | P1 | bug | A table reply in the docked Ask panel (263 px) shows Vendor and Category as 33 px and 31 px columns, so "Vendor", "Category" and every name stack one letter per line; the expected result is every column readable. Observed, measured: cells 33, 31, 87, 111 px. | /tmp/uxloop8/R2/tb4.png | packages/chat-ui/src/markdown-table.css, `@container (max-width: 24rem)` block: `overflow-wrap: anywhere` makes the minimum content width one character, so auto table layout gives the text columns what is left (suspected, not tested). | Use `overflow-wrap: break-word` plus a `min-width` of about 8ch on text columns, and let the card scroll sideways with a visible cue when the sum exceeds the panel. |
| R2-02 | C11 | P3 | flow | The Carta-agent instruction preview case from pass 7 could not be reproduced: the Carta agent is not in this demo stack. Fix is unverified for that case. | n/a | packages/db/src/repos.ts:369-390 | Cover it with the repository test over each intent value that the cluster asks for. |
| R2-03 | C12, Data room | P3 | visual | An "Upload failed" toast stays over the top of the Ask panel's first message bubble and did not clear for over 25 s. It no longer covers the composer. The toast also gives no reason ("Upload failed" for a .txt upload). Observed. | /tmp/uxloop8/R2/ask2.png | apps/web/src/components/data-room/DropZone.tsx:142 (toast stack top-16), upload-toasts.ts | Auto-dismiss a failed upload after about 8 s, and show the reason (for example "Only PDFs, images and Office files"). |
| R2-04 | Activity, sidebar | P3 | flow | Turning Activity on while the sidebar is scrolled down gives no visible change: the icon highlights but the list is above the scroll position. A walker reads this as a dead button. Observed (three clicks, nothing seen until I scrolled up). Also the "Inbox agent / Needs input" row previews "Message from another agent", which does not say what to approve. | /tmp/uxloop8/R2/act4.png, act5.png, act7.png | apps/web/src/pages/Shell.tsx:4539 (ActivityList at top of the scroll area); activity preview fallback text | Scroll the sidebar to the top when Activity opens; preview the pending approval ("Wants to email Jo") instead of the generic text. |
| R2-05 | C16, Finance Burn and Runway at 375 | P3 | visual | Header is two rows (menu icon, then back/title/Ask), about 115 px before content; target was one row under 70 px. Finance home puts the menu on the title row. Observed. | /tmp/uxloop8/R2/m_finance_burn.png, m_rw.png | apps/web/src/pages/finance/* sub-page header, PageHeader.tsx | Put the shell menu button in the title row for sub-pages, as Finance home does. |
| R2-06 | C14, Inbox Archive all | P3 | flow | "Archived 3 Undo" toast had disappeared when I tried to click Undo about 10 s after archiving (screenshot and read time). Not measured exactly; the window may be 5 s. Observed that it was gone, duration suspected. | /tmp/uxloop8/R2/in5.png | apps/web/src/pages/Inbox.tsx undo toast timer | Keep a bulk-archive Undo for at least 10 s, matching the 30 s Legal Undo. |
| R2-07 | C18, Integrations | P3 | visual | At 375 the Blockscout description ends in an ellipsis ("no key..."), and the page scroll height is 1,690 px against the pass-6 result of 1,610 px. Connected cards have an overflow menu only on Blockscout and Coinbase, and Coinbase has no "Used by" row (card heights still match). Observed, measured. | /tmp/uxloop8/R2/int_m.png | apps/web/src/components/integrations/IntegrationsHome.tsx | Wrap descriptions to two lines at 375; keep the page height at or below 1,610 px. |
| R2-08 | C20, Legal contracts | P3 | a11y | Contract names are clipped ("MOCK Insurance Policy - Shieldwe...") with no tooltip, and Renewal clips to "Auto-renews, 30 days ..." on three rows (only the Renewal cell has a title). Observed, measured (first cell has no title attribute). | /tmp/uxloop8/R2/lg1.png | apps/web/src/pages/Legal.tsx contracts table columns | Give the first cell a title, or widen Contract and shrink Term. |

## Praise (observed)

- C13: the tour card now sits beside the sidebar at every stop and the "Ask Chief" chip survives Skip.
- C15: "No mail connected" appears at once for a new user.
- C12: the Reading, Taking longer, Reading took too long chain, each with Try again, is clear.
- C16: Runway with Ask open keeps four KPIs on single lines; the runway chart is clean.
- C19 and C20: right-aligned sheet headers, compact 37 px Legal rows and the full-title Undo line are all correct.

## Not covered

- C13 at 375 (tour placement on a phone).
- C14 empty digest state ("No newsletters in the last 7 days") and Undo click: data changed on reseed and the toast timed out.
- C11 Carta-agent instruction preview.
- Touch-target measurements (no touch emulation applied; none claimed).
