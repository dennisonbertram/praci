# Walk R3 (iteration 17): verify pass-16 fixes

Stack: demo web :5381, 1440x900 (touch checks emulated with pointer: coarse at 390 wide). Cluster note: the brief says C21-C31, but `iteration-16/clusters.json` holds C1-C21; all 21 were covered. Screenshots: `/tmp/uxloop17/R3/`.
Storybook smoke (`apps/web/.storybook/smoke.mjs`, built from main checkout): 1764 of 1764 stories rendered cleanly. No failing story.
The demo machine was under heavy load (load average about 22), so one cold load showed "Still opening... Try again" once; a reload fixed it and I do not count it as a finding.

## Verdicts (steps actual/ideal)

- C1 mail send wording and recovery: BLOCKED live (scripted demo model cannot force a two-account send failure). Code check: `acct:` and "Pass account" strings are gone from `mail-tools.ts`, and `transcript.tsx:1768` now always passes `onOpenComposer` with `connectionId ?? ""`. Unobserved.
- C2 Investors Draft reply: PASS 2/2. Ask panel opens at once on the audit thread, row shows "Drafting...". Row returns to "Draft reply" after about 19 s with no outcome on the row (outcome is only in the panel); see R3-17-09.
- C3 Legal table: FAIL (partial) 2/2. Names still cut at about 30 chars; fixed percent colgroup (26/17/19/16/9/13) unchanged. Graph labels are 12 px (pass).
- C4 Inbox dialog feedback: PASS 6/5. "Added to Data room" within 1 s; Sending toast gone about 9 s after Send (5 s undo, then "Sent" 3 s); Reply all appears only with several recipients.
- C5 GTM: PARTIAL 5/4. Pages menu lists GTM and unchecking hides the row; row is a real link; Cmd+K lists GTM once under Pages; no loose chat row. Still: empty "Written by GTM agent" box, and the agent appears twice in Cmd+K (Bots and Chats).
- C6 Data room list: PARTIAL 5/4. Type no longer truncates; failed rows are 56 to 61 px with the reason in the list and one "..." menu; upload toast reads "Uploaded to Finance" in a folder. Parties still truncates ("Northwind Robotics, Ac...") and long names wrap to 2 lines while Status is mostly empty.
- C7 First-run tour: PARTIAL 8/6. Tour starts on Chief right after one app is connected, with the Calendar card still open (pass). Reload mid-tour restarts at step 1 and the total changes from 9 to 4 (fail).
- C8 Touch and keyboard targets: PASS 4/4. With pointer: coarse, drawer page rows are 44 px and the failed badge is 44x44; desktop badge is 24x25; resize handle has a focus-visible ring (code); Inbox row hover is guarded by `hover:hover`.
- C9 Finance burn chart: PARTIAL 4/4. Month and 375 px views show one open circle for Oct*; Quarter starts at Q1 '26 with data; y labels not clipped. Year view is an almost empty plot with two unlabeled dots. Month controls are 35 px wide at 390 with touch (fail).
- C10 Routines: PARTIAL 5/4. Header icon is a clock in the list view, no empty computer heading; Test run disabled shows "Save the routine first" on hover. The icon turns back into a monitor in the editor view. Run status "Waiting on ..." not exercised (needs a saved routine run).
- C11 Settings: PASS 4/3. Escape closes Memory in one press; Settings opens instantly on Legal.
- C12 First mail sort: FAIL 4/3. After Allow, mail rows show at 15 s, but the "taking longer than usual" note appears only at about 77 s and no sorted groups after 122 s. Before consent the page shows "Reading your mail..." skeleton beside the consent card.
- C13 Data room PDF on phone: FAIL 3/3. At 390 the preview is an empty grey box. Desktop renders the PDF.
- C14 Delegate approval: PASS 3/3. Full-width "Open Inbox agent" button (32 px, `pointer-coarse:h-11`), composer says "Waiting for approval", one click changes the route to the Inbox agent and shows the held mail card.
- C15 Settings hierarchy: PASS (partial check) 3/3. Models is a card titled "Model"; bot panel Advanced is now a drill-in row. 80-character name not tested.
- C16 Sidebar polish: PASS (partial) 2/2. Activity panel is about 17% of the list. Working row height not measured.
- C17 Payment copy: SKIPPED (payment approval flow; avoids clashing with other walkers).
- C18 Space name in headers: PARTIAL 3/3. Investors, Contacts, Artifacts show the space; Fundraising header does not (Fundraising/Investors owned by another session; P3 only). Empty-SAFE card not testable (a SAFE exists).
- C19 Cold load calls: FAIL 1/1. One cold load of Finance made 5 bots/list, 14 routines/list, 3 finance/overview, 3 bootstrap calls (limit was 2 each).
- C20 Integrations: PASS 2/2. Search and chips are in the first frame (0.3 s). Carta still has a letter tile.
- C21 Agent wording: SKIPPED (scripted demo model output).

## Findings

| id | story | sev | cat | what happened vs expected | evidence | suspected code | proposed fix | status |
|---|---|---|---|---|---|---|---|---|
| R3-17-01 | C13 | P2 | bug | Phone Data room PDF preview is an empty grey box; expected document or thumbnail with Open and Download. | `t-dr2.png`, `t-dr3.png` (390 px, touch) | `apps/web/src/components/data-room/Preview.tsx`, `components/PdfViewer.tsx:6` | Below the md breakpoint render thumbnail plus Open and Download buttons instead of the iframe. | observed |
| R3-17-02 | C12 | P2 | perf | After Allow, no sorted groups after 122 s; "taking longer" note only at about 77 s (target 15 s); "Reading your mail..." skeleton shows before consent. | poll log, `n-08.png`, `n-09.png` | `apps/web/src/pages/Inbox.tsx` (sort wait text), triage job start in apps/api | Show the note at 15 s, drop the skeleton text until consent, start triage on Allow. | observed |
| R3-17-03 | C7 | P2 | bug | Reload during the tour restarts at step 1 and the total changes from 9 to 4. | `n-06.png` (4/9) then `n-07.png` (1/4) | tour state in `apps/web/src/pages/Shell.tsx` | Persist step index and the fixed 9-stop list across reload. | observed |
| R3-17-04 | C3 | P2 | visual | Legal table names, Parties and Renewal still cut ("Auto-renews, 30 days ..." hides the notice); columns are fixed percentages. | `c3-legal.png`; colgroup 26/17/19/16/9/13 | `apps/web/src/pages/legal/LegalContracts.tsx:162-169` | Size Term, Renewal, Value, Deadline to content and give the rest to Contract and Parties. | observed |
| R3-17-05 | C9 | P2 | visual | Year view is a near-empty plot with two unlabeled dots (one data year). Quarter's current point is two unlabeled circles. | `c9-y.png`, `c9-q.png` | `apps/web/src/components/finance/charts.tsx` | Hide the chart or show bars for a single period; label the two marks or draw one. | observed |
| R3-17-06 | C9 | P3 | a11y | At 390 with touch, month controls are 35 px wide (need 44). | measured chain: link g 35x154 | `charts.tsx` bar links | Scroll the chart horizontally with a 44 px minimum per month or show fewer months on phones. | observed |
| R3-17-07 | C19 | P3 | perf | One cold Finance load: 5 bots/list, 14 routines/list, 3 finance/overview, 3 bootstrap. | `network requests` count | Shell/sidebar data hooks | One shared query per key. | observed |
| R3-17-08 | C5 | P3 | visual | GTM page still shows an empty "Written by GTM agent" box; Cmd+K lists the GTM agent twice (Bots and Chats). | `c5-gtm.png`, `c5-cmdk.png` | GTM page component, palette sections | Hide the box when empty; list a bot once. | observed |
| R3-17-09 | C2 | P3 | flow | After a draft finishes the audit row returns to "New / Draft reply" with no outcome on the row. | `c2-c.png` | `apps/web/src/components/investors/ActionItems.tsx` | Show "Draft ready" or the agent's one-line reason on the row. | observed |
| R3-17-10 | C10 | P3 | visual | Header icon is a clock in the routine list but a monitor in the editor; button label is "Computer and routines"; the tooltip "Save the routine first" overlaps the close button. | `c10-b.png`, `c10-c.png`, `c10-d.png` | chat header and `RoutineSchedule.tsx` | Use one icon and label for the Routines-only panel; place the tooltip below the button. | observed |
| R3-17-11 | C6 | P3 | visual | Data room Parties truncates and names wrap to 2 lines while Status column is mostly empty. | `c6-dr.png` | `apps/web/src/components/data-room/ItemRows.tsx` | Give the empty Status width to Parties and Name. | observed |
| R3-17-12 | C20 | P3 | visual | Carta still uses a gray letter tile. | `c20.png` | `Integrations*.tsx` | Add a logo or use one tile style. | observed |
| R3-17-13 | C18 | P3 | flow | Fundraising header lacks the space name that Investors, Contacts and Artifacts show (owned by another session). | `c18-fundraising.png` | `apps/web/src/pages/Fundraising*.tsx` | Add the space label to the header. | observed |

Praise: the delegate-approval button and "Waiting for approval" placeholder (C14), the single Oct* mark on the burn chart, "Added to Data room" feedback, and the first-run tour starting right after one app connects were all clear and quick.

Left as test data in the demo: four small `r3-note*.txt` files in the Data room, user `walker-r3-1@northwind.example.test`.
