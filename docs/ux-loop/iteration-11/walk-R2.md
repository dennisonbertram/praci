# Walk R2 (iteration 11): verify pass-10 clusters C11-C20

Target: demo stack web :5381 (served from the main checkout), 1440x900, plus a Playwright iPhone 14 context (pointer: coarse) for touch checks. Screenshots in /tmp/uxloop11/R2/. Steps are not counted against a story Ideal path because these are cluster checks, not catalog stories.

## Verdicts
- C11 Empty Investors/Fundraising and Draft reply: FAIL. Fundraising still shows grey ghost rows in Round, Pipeline and SAFEs (c11-fund.png). Draft reply has no "Drafting..." label or spinner (ActionItems.tsx:73-76 only sets disabled). A fresh-user empty Investors view was not tested (SKIPPED).
- C12 Finance Hide amounts: PASS with leftovers. "Amounts hidden - Show" appears in the header and restores amounts in one click (c12-hidden.png); the space name is not truncated on Finance or the Burn sub-page. Breakdown and Upcoming cards still end at different heights (312 vs 338 px) and the period bar is still a full-width card. Runway sub-page and 390 px width not checked.
- C13 Inbox: PASS with one new defect. Tab moves one row per press (observed). Search highlights both terms (c13-search.png). Dialog x stays at 336 when Ask agent opens (observed), and the code gives the checkbox a 44 px coarse area (InboxRow.tsx:361, not measured). New: at 1440 the agent panel overlays the right half of the email, so body text and the To line are cut off (c13-agent.png).
- C14 Chat wording: PASS. Answering an ask card shows "Answered: Name Bolt Freight" once (c14-answer.png). The new-message pill sits between the last bubble and the composer without covering text. Legal tool phrases exist in packages/core/src/events.ts:431-436 but were not seen live (no Legal run). Once-sent guard on the Draft a reply chip was not tested.
- C15 Routines: PASS. Button is "Routines" when closed, and the form has an "Add a skill" list of 11 skills (c15-form.png). The open panel still says "Computer is on" over an empty box labelled "<bot>'s computer".
- C16 Data room Reading: PARTIAL. Board Minutes shows no "Reading" text but a spinner (title "Reading text") remains, while search for "minutes" returns its extracted text. No Retry or age text was visible. Demo seed issue per the cluster.
- C17 Phone message actions: PASS. Touch emulation shows one "..." per message, measured 44x44 (t-home.png).
- C18 One waiting label: FAIL. Activity section is still titled "Needs you" while its row says "Needs your answer" (c18-act.png; ActivityList.tsx:173). Computer cards now say "Needs takeover".
- C19 Bot settings: PASS. Scrolled panel shows no strip above the title, and Disabled tools is now a "Turn off a tool" list (c19-adv.png). The External sentence was not checked (needs an External bot).
- C20 Settings: PASS with one oddity. The Models text says "OpenAI: GPT-6 Luna" before and after "Use my own model", Backup models says "Use my own model to add backups.", Usage no longer mentions provider keys, and Theme, Sidebar density and Avatars sit in one labelled Appearance card (c20-*.png). The right column still ends far above the left.

## Findings
| id | page | sev | cat | observed vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R2-11-01 | Fundraising | P2 | visual | Ghost grey rows still fill Round, Pipeline, SAFEs for a user with SAFEs but no round; reads as a loader that never ends. Observed. | c11-fund.png | components/Placeholders.tsx | One sentence and one button per empty section. |
| R2-11-02 | Investors | P2 | flow | Draft reply gives no work indicator. Observed in code; click shows no change in the first 1.5 s. | c11-draft1.png | components/investors/ActionItems.tsx:73 | Show "Drafting..." with a spinner while drafting. |
| R2-11-03 | Inbox email | P2 | layout | At 1440 the Ask agent panel covers the right half of the email; text and the To line are cut. Observed. | c13-agent.png | components/inbox/InboxMessageDialog.tsx:124,557 | Widen the dialog to fit both columns at 1200+ px, or push the panel beside it. |
| R2-11-04 | Activity | P3 | copy | "Needs you" heading beside "Needs your answer" row. Observed. | c18-act.png | pages/ActivityList.tsx:173 | Rename the heading to match roster-status.ts. |
| R2-11-05 | Data room | P3 | flow | Spinner on a file whose text is already searchable; no age or Retry. Observed. | c16-dr.png | components/data-room/ItemRows.tsx Marker | Treat a file with stored text as Ready. |
| R2-11-06 | Finance | P3 | visual | Breakdown and Upcoming cards 312 vs 338 px; period bar full width. Observed (geometry audit). | c12-fin.png | pages/Finance.tsx | Equal-height row; shrink period bar. |
| R2-11-07 | Chat panel | P3 | copy | Open panel title "Computer is on" over an empty preview for a bot not using a computer. Observed. | c15-routines.png | pages/Shell.tsx panel header | Title "Routines" until a computer is in use. |
| R2-11-08 | Settings Models | P3 | copy | Models says "Your bots use OpenAI: GPT-6 Luna" while OpenRouter is listed Connected (demo). Observed; may be demo only. | c20-own.png | ModelSettingsOverlay.tsx | Check on a real account. |

Praise: the phone "..." button, the single-Tab-per-row Inbox, the Hide amounts control and the Add a skill list all work as the cluster specified.
