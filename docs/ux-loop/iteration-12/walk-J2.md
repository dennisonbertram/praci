# Walk J2 (iteration 12): long journeys for raising and operating

Session uxl12-J2, 1440x900, mock-data demo stack (web 5381). Screenshots in /tmp/uxloop12/J2/. The demo account is shared with other walkers, so duplicate cards and other walkers' approval toasts were seen and ignored (I only approved my own $20 card, identified by its note). Maya here is the seeded demo user, not a brand-new account.

## Story verdicts

| Story | Verdict | Steps actual / ideal |
|---|---|---|
| STORY-DRM-109 (data room prep, scaled down: small synthetic zip and PDFs instead of 1.2 GB; no password zip, no video) | PASS with findings | 10 / 14 (upload, Allow, Ask, Auto-sort, Apply) |
| STORY-CAP-017 / CAP-106 (cap table after a SAFE) | PARTIAL: Carta connect step BLOCKED (Carta already connected in the demo and needs a real host); read, SAFE conversion and Ask steps PASS | 3 / 4 |
| STORY-LEG-007 + APP-212 tail (legal deadlines, mark done, ask agent) | PASS | 3 / 3 (Legal, Deadlines tab, Done). Email-to-reply head of APP-212 SKIPPED (Gmail is not walked here) |
| STORY-APP-385/386 (agent action that moves money) | PASS with findings (first attempt errored, retry worked) | 9 / 7 |
| STORY-APP-363 + APP-172 (bot, skill, routine) | PASS | 22 / 22 (bot rename, new skill, /skill run, routine create, schedule, save, test run). Drafted-skill approval path (APP-363 steps 3-9) SKIPPED |

Excellent and worth keeping:
- Legal Deadlines tab: red "1 overdue" count on the tab, rows with quote and reason, Done gives "Marked ... done." plus Undo, and the sidebar badge clears at once.
- Approval card: "Send $20.00 to Acme Servo Supply (Mock) from MOCK Checking ••1111?" with a Details block (amount, recipient, account, note) and "Send $20.00" / "Deny". After approval: "Approved here. Waiting for Mercury", then "Submitted. Mercury is holding the payment for its own approval; approve it in the Mercury app or website." The toast opens the exact card.
- Routine editor: skill picker inserts @skill, plain schedule ("Every week, Monday at 9:00 AM"), "Next run Mon, Oct 26, 9:00 AM" is correct for today (Thu Oct 22), "Saved", and Run history with "Done, 19s, View chat".
- New bot: name autosaves, skill saved and offered immediately by `/`, skill ran through the Finance agent with figures that match Finance and Chief ($1,633,220.65 cash, 24.2 months).
- Cap table agent: "about 39.0%, down from 40.0%" is correct for 2.5% SAFE dilution of a 40% holder. The page also shows "SAFEs, if converted at cap 2.5%".
- Data room agent says plainly that one file is still being indexed and results may be incomplete. Auto-sort shows a proposal, grouped by target folder, and "Sorted 33 items" with Undo.

## Findings

| id | story / page | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| J2-01 | APP-385/386 chat with a custom bot | P1 | flow | Observed. First "Pay $20" via my new bot ended with a red "This agent could not finish. Try again." and no approval toast. The Mercury agent thread showed that first card as "No longer active". Retry then re-sent the identical message (two identical user bubbles) and only then surfaced a working card. Maya cannot tell whether a payment is pending, expired or never created. Expected: either the card appears, or the error says the payment was not requested. Cause is suspected to be the delegate run ending with no final answer on the mock model. | 33-pay.png, 36-retry.png, 37-approvalcard.png | packages/contracts/src/domain.ts:1152 (MISSING_TOOL_FINAL_RESPONSE_ERROR) and the delegation path that created an approval for a run that then failed | When a delegated run fails after creating an approval, expire it and say "Nothing was sent" in the error; make Retry not add a second user bubble. |
| J2-02 | Data room | P2 | flow | Observed. "MOCK Board Minutes - October.pdf" stays Type "—" with no status or reason after AI consent was granted and the strip ended; a "Processing 1 file / Reading Board Minutes" strip showed for minutes first. Failed rows say why, this one says nothing. May be a seed artifact. | 07-answer.png, 51-drm-later.png | apps/web data room status column (not traced) | Show "Couldn't read" or "Not tagged" for any finished file without a type. |
| J2-03 | Legal Contracts tab | P2 | visual | Observed after the rescan. Parties column now starts with the user's own company and clips the counterparty: "Northwind Robotics (Mock), Shieldwell…". The self-filter only drops an exact name match, so "(Mock)" or "Inc." variants slip through; in the demo it hides the useful name. | 53-scan2.png | apps/web/src/pages/legal/LegalContracts.tsx:100-105 (withoutSelf) and :207-208 | Match the company name by prefix or normalized name, and put the counterparty first. |
| J2-04 | Legal Contracts tab | P3 | copy | Observed. Renewal cell truncates to "Auto-renews, 30 days no…" at 1440. | 15-legal.png | legal/LegalContracts.tsx:36 and the Renewal TableCell | Shorten to "Auto-renews · 30d notice" or let the cell wrap. |
| J2-05 | Legal | P3 | flow | Suspected. Clicking Scan now showed no "Scanning…" state within 3 s and no result line within 30 s ("Last scan 10m ago" unchanged), when nothing new needed scanning. Page code has a Scanning label and a result line, so this may be a timing or nothing-to-do case. | 52-scan.png, 53-scan2.png | apps/web/src/pages/Legal.tsx:119-126, 284, 303 | Always show a one-line result ("Nothing new to scan") after Scan now. |
| J2-06 | Investors (only reported because it is a journey step; owned elsewhere) | P3 | copy | Observed. "SAFEs, if converted at cap" names "Harbor Angels (Mock)" while the table row for the same $50,000 SAFE reads "Lee Notarealperson". Same SAFE, two names. | 12-cap2.png | apps/web/src/pages/Investors.tsx cap section | Use one display name (investor entity) in both places. |
| J2-07 | Routine editor / skill picker | P3 | visual | Observed. "Add a skill" lists the user's own "weekly-cash-check" last, after 11 built-ins with mixed casing. | 45-when.png | pages/RoutineEditor.tsx skill select | List the user's skills first. |
| J2-08 | Bot panel, Routines | P3 | visual | Observed. With no routines the right panel shows the Routines header, a button, then a large blank area with a floating label "MOCK J2 Ops Bot's computer" and nothing under it. | 43-routines.png | pages/Shell.tsx computer panel | Hide the "computer" label until there is a screen to show. |
| J2-09 | Chat after Test run | P3 | copy | Observed. Agent reply says "last synced at 08:41 UTC" while the routine editor and Maya's clock are Eastern. | 50-testrun2.png | Finance agent copy | Give times in the user's zone. |
| J2-10 | Data room toasts | P3 | visual | Observed. Persistent upload toasts ("Uploaded / View", "Added 2 files / View") sit bottom-right over the last visible rows of the list until dismissed. Already a known edge case in DRM-109. | 04-upload2.png | toast stack | Auto-dismiss completed upload toasts after about 8 s. |

Not findings: the failed fake PDF correctly says "This file isn't a readable PDF." with a Delete button (my file was invalid on purpose). Two "New Bot" rows and other walkers' $250 and $75 approval toasts come from parallel walkers.

## Console and geometry
Console on Data room and Legal: only Vite debug lines, no errors. geometry-audit.js on Data room and Legal: pageOverflowX 0, no overflow spills; flagged "unevenRows" are normal sidebar rows. Touch-target checks were not run (no touch emulation in this pass).

## Not covered
Carta connect (needs real host), password-protected zip, 600 MB video and 1.2 GB zip (not practical on this stack), email-to-Legal head of APP-212 (Gmail), skill drafted by the agent and approved (APP-363 steps 3-9), the "Allow changes in Mercury" dialog (the switch was already on from another walker and I did not toggle shared state), phone width.
