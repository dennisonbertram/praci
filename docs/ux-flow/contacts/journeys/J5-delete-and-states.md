# J5: Delete, cancel, and empty/loading/error states

Stories: STORY-016 (delete then Undo, Contacts versus Cap table), STORY-017 (cancel, Escape, keyboard), STORY-006 (empty, loading, error), STORY-008 (find one contact on a phone, 390x844).

Method: walked the live mock demo at 1280x800 and 390x844 with a throwaway contact "Delete Me (Mock)" (added, deleted on Contacts; added, deleted and restored on Cap table; deleted on the phone). Empty, loading and error states were judged from `apps/web/src/pages/Contacts.stories.tsx` and the page code, not provoked. Screenshots are in `J5-delete-and-states-screens/`. Every claim is marked **measured** (observed live) or **suspected** (from code or inference).

Note: the demo stack is shared, so other walkers' edits show up (for example Quinn Auditwell turned into an Advisor, an extra Omar Example row). They do not affect these findings.

## Friction Scorecard

| Journey | Actual | Ideal | Notes |
|---|---|---|---|
| Delete on Contacts (row to gone) | 3: click name, Delete (dialog closes), done | 3 | Measured (03, 04). No confirm, no toast, no Undo. A mistaken delete means re-typing the contact. |
| Delete on Cap table, with Carta data | 3 + 1 Undo, plus scrolling | 3 + 1 | Measured (07, 08, 09). Contacts sit far below the donut and cards. I had to scroll about 900px, and the toast is at the bottom of the page column, so it is visible only if the page is already scrolled to the end. |
| Undo after delete | 1 click | 1 | Measured (09): row returns, toast reads "Restored Delete Me (Mock)". |
| Cancel/Escape | Escape or Cancel closes, discards silently | 1 | Measured: typed Notes were discarded on Escape, no prompt, no stored change (re-opened with the old value). Acceptable for a four-field form. |
| Keyboard: Tab order in dialog | Name, Email, Organization, Kind, Notes, **Delete**, Cancel, Save | n/a | Measured. Delete is the first button after Notes and before Save. Enter in Notes adds a newline, so Enter is safe there, but a stray Enter or Space on the focused Delete deletes at once. |
| Phone: find Lee's email | 3 taps (menu, Contacts, name) | 3 | Measured (13, 14, 15). With nine contacts the whole list fits on screen, so search was not needed. Email is only visible after opening the dialog. |
| Empty/loading/error | 2 (open page, Add contact) | 2 | Suspected from code (`Contacts.tsx` lines 62-80). See Clarity. |

Confirmations: zero on delete, on both pages. That matches the heuristic "prefer undo over confirm", but only Cap table has the undo.

Dead ends:
- After Contacts delete the user lands on the list with no sign anything happened except the row missing (04). Measured.
- Error state on Contacts has text but no Try again (code: `Contacts.tsx` error branch, lines 62-65). Suspected from code, matches Known issue 4.

Hesitations:
- "Was that final?" after Delete on Contacts: nothing says. Measured.
- On Cap table, the confirmation toast can be below the fold while the user is still looking at the rows. Measured at 1280x800 with Carta data (08 shows it only because the page was scrolled to the end).
- The Delete button is red text on a dark red tint (03), quieter than a destructive button but unmistakable. Fine.

## Take-away Pass

Contacts page, per element:
- Search, Kind filter, table: all used. Nothing to remove. At 390px the table fits nine rows with Name and Kind (14).
- "Contacts are your address book. They do not change Carta." hint in the dialog (03): static explainer text on every edit, repeated on every open. It is useful the first time and noise after. Deferrable, but low harm. (Measured, 03 and 15.)
- Delete inside the edit dialog: the only delete entry point on both pages. Fine. One primary action (Save) is clear.

Cap table, for the contact tasks only:
- Contacts are below four stat cards, a donut and its legend when Carta data exists (05, 07). For "who do we work with", that is a lot to cross. Not removable for the cap-table job, but it is the main reason delete feels harder there. Measured.

Phone dialog (15): Save, Cancel stacked full width, small Delete last. One primary action, and Delete is hard to hit by accident. Good.

## The Simpler Version

1. Open the contact (click or tap the name).
2. Delete.
3. A toast appears at the same place on both pages: "Deleted Delete Me (Mock)" with Undo.
4. Undo (optional), same as Cap table.

Changes needed: give the Contacts page the same Undo toast that Cap table already has. Contacts passes only a reload to the dialog; Cap table passes `onDeleted` and builds a restore through `rpc.contacts.save` with the old fields (CapTable.tsx lines 510-516). Moving that into one shared hook removes the difference between pages (one way to do one thing).

Empty state: open Contacts, press Add contact (header). Optionally put a single Add contact button inside the empty body, as Cap table does per tab.

## Clarity Issues

- Two different delete behaviors for the same button. Measured (04 versus 08).
- "Deleted Delete Me (Mock)" reads oddly only because of the test name. Copy otherwise fine. "Restored <name>" is clear.
- Empty copy differs: Contacts says "No contacts yet" (code, line 77) while Cap table says "Add your investors, auditors and counsel here. Contacts are your address book." (CapTable.tsx line 496). Cap table's text is an explainer; Contacts' text has no next step in the body, and the Add contact button is in the header. Suspected from code, not provoked live.
- Error copy: Contacts shows the raw error or "Could not load contacts" in red, with no retry and no sign that data is safe. Cap table shows the same text with a Try again button. Suspected from code.
- Cap table's contact toast is an inline sticky block at the bottom of the page, not a floating toast. Measured (07, 08, 09). A second, floating toast ("Chief finished") can sit near it and look like the same thing (08).
- Possible demo-only bug, not a UX proposal: on the demo stack, clearing the Notes field and pressing Save did not clear Notes after reopening or reloading. Measured on the demo stack; the contract says null clears a field and the API code reads as if it should, so the cause is unknown (suspected demo store behavior). Worth checking against Postgres.
- Escape and clicking outside lose edits with no warning. Measured for Escape (Notes discarded). For a short form this is acceptable; do not add a prompt.

## Ranked Changes

| Rank | Effort | Change | Files |
|---|---|---|---|
| P1 | S-M | Give Contacts the same delete-with-Undo toast as Cap table. Share one hook or small component so both pages behave identically. | `apps/web/src/pages/Contacts.tsx`, `apps/web/src/pages/CapTable.tsx`, a shared hook next to them, plus stories for the toast state |
| P2 | S | Add Try again to the Contacts load error, reusing the existing `load` callback and the Cap table pattern. | `apps/web/src/pages/Contacts.tsx` (also add an Error story in `Contacts.stories.tsx`) |
| P3 | S | Align the empty states: Contacts body gets an Add contact button; drop the explainer sentence on Cap table to a short "No contacts yet" with the same button. | `apps/web/src/pages/Contacts.tsx`, `apps/web/src/pages/CapTable.tsx` |
| P3 | S | Check why clearing Notes does not persist on the demo stack; fix only if it reproduces on Postgres. | `apps/api`, `packages/db/src/contacts.ts`, demo store under `packages/testkit` |
| P3 | S | Optional: move the Delete button after Save in tab order only if misfires are reported. No evidence yet; the form is short and Delete is visually distinct. | `apps/web/src/components/ContactDialog.tsx` |

Not recommended (journey already minimal): a delete confirmation dialog (the Undo toast covers it), a discard-changes prompt on Escape, and extra phone search shortcuts (nine contacts fit on one screen; revisit if the list grows past about fifteen).
