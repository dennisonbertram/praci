# Walk R2 (pass-5 verification, clusters C10-C18)

Demo stack (web 5381), Maya Chen / Northwind Robotics. Desktop 1440x900; phone 375x812 with pointer: coarse emulation (CDP touch emulation). Screenshots in /tmp/uxloop6/R2/. Measured in a dev build while other walkers shared the stack; timings are not production numbers.

## Verdicts

- C10 Legal first visit: PASS (3 steps vs 3 ideal). Plain consent card "Let Praci read your contracts" with one Allow button; no Muse Spark / OpenRouter / space wording; no Scan now, no stat tiles, no empty Status column; deadline rows have distinct first lines; Overdue badge and sidebar badge agree.
- C11 Touch targets: FAIL (partial). Finance subscription rows are 44 px full-width links (pass). Settings switch rows still fail (Privacy and approvals: 20 px rows, 32 px pitch, plain div not label; Advanced: 36-40 px rows). Inbox row checkboxes are 16x16 with measured hit area about 38x30. Mercury detail and Used by rows are about 43-44 px (ok).
- C12 Phone headers: PASS with one regression. Menu is inline with the title on Inbox, Data room, Integrations, Finance, Cap table; first Data room row starts at y~170. Finance on phone shows no company name at all (R2-02). Inbox thread subject not re-walked.
- C13 Integrations: FAIL (partial). Mercury detail shows the Mercury logo (pass); phone connected cards are compact (pass); phone page height 2660 px (target 2200); Gmail and Carta still have no overflow menu, Coinbase has no Used by, four cards say Open Finance, button widths differ.
- C14 Loading: PASS (partial). Artifacts, Contacts and Activity show row skeletons at 50-100 ms, content in 0.5-0.7 s. Not verified: bootstrap retry before "Still opening...", production timings.
- C15 Search: PASS. Sidebar Search opens the same palette. "halcyon": contacts show company with match underlined; each chat once with date and snippet; no Message badge. "pilot" likewise.
- C16 Run status: PASS. After "Ask Finance what our monthly burn is." Chief's sidebar preview became "Current monthly burn is $67,621.16, base..."; Activity label and thread agree. Seeded "Finance helper (mock) Working..." never ends (seed noise).
- C17 Data room Reading: PASS (partial). One file Reading: no processing strip. Failed file offers Try again at once. UNVERIFIED: 15-minute Reading-to-Failed (Board Minutes still Reading, stack age borderline), "still being indexed" agent note.
- C18 Cap table: PASS (partial). 10,000,000 appears once; caption "SAFEs are not in the share counts"; header only Ask (plus refresh); tab bar stays at the same y on All/Investors/Options; phone first holder at y~300, tabs one scrolling row. Rows without a contact open an editable form, not a read-only card (R2-08).

## Findings

| id | page/story | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R2-01 | C11 Settings (phone, coarse) | P2 | a11y | OBSERVED. Switch rows 20 px (privacy) and 36-40 px (advanced), 32x18 switch, div label not label element; expected 44 px rows. | m_set2.png; row 279x20, no label | ApprovalRulesSettings.tsx; AccountSettingsOverlay.tsx:292-330 | Make each switch row a label with min-h-11 under pointer-coarse. |
| R2-02 | C12 Finance (phone) | P2 | flow | OBSERVED. Company name absent from the Finance header at 375 (only dot and sync icon); Maya cannot tell which company. | m_fin.png | Finance.tsx header ~403-430 | Show the company name on the second header line; drop only the sync text. |
| R2-03 | C11 Inbox rows (phone, coarse) | P2 | a11y | OBSERVED. Checkbox 16x16, hit area about 38x30 (elementFromPoint); expected 44x44. | m_inbox.png | InboxRow.tsx:284-289 | Give the checkbox a 44x44 hit wrapper not overlapping the row button. |
| R2-04 | C13 Integrations (phone) | P2 | visual | OBSERVED. Scroll height 2660 vs 2200 target; connected cards compact, remainder is the Popular catalog. | m_int.png | IntegrationsHome.tsx | Collapse Popular after 3 apps on phone. |
| R2-05 | C13 Integrations (desktop) | P2 | visual | OBSERVED. Connected cards differ: no menu on Gmail/Carta, no Used by on Coinbase, 4x "Open Finance", button widths differ. | c13a.png | IntegrationsHome.tsx footer | Same footer slots and min button width on every connected card. |
| R2-06 | C14 phone hard load | P3 | perf | OBSERVED once, dev only. Hard load of an Integrations detail and Cap table on phone stayed on skeleton 10-15 s; desktop about 4 s. Cause not isolated. | m_mcp.png, m_cap.png | Shell.tsx bootstrap | Re-measure on production build before acting. |
| R2-07 | C16 sidebar | P3 | copy | OBSERVED. Two "Inbox agent" rows (broken-mail spaces) have no preview line. | sidebar eval | Shell.tsx row preview | Show the space state as preview. |
| R2-08 | C18 Cap table rows | P3 | flow | OBSERVED. Holder row without contact opens "Add email for Alex Firmware (Mock)" editable form (Kind Other) rather than a read-only card. | c18c.png | CapTable.tsx onOpen | Open a read-only holder card with an Add email action. |
| R2-09 | C18 Cap table | P3 | visual | OBSERVED. Table ends x=1368 vs content x=1412; phone row meta cut mid-word ("Co...", "Independen..."). | c18b.png, m_cap.png | CapTable.tsx | Fill content width; drop secondary meta on phone. |
| R2-10 | Sidebar drawer (phone, coarse) | P2 | a11y | OBSERVED (outside C11 list). Page rows 40 px, Activity/Close/Create 32x32, "Actions for" buttons 28x28. | geometry eval, drawer open | Shell.tsx sidebar | Raise to 44 px under pointer-coarse. |
| R2-11 | C17 Data room | P3 | flow | OBSERVED. A Reading row shows no age so stuck vs slow is unclear. | c14b.png | ItemRows.tsx | Show "Reading for N min" after 2 minutes. |

Excellent: palette search with match reasons (C15); Legal first visit is one plain-words card; delegated Chief preview shows the real answer; Cap table is much simpler. Console showed no errors.

Skipped/unverified: C12 thread subject on phone; C14 bootstrap retry; C17 timeout and indexing note.
