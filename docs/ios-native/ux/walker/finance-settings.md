# Walk report: Finance, Legal, Cap table, Data room; Settings, models, voice, integrations (round 3)

Method: each catalog story (STORY-078 to 097, 103, 107, 123) was walked against the current multi-frame boards. Screenshots were read for PG-B-Finance, Legal, CapTable, DataRoom, Settings, Models, Voice, Integrations, Account, Consent, PG-A-Home and Split; PG-B-Rules, DS-07, PH-Home, Main, Inner and Desk were checked by reading their markup for the specific text in question. The geometry audit ran once per board (12 boards). Every hit was a false positive: single-line button labels reported as wrapped, icon-plus-label rows with different widths, the Account profile row offset, and page overflow caused by multi-frame grids wider than the 1440 px viewport. No real clipping or overflow was found.

## Re-check of 30 earlier findings

Resolved 24 (5 this round), still open 6. Details are in finance-settings-findings.json.

Resolved this round: F-002 (Legal no-key blocker now drawn), F-012 (first-run provider connect and sign-in states), R1-002 (Change password page), R2-001 (Cap table never-connected wording), R2-002 (hosted voice setup).

## Open by severity

Critical 0, high 0, medium 1, low 9 (4 new findings).

Medium: R3-001 inner Settings has no board and the rule card conflicts with the inner sidebar.

Low: F-007 (laptop pose for Legal, Cap table, Data room is rule-card only), F-009 (Alex Morgan vs Sam Rivera; X vs Done), F-022 (folders under Recently added; sharing chips), R1-003 (rule cards say "sidebar row"), R2-003 (masked chat finance card), R2-004 (Data room picker), R3-002 (Add holder Role shows a person), R3-003 (Settings rule card lists Change password), R3-004 (catalog still describes period tabs).

## Story walk

| Story | Result |
|---|---|
| 078 Finance runway, ask agent | Pass on boards: Pages row, 12-month chart, accounts, upcoming, loading, sync failed, bubble. Catalog text is stale (R3-004). |
| 079 Hide amounts | Mostly pass. Masked page and Account switch; masked chat card undrawn (R2-003). |
| 080 Legal scan | Pass. Default, unreadable file with Try again / Replace file, not scanned, running with Cancel, failed, Deadlines tab, contract detail. |
| 081 Legal needs OpenRouter key | Pass. Blocker frame with Open Models, then Models. |
| 082 Carta | Pass. Connected, expired, never connected, pending with Cancel, syncing, Add holder, holder detail. Minor sample text (R3-002). |
| 083 Data room upload, search | Pass. Folders mixed under Recently added (F-022). |
| 084 Share file to agent | Mostly pass. Ask about this file, overflow menu, composer sources; picker undrawn (R2-004). |
| 085 Duo, laptop | Finance pass (Split, Desk). Others rule-card only (F-007). |
| 086 Glance and badges | Pass on PG-A-Home, Split, Main. Pages also include Artifacts and Team computer. |
| 087 Open Settings | Pass. Identity mismatch (F-009). |
| 088 Default model | Pass. Menus and after-choice state. |
| 089 Hosted provider | Pass. Empty, rejected, saved key; Acme sign-in code, waiting, failed. |
| 090 Local server | Pass. Finding, found, none found, unreachable with Retry. |
| 091, 092, 123 Voice | Pass. Device, hosted, unavailable, denied, hosted setup frames. |
| 093, 097 Integrations | Pass. Pending, writes confirm, remove confirm, server credentials verifying, error, saved. |
| 094 AI data sharing | Pass. Switches, Allowed without asking list with remove confirm, in-thread Model A off prompt. |
| 095 Password, archived bots | Pass. Change password states and Archived bots. |
| 103 Finance laptop | Pass (Desk). |
| 107 Settings inner | NO BOARD (R3-001). |

## Design rule check

Glass stays on the strip and floating controls; content is solid. One prominent action per view holds (Save password, Connect, Retry, Continue). Product name is Praci. Bot avatars match the shipped shapes. No new rule violations.
