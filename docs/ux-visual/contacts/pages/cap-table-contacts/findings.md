# Findings: Cap table contacts list (2026-10-20)

Evidence is in `shots/` and `audit.json` in this folder.

| id | level | problem | evidence | sev | found by | verified |
|----|-------|---------|----------|-----|----------|----------|
| C1 | group | At 1280 with the Carta panel open, the table is 524px wide. Shares is hidden, Name is 131px (10 of 11 truncate), and Email gets 201px while 5 rows show only a dash. | shots/1280-all-tab-scrolled.png | P1 | own, muse, argon | measured |
| C2 | component | Column proportions are fixed rather than set by content; names over about 22 characters truncate at 1440. | shots/1440-after-save-long-row.png | P2 | own | measured |
| C3 | layout | The Carta panel is 384px and mostly empty, and it squeezes the list. | shots/1440-all-tab.png | P2 | own | measured |
| C4 | layout | At 1920 there is about 375px of empty space between Email and Kind. | shots/1920-all-tab.png | P2 | own, muse, argon | observed |
| C5 | layout | The chart card pushes the list to y=740 of 900 at 1440. | shots/1440-all-tab.png | P2 | own | measured |
| C6 | component | At 375, holder cards drop the share count. | shots/375-all-tab.png | P2 | own, muse, argon | observed |
| C7 | component | At 375, contact cards show an unlabelled dash. | shots/375-all-tab.png | P2 | own, muse, argon | observed |
| C8 | component | At 375 the six tabs wrap to two rows. | shots/375-auditors-tab.png | P2 | own, muse, argon | observed |
| C9 | group | The Auditors empty state keeps Search and "Sort: Ownership" active, and Add auditor appears twice. | shots/1440-auditors-tab.png | P2 | own, muse, argon | observed |
| C10 | component | Only the 105x20 name button opens a contact; the rest of the row does nothing and the cursor is the default. | audit smallTargets | P2 | own | measured |
| C11 | group | The Security filter appears only on All, and Sort wraps at 1280 and 375. | shots/1280-all-tab-scrolled.png | P3 | own, muse, argon | observed |
| C12 | component | A long name in the delete notice wraps to 3 lines and covers the last row. | shots/1440-deleted-undo.png | P3 | own, muse, argon | measured |
| C13 | component | Focus falls to `body` after Undo. | measured | P3 | own | measured |
| C14 | component | At 768 the header truncates and "Updated 3h ago" wraps with a stray "·". | shots/768-top.png | P3 | own | observed |
| C15 | group | The sidebar search and the table search both read only "Search". | shots/1440-all-tab-scrolled.png | P3 | muse, own | observed |

## Excellent as is
- Delete and Undo work end to end.
- Truncation never breaks the layout.
- Only cap-table kinds appear.
- 768 is clean.
- Numeric columns are right-aligned.
