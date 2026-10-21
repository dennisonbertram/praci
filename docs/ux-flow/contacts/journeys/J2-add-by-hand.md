# J2 Add by hand (STORY-011, STORY-012, STORY-014)

Walked on the mock demo stack with invented data (Noor Testperson, noor@vendor.example.test). Screenshots are in `J2-add-by-hand-screens/`. "Measured" means I saw it in the browser; "suspected" means it comes from the catalog or from reading the screens only.

Verdict: acceptable. The happy path is close to its ideal. The friction is a silent save, a duplicate error that discards typed input, and an error message placed far from the field.

## Friction Scorecard

| Story | Ideal steps | Actual steps | Notes |
|---|---|---|---|
| STORY-011 add | 5 (open, Add, fill Name and Email, pick Kind, Save) | 5 | Measured: 01, 02, 05, 07. No extra screens or confirmations. |
| STORY-012 validation | 3 | 3 | Measured: 03 (Save disabled for a spaces-only Name), 04 (browser bubble for "noor@"). |
| STORY-014 duplicate | 6 | 5 to reach the existing record, plus 1 re-entry | Measured: 08, 09, 10, 11. |

- Decisions: Kind is the only real decision; it defaults to Other (02). Organization and Notes are optional and do not block.
- Re-entry (measured, 09 to 10): after "Open Noor Testperson" the dialog becomes "Edit contact" and the typed Name "N. Testperson" and the chosen Kind "Vendor" are gone; Kind shows "Other" again. The user must pick Kind again.
- Confirmations: none on add. That is correct.
- Dead ends: the success state is a silent close (07). The row sits in the alphabetical list with no highlight or toast. Measured on a 7-row list: the new row was visible, but it was between other rows with nothing marking it. On a long list it would be off-screen (suspected).
- Hesitations: Save is grey with no hint when Name is empty (03, measured); Kind starts as Other, so a user who skips it saves the wrong kind (02, 07, measured: my first attempt saved as Other).
- Automation note: my first click on the Kind menu option did not register (the contact saved as Other, 07). The screenshot of the open menu (05) did not show the popup. I treat this as a tooling limit, not an app bug. Selecting through the select control worked (09).

## Take-away Pass

Add contact dialog (02):
- Organization and Notes: optional fields shown up front. Removing them is possible but they are cheap and used by agents and Cap table. Keep; they are not the cause of any friction. (suspected, no step needs them)
- Hint "Contacts are your address book. They do not change Carta." (02, 04, 09, 10): measured as shown on every dialog, including Contacts, where Carta is not on screen. It is explainer text that repeats nothing in the interface. Removable on Contacts; keep only where the dialog is opened from Cap table.
- Delete button on the edit dialog (10): correct for edit, absent on add. Fine.

Duplicate error (09):
- The red text "Another contact already has this email." and the "Open Noor Testperson" button appear below the hint, at the bottom of the form, with the Email field above out of view of the error. The dialog also grows by about 70 px, so it shifts up (compare 08 and 09). Measured.
- The button label "Open Noor Testperson" is clear and is the one useful action. Keep.

Contacts list after save (07, 11):
- Nothing is removable. The missing piece is feedback, not an extra element.

## The Simpler Version

1. Open Contacts from the sidebar.
2. Click "Add contact".
3. Type Name and Email; Kind is a select with Other as the default.
4. Click Save. The dialog closes, the list reloads and the new row is briefly highlighted, with the same "Added <name>" Undo toast that Cap table uses.
5. If the email already belongs to someone: the error appears next to the Email field and "Open <name>" carries what the user typed (name, kind, notes) into the existing contact's form instead of discarding it. Alternatively, "Open <name>" closes the dialog and scrolls to and highlights the existing row.

Concrete changes: reuse Cap table's toast and highlight in Contacts (issue 13 in the catalog); show the duplicate error under the Email field; stop discarding input on "Open <name>" (issue 10).

## Clarity Issues

- Disabled Save with no reason (03, measured). The field already carries a required marker in the accessibility tree ("Name" is required), but a sighted user sees only a grey button. Low cost to leave; a fix would add copy, which AGENTS.md discourages. Leave as is.
- Browser-native email bubble (04, measured): "Please enter a part following '@'. 'noor@' is incomplete." The wording is the browser's and varies. It is clear in Chrome. Leave.
- "Open Noor Testperson" (09, measured): clear. But the dialog then changes title from "Add contact" to "Edit contact" with no sign that the typed values were dropped (10). Measured: Kind returned to Other.
- Hint "Contacts are your address book. They do not change Carta." (measured on all dialogs): on Contacts it raises a question the user did not have.
- Error stays after the email is edited (catalog issue 27, assumed, not re-tested).

## Ranked Changes

1. P1, S: Show feedback after Save on Contacts: the "Added <name>" toast with Undo and a row highlight, reusing the Cap table pattern. Evidence: 07 and 11 show a silent close. Files: `apps/web/src/pages/Contacts.tsx` (copy the toast and highlight wiring from `apps/web/src/pages/CapTable.tsx`).
2. P2, S: Keep what the user typed when they click "Open <name>" on a duplicate; at minimum keep Kind and Notes. Evidence: 09 to 10, Kind "Vendor" reverted to "Other". Files: `apps/web/src/components/ContactDialog.tsx`.
3. P2, S: Move the duplicate error directly under the Email field, so the dialog does not grow at the bottom and the message sits beside its cause. Evidence: 08 vs 09. Files: `apps/web/src/components/ContactDialog.tsx`.
4. P3, S: Show the "do not change Carta" hint only when the dialog opens from Cap table. Evidence: hint visible in 02 on Contacts. Files: `apps/web/src/components/ContactDialog.tsx`, `apps/web/src/pages/Contacts.tsx`.
5. P3, S: Default Kind to Other stays; no change proposed, because no better default exists on a page with no kind filter. If a Kind filter is active, preselect that kind (suspected benefit, not walked). Files: `apps/web/src/pages/Contacts.tsx`.
