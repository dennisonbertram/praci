# UX Flow Critique: Contacts (2026-10-20)

## Run Summary
| Metric | Value |
|--------|-------|
| Journeys critiqued | 5, plus a cross-cutting redundancy pass |
| Evidence source | Live pass on the mock demo stack |
| Verdicts | 0 minimal · 5 acceptable · 0 convoluted |

## Friction Scorecard
| Journey | Steps (actual/ideal) | Main friction |
|---------|----------------------|---------------|
| J1 Who's our lawyer | 7/3 | The search "lawyer" and the Legal kind filter both return "No matches": the firm is kind Other, and search ignores notes |
| J2 Add by hand | 5/5 | Save gives no confirmation; the duplicate-email error is far from the field |
| J3 Trust agent saves | 4/4 | Nothing shows which contacts an agent added; the reply does not name the kind |
| J4 Chat save and duplicate | no extra steps | The working label is the same for new and already-saved contacts; the copy says "contact type" while the UI says "Kind" |
| J5 Delete and states | 3/3 | Contacts delete has no Undo, while Cap table has one; the load error has no Try again |

## Redundancy Map
- Contacts and Cap table are two editors of one address book, and they differ in delete Undo, the default kind, and the Carta hint. Decision: Contacts is the canonical address book. Cap table keeps its investor and auditor view and shows only cap-table kinds.
- The Cap table tabs duplicate the Kind filter, but only for cap-table kinds. They stay, scoped as above.
- Notes are visible only in the dialog. Search now covers notes, so a notes column was not added.

## Simplification Proposals (ranked; fixed in this pass unless marked)
1. Search covers notes and kind labels on the page and in `contacts_list` (J1).
2. Delete on Contacts gets the same Undo toast as Cap table (J5, redundancy).
3. A save on Contacts is confirmed by a row highlight (J2, J3).
4. "No matches" gets a Clear action, and the load error gets Try again (J1, J5).
5. Agents pick specific kinds (a law firm is Legal) and say the kind and whether the contact was new or already saved. The demo law firm is seeded as Legal (J1, J3, J4).
6. A contact records which agent added it, and the dialog shows it (J3).
7. The Carta hint shows only on Cap table. The duplicate-email error sits under Email. A new contact starts with the active Kind filter's kind (J2).
8. Search and Kind live in the URL (J1).
9. Cap table lists only cap-table kinds, so customer, vendor and similar contacts stay on Contacts (redundancy).
10. Clearing Notes in the dialog persists (J5, possible bug).

## Not changed, with reasons
- "Open <name>" discards what was typed in the new contact. The user is switching to an existing record, and silently merging typed values into it would be a surprising edit.
- No delete confirmation, and no discard prompt on Escape. Undo covers delete, and the dialog is short.
- The Delete tab order is unchanged; there is no evidence of misfires.
- The Kind menu keeps all kinds; a menu that changes with the data is harder to learn.
- Rebuilding Cap table as holders only is out of scope for this feature.
- Sidebar search for contacts is deferred unless it fits the existing sidebar search pattern cheaply.
- Chief not replying to one message is suspected to come from several walkers sharing one thread; it is not reproduced.

## Already Minimal
- Editing a contact (J3: 4 steps, no re-entry), adding by hand (J2: 5 of 5), and reaching a contact on a phone (J5: 3 taps).
