# Walk R2 (iteration 12): verify pass-11 fixes C11-C20

Target: mock demo stack (web :5381), 1440x900 unless noted; phone checks at 375x812. Screenshots in /tmp/uxloop12/R2/. Touch emulation (pointer: coarse) was not available, so the 44 px notification row is code-read only.

## Verdicts

- C11 Activity panel: PARTIAL FAIL. Panel now shows about 5 rows and Filter is a popover (fixed). The heading is still "Needs you" over a row label "Needs your answer"; the list cuts a row in half at its bottom edge. Steps 3/3.
- C12 Inbox dialog + reply: PASS. At 1440 with Ask agent open, body and To line are fully visible; after Reply, Send, Esc the list stays at the top. Send shows "Sending..." for about 10 s, then a "Sent" row in the thread (no separate toast seen). Phone To line not re-checked. Steps 7/6.
- C13 Empty Fundraising ghost rows and Draft reply indicator: FAIL. Round and Pipeline still show grey bars (page is now deliberately "static skeletons", owned by the redesign session). Draft reply only dims; label stays "Draft reply", no spinner at 1.2 s. Steps 2/2.
- C14 One SAFE list: FAIL. Investors lists 4 SAFEs ($350k), Fundraising 2 ($300k), Equity raised is still "-".
- C15 Settings General: PASS. At 1440x900 and 1280x800 Account (export, change password, delete) is visible without scrolling; focus lands on the dialog, not a control. 44 px row only read in code (NotificationSettings.tsx has pointer-coarse:min-h-11). Steps 2/2.
- C16 Settings Models: MOSTLY PASS. Hint now reads "Connect a provider to add backups"; Providers heading stays at y=198 across Model and Voice. Still: OpenRouter row says "In use" while the line says "Your bots use OpenAI: GPT-6 Luna" (may be demo data). Phone not checked. Steps 4/3.
- C17 Sign-up errors: PASS. Empty submit outlines Name, Email, Password with its own message under each; bad email + short password mark only those fields, valid Name is not outlined. Steps 3/3.
- C18 Command palette: PASS. No-match shows "No matches in pages, documents, contacts" plus Search mail for; Escape returns focus to the Search input; direct matches are above "Search mail for"; at 375 the palette is anchored to the top. Chat-by-name matches (e.g. "Chief") still show no reason. Steps 3/3.
- C19 Integrations: MOSTLY PASS. Search and chips sit above Connected, input did not move while typing (top 64 -> 64); copy "No integrations match." and "Paste the app's connection URL..." fixed; intro hidden. Not fixed: Blockscout and Coinbase still have a "..." and their buttons stop short of the other cards' right edge; Carta is still a letter tile. Phone layout is good. Steps 3/3.
- C20 First-run tour: PARTIAL. Fresh user: dismissing the first-question card starts the tour (fixed). Phone: callout sits next to its target at all 9 stops (fixed), Back/Next x identical. Desktop: Next x identical (536) but y varies by stop (107 to 815, follows target); stop 9 still swaps Skip for "Ask Chief" in the button row; stop 9 does not cover the composer. Steps 12/10.

## Findings

| id | story | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R2-12-01 | C11 | P3 | copy | Section heading "Needs you" sits over row label "Needs your answer"; acceptance asked for one label. Observed. | c11-a.png | apps/web/src/pages/ActivityList.tsx:189 | Rename heading to "Needs your answer". |
| R2-12-02 | C11 | P3 | visual | Activity list is cut mid-row at its bottom edge (3rd Finished row half visible), no snap to row boundaries. Observed. | c11-b.png | apps/web/src/pages/ActivityList.tsx:142 | Add snap-y/row-boundary scroll or size to whole rows. |
| R2-12-03 | C13 | P2 | bug | Draft reply on Investors Action items only dims; no "Drafting..." label or spinner. Observed (label unchanged, disabled=true at 1.2 s). | c13-draft.png | apps/web/src/components/investors/ActionItems.tsx:73 | Show spinner and "Drafting..." while audit.drafting. |
| R2-12-04 | C13 | P2 | visual | Empty Round and Pipeline still draw grey ghost bars that read as a stuck loader. Observed; page owned by redesign session so recorded only. | c13-fund.png | apps/web/src/components/fundraising/RoundCard.tsx | One sentence and one button per empty section. |
| R2-12-05 | C14 | P1 | bug | Investors shows 4 SAFEs ($350k), Fundraising 2 ($300k), and Equity raised is a dash despite SAFEs. Two totals for the same money. Observed. | c13-inv.png, c13-fund.png | SAFE queries in apps/api investors and fundraising | One SAFE list feeds table, conversion block, Fundraising and Equity raised. |
| R2-12-06 | C16 | P2 | copy | OpenRouter row says "In use" while text says "Your bots use OpenAI: GPT-6 Luna". Observed; may be demo fixture. | c16-own.png | apps/web/src/pages/ModelSettingsOverlay.tsx | Show "In use" only on the provider of the active model; check on a real account. |
| R2-12-07 | C18 | P3 | copy | Chat-by-name matches ("Chief", "[MOCK] Redlines...") show no snippet or reason. Observed. | c18-match.png | apps/web/src/pages/shell/command-palette.tsx | Show last-message snippet for chat matches. |
| R2-12-08 | C19 | P3 | visual | Blockscout and Coinbase cards keep a "..." slot so their buttons end 32 px before the other cards' edge; two styles remain. Observed. | c19-a.png | apps/web/src/components/integrations/IntegrationsHome.tsx | Same "..." menu with Disconnect on every Connected card, or none. |
| R2-12-09 | C19 | P3 | visual | Carta still shows a letter "C" tile while others have logos. Observed. | c19-a.png, c19-phone.png | Carta logo asset in IntegrationsHome.tsx | Add the Carta logo. |
| R2-12-10 | C20 | P3 | visual | Stop 9 swaps Skip for "Ask Chief" in the button row; Next y differs by stop on desktop (107 to 815) and popover height changes (stops 1-2 vs 3). Observed. | c20-stop9.png | apps/web/src/components/tour/TourPopover.tsx | Put "Ask Chief" in the body, keep Skip in its slot. |

Praise: the sign-up form (C17), palette empty state and top anchoring on phones (C18), the Settings General layout (C15), the Inbox dialog with the agent panel (C12) and the phone tour placement (C20) all work as intended. No console errors beyond Vite dev notices; geometry audit on Integrations showed no overflow or wrapped controls. Walker created one invented user (walker-r2-*@northwind.example.test) on the demo to test the tour offer; the demo-credentials password was never printed.

Skipped or unverified: 44 px coarse-pointer row (no touch emulation), C12 phone address truncation, C16 phone layout, Sent toast timing.
