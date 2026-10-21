## Area: Data room (STORY-DRM-nnn)


Generated: 2026-10-17, refreshed 2026-10-20
Repository: `the repository root` (branch `docs/ux-pass`, code read at HEAD `559a76ad`). PR #109 stories were read from `origin/feat/legal` at commit `f2b8fc1e` ("Legal: regenerate translation catalogs after the e2e fixes").
Total Stories: 65 (short 32, medium 30, long 3) as of 2026-10-20, of which 1 retired
Persona for every story: Maya, a naive first-time founder of Northwind Robotics ("Northwind Robotics") who has never seen Praci, does not know its vocabulary ("Data room", "folder", "filing", "agent", "approval", "space"), and wants to keep the company's documents in order and find them again.

### Refresh 2026-10-20 (features merged since 2026-10-17)

- **Added** (21): DRM-101, DRM-102, DRM-103, DRM-104, DRM-105, DRM-106, DRM-107, DRM-108, DRM-109, DRM-110, DRM-111, DRM-112, DRM-113, DRM-114, DRM-115, DRM-116, DRM-117, DRM-118, DRM-119, DRM-120, DRM-121. They sit at the end of this area under "Stories: Added 2026-10-20".
- **Rewritten in place for the current UI** (same id, new text, marked "Updated 2026-10-20"): DRM-004, DRM-002, DRM-005.
- **Detail folded into an existing story** (same id, a section "Added 2026-10-20" at the end): DRM-027, DRM-001, DRM-036.
- **Retired**: DRM-041. The story keeps its text for history and points at the story that replaces it.
- **Marked with a dated note** (the UI changed; the steps below the note are the old steps and were not rewritten): DRM-003, DRM-007, DRM-008, DRM-012, DRM-020, DRM-021, DRM-039, DRM-040, DRM-042, DRM-043, DRM-044, DRM-024, DRM-025, DRM-026, DRM-027, DRM-028, DRM-029, DRM-037, DRM-038, DRM-009.
- PR #109 has merged. Remarks below that say a story "requires PR #109", "is not on main" or that the Data room has icon-only import buttons are out of date: Import is a header menu (Email, Google Drive, Box). Data room sharing still does not exist (STORY-DRM-022).

### Changes since the 2026-10-16 catalog

The Data room changed a lot on main since the last catalog (`git log -- apps/web/src/components/data-room apps/web/src/pages/DataRoom.tsx`, most recent: `78d97779` phone toolbar, `b302756f` folder URL authoritative, `f162d56f` folder in the URL, `a2d42924` folder rename/move/delete, `c3e1c923` consent prompt on the page, `ab20ab44` delete confirm + duplicate toast).

- **Rewritten 2026-10-20**: STORY-DRM-004 is now "Upload a large file" (it was the 50 MB refusal toast, which no longer exists). Uploads have no size limit; a file too large to read is stored and the preview says "Too large to search inside".
- **Changed (same id, rewritten to match code)**:
  - 001 empty state now has a sentence ("Keep contracts, board decks and investor documents in one place.").
  - 002, 003 the finished-upload toast says "Uploaded" (no longer "Filed"), stays 10 s.
  - 005 a repeat upload now says "Already in your Data room" or "Already in <folder>" (`DropZone.tsx:25-31`).
  - 006 uploads now go into the open folder (it was a gap: uploads always went to the root).
  - 007 status words are now just "Reading" or blank; "Pending" and "Filing" no longer exist (`format.ts:16-17`).
  - 008 a failed file now has "Couldn't read this file", its reason, and a Delete button in the preview.
  - 009 the consent prompt now exists on the page ("Let Praci read your documents", Allow). It used to be a dead end.
  - 010 filing now follows the Allow button; the row shows the folder path under the name.
  - 011 the open folder lives in the URL; Back works; a parent folder shows its sub-folders as rows but not their files.
  - 012 view and sort are remembered in the browser (they were not); the Date and Type sort options hide until some item has a value.
  - 013 search box placeholder "Search names and text", an explanatory line under "No results".
  - 014 Type, Party and Source are now pick lists, not free-text boxes, so the capital-letter and partial-name traps are gone; Source is always offered.
  - 015 the chip is called "Document date"; "Clear filters" appears on an empty result.
  - 016 Move can create a folder ("New folder…"); folders can be renamed, moved and deleted from the same menu.
  - 017 the delete dialog says "This can't be undone." and a "Deleted" toast appears; the preview stays on the neighbouring item.
  - 018 (long) and 019 re-walked with the new behaviour; 019 and 020 are now typed medium because they have fewer than 15 steps.
  - 020 to 023 were gap stories. 020 (Gmail), 021 (Drive) and 023 (agent tools) are now working-feature stories that **require PR #109 (origin/feat/legal)**; on current main they are still gaps and each says so in Alternate paths. 022 (sharing) is still absent on both branches and stays a documented gap.
- **Dropped**: none. Every previous story still has a counterpart.
- **Added (STORY-DRM-024 to 044)**:
  - 024 to 029, 036, 038: URL folder behaviour (deep link, Back, bad id, rename or delete elsewhere, item link), search within a folder, grid sub-folders.
  - 027, 033: folder housekeeping and "New folder…" (027 found that top-level folders cannot be managed).
  - 030, 031: phone width and keyboard-only use.
  - 032, 034, 035, 037: no-model consent text, Hide amounts, sidebar search, Load more and list errors.
  - 039 to 044: PR #109 only (email picker problems, Drive browsing and export, Connect buttons, source links, import into the open folder, an agent adding an attachment on its own).

### What exists in the code (read before walking)

Main (`559a76ad`):

- Route `/app/data-room`, sidebar entry "Data room" (`Shell.tsx:1794`, `:3512`). The sidebar search also lists matching Data room files under their own group (`Shell.tsx:1830-1836`, `:3544`).
- Page `apps/web/src/pages/DataRoom.tsx`. Empty state: dashed box, "Drop files here", "Keep contracts, board decks and investor documents in one place.", button "Choose files" (`:347-361`). Otherwise: header with List view / Grid view toggles and "+" (aria "Add files"), consent card (when relevant), filter bar, folder tree (container at least 800 px) or a folder pill (below 800 px), list/grid/search results, "Load more", preview beside the list (page body at least 560 px) or in a dialog (narrower).
- **The open folder is the URL**: `?folder=<id>` (`DataRoom.tsx:83-111`). Choosing a folder pushes a history entry, so Back returns to the previous folder. A folder id that does not exist is removed from the URL after the folder list loads (`:122-141`). `?item=<id>` opens that item's folder and previews it (`:191-213`); a bad item id is ignored silently.
- Folder tree has no menu. Sub-folders of the open folder appear as rows (list) or tiles (grid) above the files, each with a "…" menu: Move, Rename, Delete (`ItemRows.tsx:228-290`). A folder shows only the files directly in it (`packages/db/src/data-room.ts:168-172` is an equality test), not those of its sub-folders.
- Drop anywhere in the app: overlay "Drop to add to Data room" and one toast per file: percentage, then "Uploaded" + "View", or "Already in …", or "Unsupported file name" / "Upload failed" (`DropZone.tsx`). Files go into the folder the Data room page shows, or the root from any other page (`upload-toasts.ts:122-133`). Toasts last 10 s (done), 15 s (failed), 5 s ("Deleted"); they pause while the pointer is over them.
- Filter bar (`FilterBar.tsx`): search box (placeholder "Search names and text", aria "Search documents", debounced 300 ms, server-side, Escape clears), then "Type", "Party", "Document date", "Source" and "Sort: …" plus an ascending/descending arrow. Type, Party and Source are pick lists built from the rows on screen (Source always offers Upload, Google Drive, Gmail, Chat, Finance). A filter appears only when there is something to pick (Type, Party, Document date), or is already set.
- Status: while a background job works the row shows a spinner and the word "Reading"; failed shows "Failed" in red with the reason as a hover tooltip. Ready rows show nothing. The list re-reads working items every 3 s (`use-data-room-list.ts:34`).
- Preview (`Preview.tsx`): "Preview" header with "…" and a close X; name; image (for png/jpg/gif/webp up to 10 MB; hidden when Hide amounts is on); summary or "Reading" or "Couldn't read this file" + reason; Type, Date, Parties, Amount, Tags, Folder, Source, Size; failed files lead with a red "Delete"; every file has "Download".
- Consent card (`ConsentPrompt.tsx`): "Let Praci read your documents" + Allow, or, with no model, a grey note telling the founder to set up a model in Settings. After Allow, items that were waiting go through reading and filing again (`apps/api/src/data-room.ts:245-290`).
- Settings: "Embedding model" in the model settings overlay enables semantic search.

Note (refresh 2026-10-20): PR #109 has merged; the Legal and import features below are in the current build:

- `ImportSources` in the Data room header (`ImportFromEmail.tsx:274-331`, `ImportFromDrive.tsx`): in the empty state two buttons beside "Choose files" ("Import from email" or "Connect Gmail"; "Import from Google Drive" or "Connect Google Drive"); once the room has items they become icon buttons with those aria labels. A picker dialog per source; after import a 6 s notice "Imported N file(s)" / "Already in the Data room" / "Couldn't import N file(s)".
- Preview "Source" shows "From email" (link back into the Inbox message) or "From Google Drive" (link that opens Drive).
- Three agent tools for every owner-run agent: `search_data_room`, `read_data_room_item`, `add_to_data_room` (`packages/adapters/src/data-room-tools.ts`). `add_to_data_room` adds an email attachment, Drive file or artifact to the root unfiled, only after Data room consent.
- The PR's new `components/legal/ConsentPrompt.tsx` is the Legal agent's consent card ("Let the Legal agent read your documents"), not the Data room's; the Data room's own `ConsentPrompt.tsx` is unchanged by the PR.

Still absent on both branches: sharing with other members, the "Ask agent" button in the preview, the Data room agent and its side panel (the docs describe a "Create Data room agent" button; no code builds it), undo or trash, retry of a failed item, folder menus on the tree, multi-select or bulk download, mobile-specific layout beyond the narrow rules above.

### Mock demo data required (seed for "Northwind Robotics")

Every story names the subset it needs. The full seed is:

- **S0 – empty account**: a signed-in user with completed onboarding and zero Data room items or folders.
- **S1 – filed library** (items owned by the demo user, `source: "upload"`, `status: "ready"`, classified):
  - Folders: `Legal` > `Contracts`; `Finance` > `Invoices`; `Finance` > `Bank statements`; `Investors`; `HR`.
  - `Northwind - Series A term sheet v3.pdf` — docType `investor`, docDate 2026-09-28, parties ["Northwind Robotics", "MOCK Harbor Ventures"], tags ["funding", "series a"], summary "MOCK: draft Series A term sheet, $6M at $24M pre-money.", folder `Investors`.
  - `Northwind HQ lease renewal 2027.pdf` — docType `contract`, docDate 2026-10-03, parties ["Northwind Robotics", "MOCK Pier 9 Properties"], amountCents 2400000 USD, tags ["lease", "renewal"], folder `Legal / Contracts`.
  - `Invoice NW-1042 Acme Servo Supply.pdf` — docType `invoice`, docDate 2026-08-14, parties ["MOCK Acme Servo Supply", "Northwind Robotics"], amountCents 1875000 USD, tags ["hardware"], folder `Finance / Invoices`.
  - `Invoice NW-1043 Acme Servo Supply.pdf` — same party, docDate 2026-09-14, amountCents 920000 USD, folder `Finance / Invoices`.
  - `Mercury statement 2026-09.pdf` — docType `statement`, docDate 2026-09-30, parties ["Northwind Robotics"], folder `Finance / Bank statements`.
  - `Offer letter - Priya Raman (MOCK).docx` — docType `hr`, docDate 2026-07-01, folder `HR`.
  - `Board minutes Q2 2026.pdf` — docType `report`, docDate 2026-06-30, no folder.
- **S2 – in-progress and failed items**: `Delaware franchise tax notice.pdf` with `status: "extracting"`; `Scan 0007.jpg` with `status: "classifying"`; `Old cap table export.xlsx` with `status: "failed"`, error "Could not read this file"; `Customer NDA - MOCK Bolt Freight.pdf` with `status: "ready"`, error "Classification skipped" (preview shows "Couldn't classify").
- **S3 – unclassified library** (no consent recorded): five `ready` uploads with all facets null, no folders.
- **S4 – many items**: 60+ ready items so "Load more" appears (list page 50, search page 20).
- **S5 – folder ids**: the folder ids of `Legal`, `Contracts`, `Finance`, `Invoices`, `Bank statements` (the walker reads them from `rpc.dataRoom.folders`) so URLs like `/app/data-room?folder=<id>` can be built; plus one empty folder `Archive`; plus one empty folder `Old drafts` with a sub-folder `2025` (for delete tests).
- **Files on the walker's disk**: `MOCK Northwind pitch deck.pdf` (~3 MB), `MOCK Northwind SAFE - Jane Angel.pdf`, `MOCK board-video.mp4` (~60 MB), a byte-identical copy of `Northwind HQ lease renewal 2027.pdf` (a name with a slash cannot exist on disk; see the 004 edge case).
- **Model state**: M0 = no default model; M1 = default chat model set, no embedding model; M2 = default chat model plus an "Embedding model" value. Data room consent: C0 not recorded (Allow card shows), C1 recorded.
- **PR #109 only**: one connected mock Gmail account (provider `gmail`) with thread "MOCK Acme Servo Supply – invoice NW-1044" (PDF `invoice-1044.pdf`, 52 kB) and a second thread with a 4 kB logo image and a `.ics` invite; one connected Google Drive account (provider `googledrive`) with a folder `Contracts` holding `MOCK Customer MSA - Bolt Freight.pdf`, a Google Doc `Quarterly plan`, and a Google Form `Customer survey` (not exportable); an Inbox/Finance agent that can run tools.

### Summary

| Type | Count |
|------|-------|
| Short | 26 |
| Medium | 17 |
| Long | 1 |

### Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Find the Data room / empty state | 001, 002, 018, 035 | no sentence says what the room does beyond "Keep contracts, board decks…" |
| Upload (button, drop on page, drop anywhere, limits, duplicates, into a folder) | 002, 003, 004, 005, 006, 018, 043 | "Unsupported file name" cannot be triggered from a real file |
| Ingestion status (spinner, Reading, Failed) | 007, 008, 018 | no retry for a failed item |
| Consent card | 009, 010, 032, 019 | no "Not now"; consent lapses silently when the model changes |
| Automatic filing and folders | 010, 027, 033 | classifier can create near-duplicate folders |
| Browse (tree, pill, list/grid, sort, preview) | 011, 012, 024, 025, 030, 038 | tree has no menu; a parent folder never shows sub-folder files |
| Folders in the URL (deep link, Back, bad id, deleted elsewhere) | 011, 024, 025, 026, 028, 029 | bad `?item=` id is ignored with no message |
| Search and filters | 013, 014, 015, 036, 035, 037 | search inside a folder is silent about the scope |
| Move / rename / delete / download | 016, 017, 027, 033 | no undo for delete |
| Phone width, keyboard | 030, 031 | no mobile-specific preview layout beyond dialog |
| Hide amounts | 034 | none |
| Gmail attachment import (PR #109) | 020, 039, 041, 042, 043 | not on main |
| Google Drive import (PR #109) | 021, 040, 041, 042, 043 | not on main; first connected Drive account only |
| Sharing with a cofounder / investor | 022 | Not built on either branch |
| Agents over documents (PR #109) | 023, 044 | not on main; no "Ask agent" button; no Data room agent panel |

### Story Dependency Graph

```text
STORY-DRM-001 (Find the Data room, empty)
├── STORY-DRM-002 (First upload with Choose files)
│   ├── STORY-DRM-003 (Drop on another page)
│   ├── STORY-DRM-004 (Large file)
│   ├── STORY-DRM-005 (Same file twice)
│   ├── STORY-DRM-006 (Upload into the open folder)
│   └── STORY-DRM-007 (Watch it get read)
│       ├── STORY-DRM-008 (A file failed)
│       └── STORY-DRM-009 (Why is nothing tagged? consent)
│           ├── STORY-DRM-010 (Auto-filing into folders)
│           └── STORY-DRM-032 (No model: the grey note)
├── STORY-DRM-011 (Browse folders)  [S1]
│   ├── STORY-DRM-012 (List vs grid, sort, remembered)
│   ├── STORY-DRM-024 (Bookmark a folder / deep link)
│   │   ├── STORY-DRM-025 (Back button)
│   │   ├── STORY-DRM-026 (Stale or mistyped folder id)
│   │   └── STORY-DRM-028 (Folder deleted in another tab)
│   ├── STORY-DRM-029 (Open an item link / View in toast)
│   ├── STORY-DRM-038 (Grid with sub-folder tiles)
│   ├── STORY-DRM-013 (Search for the lease)
│   │   ├── STORY-DRM-036 (Search while a folder is open)
│   │   ├── STORY-DRM-035 (Find a file from the sidebar search)
│   │   └── STORY-DRM-014 (Filter invoices from one vendor)
│   │       └── STORY-DRM-015 (Document date filter)
│   ├── STORY-DRM-016 (Rename and move a file)
│   │   ├── STORY-DRM-033 (New folder… while moving)
│   │   ├── STORY-DRM-027 (Rename, move, delete folders)
│   │   └── STORY-DRM-017 (Delete a duplicate)
│   ├── STORY-DRM-034 (Hide amounts)
│   ├── STORY-DRM-037 (Many items: Load more, list error)
│   ├── STORY-DRM-030 (Phone width)
│   └── STORY-DRM-031 (Keyboard only)
├── STORY-DRM-018 (LONG: first week setting up documents)
├── STORY-DRM-019 (LONG: investor diligence request)
├── STORY-DRM-020 (LONG: month-end invoices from Gmail)
│   ├── STORY-DRM-039 (Email picker problems)
│   ├── STORY-DRM-041 (Connect Gmail / Drive first)
│   └── STORY-DRM-042 (Source link and repeat import notice)
├── STORY-DRM-021 (Bring in Google Drive)
│   ├── STORY-DRM-040 (Browse Drive, Google Docs, unsupported)
│   └── STORY-DRM-043 (Import into the open folder)
├── STORY-DRM-022 (Share with cofounder)  [gap on both branches]
└── STORY-DRM-023 (Agent over documents)
    └── STORY-DRM-044 (An agent files an attachment by itself)
```

### Stories: Getting started and uploading

#### STORY-DRM-001: Find where documents go

> **Updated 2026-10-20**: detail added from a newer walk of the same goal, see the section "Added 2026-10-20" at the end of this story.

**Type**: short
**Topic**: Navigation / empty state
**Persona**: Maya, signed in for the first time, holding a folder of PDFs on her laptop.
**Goal**: Find the place in the app where company documents live.
**Preconditions**: S0 (empty account), any model state. On main.
**Ideal path**: 1 — one clearly named sidebar entry should take her there.
**Alternate paths**: Direct URL `/app/data-room`; the sidebar search (STORY-DRM-035); the "View" link in an upload toast once something is uploaded.

##### Steps
1. Scan the sidebar for "Documents" or "Files" → She sees "Data room" with a folder-open icon (`Shell.tsx:1794`). **Hesitation:** "Data room" is investor-diligence jargon; she may not connect it with "all my company files".
2. Click "Data room" → Page titled "Data room" with a dashed box: upload icon, "Drop files here", "Keep contracts, board decks and investor documents in one place.", and a "Choose files" button. No view toggles, search or filters are shown yet.
3. Read the box for an explanation → The sentence names the kinds of file but does not say the room reads and sorts them. She learns only that it accepts files. **Expectation:** "It's like a shared drive."

##### Variations
- Phone width: the sidebar is behind the menu button; tapping "Data room" closes the sidebar.
- With PR #109: two more buttons sit beside "Choose files" (see STORY-DRM-020, 021, 041).

##### Edge Cases
- The first list call fails: the page is not "empty", so the full filter bar shows with a red error line and "Retry" instead of the drop box (`DataRoom.tsx:396-403`).

##### Added 2026-10-20: First arrival in an empty Data room

**Type**: short
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya on day one at Northwind Robotics.
**Goal**: Understand what the page is for and add the first file.
**Preconditions**: New space with no files and no folders.
**Ideal path**: 2 — "Choose files", pick a file.
**Alternate paths**: Drag a file anywhere in the window; "Import" menu in the card.
###### Steps
1. Open Data room → header shows only "Data room" (no view switch, no Add files, no Import); a dashed card "Drop files here" with "Keep contracts, board decks and investor documents in one place."
2. Click "Choose files" → file picker; choose "Northwind Bylaws.pdf".
3. Upload toast shows progress; the page switches to the normal layout with the file in the list; header now shows the three view toggles, "Import" and "Add files".
4. A card reads that Praci does not tag files until it can read them ("Let Praci read your documents" with Allow, or the line about setting up a model in Settings if no model exists). Maya hesitates about sending text to an AI service.
###### Variations
- Drag a file over the window → full-window drop target appears; drop → same as step 3.
- "Import" in the card → same menu as STORY-DRM-119.
###### Edge Cases
- Upload fails → toast with a reason such as "Unsupported file name" or "Upload failed".
- A zip → toasts "Opening <name>", "Adding 3 of 120 · <file>", "Reading 10 of 120"; failures: "This zip is password-protected", "This zip has more than 10,000 files", "This zip is too large to unpack", "This zip has unsafe file paths", "This zip can't be read".
- Hide amounts is hidden until there are files.

---

#### STORY-DRM-002: Choose several files with "Add files" and get one card per file

> **Updated 2026-10-20**: rewritten for the current UI; files are now uploaded as streamed cards (one per file) and the list shows a processing strip.

**Type**: short
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics
**Goal**: Add a 409A report, a signed SAFE and a cap table export in one go.
**Preconditions**: Data room open, folder "Legal" selected in the folder tree.
**Ideal path**: 3 — "Add files", multi-select in the picker, confirm.
**Alternate paths**: Drag the three files onto the window; both go to the open folder.

##### Steps
1. Click "Add files" in the toolbar (tooltip also "Add files"). → The OS file picker opens; it allows multiple selection.
2. Select three files and confirm. → Three separate cards stack bottom right, each with its own percent and bar.
3. As each finishes, its card changes to "Uploaded" plus "View". → Files appear in "Legal" because uploads go to the folder the page currently shows.

##### Variations
- From a folder that is empty, the line "This folder is empty. Drop files here or add them." has its own outlined "Add files" button; same behavior.
- On the empty Data room, the button reads "Choose files" next to the Import menu.

##### Edge Cases
- If the "Legal" folder was deleted in another tab, the card reads "This folder no longer exists" with a link "Upload to All items". Clicking it re-uploads the same file at the top level (see STORY-DRM-107).
- A file name the server rejects shows "Unsupported file name".

#### STORY-DRM-003: Drop a file while on another page

> **Updated 2026-10-20**: drops from another page now show the upload card lines and the processing strip (STORY-DRM-107).

**Type**: short
**Topic**: Upload (drop anywhere)
**Persona**: Maya reading her Inbox, who just saved a signed NDA to the desktop.
**Goal**: Store the NDA without leaving the current page.
**Preconditions**: S1; walker has a PDF on disk; current page `/app/inbox` (or a chat). On main.
**Ideal path**: 1 — drop the file.
**Alternate paths**: Data room "Choose files" / "+" (STORY-DRM-002).

##### Steps
1. Drag the PDF over the Inbox → A full-window overlay reads "Drop to add to Data room". **Hesitation:** she did not know this was possible; nothing on other pages advertises it.
2. Drop → Toast with progress, then "Uploaded" + "View". The file goes to the Data room root, because no Data room page is open (`upload-toasts.ts:122-133`).
3. Click "View" → Data room opens with the NDA open in the preview and its folder (none) selected.

##### Variations
- Drop onto the chat composer instead: the composer takes it as a chat attachment and the overlay goes away (`DropZone.tsx:57-58`). She may not realise these are two different places.
- Drop while a menu is open: open menus close, dialogs do not (`DropZone.tsx:53-56`).

##### Edge Cases
- Dragging text or a link (not a file) → no overlay (`dragHasFiles`).

#### STORY-DRM-004: Drop one large board deck onto the Data room and watch the upload card

> **Updated 2026-10-20**: rewritten for the current UI; uploads have no size limit any more; the earlier version was the 50 MB refusal.

**Type**: short
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, first-time founder of Northwind Robotics, preparing for investor diligence
**Goal**: Get a 700 MB recorded board meeting walkthrough PDF into the Data room and know when it is safely there.
**Preconditions**: Signed in; Data room open at All items; space has at least one item; file is on the desktop.
**Ideal path**: 2 — drag the file onto the window, then click "View" on the finished card.
**Alternate paths**: "Add files" toolbar button (file picker); empty-state "Choose files" button; drop on any other page.

##### Steps
1. Drag the file over the window. → Full-window overlay with dashed box "Drop to add to Data room". Any open menu closes (an Escape is dispatched, unless a dialog is open).
2. Release over the page. → Overlay goes away. A card appears bottom right with the file name (truncated, full name on hover), a percentage such as "12%", and a thin progress bar. Maya thinks: "Is it really uploading, or frozen?" The percent ticking is her reassurance.
3. Wait until 100%. → Percent is replaced by an X (aria-label "Dismiss"). Line below shows "Uploaded" in green and a "View" link. The card auto-dismisses after 10 seconds, but not while her pointer rests on it.
4. Click "View". → Card closes and the item's preview opens. The row also appears in the list (Data room reloads on upload).

##### Variations
- Dismiss with the X before it finishes: not available while uploading (the percent replaces the X). UNVERIFIED whether the upload can be cancelled; no cancel control exists in the card.
- Maya navigates to Inbox mid-upload: the card stays (drop zone is mounted app-wide).

##### Edge Cases
- Maya hesitates at 100% while the file is still "Reading" in the list: "Uploaded" only means stored, not searchable. Processing is shown separately (see STORY-DRM-102).
- Closing the tab mid-upload loses the upload; no resume control found in code.
- Switching space or signing out clears all cards and stops reporting from running uploads.

#### STORY-DRM-005: Upload a file that is already there (duplicate)

> **Updated 2026-10-20**: rewritten for the current UI; the duplicate check and its message were rewritten with the streamed upload.

**Type**: short
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics
**Goal**: Drop "SAFE-Acme-signed.pdf" again, not remembering she filed it last week.
**Preconditions**: Same bytes already in folder "Investors / SAFEs" as "Acme SAFE (signed).pdf".
**Ideal path**: 2 — drop; read "Already in ...".
**Alternate paths**: A zip full of known files (STORY-DRM-101 edge case).

##### Steps
1. Drop the file while viewing All items. → Normal upload card with percent.
2. Upload ends. → No green "Uploaded". The card reads "Already in Investors / SAFEs as Acme SAFE (signed).pdf" with a "View" link. Maya thinks: "Good, no second copy."
3. Click "View". → Opens the existing item, not a new one.

##### Variations
- Same name, same folder: line reads "Already in Investors / SAFEs" (no "as" part).
- Item at the top level with a different name: "Already in your Data room as Acme SAFE (signed).pdf".
- Item at top level with the same name: "Already in your Data room".
- Files are matched by contents (SHA-256), not by name.

##### Edge Cases
- The folder path is looked up after the upload; if that lookup fails, the card falls back to the shorter "Already in your Data room" wording.
- The bytes still travel over the network in full before the duplicate is found (the server checks after the write), so a duplicate 700 MB file takes the full upload time.

#### STORY-DRM-006: Upload into the folder she is looking at

**Type**: short
**Topic**: Upload + folders
**Persona**: Maya has the `Investors` folder open and drops the SAFE into it.
**Goal**: Add the SAFE directly to `Investors`.
**Preconditions**: S1; consent C0 or C1 (both variants); walker has `MOCK Northwind SAFE - Jane Angel.pdf`. On main.
**Ideal path**: 1 — drop while the folder is selected.
**Alternate paths**: Upload to the root then Move (STORY-DRM-016).

##### Steps
1. Click `Investors` in the folder tree → URL gains `?folder=<id>`; the list shows only the term sheet.
2. Drag the SAFE onto the list → Overlay "Drop to add to Data room"; toast "Uploaded".
3. Look at the list → The SAFE appears in `Investors` with a spinner and "Reading". The upload used the open folder (`DataRoom.tsx:144-147`, `upload-toasts.ts:122-133`).
4. Click "All items" → The SAFE is listed with its folder path, `Investors`, under its name.

##### Variations
- Choose files with "+" while a folder is open: same result.
- The same drop from the Inbox page goes to the root, not to this folder.
- A search is active while the folder is open: the file still goes to the folder.

##### Edge Cases
- The folder was deleted in another tab after she opened it: the upload is refused with 404 and the toast says "Upload failed", with no mention of the folder (`apps/api/src/data-room.ts:396-402`; see Suspected problems).
- Without consent the SAFE stays in `Investors` as she put it; auto-filing only moves items that have no folder.

### Stories: Processing and consent

#### STORY-DRM-007: Watch a new document get read

> **Updated 2026-10-20**: reading, indexing and tagging now show in a processing strip with Details (STORY-DRM-102).

**Type**: medium
**Topic**: Ingestion status
**Persona**: Maya just uploaded the pitch deck and wants to know whether the app "understood" it.
**Goal**: See the document go from uploaded to read and tagged.
**Preconditions**: S1; model M1 or M2; consent C1; walker has `MOCK Northwind pitch deck.pdf`. On main.
**Ideal path**: 2 — upload, then see one clear status until done.
**Alternate paths**: none found.

##### Steps
1. Upload the deck (any route) → A new row at the top (sort "Recently added") with a spinner and the word "Reading" in grey text. A column "Status" shows when no row has types or dates yet; otherwise the word sits in the Type column.
2. Wait a few seconds → The list re-reads the item every 3 s. When it is ready the spinner turns into a file icon and the word disappears. **Misread risk:** nothing says "Done"; a ready row just has no status.
3. Click the row → The preview shows "Reading" while it works, then a summary, Type, Date, Parties, Tags and Folder.
4. Look at the folder tree → With consent a folder the classifier proposed may be new. She did not create it.
5. Look at the row in "All items" → The folder path appears as a small grey line under the name.

##### Variations
- M2 (embedding model set) vs M1: the same visible flow; only search quality differs.
- The row's sort position can change when it is read (a sort by Date or Type): the list reloads its first page instead of moving the row (`use-data-room-list.ts:196-204`).

##### Edge Cases
- She leaves the page during "Reading": work continues; no notification when it ends.

#### STORY-DRM-008: A document failed to read

> **Updated 2026-10-20**: a failed read says 'Couldn't read this file' with Try again and Delete; a batch shows 'N couldn't be read' (STORY-DRM-105).

**Type**: short
**Topic**: Ingestion status / errors
**Persona**: Maya scanning the list who sees a red row.
**Goal**: Understand what went wrong and fix it.
**Preconditions**: S1 + S2. On main.
**Ideal path**: 2 — see the reason, click retry.
**Alternate paths**: Re-upload the identical file, which restarts a failed item (STORY-DRM-005 edge case); undocumented.

##### Steps
1. Spot `Old cap table export.xlsx` → A red file icon (aria "Failed") and a red "Failed" in the Type or Status cell; the reason is only a hover tooltip.
2. Click the row → Preview shows "Couldn't read this file" in red with the reason ("Could not read this file").
3. Look for "Try again" → None. The preview shows a red **Delete** button and an outline **Download**. The "…" menu has Move, Rename, Delete.
4. Decide to download the spreadsheet and keep it elsewhere, or delete it and upload again.

##### Variations
- `Customer NDA - MOCK Bolt Freight.pdf` (ready with an error) → the preview shows a small grey "Couldn't classify" line; no reason, no action.
- Grid view: the failed tile keeps the same height as the others (one reserved line).

##### Edge Cases
- Clicking Delete: confirm dialog "Delete Old cap table export.xlsx?" (STORY-DRM-017).

#### STORY-DRM-009: "Why didn't it tag anything?" (the Allow card)

> **Updated 2026-10-20**: the consent card text is now 'Let Praci read your documents' with Allow; see also STORY-APP-345 and STORY-APP-346.

**Type**: medium
**Topic**: Consent card
**Persona**: Maya uploaded five documents yesterday and expected them sorted into folders.
**Goal**: Get the app to read and organise the documents.
**Preconditions**: S3 (five ready, unclassified items, no folders); model M1; consent C0. On main.
**Ideal path**: 2 — read the card, click Allow, watch items get filed.
**Alternate paths**: Settings "AI data sharing" switches look relevant but are separate; the Data room has its own card.

##### Steps
1. Open Data room → Above the search box a card headed "Let Praci read your documents": "To tag new files and sort them into folders for you, their text (and images) is sent to <model provider names>. Until then you can search by name and text and move files into folders yourself." Button "Allow". **Hesitation:** "sent to" a company name; she wonders whether the documents are shared or kept. No "Not now" button.
2. Click "Allow" → The card disappears and the list reloads (`ConsentPrompt.tsx:41-45`).
3. Watch the rows → Items the server had skipped go back through reading (`apps/api/src/data-room.ts:276-290`); the spinner and "Reading" return, then Type, Date and Parties fill in.
4. Open the folder tree → New folders the classifier created appear (STORY-DRM-010).

##### Variations
- If the card cannot load its status (network), it stays hidden silently.
- Allow fails (for example the provider list changed) → red error text in the card (`AiDataSharing.tsx` `ConsentCard`); she can press Allow again after reloading.

##### Edge Cases
- After consent, changing the default or embedding model changes the consent key, so the card returns for new uploads. Nothing explains why.

#### STORY-DRM-010: Let the app sort documents into folders

**Type**: medium
**Topic**: Automatic filing
**Persona**: Maya expects "drop it in, it goes to the right folder".
**Goal**: Upload an invoice and find it in a sensible folder without choosing one.
**Preconditions**: S1; model M1; consent C1; walker has a mock invoice PDF from "MOCK Acme Servo Supply". On main.
**Ideal path**: 1 — drop the file; it appears in the right folder.
**Alternate paths**: Manual Move (STORY-DRM-016).

##### Steps
1. Drop the invoice anywhere → Toast "Uploaded". It goes to the root if she is not on the Data room page.
2. Open the Data room, "All items" → The row shows a spinner and "Reading".
3. When read → The row shows no folder yet or, shortly after, a grey `Finance / Invoices` under the name. The tree is unchanged if the folder existed.
4. Click `Finance` then `Invoices` → The invoice is with the other Acme invoices.

##### Variations
- The classifier proposes a new path such as `Finance / Vendor bills` → a new folder appears next to `Invoices`. She can rename, move or delete it through its "…" menu when she opens its parent (STORY-DRM-027), but cannot merge it.

##### Edge Cases
- She moved the item before it finished → auto-filing only applies to items with no folder (`packages/db/src/data-room.ts:776`), so her choice stays.
- She dropped it while `Investors` was open → it lands in `Investors`, and the classifier does not move it.

### Stories: Browsing and finding

#### STORY-DRM-011: Browse folders to find the bank statement

**Type**: short
**Topic**: Folder tree / picker / URL
**Persona**: Maya, asked by her accountant for September's bank statement.
**Goal**: Find it by browsing.
**Preconditions**: S1; desktop width at least 800 px for the tree. On main.
**Ideal path**: 2 — click folder, click file.
**Alternate paths**: Search "statement" (STORY-DRM-013); folder pill on a narrower window (STORY-DRM-030).

##### Steps
1. Open Data room → The list shows everything, newest first; no preview is open until she clicks a file (`DataRoom.tsx:167-170`). The tree on the left shows "All items", then `Finance`, `Bank statements`, `Invoices`, `HR`, `Investors`, `Legal`, `Contracts` (indented).
2. Click `Finance` → URL becomes `?folder=<id>`. The list shows the sub-folder rows `Bank statements` and `Invoices` above any files directly in `Finance` (none). **Misread risk:** she expects to see all the files below `Finance`; only the folders show, and the files are one more click away.
3. Click the `Bank statements` row (or tree entry) → `Mercury statement 2026-09.pdf` listed.
4. Click the row → The preview opens on the right with Folder `Finance / Bank statements`; click "Download" → the browser saves the PDF; it is never opened in the page.

##### Variations
- Narrower than 800 px: no tree; a pill with a folder icon and the current folder's name opens a radio menu of full paths such as "Finance / Bank statements".
- Folders cannot be collapsed; every level is always shown.

##### Edge Cases
- Open folder holds nothing → text "This folder is empty. Drop files here to add them." (`DataRoom.tsx:411-417`).

#### STORY-DRM-012: Switch to grid and change the sort

> **Updated 2026-10-20**: the view switch now has List, Grid and Stats (STORY-DRM-114).

**Type**: short
**Topic**: Views and sort
**Persona**: Maya, who thinks visually and wants the newest-dated contracts first.
**Goal**: See documents as tiles ordered by document date.
**Preconditions**: S1. On main.
**Ideal path**: 2 — choose grid, choose date sort.
**Alternate paths**: none found.

##### Steps
1. Click the grid icon (aria "Grid view") → Tiles with the name, and a type or status line. File tiles and folder tiles have the same height.
2. Open "Sort: Recently added" → Options Date, Name, Type, Recently added. Date and Type are listed only when at least one item has a date or type. **Misread risk:** "Date" is the date written in the document, not the upload date; items without one come last in both directions.
3. Choose "Date", then press the arrow button (aria "Descending" / "Ascending") → The order flips. Name and Type start A to Z, Date and Recently added newest first.
4. Reload the page → Grid view and the chosen sort are still there (`lib/data-room.ts:21-43`, `DataRoom.tsx:114`). **Surprise (good):** the choice is remembered in this browser only.

##### Edge Cases
- Browser storage blocked (private window) → the choice lasts only until the page closes; no message.

#### STORY-DRM-013: Search for the lease

**Type**: short
**Topic**: Search
**Persona**: Maya on a call with the landlord who needs the renewal terms now.
**Goal**: Find the lease by typing.
**Preconditions**: S1; M1 (keyword) or M2 + consent (semantic). On main.
**Ideal path**: 1 — type "lease", see it.
**Alternate paths**: Browse `Legal / Contracts`; Party filter; sidebar search (STORY-DRM-035).

##### Steps
1. Type "lease" in the box "Search names and text" → After about 300 ms the list becomes results; each result shows the name, "Legal / Contracts · Upload" and a text snippet with the matched words highlighted. The grid/list toggle no longer changes anything.
2. Look at the sort pill → It reads "Sort: Relevance" with options Relevance and Date; no direction arrow for Relevance.
3. Try a question: "when does our office lease end" → Keyword search may find nothing; the grey help line reads "Search matches words in names and text. Try fewer words." (a longer phrase) or just the first sentence (a single word). With M2 and consent the semantic search can still find it. Nothing tells her which mode is active.
4. Press Escape or the X inside the box → The box clears at once and the list returns with the earlier sort.

##### Edge Cases
- No match → "No results" plus the help line; if a filter is set a "Clear filters" button also shows.

#### STORY-DRM-014: Show all invoices from one vendor

**Type**: medium
**Topic**: Facet filters
**Persona**: Maya reconciling hardware spend with MOCK Acme Servo Supply.
**Goal**: List every Acme invoice.
**Preconditions**: S1 (two Acme invoices, classified). On main.
**Ideal path**: 2 — pick type "invoice", pick vendor.
**Alternate paths**: Folder `Finance / Invoices`; search "Acme".

##### Steps
1. Look at the filter row → Pills "Type", "Party", "Document date", and "Source" (each with a down chevron) plus "Sort: Recently added". Type, Party and the date pill show only because some rows have those values.
2. Click "Type" → A menu of the types on screen (lowercase words such as `invoice`, `contract`, `statement`). **Hesitation:** the words look like database values, and the list only contains what is loaded, so on a long library a type that sits on a later page is not offered (see Suspected problems).
3. Pick `invoice` → The pill reads "Type: invoice" with an X ("Remove filter Type"); the list narrows to the invoices.
4. Click "Party" → A menu of every full party name on screen, for example "MOCK Acme Servo Supply". Pick it → two Acme invoices remain.
5. Click the X on a pill to remove it, or open the folder `Finance / Invoices` to see the same result by browsing.

##### Variations
- "Source" menu lists Upload, Google Drive, Gmail, Chat, Finance. On main, only Upload has items: choosing Gmail gives "No results" and a "Clear filters" button. With PR #109 Gmail and Drive items exist (STORY-DRM-020, 021).

##### Edge Cases
- Setting a filter while a folder is open keeps the folder; "Clear filters" clears everything except the folder.

#### STORY-DRM-015: Contracts from last quarter

**Type**: medium
**Topic**: Date filter
**Persona**: Maya preparing a quarterly update.
**Goal**: See contracts dated July to September 2026.
**Preconditions**: S1 + S3 (some items with no document date). On main.
**Ideal path**: 3 — pick type, set the date range, done.
**Alternate paths**: Sort by Date and scan.

##### Steps
1. Click "Document date" → A popover with two date boxes (From, To) and "Apply".
2. Set 2026-07-01 to 2026-09-30, Apply → The pill reads "Jul 1, 2026 – Sep 30, 2026" with an X.
3. Open "Type" and pick `contract` → Only contracts with a document date in range.
4. Notice an unclassified contract is missing → items with no document date are excluded. The pill name "Document date" now says what the date is, so she may read it correctly.
5. Clear the range with the X on the pill.

##### Edge Cases
- Only "From" set → the pill reads "Oct 1, 2026 – …".
- The "Document date" pill is hidden entirely when no loaded row has a date and none is set.

### Stories: Editing and housekeeping

#### STORY-DRM-016: Rename a scan and move it to the right folder

**Type**: medium
**Topic**: Rename / Move
**Persona**: Maya cleaning up `Scan 0007.jpg`, which is the Delaware incorporation certificate.
**Goal**: Give it a real name and put it under `Legal`.
**Preconditions**: S1 + S2 (scan is `ready`). On main.
**Ideal path**: 3 — rename, move, confirm.
**Alternate paths**: The "…" on the row, in the preview header, or on a grid tile; all open the same dialogs.

##### Steps
1. Hover the row and click "…" (aria "More actions for Scan 0007.jpg") → menu Move, Rename, Delete.
2. Choose Rename → Dialog "Rename Scan 0007.jpg" with the name field selected; type `Delaware certificate of incorporation (MOCK).jpg`; Save.
3. Try a name with a slash, `Legal/Delaware cert` → red text "Enter a name without slashes". **Hesitation:** she tried to rename and move in one go.
4. "…" then Move → Dialog "Move <name> to" with a select: "No folder", then paths such as "Legal / Contracts", then "New folder…". Choose "Legal"; Save.
5. The preview updates: Folder "Legal"; in "All items" the row shows `Legal` under its name.

##### Variations
- Founder wants a new folder `Legal / Corporate` → Move, "New folder…", type `Corporate` (this creates a top-level folder; see STORY-DRM-033 for what that means).
- Rename dropping the extension is allowed; the download keeps the new name.

##### Edge Cases
- The item preview is open while she renames it from the list "…" → the preview updates its title (`DataRoom.tsx:499-501`).

#### STORY-DRM-017: Delete a duplicate document

**Type**: short
**Topic**: Delete
**Persona**: Maya sees two versions of the term sheet.
**Goal**: Remove the old one.
**Preconditions**: S1 plus an extra `Northwind - Series A term sheet v2.pdf` in `Investors`; the v3 preview is open. On main.
**Ideal path**: 2 — delete, confirm.
**Alternate paths**: Row "…", preview "…", grid tile "…".

##### Steps
1. "…" on the v2 row → Delete → Alert "Delete Northwind - Series A term sheet v2.pdf?" with "This can't be undone." and Cancel / Delete.
2. Press Delete → The dialog closes, the list reloads without the row, and a toast "Deleted" with the file name shows for 5 s.
3. Look for an undo or trash → None; the file and its text index are gone.

##### Variations
- Deleting the item shown in the preview on a wide page → the preview moves to the next row (or the one above) instead of closing; on a narrow page it closes (`DataRoom.tsx:492-497`).
- Delete from the failed file's red button in the preview.

##### Edge Cases
- Delete fails (offline) → red error text stays in the dialog and the button works again.

### Stories: Long end-to-end stories

#### STORY-DRM-018: First week: set up the company's document library

**Type**: long
**Topic**: Onboarding to the Data room, end to end
**Persona**: Maya, first session, with ~10 PDFs (incorporation docs, a SAFE, invoices, an offer letter) and a 60 MB video in a desktop folder.
**Goal**: Have every company document in one searchable place, sorted into folders.
**Preconditions**: S0; model M1; consent C0 (realistic first run); walker files listed above. On main.
**Ideal path**: 5 — open the room, click Allow, drop all files, see them sorted, search once.
**Alternate paths**: Upload through "Choose files", "+", page drop, drop anywhere.

##### Steps
1. Sign in; look for "Documents" in the sidebar → Finds "Data room" after scanning (STORY-DRM-001 hesitation).
2. Click it → The dashed box "Drop files here" and "Choose files". No card yet; the consent card shows only once the room is not empty.
3. Select all ten PDFs plus the video in Finder and drag them onto the box → Overlay "Drop to add to Data room"; drop.
4. Toasts stack at the lower right: eleven progress bars, including the video.
5. Toasts turn to "Uploaded" and disappear after 10 s → She believes everything is filed in folders. **Misread risk.**
6. The list shows ten rows, each with a spinner and "Reading", then plain rows with no Type or Date (no consent, so nothing was classified).
7. Above the list a card "Let Praci read your documents" with an Allow button explains the documents will be sent to a model provider. **Hesitation:** privacy of incorporation documents.
8. She clicks Allow → The card disappears; rows go back to "Reading".
9. After a minute, Type, Date and Parties fill in. In the tree, folders such as `Legal`, `Investors`, `Finance / Invoices` and `HR` appear that she did not create.
10. She clicks a row → The preview shows a summary, Tags, and the Folder.
11. She tries search "SAFE" → The SAFE is found with a highlighted snippet.
12. She finds `Scan 0007.jpg` in the wrong place → "…" Move, picks `Legal`.
13. She wants a new folder `Corporate docs` → In the Move dialog she chooses "New folder…" (STORY-DRM-033).
14. She switches to grid view and reloads the page next day → The grid view is remembered.
15. She bookmarks `Finance / Invoices` in the browser (STORY-DRM-024).
16. Outcome: all ten documents are stored, read, sorted and findable; the video was refused with no alternative.

##### Edge Cases
- One PDF is a scan with no text: with a vision-capable model and consent it is read; otherwise it is stored and cannot be found by its words.
- No model at all (M0): step 7 shows a grey note instead of a button (STORY-DRM-032) and nothing gets sorted.

#### STORY-DRM-019: Answer an investor's diligence request

**Type**: medium
**Topic**: Search, filters, download, sharing expectation
**Persona**: Maya in Series A diligence; MOCK Harbor Ventures asked for "all customer contracts, the cap table, last three bank statements, and board minutes".
**Goal**: Collect and send those documents.
**Preconditions**: S1 + S2 + three monthly statements (July to September) in `Finance / Bank statements`; model M2; consent C1. On main.
**Ideal path**: 6 — four searches or filters, select all, share one link.
**Alternate paths**: Folder browsing for each item; Type filter.

##### Steps
1. Open Data room → The list is shown, no preview open.
2. Open "Type" and pick `contract` → Contracts listed; she must download each from its preview ("Download"); no multi-select or bulk download.
3. Remove the pill; search "cap table" → `Old cap table export.xlsx` shows Failed. The preview has Delete and Download only. She downloads it anyway.
4. Clear the search; click the folder `Finance`, then the sub-folder row `Bank statements` → three statements. Sort "Date", descending; download each.
5. Search "board minutes" → `Board minutes Q2 2026.pdf` (no folder) found; download.
6. Look for "Share" or "Invite investor" → nothing (STORY-DRM-022). The words "Data room" set the expectation of an investor-facing room; the code is owner-only.
7. Attach the downloaded files to a message in the Inbox compose box (separate feature, limits there) and likely meet its size limit with statements plus contracts.
8. Outcome: completed outside the Data room, with many repeated downloads.

##### Edge Cases
- The investor asks for "everything from Harbor Ventures" → Party menu offers "MOCK Harbor Ventures" (full name); she picks it and gets the term sheet; others without a party name are missed.

### Stories: Importing from Gmail and Google Drive, and sharing

#### STORY-DRM-020: Monthly close: get vendor invoices out of Gmail into the Data room

> **Updated 2026-10-20**: the envelope button is gone. Import is now a menu in the header with Email, Google Drive and Box; the attachment chip in the Inbox also has 'Add to Data room', and new mail attachments can be filed automatically (STORY-DRM-119, STORY-INB-016, STORY-INB-115). The goal of this story is unchanged; the steps below describe the old button.

**Type**: medium
**Topic**: Email attachment import + filters
**Persona**: Maya doing month-end bookkeeping; invoices arrive as Gmail attachments.
**Goal**: Have this month's invoices in `Finance / Invoices` next to last month's.
**Preconditions**: S1; mock Gmail connected with thread "MOCK Acme Servo Supply – invoice NW-1044" (PDF attachment `invoice-1044.pdf`); M1; consent C1.
**Ideal path**: 3 — "Import from email", tick the attachment, Import.
**Alternate paths**: On current main (without the PR) there is no import button: download the attachment from the Inbox message and drop it on the app (the only route; Source "Gmail" never matches anything). Upload then Move. Tell an agent to add it (STORY-DRM-044).

##### Steps
1. Open Data room → In the header, beside the view toggles, two icon buttons: an envelope (aria "Import from email") and a hard-disk (aria "Import from Google Drive"), then "+". There is no visible text; she hovers and gets no tooltip. **Hesitation:** she does not know what the envelope does.
2. Click the envelope → A dialog "Import from email" with a search box "Search mail" and a list of mail that has attachments (subject bold, sender below).
3. Type "Acme" → After 300 ms the list narrows to the Acme thread.
4. Click the thread row → It expands and shows one line per attachment: a checkbox named `invoice-1044.pdf` and its size (for example "52 kB").
5. Tick the checkbox → The "Import" button becomes enabled (it is disabled while nothing is ticked).
6. Click "Import" → The dialog closes and a notice at the lower right reads "Imported 1 file" for 6 s; the list reloads.
7. The new row has a spinner and "Reading"; the preview shows Source "From email" as a link.
8. After reading, in "All items" it shows a folder path if the classifier filed it (consent C1), else no folder. She opens `Finance / Invoices` → three Acme invoices (or moves it there).
9. She opens "Document date" and picks 2026-10-01 to 2026-10-31 and Type `invoice` → only the new one.
10. Click "From email" in the preview → Opens the Inbox message the attachment came from (`/app/inbox?mail=<id>`).
11. She imports the same attachment again → Notice "Already in the Data room"; no new row.
12. Outcome: one attachment is in her library in a few clicks, without downloading it.

##### Variations
- Empty room (S0): the two import buttons are full-size next to "Choose files", labelled "Import from email" and "Import from Google Drive".
- Without Gmail connected: the envelope button reads "Connect Gmail" and goes to the integration page (STORY-DRM-041).

##### Edge Cases
- Import with the Source filter: after importing, "Source" lets her pick "Gmail" and see only imported mail files.
- On main without the PR: "Source: Gmail" returns "No results" and "Clear filters".

#### STORY-DRM-021: Bring in files from Google Drive

> **Updated 2026-10-20**: Drive import is now the Import menu item 'Google Drive' (whole Drive folders and multi-select are supported); see STORY-DRM-119. The steps below describe the old hard-disk button.

**Type**: medium
**Topic**: Google Drive import
**Persona**: Maya whose legal documents already live in Google Drive.
**Goal**: Copy the customer contract and the quarterly plan from Drive into the Data room.
**Preconditions**: S1; Google Drive connected; Drive has a folder `Contracts` with `MOCK Customer MSA - Bolt Freight.pdf` and a Google Doc `Quarterly plan`.
**Ideal path**: 3 — open the picker, tick two files, Import.
**Alternate paths**: On main without the PR there is no Drive import: download from Drive and upload by hand (STORY-DRM-002). Agents can read Drive with `drive_search`/`drive_read` but results never enter the Data room unless the agent calls `add_to_data_room` (STORY-DRM-044, also needs the PR).

##### Steps
1. Click the hard-disk button (aria "Import from Google Drive") → Dialog "Import from Google Drive" with a "Search Drive" box and the top level of My Drive: folders (with a folder icon) and files (with checkboxes).
2. Click the folder `Contracts` → The list shows that folder's files and a back arrow (aria "Back") appears beside the search box.
3. Tick `MOCK Customer MSA - Bolt Freight.pdf` → "Import" becomes enabled.
4. Click back, tick the Google Doc `Quarterly plan` → Google Docs, Sheets, Slides and Drawings can be ticked (Drive converts them to PDF).
5. Click "Import" → Dialog closes, notice "Imported 2 files", list reloads, two rows "Reading".
6. Open one row → Source shows "From Google Drive" as a link that opens the file in Drive in a new tab.
7. Outcome: both documents are copied (not synced). If she edits the Drive copy later, the Data room copy does not change.

##### Variations
- Type in the search box → searches all of Drive (the back arrow hides while a search is active).

##### Edge Cases
- Repeat import of the same Drive file → notice "Already in the Data room".

#### STORY-DRM-022: Share the Data room with a cofounder

**Type**: short
**Topic**: Sharing (gap on both branches)
**Persona**: Maya whose cofounder "MOCK Sam Okafor" joined the space and needs the same documents.
**Goal**: Let the cofounder see the documents.
**Preconditions**: S1; a second member in the same space. Checked: no share control or share API exists on main or on `origin/feat/legal` (`f2b8fc1e`).
**Ideal path**: 2 — share a folder, pick a member.
**Alternate paths**: none found.

##### Steps
1. Look for "Share" in the preview, in the "…" menu (Move, Rename, Delete), the sub-folder menus and the filter bar → none.
2. The cofounder signs in and opens the Data room → sees their own, empty Data room; items are visible only to the person who added them.
3. Outcome: Maya downloads each file and sends it.

##### Edge Cases
- With PR #109 a Gmail-imported file has a "From email" link that opens the Inbox message; that message is Maya's own mail, so Sam cannot follow it.

#### STORY-DRM-023: Ask a chat agent about a contract

**Type**: medium
**Topic**: Agent tools over documents
**Persona**: Maya wants a quick answer: "What's the notice period in our office lease?"
**Goal**: Get the answer from the stored lease without reading it herself.
**Preconditions**: S1; M2; consent C1; a chat agent in her own space, run by her (not a group chat, not a messaging-channel run).
**Ideal path**: 1 — ask the agent in plain words.
**Alternate paths**: On main without the PR the agent has no Data room tools: it says it cannot see the document, and Maya attaches the PDF in the chat (a separate copy). Data room search with a question (STORY-DRM-013). Download and read.

##### Steps
1. Open the lease preview and look for "Ask" or "Chat about this" → none (the planned "Ask agent" button is not built on either branch).
2. Open a chat with an agent and type "What's the notice period in our office lease?" → The agent calls `search_data_room` with the query (up to 20 results, name, type, date, snippet), then `read_data_room_item` for the lease (summary, parties, tags and up to 100,000 characters of text).
3. The agent answers from the lease text and names the file. **Hesitation:** Maya never saw the agent "open" her Data room; no approval was asked because both tools are read-only.
4. She checks the Data room → nothing changed.

##### Variations
- Consent C0: `search_data_room` still works over what is stored, but `add_to_data_room` answers that the Data room is off (STORY-DRM-044).
- Items imported through a mail or Drive connection that Maya denied to that agent are hidden from the agent's search and read.

##### Edge Cases
- A long lease → the answer notes the text was truncated at 100,000 characters.
- A file still "Reading" → the tool says no text has been extracted yet.

### Stories: Folders in the URL

#### STORY-DRM-024: Bookmark a folder and open it again

> **Updated 2026-10-20**: the page now has a path bar and a resizable folder column (STORY-DRM-111, STORY-DRM-112); bookmarks and the Back button are unchanged.

**Type**: short
**Topic**: Folder in the URL (deep link)
**Persona**: Maya, who sends her accountant a link to the invoices.
**Goal**: Open `Finance / Invoices` straight from a link.
**Preconditions**: S1 + S5. On main.
**Ideal path**: 1 — paste the link.
**Alternate paths**: Click through the tree.

##### Steps
1. Click `Finance`, then `Invoices` in the tree → The address bar shows `/app/data-room?folder=<id>`.
2. Copy the URL, open it in a new tab (already signed in) → The Data room opens with `Invoices` highlighted in the tree and only the two Acme invoices listed. No preview is open.
3. Reload the tab → Same folder.
4. Press the browser Back button → The previous folder or "All items".

##### Variations
- On a phone width the folder pill shows `Invoices`; its title attribute holds the full path.
- A signed-out person opening the link is sent to sign in first; after sign-in the folder id is kept only if the app returns to the same URL (not verified).

##### Edge Cases
- The link is opened by another member: they see their own library; the folder id does not belong to them, so it is removed from the URL (STORY-DRM-026).

#### STORY-DRM-025: Back button through folders

> **Updated 2026-10-20**: the path bar adds another way to move up (STORY-DRM-111).

**Type**: short
**Topic**: Folder in the URL (history)
**Persona**: Maya who clicks folders like web pages and presses Back.
**Goal**: Return to the folder she was in before.
**Preconditions**: S1 + S5. On main.
**Ideal path**: 1 — Back.
**Alternate paths**: Click "All items".

##### Steps
1. Click `Legal`, then `Contracts` → Each click is a history entry.
2. Press Back → `Legal` is shown; the tree highlight and the list follow the URL.
3. Press Back again → "All items".
4. Press Forward → `Legal` again.

##### Variations
- A folder opened by a sub-folder row works the same.
- Filters (Type, Party, Source, Document date) and the search text are not in the URL: Back does not undo them (`DataRoom.tsx:83-85`).

##### Edge Cases
- Opening a file through a toast's "View" replaces the folder entry instead of adding one (`setFilters(..., true)`), so Back skips that step.

#### STORY-DRM-026: A stale or mistyped folder id

> **Updated 2026-10-20**: the page now has a path bar (STORY-DRM-111); re-read what a stale folder id shows.

**Type**: short
**Topic**: Folder in the URL (bad id)
**Persona**: Maya who clicks an old bookmark to a folder that no longer exists.
**Goal**: See her documents anyway.
**Preconditions**: S1; URL `/app/data-room?folder=deadbeef`. On main.
**Ideal path**: 1 — page opens on "All items".
**Alternate paths**: none found.

##### Steps
1. Open the URL → For a moment the list may read "This folder is empty. Drop files here to add them." (the list asks for a folder that does not exist).
2. The folder list loads → The `folder` parameter is removed from the URL without a new history entry; "All items" is selected and the full list loads (`DataRoom.tsx:122-141`).
3. Nothing says the bookmark was out of date. **Hesitation:** she wonders whether the folder was deleted.

##### Edge Cases
- If the folder list request itself fails, the bad id stays in the URL and the page keeps showing "This folder is empty…" (the catch is silent).
- An empty room with a bad folder id → after the id is removed the first-run box shows.

#### STORY-DRM-027: Rename, move and delete folders

> **Updated 2026-10-20**: folder and file rename, move and delete are re-walked with the tree and menus in the folded-in section below.

> **Updated 2026-10-20**: detail added from a newer walk of the same goal, see the section "Added 2026-10-20" at the end of this story.

**Type**: medium
**Topic**: Folder housekeeping
**Persona**: Maya tidying a messy tree: top-level `Archive` (empty), top-level `Old drafts` (empty) with `2025` inside, and the classifier's `Finance / Vendor bills`.
**Goal**: Rename `Vendor bills` to `Supplier bills`, move it under `Legal`, delete `2025`, and delete the top-level `Old drafts` and `Archive`.
**Preconditions**: S1 + S5 with `Old drafts`, `2025`, `Archive` and `Finance / Vendor bills`. On main.
**Ideal path**: 3 — open the parent, use each folder's "…" menu.
**Alternate paths**: none found for top-level folders (see step 5).

##### Steps
1. In the tree, hover or right-click `Vendor bills` → nothing; tree entries have no menu. **Hesitation:** she looks for "Rename" and finds none.
2. Click `Finance` → Folder rows `Bank statements`, `Invoices`, `Vendor bills` appear above the files, each with "…" (aria "More actions for Vendor bills").
3. "…" then Rename on `Vendor bills` → dialog "Rename Vendor bills", type `Supplier bills`, Save → the row and the tree update.
4. "…" then Move → dialog "Move Supplier bills to" with "Top level" and every folder except itself and its descendants; choose `Legal`, Save. Then open `Old drafts`, "…" then Delete on `2025` → "Delete the folder 2025?" with "Only an empty folder can be deleted. This can't be undone." → Delete.
5. She tries to delete `Old drafts` and `Archive` themselves → only the sub-folders of the open folder get rows (`DataRoom.tsx:149-155`), and top-level folders have no parent to open, so these two folders have no "…" menu anywhere. She cannot rename, move or delete a top-level folder (see Suspected problems).
6. She tries to delete a folder that still holds files (`Legal` after the move) → not reachable either; for a nested one, red text "Move or delete what is in this folder first."

##### Variations
- Grid view: sub-folders are tiles above the file tiles, with the "…" at the top right.

##### Edge Cases
- Renaming or moving the folder that is currently open keeps the URL (same id).

##### Added 2026-10-20: Rename, move and delete from menus and tree

**Type**: medium
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya tidying folders by hand.
**Goal**: Rename a folder, move a file into it, delete an empty folder, and learn why a full one is refused.
**Preconditions**: Folder "Misc" containing one file; empty folder "Old"; file "scan0012.pdf" at top level.
**Ideal path**: 3 per action — menu, dialog, confirm.
**Alternate paths**: Right-click on a folder in the tree; context-menu key or Shift+F10; "…" in the tree row (shown on hover or focus).
###### Steps
1. Right-click folder "Misc" in the tree → menu "Move", "Rename", "Delete".
2. Choose "Rename" → dialog "Rename Misc" with the name field; type "Reference" and "Save" → toast "Renamed" with the new name; tree and Path bar update.
3. Click "More actions for scan0012.pdf" → "Move" → dialog "Move scan0012.pdf to" with a "Folder" select ("No folder", folders by path, "New folder…").
4. Pick "Reference" and Save → file leaves All items top level; if she is viewing "All items" it still shows with its Folder path.
5. Open the menu for "Reference" → "Delete" → dialog "The folder Reference isn't empty" explaining "It holds 2 items. Move or delete what is in it first; only an empty folder can be deleted." Buttons "Cancel" and "Open folder".
6. Click "Open folder" → the folder opens so she can clear it.
7. Delete the empty "Old" folder → "Delete the folder Old?" "This can't be undone." Click "Delete" → toast "Deleted" with "Old".
###### Variations
- Choose "New folder…" in the Move dialog → extra field "New folder name" and "Inside" select; the new folder is created and the file moved in one step.
- Delete a file that backs a Legal contract → description adds "This also removes the Legal contract <title> ... and its links in the Legal graph. This can't be undone."
- Delete the previewed file → the pane shows its neighbour; the last item closes the pane.
- Delete the open folder → the parent opens.
###### Edge Cases
- Name containing a slash → "Enter a name without slashes".
- Move into itself or a child → blocked options in the select (UNVERIFIED how they are shown).
- Server conflict on a non-empty folder → "Move or delete what is in this folder first."

---

#### STORY-DRM-028: A folder is deleted in another tab while it is open

> **Updated 2026-10-20**: the resizable tree and path bar changed the folder display; re-read (STORY-DRM-111).

**Type**: short
**Topic**: Folder in the URL (deleted elsewhere)
**Persona**: Maya with two tabs open on the Data room.
**Goal**: Keep working after the folder she is looking at disappears.
**Preconditions**: S1 + S5 with an empty folder `Archive`; the same Data room open in two tabs, both on `Archive`. On main.
**Ideal path**: 1 — the page recovers by itself.
**Alternate paths**: Reload.

##### Steps
1. In tab A, open the parent and delete `Archive` (it is empty) → "Deleted" toast.
2. In tab B (still on `Archive`) drop a file → Toast "Upload failed" because the folder is gone (404).
3. In tab B, rename or move something → the folder list reloads, the missing id is removed from the URL, and the page shows "All items".
4. In tab B, wait without doing anything → Nothing happens; the page does not poll folders.

##### Edge Cases
- Pressing Back in tab B after the id was removed goes to the previous entry, which may be a folder that no longer exists, repeating step 2 of STORY-DRM-026.

#### STORY-DRM-029: Open a document from a link or toast

> **Updated 2026-10-20**: the preview header now has icons 'Open in new tab', 'Download', 'Full screen' and 'Close preview' (STORY-DRM-115).

**Type**: short
**Topic**: `?item=` deep link
**Persona**: Maya who clicks "View" in an upload toast, or follows a link from the sidebar search.
**Goal**: See that exact document.
**Preconditions**: S1. On main.
**Ideal path**: 1 — click "View".
**Alternate paths**: Sidebar search result (STORY-DRM-035).

##### Steps
1. Upload a file into `Investors` and click "View" in the toast → URL `/app/data-room?item=<id>&folder=<id>`: the folder `Investors` is selected and the file is open in the preview.
2. Click another folder → The `item` stays in the URL, the preview closes if the file is not in the new list.
3. Open `/app/data-room?item=nonexistent` → The Data room opens normally in "All items" with no preview and no message (`DataRoom.tsx:197-209`, the failure is swallowed). **Hesitation:** she thinks the link was broken.

##### Edge Cases
- An item beyond the first 50 in the list is still shown, because it is read by id.
- On a narrow page the preview opens as a dialog.

### Stories: Working on a phone and by keyboard

#### STORY-DRM-030: Use the Data room on a phone

**Type**: medium
**Topic**: Phone width
**Persona**: Maya on her phone in a taxi, who needs the lease.
**Goal**: Find the lease and download it.
**Preconditions**: S1; viewport about 390 px wide. On main.
**Ideal path**: 3 — search, tap, download.
**Alternate paths**: Folder pill.

##### Steps
1. Open Data room from the menu button → The title, the view toggles and "+" are on the first line.
2. Look under it → The search box is alone on its own line; below it one row that scrolls sideways: a folder pill ("All items"), the filters that have values, then "Sort: Recently added" at the right end (`FilterBar.tsx:217`). **Hesitation:** she does not realise the row scrolls.
3. Type "lease" → The list becomes results; the folder pill and Sort stay.
4. Tap a result → The preview opens as a dialog titled "Preview" with the file name, facets and Download (`DataRoom.tsx:471-482`). The "…" menu is inside it; there is no separate close X (the dialog's own close).
5. Tap Download → The file is saved. Press Escape or the dialog close → focus returns to the tapped row.
6. Tap the folder pill → A radio menu with full paths, such as "Legal / Contracts"; the pill itself shows only the last name.

##### Variations
- Between 560 and 800 px the preview sits beside the list but the tree is replaced by the pill.
- Toasts are centred with a 16 px gutter on a phone.

##### Edge Cases
- Widening the window while the dialog is open closes it (`DataRoom.tsx:187-189`).
- Tapping a row never opens the dialog from keyboard focus alone (`DataRoom.tsx:254`).

#### STORY-DRM-031: Keyboard only

**Type**: medium
**Topic**: Keyboard
**Persona**: Maya, who prefers the keyboard.
**Goal**: Find and download a statement without the mouse.
**Preconditions**: S1; desktop width. On main.
**Ideal path**: 2.
**Alternate paths**: none found.

##### Steps
1. Tab to the folder tree → "All items" is focused. Press Down Arrow twice → focus moves through folders; press Enter on `Bank statements` → that folder opens (URL updates).
2. Tab to the first row → Down and Up arrows move between rows and open the row in the preview as focus moves (`ItemRows.tsx:44-61`).
3. Press Enter or Space on a row → toggles the preview open or closed; pressing it on the shown row closes it.
4. Tab through the preview → "…" menu, Close preview, Download. Press Enter on Download.
5. Press Escape in the search box with text → clears it.

##### Edge Cases
- Right Arrow does not expand or collapse folders (there is no collapse).
- In the phone dialog, Escape closes it and puts focus back on the row.

### Stories: Consent without a model, new folder, hide amounts, search surfaces

#### STORY-DRM-032: No model is set up: the grey note

**Type**: short
**Topic**: Consent card (no recipients)
**Persona**: Maya, who skipped model setup.
**Goal**: Understand why files are not sorted.
**Preconditions**: S3; model M0; consent C0. On main.
**Ideal path**: 1 — read one clear sentence.
**Alternate paths**: none found.

##### Steps
1. Open Data room → A grey card (no button): "You can search documents by name and text and move them into folders yourself. Set up a model in Settings to have new files tagged and sorted into folders for you."
2. She looks for a link to Settings → The sentence is plain text; no link or button. **Hesitation:** "model" means nothing to her.
3. Outcome: she keeps the files unsorted or moves them by hand.

##### Edge Cases
- Setting a model in Settings and returning: the card becomes the Allow card after a reload (the status is read once per page visit).

#### STORY-DRM-033: Make a new folder while moving a file

**Type**: short
**Topic**: Move dialog, "New folder…"
**Persona**: Maya organising the SAFE and an advisor agreement.
**Goal**: Put both in a folder called `Advisors` that does not exist.
**Preconditions**: S1. On main.
**Ideal path**: 2 — Move, New folder…, name, Save.
**Alternate paths**: none found.

##### Steps
1. "…" → Move on the SAFE → Dialog "Move <name> to".
2. Choose "New folder…" at the end of the select → A text field "New folder name" appears and is focused.
3. Type `Advisors` and Save → The folder is created at the top level and the file moves into it. The tree shows `Advisors`.
4. Move the second file → `Advisors` is now in the select.

##### Variations
- A name with a slash → "Enter a folder name without slashes". She wanted `Legal / Advisors` and cannot create a nested folder this way: "New folder…" always creates a top-level folder (`ItemDialogs.tsx:146-151`).

##### Edge Cases
- The folder is created, then the move fails → the empty folder stays behind (two separate calls).

#### STORY-DRM-034: Hide amounts on documents

**Type**: short
**Topic**: Hide amounts
**Persona**: Maya sharing her screen on a call.
**Goal**: Keep invoice amounts off the screen.
**Preconditions**: S1; the "Hide amounts" preference turned on elsewhere in the app. On main.
**Ideal path**: 1.
**Alternate paths**: none found.

##### Steps
1. Open `Invoice NW-1042 Acme Servo Supply.pdf` → The preview Amount reads "$•••" instead of $18,750.00; dollar amounts in the summary are masked too.
2. Open a scanned image (png/jpg) → Instead of the picture: "Image hidden while amounts are hidden".
3. Turn the preference off → The amount and the picture return without reloading.

##### Edge Cases
- Amounts are not in the list columns, so the list needs no masking.
- The file name, if it contains an amount, is still shown.

#### STORY-DRM-035: Find a file from the sidebar search

**Type**: short
**Topic**: Sidebar search to Data room
**Persona**: Maya who uses the sidebar search for everything.
**Goal**: Jump to the lease from anywhere.
**Preconditions**: S1. On main.
**Ideal path**: 2.
**Alternate paths**: Data room page search.

##### Steps
1. Type "lease" in the sidebar search → A group of documents appears (up to 5) next to messages and pages.
2. Click `Northwind HQ lease renewal 2027.pdf` → The Data room opens at `?item=<id>` with the lease in the preview and its folder selected.

##### Edge Cases
- If the Data room search fails, the group is silently omitted (`Shell.tsx:1838-1840`).

#### STORY-DRM-036: Search while a folder is open

> **Updated 2026-10-20**: detail added from a newer walk of the same goal, see the section "Added 2026-10-20" at the end of this story.

**Type**: short
**Topic**: Search + folder
**Persona**: Maya who opened `Investors` and then searched "lease".
**Goal**: Find the lease.
**Preconditions**: S1. On main.
**Ideal path**: 1 — search finds it wherever it is.
**Alternate paths**: Click "All items" first.

##### Steps
1. Open `Investors`, type "lease" → "No results". The folder is still applied to the search (`filters.folderId` is sent). **Hesitation:** she assumes search covers everything.
2. Nothing on screen says the search is limited to the folder except the highlighted tree entry (or the pill on a phone).
3. Click "All items" → The lease appears.

##### Edge Cases
- Result rows show "folder · source" but sub-folder rows are hidden during a search.

##### Added 2026-10-20: Search inside a folder, then widen to all items

**Type**: medium
**Topic**: data-room-navigate-inspect-organize
**Persona**: A solo technical founder looking for a clause.
**Goal**: Find "indemnification" in Legal, then check the whole room.
**Preconditions**: Text-indexed files in Legal and Finance; one file in Finance also contains the word.
**Ideal path**: 3 — open folder, type, click "Search all items" if needed.
**Alternate paths**: Filter pills; Data room agent.
###### Steps
1. Open "Legal" → file list.
2. Click "Search documents" (placeholder "Search names and text") and type "indemnification" → after a short pause the list changes to matching rows with highlighted snippets; a line "Searching in Legal" appears with a "Search all items" link; sub-folder rows are hidden while searching and the grid view falls back to the list.
3. Sort control now offers "Relevance" and "Document date".
4. Click the first result → pane opens; if the result set changes and drops the file, the pane closes rather than picking another.
5. Click "Search all items" → folder filter clears; results now include the Finance file with Source in its row.
6. Clear the search box → list returns at once (no wait), with the previous sort.
###### Variations
- Add a Type pill filter while searching; pills show only values present in the open folder given other filters (no combination that yields nothing).
- Click the "x" on a pill ("Remove filter Type") to clear it.
###### Edge Cases
- No match → "No results", "Search looks for these words in names and text.", and "Clear filters" when a filter is on.
- List request fails → red error with "Retry".
- Large result sets show "Load more".

#### STORY-DRM-037: A library with many documents

> **Updated 2026-10-20**: large libraries now show a processing strip, 'Load more', and thumbnails in Grid view (STORY-DRM-111, STORY-DRM-102).

**Type**: medium
**Topic**: Load more, list errors
**Persona**: Maya whose library has grown to more than 60 files.
**Goal**: See older documents, and recover from a failed load.
**Preconditions**: S4. On main.
**Ideal path**: 2.
**Alternate paths**: Search.

##### Steps
1. Open Data room → The first 50 files load; below them a "Load more" button.
2. Click "Load more" → The next page is added; the button disables while it loads.
3. While loading the first page, a skeleton of four grey bars shows.
4. Go offline and press "Load more" → A red error line with "Retry" appears above the list.
5. Reconnect and press "Retry" → The list reloads from the top.

##### Variations
- Search results load 20 at a time.
- The Type and Party menus list only what has been loaded so far.

##### Edge Cases
- A search whose paging cursor no longer fits restarts quietly (`use-data-room-list.ts:143-150`).

#### STORY-DRM-038: Grid view with sub-folder tiles

> **Updated 2026-10-20**: Grid view now shows thumbnails of documents (STORY-DRM-111, STORY-DRM-116).

**Type**: short
**Topic**: Grid + folders
**Persona**: Maya who prefers tiles.
**Goal**: Move through `Finance` in grid view.
**Preconditions**: S1; grid view. On main.
**Ideal path**: 2.
**Alternate paths**: List view.

##### Steps
1. Click `Finance` → Two folder tiles `Bank statements` and `Invoices` (label "Folder") above any file tiles.
2. Click the `Invoices` tile → The folder opens (URL updates).
3. Use the tile's "…" → Move / Rename / Delete (STORY-DRM-027).

##### Edge Cases
- A folder with no files and no sub-folders → "This folder is empty. Drop files here to add them."

### Stories: Import edge cases and agents (steps use the earlier import buttons; see the dated notes)

#### STORY-DRM-039: The email picker has problems

> **Updated 2026-10-20**: the email picker is now the Email item in the Import menu; the error texts and the 20-file cap below were not re-read (STORY-DRM-119).

**Type**: medium
**Topic**: Email import errors and limits
**Persona**: Maya importing attachments when mail is not perfect.
**Goal**: Import what she can and understand what failed.
**Preconditions**: S1; Gmail connected with threads: one with a PDF, one with only a 4 kB logo and a calendar invite, one account needing reconnect.
**Ideal path**: 3.
**Alternate paths**: Download and upload.

##### Steps
1. Click the envelope → Dialog "Import from email"; mail with attachments is listed.
2. Open the thread with the logo → Its files are listed; she can tick them (the dialog does not filter out logos). Tick the logo and press Import → That file is stored, but agents skip such files; she sees "Imported 1 file" (it is her choice here).
3. Open a thread with no usable attachments → "No files found".
4. Tick 20 files across threads → All other checkboxes become disabled (cap of 20).
5. If one account needs reconnecting and nothing else loads → Red text "Couldn't load mail" (or the specific reason) and a "Reconnect" link to the Gmail integration page.
6. An import where one of three fails → The dialog stays open with "Couldn't import 1 file" and the successful files are already in the list.

##### Edge Cases
- Search box empty and no mail with attachments → "No files found".
- Closing the dialog loses the ticks.

#### STORY-DRM-040: Browse Drive and meet unsupported files

> **Updated 2026-10-20**: browsing Drive now starts from the Import menu; the unsupported-file notes below were not re-read (STORY-DRM-119).

**Type**: medium
**Topic**: Drive picker behaviour
**Persona**: Maya hunting for a contract in a big Drive.
**Goal**: Find and import it, and understand why some files cannot be ticked.
**Preconditions**: Drive connected; Drive has a Google Form `Customer survey`, a large video, and a Google Doc.
**Ideal path**: 3.
**Alternate paths**: Search.

##### Steps
1. Open the Drive dialog and open two folders deep → The back arrow goes up one level at a time.
2. Look at `Customer survey` (a Google Form) → Its checkbox is disabled with no explanation (`ImportFromDrive.tsx:44-47`). **Hesitation:** she wonders why this file is locked.
3. Tick a Google Doc → Allowed (becomes a PDF).
4. Tick the large video → It is queued like any other file; there is no size limit.
5. Tick 20 files → The rest become disabled.
6. Type in "Search Drive" → Results across Drive; the back arrow hides.

##### Edge Cases
- If more than one Drive account is connected the first one is used; she cannot choose.
- Drive account needs reconnecting → the dialog shows the error text from the server.

#### STORY-DRM-041: Connect Gmail or Drive first

> **Retired 2026-10-20**: the 'Connect Gmail' and 'Connect Google Drive' buttons were replaced by the Import menu, which sends an unconnected source to its connect page. See STORY-DRM-119.

**Type**: short
**Topic**: Import buttons when not connected
**Persona**: Maya who has not connected Google.
**Goal**: Import her mail attachments.
**Preconditions**: No Gmail or Drive connection.
**Ideal path**: 2.
**Alternate paths**: none found.

##### Steps
1. Open the empty Data room → Buttons "Choose files", "Connect Gmail", "Connect Google Drive".
2. Click "Connect Gmail" → The integration page `/app/integrations/app/google/gmail` opens.
3. Connect, return to the Data room → The button now reads "Import from email" (the connection list is read when the page opens).

##### Edge Cases
- The buttons appear only after the connection list loads; before that, neither shows (the page seems to gain buttons).
- The connections request fails → both read "Connect …" even if she is connected.

#### STORY-DRM-042: Source links on imported files

> **Updated 2026-10-20**: imported files show Source 'From email' or 'From Google Drive' in the preview pane; the repeat-import notice was not re-read (STORY-DRM-119).

**Type**: short
**Topic**: Preview source link
**Persona**: Maya who wants to see where a file came from.
**Goal**: Open the original email or Drive file.
**Preconditions**: One imported mail file and one imported Drive file.
**Ideal path**: 1.
**Alternate paths**: none found.

##### Steps
1. Open the imported invoice → Source reads "From email" as a link.
2. Click it → She lands on the original message in the Inbox.
3. Open the Drive file → Source reads "From Google Drive"; clicking opens Drive in a new tab.
4. Open an uploaded file → Source is plain "Upload".

##### Edge Cases
- Sharing a file's link with another member: the Inbox link opens Maya's own mail and will not work for them.

#### STORY-DRM-043: Import into the folder she has open

> **Updated 2026-10-20**: importing into the open folder now starts from the Import menu (STORY-DRM-119).

**Type**: short
**Topic**: Import destination
**Persona**: Maya has `Finance / Invoices` open.
**Goal**: The imported invoice lands there.
**Preconditions**: S1; Gmail connected.
**Ideal path**: 2.
**Alternate paths**: Move afterwards.

##### Steps
1. Open `Invoices`, click the envelope, import `invoice-1044.pdf` → The import carries the open folder (`ImportSources folderId={filters.folderId}`).
2. The list reloads → The new invoice is in `Invoices`.
3. From the empty first-run box the destination is always the root.

##### Edge Cases
- The open folder was deleted elsewhere → the server answers 404 and the dialog shows an error.

#### STORY-DRM-044: An agent files an attachment on its own

> **Updated 2026-10-20**: the agent can still file an attachment, and Praci now also files new mail attachments by itself when 'Add email attachments to the Data room' is on (STORY-INB-114, STORY-INB-115, STORY-INB-116).

**Type**: medium
**Topic**: `add_to_data_room`
**Persona**: Maya whose Inbox agent reads her mail.
**Goal**: Have invoices filed without asking.
**Preconditions**: S1; consent C1 (and C0 for the variation); the Inbox agent runs on her mail with the Acme thread.
**Ideal path**: 1.
**Alternate paths**: Manual import (STORY-DRM-020).

##### Steps
1. The Inbox agent reads the Acme thread → Its instructions tell it to add documents it finds without being asked (`DATA_ROOM_GUIDANCE`). It calls `add_to_data_room` with the message and attachment ids; no approval card appears.
2. The agent reports "Added invoice-1044.pdf to the Data room."
3. Maya opens the Data room → A new row, source Gmail ("From email"), with no folder; reading and filing follow the consent state.
4. The same email's 4 kB logo → the tool answers "Not a document." and nothing is added.
5. Running the tool a second time → "… is already in the Data room."

##### Variations
- Consent C0 → the tool answers "The Data room is off for this person." and nothing is stored; the agent is told to mention it at most once.

##### Edge Cases
- The tool is not offered in group chats or messaging-channel runs.
- Items from a connection Maya denied the agent stay hidden from it.

### Gaps & Recommendations
- Sharing (STORY-DRM-022), the "Ask agent" button, the Data room agent and its side panel, undo or trash, retry of a failed file, folder menus in the tree, bulk download and a nested "New folder…" are not built on either branch.
- Re-run the PR #109 stories once it merges; on current main the import buttons and agent tools do not exist.
- Unverified in code: what a signed-out visitor sees when opening a `?folder=` link (STORY-DRM-024), and the exact copy of the Hide-amounts toggle.

### Stories: Added 2026-10-20, Data room: big uploads, zips and processing

#### STORY-DRM-101: Upload a zip of diligence documents and follow the card line by line

**Type**: medium
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics, handed a "Series A diligence.zip" (about 340 files, 1.2 GB) by her lawyer
**Goal**: Unpack the zip into the Data room without handling files one by one.
**Preconditions**: Data room open, All items. AI consent granted so tagging will run later.
**Ideal path**: 2 — drop the zip; wait for "Added 340 files".
**Alternate paths**: "Add files" and pick the zip; drop it on another page (same card).

##### Steps
1. Drop the zip on the window. → Overlay "Drop to add to Data room", then a card named "Series A diligence.zip" with a percent and bar while the bytes upload.
2. Upload reaches 100%. → The server answers with an import id (HTTP 202). The card switches to an animated full-width pulsing bar and a shimmering line "Opening Series A diligence.zip". Maya thinks: "Has the upload finished? Why a new line?"
3. A second or two later (the card polls the import row every 1 second). → Line becomes "Found 340 files".
4. Files start landing. → Line reads "Adding 12 of 340 · term-sheet-v3.pdf", with the current file name changing.
5. All files are filed. → Line reads "Reading 40 of 340" while text is extracted for the first files.
6. Import finishes. → Card turns to green "Added 340 files" with "View". Autodismiss after 10 seconds.
7. Click "View". → Data room opens at its root; the new items are listed, many with the Reading state.

##### Variations
- Only the card narrates this zip. The page-level import row ("Importing 12 of 340") deliberately leaves it out so the same import is not shown twice.
- Zip with folders: only files are counted; folders, `__MACOSX` and hidden files are skipped.

##### Edge Cases
- If Maya reloads the page during step 4, the card is gone. The import itself continues on the server, and the import appears in the page-level "Importing X of Y" row, since the page no longer treats it as narrated. UNVERIFIED in a live browser.
- A zip that holds only files already in the Data room finishes with "Already in your Data room" instead of "Added N files".

#### STORY-DRM-102: Read the processing strip and open Details

**Type**: medium
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics
**Goal**: After the zip lands, see how much is still being read and tagged, and decide whether to wait before asking the Data room agent questions.
**Preconditions**: STORY-DRM-101 just finished; 340 files, roughly 300 still in the pipeline.
**Ideal path**: 3 — glance at the strip, click "Details", close it.
**Alternate paths**: The Stats view shows a "Reading" and "Failed" count (see STORY-DRM-108).

##### Steps
1. Look at the top of the list, below the path bar. → One slim line: shimmering "Processing 298 files", then a step word and file name such as "Reading board-minutes-2025.pdf". A thin bar along the bottom edge fills as the backlog shrinks.
2. Click the chevron button with aria-label "Details". → The chevron rotates and a list opens: "Reading text 120", "Indexing for search 60", "Tagging 118". Steps with a zero count are hidden.
3. Click it again. → The list closes. Maya thinks: "Reading, indexing, tagging: do I need all three?" The current-step word is the earliest step that still has files, so the word moves from Reading to Indexing to Tagging.
4. Keep working: search for "safe". → The strip stays; the list keeps refreshing (the page asks for a reload every 3 seconds while files remain).
5. The last file finishes. → Strip becomes "All files processed" for about 3 seconds, then disappears.

##### Variations
- With "Hide amounts" on, the current file name is masked in the strip.
- If an import is also running (for example from the Import menu), the strip starts with a spinner and "Importing 10 of 40" followed by a dot and the processing count.

##### Edge Cases
- The bar percent uses the largest backlog seen in this batch, so adding more files mid-run makes the bar jump forward rather than backward.
- If files fail, a line "N couldn't be read" sits in the strip. When nothing else remains, that line is all the strip shows and it does not offer a Retry (Retry is per item; see STORY-DRM-105).
- When only the "Reading" row hint shows on item rows, hovering shows the longer step title (for example "Indexing for search").

#### STORY-DRM-103: A password-protected zip is refused before anything is added

**Type**: short
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics, received "payroll-2025.zip" from an outside accountant
**Goal**: Understand why her zip did not import and what to do next.
**Preconditions**: Data room open.
**Ideal path**: 2 — drop zip, read the red line.
**Alternate paths**: none found for entering the password in-app.

##### Steps
1. Drop the zip. → Card shows upload percent as normal.
2. The server inspects the zip directory and answers 400 with code `encrypted`. → The card turns to a red line "This zip is password-protected" with an X. No import is queued and no "Opening" line appears.
3. Maya has no way to type a password. She dismisses the card (it also disappears by itself after 15 seconds) and unpacks the zip on her computer. → She drops the extracted files instead (STORY-DRM-002).

##### Variations
- The same card shape appears for four more whole-zip refusals: "This zip has unsafe file paths" (entries that escape the folder, or symlinks), "This zip is too large to unpack" (bomb-like compression ratio or oversized directory), "This zip has more than 10,000 files", and "This zip can't be read" (damaged archive).
- Any other server failure shows the generic "Upload failed".

##### Edge Cases
- The refusal arrives after the whole zip has uploaded, so a 3 GB protected zip wastes the full upload time first. Maya hesitates: "Could it have said so earlier?" No client-side check found.
- Nothing is added when a zip is refused; no partial results.

#### STORY-DRM-104: A zip with 12,000 files and a zip with unsafe paths

**Type**: medium
**Topic**: data-room-big-uploads-zips-processing
**Persona**: A solo technical founder exporting a repository archive plus a downloaded customer data pack
**Goal**: Try to import two large archives and learn what the limits are.
**Preconditions**: Data room open; archive A has 12,000 small files; archive B was made on an unusual tool and holds a path starting with `../`.
**Ideal path**: 4 — drop both; read two red lines; split archive A into smaller zips.
**Alternate paths**: Drive or Box folder import for very large trees (Import menu), UNVERIFIED whether it has a file count limit.

##### Steps
1. Drop archive A and B at the same time. → Two cards, each with its own percent.
2. Archive A finishes uploading. → Red line "This zip has more than 10,000 files".
3. Archive B finishes uploading. → Red line "This zip has unsafe file paths".
4. Maya re-zips A as three zips of 4,000 files and drops all three. → Three cards run in parallel: "Opening ...", "Found 4000 files", "Adding ...".
5. She waits; the three finish with "Added 4000 files" style lines. → The strip "Processing N files" covers all three zips together because it counts the whole Data room pipeline, not one zip.

##### Variations
- Dotfiles and `__MACOSX` entries in the zip are skipped, so the counted total can be lower than the file count in Finder.

##### Edge Cases
- The limit is checked against entries counted while reading the zip directory; whether skipped hidden files count toward 10,000 is UNVERIFIED.
- Three simultaneous zips make three polling loops (one request per second each). Slow machines may feel it; UNVERIFIED.

#### STORY-DRM-105: A zip finishes but some files could not be read, then retry one

**Type**: medium
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics
**Goal**: After a diligence zip, find the one scanned file that failed and read it again.
**Preconditions**: Zip imported earlier; one 90 MB scanned PDF failed during ingest.
**Ideal path**: 4 — see the strip's failed count, open the failed row, choose "Try again".
**Alternate paths**: Right-click or the row's menu "Try again" without opening the preview.

##### Steps
1. After the zip card says "Added 338 files", look at the strip. → "2 couldn't be read" is shown in the strip. (The plural form is the same for one or many.)
2. Look for the file in the list. → A failing row shows a red icon with label "Failed" and no longer shows the working "Reading" hint.
3. Click the row. → The preview shows the file viewer, then a red heading "Couldn't read this file" and the server's error text below it, if any.
4. Open the row's menu and choose "Try again". → A notice toast "Reading board-scan.pdf again" appears. The row goes back to "Reading".
5. The strip counts it again as "Processing 1 file", then "All files processed". → Maya thinks: "Good, but did it truly fix it?" If it fails again, the "couldn't be read" line returns.

##### Variations
- "Try again" only appears in the menu when the item status is failed.
- Stats view card "Failed" shows the same count with a "Failed" entry in its status breakdown.

##### Edge Cases
- A file that imports with `0` successes and only failures makes the zip card say "This zip can't be read" (red) instead of "Added 0 files". Maya sees the same red line as a damaged zip.
- If only some entries failed, the card says "Added N files" with no mention of failed ones; the failures show only in the strip and in the page import row, which skips narrated imports. So failed entries of a zip you watched appear on one surface only (the strip count).

#### STORY-DRM-106: Large file that is stored but "Too large to search inside"

**Type**: medium
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics, with a 400 MB scanned PDF of the original incorporation binder
**Goal**: Find out why searching for a phrase from the binder returns nothing, though the file is listed.
**Preconditions**: A PDF over 50 MiB uploaded earlier and fully processed.
**Ideal path**: 3 — search by name, open item, read the small note.
**Alternate paths**: Data room agent ("Ask") also cannot read its text; UNVERIFIED how the agent words that.

##### Steps
1. Type a phrase from inside the binder in the search field. → Result list says "No results" and, under it, "Search looks for these words in names and text."
2. Search for the file's name instead. → The row appears (still findable by name).
3. Click it. → The preview opens; the file viewer shows the PDF. Under the summary area a small gray note: "Too large to search inside". No red error and no "Try again".
4. Maya hesitates: "Can I fix this?" The UI offers no action next to the note. She splits the PDF into smaller files and drops them (STORY-DRM-002).

##### Variations
- Text files over 5 MiB are read from their first 5 MiB at any size; they do not get this note.
- Video and other types with no reader are never read.
- Size in the row shows MB only (the formatter stops at megabytes), so a 3 GB file would read as thousands of MB; UNVERIFIED how it looks in a live row.

##### Edge Cases
- This note does not appear while the item is still Reading, only when it is settled.
- Priority of notes in the preview: "Too large to search inside" wins over "Couldn't classify" and over "Not tagged yet..."; Maya may miss a tagging problem on the same file.

#### STORY-DRM-107: Drop a file from another page, then recover when the folder is gone

**Type**: medium
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics, in the middle of reading email
**Goal**: Save an attachment she just downloaded without leaving the Inbox, and recover when the target folder has been deleted by a teammate.
**Preconditions**: Inbox open. Earlier she left the Data room with the folder "Q3 board" selected. A teammate deleted "Q3 board" afterwards.
**Ideal path**: 3 — drop on Inbox, see the card, click "Upload to All items" when told.
**Alternate paths**: "Add to Data room" on an email attachment chip (mail attachments are a separate flow).

##### Steps
1. Drag a file from Finder over the Inbox. → The "Drop to add to Data room" overlay appears, unless a composer or other drop target on the page claims the drag first (then no overlay and no Data room upload).
2. Release. → Card appears with percent. Because Maya is not on the Data room page, the file goes to the top level. (The open-folder memory is cleared when she leaves the page.)
3. The upload completes. → "Uploaded" and "View"; "View" opens the item.
4. Later she goes back to the Data room, selects "Q3 board" from an old link, and drops a file there. → Card turns red: "This folder no longer exists" with a link "Upload to All items". The page reloads and falls back to All items.
5. Click "Upload to All items". → That card closes and a new card starts uploading the same file at the top level.

##### Variations
- The "Add files" input in a sidebar-created folder path creates the folder first; if folder creation fails a notice shows the error text.

##### Edge Cases
- Dropping a file on the compose box in the Inbox attaches it instead; both surfaces use the same drag, so Maya must watch for the overlay text.
- The 404 for a folder is the only 404 the upload can get, so the message is always about the folder.

#### STORY-DRM-108: Stats view and failed counts while a batch is processing

**Type**: short
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics
**Goal**: See, in numbers, how much of the new batch is read and how many files failed.
**Preconditions**: Batch from STORY-DRM-101 still processing; Data room open.
**Ideal path**: 2 — toggle "Stats", read the cards.
**Alternate paths**: The processing strip's "Details" (STORY-DRM-102).

##### Steps
1. In the view switch, click the "Stats" toggle (next to the list and grid toggles). → The list is replaced by Stats for the same folder and filters.
2. Read the status cards. → "Reading" shows files still working and "Failed" shows files that failed.
3. If the stats call fails, an error with a "Retry" button appears. Click "Retry". → Stats reload. If there is nothing, "No results" is shown.
4. Click the list toggle. → Back to the file list; the processing strip is still on top.

##### Variations
- Stats count only the open folder and active filters, while the processing strip counts the whole Data room, so the two numbers can differ. Maya may think one is wrong.

##### Edge Cases
- Stats are read only while shown; the 3-second refresh is for the list and strip. Whether Stats auto-refresh is UNVERIFIED.

#### STORY-DRM-109: End-to-end diligence day, from zip to answered question

**Type**: long
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, first-time founder of Northwind Robotics, with a Series A investor asking for a data room by end of day
**Goal**: Get a 1.2 GB lawyer zip, a loose 600 MB walkthrough video, a duplicate SAFE and a protected payroll zip into one tidy Data room, then ask the Data room agent about it.
**Preconditions**: AI consent granted; embedding model configured; Data room has about 20 existing items; Gmail connected.
**Ideal path**: 14 — upload, wait on the strip, fix failures, sort, ask.
**Alternate paths**: Import menu (Email, Drive, Box) for the same documents without downloading.

##### Steps
1. Open Data room. → List and folder tree load; no strip.
2. Drag "Series A diligence.zip" onto the window. → Overlay "Drop to add to Data room"; card with percent.
3. While it uploads, drag "SAFE-Acme-signed.pdf" too. → Second card; a third later for the video. Maya thinks: "Can I keep working?" Yes, the app stays usable.
4. Zip reaches 100%. → Card moves to "Opening Series A diligence.zip", then "Found 340 files", then "Adding 12 of 340 · name.pdf".
5. The SAFE finishes first. → Card reads "Already in Investors / SAFEs as Acme SAFE (signed).pdf" with "View". She clicks "View" to confirm. → The existing item opens.
6. Drop "payroll-2025.zip". → After upload, red "This zip is password-protected". She dismisses the card.
7. Zip card progresses to "Reading 40 of 340". → Strip above the list now shows "Processing 298 files".
8. Open "Details". → "Reading text", "Indexing for search" and "Tagging" counts.
9. Video upload ends. → "Uploaded" and "View". The video is stored and downloadable; no search text expected (types with no reader are never read).
10. Zip card turns to "Added 340 files". → She clicks "View".
11. Strip continues until "All files processed" shows for a few seconds. → Strip disappears; a line "2 couldn't be read" may remain.
12. Open one failed row. → "Couldn't read this file" plus error. Menu "Try again" → notice "Reading ... again".
13. Open "Auto-sort" (toolbar) to file the new loose items into folders. → The sort proposal flow; after applying, a toast "Sorted N items" with "Undo". (Auto-sort details are covered in other topics.)
14. Use the Data room agent ("Ask" panel) with "Which contracts mention a change of control?" → An answer that cites the files that finished indexing. Files marked "Too large to search inside" or still processing are not searched; UNVERIFIED how the agent states that gap.

##### Variations
- Maya on the desktop app: same page hosted by Electron; the OS file picker replaces the browser's.
- If AI consent is off: items settle without tags and the preview says "Not tagged yet. Files are tagged once you let Praci read documents; you can still search it by name and text."

##### Edge Cases
- Many toasts at once stack above the bottom bar on phones; on wide screens they are 18rem wide at bottom right and can cover the lower right of the list.
- The same zip progress appears on one surface (its card) during the upload, then the processing strip takes over, then the final result is a plain list: three places tell the same story with different words ("Adding", "Processing", "Reading").

#### STORY-DRM-110: Another import runs while the strip is showing

**Type**: medium
**Topic**: data-room-big-uploads-zips-processing
**Persona**: A solo technical founder with a Drive folder of 200 spreadsheets and a zip of PDFs
**Goal**: Understand why the same page shows a card for the zip but a different line for the Drive import.
**Preconditions**: Data room open; Drive connected. Import menu available.
**Ideal path**: 5 — start both, read the two surfaces.
**Alternate paths**: none found.

##### Steps
1. Use the Import menu to import a Drive folder. → An import row begins: a spinner and "Importing 3 of 200" (page-level import activity).
2. Drop a zip of PDFs. → The zip gets its own card ("Opening ...", "Adding ..."). The page-level row ignores it.
3. Files from both begin to be read. → The two surfaces merge: the strip shows a spinner, "Importing 3 of 200", a dot and "Processing 40 files". The separate import row hides itself (it would repeat the same count).
4. Drive import ends. → An import row appears: "Imported 200 files" (or "Already in the Data room" if nothing new) plus up to three file names as links, with an X "Dismiss".
5. Click a file name link. → That file opens in the preview.
6. Click "Dismiss". → The row goes away.

##### Variations
- Partial failures: the row also shows "Couldn't import 3 files".

##### Edge Cases
- Dismissing the row only dismisses those imports for the list; whether the dismissal persists after reload is UNVERIFIED.
- Zip imports are never in this row, even after the card is gone, because the page treats the id as narrated for the session.

### Stories: Added 2026-10-20, Data room: navigate, inspect, organize

#### STORY-DRM-111: Find a file by walking the folder tree and path bar

**Type**: short
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya, first-time founder of Northwind Robotics, looking for the signed SAFE she filed last month.
**Goal**: Open the folder that holds the SAFE and get back to the top without losing her place.
**Preconditions**: Data room has folders Finance, Finance / Cap Table, Legal, Legal / Contracts and at least a dozen files. Window wider than 800 px.
**Ideal path**: 3 — click the folder, click the file, read the preview.
**Alternate paths**: Folder picker pill when the tree is hidden; type in "Search names and text"; deep link `/app/data-room?folder=<id>`.
##### Steps
1. Open Data room in the sidebar → page header "Data room", the folder tree on the left starting with "All items", list on the right.
2. Click "Legal" in the tree → list shows Legal's files and sub-folder rows; the URL gains `?folder=<id>`; a Path bar appears above the list: "All items" (link) › "Legal" (plain text).
3. Click the sub-folder "Contracts" in the list's sub-folder rows (or in the tree) → Path bar reads All items › Legal › Contracts; the tree row is highlighted.
4. Click the file "Northwind SAFE - Harbor Ventures.pdf" → preview pane opens on the right with the file, Type, Date, Parties, Folder "Legal / Contracts".
5. Maya thinks: "Which folder am I in?" She reads the Path bar and the Folder row in the pane, and sees the same path twice.
6. Click "Legal" in the Path bar → the list shows Legal; the pane stays only if the file is still in the results, otherwise it closes (the page never picks another file for her).
7. Click "All items" in the Path bar → Path bar disappears (nothing at top level), the whole room shows.
##### Variations
- Press browser Back after step 3 → returns to Legal (a folder she chose is a new history entry).
- Reload on step 3 → the same folder opens (URL holds it); the pane is closed because nothing is previewed until she picks a file.
##### Edge Cases
- Deep path of more than 4 folders → Path bar shows All items, a "Hidden folders" "…" menu and the last two; she hesitates over the "…" button because it has no label until opened.
- A bookmarked folder that was deleted in another tab → toast "That folder no longer exists" and All items shows.

#### STORY-DRM-112: Resize the folder column and keep it that way

**Type**: short
**Topic**: data-room-navigate-inspect-organize
**Persona**: A solo technical founder with long folder names such as "Board materials 2026 Q3".
**Goal**: Make folder names readable and have the width stick.
**Preconditions**: Page body at least 800 px wide, folders with long names.
**Ideal path**: 1 — drag the edge once.
**Alternate paths**: Keyboard on the handle; double-click to reset.
##### Steps
1. Look at the folder column → names truncate with an ellipsis; hovering a name shows its full text as a tooltip (title).
2. Hover the right edge of the column → cursor becomes a column resize cursor and a thin line appears (handle "Resize folders").
3. Drag right → the column widens, no wider than half the page body.
4. Tab to the handle and press Left Arrow, Right Arrow, Home, End → width moves in 32 px steps, Home goes to 180 px, End to the maximum.
5. Double-click the handle → width returns to 244 px.
6. Reload → the last width is used.
##### Variations
- Shrink the browser below 800 px body width → the whole column disappears; a folder picker pill, "New folder" and "Auto-sort" icon buttons appear in the filter row (see STORY-DRM-113). The saved width is not lost.
- Right-to-left language → arrow keys swap direction.
##### Edge Cases
- Storage blocked → width lasts until the page closes (no message).
- Drag to the minimum → the column stops at 180 px; names are cut more.

#### STORY-DRM-113: Navigate and organize on a narrow window

**Type**: medium
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya on a laptop with the sidebar open, so the Data room body is narrower than 800 px.
**Goal**: Reach a folder, create a new one and open a file without a visible tree.
**Preconditions**: Folders exist; browser width small enough that the body is under 800 px but over 560 px.
**Ideal path**: 4 — folder picker, New folder, name, Create.
**Alternate paths**: Make the window wider; use search.
##### Steps
1. Open Data room → no tree; the filter row has a pill reading "All items" with a chevron, then two icon buttons.
2. Click the pill → radio menu of "All items" and every folder by full path (for example "Finance / Cap Table").
3. Choose "Finance / Cap Table" → pill shows the folder's own name; list shows its files; Path bar shows the path.
4. Hover the folder icon button → tooltip "New folder"; click it → dialog "New folder" with an input labelled "New folder name", an "Inside" selector and "Cancel" / "Create".
5. Type "Fundraising 2026" and press Create → toast "Created Fundraising 2026"; the new folder opens (it is empty: "This folder is empty. Drop files here or add them." with an "Add files" button).
6. Maya hesitates because the new folder was created inside the open folder (Inside defaults to the open folder, UNVERIFIED which value the selector starts with); she reads the Path bar to confirm.
7. Click "Add files" in the empty state → file picker; choose a PDF → upload toast appears; the file lands in this folder (files go into whatever folder is open).
##### Variations
- Below 560 px body width: clicking a file opens the preview in a dialog titled "Preview" instead of a side pane.
- Name with a slash → inline error "Enter a folder name without slashes".
##### Edge Cases
- Create fails (name in use or server error) → error text stays in the dialog; UNVERIFIED exact wording from the server.

#### STORY-DRM-114: Stats view and drill into a result

**Type**: medium
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya, wanting to know what is in the room before a board meeting.
**Goal**: See counts by type, source and month, then jump to the matching files.
**Preconditions**: At least 20 files, mixed sources (Upload, Gmail, Google Drive), some tagged, one failed, one duplicate.
**Ideal path**: 3 — click Stats, click a bar, read the list.
**Alternate paths**: Use filter pills "Type" or "Source" directly.
##### Steps
1. Click the "Stats" toggle (chart icon) in the header → list replaced by cards: Documents, Size, Searchable (percent), Failed; headed by the scope "All items".
2. Read "Documents over time" → month bars; hover shows "Oct 2026: 6". A small top-of-scale number sits at the left.
3. Read the Types, Sources, Top parties, Largest files, Status and Amounts cards → each is a bar list; Status shows Ready / Reading / Not searchable / Failed; a line "# duplicates" appears when duplicates exist.
4. Click the "Contracts" row in Types (label from the doc type) → Stats closes, List returns, the Type pill reads "Type: <name>", only matching files show.
5. Click "Stats" again → the scope header still says the folder or "All items" and shows "Clear filters" because a filter is on; counts now match the filtered set.
6. Click "Clear filters" → counts return to the whole room.
7. Click a row in "Largest files" → Stats closes and that file opens in the preview via `?item=`.
##### Variations
- Click a month bar → the Document date pill becomes "Document date: Oct 1, 2026 – Oct 31, 2026".
- Open a folder first, then Stats → scope header shows the folder path; all counts are for that folder only.
- Hide amounts on → the Amounts card shows masked values and no bars.
##### Edge Cases
- No documents match → "No results".
- Stats request fails → red error text with "Retry".
- Searching: the "Searchable" card equals Ready / Documents, so a room with many "Reading" files shows a low percent; Maya may read this as a failure (UNVERIFIED whether she would).

#### STORY-DRM-115: Inspect a PDF: open in new tab, download, full screen

**Type**: medium
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya checking the signature page of a 40-page PDF.
**Goal**: Read the PDF at a usable size and keep a copy.
**Preconditions**: A ready, tagged PDF "Series Seed Term Sheet.pdf" in Legal / Contracts.
**Ideal path**: 3 — click file, click "Full screen", read.
**Alternate paths**: "Open in new tab"; "Download".
##### Steps
1. Click the file → pane shows a "Preview" header, the file name as a heading, a skeleton box while it loads, then the PDF inside a frame about 60% of the viewport height.
2. Scroll inside the frame → the browser's PDF viewer scrolls; there is no toolbar in the frame (hidden on purpose, so no second Download or Print).
3. Hover the icons in the pane header → tooltips "Open in new tab", "Download", "Full screen".
4. Click "Full screen" → a nearly full-window dialog titled with the file name, with Open in new tab and Download icons and the PDF filling the dialog; it reuses the file already loaded, so there is no second wait.
5. Press Esc → dialog closes, pane remains.
6. Click "Open in new tab" → a new tab opens at once and shows the file; the tab title is the file name.
7. Click "Download" → the browser saves the file with its name.
##### Variations
- In the Electron desktop app, if a new tab is refused, Open falls back to saving the file (UNVERIFIED which the walker sees).
- Hide amounts on → the frame is replaced by "Hidden while amounts are hidden"; Open in new tab is disabled; "Full screen" is not offered.
##### Edge Cases
- File cannot be read → file icon in a grey box, no Full screen button.
- Download fails → red text under the pane header with the error.
- Failed file (status Failed) → Open in new tab disabled; Download still enabled.

#### STORY-DRM-116: Preview a spreadsheet with several sheets

**Type**: short
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya, a founder reviewing a cap table export.
**Goal**: See each sheet without leaving the Data room.
**Preconditions**: A ready xlsx "Northwind Cap Table Export.xlsx" with sheets "Common", "Options", "SAFEs"; and a csv with more rows than the first page.
**Ideal path**: 2 — click file, click a sheet tab.
**Alternate paths**: "Full screen" for a wider grid; Download for Excel.
##### Steps
1. Click the xlsx file → pane shows a bordered sheet viewer about half the screen high, with a "Sheets" tab row.
2. Click the "Options" tab → grid switches to that sheet.
3. Click "Full screen" → dialog with the same viewer at full size.
4. Close, select the csv, scroll to the bottom → a "Load more" button appears; click it → more rows load.
##### Variations
- Pick another file then return → the viewer reloads per file (key is the item id).
##### Edge Cases
- A sheet with no cells → "This sheet is empty."
- Load fails → "Could not load this file."; loading more rows fails → "Could not load more rows."
- A type the viewer cannot show → "Preview isn't available for this file type — download it to view it."
- A Word file → the pane shows only the file icon plus facets; UNVERIFIED whether any Office preview exists elsewhere.

#### STORY-DRM-117: Send a document to an agent

**Type**: medium
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya, wanting her Legal bot to summarize a term sheet.
**Goal**: Start a chat with the file already attached.
**Preconditions**: At least two agents (a general agent, "Legal", and "Carta" integration agent); one PDF in the room.
**Ideal path**: 3 — open the file's menu, Send to agent, pick an agent.
**Alternate paths**: Right-click the row; the pane's "More actions" menu; ask in an agent chat with the file referenced.
##### Steps
1. Hover the row of "Series Seed Term Sheet.pdf" → a "More actions for Series Seed Term Sheet.pdf" button shows.
2. Click it → menu: "Send to agent" (submenu), "Move", "Rename", "Delete".
3. Hover "Send to agent" → list of agents with avatars, most recently active first.
4. Choose "Legal" → app navigates to that agent's chat; the composer shows a file chip for the document (sent by reference because the agent can read the Data room).
5. Maya thinks: "Is it uploaded again?" The chip refers to the Data room file; no copy is uploaded.
6. Go back to Data room, repeat and choose "Carta" → the app downloads the file and attaches it as an ordinary attachment (Carta has no Data room tools). A moment of delay while it is copied.
##### Variations
- Right-click on the row opens the same items.
- Open the pane's own menu: same items.
- No agents available → the "Send to agent" item is not shown at all.
##### Edge Cases
- Copy fails → composer notice "Skipped Series Seed Term Sheet.pdf".
- Sending the same file to the same agent twice → the earlier chip for that agent is replaced, not duplicated.
- More files than the per-message limit are not possible here (one file at a time).

#### STORY-DRM-118: Auto-sort a messy room, apply some, undo

**Type**: medium
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya after importing 40 unsorted attachments.
**Goal**: Let Praci propose folders, accept most, and reverse the batch.
**Preconditions**: Model configured and "Let Praci read your documents" allowed; many files at the top level; two near-duplicate folders "Contracts" and "Contract".
**Ideal path**: 4 — Auto-sort, review, Apply, done.
**Alternate paths**: The narrow-window "Auto-sort" icon button; none from the file menu.
##### Steps
1. Click "Auto-sort" at the bottom of the folder tree → dialog "Auto-sort" with a loading line "Reviewing 40 files" and the file names shimmering.
2. Wait → each file's outcome appears in turn (for example "Move → Legal / Contracts", "No change"), within about 1.5 seconds of reveal, then the review replaces the list. Apply is disabled meanwhile.
3. Read the review → sections "Merge" (Contract → Contracts), "Move" (file with from → to), "Rename" (old name, "→ new name"). Every row is ticked.
4. Maya unticks one Rename she does not like → Apply stays enabled while at least one row is ticked.
5. Click "Apply" → dialog closes, list refreshes, folders reload; toast "Sorted 17 items" with an "Undo" link.
6. She dislikes the merge; click "Undo" → toast "Undid 17" (or "Undid 15, skipped 2" if some changed since); list reloads.
##### Variations
- Click "Cancel" at step 3 → nothing changes.
- Only the first 300 newest classified files are planned; with more loaded, the list shows "+N more".
##### Edge Cases
- Nothing to change → "Already tidy." and Apply disabled.
- AI not allowed or no model → "Turn on a model and allow AI access to sort files." with "Retry".
- Model failure → "The model could not sort your files." with "Retry".
- Plan request fails → red error with "Retry"; Apply failure shows the error under the list.
- Untick everything → Apply disabled.

#### STORY-DRM-119: Import from Email, Drive and Box when some are not connected

**Type**: medium
**Topic**: data-room-navigate-inspect-organize
**Persona**: A solo technical founder who connected Gmail but not Drive or Box.
**Goal**: Pull a Gmail attachment into the open folder, then discover how to connect Drive.
**Preconditions**: Gmail connected, Google Drive not connected but offered, no Box MCP server. Folder "Finance" open.
**Ideal path**: 3 — Import, Email, pick, Import.
**Alternate paths**: Mail attachment chip "Add to Data room" in the Inbox; auto-file setting (different topic).
##### Steps
1. Click "Import" (download icon with chevron) → menu "Email", "Google Drive", "Box".
2. Click "Email" → dialog "Import from email" with a "Search mail" box and a list of attachments from mail.
3. Tick two PDFs → the button changes from "Import" to "Import 2 files".
4. Click it → dialog closes; an Import activity strip "Importing 2 of 2" appears above the list, then a Processing strip counting files through "Reading text", "Indexing for search", "Tagging"; files land in "Finance".
5. Back in the Import menu click "Google Drive" → the app leaves the page and opens `/app/integrations/app/google/googledrive` (the Drive connect page), because it is not connected.
6. After connecting she navigates back; she hesitates because she lost her place unless she returns by the Back button.
7. Choose "Box" → goes to `/app/integrations?connect=box`.
##### Variations
- Drive connected → dialog "Import from Google Drive" with "Search Drive", a "Back" button to leave a folder, files and whole folders; button reads "Import 3" after picking three.
- Box connected → "Import from Box" with "Search Box".
- Items already in the room → notice "Already in your Data room" instead of a strip.
- Catalog without Gmail or Drive → those two menu items are absent; Box always shows.
##### Edge Cases
- Mail problem → text with "Reconnect" and "Couldn't load mail" fallback.
- Empty search → "No files found"; "Load more" for more results.
- Import started from the empty room: same Import control sits under "Drop files here" (see STORY-DRM-001).

#### STORY-DRM-120: Cap table "Documents" list opens a file in the Data room

**Type**: short
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya, working on the Cap table page and wanting the signed SAFE.
**Goal**: See documents for the Cap table without opening the Data room first.
**Preconditions**: The Data room folder "Finance / Cap Table" holds at least one file; none for a second space.
**Ideal path**: 2 — scroll to Documents, click the name.
**Alternate paths**: Data room page, Finance / Cap Table folder.
##### Steps
1. Open the Cap table page and scroll below the table → a "Documents" section with columns "Name", "Type", "Added" (Type hides on narrow widths); up to 10 newest files.
2. Click the name "Harbor Ventures SAFE.pdf" → app goes to `/app/data-room?item=<id>`, opens the "Finance / Cap Table" folder and shows the file's preview in the pane (or a dialog on narrow widths).
3. Click "Close preview" → focus returns to that row.
##### Variations
- Upload or import via the Cap table page's own Import and Add files → the Documents list reloads (via a change event).
- Hide amounts on → file names that contain currency amounts are masked.
##### Edge Cases
- Folder missing, empty or unreadable → the Documents section does not appear at all (no message).
- A deleted document link → toast "That document could not be found" and the query param is removed.

#### STORY-DRM-121: Quarter-end clean-up, a long cross-feature journey

**Type**: long
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya, first-time founder of Northwind Robotics, preparing a data room for an investor diligence call at the end of Q3.
**Goal**: Import scattered documents, let Praci tag and sort them, check what is in the room, read a few files, ask an agent about one, and tidy the folders.
**Preconditions**: Gmail connected; Drive not connected; a model configured; the room holds 8 uploaded files at the top level; 5 PDFs with attachments in Gmail; the Cap table has an existing "Finance / Cap Table" folder; two agents exist ("Legal" and a general agent).
**Ideal path**: 18 — import, wait, auto-sort, stats, preview, send, tidy.
**Alternate paths**: Mail attachment "Add to Data room" from the Inbox; drag files in; ask the Data room agent instead of browsing.
##### Steps
1. Open Data room → list of 8 files, "Reading" labels on some rows, a Processing strip "Processing 3 files" with a thin progress bar.
2. Click the chevron "Details" on the strip → step counts: "Reading text 2", "Indexing for search 1".
3. Maya waits; strip turns into "All files processed" briefly, then goes away.
4. A card says Praci does not tag new files until she allows it; she reads the text and clicks Allow in "Let Praci read your documents" → files are tagged; list shows types and dates; "Not tagged" labels disappear.
5. Click "Import" › "Email" → pick the five PDFs → "Import 5 files".
6. Watch the Import strip "Importing 2 of 5" then the Processing strip; the five files appear with Source "Gmail".
7. Click "Auto-sort" in the tree → review: a "Move" group of 9 files, a "Rename" group of 3 ("scan0012.pdf → Harbor SAFE.pdf"), no merges. She unticks one rename.
8. Click "Apply" → toast "Sorted 11 items" with "Undo"; the tree shows new folders such as "Legal".
9. Click "Stats" → cards: 13 Documents, Size, Searchable 100%, Failed 1; Types, Sources (Upload 8, Gmail 5), Status.
10. She notices Failed 1; click the Failed status isn't a button (status rows have no pick) → she switches back to List view.
11. Click "List view", then the Type pill and choose a type, or scroll → finds a red-marked file "Failed".
12. Click the failed file → pane shows "Couldn't read this file", the error, and two buttons "Try again" and "Delete"; click "Try again" → toast "Reading <name> again"; the row shows "Reading".
13. Open "Legal / Contracts", click the term sheet PDF → pane with the PDF; click "Full screen", scroll, press Esc.
14. Open "More actions for <name>" › "Send to agent" › "Legal" → chat opens with the chip; she asks for a summary (chat is another topic).
15. Return via the sidebar to Data room; the room opens at All items (the folder was not remembered other than in the URL); she opens the browser Back to return to the folder.
16. Rename the folder "Contracts" to "Executed contracts" using right-click › "Rename" → toast "Renamed".
17. Create a folder "Diligence" with "New folder" at the bottom of the tree; drag-free: move three files into it using each file's "Move" dialog.
18. Click the Cap table page → "Documents" list shows the new Cap Table files; she clicks one to return to the Data room preview.
##### Variations
- At step 4 she picks the dismiss option instead; a line "Praci doesn't tag new files." with "Let Praci read documents" stays as a quiet reminder.
- At step 7 with no model → "Turn on a model and allow AI access to sort files." and she cancels.
- Ask the "Data room agent" from the header at the start instead of browsing; agent button is hidden when its chat is already open.
##### Edge Cases
- Auto-sort moves a file that was previewed → pane keeps it if still in results, otherwise closes.
- Unseen "Hide amounts" on during step 13 → PDF hidden; she must turn it off to read.
- Importing while processing → the Import strip is hidden and the Processing strip carries the "Importing x of y" line.
- Information repeated: the folder appears in tree, Path bar, preview "Folder" and Move dialog; status appears in the row, the Processing strip and Stats.

### Redundancy Candidates (this area)
- Three ways to start an upload (header "+", "Choose files" in the empty state, drop anywhere) plus, with PR #109, two import buttons: four add-file buttons in one header row that look alike (STORY-DRM-002, 020).
- The folder pill (narrow) and the folder tree (wide) are two controls for one choice; a sub-folder row or tile is a third (STORY-DRM-011, 030, 038).
- "Move" with "New folder…" and the (absent) tree menu: folder creation lives only inside the Move dialog, so there is no obvious place to make a folder (STORY-DRM-033).
- Sidebar search and the page's own search both search documents, with different result layouts (STORY-DRM-013, 035).
- The Settings "AI data sharing" switches and the Data room "Allow" card both talk about sending documents to a model; the Data room needs its own consent (STORY-DRM-009).

### Suspected problems (this area)

Refresh 2026-10-20: items marked "PR #109" below describe the earlier icon-only import buttons; the Import menu replaced them, so re-check before filing issues.
1. **Top-level folders cannot be renamed, moved or deleted.** Only the open folder's children get rows with a "…" menu (`DataRoom.tsx:149-155`), and the tree has no menu (`FolderTree.tsx`). A top-level folder is nobody's child, so no menu reaches it. STORY-DRM-027.
2. **"New folder…" always creates a top-level folder** (`ItemDialogs.tsx:146-151` calls `folderCreate({ name })` with no parent), so nested folders can only come from the classifier. STORY-DRM-033.
3. **A folder shows only its own files, not those of its sub-folders** (`packages/db/src/data-room.ts:168-172`, equality on `folderId`). Clicking `Finance` shows only folder rows. STORY-DRM-011.
4. **Search silently stays inside the open folder.** The folder filter is sent with the search (`use-data-room-list.ts:79-84`); nothing in the results says so. STORY-DRM-036.
5. **Upload to a deleted folder says "Upload failed"** with no hint about the folder (`apps/api/src/data-room.ts:396-402` returns 404; `upload-toasts.ts:136-144` maps it to "failed"). STORY-DRM-006, 028.
6. **A bad `?item=` id is ignored silently** (`DataRoom.tsx:209`), and a failed folder-list request leaves a bad `?folder=` id in the URL with "This folder is empty…" showing. STORY-DRM-026, 029.
7. **Type and Party menus list only values on the rows already loaded** (`DataRoom.tsx:375-376`), so a type that lives on page 2 is not offered. STORY-DRM-014, 037.
8. **A failed file has no retry**; the preview offers Delete and Download only (`Preview.tsx:174-184`). STORY-DRM-008.
9. **Consent card has no "Not now" and no link to Settings in the no-model note** (`ConsentPrompt.tsx:26-34`, `ConsentCard` called without `onDismiss`). STORY-DRM-009, 032.
10. **Search and non-folder filters are not in the URL** (`DataRoom.tsx:83-85`), so Back and links do not restore them. STORY-DRM-025.
11. **PR #109: import buttons are icon-only with an aria label but no visible tooltip** (`ImportFromEmail.tsx` `compact`, `ImportFromDrive.tsx`); a sighted first-timer sees an envelope and a disk. STORY-DRM-020.
12. **PR #109: the import notice and the upload toasts occupy the same corner** (`DataRoom.tsx` notice `fixed end-4 bottom-20 z-100`; `DropZone.tsx` toasts `fixed inset-x-4 bottom-20 z-100`), so they can overlap if both are visible. STORY-DRM-020.
13. **PR #109: Drive picker disables unsupported files with no explanation** (`ImportFromDrive.tsx:44-47`), and uses the first connected Drive account with no chooser. STORY-DRM-040.
14. **PR #109: the connection list is read once**; the import buttons do not appear until it loads, and a failed read shows "Connect …" even when connected (`ImportFromEmail.tsx:289-305`). STORY-DRM-041.


---
