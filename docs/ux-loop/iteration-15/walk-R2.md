# Walk R2 (pass 15): verify pass-14 clusters C11-C20

Demo stack 127.0.0.1:5381, 1440x900 and 375x812 (touch emulation was not available: pointer stayed fine, so coarse-pointer checks were not run). Screenshots: /tmp/uxloop15/R2/. A fresh invented user (Maya Walker) was signed up for the first-run checks.

## Verdicts (cluster: verdict, steps actual/ideal)
- C11 tour: PARTIAL. Desktop PASS (nine stops, card fixed at the sidebar foot, Next at the same spot, no chat text under it). Phone: stops 3 and 4 PASS (card at drawer foot, no rows hidden), but from stop 5 the card jumps to the top and Next moves from y=756 to y=78, then 116 at stop 9. 9/9.
- C12 Integrations: PARTIAL. 'Connected' chip shows at 375 PASS; Mercury reads 'Read balances and transactions' PASS; first paint FAIL (about 1-2 s of six skeleton rows with no search box or chips; screenshots int-early.png). 3/3.
- C13 denied payment: SKIPPED (payment flow on a shared thread; not run). Code check only: AskCard.tsx:42-43 now has 'Replaced by a newer request' and 'Expired'.
- C14 storybook smoke: SKIPPED (not run).
- C15 menu rows: PASS. Pages and Account menus 32 px per row; Create 32 px.
- C16 mail dialog: PARTIAL. Body aligned with header PASS; dialog and text x stay put when Ask agent opens PASS; address splits at the hyphen at 375 FAIL ('quill-' / 'capital.example.test'). Hover reflow not checked.
- C17 Settings: PARTIAL. Selected style shared across Theme, Density, Avatars PASS; 'does not pay' line gone while OpenRouter is Included PASS; two controls still named 'Advanced' (left nav item and the 'Advanced' disclosure in Models) FAIL.
- C18 first-run copy: PARTIAL. Option B 'Slack and your calendar' vs A 'Email, calendar and your company pages' PASS; consent card is one sentence, a collapsed Details and two buttons PASS; chosen row readable with a check PASS; welcome, question and connect cards share one 640 px width PASS, but the NEW divider is 900 px wide (minor). Tour step 8 does not repeat the name beyond its label PASS.
- C19 Finance: PARTIAL. No gap over 80 px under Breakdown PASS; text 12 px+ PASS (only sidebar section labels are 11 px); 'Last charge' one line PASS; Month chart starts Mar '26 PASS. Quarter chart starts at Q1 '25 with three flat zero quarters FAIL.
- C20 small targets: PARTIAL. Tab reaches first page row PASS (Inbox tabindex 0); Legal badge label '1 overdue or due in the next 7 days' PASS; Data room badge label '1 file failed' PASS. Vendor link at 44 px coarse and chart bar labels: not run (no coarse pointer emulation).
- Extra: opening Settings from the account menu did nothing on the Chief thread page in three tries (worked on Finance).

## Findings
| id | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|
| R2-15-01 | P2 | bug (observed) | Phone tour card is at the foot for stops 1-4 but at the top for 5-9; Next moves from y=756 to 78 (116 at stop 9). Owner decision: card keeps a fixed spot. | ph-grid.png | apps/web/src/components/tour/TourPopover.tsx (phone placement) | Pin the phone card to the drawer foot at every stop, or move stops 5-9 targets above it. |
| R2-15-02 | P2 | bug (observed) | With Ask agent open in an email, body text is cut off at the panel edge instead of wrapping ('Can you che', 'Not a real mess'). | mail-1440-b.png | apps/web/src/components/inbox/InboxMessageDialog.tsx (body wrapper with panel open) | Let the body column wrap (min-w-0, whitespace-pre-wrap, no clipping). |
| R2-15-03 | P2 | visual (observed) | Integrations first paint shows skeleton rows with no search or chips; popular-service logos (Google Calendar, Drive, Slack, Notion, GitHub, Linear, Airtable) are black SVGs on a dark tile and look like blank squares. | int-early.png, int-late.png | apps/web/src/components/integrations/IntegrationsHome.tsx:626-668; public/logos/simple/*.svg | Render search and chips before data loads with a grid skeleton; invert or tint logos in dark mode. |
| R2-15-04 | P3 | copy (observed) | Recipient address breaks at the hyphen at 375 ('quill-' / 'capital...'). | mail-375.png | apps/web/src/components/inbox/InboxMessageDialog.tsx:386,406,410 (break-words) | Use whitespace-nowrap per address with overflow-wrap:anywhere only as a fallback. |
| R2-15-05 | P3 | copy (observed) | Settings still has two things named Advanced (nav item and Models disclosure). | set-own.png | apps/web/src/components/settings/ModelSettingsOverlay.tsx | Rename the Models disclosure (for example 'Model options'). |
| R2-15-06 | P3 | visual (observed) | Quarter and Year charts: Quarter starts at Q1 '25 with three flat zero quarters; Year draws two lone dots in the left half with clipped y labels ('$800k' cut at the left edge). | fin-q.png, fin-year.png | apps/web/src/components/finance/charts.tsx | Start at the first non-zero period; give Year a full-width scale and room for y labels. |
| R2-15-07 | P3 | visual (observed) | The NEW divider spans 900 px while welcome, question and connect cards are 640 px. | n-2.png | first-run chat components | Cap the divider at the card width. |
| R2-15-08 | P2 | bug (observed, not reproduced reliably) | Account menu > Settings did nothing on the Chief thread route (3 tries), worked from Finance. | set-1.png | apps/web/src/pages/Shell.tsx:859 (settingsOpen reset on pathname) | Reproduce on a Chief thread; check the effect closing the dialog on route change. |

Praise: sidebar tab order, badge labels, menu row heights, Models page (one sentence plus one button), and the consent card are clean. Console showed no errors.
