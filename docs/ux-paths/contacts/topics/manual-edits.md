# Contacts: Manual edits (STORY-001 to STORY-008)

Topic: adding, editing and deleting contacts by hand. All people and companies below are invented (example.test addresses).

## What the code does (read before walking)

- Two screens open the same `ContactDialog`: the Contacts page (`/app/contacts`, button "Add contact") and the Cap table page (`/app/cap-table`, button "Add contact", or "Add investor" / "Add auditor" on those tabs).
- Fields in order: Name (required), Email (`type="email"`), Organization, Kind (native select: Investor, Auditor, Customer, Vendor, Partner, Advisor, Legal, Other), Notes. Under Notes: "Contacts are your address book. They do not change Carta."
- Footer: Delete (red, left, only when editing), Cancel, Save. Save is disabled while busy or while Name is blank after trimming.
- Title: "Add contact" (new), "Edit contact" (existing), "Add investor"/"Add auditor" (Cap table tab), "Save <name> as a contact" and "Add email for <name>" (Cap table holder rows).
- Default kind: the Contacts page opens a new contact as Other; Cap table on All or Shareholder/Options tabs opens it as Investor; on the Investors, Auditors or Other tab it uses that tab's kind.
- Server limits (`ContactSaveInputSchema`): name 1-200 characters, email trimmed, lower-cased and checked as an email, organization 200, notes 5000. The dialog has no length limits or counters, so a too-long value is rejected by the server and shows in the red error line.
- Empty Email, Organization or Notes are sent as null, which clears the stored value.
- Duplicate email: the database unique violation becomes `ContactEmailTakenError` ("Another contact already has this email."), returned to the browser as a CONFLICT. The dialog stays open and shows that text in a red alert. If the dialog's contact list contains the other holder of the email, an "Open <name>" button appears next to the error.
- Delete has no confirmation step. On the Contacts page the row just disappears. On Cap table a toast says "Deleted <name>" with "Undo" and "Dismiss"; a toast with Undo stays until used or dismissed (the 8 second timer only applies to toasts without Undo). Undo saves a new contact with the same fields; the id and created date are new.
- After a successful save on Cap table: toast "Saved <name>", the row scrolls into view and is highlighted for 8 seconds. The Contacts page shows no toast and no highlight.
- Escape, a click outside, and Cancel all close the dialog with no confirmation, discarding typed changes. Escape is not blocked while a save is running.
- Failed save or delete: the dialog stays open, buttons re-enable, the typed values stay, and the error text shows in a red alert.
- The Contacts page lists Name, Email, Organization, Kind (Email and Organization columns hide at narrow widths). It has Search and a Kind filter. Notes are never shown in the list; they are visible only inside the dialog.
- Demo contacts (`DEMO_CONTACTS`) carry notes such as "Mock demo data: lead investor, holds the $250,000 SAFE." Agent-saved contacts use the same Notes field for context.

## Seed used below

Contacts: "Ada Example" (ada@quill.example.test, Quill Capital, Investor, notes "Found in the Q3 investor update thread."), "Ben Sample" (ben@auditwell.example.test, Auditwell LLP, Auditor), "Cleo Placeholder" (no email, Other). Persona for all stories: Maya, a founder who reads the list on her own and edits by hand.

---

## STORY-001: Add a contact from the Contacts page
**Type**: short
**Topic**: Manual edits
**Persona**: Maya, founder, just met a new advisor and wants her in the address book.
**Goal**: Save "Dev Advisor" with an email and kind Advisor.
**Preconditions**: Signed in; at least one contact exists, so the list and search are showing.
**Ideal path**: 5 — open Contacts, click Add contact, fill Name and Email, pick Kind, Save.
**Alternate paths**: Cap table page "Add contact" (same dialog, default kind Investor, so Maya must change Kind); ask an agent to add the contact (outside this topic).
### Steps
1. Open Contacts from the sidebar → page "Contacts" with table and an "Add contact" button (plus icon). Maya thinks: "Is this the right place, or is this the cap table thing?"
2. Click "Add contact" → dialog "Add contact" with Name focused-ready, Kind preselected "Other". She may not notice Kind starts as Other, not Advisor.
3. Type "Dev Advisor" in Name and "dev@advisors.example.test" in Email → Save becomes enabled once Name has text.
4. Open Kind and choose "Advisor" → select shows Advisor. She may skip this and leave Other.
5. Click Save → dialog closes, table reloads, "Dev Advisor" appears in name order. No toast and no highlight, so she scans the alphabetical list to confirm.
### Variations
- Leave Organization and Notes blank: both stored as empty (null).
- Add only a Name: allowed; the Email column shows blank.
- Type the email in capitals: stored lower case.
### Edge Cases
- She expects the new row at the top; it sorts by name, so it may be off-screen on a long list with no cue that the save worked.
- Double click on Save: the button disables during the request, so only one contact is created.

## STORY-002: Name is required and the email must look like an email
**Type**: short
**Topic**: Manual edits
**Persona**: Maya, in a hurry, pasting details from an email signature.
**Goal**: Understand why Save will not go through and fix the entry.
**Preconditions**: Contacts page open; dialog "Add contact" open and empty.
**Ideal path**: 3 — fill Name, correct Email, Save; the form itself blocks the bad input.
**Alternate paths**: none found (same dialog everywhere).
### Steps
1. With Name empty, look at Save → Save is disabled. Maya thinks: "Why is it grey? Nothing says what is missing."
2. Type spaces only in Name → Save stays disabled (trimmed value is empty).
3. Type "Eve Example", and "eve@" in Email, then click Save → the browser's own email validation bubble appears on Email and no request is sent. The wording depends on the browser, not on Rakazo.
4. Change Email to "eve@example.test" and press Enter → form submits, dialog closes, "Eve Example" is listed.
### Variations
- Pasted email with surrounding spaces ("  eve@example.test ") → trimmed before saving.
- Name of 201 characters → the browser allows it, the server rejects it, and the red alert shows the error text. The dialog has no hint about the 200 limit.
### Edge Cases
- Pressing Enter inside Notes adds a new line (it is a textarea) and does not submit, so Maya must click Save or press Enter in another field.
- Email with Unicode letters may pass the browser check but fail the server check; the alert text comes from the server and may read as technical.

## STORY-003: Edit a contact's organization and kind
**Type**: short
**Topic**: Manual edits
**Persona**: Maya, correcting a contact that was filed under the wrong kind.
**Goal**: Move "Ben Sample" from Auditor to Legal and fix the organization name.
**Preconditions**: "Ben Sample" exists as an Auditor.
**Ideal path**: 4 — click the name, change Organization, change Kind, Save.
**Alternate paths**: Cap table page: click the name in the table (same dialog); on the Auditors tab the row disappears from that tab after the kind changes.
### Steps
1. On Contacts, click "Ben Sample" (name is a text button that underlines on hover) → dialog "Edit contact" with all stored values, Delete visible at left. Maya thinks: "Am I editing or adding a new person?" The title answers that.
2. Change Organization to "Auditwell Legal LLP" → field updates.
3. Change Kind to "Legal" → select shows Legal.
4. Click Save → dialog closes, row shows the new Organization and Kind "Legal".
### Variations
- Only change Kind: all other fields are re-sent unchanged.
- Clear Organization → saved as empty, so the cell is blank.
### Edge Cases
- Two tabs: another tab deleted this contact first → Save fails with a "Contact not found" style error in the red alert; the dialog stays open with Maya's edits.
- A Kind filter is active on the Contacts page: after the kind change the row drops out of the filtered list, and she may think the save lost it.

## STORY-004: Duplicate email on add, then open the existing contact
**Type**: medium
**Topic**: Manual edits
**Persona**: Maya, adding someone she forgot she already saved.
**Goal**: Find out why the save failed and reach the existing record.
**Preconditions**: "Ada Example" (ada@quill.example.test) exists; list loaded.
**Ideal path**: 6 — try to add, read the error, click "Open Ada Example", edit there, Save.
**Alternate paths**: Cap table "Add contact" gives the same error and "Open <name>" button; Cap table "Save as contact" on a holder whose email already belongs to a contact (the row is normally joined, so this is rare).
### Steps
1. Click "Add contact" on Contacts, type Name "A. Example" and Email "ADA@quill.example.test" → fields filled.
2. Click Save → dialog stays open; red alert "Another contact already has this email." and an outline button "Open Ada Example". Maya thinks: "It has not saved anything. Who has it?"
3. Click "Open Ada Example" → the dialog switches to "Edit contact" for Ada (different key, new form). Her typed "A. Example" is gone; she sees Ada's saved values and notes.
4. She decides to add the organization or notes there: edits Notes → text updates.
5. Click Save → dialog closes, list reloads with the updated Ada.
6. Maya checks the list → there is still one Ada, no duplicate row.
### Variations
- Email differs only by case → still treated as duplicate (matching is lower case).
- Editing an existing contact and typing another contact's email gives the same alert and "Open <name>" button.
### Edge Cases
- Open <name> shows only if the other contact is in the list the page already loaded; if the list was loaded before another tab added the contact, the error appears without the button.
- She clicks "Open" and loses the new name she typed with no warning.
- Error stays visible after she changes the email; it clears only on the next Save attempt, which can look stale.

## STORY-005: Edit a contact an agent saved and read where it was found
**Type**: medium
**Topic**: Manual edits
**Persona**: Maya, reviewing contacts that an agent added from her inbox.
**Goal**: Check the agent's note, correct the name and email, and keep the note.
**Preconditions**: A contact "Ada Examp" (ada@quill.example.test, Investor) was saved by an agent with notes "Found in the Q3 investor update thread."
**Ideal path**: 5 — open the contact, read Notes, fix Name, Save.
**Alternate paths**: Cap table page row (same dialog); no other place shows the note.
### Steps
1. Scan the list on Contacts → she sees name, email, organization and kind. Nothing shows who added it or the note. Maya thinks: "Where did this come from?"
2. Click the name → "Edit contact" with Notes containing "Found in the Q3 investor update thread." She learns the source only now.
3. Fix Name to "Ada Example" → field updates.
4. Add a line to Notes ("Confirmed by phone") and keep the original text → Notes shows both. Because she edits, not replaces, the source is kept.
5. Click Save → dialog closes; list shows the corrected name.
### Variations
- She wipes the Notes box to tidy up → on Save, notes become empty and the source is lost, with no confirmation.
- She changes the Kind from Investor to Customer to match what the thread showed.
### Edge Cases
- The Notes hint, "Contacts are your address book. They do not change Carta.", does not say that the note was written by an agent, so a user might think she typed it earlier.
- If the agent saves the same contact again while the dialog is open, Maya's Save overwrites the agent's newer values for the fields she sends (all fields are sent).
- Notes text over 5000 characters is rejected by the server.

## STORY-006: Delete a contact on the Cap table, then Undo
**Type**: medium
**Topic**: Manual edits
**Persona**: Maya, cleaning up a stale auditor before an audit.
**Goal**: Delete "Ben Sample", then recover him after realising he is still needed.
**Preconditions**: Cap table page, Auditors tab, "Ben Sample" listed.
**Ideal path**: 5 — open contact, Delete, notice toast, Undo.
**Alternate paths**: Contacts page Delete (same button, no toast and no Undo, so recovery is manual).
### Steps
1. Open Cap table → tab "Auditors" shows Ben. Click his name → "Edit contact".
2. Click "Delete" (red, left of Cancel) → no confirm step. The dialog closes at once. Maya thinks: "That was fast, was that final?"
3. Look at the bottom of the page → toast "Deleted Ben Sample" with "Undo" and "Dismiss"; the row is gone from the tab.
4. Click "Undo" → toast "Restored Ben Sample"; the row returns with the same name, email, organization, kind and notes.
5. Maya clicks his name to confirm → fields match; this is a new record with a new id.
### Variations
- She clicks "Dismiss" instead → the toast goes; Ben stays deleted.
- She ignores the toast and goes on working → the Undo toast stays until used or dismissed.
### Edge Cases
- Failed Undo (for example his email was reused in the meantime): toast becomes "Could not restore Ben Sample: <reason>. If you dismiss this, Ben Sample stays deleted." with "Try again".
- On the Contacts page, the same Delete shows no toast. If Maya deletes there by mistake, she must re-add by hand.
- If the delete itself fails, the dialog stays open and the red alert shows the error; Delete re-enables.
- Any link or agent text that refers to the old id no longer resolves after Undo.

## STORY-007: Cancel, Escape and keyboard-only editing
**Type**: medium
**Topic**: Manual edits
**Persona**: Maya, keyboard user who avoids the mouse.
**Goal**: Open a contact, change one field and save, then open another and leave without saving.
**Preconditions**: Contacts page with several contacts; focus on the page.
**Ideal path**: 8 — Tab to the name button, Enter, edit, Tab through fields, Enter to submit; second contact Escape.
**Alternate paths**: Cap table page uses the same dialog and focus rules.
### Steps
1. Press Tab until a contact name has focus (it is a real button, underline shows on focus) → focus ring/underline visible. Maya thinks: "Is the first Tab stop the Add contact button?"
2. Press Enter → "Edit contact" opens with focus in the dialog; focus stays inside while it is open.
3. Tab to Organization, retype the value, press Enter → the form submits (Enter inside a single-line input submits) and the dialog closes.
4. Tab to another contact, press Enter to open it, change Notes, then press Escape → dialog closes with no "discard changes?" prompt. The edit is lost.
5. Reopen the same contact → the old Notes, as saved.
6. Open it again and Tab to Cancel, press Space → dialog closes, nothing saved.
7. Press Tab from Kind → Notes (Enter there adds a line) → Delete → Cancel → Save, in visual order. Delete comes before Cancel and Save in the Tab order, so an extra Enter on the wrong stop deletes the contact. Tab order puts Delete as the first button she meets after Notes.
8. After a close, focus returns to where the dialog was opened (expected from the dialog component); she confirms she can keep tabbing.
### Variations
- Click outside the dialog: same as Escape.
- Escape while a save is running: dialog closes, but the request still completes; the list then updates.
### Edge Cases
- Using Enter in Notes to submit does not work; this surprises users who expect Enter to save.
- Using the keyboard in the native Kind select: arrow keys change the value; typing "A" jumps between Advisor and Auditor.
- No Delete confirmation means a stray Enter on a focused Delete deletes at once (on Cap table Undo exists; on Contacts it does not).

## STORY-008: One contact, edited from Cap table, with a failed save along the way
**Type**: long
**Topic**: Manual edits
**Persona**: Maya, preparing for an investor call, using Cap table as the main page.
**Goal**: Add "Faye Capital" as an investor, fix a typo in her email, move her to Other when she turns out to be counsel, and see the same change on the Contacts page.
**Preconditions**: Cap table page, All tab; Contacts page reachable in the sidebar; seed contacts exist; Carta may be on or off (not required).
**Ideal path**: 12 — add, edit, edit kind, check Contacts; no detours.
**Alternate paths**: Do every step on the Contacts page instead (default kind there is Other); use the Cap table "Add email" / "Save as contact" link when the person already appears as a Carta holder.
### Steps
1. On the Investors tab click "Add investor" → dialog "Add investor", Kind preselected Investor. Maya thinks: "Good, the button already knew the tab."
2. Type Name "Faye Capital", Email "faye@fayecap.example.test", Organization "Faye Capital Partners", Notes "Intro from Ada." → fields filled.
3. Click Save while offline or the API is down → red alert with the error text; dialog stays open, all four fields keep their values, Save and Cancel re-enabled. She waits and does not retype.
4. Click Save again when back online → dialog closes; toast "Saved Faye Capital"; the page scrolls to her row, highlighted for a few seconds. She thinks: "Good, it is on the Investors tab."
5. Spot the typo "fayecap" in the email; click her name → "Edit contact" with the saved values.
6. Change the Email to "faye@faye-capital.example.test" → field updates.
7. Click Save → toast "Saved Faye Capital"; the table shows the new email.
8. Later she learns Faye is counsel. Click the name again → dialog opens.
9. Change Kind to "Other", Save → toast "Saved Faye Capital"; the Investors tab no longer lists her, so she may think she was deleted. The row lives on the Other tab and in All.
10. Click the "Other" tab → "Faye Capital" appears under Other with kind Other.
11. Open Contacts from the sidebar → the same row with the new email and kind (both pages read the same contacts).
12. Click the name on Contacts, Cancel → nothing changed, back on the list.
### Variations
- Step 3 failure is a duplicate email instead: alert "Another contact already has this email." with "Open <name>" (see STORY-004).
- At step 5 she clicks Cancel after typing: nothing is saved; typed text is lost.
- If Carta is connected and Faye later appears as a holder with this email, the Cap table row merges the holder and contact by email, and the holding appears on the same row.
### Edge Cases
- Changing the email on a contact that matches a Carta holder breaks the join: the holder shows alone with "Save as contact" or "Add email", and the contact appears as a separate row with no holding.
- The Cap table keeps the saved-row highlight for only 8 seconds; if a slow request finishes after she navigates away, the toast is lost with the page.
- The note "Contacts are your address book. They do not change Carta." appears every time, even when she is not near Carta.
- Narrow screens hide Email and Organization columns; she checks the result by opening the dialog.
