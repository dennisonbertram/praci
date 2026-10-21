# Contacts: redundancy and information architecture

Method: read the Redundancy Candidates and Known issues sections of `docs/ux-paths/contacts/catalog.md`, then checked each against the running demo app (fictional data). Screenshots are in `docs/ux-flow/contacts/redundancy-screens/`. Issue numbers (#n) refer to the Known issues table in the catalog. Heuristics are from the ux-flow simplification list (13 one way, 14 one name, 15 overlap, 16 depth, 12 once and only once).

Screens used: 01 Contacts list, 02 and 13 dialog from Contacts (edit, add), 04-10 Cap table default and each tab, 11 and 12 dialog and add button from Cap table, 14 sidebar, 15 sidebar search for "Dana".

## Duplicate Paths

| # | Duplicate | Verdict | Canonical surface |
|---|---|---|---|
| 1 | Add a contact from Contacts (screen 13, kind defaults to Other) and from Cap table (screen 12). The Cap table button is relabeled by tab: "Add contact" on All, "Add investor" on Investors, "Add auditor" on Auditors, and the dialog opens with that kind. | Mixed. The per-tab prefill is a useful shortcut. The different default kind (#2) and different post-save feedback (#13, toast and highlight only on Cap table) are drift. | Contacts. Cap table's button stays as a shortcut, but must use the same dialog default and the same save feedback. |
| 2 | Edit or delete the same record: the identical "Edit contact" dialog opens from both pages (screens 02, 11). Delete gives Undo on Cap table only (#1). | Drift. One dialog, two different wrappers. | Contacts. Move the Undo toast into the shared dialog path so both pages behave the same. |
| 3 | Find a person: Contacts Search, Cap table Search (separate state, #14), sidebar Search. The sidebar search for "Dana" returned "No matches in chats, pages, documents or artifacts" and offered "Search mail for Dana" (screen 15), even though Dana is in Contacts. | Drift. Three search boxes, one that cannot find people. | Contacts page search for people. The sidebar search should either index contacts or stay a page and chat finder (see Hierarchy & IA). |
| 4 | Reach the list: sidebar row, sidebar search, URL, Cap table All tab. | Deliberate. Different entry points to one list. No change. | n/a |
| 5 | Change a kind by hand in the dialog or through the agent tool `contacts_save`. | Deliberate. The agent route is an accelerator and asks for approval. | Dialog. |

Count: 5 paths examined: 2 drift (paths 2, 3), 1 mixed (path 1), 2 deliberate (paths 4, 5).

## Duplicate Information

- **Name, email, organization, kind on both pages.** Contacts shows Name, Email, Organization, Kind as four columns (screen 01). Cap table All shows Name with Organization as a second line, Email, Kind with a security as a second line, and Ownership (screen 05). The same five contacts appear on both. This is the same fact shown twice for the same record. Cap table adds real information (Carta holdings and ownership); Contacts adds nothing the Cap table lacks except notes and a full-width Organization column.
- **Notes appear only in the dialog** (screens 02, 11). Neither list shows them or searches them (#3, #9). For a contact an agent saved, the note is the only record of why the person was saved (the live demo agent saved "Omar Example" as a counterparty on a signed NDA, and that reason is visible only after opening the row). This is the one place where information is hidden, not duplicated.
- **Dialog helper line "Contacts are your address book. They do not change Carta."** is on every dialog open (screens 02, 11, 12, 13), including edits where the user already knows. The Cap table empty state repeats the same idea ("Contacts are your address book"). This is explainer copy that repeats the interface (AGENTS.md copy rule). It matters once, when a user first adds a contact from the Cap table, not on every dialog.
- **Empty-state copy differs** between pages (#6 in the story list): "No contacts yet" on Contacts, "Add your investors, auditors and counsel here. Contacts are your address book." on Cap table. Same state, two texts.
- **A Carta holder who is also a contact** is one row when emails match and two rows when they do not (catalog STORY-010, 018). On the Investors tab, Carta holders and contacts are mixed in one list (screen 07: Priya with "SAFE, $250,000", Dana with no security), so the user cannot tell from the row which rows are editable contacts and which are Carta data.
- **Email and Organization disappear on narrow widths** on Contacts but show under the name on Cap table (#16). The two pages answer "which fields matter" differently.

Count: 6 findings.

## Overlapping Features

- **Cap table tabs versus the Contacts Kind filter.** The Cap table tab set (Shareholders, Investors, Options, Auditors, Other) shares three kinds with Contacts' eight (Investor, Auditor, Other). Shareholders and Options are Carta concepts. Customer, Vendor, Partner, Advisor and Legal contacts appear only on the All tab (#7). In the demo, Lena Sample (Partner) and Noor Testperson (Vendor) are visible on Contacts and on Cap table All, but on no other Cap table tab. Both pages therefore filter by kind, with different vocabularies and different coverage.
- **Different default kind per page.** Contacts opens a new contact as Other (screen 13). Cap table All opens through the dialog default, Investor. A Cap table tab uses the tab's kind (#2).
- **Cap table is a superset view.** It has tabs, Sort, Clear filters, toast, highlight and Undo. Contacts has none of those (#1, #13, #14). A user will learn one page's behavior and be surprised by the other.
- **Three search boxes**, two for people with separate state and one that finds pages but not people.
- **Hiding Contacts** from the sidebar through Page options leaves it reachable by search and URL (#24, assumed).
- **`contacts_add` versus `contacts_save`** share a label "Adding a contact" regardless of tool (#6). These are not UI overlap but they show up as the same line in chat.

Count: 6 findings.

## Hierarchy & IA

- **Sidebar order.** Pages are Inbox, Finance, Legal, Cap table, Contacts, Data room, Artifacts (screen 12). Contacts sits directly under Cap table. That adjacency itself reads as "Contacts belongs to the cap table", which is wrong for a contact that is a lawyer or a customer. Contacts is used by Legal, Data room and the agents, so it belongs as a standalone page, not tied to Cap table. It is one click from the sidebar either way, so depth is fine (one click for both pages).
- **One concept, many names.** The same record is a "Contact" (Contacts page, dialog title, button), an "Investor" or "Auditor" (Cap table tab names and the add button), a "Shareholder" or "holder" (Carta rows), and has a "Kind" (filter and dialog field) that the Cap table calls a tab. "Add investor" creates a contact, not a Carta holder, and the dialog helper line has to explain that. Recommend: the word for the record is **Contact** everywhere, the word for the field is **Kind** everywhere. Keep Shareholders and Options only as Carta data names.
- **Should Legal, Customer and similar kinds be on the Cap table at all?** No. Contacts of kinds that never hold equity (Legal, Customer, Vendor, Partner, Advisor) show only under Cap table All, so they are present but unreachable by tab and add noise to a page about ownership. The Cap table's job is Carta holdings. Investors and auditors are a defensible exception because investors may hold equity and auditors are part of the cap table review, but the join is better done as an "is a holder" indicator than as a second list. Recommended end state: Cap table shows Carta holders, and for a holder that matches a contact it shows a link or small marker to the contact. Contacts is the only list of people, with the Kind filter as the only way to narrow by role.
- **Cap table page weight.** On a 1280 px screen, the contact table starts below four stat cards and a donut chart, so the user has to scroll (screen 04) to reach the contacts, while Contacts shows them at the top (screen 01). With the agent panel open, Cap table also truncates names ("Lee Notarealper...", screen 05). Contacts is the better home for browsing people.
- **Hidden or inconsistent controls.** The Cap table header has an unlabeled eye icon, a refresh icon, a download icon and a "+" icon next to "Add contact" (screen 04), each with a name only on hover. Not a contacts issue, but it raises the cost of finding the contact add button.

Count: 5 findings.

## Ranked Changes

Constraints applied: minimal copy, progressive disclosure, reuse the existing dialog, table and Tabs components. Effort: S under half a day, M about a day, L multi-day.

| Rank | Change | Why | Effort | Files |
|---|---|---|---|---|
| P1 | Make Contacts the single place to add, edit and delete people: move the toast, row highlight and Undo into the shared dialog path so both pages behave the same. Use one default kind (Other) on every surface; a Cap table tab still prefills its own kind. | Fixes #1, #2, #13. Same dialog, same result on both pages. | M | `apps/web/src/pages/Contacts.tsx`, `apps/web/src/pages/CapTable.tsx`, `apps/web/src/components/ContactDialog.tsx` |
| P1 | Remove the Cap table tabs for Auditors and Other (and the "Add investor" and "Add auditor" per-tab relabeling). Keep All, Shareholders, Investors and Options as Carta views. Customers, vendors, lawyers and auditors live only on Contacts, filtered by Kind. | Removes the Kind filter overlap, the per-tab button renaming, and the unreachable-kind problem (#7). | M | `apps/web/src/pages/CapTable.tsx`, `apps/web/src/pages/CapTable.stories.tsx`, `docs/design-system/components.md` (regenerate with `pnpm design-system`) |
| P1 | Stop the Cap table from listing non-holder contacts. For a Carta holder that matches a contact by email, show a link to open the contact; show nothing for contacts with no holding. | Removes duplicate name, email and kind rows and the mixed Carta and address-book list. Creates one source of truth per fact. | L | `apps/web/src/pages/CapTable.tsx`, join logic used by `CapTable.tsx` |
| P2 | Show the dialog helper line "Contacts are your address book. They do not change Carta." only when the dialog is opened from the Cap table in add mode, and drop the repeated sentence from the Cap table empty state. | Copy that repeats the interface on every open. | S | `apps/web/src/components/ContactDialog.tsx`, `apps/web/src/pages/CapTable.tsx` |
| P2 | Let sidebar search find contacts by name and email, and open the Contacts page filtered (or the dialog) on selection. Alternative if rejected: leave the sidebar as pages and chats only and say so by removing the "Search mail for" fallback only when the text looks like a name. | A user searching for a lawyer's name gets "No matches" for someone who is in the app (screen 15). | M | `apps/web/src/pages/Shell.tsx` (search), `apps/web/src/pages/shell/command-palette.stories.tsx` |
| P2 | Show Notes as a truncated line under the name in the Contacts list and include notes in search (page and `contacts_list`). | Notes are the only record of why an agent saved a person (#3, #9, #17). Reuses the two-line row already used on Cap table. | M | `apps/web/src/pages/Contacts.tsx`, `packages/db/src/contacts.ts`, `packages/adapters/src/contact-tools.ts` |
| P2 | Use one name: "Contact" for the record and "Kind" for the field on every surface; Carta rows keep "Shareholder" and "Options". | One concept, one name. | S | `apps/web/src/pages/CapTable.tsx`, `apps/web/src/pages/Contacts.tsx`, `apps/web/src/components/ContactDialog.tsx` |
| P3 | Move Contacts away from directly under Cap table in the sidebar (for example below Data room), or leave the order and accept the adjacency. | Adjacency suggests ownership by the cap table. Low impact once the lists stop overlapping, so do it last. | S | `apps/web/src/pages/Shell.tsx` |
| P3 | Align empty and error states: add an Add button in the Contacts empty state, "Try again" on Contacts load errors, and a "Clear filters" button on "No matches". Keep one empty text. | Closes #4, #5, #11 and the empty-text mismatch. | S | `apps/web/src/pages/Contacts.tsx` |
| P3 | Put search and Kind filter into the URL on Contacts, as Cap table does. | Removes a behavior difference (#14). | S | `apps/web/src/pages/Contacts.tsx` |

Order of work: P1 rows 1 and 2 first (they are independent and remove the most drift), then row 3, which depends on the decision to make Cap table Carta-only.
