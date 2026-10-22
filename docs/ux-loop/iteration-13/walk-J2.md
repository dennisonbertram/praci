# Walk J2 (uxl13-J2): long journeys for raising and operating

Target: demo stack web :5381, 1440x900, signed in as the mock founder. Screenshots are in /tmp/uxloop13/J2/ (file names below). Console showed no errors on any screen walked. Geometry audit run on Data room and Finance: no page overflow and no spills; the only uneven rows were sidebar rows (time/badge columns), which are intended.

Not covered: file upload/drag (needs the OS file chooser), Carta connect (OAuth), time-travel for Legal, FIN-020 crypto, Deny path of the payment card, phone width. Investors and Fundraising were judged for P0/P1 only (other session owns them); lower-severity notes on them are kept in "Notes for the Investors owner".

## Story verdicts

| Story | Verdict | Steps actual / ideal | Note |
|---|---|---|---|
| STORY-DRM-018 first week library | SKIPPED (partial) | consent+search+preview walked / 5 | Upload steps not walked. On a populated room the "Let Praci read your documents" card (Allow / Not now) works: toast "Praci can now read your documents", a Term Sheet row classified itself to Contract / Quill Capital within seconds. Board Minutes stayed "Not tagged yet" (demo has no model). |
| STORY-DRM-019 investor diligence request | PASS | 5 / 6 | Search "board minutes" shows a highlighted snippet; row preview opens; select rows, bottom bar offers Download, Email, Send to agent. Email opens a compose with both files attached. The catalog (no multi-select, no bulk download) is out of date. |
| STORY-CAP-017 first visit to a working setup | BLOCKED (connect) / PASS (read) | 3 / 4 | Carta is pre-connected. Investors page shows donut bar, holders, SAFEs "if converted at cap" 2.5%, contacts tabs "SAFEs and funds / Board". |
| STORY-LEG-017 quarter on Legal | PASS (partial) | 4 / 6 | Deadlines tab, overdue chip, Done with inline "Marked ... done. Undo", sidebar overdue badge cleared. Quarter simulation not walked. |
| STORY-FIN-019 first morning with Finance | BLOCKED (connect) / PASS (read) | 2 / 8 | Dashboard reads clearly (Cash $1,633,221, burn, runway 24.2 mo, upcoming, breakdown). Runway matches the agent's answer ($1,633,221 in the routine reply). |
| STORY-FIN-020 investor update with crypto | SKIPPED | - | Time. |
| STORY-APP-210 monthly investor update | PARTIAL | 6 / 10 | Update editor (Subject, To checkboxes, Body, "Draft with agent", From) is clean but has no way to attach a Data room file. The Data room "Email" bulk action is the working route. Send not exercised. |
| STORY-APP-385/386 approve an agent action that moves money | PASS | 8 / 5 | Integrations > Mercury > Allow changes (dialog says "move money") > asked own bot > toast "Mercury agent needs approval: Send $1,200.00 to Acme Servo Supply (Mock) from MOCK Checking ..1111" > card with "Send $1,200.00" / "Deny" / Details > "Approved here. Waiting for Mercury" > agent says "pending approval, no money has moved". One P1 below. |
| STORY-APP-353 / 172 bot + skill + routine | PASS | skill 5 / 9, routine 8 / 6 | New bot, rename (auto-saved, "Saved"), Add skill form (Name / What it does / Instructions, no YAML), routine with skill picker, weekdays 9:00, "Saved", "Next run ...", Test run produced a correct answer in 29 s via the Finance agent, run history "Done 29s". |

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected location | proposed fix |
|---|---|---|---|---|---|---|---|
| J2-01 | APP-385/386, delegated payment | P1 | bug | Observed. Asked own bot to pay $1,200; it messaged the Mercury agent, which raised the approval. Meanwhile the bot's chat showed a red banner "This agent could not finish. Try again." with Retry, for 30+ s, then cleared by itself when the Mercury agent replied. Expected: "Waiting for approval", not a failure. Retry during a pending payment request invites a second request. | 36-pay.png, 37.png, 41-cw.png | packages/adapters/src/pi-runtime.ts:626 (run ends with tool work and no final text after delegating); packages/core/src/user-error.ts:189 (banner suppressed only after a reply or when this thread has a waiting_input run) | Treat a run that ended after handing work to another agent whose approval is pending as waiting, and hide the failure banner and Retry until that agent answers. |
| J2-02 | APP-172 routine Test run | P2 | flow | Observed. After Test run the button stayed "Test run" (not "Running..."), and Run history said "No runs yet" for at least 5 s; the "Running" row appeared only after ~20 s. Easy to click Test run twice. Expected: immediate Running state. | 29-testrun.png, 30-testrun2.png | apps/web/src/pages/RoutineEditor.tsx:334,430 (`running` shown, but it did not turn true here) | Set running as soon as Test run is clicked, until the run row reports done. |
| J2-03 | LEG-017 Done | P2 | perf | Observed once. Clicking Done greyed Done/Dismiss, nothing else changed for about 10 s (request pending), then the row left with "Undo". Parallel walkers were loading the same stack, so the delay may be load. No spinner or progress. | 14-done.png, 14b-done.png, 14c.png | apps/web/src/pages/legal/LegalDeadlines.tsx (updateDeadline call) | Remove the row at once (optimistic) with the Undo notice, or show a spinner on the button. |
| J2-04 | DRM-019 compose | P3 | copy | Observed. Closing a compose that has only attachments (no text) says "Your text is saved as a draft. Attachments are not kept." There is no text to save. | 07b.png (dialog shown in 08-addfiles.png) | Inbox compose close dialog | Say only "Attachments are not kept." when the body is empty. |
| J2-05 | Integrations > Mercury | P3 | flow | Observed. Before the agent exists, the Agent card shows the title "Mercury agent" as plain text, though no such agent is in the sidebar; it is created only when the switch is turned on. A reader may look for it. | 32-mercury.png, 34.png | apps/web/src/components/integrations/IntegrationAgentSection.tsx:73-79 (unlinked name when no agentHref) | Show "Created when you allow changes" or hide the name until it exists. |
| J2-06 | LEG-017 seed text | P3 | copy | Observed (demo seed). Deadline note says the policy "renews on December 1 unless cancelled 30 days before", while Contracts shows the term ending Dec 2, 2026 and the deadline Nov 2 (30 days before Dec 2). | 13-deadlines.png, 12-legal.png | demo fixture / Legal scan text | Fix the seed text to Dec 2. |

Praise (observed): bulk selection bar in Data room (Download, Email, Send to agent); search snippets with highlighting; the payment approval card (one-sentence question with amount and account, primary button names the amount, Deny, Details folded); "Allow changes" dialog now says "move money"; skill form needs no YAML; routine editor gives "Saved", "Next run ...", a skill picker and a working Test run with "View chat"; Legal Done has inline Undo and clears the sidebar overdue badge; New bot opens with the name selected and a greeting question.

## Notes for the Investors owner (not counted: below P1)

- Updates and Pipeline cards show grey placeholder bars with no words when empty, which looks like a stuck loader (09/10b screenshots, 11-fund.png).
- "New update" shows no pending state; three clicks while the save was slow created three drafts (3 rpc investors/updates/save calls; Investors.tsx:683).
- "Equity raised $300,000 / 2 SAFEs" counts a SAFE with status Sent (Harbor Angels $50,000); Fundraising lists it as Sent and only Quill $250,000 as Funded. Both pages use one SAFE list (as decided), but "raised" includes an unfunded SAFE (packages/core/src/safes.ts:50).
- The update editor has no attach control (see APP-210).

## Catalog drift to fix

STORY-DRM-019 (bulk download and Email now exist), STORY-APP-353 (skill form replaced the SKILL.md text area), STORY-APP-172 (routines open from the header "Routines" button, button reads "Create a routine", routine editor has an "Add a skill" picker, shows "Saved" and "Next run"), STORY-APP-385/386 (card says "Send $1,200.00"/"Deny", not "Allow once", and shows a sentence, not JSON).
