# Walk J2: long journeys for raising and operating

Session uxl3-J2, mock-data demo stack (web 5381), 1440x900, user Maya Chen (Mock). Walked 2026-10-21. Screenshots: `/tmp/uxloop3/J2/` (outside the repo).

Demo caveat: the account was already populated (Data room files, Legal rows, Carta data, consent given for the Data room). First-run empty states and Carta connect were not seen. I added four invented PDFs to the Data room.

## Story verdicts

| Story | Verdict | Steps actual / ideal | Note |
|---|---|---|---|
| STORY-DRM-018 First week: document library | PASS (partial) | 7 / 5 | Upload of 4 files sorted into folders in about 15 s; search with snippet; Move dialog. Video refusal, consent card and grid persistence not seen (room not empty, consent already given). |
| STORY-DRM-109 Diligence day from zip | SKIPPED | n/a | Needs crafted zips; only the "ask a question" end was tried (answer found two conflicting SAFEs). |
| STORY-DRM-121 Quarter-end clean-up | SKIPPED | n/a | Time. |
| STORY-CAP-017 First visit to a working setup | PASS (partial) | 5 / 4 | Carta already connected, so connect/Done steps not walked. Read, Investors tab, agent question done. |
| STORY-CAP-020 Board prep in one sitting | PASS (partial) | 3 / 4 | One question asked (dilution after SAFEs); good answer but about 60 s. Other questions not asked. |
| STORY-LEG-001 First week on Legal | FAIL | 4 / 3 | Allow worked; Scan now then failed with "OpenRouter did not accept your key" (see J2-05). |
| STORY-LEG-007 Monday morning legal check | PASS | 3 / 3 | Legal, Deadlines, Done, Undo line, Graph. Tiles are now links; date format now matches across tabs. |
| STORY-FIN-019/020/021/022/036 | SKIPPED | n/a | Finance page viewed only (loads, Ask present); reconnect space not walked. |
| STORY-APP-383/385/386 Mercury agent, approve and deny a payment | PASS with findings | 12 / 8 | Create agent, ask (blocked), switch on, dialog, ask, Deny, ask, Allow once. See J2-01 to J2-03. |
| STORY-APP-172 Monday cash routine | PASS | 8 / 6 | Menu "Computer and routines" found it; Save now shows "Saved". Test run finished "Done". See J2-08. |
| STORY-APP-357/363 Skill drafted in chat, approved, run with `/` | PASS (partial) | 9 / 22 | Draft, Approve, `/cash` picker, run done. Memory, edit and disable steps not done. See J2-12. |
| STORY-APP-212/214/024/145/211 | SKIPPED | n/a | Time. |

Console: no errors seen on the pages walked. Phone width (390) Data room: no horizontal scroll, list readable.

## Praise (observed)

- Data room: uploads were read, typed and filed into the right folders within about 15 s with no clicks; search shows highlighted snippets; the agent noticed two SAFEs with different caps and said so.
- "Allow changes in Mercury?" dialog now says "move money and change your Mercury accounts. It asks before each change." The final agent message "pending approval. No money has moved yet." is clear.
- Legal Deadlines tab: one clear row per deadline, plain overdue pill, Done with Undo, same date format on both tabs.
- Routine editor: "Choose when it runs", hint line, "Saved" feedback; skill draft appears live in the open settings panel and `/` finds it after approval.

## Findings

| id | page / story | sev | cat | What happened vs expected | Evidence | Suspected code | Fix |
|---|---|---|---|---|---|---|---|
| J2-01 | APP-385/386 | P1 | flow | Observed: money approval card headline is "Send $1,200.00 to a recipient from an account?" and Details shows raw JSON with `accountId: chk-1111`, `recipientId: recipient_mock_acme`. Maya cannot see who she pays. Expected payee and account names. Cause suspected: emulated Mercury serves `getAccounts`/`getRecipients` but not `getRecipient`/`getAccount`, so the name lookup fails and falls back silently. | app-08-approval.png, app-09-details.png | `packages/adapters/src/approval-ask.ts:255-290` (resolveMoneyNames, fallback strings); `packages/adapters/src/finance-fake-tools.ts:115-131` | Add `getRecipient` and `getAccount` to the emulator; when a lookup fails, put the raw id in the headline instead of "a recipient". |
| J2-02 | APP-384/385 | P1 | flow | Observed: with writes off, the Mercury agent says "I can't initiate payments through the Mercury connection available here" and never mentions the "Allow changes in Mercury" switch on the Apps page. Dead end for Maya. | app-05-pay-off.png | Mercury agent instructions (`packages/contracts/src/integration-agent.ts`, suspected) | Have the agent text say "Turn on Allow changes in Apps, Mercury", or show an inline link. |
| J2-03 | APP-385 | P2 | flow | Observed once: after Deny, the agent raised a second identical approval card before saying "I won't retry it". Second Deny ended it. Expected one decision. | app-11-denied2.png, app-12-denied3.png | Denied tool result wording / model retry (suspected, scripted demo model) | Make the denied tool result tell the model not to retry the same call. |
| J2-04 | DRM-018 | P1 | visual | Observed: with Preview open at 1440 the file list is about 110 px wide and names read "MOCK SAFE -..."; with Preview and the agent panel both open, rows read "MO C... Fu... Co...". Type and Date columns vanish. Expected readable file names. | drm-05-preview.png, drm-08-ask.png | `apps/web/src/pages/DataRoom.tsx`; `apps/web/src/components/data-room/Preview.tsx` (panel widths) | Collapse the folder tree (or auto-close the agent panel) while a preview is open, and give the list a minimum width. |
| J2-05 | LEG-001 | P2 | bug | Observed: Scan now ended with "Last scan failed: OpenRouter did not accept your key" plus a "Replace OpenRouter key" button, while the Data room agent and classifier worked in the same session. Cause unknown (demo seeding or a separate credential path for the Legal agent); needs triage. The message and button themselves are clear. | leg-04-scanned.png | `apps/web/src/pages/Legal.tsx`, `packages/adapters/src/legal-agent.ts` (suspected) | Check which key the Legal scan uses on the demo; reuse the default connection. |
| J2-06 | Legal | P3 | copy | Observed: consent card says "The text is sent to the AI model that runs your bots." with no provider or model name; "Scan now" is disabled with no reason beside it. | leg-01.png | `apps/web/src/pages/Legal.tsx` | Name the model in the card; or title the disabled button "Allow access first". |
| J2-07 | All pages | P2 | perf | Observed: after a page reload the main area is a skeleton for about 6 s and the sidebar (pages and bots) is empty until about 7 s; measured by polling (6 s heading, 7 s 17 bots). Probably the dev server (unbundled modules); not checked against a built app. | fin-01.png | not identified | Check with a production build; if it holds, preload bot list with the shell. |
| J2-08 | APP-172 | P2 | flow | Observed: routine Test run showed "Done, 13s" in Run history while Chief's text said the bank figure "hasn't come back yet"; the answer arrived as separate agent messages and Chief never gave the three bullets. The Mercury reply said $472,420 while the Finance page says $1,633,220, which a first-time founder sees as a contradiction. | rt-09-testrun-done.png | routine run completion (`apps/web/src/pages/RoutineRunHistory.tsx`, suspected) | Mark the run done after delegated replies arrive, or say "waiting on Finance agent"; have Chief close with one summary. |
| J2-09 | CAP-017 | P2 | visual | Observed: the donut card is about 490 px high for a two-row legend, leaving about 200 px empty and pushing the table below the fold; the agent panel is open by default and narrows the page. | cap-01.png | `apps/web/src/components/cap-table/` (donut card) | Shrink the card to its content or put the donut beside the legend. |
| J2-10 | CAP-017/020 | P2 | flow | Observed: Investors tab shows Shares and Ownership as "—" on every row; the SAFE amount appears only as small grey text under Kind, so Maya cannot scan who put in how much. | cap-06-investors.png | `apps/web/src/pages/CapTable.tsx` (suspected) | On Investors, replace the empty columns with Amount and Cap or discount. |
| J2-11 | APP-172 | P3 | visual | Observed: the Computer panel shows a black 213 px screen above Routines even when nothing is on screen. | rt-02-panel.png | `apps/web/src/pages/Shell.tsx` (computer panel) | Hide the preview until the computer has something to show, or shrink it. |
| J2-12 | APP-357/363 | P3 | a11y | Observed: the draft skill's Approve and Discard buttons sit at the very bottom edge of the settings panel (clipped, scroll needed). The chat message "Created cash-check as a draft skill" has no link or card; Maya sees the draft only because the settings panel was open (closed case not tested). | sk-03-draft.png | `apps/web/src/pages/Shell.tsx` (bot settings skills list) | Add a chat card with Approve/Discard, and make the buttons sticky. |
| J2-13 | App-wide | P2 | flow | Observed: background bot toasts (Founder mail finished, Legal agent failed "needs your permission", Inbox agent finished, Redlines finished) appear over page content 6+ times in 10 minutes, including a Legal failure while Maya was in the Data room. Possibly demo seed routines. | leg-03-scanning.png, drm-10-answer.png | not identified | Group or silence routine toasts for bots Maya is not looking at. |
| J2-14 | LEG-007 | P3 | visual | Observed: the "Marked ... done. Undo" line pushes the list down about 30 px. | leg-06-done.png | `apps/web/src/components/legal/LegalDeadlines.tsx` | Reserve the line's height or float it. |
| J2-15 | Sidebar | P3 | a11y | Suspected: a small green flag icon beside the time on bot rows (Founder mail, Sales mail, Inbox, Chief) has no visible meaning; not checked for a label. | leg-04-scanned.png | `apps/web/src/pages/Shell.tsx` (bot row) | Give it a label or remove it. |
