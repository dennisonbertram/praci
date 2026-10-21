# Contacts and Cap table ownership

Sources read: `apps/web/src/pages/Contacts.tsx`, `components/ContactDialog.tsx`, `pages/CapTable.tsx`, `components/cap-table/OwnershipDonut.tsx`, `packages/contracts/src/contacts.ts`, `packages/adapters/src/contact-tools.ts`, `packages/db/src/contacts.ts`. Nothing was run. Contacts live at `/app/contacts` (sidebar row "Contacts", icon BookUser). The Cap table page shows the same contacts joined to Carta holders by exact (case-insensitive) email.

## STORY-CAP-009: Maya adds her first investor from the empty Contacts page (replaces the earlier story of this id, updated 2026-10-20)
**Type**: short
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya, first-time founder of Northwind Robotics, no Carta yet
**Goal**: Keep one investor's email somewhere she can find it again.
**Preconditions**: Signed in, no contacts saved.
**Ideal path**: 3 — open Contacts, Add contact, Save.
**Alternate paths**: Cap table page "Add contact" (same dialog, see STORY-CAP-101); ask an agent to save the contact (STORY-CAP-104).
### Steps
1. Click the sidebar row "Contacts" → `/app/contacts` shows header "Contacts", an "Add contact" button, and the text "No contacts yet". There is no search or Kind filter yet (they appear only once one contact exists).
2. Click "Add contact" → dialog titled "Add contact" with Name, Email, Organization, Kind (select), Notes. Kind defaults to "Investor" in the dialog even though the page passes kind "other" in its prefill; the dialog's own default only applies when no kind is passed, so the select may show "Other". UNVERIFIED which one shows on the Contacts page: the page prefill sets `kind: "other"`, which wins over the "investor" fallback.
3. Type Name "Priya Raman", Email "priya@harbor-ventures.example.test", Organization "Harbor Ventures". Maya notices the line under Notes: "Contacts are your address book. They do not change Carta." She wonders if this will email Priya; it will not.
4. If Kind shows "Other", choose "Investor" in the Kind select → value changes.
5. Click "Save" → dialog closes, table appears with columns Name, Email, Organization, Kind and one row "Priya Raman".
### Variations
- Leave Email empty: Save still works (email is optional); only Name is required, and Save stays disabled while Name is blank.
- Press Enter in a field: the form submits.
### Edge Cases
- Invalid email like "priya@" → the browser's email validation or a server error shown in red inside the dialog (`role=alert`); dialog stays open.
- Notes over 5000 characters or Name over 200 → server rejects; error text is generic from `errorText`. UNVERIFIED exact wording.
- Email is stored lowercased, so "Priya@Harbor..." displays lowercase after saving.

## STORY-CAP-011: Duplicate email is refused and Maya jumps to the existing contact (replaces the earlier story of this id, updated 2026-10-20)
**Type**: short
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya, a few weeks in, with 6 contacts saved
**Goal**: Add an investor she believes is new, and learn she already saved them.
**Preconditions**: Contact "Priya Raman" with priya@harbor-ventures.example.test exists.
**Ideal path**: 4 — Add contact, fill, Save, "Open Priya Raman".
**Alternate paths**: Search "priya" before adding (STORY-CAP-012).
### Steps
1. On Contacts click "Add contact" → empty dialog.
2. Type Name "P. Raman" and Email "PRIYA@harbor-ventures.example.test" → nothing happens yet; the dialog quietly compares the lowercased email to other contacts.
3. Click "Save" → the server refuses ("Another contact already has this email." is the database error text; the page shows the user-facing error through `errorText`, UNVERIFIED exact string). A red alert appears in the dialog.
4. Because the typed email matches another contact, a button "Open Priya Raman" appears next to the error. Maya thinks "oh, I did add her" and clicks it → the add dialog is replaced by "Edit contact" for Priya Raman (the dialog is re-keyed to that contact).
5. Click "Cancel" → back to the list, nothing changed.
### Variations
- The same refusal happens when editing contact A and typing contact B's email.
- The "Open" button only appears after the failed save, not while typing.
### Edge Cases
- Two contacts without emails and the same name are allowed by the screen (only email is unique).
- If the other contact is not in the loaded list (list failed to load), no "Open" button appears; only the error.

## STORY-CAP-012: Find a contact by search and Kind filter (replaces the earlier story of this id, updated 2026-10-20)
**Type**: short
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya, preparing an update for investors
**Goal**: See only her investors, then find one by company.
**Preconditions**: About 12 contacts of mixed kinds (Investor, Auditor, Advisor, Legal).
**Ideal path**: 3 — pick Kind "Investor", type in Search, click the name.
**Alternate paths**: Cap table page Investors tab (STORY-CAP-102).
### Steps
1. Open Contacts → table sorted by name (the server returns name order).
2. Open the "Kind" filter and choose "Investor" → only investor rows remain.
3. Type "harbor" in "Search" → matches name, email or organization, case-insensitive. Rows for Harbor Ventures remain.
4. Type "zzz" → text "No matches" replaces the table.
5. Clear the search and click a name (it is a button) → "Edit contact" dialog.
### Variations
- At narrow widths the Email column hides below the `@md` container width and Organization below `@lg`; Maya on a phone sees only Name and Kind and must open the contact to see the email.
- Filter state is local only; reloading the page resets Search and Kind (Contacts does not use URL params, unlike the Cap table).
### Edge Cases
- If every contact is deleted while a filter is active, the page falls back to "No contacts yet" and the filter row disappears.

## STORY-CAP-013: Edit and delete a contact (no confirmation, no undo on Contacts) (replaces the earlier story of this id, updated 2026-10-20)
**Type**: short
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya
**Goal**: Fix a changed email and remove a stale vendor.
**Preconditions**: Contacts "Dan Osei" (advisor) and "Old Parts Co" (vendor).
**Ideal path**: 3 per change — open row, edit, Save.
**Alternate paths**: Delete from the Cap table page offers Undo (STORY-CAP-103).
### Steps
1. Click "Dan Osei" → "Edit contact" dialog prefilled; footer has a red "Delete" at far left, then "Cancel" and "Save".
2. Change Email to dan@osei-advisory.example.test, add a note, click "Save" → dialog closes, list reloads with the new email.
3. Click "Old Parts Co" → "Delete" → the contact disappears immediately. Maya hesitates: there is no "Are you sure?" and, on this page, no "Undo" toast (the Contacts page passes `onDeleted={load}` only).
### Variations
- Clearing Email to empty saves it as null.
- Setting Kind to another value moves the row under that Kind filter.
### Edge Cases
- Delete of a contact already removed elsewhere (another tab or an agent run) → error alert in the dialog; "Contact not found" is the server message, UNVERIFIED how it is rendered.
- Buttons are disabled while saving, so a double click does not send two requests.

## STORY-CAP-101: Cap table without Carta still works as an investor list
**Type**: medium
**Topic**: contacts-and-cap-table-ownership
**Persona**: Solo technical founder who keeps his cap table in a spreadsheet, not Carta
**Goal**: Track investors and advisors on the Cap table page and ignore Carta.
**Preconditions**: Carta not connected; no snapshot.
**Ideal path**: 5 — add investor from the Investors tab, see it in the table.
**Alternate paths**: Contacts page (STORY-CAP-009); the same people show on both pages.
### Steps
1. Open Cap table from the sidebar → header "Cap table", no donut, no summary figures. A card reads "See who owns your company" with "Carta is the service many startups use to record who owns shares, options and SAFEs. Connect it to see them here and to ask the Carta agent about them." and a second line "Not on Carta? You can still keep your investors and advisors below." Primary button "Connect Carta"; the header "Add contact" button is outlined (not primary) because Carta is not connected. He ignores the card.
2. Tabs show only "All", "Investors", "Auditors", "Other" (Shareholders and Options are hidden without a snapshot). Click "Investors" → URL gets `?kind=investor`; empty state "No investors yet" with a button "Add investor".
3. Click "Add investor" → dialog titled "Add investor", Kind preset to Investor.
4. Fill Name "Lena Fischer", Email "lena@fischer-capital.example.test", Organization "Fischer Capital", click "Save" → dialog closes; a notice "Saved Lena Fischer" appears at the bottom; the new row is scrolled to the centre and highlighted for 8 seconds.
5. Click "Auditors" tab → "No auditors yet" and "Add auditor"; header button now reads "Add auditor".
6. Click "All" → empty text only shows when nothing exists; with one contact the table shows Name, Email, Kind (no Shares or Ownership columns without Carta).
### Variations
- Open `/app/contacts` → Lena is listed there too (same records).
- Table columns: the Email column takes the width Shares/Ownership would take.
### Edge Cases
- If the connection check itself fails, the page shows "Could not check whether Carta is connected." with "Try again" instead of the Connect card.
- Reload with `?kind=options` and no snapshot → falls back to "All" and rewrites the URL.

## STORY-CAP-102: Read the ownership donut and drill into a share class
**Type**: medium
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya, Northwind Robotics, Carta connected and read
**Goal**: Answer "who owns what" for a board slide.
**Preconditions**: Snapshot with Common, Series Seed Preferred, SAFE-style holdings, granted options and an unallocated pool.
**Ideal path**: 3 — open Cap table, click a legend row, read the breakdown.
**Alternate paths**: Table Ownership column; sorting by Ownership (STORY-CAP-103); ask the Carta agent (STORY-CAP-106).
### Steps
1. Open Cap table → header shows "Northwind Robotics · Updated 3 hours ago", then four figures: "Fully diluted shares", "Option pool available", "Common share price" (hint "From the latest 409A valuation"), "Amount raised".
2. Look at the donut card → ring with at most six slices (largest classes, the rest merged as "Other") and a legend with percent and share count. The centre says the fully diluted total with "Fully diluted shares". Maya hovers a slice → the centre swaps to that slice's name and shares.
3. Click legend row "Show Common breakdown" (accessible name) → the ring shrinks aside, a second donut grows in with holders of Common, ordered biggest first; a beam links the two. Focus moves to a "Back" arrow.
4. Hover a holder row → that arc stays lit, others dim to 30 percent; the centre shows the holder's shares.
5. Press Escape or click "Back" → returns to the class view; focus returns to the row she opened.
6. Click "Show Options and pool breakdown" → options holders plus "Unallocated pool". Maya thinks "that matches my pool figure above" (same value appears in the summary and here).
### Variations
- Narrow container: donuts stack vertically instead of side by side.
- Reduced-motion setting: no animation or beam.
- A hidden screen-reader table lists Name, Ownership, Shares.
### Edge Cases
- The slice named "Other" (merged small classes) has no breakdown; its legend row is not a button.
- A class with no holder shares in the snapshot has no breakdown either.
- Slices under 2 percent are drawn at least 2 percent wide, but the printed numbers are the true ones.
- Amount-only holdings (SAFEs with dollars, no shares) are not in the donut drill-down because it sums shares; they appear in the table as "SAFE, $250,000".
- Hide amounts button (header) masks dollar figures but not share counts. UNVERIFIED exactly which fields it masks.

## STORY-CAP-103: Filter, search and sort the holders table, then fix an investor's email
**Type**: medium
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya, with Carta connected
**Goal**: Find investors with no email on file and turn Carta holders into contacts.
**Preconditions**: Snapshot holds "Harbor Ventures Fund II" (SAFE, email on file in Carta), "Fischer Capital" (Series Seed Preferred, no Carta email), plus common holders, option grants. One contact "Priya Raman" matches a holder by email.
**Ideal path**: 4 — Investors tab, find row, "Save as contact"/"Add email", Save.
**Alternate paths**: Add the person on Contacts first; the Cap table row will match on email (STORY-CAP-105).
### Steps
1. Open Cap table → tabs "All", "Shareholders", "Investors", "Options", "Auditors", "Other". Default sort is Ownership, descending.
2. Click "Investors" → holders whose security looks like SAFE, preferred, series, note, convertible or warrant, plus investor contacts. URL `?kind=investor`.
3. Open "Security" filter (appears only when two or more securities are among the rows) and pick "SAFE" → URL `security=...`; rows narrow.
4. Type "harbor" in "Search" → matches name, organization or email from the contact or Carta.
5. Open "Sort: Ownership", switch to "Name", then toggle "Ascending" → URL `sort=name&dir=asc`. Sort options present: Name, Kind, Ownership, plus Shares and Amount only when any row has them.
6. In the Email column of the Harbor row (no contact), see the Carta email in text and a link button "Save as contact" → click it.
7. Dialog titled "Save Harbor Ventures Fund II as a contact" opens with name, email, organization and Kind "Investor" filled. Click "Save" → notice "Saved Harbor Ventures Fund II"; the row now shows a clickable name and highlights.
8. On the Fischer Capital row (no Carta email) the button reads "Add email" → dialog titled "Add email for Fischer Capital". Maya types the email and saves.
### Variations
- With no matches: text "No matches" and a "Clear filters" button (clears search and security, keeps the tab).
- Delete a contact from its dialog → notice "Deleted Priya Raman" with "Undo" and "Dismiss"; the notice stays until used (no auto-dismiss). "Undo" re-creates the contact and shows "Restored Priya Raman"; if that fails: "Could not restore ... If you dismiss this, ... stays deleted." with "Try again".
### Edge Cases
- Shareholders and Options tabs filter by the Carta security even when a contact matches the holder.
- Rows for contacts with no holding sort last on Ownership/Shares/Amount.
- Non-investor holders (common, options) show no "Save as contact" link.
- The "Unallocated pool" row appears right after the option grants; it has no name button and no save action.
- Email matching is case-insensitive; a different spelling of the same person's email creates a duplicate row (one holder, one holdingless contact).
- A holder with a long name truncates, full text in the tooltip title.

## STORY-CAP-104: Ask an agent to save an investor, then see the result without refreshing
**Type**: medium
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya, on the Cap table page with the Carta agent panel open
**Goal**: Say "save the Harbor Ventures partner from that email as an investor" and have it appear.
**Preconditions**: Maya started the run herself in a direct message (tools are offered only on owner-started runs); a model is set up.
**Ideal path**: 3 — type the request, wait, see the notice/row.
**Alternate paths**: Manual Add contact (STORY-CAP-009).
### Steps
1. Click "Ask Carta agent" style button in the header (AskBotButton, bot "Carta agent") if the panel is closed → agent panel opens.
2. Type "Save Priya Raman, priya@harbor-ventures.example.test, Harbor Ventures, as an investor" and send → the agent uses `contacts_add`.
3. While the agent is working the page still shows the old list. When the answer finishes, the page reloads contacts and the cap table by itself (it watches the agent's busy state) → Priya's row appears.
4. Maya sends it again by accident → the tool returns `alreadySaved` with note "Already saved; nothing was changed." The agent tells her it already exists; no change is made, so edits she made by hand are not overwritten.
5. Maya asks "Change Priya's organization to Harbor Capital" → agent uses `contacts_save`, which finds the contact by email only; it never creates one and never updates by id.
### Variations
- `contacts_list` lets any agent search by text or kind before answering questions like "who are my auditors?".
- Without an email the add tool matches an existing contact by name plus organization, case-insensitively.
### Edge Cases
- `contacts_save` for an email nobody has returns "No contact with this email. Use contacts_add for new people."
- Scheduled or bot-triggered runs (not started by the owner) do not get the contact tools. UNVERIFIED how the agent words this to the user.
- `cap_table_read` and `cap_table_update` are offered only to the Carta agent; other agents can use contacts but not the cap table.
- Changing the email of a contact through `contacts_save` is not possible this way (email is the key).

## STORY-CAP-105: Carta rows and contacts reconcile by email
**Type**: medium
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya
**Goal**: Understand why Priya appears once in some places and twice in others.
**Preconditions**: Carta holder "Priya Raman" with priya@harbor-ventures.example.test; contact with the same email; another Carta holder "Dan Osei" and a contact "Daniel Osei" saved with a different email.
**Ideal path**: 3 — open Cap table, compare rows.
**Alternate paths**: Contacts page lists contacts only.
### Steps
1. Open Cap table, tab "All" → Priya shows as one row: the contact's name (clickable), the holding in Kind ("Investor" plus the security under it), shares and ownership from Carta.
2. Find "Dan Osei" (holder, name not clickable, Kind from the security, e.g. "Shareholder") and a second row "Daniel Osei" (contact, no shares, "—" in Ownership). Maya thinks they are the same person; the page cannot know because the emails differ.
3. Click "Daniel Osei" → Edit contact. She changes Email to the one Carta holds and clicks "Save".
4. Return to the table → the two rows merge into one row with the contact's name "Daniel Osei" and Dan's holding.
5. Open `/app/contacts` → only one "Daniel Osei" (contacts never list Carta-only holders).
### Variations
- The row name prefers the contact's name over Carta's name.
- Contact organization wins over Carta's organization when both exist.
### Edge Cases
- Contacts with a holding show the Kind of the contact (investor/advisor), but Shareholders/Options tabs use the Carta security instead.
- The same info (name, email, organization) therefore appears on Contacts, the Cap table, the donut legends (holder names from Carta, not contacts) and chat answers, which can disagree on spelling.

## STORY-CAP-106: Connect Carta from the Cap table and get to the first donut (long cross-feature journey)
**Type**: long
**Topic**: contacts-and-cap-table-ownership
**Persona**: Maya, first-time founder of Northwind Robotics, who has 4 investors in Contacts already and is raising a seed extension
**Goal**: Connect Carta, have the Carta agent read the cap table, check the donut against Contacts, file the signed SAFE, and ask the agent a question.
**Preconditions**: Model set up; Carta account exists; 4 investor contacts saved by hand; Data room available.
**Ideal path**: 14 — connect, read, review, fix, file.
**Alternate paths**: Integrations page to connect Carta (the cap table opens the same dialog in place); onboarding "Connect your apps".
### Steps
1. Open Cap table → card "See who owns your company"; the four hand-saved contacts already appear in the table without Shares/Ownership.
2. Click "Connect Carta" → a Carta sign-in dialog (custom connection dialog prefilled with Carta's address) opens on the same page.
3. Complete Carta sign-in in the dialog → dialog closes; the page re-checks servers.
4. The card changes to "Carta is connected" with "The Carta agent has not read your cap table yet." and a button "Read cap table" (if no model: "The Carta agent needs a model before it can read your cap table." with "Add a model", which opens Settings, Models).
5. Click "Read cap table" → header shows "Reading Carta…", the donut area shows skeleton rows while the table is empty; the page polls every 3 seconds during the read and every 30 seconds afterwards, and also on window focus.
6. The run finishes → summary figures, donut and holders table fill in; the header refresh button (aria-label "Refresh from Carta", tooltip "Refresh from Carta. The Carta agent reads your cap table again.") is enabled again. Contacts also reload when the read ends, because the agent may have added contacts.
7. Check the donut: click "Show Series Seed Preferred breakdown" and compare holders to her four contacts. Maya notices two investors appear twice (holder row and a holdingless contact) because their emails differ in Carta.
8. Click each duplicate contact, correct the email, "Save" → rows merge (see STORY-CAP-105).
9. On a SAFE holder with a Carta email but no contact click "Save as contact" → "Save ... as a contact" dialog → "Save".
10. Click the header "Add files" / Import menu on the Cap table (DataRoomImportMenu) → import the signed SAFE PDF from email or Drive; it files into the Data room folder Finance > Cap Table. A notice reports the result.
11. Scroll to the bottom documents area (FolderDocuments for Finance > Cap Table) → the SAFE is listed.
12. Click the header "Ask" button for the Carta agent → panel opens; ask "What percent do the four seed investors hold together?".
13. The agent answers from the stored snapshot (`cap_table_read`), without calling Carta again. When the answer ends the page reloads contacts and the cap table.
14. Maya changes the Search to the investor's name and Sort to "Ownership" to check the number herself.
15. Click "Hide amounts" in the header (HideAmountsButton) before sharing her screen on a call → dollar figures are masked.
16. Click the sidebar row "Contacts" → the same four investors plus the new SAFE holder contact; Carta-only holders (common, options) are absent. Maya hesitates: she expected everyone from Carta here, but Contacts is an address book, not a holder list.
17. Reload the Cap table with `?kind=investor&sort=name&dir=asc` in the URL → the same filtered, sorted view returns, so she can bookmark it.
### Variations
- Carta sign-in ended: card title "Sign in to Carta again to see who owns your company", text "Your Carta sign-in ended. Sign in again to see holders here.", button "Reconnect Carta".
- Refresh fails: red text "Could not refresh from Carta" with "Try again" (or "Add a model" when no model).
- Snapshot load fails: "Could not load the cap table, so holdings are missing." with "Try again".
### Edge Cases
- If the server list fails to load while the Carta dialog is opening, the dialog closes and a notice shows the error.
- Contacts are address book entries only; the dialog says they do not change Carta. Maya must still update Carta itself for ownership changes.
- The cap table agent's write tool `cap_table_update` changes the stored Cap table page snapshot, not Carta. UNVERIFIED whether the UI marks such edits differently from Carta reads.

## STORY-CAP-107: Deployment owner on the desktop app checks cap table sharing across users
**Type**: medium
**Topic**: contacts-and-cap-table-ownership
**Persona**: The deployment owner on the desktop app, with a second user (a co-founder) on the same space
**Goal**: Confirm the co-founder's contacts and cap table are not shown in the owner's views.
**Preconditions**: Two users; each has saved a contact "Ravi Menon" with different data.
**Ideal path**: 4 — open Contacts as each user.
**Alternate paths**: none found.
### Steps
1. As the owner open Contacts → only the owner's contacts; Ravi Menon with the owner's notes.
2. Sign in as the co-founder → Contacts shows their own "Ravi Menon" with different notes.
3. Each tries to save the same email → no conflict: the email uniqueness is per user in the space.
4. Owner opens Cap table → the owner's contacts joined with the snapshot.
### Variations
- Agents see only the contacts of the bot owner who started the run.
### Edge Cases
- Editing a contact id that belongs to someone else is refused as "Contact not found" (isolation error). UNVERIFIED whether the UI could ever construct such a request.
- Export my data (Settings) may include contacts. UNVERIFIED; not read for this topic.
