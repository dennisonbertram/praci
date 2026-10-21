# J4: Chat save, duplicate and lookup (STORY-019, 024, 027, 020)

Walked on the mock demo stack with a fresh browser session. Screens are in `J4-chat-save-and-duplicate-screens/`. "Measured" means seen in a screenshot or page text. "Suspected" means inferred.

Walk caveat: another walker was using the same Chief thread at the same time. An "Omar Example" message from that walker appeared between mine (screen 04-run-8, 05-reply). Findings about that are marked suspected.

## Friction Scorecard

| Story | Ideal steps | Actual steps | Notes |
|---|---|---|---|
| 019 Save Lena Sample | 2 | 3 (type, send, then open Contacts to confirm) | The chat never confirmed Lena. See below. |
| 024 Duplicate Quinn | 2 | 2, then a third to check Contacts | Reply said "already saved. I updated the contact type to advisor." |
| 027 Working label | 1 (watch) | 1 | Labels seen, see below. |
| 020 "Who is our auditor?" | 2 | 2 | Answer was "I don't have an auditor saved in your important contacts." |

- No approval card, confirmation or dialog appeared on any run (measured, 07-dup-6, 09-auditor-2). Nothing to remove.
- Step 019: I sent "Save Lena Sample, lena@partner.example.test, ..." (03-after-skip). Chief showed "Thinking 6.4s / Waiting for the model", then "Adding a contact" (04-run-3, 04-run-8). The only reply was about Omar Example, from the other walker's message (05-reply). Lena got no reply. The Contacts page does show Lena Sample, Partner Example, kind Partner (06-contacts-after-lena). So the save worked but I could only learn that by leaving the chat (measured). Whether the missing reply is a real bug or a side effect of two messages sent into one thread is suspected only.
- Step 024: The duplicate request took about 25 s of mock-model time (07-dup-3 "Thinking", 07-dup-6 "Adding a contact 18.6s"). The reply says Quinn "was already saved" and that the type was updated to advisor (07-dup-8). Contacts now shows Quinn as Advisor (page text from 08). The catalog says `contacts_add` changes nothing on a duplicate, so either the model used `contacts_save` or another walker changed the kind earlier. Measured: the label was "Adding a contact", not "Saving a contact". Suspected: the mock reply text is scripted.
- Step 020: After Quinn became Advisor, the auditor question correctly found no auditor (09-auditor-2). That is an accurate answer, but it follows from the previous step, and Chief did not mention that Quinn is saved as an advisor at an audit firm. A founder asking "who is our auditor?" would likely want Quinn. This is a kind-filter limit (catalog issue 8 family), not a chat problem.
- A first-run tour card ("Chat with Chief here...") covered the thread on arrival and had to be skipped (01-chief-chat). Not part of this journey's design.

## Take-away Pass

Chief thread with a running tool (04-run-3, 04-run-8):
- Header chip "Working..." in the sidebar row and the in-thread "Adding a contact 21.0s" line say the same thing. Removable: one of them. Suspected low value, but it is the shared app pattern for all agent runs, so not specific to contacts.
- The in-thread elapsed seconds counter is useful for long runs and should stay.
- Primary action while running: Stop (square button). Correct.

Chief reply (05-reply, 07-dup-8):
- A "Chief finished" toast repeats the reply text over the chat when the thread is already open (05-reply, 07-dup-8). It covers the last words of the reply. Removable when the user is looking at that thread. This is app-wide, suspected P3 for contacts.
- Nothing in the reply links to the saved contact. Removing nothing here; this is an addition gap (below).

Contacts page after the save (06): no highlight, no toast on the new row (catalog issue 13). Lena is found by scanning an alphabetical list.

Sidebar search for "Quinn" (08): finds mail search and chat messages, not the contact. Not removable, but a dead end for "find a person".

## The Simpler Version

1. Founder types "Save Lena Sample, lena@..., partner at Partner Example" in Chief.
2. A working line reads "Adding a contact" (or "Contact already saved" when it is a duplicate).
3. The reply names what was saved and where, and the contact name opens the contact. One reply per request, even with two messages in flight.

For a duplicate: step 2 reads the outcome, and the reply states plainly whether anything changed. For "who is our auditor": one step, the reply names the person or says none is saved.

Changes needed:
- The reply carries a link to the saved contact, like the "MOCK Hiring Plan - Q4" link in the existing chat replies (04-run-8 shows the link pattern). Backend returns the contact id in the tool result; the thread renders it.
- The working label reflects `alreadySaved` (catalog issue 6).
- Every user message gets its own reply, or an error line (suspected issue for Lena).

## Clarity Issues

- "Adding a contact" is shown for new and existing contacts (measured, 07-dup-6; the code maps only the tool name in `working-label.ts`).
- Reply "I don't have an auditor saved in your important contacts" (09-auditor-2) uses "important contacts". The page and sidebar say "Contacts". One concept, two names (measured).
- Reply "I updated the contact type to advisor" (07-dup-8) says "contact type"; the Contacts column and filter say "Kind" (08 page header shows Kind). Two names for one field (measured).
- Reply text is the only report of what was saved. The Lena request had no reply at all (measured).
- "Waiting for the model" then "Adding a contact": the first label is clear, no change needed.

## Ranked Changes

| Rank | Change | Effort | Files | Status |
|---|---|---|---|---|
| P1 | Working label says the real outcome: "Contact already saved" when the tool result has `alreadySaved`. Keeps the founder from trusting "Done" on a no-op. | S | `apps/web/src/pages/shell/working-label.ts` and the place that passes the tool result to it | Measured (label) |
| P1 | Each saved contact appears as a link/chip in the reply thread, so the founder can verify without scanning Contacts. Reuse the existing artifact link pattern in chat. | M | `apps/web/src/pages/shell/` thread tool-result rendering, `packages/adapters/src/contact-tools.ts` (return id) | Measured gap |
| P2 | Make sure a message sent while another run is active still gets an answer or an error; Lena's message had none. Verify with a single walker first. | M | Chief run queue in `packages/` agent runtime | Suspected (shared thread) |
| P2 | Use one name: "contacts" and "kind" in agent instructions and replies, not "important contacts" or "contact type". | S | Agent prompt text for Chief and `contact-tools.ts` descriptions | Measured |
| P2 | After a duplicate, state whether the kind or fields changed (the catalog says `contacts_add` never changes; this walk showed Quinn as Advisor). Confirm whether `contacts_save` ran. | S | `contact-tools.ts` result text | Suspected |
| P3 | Hide the "Chief finished" toast when that thread is open and visible; it covers the end of the reply. | S | `apps/web/src/pages/shell/` toast logic | Measured (05, 07-dup-8) |
| P3 | Highlight the new row on Contacts after an agent save (matches Cap table). | S-M | `apps/web/src/pages/Contacts.tsx` | Measured (06; catalog issue 13/18) |

Verdict: acceptable. The chat path has no extra steps or confirmations, but the evidence of what was saved is thin.
