## Area: Data room (STORY-DRM-nnn)

Source: `docs/ux-paths/dataroom/catalog.md`.


Generated: 2026-10-17
Repository: `the repository root` (branch `docs/ux-pass`, code read at HEAD `559a76ad`). PR #109 stories were read from `origin/feat/legal` at commit `f2b8fc1e` ("Legal: regenerate translation catalogs after the e2e fixes").
Total Stories: 44 (short 26, medium 17, long 1)
Persona for every story: Maya, a naive first-time founder of Northwind Robotics ("Northwind Robotics") who has never seen Praci, does not know its vocabulary ("Data room", "folder", "filing", "agent", "approval", "space"), and wants to keep the company's documents in order and find them again.

### Changes since the 2026-10-16 catalog

The Data room changed a lot on main since the last catalog (`git log -- apps/web/src/components/data-room apps/web/src/pages/DataRoom.tsx`, most recent: `78d97779` phone toolbar, `b302756f` folder URL authoritative, `f162d56f` folder in the URL, `a2d42924` folder rename/move/delete, `c3e1c923` consent prompt on the page, `ab20ab44` delete confirm + duplicate toast).

- **Retired**: STORY-DRM-004 (50 MB refusal toast). Uploads have no size limit; a file too large to read is stored and the preview says "Too large to search inside".
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

Requires PR #109 (origin/feat/legal, commit `f2b8fc1e`):

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
├── STORY-DRM-020 (LONG: month-end invoices from Gmail)      [Requires PR #109]
│   ├── STORY-DRM-039 (Email picker problems)                [Requires PR #109]
│   ├── STORY-DRM-041 (Connect Gmail / Drive first)           [Requires PR #109]
│   └── STORY-DRM-042 (Source link and repeat import notice)  [Requires PR #109]
├── STORY-DRM-021 (Bring in Google Drive)                    [Requires PR #109]
│   ├── STORY-DRM-040 (Browse Drive, Google Docs, unsupported) [Requires PR #109]
│   └── STORY-DRM-043 (Import into the open folder)           [Requires PR #109]
├── STORY-DRM-022 (Share with cofounder)  [gap on both branches]
└── STORY-DRM-023 (Agent over documents)                      [Requires PR #109]
    └── STORY-DRM-044 (An agent files an attachment by itself) [Requires PR #109]
```

### Stories: Getting started and uploading

#### STORY-DRM-001: Find where documents go

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

#### STORY-DRM-002: Upload the first documents with "Choose files"

**Type**: short
**Topic**: Upload
**Persona**: Maya; wants to put the pitch deck and the SAFE in.
**Goal**: Get two PDFs into the Data room.
**Preconditions**: S0; walker has `MOCK Northwind pitch deck.pdf` and `MOCK Northwind SAFE - Jane Angel.pdf`. On main.
**Ideal path**: 2 — pick files, see them listed.
**Alternate paths**: Drag onto the page; drag onto any other page (STORY-DRM-003); "+" ("Add files") in the header once the room is not empty.

##### Steps
1. Click "Choose files" → The operating system file picker opens; several files can be selected (`DataRoom.tsx:53-62`).
2. Select both PDFs and confirm → One toast per file at the lower right (centred on a phone) with the file name, a percentage and a progress bar.
3. Wait → Each toast shows green "Uploaded" and a "View" link and disappears after 10 s. **Expectation:** that the file is now read and sorted; it has only been stored.
4. Look at the page → The empty box is replaced by the search box, the filters that have values, and a list with two rows. Each row has a spinner and the word "Reading" in grey until it is read.

##### Variations
- Click "View" in the toast → URL becomes `/app/data-room?item=<id>` and that item is open in the preview (STORY-DRM-029).
- The first time, the grey card or the "Allow" card appears above the list (STORY-DRM-009, 032).

##### Edge Cases
- Network drops mid-upload → the toast says "Upload failed" in red with a Dismiss X; stays 15 s; nothing retries.

#### STORY-DRM-003: Drop a file while on another page

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

#### STORY-DRM-004: Upload a file that is over 50 MB

**Type**: short
**Topic**: Large uploads
**Persona**: Maya, trying to keep the board meeting recording.
**Goal**: Store a 60 MB video.
**Preconditions**: S1; walker has `MOCK board-video.mp4` (~60 MB). On main.
**Ideal path**: 1 — upload it and download it again.
**Alternate paths**: none found.

##### Steps
1. Click "+" ("Add files") and choose the video → A toast shows the name and a progress bar, then "Uploaded". There is no size limit.
2. Open the item → Download works. A PDF, Office file or image over 50 MB also shows "Too large to search inside", because it is stored but not read for search.

##### Edge Cases
- The server refuses a file name with a slash (400) → "Unsupported file name". A real file name cannot contain a slash, so the walker can only reach this by calling the upload endpoint directly.

#### STORY-DRM-005: Upload the same file twice

**Type**: short
**Topic**: Upload duplicates
**Persona**: Maya, unsure whether the lease was already uploaded.
**Goal**: Make sure the lease is in the Data room without creating a copy.
**Preconditions**: S1; walker has a byte-identical copy of `Northwind HQ lease renewal 2027.pdf` (named `lease copy.pdf`). On main.
**Ideal path**: 1 — upload and be told it already exists, and where.
**Alternate paths**: Search "lease" first (STORY-DRM-013).

##### Steps
1. Drop `lease copy.pdf` on the Data room → Toast progress, then the line "Already in Legal / Contracts as Northwind HQ lease renewal 2027.pdf" with a "View" link (`DropZone.tsx:25-31`, `upload-toasts.ts:106-123`).
2. Look at the list → No second row appears.
3. Click "View" → The original opens in the preview. **Expectation met:** she knows where it is.

##### Variations
- Same file when the original has no folder → "Already in your Data room as <original name>".
- Same name as the original → the "as …" part is left out.

##### Edge Cases
- The original was stuck or failed → the duplicate upload restarts its processing (`apps/api/src/data-room.ts`, `requeueStuck`), invisible to her except that a Failed row may become "Reading".

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

### Stories: Importing from Gmail and Google Drive, and sharing (Requires PR #109 unless noted)

#### STORY-DRM-020: Monthly close: get vendor invoices out of Gmail into the Data room

**Type**: medium
**Topic**: Email attachment import + filters
**Persona**: Maya doing month-end bookkeeping; invoices arrive as Gmail attachments.
**Goal**: Have this month's invoices in `Finance / Invoices` next to last month's.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** S1; mock Gmail connected with thread "MOCK Acme Servo Supply – invoice NW-1044" (PDF attachment `invoice-1044.pdf`); M1; consent C1.
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

**Type**: medium
**Topic**: Google Drive import
**Persona**: Maya whose legal documents already live in Google Drive.
**Goal**: Copy the customer contract and the quarterly plan from Drive into the Data room.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** S1; Google Drive connected; Drive has a folder `Contracts` with `MOCK Customer MSA - Bolt Freight.pdf` and a Google Doc `Quarterly plan`.
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
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** S1; M2; consent C1; a chat agent in her own space, run by her (not a group chat, not a messaging-channel run).
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

#### STORY-DRM-028: A folder is deleted in another tab while it is open

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

#### STORY-DRM-037: A library with many documents

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

### Stories: PR #109 import edge cases and agents (Requires PR #109, `f2b8fc1e`)

#### STORY-DRM-039: The email picker has problems

**Type**: medium
**Topic**: Email import errors and limits
**Persona**: Maya importing attachments when mail is not perfect.
**Goal**: Import what she can and understand what failed.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** S1; Gmail connected with threads: one with a PDF, one with only a 4 kB logo and a calendar invite, one account needing reconnect.
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

**Type**: medium
**Topic**: Drive picker behaviour
**Persona**: Maya hunting for a contract in a big Drive.
**Goal**: Find and import it, and understand why some files cannot be ticked.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** Drive connected; Drive has a Google Form `Customer survey`, a large video, and a Google Doc.
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

**Type**: short
**Topic**: Import buttons when not connected
**Persona**: Maya who has not connected Google.
**Goal**: Import her mail attachments.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** No Gmail or Drive connection.
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

**Type**: short
**Topic**: Preview source link
**Persona**: Maya who wants to see where a file came from.
**Goal**: Open the original email or Drive file.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** One imported mail file and one imported Drive file.
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

**Type**: short
**Topic**: Import destination
**Persona**: Maya has `Finance / Invoices` open.
**Goal**: The imported invoice lands there.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** S1; Gmail connected.
**Ideal path**: 2.
**Alternate paths**: Move afterwards.

##### Steps
1. Open `Invoices`, click the envelope, import `invoice-1044.pdf` → The import carries the open folder (`ImportSources folderId={filters.folderId}`).
2. The list reloads → The new invoice is in `Invoices`.
3. From the empty first-run box the destination is always the root.

##### Edge Cases
- The open folder was deleted elsewhere → the server answers 404 and the dialog shows an error.

#### STORY-DRM-044: An agent files an attachment on its own

**Type**: medium
**Topic**: `add_to_data_room`
**Persona**: Maya whose Inbox agent reads her mail.
**Goal**: Have invoices filed without asking.
**Preconditions**: **Requires PR #109 (origin/feat/legal, `f2b8fc1e`).** S1; consent C1 (and C0 for the variation); the Inbox agent runs on her mail with the Acme thread.
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

### Redundancy Candidates (this area)
- Three ways to start an upload (header "+", "Choose files" in the empty state, drop anywhere) plus, with PR #109, two import buttons: four add-file buttons in one header row that look alike (STORY-DRM-002, 020).
- The folder pill (narrow) and the folder tree (wide) are two controls for one choice; a sub-folder row or tile is a third (STORY-DRM-011, 030, 038).
- "Move" with "New folder…" and the (absent) tree menu: folder creation lives only inside the Move dialog, so there is no obvious place to make a folder (STORY-DRM-033).
- Sidebar search and the page's own search both search documents, with different result layouts (STORY-DRM-013, 035).
- The Settings "AI data sharing" switches and the Data room "Allow" card both talk about sending documents to a model; the Data room needs its own consent (STORY-DRM-009).

### Suspected problems (this area)
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
