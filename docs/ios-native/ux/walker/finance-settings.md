# Walk report: Finance, Legal, Cap table, Data room; Settings, models, voice, integrations (round 1)

Method: each catalog story (STORY-078 to 086, 087 to 097, 103, 107) was walked against the boards that draw each step. Boards are static mockups. Screenshots were read for every board cited. The geometry audit ran once per board used (PG-A-Home, PG-B-Finance, PG-B-Legal, PG-B-CapTable, PG-B-DataRoom, PG-B-Settings, PG-B-Models, PG-B-Voice, PG-B-Integrations, PG-B-Account, PG-B-Consent, PH-Home, Desk, Inner). Hits were checked against screenshots: wrapped-control flags (Find models, Disconnect, Allow, Sign out) and avatar/row width differences are false positives, since every label sits on one line. The only measured drift is the 4 px dot-versus-label offset in the Cap table legend, which is too small to log. No page overflow on any board.

## Result of re-check (22 earlier findings)

- Resolved (2): F-001 (outer Home and PH-Home now draw a Pages section with Finance [N] mo and Legal 2) and F-017 (page rows open the page, agent rows open chat, each page has the bubble to its agent).
- Still open (20). F-009 is reduced to low (Settings now has one Account row and PG-B-Account exists; only AB vs SR initials and X vs Done remain). F-010 is reduced to high-to-medium (AI data sharing, consent sheet, Account, sign out and delete are drawn; Archived bots, Change password page and device preferences are not).

## Open by severity

Critical 0, high 5, medium 11, low 8.

High: F-002 Legal states, F-003 Cap table states, F-005 Data room states and Ask about file, F-007 laptop and inner boards for Legal, Cap table, Data room, F-012 provider detail and sign-in.

## Story walk

| Story | Steps drawn | Steps with NO BOARD | Verdict |
|---|---|---|---|
| 078 Finance runway, ask agent | Entry (PG-A-Home Pages), page, tabs, bars, bubble | Account/transaction detail, null runway, refresh progress | Entry fixed. Tabs say 30 days but bars are 12 unlabeled (F-006). |
| 079 Hide amounts | Eye button, DS-07 specimen | Masked page, masked chat card | Open (F-008). |
| 080 Legal scan | Healthy page | Scan running, result, deadline detail, consent | Open (F-002). |
| 081 Legal blocked, add key | Models page | Blocker row, return to Legal | Open (F-002, F-012). |
| 082 Carta connect | Connected state | Not connected, pending, contact form, holder detail | Open (F-003, F-004, F-021). |
| 083 Data room upload, search | List, DS-07 upload rows | Upload, results, preview | Open (F-005, F-022). |
| 084 Share file to agent | none | File action, composer attachment | Open (F-005). |
| 085 Duo and laptop | Finance Desk only | Legal, Cap table, Data room inner and laptop; inner entry rows | Open (F-007, R1-001). |
| 086 Glance and badges | PG-A-Home, PH-Home Pages rows with glance | Data room waiting glance, inner sidebar | Mostly fixed; inner open (R1-001, R1-004). |
| 087 Open Settings | PG-B-Settings, PG-B-Account | Entry control label (avatar AB vs SR) | Mostly fixed (F-009). |
| 088 Default model | Models resting | Menus, after-choice state, backups | Open (F-011). |
| 089 Connect hosted provider | Provider rows | Provider detail, connecting, error | Open (F-012). |
| 090 Local server | Add a server field | Separate Found state, LAN placeholder | Open (F-013). |
| 091, 092 Voice | Voice page | Device-only, hosted-only, not connected, permissions, model picker | Open (F-014, F-015). |
| 093 to 097 Integrations | Catalog, setup sheet | Not-added row, pending, app detail | Open (F-016). |
| 096 Password and archived bots | Account (Change password row), Settings rows | Change password form, Archived bots list | Open (F-010, R1-002). |
| 103 Finance laptop | Desk | Period tabs and accounts on bottom half | Open (F-006, F-007). |
| 107 Settings inner | Rule card only | Inner board | Open (F-007 pattern). |

## Design rule check

Glass stays on the strip; content is solid. One prominent action per view holds on Settings, Models, Voice and Integrations setup. On the four page boards the prominent action is the unlabeled bubble (F-018). Product name is Praci (Account sign-out sheet). No new rule violations.

## Findings

See finance-settings-findings.json for the full list with status and notes. New this round: R1-001 (inner sidebar lacks Pages, medium), R1-002 (Change password reachable two ways, low), R1-003 (rule cards still say sidebar row, low), R1-004 (Finance shown three times on outer Home and Personnel pushed down, low).
