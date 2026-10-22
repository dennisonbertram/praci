# Walk R1 (uxl13-R1): verify pass-12 clusters C1-C26

Target: mock-data demo stack (web port 5381, served from the main checkout, which has the pass-12 merges), 1440x900 desktop, plus a 375 px phone viewport. Screenshots are in /tmp/uxloop13/R1/. The demo was shared with other walkers, so counts, mail grouping and bot rows changed during the walk.

Limits: the headless browser reports `pointer: coarse` as false even with device emulation, so touch-target criteria could not be measured and are marked code-only. Duplicate-card cases (C1 criteria 1-2) need a model that messages the Mercury agent twice; I could not trigger that.

## Cluster verdicts (acceptance criteria)

| Cluster | Verdict | Evidence |
|---|---|---|
| C1 Delegated payment lifecycle | FAIL (partly) | Criterion 1-2 (duplicate and superseded cards): not triggered, UNVERIFIED. Criterion 3: not met, a run waiting on approval shows "This agent could not finish" and, after reload, "Last run failed" (pay1.png, pay2.png). Criterion 4: not met, the approval stayed live in the Mercury agent (merc2.png) while the originating bot said the run failed; the error does not say nothing was sent. Deny worked and said "Not submitted" (merc3.png), but the originating thread then showed the correct answer followed by the stale "Last run failed" line (nb2.png). Criterion 5: not met for delegation in general, Chief shows an interim "I've asked the Inbox agent..." message and then the answer (chief1.png). |
| C2 Failed send recovery | NOT MET (code only) | Not reproduced live (needs a failing send). `MailApprovalCard.tsx:481` still requires both `onOpenComposer` and `mail.connectionId`, and `EmailAgentPanel.tsx` has no reference to either. |
| C3 One SAFE list | PASS | Investors shows Equity raised $300,000 and "2 SAFEs"; the conversion block lists Harbor Angels $50,000 and Quill Capital $250,000; Fundraising lists the same two ($300k). One name per SAFE. First visit once showed a dash, see R1-09. (inv3.png, fund2.png) |
| C4 Chief to-do count | PASS | Chief answered "There are 5 open to-dos"; the Inbox To do card has 2 shown plus "3 more" = 5. Deny reply had no "Open Integrations" link (merc3.png). |
| C5 Inbox reshuffle | PARTLY | Within one load I saw one swap after first paint (12 to 13 "Show N more"). Across two loads about 25 s apart Morgan Pretend moved from Needs reply to Other mail today and the unread count changed (inbox.png vs inbox2.png). No sorting status line was visible in the samples, so its fixed height could not be checked. |
| C6 Finance phone | PASS | At 375 px, Accounts and an account detail (back header): company switcher on its own row, no overlap with Ask; sync chip reads "synced just now" in full (fin.png, acc.png, acc2.png). The audit's 16 px spill is a wrapper scrollWidth, no element passes the viewport. |
| C7 Legal Contracts | PASS | Renewal wraps fully at 1440; Parties lists only the counterparty; clicking the Parties cell opens the file in the Data room with "Back to Legal" (legal.png, legal2.png). |
| C8 Routine from /skill | BLOCKED | Needs a model-driven creation; not run. The skill select lists "bank-check" first (probably the user's own skill), unverified. |
| C9 Toasts | PASS | With the Routines panel open the toast sits left of the panel (rout.png); upload toast disappeared after about 8 s. Phone no-composer offset not tested. |
| C10 Data room phone | PARTLY | First file row top is 166 px at 375 and 393 px width (was 235; target under 160). Root path row is hidden. Touch checkbox: code-only, not measured. (drp.png) |
| C11 Data room selection | PASS | Select all gives "50 of 67 selected - Select all 67"; table header stayed at y=155 before and after; "Select all 67" gives "67 selected". The failed file has a reason, the finished uploaded file has type Note. |
| C12 A11y and focus | PARTLY | Connect buttons are named "Connect Google Calendar" etc.; row menus are "More actions for <sender>"; search placeholder colour rgb(156,154,147) on dark, about 5:1 (estimated); phone drawer focuses "Close menu", not Search. To do checkbox 44 px and resize-handle focus ring not measured (code has `pointer-coarse:size-11`). |
| C13 Draft reply | PASS | Button shows a spinner and "Drafting..." and is disabled (draft.png). |
| C14 Models | PARTLY | "In use" is on one provider (OpenRouter, the provider of openai/gpt-6-luna), but the text still says "OpenAI: GPT-6 Luna" next to it. On the phone the line is above the list, but it is also repeated below the list (pm2.png). |
| C15 Privacy vs behaviour | PASS | Allow AI models is on and Chief answers (priv.png). The off-state behaviour was not tried. |
| C16 Inbox first screen | PARTLY | First screen shows To do, 5 Needs reply rows and "Other mail today"; Updates uses one "Earlier" heading. Paperclip not checkable: no demo mail has attachments (code is in `InboxRow.tsx`). |
| C17 Routines panel | FAIL | Panel still shows an empty "Chief's computer" heading and blank area (rout.png). `Shell.tsx:3874` hides it only when state is running, stopped or none; the demo computer is in another state. Button still reads "Computer and routines" with a monitor icon when the panel is open. |
| C18 Data room text | PARTLY | Failed card shows a reason and action; dash still appears in Type for failed files (acceptable with the Failed chip). Notice wording and filtering of Failed not exercised. |
| C19 Legal copy | PASS | No ISO dates; derivation note is per-row source text, not a repeated boilerplate; Scan now ends with "Scan finished: nothing changed." (scan3.png, dl.png). |
| C20 Tour | PARTLY | Stops 1-9 never cover the title or first chat line; Skip keeps its slot at stop 9 and Ask Chief is in the body. At stop 9 the popover covers the Send/Discard buttons of a mail approval card (tour9.png). |
| C21 Activity | PASS | One label per state ("Needs approval", "Needs your answer"), whole rows, status on its own line (act.png). |
| C22 Chief answers | SKIPPED | Needs a bank-connect flow. |
| C23 Dead bands | FAIL | At 1920 Contacts has about 350 px between Name text and Email; Data room has about 430 px between Name and Type (c1920.png, d1920.png). |
| C24 Integrations cards | PARTLY | Connected cards share the Open button layout; Blockscout and Coinbase carry a "..." menu the others lack and Coinbase has no "Used by" row; Carta still uses a letter tile (integ.png). |
| C25 Labels and menus | SKIPPED | |
| C26 Polish | PARTLY | Placeholders "Search mail", "Message Chief", "Search names and text" do not end in an ellipsis; hover opacity not checked. |

## Findings

| id | page / cluster | sev | cat | what happened vs expected (observed unless marked) | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| R1-01 | New bot chat, C1 | P1 | bug | A bot delegated a $300 payment to the Mercury agent; the approval card was live while the bot's composer said "This agent could not finish. Try again" and, after reload, "Last run failed". After Deny the bot posted the right answer but the red "Last run failed" line stayed under it. Expected "Waiting for approval", and a failed run's approval expired with "nothing was sent". | pay1.png, pay2.png, merc2.png, nb2.png | `packages/adapters/src/executor.ts` (pauseForAsk/resume); `packages/contracts/src/domain.ts:1152` MISSING_TOOL_FINAL_RESPONSE_ERROR (suspected) | Store a paused-on-approval run state and clear or never raise the failure banner for it; expire the approval when a run really fails. |
| R1-02 | Chief delegation, C1 | P2 | flow | Chief posts an interim "I've asked the Inbox agent to check your open to-dos. Its reply will come through here." and then the answer as a second bubble; the sidebar preview kept the interim text. Expected one outcome message. | chief1.png | executor relay in `packages/adapters/src/executor.ts` (suspected) | Replace the interim relay message with the final one. |
| R1-03 | Email agent, C2 | P1 | bug | Open in composer after a failed send still needs `connectionId`. Not reproduced live (SUSPECTED effect, observed in code). | `MailApprovalCard.tsx:481` | `apps/web/src/components/MailApprovalCard.tsx:481`, `EmailAgentPanel.tsx` | Show the button on every failed send and fall back to the thread's account. |
| R1-04 | Routines panel, C17 | P2 | visual | An empty "Chief's computer" heading with a blank area remains under Routines. | rout.png | `apps/web/src/pages/Shell.tsx:3874` (noComputerScreen) | Also hide the computer block when there is no screen in any non-running state, not only running, stopped or none. |
| R1-05 | Settings > Models, C14 | P3 | copy | "In use" sits on OpenRouter while the text says "OpenAI: GPT-6 Luna"; on a phone the same line shows above and below the provider list. | models2.png, pm2.png | `apps/web/src/pages/ModelSettingsOverlay.tsx:1276-1281` and the embedded line near 1656 | Label the model with its route ("GPT-6 Luna via OpenRouter") and drop the second copy. |
| R1-06 | Data room phone, C10 | P3 | visual | First file row starts at 166 px, target under 160. | drp.png | `apps/web/src/pages/DataRoom.tsx` header | Trim 6 px of header padding. |
| R1-07 | Contacts, Data room at 1920, C23 | P3 | visual | 350-430 px empty bands between columns. | c1920.png, d1920.png | table column widths in `Contacts.tsx` and `DataRoom.tsx` | Cap the Name column width or let the other columns share the width. |
| R1-08 | First-run tour stop 9, C20 | P3 | visual | The stop-9 popover covers Send/Discard of an approval card in the open thread. | tour9.png | tour popover placement in `Shell.tsx` (suspected) | Anchor the popover above the composer or move it off the thread column. |
| R1-09 | Investors, C3 | P3 | bug | On the first visit after sign-in, Equity raised showed a dash; three later loads showed $300,000. Not reproduced, cause unknown. | inv.png | `Investors.tsx` Summary (`safesFailed` path), suspected | Retry the SAFE request once on failure instead of leaving the dash. |
| R1-10 | Integrations, C24 | P3 | visual | Some Connected cards carry a "..." menu and a "Used by" row, others do not; Carta keeps a letter tile. | integ.png | Integrations card component | Give all Connected cards the same header and footer slots. |

## Excellent

- Data room Select all: clear "50 of 67 selected - Select all 67" bar with no layout shift.
- Legal rows are clickable anywhere and the opened view has "Back to Legal".
- Scan now ends with a one-line result.
- Chief's to-do count matches the To do card, and the Mercury agent's deny message is short and clear.
- Fundraising and Investors now show the same SAFEs and total.

## Environment notes

- At the end of the walk the app showed "Still opening... Try again" on reload (demo stack loaded by parallel walkers); not reported as a bug.
- My walk created a bot named "New Bot" (payment test, $300 denied) and uploaded r1-walker-note.txt to the Data room.
