# Walk R1 (uxl18-R1): verification of pass-17 clusters C1-C10

Target: mock-data demo (web 5381). Desktop 1440x900 plus 1920, 1280, 1024, 768 and an iPhone 12 viewport with touch emulation (`pointer: coarse` verified true via CDP). A fresh user (walker-r1-*@northwind.example.test) was used for C2 and C9; its Gmail was connected through the demo's emulated Gmail. Screenshots: /tmp/uxloop18/R1/.

## Verdicts

| Cluster | Verdict | Steps (actual/ideal) | Evidence |
|---|---|---|---|
| C1 Inbox Undo vs approval toast (phone) | PASS | 3/3 | Archive with approval toast pending at 390x844: undo notice y 792-828, toast y 666-784, no overlap; Undo restored the mail. 3-line toast body shown in full (c1-undo.png). Desktop placement unchanged (inbox.png). |
| C2 Investors Equity raised on first visit | PARTLY / not verifiable | n/a | Code: `safesList` runs the throttled sync with PAGE_SYNC_MS 20 s (apps/api/src/fundraising.ts:70-74). Mock founder shows Equity raised $250,000 (c2-mock.png) but it was already warm. Fresh user: Mercury connect popup stayed on "Loading..." so the first-visit path could not be run. Throttle and Mercury-down criteria not exercised. |
| C3 Finance non-USD account | PASS | 2/2 | "5 bank accounts · 1 not counted" visible without hover (c3-finance.png). Cash accounts ordered 1,150,000 / 412,421 / 60,000 / 10,500 / 300 (c3-accounts.png). |
| C4 Legal columns, one scan button, Undo row | FAIL (partly) | 3/3 | One button ("Scan now") PASS. Undo row 37 px PASS (c4-undo.png). Truncation NOT fixed: see R1-18-01. |
| C5 Data room columns | PARTLY | 2/2 | Failed row keeps pill and reason PASS. At 1920 Parties show in full (c5-1920.png). At 1440 Parties truncate and Type truncates: see R1-18-02. |
| C6 Failed count vs new dot | PASS | 1/1 | Sidebar row shows red "1", accessible name "Data room, 1 file failed". Dot-for-unseen branch order confirmed in sidebar-glance.tsx:30-31. The unseen>0 plus failed combination was not separately forced. |
| C7 Settings switches, pane alignment, sign-up | PASS | 5/5 | With pointer coarse every switch row is 44 px high and the label is inside the row; elementFromPoint on label and row centre resolves to the label/switch. General, Privacy first card at x=32, y=131; Models and Memory content start at the same x. Sign-up Create account button y 630 before and after the error (c7-signup.png). Memory still has no card (R1-18-04). |
| C8 Tour restore after reload | PASS | 5/5 | Step 4/9, reload, still 4/9 (c8-reload.png). After Skip tour and reload the tour stays closed. |
| C9 First mail sort | PARTLY / FAIL on one criterion | 2/2 | Wait note "Sorting your mail..." visible within 5 s of Allow; groups appeared at 15-20 s. No skeleton text before consent. Needs reply holds 19 of 22 sorted Important-tab mails (86%), criterion is under 40%: see R1-18-03. |
| C10 Bot settings panel below 1280 | PASS | 2/2 | At 1024 and 768 the chat is dimmed by a scrim and Escape closes the panel (c10-1024.png, c10-768.png). At 1280 the layout is unchanged and the Send/Stop button is visible (c10-1280.png). |

## Findings

| id | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|
| R1-18-01 | P2 | visual | OBSERVED, cluster C4 not met. At 1440 Contract names still cut ("MOCK Office Lease - 100 Placeholder Stre..."), Renewal cut ("Auto-renews, 30 days no..."), Term cut ("Dec 2, 2025 - Dec 2, 2..."). Column widths: Contract 299, Parties 203, Term 171, Renewal 182, Value 85, Next deadline 128. Expected all of that text readable. | c4-legal.png; 7 truncated cells measured | apps/web/src/pages/legal/LegalContracts.tsx:162-169 | Size Value and Next deadline to content, give the rest to Contract and Renewal, and shorten the Term format. |
| R1-18-02 | P2 | visual | OBSERVED, cluster C5 partly. At 1440 Name 351, Type 112, Parties 176, Status 80. Type "Investor docu..." now truncates (new), Parties "Delta Desk Rentals (Mo..." truncates while the empty Status column keeps 80 px. Rows are 56 px because of the folder-path subtitle, so the 40 px row criterion cannot hold. | c5-dataroom.png, c5-1920.png | apps/web/src/components/data-room/ItemRows.tsx:206-213 | Widen Type to fit "Investor document", move the Failed pill into the Name cell, and give Parties the freed width. |
| R1-18-03 | P2 | flow | OBSERVED, cluster C9 not met. Fresh user after Allow: Needs reply 19 mails, other groups 1 and 2 (about 86%). Expected under 40%. Time to groups 15-20 s (note appears by 5 s). | c9-c.png | apps/api inbox triage prompt/threshold | Restrict Needs reply to mail that asks the user something; check the triage fixture and threshold. |
| R1-18-04 | P3 | visual | OBSERVED. Settings Memory pane has no card, unlike General, Privacy and Models; the heading and text sit directly on the pane. | c7-Memory.png | apps/web/src/pages/SettingsOverlay.tsx | Wrap the Memory content in the same card. |
| R1-18-05 | P3 | flow | OBSERVED. Finance says "1 not counted" but the Accounts page lists only the five counted accounts, so Maya cannot see which account is left out. | c3-accounts.png | apps/web/src/pages/Finance.tsx:441-447 and the Accounts page | List the excluded account with a "not counted" tag. |
| R1-18-06 | P3 | visual | OBSERVED. Fresh Inbox before consent shows five blank skeleton bars beside the consent card for over 10 s with no text; looks stalled. | c9-a.png, c9-b.png | apps/web/src/pages/Inbox.tsx | Show the mail rows (or nothing) until consent is answered instead of blank bars. |
| R1-18-07 | P3 | visual | OBSERVED. Sign-up with an existing email marks the Password field red as well as Email. | c7-signup.png | sign-up form | Mark only the field named in the error. |

Not covered: real Mercury connect (popup stayed on "Loading...", treated as BLOCKED), first-visit Investors sync on a fresh space, console error review.
