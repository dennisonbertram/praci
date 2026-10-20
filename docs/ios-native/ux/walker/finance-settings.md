# Walker report: Finance, Legal, Cap table, Data room; Settings, models, voice, integrations

Target: planned native iPhone app (epic #427). Method: each step judged against the board that defines it (screenshots viewed, boards opened live for the geometry audit). Findings are in `finance-settings-findings.json` (F-finance-settings-001 to 022).

Legend: pass / warn / fail. NO BOARD counts as fail (happy-path finding).

## Geometry audit (live, per board)

| Board | Result |
| --- | --- |
| PG-B-Finance | clean (one uneven-row flag on the burn header: label and amount differ in width, expected) |
| PG-B-Legal | clean |
| PG-B-CapTable | flags on ring legend rows and ring/legend card: swatch, label and percent have different widths and 4-8 px top drift. Screenshot shows aligned rows; not a defect |
| PG-B-DataRoom | clean |
| PG-B-Settings | clean |
| PG-B-Models | clean (script flags 'Find models' as wrapped; screenshot shows one line, false positive) |
| PG-B-Voice | clean (avatar tile vs two-line text drift, and 'Disconnect' flag are false positives) |
| PG-B-Integrations | clean (script flags 'Get credentials' as wrapped; one line in the screenshot) |
| Desk | clean (header gap flag is the intentional left/right split) |
| PG-A-Home | viewed for entry points only, not audited |

## Stories

### STORY-078 Check runway and cash, ask the Finance agent
- 1 Reach Finance from Home: NO BOARD (fail, F-001)
- 2 Load: PG-B-Finance, KPIs, Accounts, Upcoming drawn; loading skeleton and null runway not drawn (warn, F-020)
- 3 Tap 90 days: PG-B-Finance, tabs drawn, no changed-state; 30 days tab with a monthly chart is odd (warn, F-006)
- 4 Tap highlighted bar: PG-B-Finance, no month label on bars (fail, F-006)
- 5 Ask Finance agent: PG-B-Finance, unlabeled bubble, one prominent action (warn, F-018)
- 6 Send question: Desk shows the exchange (pass)

### STORY-079 Hide amounts
- 1 Tap the eye: PG-B-Finance draws the button; hidden state only in DS-07 (warn, F-008)
- 2 Chat card masked: NO BOARD (fail, F-008)

### STORY-080 Scan now on Legal
- 1 Open Legal: NO BOARD for entry (F-001); page itself PG-B-Legal (pass, duplicate scan icon F-019)
- 2 Scan: NO BOARD for progress (fail, F-002)
- 3 Contract rows: PG-B-Legal (pass, no chevrons, F-019)
- 4 Deadlines tab: deadline rows only in DS-07 (warn)
- 5 Deadline detail: NO BOARD (fail)

### STORY-081 Legal blocked, add OpenRouter key
- 1 Blocker row: NO BOARD (fail, F-002)
- 2 Open Models: PG-B-Models (pass)
- 3 Enter key: NO BOARD (fail, F-012)
- 4-7 Return, scan, results: NO BOARD for refresh and scan states (fail, F-002)

### STORY-082 Connect Carta, read ownership, add contact
- 1-5 Not connected, Safari, pending, syncing: NO BOARD (fail, F-003); PG-B-Integrations pending alert only described
- 6 Ring: PG-B-CapTable (pass)
- 7-8 Holders and holder detail: PG-B-CapTable shows categories, not holders (fail, F-004)
- 9-11 Contact form: NO BOARD (fail, F-003)
- 12-14 Refresh and Ask Carta agent: bubble drawn (pass, F-018)

### STORY-083 Upload to Data room and search
- 1 Open: entry NO BOARD (F-001); list PG-B-DataRoom (pass, folders mixed in, F-022)
- 2 Plus: drawn (warn, unlabeled F-018)
- 3-4 Upload row: NO BOARD on the page; specimen in DS-07 (fail, F-005)
- 5-6 Search and preview: NO BOARD (fail, F-005)

### STORY-084 Share a Data room file with an agent
- 1 Search: NO BOARD for results (fail)
- 2 Ask Data room agent: PG-B-DataRoom bubble (warn, no file carried)
- 3-4 Mention file: PG-A-Thread has no Data room attachment (fail, F-005)

### STORY-085 Four pages on Duo, inner, laptop
- 1-2 Outer Finance: PG-B-Finance (pass)
- 3-5 Inner and half-folded: rule text only, Split/Inner show Inbox only (fail, F-007)
- 6 Laptop: Desk (pass for Finance, but bottom half differs from the rule, F-007)
- 7-14 Legal, Cap table, Data room inner and laptop: NO BOARD (fail, F-007)
- 15-20 Thread in third column, restoration, space switch: NO BOARD (fail, F-007)

### STORY-086 Sidebar glance and badges
- 1 Home: PG-A-Home shows agent rows only (pass for rows)
- 2 Glance values: NO BOARD (fail, F-001)
- 3 Tap Legal: opens chat; page row undrawn (fail, F-017)

### STORY-087 Open Settings and read state
- 1 Profile to Settings: Home draws an 'AB' avatar button; Settings shows 'SR Sam Rivera' (warn, F-009)
- 2 Read values: PG-B-Settings, '[N]' placeholder (warn)
- 3 Done: board draws X, not Done (warn, F-009)

### STORY-088 Change default model and thinking
- 1 Models: PG-B-Models (pass)
- 2-5 Menus: not drawn; success line shown at rest (warn, F-011)
- 6 Back: pass

### STORY-089 Connect hosted provider with key
- 1 Providers: PG-B-Models (pass)
- 2-4 Provider detail, key, connect: NO BOARD (fail, F-012)
- 5-6 Default row and Done: partial (warn)

### STORY-090 Add local model server
- 1-3 Field and Find models: PG-B-Models (warn, duplicate URL and result line at rest, F-013)
- 4-5 Found-model picker: NO BOARD (fail)
- 6-7 Save and default: NO BOARD (fail)

### STORY-091 Device voice sample
- 1-2 Voice page and switch: PG-B-Voice (pass; both voices appear on, F-014)
- 3 Hear a sample: icon-only bubble, one prominent action (warn, F-014)
- 4 Back: pass. Permissions: NO BOARD (F-015)

### STORY-092 Hosted voice provider
- 1 Not connected: NO BOARD (fail, F-014)
- 2 Connected: PG-B-Voice (pass)
- 3-4 Speech model and voice pickers: NO BOARD (fail, F-014)
- 5-6 Sample and consent: NO BOARD for consent (fail, F-015)

### STORY-093 Connect Calendar (Safari round trip)
- 1 Catalog: PG-B-Integrations (pass; Calendar already shown Added, F-016)
- 2 Search results: NO BOARD (fail, F-016)
- 3-6 Add, working, Safari, pending, moved to Connected: NO BOARD (fail, F-016)
- 7-9 App detail, second account: NO BOARD (fail, F-016)

### STORY-094 AI data sharing
- 1 Row: PG-B-Settings (pass)
- 2-5 Page, switches, withdraw alert: NO BOARD (fail, F-010)

### STORY-095 Change password, restore archived bot
- 1-3 Change password form: NO BOARD (fail, F-010)
- 4-6 Archived bots list, restore: NO BOARD (fail, F-010)

### STORY-097 Server credentials (Advanced)
- 1 Advanced row: PG-B-Integrations (pass)
- 2-4 Method, credentials, Get credentials: drawn on the right sheet (warn: error at rest, strong secondary button, field list, F-016)
- 5-6 Continue, success: checkmark drawn, spinner not drawn (warn)
- 7 Skip: X drawn (pass)

## Flow Log

- Designed vs ideal. Finance (78): ideal 6, drawn 4 of 6 steps. Legal (80): 2 of 5. Cap table (82): 3 of 14. Data room (83): 1 of 6. Models first run (89): 2 of 6. Calendar connect (93): 1 of 9 plus the sheet for 97. The healthy-state page of each screen is drawn; the first-run, loading, error and detail states are mostly text only.
- Hesitation points: finding the four pages (no entry); Cap table 'Holders' that are categories; Models success line shown before any action; Voice with two voices on; Integrations error shown at rest.
- Duplicated information: Cap table legend vs Holders list; Legal summary row vs Deadlines tab and a second scan icon; Models Local server URL vs Add a server placeholder; Finance chart named burn on one board and spend on another; agent row and page for the same capability.
- Design rules check: glass only on the side strip and bubble (pass); one prominent bubble per page (pass, but Integrations setup sheet has competing 'Get credentials' button); concentric corners look consistent; at most three glass groups (pass, two groups plus bubble).
