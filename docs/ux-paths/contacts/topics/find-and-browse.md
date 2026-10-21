## Topic: Finding and browsing contacts

Source: `apps/web/src/pages/Contacts.tsx`, `components/ContactDialog.tsx`, `components/ListControls.tsx`, `pages/CapTable.tsx`, `pages/Shell.tsx`, `App.tsx`, demo data in `packages/testkit/src/cli/demo/data.ts` (`DEMO_CONTACTS`, seeded by `seed.ts`).

### What exists (read before walking)

- **Route and entry points.** The page is `/app/contacts` (`App.tsx:219`, rendered by `ShellPage`). Routes in: the sidebar row "Contacts" (test id `sidebar-contacts`, `Shell.tsx:4042`), the sidebar search box (typing "Contacts" lists it as an app page; `appPages`, `Shell.tsx:1961`), or typing the URL. There is no keyboard command palette in `Shell.tsx`; the sidebar search box is the only "palette". The row sits in the Pages group right after "Cap table".
- **Hiding.** The "Page options" button (three dots) in the Pages group lists Inbox, Finance, Legal, Cap table, Contacts, Data room, Artifacts as checkboxes. Unchecking "Contacts" saves `hiddenPages` (optimistic, rolled back on failure; `Shell.tsx:1913-1925`). It only removes the sidebar row. The sidebar search still lists "Contacts" and `/app/contacts` still loads.
- **List.** Heading "Contacts", primary button "Add contact". Table columns by container width: below 28rem only Name and Kind; from 28rem (`@md`) Email appears; from 32rem (`@lg`) Organization appears. A phone with the sidebar closed is about 358px wide, so it shows Name and Kind only. Email and organization are not visible anywhere on a phone row. Rows keep the load order from `contacts.list`; there is no sort control and no sortable header.
- **Search.** One box, label and placeholder "Search", matches name, email and organization (case-insensitive substring). It does not match notes or kind. Escape clears it; an x button "Clear search" appears once there is text. Search text and kind are React state only: they reset when the founder leaves the page and are not in the URL.
- **Kind filter.** A pill "Kind" (menu label "Filter by Kind"). Choices are all eight kinds: Investor, Auditor, Customer, Vendor, Partner, Advisor, Legal, Other, whether or not any contact has that kind. After picking one the pill reads "Kind: Investor" and its right segment clears it (`ListControls.tsx:94-160`).
- **States.** Loading: one grey skeleton block. Error: red text, for example "Could not load contacts", with no "Try again" button (Cap table has one). No contacts at all: "No contacts yet" with no add button in the body (only the header "Add contact"), and the search box and Kind pill are not shown. Contacts exist but none match: "No matches" with no "Clear" button, search and Kind stay on screen.
- **Open a contact.** Only the name is a button; it opens the "Edit contact" dialog (fields Name, Email, Organization, Kind, Notes; "Contacts are your address book. They do not change Carta."; Delete, Cancel, Save).
- **Cap table relation.** `/app/cap-table` shows the same contacts through `rpc.contacts.list`, joined to Carta holders by email (`joinRows`, `CapTable.tsx:161`). Tabs: All, Investors, Auditors, Other (plus Shareholders and Options once a Carta snapshot exists). The Investors, Auditors and Other tabs match the contact's kind exactly, so a contact of kind Customer, Vendor, Partner, Advisor or Legal shows only under All. Cap table has Search, sort, a Security filter and a "Clear filters" button; the tab, search and sort are kept in the URL (`?kind=`, `?q=`).
- **Demo data (5 contacts).** Priya Placeholder (investor, Quill Capital (Mock), priya@quill-capital.example.test), Dana Fakename (investor, Acme Ventures (Mock)), Lee Notarealperson (investor, "Independent angel (Mock)"), Quinn Auditwell (auditor, Auditwell LLP (Mock)), Fictional Law Group (kind Other, "Fictional Law Group (Mock)", counsel@fictional-law.example.test, notes "outside counsel"). Notes on every demo contact start with the MOCK marker. The law firm is saved as Other, not Legal, so the Kind filter "Legal" returns nothing on the demo data.

### Duplicate routes and duplicated facts (for the whole topic)

- **Same contact list, two pages.** Contacts (`/app/contacts`) and Cap table (`/app/cap-table`, All tab) read the same records and both open the same "Edit contact" dialog. Edits made in either appear in the other on the next load.
- **Same fields on both surfaces.** Name, email, kind (Contacts: all eight kinds; Cap table: shows the kind name for every contact but its tabs cover only three) and organization (Cap table has no Organization column; it shows only in the dialog and in the row's second line when a holder matches).
- **Add contact exists in three places:** Contacts header button, Cap table header button (and per-tab "Add investor" / "Add auditor" in empty tabs), and agents (`contacts_add`, no approval card).
- **Two search boxes:** per-page "Search" on Contacts and on Cap table (separate state, neither remembers the other). The sidebar search also exists but finds pages, chats, documents and artifacts, not people.
- **Two ways to reach the page:** sidebar row and sidebar search. Hidden from the sidebar does not hide it from search.
- **Two kinds of "Other".** The Kind value "Other" and the Cap table tab "Other" are the same filter. "Legal", "Advisor" and the other new kinds have no Cap table tab.

---

## STORY-001: Open Contacts from the sidebar
**Type**: short
**Topic**: Finding and browsing
**Persona**: Maya Chen, founder of Northwind Robotics, signed in, onboarding done, has not opened Contacts before.
**Goal**: Reach the list of people and companies the business works with.
**Preconditions**: Demo data seeded (5 contacts). Desktop width, sidebar open. "Contacts" not hidden.
**Ideal path**: 1 — one click on the sidebar row "Contacts" opens `/app/contacts`.
**Alternate paths**: Type "Contacts" in the sidebar search box and select the page row (2 steps). Type `/app/contacts` in the address bar (1 step, no discovery). Open Cap table, All tab, which shows the same people (1 step, mixed with holdings).
### Steps
1. Look at the left sidebar Pages group → rows Inbox, Finance, Legal, Cap table, Contacts, Data room, Artifacts. Thinking: "Where do I keep investor and lawyer emails? Contacts sounds right, book icon."
2. Click "Contacts" → page opens with heading "Contacts", the "Add contact" button, a Search box, a "Kind" pill and a table of 5 rows. The sidebar row shows as current. Thinking: "Good, it is a plain list."
3. Read the table → Name, Email, Organization, Kind columns; Priya Placeholder, Dana Fakename, Lee Notarealperson, Quinn Auditwell, Fictional Law Group. Thinking: "Are these the people my agents found, or did someone type them in?"
### Variations
- Click the sidebar row while already on Contacts: stays on the page, nothing reloads visibly.
- On a phone the sidebar is a drawer; tapping the row closes the drawer (`setMobileSidebarOpen(false)`) and shows the page.
### Edge Cases
- The page does not say where each contact came from (typed or saved by an agent). The founder cannot tell by looking at the list.
- The sidebar row has no count or badge, unlike Cap table which can show unseen changes. New contacts added by agents give no sign.

---

## STORY-002: Find Contacts after hiding it, and bring it back
**Type**: short
**Topic**: Finding and browsing
**Persona**: Maya Chen, tidying a crowded sidebar.
**Goal**: Hide the Contacts row, then reach the page anyway, then restore the row.
**Preconditions**: Demo data. Pages group visible with all seven rows.
**Ideal path**: 3 — "Page options", uncheck Contacts, done; restore is the same menu.
**Alternate paths**: Hidden state does not block `/app/contacts` or the sidebar search result "Contacts". Cap table All tab shows the same people.
### Steps
1. Open the "Page options" (three dots) button on the Pages heading → menu of checkboxes: Inbox, Finance, Legal, Cap table, Contacts, Data room, Artifacts, all checked. Thinking: "I never use Contacts, remove it."
2. Uncheck "Contacts" → the row disappears at once from the sidebar (optimistic save of `hiddenPages`). Thinking: "Gone. Did that delete anything?" Nothing is deleted.
3. Next week, type "Contacts" in the sidebar search → results list an app page "Contacts" even though it is hidden. Select it → `/app/contacts` opens with all 5 contacts. Thinking: "It was still here."
4. Open "Page options" and check "Contacts" → the row returns after Cap table. Thinking: "Fine, I will leave it."
### Variations
- Phone width: Page options is in the drawer; same behaviour.
- Reload after hiding: the row stays hidden (saved with `preferences.update`).
### Edge Cases
- If saving the preference fails, the checkbox state rolls back with no message; the row reappears and the founder may not know why.
- Hiding Cap table does not hide the contacts that Cap table shows. Both pages are independent toggles.
- The page header does not mention that the page is hidden, so a founder who landed there by search sees no hint how to bring the row back.

---

## STORY-003: Search by organization and by email
**Type**: short
**Topic**: Finding and browsing
**Persona**: Maya Chen preparing a note to her seed investors.
**Goal**: Find the contacts at Quill Capital, then the one with a given email.
**Preconditions**: Demo data. On `/app/contacts`, desktop width (Email and Organization columns visible).
**Ideal path**: 2 — click Search, type the firm name.
**Alternate paths**: Type the same text in the Cap table Search (the match also covers name, email and organization there); sidebar search does not find contacts.
### Steps
1. Click the "Search" box and type `quill` → table narrows to Priya Placeholder, organization "Quill Capital (Mock)". Thinking: "Matches the company name, good."
2. Clear it with the x ("Clear search") and type `example.test` → all five rows match because every demo email ends in `.example.test`. Thinking: "Too broad, that told me nothing."
3. Replace with `dana@` → only Dana Fakename. Thinking: "Email works too."
4. Press Escape in the box → text clears and all rows return.
### Variations
- Uppercase `QUILL` works (case-insensitive).
- Search for a word that appears only in notes, for example "SAFE": no rows. Notes are not searched (step shows "No matches").
### Edge Cases
- Leading and trailing spaces are trimmed; a search of only spaces shows everyone.
- Leaving the page and returning clears the search text. The founder repeats it.
- Search is substring, not word-based: `ven` matches "Acme Ventures (Mock)".

---

## STORY-004: Filter by Kind, then no matches, then recover
**Type**: short
**Topic**: Finding and browsing
**Persona**: Maya Chen looking for her auditor.
**Goal**: Show only auditors; discover that "Legal" is empty and find the law firm another way.
**Preconditions**: Demo data. Desktop width.
**Ideal path**: 2 — open the Kind pill, pick Auditor.
**Alternate paths**: Cap table "Auditors" tab shows the same person (1 click, but a different page). Search `audit` finds Quinn Auditwell through name and organization (1 type).
### Steps
1. Click the "Kind" pill (aria-label "Filter by Kind") → radio menu with Investor, Auditor, Customer, Vendor, Partner, Advisor, Legal, Other. Thinking: "Why are there Customer and Vendor here? I only have investors."
2. Choose "Auditor" → pill becomes "Kind: Auditor"; table shows only Quinn Auditwell. Thinking: "Got it."
3. Pick "Legal" from the same pill → body shows "No matches" while the search box and pill stay. Thinking: "My lawyers are not listed? Or I filed them wrong."
4. Clear the filter with the right-hand segment of the pill → all five rows return. Thinking: "Fictional Law Group must be under Other."
5. Pick "Other" → Fictional Law Group appears. Thinking: "Fine, but I would never have guessed 'Other' for my own counsel."
### Variations
- Combine Kind "Investor" with search `dana` → one row (Dana Fakename). Combine Kind "Auditor" with search `dana` → "No matches".
### Edge Cases
- "No matches" has no "Clear" button. The founder must use the pill or the x in Search by hand.
- The menu offers kinds no contact uses, so empty results are easy to reach.
- The filter resets when the founder leaves the page.

---

## STORY-005: Same table at four widths
**Type**: medium
**Topic**: Finding and browsing
**Persona**: Maya Chen using a laptop, a split-screen window, and a phone.
**Goal**: Read the same five contacts and understand what is lost when the window is narrow.
**Preconditions**: Demo data. Browser window resizable; the Contacts page with the sidebar open and then closed.
**Ideal path**: 1 — resize and look; no interaction needed to see the columns respond.
**Alternate paths**: Open the contact (name button) to see Email and Organization in the dialog at any width. Cap table row also shows the email under the name on narrow widths (`cap-table-row-email`).
### Steps
1. Open Contacts at about 1400px wide with the sidebar open → Name, Email, Organization, Kind all visible. Thinking: "Everything I need."
2. Narrow the window so the page area drops below 32rem (`@lg`) → Organization column disappears, Email stays. Thinking: "Where did the company go?"
3. Narrow further below 28rem (`@md`) → only Name and Kind remain. Names truncate with a hover title. Thinking: "I cannot tell which Priya this is."
4. Open Cap table's All tab at the same width → the row shows the email beneath the name and the kind plus holding on a second line, so more is visible than on Contacts. Thinking: "Cap table shows more of the same people than Contacts does."
5. Back on Contacts, tap "Priya Placeholder" → "Edit contact" dialog shows Name, Email, Organization, Kind, Notes. Thinking: "I had to open it to read her email."
### Variations
- Phone width (about 390px, drawer closed): Contacts shows Name and Kind only; the Search box takes a full row, Kind pill wraps beneath it; "Add contact" stays in the header. A tap on the name opens the dialog.
- Phone, landscape (about 800px, page area above 28rem): Email returns.
### Edge Cases
- Very long names or emails truncate with an ellipsis; the name's full text is in the `title` tooltip, which does not exist on touch.
- Hovering a row does nothing; only the name text is tappable, so a tap on the Kind cell does not open the contact. On a phone the target is the name text only.
- Duplicated fact: Contacts at narrow width hides email and organization that the Cap table row of the same person shows (email only; organization never).

---

## STORY-006: Empty address book, loading and load failure
**Type**: medium
**Topic**: Finding and browsing
**Persona**: A new founder (Jo Example, example.test email) on a fresh space.
**Goal**: See an honest empty page, then recover from a failed load.
**Preconditions**: A space with zero contacts. API can be made to fail once (for example the server stopped).
**Ideal path**: 2 — open Contacts, then press "Add contact".
**Alternate paths**: Cap table shows "Add your investors, auditors and counsel here. Contacts are your address book." with per-tab add buttons; an agent can add contacts from chat (`contacts_add`).
### Steps
1. Open Contacts on a slow connection → a single grey block (skeleton) under the heading. Thinking: "Loading, wait."
2. Load finishes with no contacts → body reads "No contacts yet". Search and Kind controls are absent. Thinking: "Now what? There is no button here."
3. Look up to the header → "Add contact" button is the only way forward. Thinking: "Oh, there."
4. Stop the server and reload the page → red text from the error (fallback "Could not load contacts"). No retry button; "Add contact" still shows. Thinking: "Is my data gone?"
5. Restart the server and reload the browser → the list loads normally. (Navigating away and back also reloads.)
### Variations
- Open the same empty space's Cap table: it shows the tab text and "Add investor"/"Add auditor" buttons in the body, so Cap table guides the first contact better than Contacts does.
- Phone width: skeleton, text and header button stack in the same order.
### Edge Cases
- While in the error state, pressing "Add contact" opens a dialog whose duplicate-email check has no list (it receives `[]`); a repeat email would not warn until after save.
- Duplicated fact: the empty-state copy differs between pages. Contacts says "No contacts yet"; Cap table says "Add your investors, auditors and counsel here...".

---

## STORY-007: Find an investor on Cap table, then look in Contacts
**Type**: medium
**Topic**: Finding and browsing
**Persona**: Maya Chen, preparing for an audit.
**Goal**: Confirm the auditor's details and see whether Contacts and Cap table agree.
**Preconditions**: Demo data. Carta not connected (Cap table shows the "See who owns your company" card and the contacts table). Desktop.
**Ideal path**: 2 — Cap table, Auditors tab.
**Alternate paths**: Contacts with Kind "Auditor" (3 steps); Contacts search `quinn` (2 steps); Cap table search (2 steps).
### Steps
1. Open "Cap table" from the sidebar → heading "Cap table", card "See who owns your company" with "Connect Carta", tabs All and Investors, Auditors, Other. Thinking: "I want my auditor, not the equity card."
2. Click the "Auditors" tab → URL gains `?kind=auditor`; one row, Quinn Auditwell. Thinking: "That works."
3. Click the name → the same "Edit contact" dialog as on Contacts. Close with Cancel.
4. Open Contacts and choose Kind "Auditor" → the same one row. Thinking: "Same list, different page. Why two?"
5. Go back to Cap table, "Investors" tab → three rows (Priya, Dana, Lee). Contacts with Kind "Investor" shows the same three.
### Variations
- Carta connected with a snapshot: the Cap table gains Shares and Ownership columns, tabs Shareholders and Options, and rows for holders with no contact (plain text, not clickable). A contact whose email matches a holder is merged into that holder's row. Contacts shows only the contact, never the holding.
- Phone width: the Cap table tabs wrap to a second row; the Contacts Kind pill replaces tabs.
### Edge Cases
- The Cap table tabs and Contacts Kind filter produce the same result for investor, auditor and Other. For Customer, Vendor, Partner, Advisor and Legal contacts the tabs show nothing (only All lists them), while Contacts' Kind filter lists them. A founder who filed their lawyer as Legal will not find them on a Cap table tab.
- A Cap table link with `?kind=shareholder` and no Carta shows All.
- Duplicated facts: name, email and kind are on both pages and open the same dialog. Cap table also has sort and a "Clear filters" button that Contacts lacks.

---

## STORY-008: Find one contact on a phone
**Type**: medium
**Topic**: Finding and browsing
**Persona**: Maya Chen on her phone browser, in a taxi, looking for the angel investor's email.
**Goal**: Find Lee Notarealperson and read the email.
**Preconditions**: Demo data. Phone width about 390px, sidebar drawer closed.
**Ideal path**: 3 — open the drawer, tap Contacts, tap the name.
**Alternate paths**: Sidebar search "Contacts" in the drawer (extra typing). Cap table All tab: the row shows the email under the name without opening anything (3 steps, less).
### Steps
1. Open the sidebar drawer and tap "Contacts" → drawer closes; page shows heading, "Add contact", a full-width Search, the Kind pill, a table with Name and Kind columns. Thinking: "Where is the email column?"
2. Type `lee` in Search → one row, Lee Notarealperson, kind Investor. Thinking: "Found him, but no email."
3. Tap the name → "Edit contact" dialog, email lee@angel.example.test visible. Thinking: "OK, extra tap."
4. Tap Cancel → back to the one-row list; the search text is still there. Thinking: "Good."
### Variations
- Rotate to landscape (page area above 28rem): Email column appears and step 3 is unnecessary.
- Try the same on Cap table All: the email shows under the name without opening anything.
### Edge Cases
- The name is the only tap target; tapping Kind or empty row space does nothing.
- Duplicated fact: email appears in the list on Cap table at phone width but not on Contacts.

---

## STORY-009: A week of agent mail reading, then "who's our lawyer?"
**Type**: long
**Topic**: Finding and browsing
**Persona**: Maya Chen, founder of Northwind Robotics. Back from a week away. During that week connected agents (Gmail, the Carta agent) read her mail and documents and saved some people with `contacts_add`.
**Goal**: Find out who the company's lawyer is and get their email, expecting agents to have collected it.
**Preconditions**: Demo data plus whatever agents added during the week (assume two extra contacts, Ada Example, kind Investor, ada@example.test, and a new lawyer entry saved as Other). Desktop, sidebar open, Contacts not hidden. No current search or filter (state does not persist).
**Ideal path**: 3 — open Contacts, search the word she remembers ("law"), read the row. No step uses Kind because the kind a contact has depends on how it was saved.
**Alternate paths**: Ask an agent in chat "Who is our lawyer?" (agents can call `contacts_list`). Cap table: All tab, Search `law`. Sidebar search finds documents and chats mentioning counsel, not the contact.
### Steps
1. Open the app after a week → chat and sidebar look as she left them. She notices no badge on Contacts. Thinking: "Did the agents find anything? I do not know where to look."
2. Click "Contacts" in the sidebar → list shows seven contacts: the five seeded ones, Ada Example and the new entry. There is no "added by" or "date added" column, no sort and no marker for new ones. Thinking: "Which of these are new? Which is my lawyer?"
3. Click the Kind pill and pick "Legal" → "No matches". Thinking: "Odd. I thought an agent would file a lawyer under Legal." (The demo law firm and the new entry were saved as Other.)
4. Clear the pill and type `lawyer` in Search → "No matches". The word is only in notes, which are not searched. Thinking: "The page cannot find the word that I remember."
5. Replace with `law` → Fictional Law Group appears (name, organization and email contain "law"). Thinking: "That is the firm."
6. Read the row: Email counsel@fictional-law.example.test, organization "Fictional Law Group (Mock)", Kind "Other". Thinking: "Is this the lawyer or just a firm inbox? I do not know who the person is."
7. Click the name → "Edit contact" dialog with notes "outside counsel". Thinking: "OK, confirmed, outside counsel."
8. Cancel. She wants to know whether anyone else is a lawyer. Open Cap table, All tab, Search `law` → the same single row (the page shows the same contact, no extra information). Thinking: "Two places, same answer."
9. She asks the agent in chat "Who is our lawyer?" → the agent can answer from the same contacts (`contacts_list`), so the answer matches the list. Thinking: "I should have asked first."
### Variations
- The agent saved the firm with kind Legal: step 3 returns the row immediately and step 4 is unnecessary.
- Two firms: the founder sees two rows for `law` and has to open each dialog to tell them apart. Notes are visible only in the dialog.
- Phone width: step 6 shows only the name and "Other"; email and organization require opening the dialog.
### Edge Cases
- Contacts the agents added are indistinguishable from typed ones; there is no source, date, or "recent" view.
- Kind is unreliable for retrieval: it depends on who saved the contact, so a filter is the wrong first move; search by name or organization works but not by role.
- Search misses notes, so "lawyer", "counsel" in notes, or "409A" are not found.
- Duplicated facts: lawyer details appear on Contacts, on Cap table (All tab only), and through the agent's answer; the sidebar search shows none of them.

---

## STORY-010: Two kinds of "all" — contacts versus holders
**Type**: medium
**Topic**: Finding and browsing
**Persona**: Maya Chen, with Carta connected and a saved snapshot, hunting for "everyone who owns a piece".
**Goal**: Tell which people exist only as contacts and which are holders.
**Preconditions**: Demo data with the demo cap table snapshot (Carta connected). Desktop.
**Ideal path**: 2 — open Cap table, read the All tab.
**Alternate paths**: Contacts page lists contacts only (3 steps to compare). Cap table "Investors" tab mixes Carta holders with contacts.
### Steps
1. Open Cap table → summary figures, ownership bar and a table with Name, Email, Kind, Shares, Ownership. Thinking: "Is this my address book or my ownership?"
2. Look at rows without a link → holders from Carta with no matching contact are plain text. Rows with a link are contacts. Thinking: "Only some names are clickable, why?"
3. Open Contacts → five rows only; no Shares or Ownership. Thinking: "Where did the holders go? These are people I saved."
4. Return to Cap table and click the "Investors" tab → rows from both sources, for example a contact that matches a holder by email and a holder with a SAFE. Thinking: "Contacts versus holders: the tab hides the difference."
5. On Cap table, click a holder with no contact and choose to add the email (the "Add email" action) → dialog "Add email for ..."; after Save, the holder row now links and the person appears on Contacts. Thinking: "Now it is an address book entry too."
### Variations
- Carta disconnected: Cap table collapses to the contacts-only table with the "See who owns your company" card. It then looks like Contacts with tabs.
- Phone width: Cap table rows show kind and holding on a second line; Contacts does not.
### Edge Cases
- A contact whose email differs in case from the holder's still joins (matching is case-insensitive).
- A holder with no email can never be merged; the founder sees both a contact and a holder for the same human.
- Duplicated facts: name, email and kind appear in both pages; Contacts has no Shares or Ownership, and Cap table has no Organization column.
