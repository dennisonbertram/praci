# Walk R2 (iteration 16): verify pass-15 clusters C11-C20

Demo stack 5381, 1440x900 unless noted. Screenshots in /tmp/uxloop16/R2/. Hide amounts flipped on/off by itself during the walk (the user is shared with other walkers; not treated as a bug).

## Verdicts (actual steps / ideal)
- C11 Legal table, phone cards, Reopen: PASS (6/5). Rows 48 px, cell text tops within 1 px (01-legal.png). Phone shows 7 contracts with no repeated labels; with Hide amounts on no Value line (06, 08). Done deadline has Reopen and returns to open (04, 05).
- C12 Activity: PASS (3/3). With sidebar scrolled, Activity opens in view (11); bot rows already in Activity are not repeated in the list. No count shown, but only one item waits.
- C13 Legal scan: PASS with notes (4/3). Re-scan kept 9 deadlines; progress "Reading 0 of 3" then "Saving results..."; banner has "Check now" and it works (09, 10). Notes F-R2-01, F-R2-02.
- C14 Bot-delegated payment: PARTIAL PASS (6/4). Known recipient: Mercury approval toast and composer "Waiting for approval" (26), Deny recorded (27). Unknown recipient: reply links to Integrations (F-R2-03). "Open Mercury agent" link in docked chat did not navigate once (unverified, F-R2-04).
- C15 Toast vs docked chat: PASS (4/3). Legal agent asked a question while docked, no toast (19); a toast did show when Legal was not docked.
- C16 Raised figure: PASS (5/4). Update draft says $250,000, same as Investors page (16).
- C17 Empty Investors/Fundraising: PASS (4/3). Empty space shows connect buttons and "No ... yet", no skeletons (32, 33).
- C18 Inbox skeleton/filter: PASS (3/3). Skeleton rows are h-[57px] in code (Inbox.tsx:1673); real rows 57 px apart; Filter menu has no second "Important" (37). The one-row 36 px skeleton at Inbox.tsx:1623 is a different state.
- C19 Cold load: FAIL on call counts (3/2). Page header and list render within 1.2 s (34), but one load issues 5 bots/list and 4 routines/list (was 16). Criterion is 1 each. Also bootstrap x3 (may be dev double mount).
- C20 Phone/touch polish: PARTIAL (5/4). Page rows are links except GTM (button). Touch emulation unavailable (pointer: coarse stayed false), so sticky hover unverified; code still has unguarded hover:bg-muted at InboxRow.tsx:314. Tool tally and NEW divider not checked. F-R2-05.

## Findings
| id | story | sev | cat | what / expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R2-01 | C13 | P3 | visual | After a scan adds a non-active row the Status column appears and the Contract column drops from about 190 px to about 150 px, so names truncate harder (observed) | 10-scan-end.png | LegalContracts.tsx column widths | Reserve the name width or hide Status unless needed |
| R2-02 | C13 | P3 | flow | Deadlines tab count dropped 9 to 8 during "Saving results" and returned to 9 at the end (observed twice) | poll output during second scan | Legal scan merge in apps/api | Write deadlines in one transaction or keep count stable |
| R2-03 | C14 | P3 | copy | "no matching recipient ... Add X as a recipient at the bank" ends with "Open Integrations", where a recipient cannot be added (observed) | 23-fin-pay2.png, 25-mercury-chat.png | apps/api executor.ts payment refusal | Drop the Integrations link for this case |
| R2-04 | C14 | P2 | bug | Clicking "Open Mercury agent" in the docked Finance chat left the URL at /app/finance (observed once; href was /app/<botId>; opening that URL works; not re-reproduced) | 24-mercury.png | docked chat link handling | Make docked chat links navigate or open that agent in the dock |
| R2-05 | C20 | P3 | a11y | GTM sidebar row is a button, other page rows are links (observed in DOM); InboxRow hover not guarded for touch (code only) | DOM query | Shell.tsx:4685, InboxRow.tsx:314 | Render GTM as a link when the agent exists; use hover: only under (hover: hover) |
| R2-06 | C19 | P3 | perf | 5 bots/list and 4 routines/list per load | network requests list | Shell data layer | Share one request per load |
| R2-07 | C20 | P3 | consistency | With several spaces, Legal, Finance, Inbox show the space name and switcher; Investors, Fundraising, Contacts, Artifacts do not (at 375 and Investors/Fundraising at 1440) | sp-grid.png, 32-empty-inv.png | PageHeader.tsx | Same treatment on every page |
| R2-08 | incidental (C10) | P3 | visual | Finance burn chart still draws the partial month Oct* as two stacked dots that read as "8" | 21-finance.png | Finance chart | Out of my scope; recheck in C10 |

Praise: Legal table at 1440 is clean; empty Investors/Fundraising pages are quiet; the delegated payment card and "Waiting for approval" work end to end.

Skipped: C20 tool tally, NEW divider width, touch hover (no touch emulation).
