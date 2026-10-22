# Walk J2 (iteration 11): long journeys for raising and operating

Walker session uxl11-J2. Target: mock-data demo stack (web 5381, API 3308), 1440x900, signed in as the mock founder. Screenshots: /tmp/uxloop11/J2/. Console: no errors during the walk. Other walkers were using the same stack at the same time (Chief and Investors threads show their messages), which may explain some of the duplicated state noted below.

## Story verdicts

| Story | Verdict | Steps actual / ideal | Note |
|---|---|---|---|
| STORY-DRM-018 First week library setup | PASS (partial) | 6 / 5 | Consent card Allow, import from email, search, preview all work. Local file drag/drop not driven. |
| STORY-DRM-019 Investor diligence request | PASS | 6 / 6 | Multi-select now has Download, Email (opens compose with the file attached) and Send to agent; the catalog's "no bulk download" is out of date. |
| STORY-DRM-020 Invoices out of Gmail | PASS | 4 / 3 | Add files > From email > tick > Import; progress strip and "Imported 1 file" shown. No Google Drive item in the menu (not connected). |
| STORY-DRM-121 Quarter-end clean-up | SKIPPED | - | Time. |
| STORY-CAP-017 First visit to a working setup | BLOCKED (Carta OAuth) | - | Carta already connected on the demo; walked the populated Investors page only. Page is another session's; only P0/P1 reported. |
| STORY-CAP-018 Monthly investor update | SKIPPED | - | Needs several agent turns; Investors agent was blocked by email-sharing consent (link to Settings was present). |
| STORY-CAP-033 Board prep, amounts hidden | PASS | 3 / 3 | Hide amounts masks cards, chart axis, rows and the Chief sidebar preview; "Amounts hidden - Show" present. |
| STORY-CAP-106 Connect Carta | BLOCKED | - | Real OAuth. |
| STORY-LEG-017 A quarter on Legal | PARTIAL / FAIL | 5 / 6 | Contracts, Deadlines, Ask agent, Done all reachable. Undo after Done never appeared (J2-01). Time travel and the March recurrence not simulated. |
| STORY-FIN-019 First morning with Finance | PARTIAL | - | Banks already connected; read KPIs, Burn, Breakdown, Upcoming, Hide amounts. Add-account flow blocked (OAuth). |
| STORY-FIN-022 Monthly review, pins, reconnect | SKIPPED | - | Time. |
| STORY-FIN-020/021/036 | SKIPPED | - | Time (036 covered by CAP-033 above). |
| Money-moving approval (APP/FIN) | PASS with defects | 4 / 3 | Ask Mercury agent, read card with Details, Send. Card is clear; see J2-02, J2-03, J2-04. |
| Bot with skill and routine (STORY-APP-353 + routine) | PASS with defects | 14 / 10 | New bot (1 click, name focused), rename, Add skill > New skill (3 plain fields, no YAML), "/" picker, routine approval card, routine editor. See J2-05, J2-06, J2-07. |

## Praise (observed)

- New bot: one click creates it, Name is focused and selected, a first message asks what it should do.
- Skill form: Name, "What it does and when to use it", Instructions; no YAML. Saved skill appears at once in the "/" picker with its description.
- Money approval card: states amount, payee, source account and last four digits in the title; Details lists amount, payee, account and note; the agent follows up that "no money has moved yet" and that approval is still needed in Mercury.
- Data room multi-select bar (Download, Email, Send to agent), the import progress strip, and the search snippets with highlights are excellent.
- Legal row buttons have specific accessible names ("Mark X done", "Ask agent about X").
- Routine editor: Test run, schedule pickers, "Next run Mon, Oct 26, 9:00 AM", Run history with View chat.

## Findings

| ID | Sev | Cat | What happened vs expected | Evidence | Suspected location | Proposed fix |
|---|---|---|---|---|---|---|
| J2-01 | P1 | bug | Observed: clicking Done on a Legal deadline removes the row and no "Marked ... done. Undo" line appears (checked in the DOM at 0 s, 1 s and in screenshots, 3 rows). Done and Dismiss sit side by side, so a mis-tap cannot be reversed, and there is no closed list. Expected the 30 s Undo the code describes. Suspected: the parent refetch (`onChanged`) drops the closed deadline from `deadlines`, so the Undo slot that is rendered inside `deadlines.map` never exists. | l3.png, l4.png, l6.png | apps/web/src/pages/legal/LegalDeadlines.tsx:152 (slot render), :68 (`onChanged`) | Keep the closed deadline in local state and render the Undo line from `undo.deadline`, not from the refetched list. |
| J2-02 | P1 | flow | Observed: asked Chief to pay a Mercury invoice, Chief says "Turn on Allow changes for Mercury under Integrations". On the Mercury page "Allow changes in Mercury" is already ON. The Mercury agent's own message says the real problem was that no matching recipient exists, and ends with an "Open Settings" link, which is the wrong place for a missing recipient. Chief also has its own "can use Mercury" switch off, so the instruction is neither accurate nor sufficient. | a1.png, i4.png, m1.png | apps/api/src/finance-agent.ts:14-15, apps/api/src/integration-agent.ts:27 (fixed "turn on Allow changes" wording); relay of the reason is suspected | Have the agent report the tool's actual reason; link recipient problems to Mercury, and tell the user to ask the Mercury agent when Chief lacks access. |
| J2-03 | P1 | bug | Observed: after I approved "Send $1,250.00", a second identical card (same amount, payee, account, note) stayed pending. I denied it, and the agent then wrote "was not submitted: the approval for this request was denied. No money moved" while its earlier message said the payment was pending in Mercury. Two cards for one payment plus two contradictory outcomes. Caveat: my first Send click showed no change, so I clicked a second time; another walker's Chief request may also have been involved. Cause not confirmed. | m5.png, m6.png, m7.png | unknown; approval card creation in packages/adapters/src/approval-ask or the Mercury agent turn | Dedupe approval cards by call hash and make the card show which request it belongs to; the agent should report one outcome per approved card. |
| J2-04 | P2 | copy | Observed: the approved payment card says only "Approved", but money has not moved (Mercury still needs its own approval). The explanation only appears in a later chat message. | m6.png | approval card state label (web chat approval component) | Label it "Approved here. Waiting for Mercury" when the provider needs its own approval. |
| J2-05 | P1 | bug | Observed: Test run on the new routine did not produce the investor note. The agent replied that the routine "is already active with those instructions", and Run history marks the run "Done". Suspected: the stored routine instruction begins with the schedule sentence ("Every Monday at 9:00 AM ... draft and post"), so a test run re-reads it as a scheduling request. | b13.png, b14.png | packages/adapters/src/schedule-tools.ts (prompt saved with the routine) | Store only the task in the routine prompt; run Test run with a flag that tells the agent to do the work now. |
| J2-06 | P2 | flow | Observed: the routine was made from a message that forced `/weekly-investor-note`, but the routine editor's "Add a skill" is empty; the skill is only named in free text. Suspected: the forced skill is not saved on the routine. | b12.png | routine create tool in packages/adapters/src/schedule-tools.ts | Attach the forced skill to the routine when it is created. |
| J2-07 | P2 | flow | Observed: routines live behind a monitor icon with the accessible name "Computer and routines"; the panel header says "Computer is on" and shows an empty "Investor Notes' computer" heading below the list. Maya has no reason to look under "computer" for her weekly reminder. | b11.png | apps/web/src/pages/Shell.tsx (computer panel header) | Name the control "Routines", drop "Computer is on" and the empty heading unless there is computer content. |
| J2-08 | P2 | visual | Observed: Legal > Contracts truncates the contract name ("MOCK Insurance Policy - Shield...") while Value has wide empty space; the Term and Renewal cells wrap to two lines; the SAFE and Term sheet rows are shorter than the rest. The name is the key to the row. | l1.png | apps/web/src/pages/legal (contracts table column widths) | Give the name column the spare width, make Term not wrap (nowrap or a shorter format), and use one row height. |
| J2-09 | P2 | flow | Observed: the Data room "From email" dialog has "Add new email attachments automatically" switched ON by default (on this demo; seed state not checked) in a dialog whose button says Import. It changes ongoing behaviour with no separate consent. | d4.png | apps/web/src/components/data-room/ImportFromEmail.tsx | Default it off, or state the consequence on the switch. |
| J2-10 | P2 | perf | Observed: Integrations first paint shows six empty cards for about 3-5 s (second visit 2 s). Separately, navigating to the Data room once showed "Still opening... Try again" for over 30 s; "Try again" recovered it. Other walkers were loading the stack, so load is a possible cause. | i1.png, d10.png | apps/web/src/pages/Integrations.tsx (loading state), boot gate in Shell | Show cached cards or labelled skeletons; investigate the boot gate timeout. |
| J2-11 | P3 | visual | Observed: the "Praci can now read your documents." toast sits at the bottom of the list area over rows, while approval toasts sit bottom-right. | d2.png | toast host in the Data room page | Use the same bottom-right toast host. |
| J2-12 | P3 | visual | Observed: a denied approval card stays expanded with Details open, while an approved card collapses. | m7.png | approval card component | Collapse both the same way. |
| J2-13 | P3 | copy | Observed: the routine approval card prints raw "repeats: / next run: / prompt:" lines and the whole generated prompt. The facts the user needs (when, where it posts) are not the first thing read. | b8.png | approval summary builder for schedule tools | Lead with "Every Monday at 9:00 AM, posts here"; put the prompt under Details. |
| J2-14 | P3 | copy | Observed: Hide amounts masks the non-money "vs Sep" percent as "•••%" (decision says it hides money only). | h1.png | Finance spend header | Leave percentages visible, or record that percentages are masked on purpose. |
| J2-15 | P3 | copy | Observed (seed data): the Insurance deadline reads "renews on December 1 unless cancelled 30 days before" while the row date is Dec 2 and the term ends Dec 2. | l2.png | demo seed / legal scan output | Fix seed text. |

## Notes not filed as findings

- Investors page (owned by another session): the "Updates" section shows static grey skeleton rows that look like a stalled load; "Equity raised" shows a dash although two SAFEs ($250k, $50k) exist; the "Draft reply" action item ends in an email-sharing refusal with an "Open Settings" link in chat. Only P0/P1 are in scope there, so these are P2 and left for that session.
- Catalog drift: STORY-DRM-019 (no bulk download), STORY-APP-353 (YAML editor) and the Data room Add files menu (Upload files, From email, From Box; Drive hidden until connected) no longer match the app.
- Not exercised: touch emulation, phone widths, local file upload via drag and drop, real Carta/Mercury OAuth.
