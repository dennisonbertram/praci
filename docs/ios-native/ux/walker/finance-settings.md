# Walk report: Finance, Legal, Cap table, Data room; Settings, models, voice, integrations (round 2)

Method: each catalog story (STORY-078 to 097, 103, 107) was walked against the current multi-frame boards. Screenshots were read for PG-B-Finance, Legal, CapTable, DataRoom, Settings, Models, Voice, Integrations, Account, Consent, PG-B-Rules, PG-A-Home, PH-Home, Main, Inner, Split and Desk. The geometry audit ran once per board. Every hit was a false positive: the bar-chart containers (overlapping flex bars), single-line button labels flagged as wrapped, the Account row avatar versus name offset, and the 436 px overflow on PG-A-Home, which is the multi-frame grid being wider than the test viewport. No real overflow, spill or wrapped label was found.

## Re-check of 26 earlier findings

Resolved 19, still open 7 (F-002 medium, F-007 low, F-009 low, F-012 medium, F-022 low, R1-002 medium, R1-003 low). Details and notes are in finance-settings-findings.json.

## Open by severity

Critical 0, high 0, medium 5, low 6 (4 new findings added this round).

Medium: F-002 Legal no-key blocker undrawn; F-012 first-run provider connect and subscription sign-in states undrawn; R1-002 Change password form undrawn; R2-001 Cap table never-connected frame says Reconnect; R2-002 hosted voice setup form undrawn.

## Story walk

| Story | Result |
|---|---|
| 078 Finance runway, ask agent | Pass. Pages row on Home, tabs, labeled bars, accounts, upcoming, bubble. |
| 079 Hide amounts | Mostly pass. Eye button, masked page, Account switch. Masked chat card undrawn (R2-003). |
| 080 Legal scan | Pass. Default, not scanned, running, failed, blocked-file frames. |
| 081 Legal needs OpenRouter key | NO BOARD for the blocker row (F-002). Models draws key entry only in part (F-012). |
| 082 Carta connect | Mostly pass. Wording of Not connected (R2-001). |
| 083 Data room upload, search | Pass. Uploading, failed, results, empty. Folders mixed under Recently added (F-022). |
| 084 Share file to agent | Mostly pass. Ask about this file and composer sources drawn; picker undrawn (R2-004). |
| 085 Duo, laptop | Finance pass (Desk). Other pages rule-card only (F-007). |
| 086 Glance and badges | Pass on PG-A-Home, PH-Home, Main, Split. |
| 087 Open Settings | Pass. Identity inconsistencies remain (F-009). |
| 088 Default model | Pass. Menus and after-choice state drawn. |
| 089 Hosted provider | Partial (F-012). |
| 090 Local server | Pass. |
| 091, 092 Voice | Device, hosted, unavailable, denied, consent drawn; hosted setup undrawn (R2-002). |
| 093, 097 Integrations | Pass. Add, pending, detail, server credentials with error frame. |
| 094 AI data sharing | Pass. Consent sheet and Settings page. |
| 095 Password, archived bots | Archived bots pass; Change password form NO BOARD (R1-002). |
| 103 Finance laptop | Pass. |
| 107 Settings inner | Rule card only; no inner Settings board. Counted under F-007. |

## Design rule check

Glass stays on the strip and floating controls; content is solid. One prominent action per view holds, including the file view (Ask about this file) and Models (Add server). Product name is Praci. No new rule violations.
