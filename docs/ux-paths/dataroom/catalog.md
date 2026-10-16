# UX Path Catalog: Rakazo Data room

Generated: 2026-10-16
Repository: `/Users/dennison/develop/rakazo-ux` (branch `docs/ux-pass`, HEAD `458a69e4`)
Total Stories: 23
Persona for every story: a naive first-time founder who has never seen Rakazo, does not know its
vocabulary ("Data room", "facets", "filing", "embedding"), and wants to keep their company's
documents in order.

## What exists in the code (read before walking)

Built and reachable in the web app:

- Route `/app/data-room` (`apps/web/src/App.tsx:194`), sidebar link "Data room" (`apps/web/src/pages/Shell.tsx:3342-3351`).
- Page `apps/web/src/pages/DataRoom.tsx`: empty state "Drop files here" + "Choose files"; header with List view / Grid view toggles and a "+" button (aria "Add files"); filter bar; folder tree ("All items" plus folders) when the page is at least 800 px wide, otherwise a folder picker pill; list, grid, or search results; "Load more"; preview pane (or a dialog when narrow).
- Drop anywhere: a full-window drop overlay "Drop to add to Data room" on every signed-in page, with one toast per file (percentage, then "Filed" + "View", or "Over the 50 MB limit" / "Unsupported file name" / "Upload failed") (`components/data-room/DropZone.tsx`).
- Filter bar (`components/data-room/FilterBar.tsx`): "Search documents" box (debounced 300 ms, server-side), chips "Type", "Party", "Date", "Source", "Sort: …" and an ascending/descending arrow.
- Preview (`components/data-room/Preview.tsx`): name, status or summary, Type / Date / Parties / Amount / Tags / Folder / Source / Size, "Download", and a "…" menu.
- Item menu (`components/data-room/ItemMenu.tsx`): Move, Rename, Delete (dialogs in `ItemDialogs.tsx`).
- Status labels while a background job works: "Pending", "Reading", "Filing", "Failed" (`components/data-room/format.ts`); the list polls every 3 s.
- Automatic filing: when a model is available AND Data room consent is recorded, the classifier sets type/date/parties/amount/tags/summary and files an unfiled item into a folder path it proposes, creating folders as needed (`packages/db/src/data-room.ts:776-778`).
- Settings: "Embedding model" text field in the model settings overlay (`pages/ModelSettingsOverlay.tsx:1526-1590`), which enables semantic search.

Exists in the API only (no web UI calls it): `dataRoom.folderCreate`, `folderRename`, `folderMove`, `folderDelete`, `dataRoom.consent`, `dataRoom.consentGrant` (`packages/contracts/src/rpc.ts:1123-1146`).

Not built (planned in `docs/data-room/README.md:178-215`): Google Drive sync, Gmail attachment/body import, chat and finance import, the "Ask agent" button in the preview, the Data room agent, the `search_data_room` / `read_data_room_item` agent tools, sharing with other members (V1 shows each item only to the person who added it), mobile. Stories below that touch these areas describe what the founder will try and record that nothing in the app answers it. They are gap stories, not feature stories.

## Mock demo data required (seed for "MOCK DEMO DATA — Northwind Robotics")

Every story names the subset it needs. The full seed is:

- **S0 – empty account**: a signed-in user with a completed onboarding and zero Data room items or folders.
- **S1 – filed library** (items owned by the demo user, `source: "upload"`, `status: "ready"`, classified):
  - Folders: `Legal` > `Contracts`; `Finance` > `Invoices`; `Finance` > `Bank statements`; `Investors`; `HR`.
  - `Northwind - Series A term sheet v3.pdf` — docType `investor`, docDate 2026-09-28, parties ["Northwind Robotics", "MOCK Harbor Ventures"], tags ["funding", "series a"], summary "MOCK: draft Series A term sheet, $6M at $24M pre-money.", folder `Investors`.
  - `Northwind HQ lease renewal 2027.pdf` — docType `contract`, docDate 2026-10-03, parties ["Northwind Robotics", "MOCK Pier 9 Properties"], amountCents 2400000 USD, tags ["lease", "renewal"], folder `Legal / Contracts`.
  - `Invoice NW-1042 Acme Servo Supply.pdf` — docType `invoice`, docDate 2026-08-14, parties ["MOCK Acme Servo Supply", "Northwind Robotics"], amountCents 1875000 USD, tags ["hardware"], folder `Finance / Invoices`.
  - `Invoice NW-1043 Acme Servo Supply.pdf` — same party, docDate 2026-09-14, amountCents 920000 USD, folder `Finance / Invoices`.
  - `Mercury statement 2026-09.pdf` — docType `statement`, docDate 2026-09-30, parties ["Northwind Robotics"], folder `Finance / Bank statements`.
  - `Offer letter - Priya Raman (MOCK).docx` — docType `hr`, docDate 2026-07-01, folder `HR`.
  - `Board minutes Q2 2026.pdf` — docType `report`, docDate 2026-06-30, folder: none.
- **S2 – in-progress and failed items**: `Delaware franchise tax notice.pdf` with `status: "extracting"`; `Scan 0007.jpg` with `status: "classifying"`; `Old cap table export.xlsx` with `status: "failed"`, error "Could not read this file"; `Customer NDA - MOCK Bolt Freight.pdf` with `status: "ready"`, error "Classification skipped" (renders "Couldn't classify").
- **S3 – unclassified library** (no consent recorded): five `ready` uploads with all facets null, no folders.
- **S4 – many items**: 60+ ready items so "Load more" appears (list page size 50, search page size 20).
- **Files on the walker's disk** (not in the DB): `MOCK Northwind pitch deck.pdf` (~3 MB), `MOCK Northwind SAFE - Jane Angel.pdf`, `MOCK board-video.mp4` (~60 MB, over the 50 MB cap), and a copy of a file already in S1 (to trigger duplicate handling).
- **Model state**: M0 = no default model; M1 = default chat model set, no embedding model; M2 = default chat model plus an "Embedding model" value. Data room consent recorded or not (only seedable through the API `dataRoom.consentGrant` or the DB, because no web UI grants it).
- **Gmail**: one connected mock Gmail account with a thread "MOCK Acme Servo Supply – invoice NW-1044" carrying a PDF attachment (for the Gmail gap story).

## Summary

| Type | Count |
|------|-------|
| Short | 12 |
| Medium | 8 |
| Long | 3 |

## Coverage Matrix

| Feature area | Stories | Gaps |
|---|---|---|
| Find the Data room / empty state | 001, 002, 018 | none |
| Upload (button, drop on page, drop anywhere, limits, duplicates) | 002, 003, 004, 005, 006, 018 | Upload into a chosen folder is not possible |
| Ingestion status (Pending / Reading / Filing / Failed) | 007, 008, 018 | No retry button for a failed item |
| Consent prompt for documents | 009, 019 | No web UI for `dataRoom.consentGrant` |
| Automatic filing and folders | 010, 011, 018 | No create / rename / delete folder in UI |
| Browse (folder tree, picker, list/grid, sort, preview) | 011, 012, 017 | View choice is not remembered |
| Search and facet filters | 013, 014, 015, 019 | No search hint text; Type filter is exact match |
| Move / rename / delete / download | 016, 017, 020 | No undo for delete |
| Gmail attachment import | 020 | Not built |
| Google Drive import | 021 | Not built |
| Sharing with a cofounder / investor | 022 | Not built (owner-only in V1) |
| Agent over documents | 023 | Not built |

Stories 020–023 are gap stories: they record what a founder tries in areas that are not built yet.

## Story Dependency Graph

```text
STORY-001 (Find the Data room, empty)
├── STORY-002 (First upload with Choose files)
│   ├── STORY-003 (Drop on another page)
│   ├── STORY-004 (File too large)
│   ├── STORY-005 (Same file twice)
│   └── STORY-007 (Watch it get read and filed)
│       ├── STORY-008 (A file failed)
│       └── STORY-009 (Why is nothing tagged? consent)
│           └── STORY-010 (Auto-filing into folders)
├── STORY-011 (Browse folders)  [S1]
│   ├── STORY-012 (List vs grid, sort)
│   ├── STORY-013 (Search for the lease)
│   │   └── STORY-014 (Filter invoices from one vendor)
│   │       └── STORY-015 (Date filter for last quarter)
│   └── STORY-016 (Rename and move)
│       └── STORY-017 (Delete a duplicate)
├── STORY-018 (LONG: first week setting up the company's documents)
├── STORY-019 (LONG: prepare for an investor diligence request)
├── STORY-020 (LONG: monthly bookkeeping close with Gmail invoices)  [gap: Gmail import]
├── STORY-021 (Bring in Google Drive)  [gap]
├── STORY-022 (Share with cofounder)  [gap]
└── STORY-023 (Ask the agent about a contract)  [gap]
```

## All Stories

### Getting started and uploading

## STORY-001: Find where documents go

**Type**: short
**Topic**: Navigation / empty state
**Persona**: First-time founder of Northwind Robotics, signed in for the first time, holding a folder of PDFs on their laptop.
**Goal**: Find the place in the app where company documents live.
**Preconditions**: S0 (empty account), any model state.
**Ideal path**: 1 — one clearly named sidebar entry should take them there.
**Alternate paths**: Direct URL `/app/data-room`; the "View" link in an upload toast (`DropZone.tsx:149-151`) once something is uploaded.

### Steps
1. Scan the sidebar for something like "Documents" or "Files" → They see "Data room" with a folder icon among "Inbox", "Cap Table" and others. **Hesitation:** "Data room" is investor-diligence jargon; a founder who has not raised may not connect it with "all my company files".
2. Click "Data room" → Page titled "Data room" with a dashed box: upload icon, "Drop files here", button "Choose files". No view toggles or filters are shown yet.
3. Read the box for an explanation → There is no sentence saying what the Data room does (reads, tags and files documents automatically). The founder only learns it accepts files.

### Variations
- Mobile width: sidebar is behind the menu button; "Data room" closes the mobile sidebar on tap (`Shell.tsx:3348`).

### Edge Cases
- List call fails on first load: the page is not "empty", so the full filter bar shows with an error line and "Retry" instead of the drop box (`DataRoom.tsx:230`, `:305-313`).

## STORY-002: Upload the first documents with "Choose files"

**Type**: short
**Topic**: Upload
**Persona**: Same founder; wants to put the term sheet and the lease in.
**Goal**: Get two PDFs into the Data room.
**Preconditions**: S0; walker has `MOCK Northwind pitch deck.pdf` and `MOCK Northwind SAFE - Jane Angel.pdf`.
**Ideal path**: 2 — pick files, see them listed.
**Alternate paths**: Drag onto the page; drag onto any other page (STORY-003); "+" ("Add files") icon in the header once the room is not empty (`DataRoom.tsx:261`).

### Steps
1. Click "Choose files" → OS file picker opens; multiple selection is allowed.
2. Select both PDFs and confirm → One toast per file bottom-right with the file name and a percentage and progress bar.
3. Wait → Each toast changes to green "Filed" with a "View" link and disappears after 8 s. **Misread risk:** "Filed" appears as soon as the upload finishes, before the file is read or put in a folder; the founder may expect it to already be in a folder.
4. Look at the page → The empty box is replaced by the filter bar and a list with the two rows; their Type column shows "Pending" or "Reading" in grey.

### Variations
- Click "View" in the toast → URL becomes `/app/data-room?item=<id>` and that item is pinned in the preview.

### Edge Cases
- Network drop mid-upload → toast shows "Upload failed" with a Dismiss (X) button; nothing is retried automatically.

## STORY-003: Drop a file while on another page

**Type**: short
**Topic**: Upload (drop anywhere)
**Persona**: Founder reading their Inbox who just saved a signed NDA to the desktop.
**Goal**: Store the NDA without leaving the current page.
**Preconditions**: S1; walker has a PDF on disk; current page `/app/inbox` (or a chat).
**Ideal path**: 1 — drop the file.
**Alternate paths**: Data room "Choose files" / "+" button (STORY-002).

### Steps
1. Drag the PDF over the Inbox page → A full-window overlay reads "Drop to add to Data room". **Hesitation:** the founder did not know this was possible; nothing on other pages advertises it.
2. Drop → Toast with progress, then "Filed" + "View".
3. Click "View" → Navigates to the Data room with the NDA pinned in the preview.

### Variations
- Drop onto the chat composer instead: the composer accepts it as a chat attachment and the Data room overlay goes away (`DropZone.tsx:53-57`). The founder may not realise those are two different destinations.

### Edge Cases
- A dialog is open while dragging: open menus are closed but dialogs are not; the overlay still appears.

## STORY-004: Try to upload a file that is too big

**Type**: short
**Topic**: Upload limits
**Persona**: Founder trying to keep the board meeting recording.
**Goal**: Store a 60 MB video.
**Preconditions**: S1; walker has `MOCK board-video.mp4` (~60 MB).
**Ideal path**: 1 — attempt, get a clear refusal before waiting.
**Alternate paths**: none found.

### Steps
1. Click "+" ("Add files") and choose the video → Toast immediately shows "Over the 50 MB limit" in red with an X; it stays 15 s.
2. Look for a way to store it anyway → None; no compression hint, no link to a larger-file option.

### Edge Cases
- File just under 50 MB but the server counts more bytes (encoding) → server returns 413 and the toast says the same message.

## STORY-005: Upload the same file twice

**Type**: short
**Topic**: Upload duplicates
**Persona**: Founder unsure whether the lease was already uploaded.
**Goal**: Make sure the lease is in the Data room without creating a copy.
**Preconditions**: S1; walker has a byte-identical copy of `Northwind HQ lease renewal 2027.pdf`.
**Ideal path**: 1 — upload and be told it already exists.
**Alternate paths**: Search "lease" first (STORY-013).

### Steps
1. Drop the copy on the Data room → Toast shows progress, then "Filed" + "View".
2. Look at the list → No second row appears; the original row is unchanged.
3. Wonder whether it worked → Nothing says "Already in your Data room". The server returned `duplicate: true` (`apps/api/src/data-room.ts:430-433`) but the toast ignores it (`upload-toasts.ts:76-80`).

### Variations
- Same file under a different name → still treated as a duplicate (hash match); the new name is dropped silently.

### Edge Cases
- Original item was stuck in Pending or Failed → the duplicate upload restarts its processing (`data-room.ts:400-406`), which is invisible to the founder but may turn a Failed row into Reading.

## STORY-006: Upload into a specific folder

**Type**: short
**Topic**: Upload + folders
**Persona**: Founder who has the `Investors` folder open and drops the SAFE into it.
**Goal**: Add the SAFE directly to `Investors`.
**Preconditions**: S1; consent recorded or not (both variants); walker has `MOCK Northwind SAFE - Jane Angel.pdf`.
**Ideal path**: 1 — drop while the folder is selected.
**Alternate paths**: Upload then Move (STORY-016).

### Steps
1. Click `Investors` in the folder tree → List shows only the term sheet.
2. Drag the SAFE onto the list → Overlay "Drop to add to Data room"; toast "Filed".
3. Look for the SAFE in `Investors` → It is not there. Uploads always go to the root (`upload-toasts.ts:94-95`, `lib/data-room.ts:49`). The list reloads with the folder still selected and does not show it.
4. Click "All items" → The SAFE appears with no folder (or, with consent, is later filed wherever the classifier chooses).

### Edge Cases
- Without consent the SAFE stays in "no folder" forever unless moved by hand.

### Processing and consent

## STORY-007: Watch a new document get read and filed

**Type**: medium
**Topic**: Ingestion status
**Persona**: Founder who just uploaded the pitch deck and wants to know if the app "understood" it.
**Goal**: See the document go from uploaded to tagged and filed.
**Preconditions**: S1; model state M1 or M2; Data room consent recorded (seeded via API); walker has `MOCK Northwind pitch deck.pdf`.
**Ideal path**: 2 — upload, then see a single clear status until done.
**Alternate paths**: none found.

### Steps
1. Upload the deck (any upload path) → New row at the top (sort "Recently added"), Type column "Pending".
2. Wait a few seconds → Type column changes to "Reading" (extracting), then "Filing" (classifying and indexing). The list polls every 3 s (`use-data-room-list.ts:26`). **Misread risk:** "Filing" covers two steps, including search indexing; the folder may already be set while it still says "Filing".
3. Hover the row → Preview shows the status line ("Reading"/"Filing") instead of a summary.
4. When done → Type shows a lowercase value such as "presentation"; Date and Parties fill in; the preview shows a summary, Tags, and Folder (for example `Investors`).
5. Check the folder tree → A folder proposed by the classifier may be new; the founder did not create it.

### Variations
- Model M2 (embedding model set) vs M1: identical visible flow; only search quality differs.

### Edge Cases
- Founder navigates away during "Reading": processing continues in the background; no notification when it completes.

## STORY-008: A document failed to process

**Type**: short
**Topic**: Ingestion status / errors
**Persona**: Founder scanning the list who sees a red row.
**Goal**: Understand what went wrong and fix it.
**Preconditions**: S1 + S2.
**Ideal path**: 2 — see the reason, click retry.
**Alternate paths**: Re-upload the identical file, which restarts a failed item (`apps/api/src/data-room.ts:400-406`); undocumented.

### Steps
1. Spot `Old cap table export.xlsx` → Red marker icon and red Type cell reading "Failed"; the reason appears only as a hover tooltip.
2. Click the row → Preview shows "Could not read this file" in red.
3. Look for "Try again" → None in the preview or the "…" menu (only Move, Rename, Delete).
4. Decide to delete and re-upload, or give up.

### Variations
- `Customer NDA - MOCK Bolt Freight.pdf` (ready with error) → preview shows grey "Couldn't classify" under the name; no reason, no action.

## STORY-009: "Why didn't it tag anything?" (consent never asked)

**Type**: medium
**Topic**: Consent prompt
**Persona**: Founder who uploaded five documents yesterday and expected them sorted into folders.
**Goal**: Get the app to read and organise the documents.
**Preconditions**: S3 (five ready, unclassified items, no folders); model state M1; NO Data room consent recorded; general "AI data sharing" switches may be on.
**Ideal path**: 2 — see a prompt explaining what is sent, click Allow, watch items get filed.
**Alternate paths**: Settings > "AI data sharing" switches (`components/AiDataSharing.tsx:57-118`) look relevant but control a different consent key; the Data room requires its own `data-room:` key (`packages/adapters/src/data-room-models.ts:91-111`).

### Steps
1. Open Data room → Five rows, Type/Date/Parties empty, folder tree shows only "All items". No banner, no prompt.
2. Click a row → Preview shows name, Folder "None", Source "Upload", Size, Download. No summary, no "Couldn't classify" (the skip writes no error, `packages/adapters/src/data-room-jobs.ts:323-328`).
3. Look for a setting → Opens Settings, finds "AI data sharing" with per-model switches; turns the model on.
4. Return to Data room → Nothing changes; items stay unclassified. **This is the expected dead end in the current code**: no web UI calls `dataRoom.consent` or `dataRoom.consentGrant`.
5. Founder concludes the feature is broken or that filing is not real.

### Variations
- M0 (no model at all): same visible result; nothing says "Choose a model first".
- Walk harness only: grant consent through the API, then reload → items move through "Reading"/"Filing" and get folders (STORY-010).

### Edge Cases
- After consent is granted, changing the default model or embedding model changes the consent key, so consent silently lapses for new uploads.

## STORY-010: Let the app sort documents into folders

**Type**: medium
**Topic**: Automatic filing
**Persona**: Founder who expects "drop it in, it goes to the right folder".
**Goal**: Upload an invoice and find it in a sensible folder without choosing one.
**Preconditions**: S1; model M1; Data room consent recorded; walker has a mock invoice PDF from "MOCK Acme Servo Supply".
**Ideal path**: 1 — drop the file; it appears in the right folder.
**Alternate paths**: Manual Move (STORY-016).

### Steps
1. Drop the invoice anywhere → Toast "Filed".
2. Open the Data room → Row at the top shows "Reading", then "Filing".
3. After processing → Folder column is not in the list; the founder must open the preview to see Folder (likely `Finance / Invoices`).
4. Click `Finance` > `Invoices` in the tree → The invoice is listed with the other Acme invoices.

### Variations
- Classifier proposes a new path (for example `Finance / Vendor bills`) → a new folder appears that duplicates the intent of `Invoices`. No way in the UI to merge or delete folders.

### Edge Cases
- Item was manually moved before classification finished → auto-filing only applies when the item has no folder (`packages/db/src/data-room.ts:776`), so the manual choice is kept.

### Browsing and finding

## STORY-011: Browse folders to find the bank statement

**Type**: short
**Topic**: Folder tree / picker
**Persona**: Founder asked by their accountant for September's bank statement.
**Goal**: Find it by browsing.
**Preconditions**: S1; desktop width at least 800 px for the tree.
**Ideal path**: 2 — click folder, click file.
**Alternate paths**: Search "statement" (STORY-013); Type filter "statement"; narrow window folder picker pill (`FilterBar.tsx:292-321`).

### Steps
1. Open Data room → First item is auto-pinned in the preview on the right; folder tree on the left shows "All items", `Finance`, `Bank statements` (indented), `Invoices`, `HR`, `Investors`, `Legal`, `Contracts`.
2. Click `Finance` → **Misread risk:** the founder expects to see the statement under Finance, but selecting a parent folder may show only items directly in it (verify during walk whether sub-folder items are included).
3. Click `Bank statements` → `Mercury statement 2026-09.pdf` listed and pinned.
4. Click "Download" in the preview → Browser downloads the PDF; it is never opened inline.

### Variations
- Narrow window (<800 px): no tree; a pill reading "All items" with a folder icon opens a radio menu of paths such as "Finance / Bank statements".
- Folders cannot be collapsed; every level is always shown.

## STORY-012: Switch to grid and change the sort

**Type**: short
**Topic**: Views and sort
**Persona**: Founder who thinks visually and wants the newest-dated contracts first.
**Goal**: See documents as tiles ordered by document date.
**Preconditions**: S1.
**Ideal path**: 2 — choose grid, choose date sort.
**Alternate paths**: none found.

### Steps
1. Click the grid icon (aria "Grid view") → Tiles with name and type.
2. Open "Sort: Recently added" → Options Date, Name, Type, Recently added. **Misread risk:** "Date" means the date written in the document, not upload date; items without one go last in both directions.
3. Choose "Date" and click the arrow to flip direction → Order changes.
4. Reload the page → View is back to list and sort back to "Recently added" (state is not kept, `DataRoom.tsx:69-74`).

## STORY-013: Search for the lease

**Type**: short
**Topic**: Search
**Persona**: Founder on a call with the landlord who needs the renewal terms now.
**Goal**: Find the lease by typing.
**Preconditions**: S1; M1 (keyword) or M2 + consent (semantic).
**Ideal path**: 1 — type "lease", see it.
**Alternate paths**: Browse `Legal / Contracts`; Party filter "MOCK Pier 9 Properties".

### Steps
1. Type "lease" in "Search documents" → After ~300 ms the list becomes results with highlighted snippets and a "folder · source" line. Grid/list toggle no longer applies.
2. The sort pill changes to "Sort: Relevance" with options Relevance and Date only; the direction arrow is disabled for Relevance.
3. Try a question: "when does our office lease end" → Keyword search may return nothing; with M2 + consent semantic search should find it. Nothing tells the founder which mode is active.
4. Clear the box → List view returns with the previous sort.

### Edge Cases
- No match → "No results" (no suggestion to clear filters if filters are also set).

## STORY-014: Show all invoices from one vendor

**Type**: medium
**Topic**: Facet filters
**Persona**: Founder reconciling hardware spend with MOCK Acme Servo Supply.
**Goal**: List every Acme invoice.
**Preconditions**: S1 (two Acme invoices, classified).
**Ideal path**: 2 — pick type "invoice", pick vendor.
**Alternate paths**: Folder `Finance / Invoices`; search "Acme".

### Steps
1. Click "Type" chip → Popover with a text box and "Apply"; suggestions come only from rows currently loaded.
2. Type "Invoice" (capital I) and Apply → Chip reads "Type: Invoice"; result "No results". **Likely failure:** the stored value is lowercase "invoice" and the filter is an exact match (`packages/db/src/data-room.ts:151`, `:175`).
3. Remove the chip (X), retry with the suggested "invoice" → Both Acme invoices plus any other invoices.
4. Click "Party", type "Acme" → "No results" again, because the party filter needs the full exact name "MOCK Acme Servo Supply".
5. Pick the full name from the suggestions → Two invoices remain.

### Variations
- "Source" chip: pick "Google Drive" or "Gmail" → always "No results" in the current build because no import exists.

## STORY-015: Contracts signed last quarter

**Type**: medium
**Topic**: Date filter
**Persona**: Founder preparing a quarterly update.
**Goal**: See contracts dated July–September 2026.
**Preconditions**: S1 + S3 (some items with no document date).
**Ideal path**: 3 — type, date range, done.
**Alternate paths**: Sort by Date and scan.

### Steps
1. Click "Date" → Popover with "From" and "To" date inputs and "Apply".
2. Set 2026-07-01 to 2026-09-30, Apply → Chip shows "Jul 1, 2026 – Sep 30, 2026".
3. Add Type "contract" → Only contracts with a document date in range.
4. Notice an unclassified contract is missing → items without a document date are excluded; nothing says the filter uses the document date, not upload date.

### Editing and housekeeping

## STORY-016: Rename a scan and move it to the right folder

**Type**: medium
**Topic**: Rename / Move
**Persona**: Founder cleaning up `Scan 0007.jpg`, which is actually the Delaware incorporation certificate.
**Goal**: Give it a real name and put it under `Legal`.
**Preconditions**: S1 + S2 (scan is `ready` by now or still `classifying`).
**Ideal path**: 3 — rename, move, confirm.
**Alternate paths**: "…" on the row, "…" in the preview header, "…" on a grid tile; all open the same dialogs.

### Steps
1. Hover the row and click "…" (aria "More actions for Scan 0007.jpg") → Menu Move / Rename / Delete.
2. Rename → Dialog "Rename" with the name field; type `Delaware certificate of incorporation (MOCK).jpg`; Save.
3. Type a name with a slash, e.g. `Legal/Delaware cert` → Error "Enter a name without slashes". **Hesitation:** founder tried to rename and move in one go.
4. "…" → Move → Dialog "Move" with a native select: "No folder", then paths like "Legal / Contracts"; choose "Legal"; Save.
5. Preview updates: Folder "Legal".

### Variations
- Founder wants a new folder `Legal / Corporate` → no "New folder" anywhere (API `folderCreate` exists, no UI).
- Renaming a file to drop its extension → allowed; the download keeps the new name with no extension.

## STORY-017: Delete a duplicate document

**Type**: short
**Topic**: Delete
**Persona**: Founder who sees two versions of the term sheet.
**Goal**: Remove the old one.
**Preconditions**: S1 plus an extra `Northwind - Series A term sheet v2.pdf` in `Investors`.
**Ideal path**: 2 — delete, confirm.
**Alternate paths**: Row "…", preview "…", grid tile "…".

### Steps
1. "…" → Delete → Alert "Delete Northwind - Series A term sheet v2.pdf?" with Cancel / Delete. No text says it is permanent.
2. Delete → Dialog closes, list reloads, preview closes if it showed that item.
3. Look for undo or a trash → None; the file and its search index are gone and the stored file is removed about a minute later.

### Long end-to-end stories

## STORY-018: First week: set up the company's document library

**Type**: long
**Topic**: Onboarding to the Data room, end to end
**Persona**: Solo founder of Northwind Robotics, first session, with ~10 PDFs (incorporation docs, a SAFE, invoices, an offer letter) and a 60 MB video in a desktop folder.
**Goal**: Have every company document in one searchable place, sorted into folders.
**Preconditions**: S0; model M1; Data room consent NOT recorded (realistic first-run); walker files listed above.
**Ideal path**: 5 — open the room, allow reading, drop all files, see them filed, search once.
**Alternate paths**: Upload via "Choose files", "+", page drop, drop anywhere.

### Steps
1. Sign in; look for "Documents" in the sidebar → Finds "Data room" after scanning (STORY-001 hesitation).
2. Click it → Empty box "Drop files here" / "Choose files".
3. Select all ten PDFs plus the video in Finder and drag them onto the box → Overlay "Drop to add to Data room"; drop.
4. Toasts stack bottom-right: ten progress bars, one red "Over the 50 MB limit" for the video.
5. Toasts turn to "Filed" one by one and disappear after 8 s → Founder believes everything is filed into folders.
6. List shows ten rows, statuses "Pending" → "Reading" → "Filing".
7. After processing, rows are `ready` but Type, Date, Parties are blank and the folder tree has only "All items" (no consent, STORY-009).
8. Founder clicks a row → Preview: Folder "None", no summary.
9. Founder looks for a "New folder" button to organise by hand → none.
10. Opens Settings, turns on the model under "AI data sharing" → no effect on the Data room.
11. Returns, tries search "SAFE" → keyword search finds the SAFE by its text (search works without consent).
12. Uses "…" → Move on each file → only "No folder" exists in the select, so nothing can be moved anywhere.
13. Outcome in current code: documents are stored and keyword-searchable but never organised; the founder cannot fix this from the UI.
14. (Harness variant) Grant consent via API, reload → items go back through "Reading"/"Filing", folders such as `Legal`, `Investors`, `Finance / Invoices`, `HR` appear, rows get types and dates.
15. Founder opens `Investors` → SAFE is there; confirms the room is now organised.
16. Switches to grid view to admire it; reloads the next day → back to list view.

### Edge Cases
- One PDF is image-only (scanned): with a vision-capable model and consent it is read; otherwise it is `ready` with no text and cannot be found by search.

## STORY-019: Answer an investor's diligence request

**Type**: long
**Topic**: Search, filters, download, sharing expectation
**Persona**: Founder in Series A diligence; MOCK Harbor Ventures asked for "all customer contracts, the cap table, last three bank statements, and board minutes".
**Goal**: Collect and send those documents.
**Preconditions**: S1 + S2 + three monthly statements (July–September) in `Finance / Bank statements`; model M2; consent recorded.
**Ideal path**: 6 — four searches or filters, select all, share one link.
**Alternate paths**: Folder browsing for each item; Type filter; Source filter.

### Steps
1. Open Data room → auto-pinned newest item in preview.
2. Type Type filter "contract" → contracts listed; the founder must download each one from its preview ("Download"); no multi-select or bulk download.
3. Clear filter; search "cap table" → `Old cap table export.xlsx` shows as Failed; preview has no retry (STORY-008). Founder downloads it anyway via "Download".
4. Clear search; click `Finance / Bank statements` → three statements; sort "Date" descending; download each.
5. Search "board minutes" → `Board minutes Q2 2026.pdf` (no folder) found; download.
6. Look for "Share" or "Invite investor" → nothing. The word "Data room" set the expectation of an investor-facing room; the code is owner-only (`docs/data-room/README.md:53-55`).
7. Founder attaches the downloaded files to an email in Inbox compose (separate feature; 20 files / 10 MB total cap there) and likely hits the 10 MB attachment limit with statements plus contracts.
8. Outcome: task completed outside the Data room, with many repeated downloads.

### Edge Cases
- The investor asks for "everything from Harbor Ventures": Party filter needs the exact stored name "MOCK Harbor Ventures".

## STORY-020: Monthly close: get vendor invoices out of Gmail into the Data room

**Type**: long
**Topic**: Gmail attachment import (gap) + upload + filters
**Persona**: Founder doing month-end bookkeeping; invoices arrive as Gmail attachments.
**Goal**: Have this month's invoices in `Finance / Invoices` next to last month's.
**Preconditions**: S1; mock Gmail connected with thread "MOCK Acme Servo Supply – invoice NW-1044" (PDF attachment); M1; consent recorded.
**Ideal path**: 2 — "Save to Data room" on the attachment; it gets filed.
**Alternate paths**: Download the attachment from the Inbox message, then drop it anywhere (the only working route). The "Source: Gmail" filter option suggests a direct route exists; it does not.

### Steps
1. Open Data room, open "Source" chip → sees "Gmail" and "Google Drive" listed and assumes Gmail is connected to the Data room.
2. Choose "Gmail" → "No results".
3. Look for "Import from Gmail" or "Connect" on the Data room → none.
4. Go to Inbox, open the Acme thread → message dialog with the attachment; look for "Save to Data room" → none; only download.
5. Download the PDF, then drag it from the browser's download bar onto the app → overlay "Drop to add to Data room", toast "Filed".
6. Return to the Data room → new row, "Reading" → "Filing"; source icon is "Upload", not Gmail.
7. After filing, open `Finance / Invoices` → three Acme invoices.
8. Apply Type "invoice" and Date 2026-10-01 to 2026-10-31 → the new one only.
9. Ask the Inbox agent "save this invoice to my data room" → no Data room tool exists; the agent cannot do it.
10. Outcome: works only through download and re-upload; "Source: Gmail" never matches anything in this build.

## STORY-021: Bring in the company's Google Drive

**Type**: medium
**Topic**: Google Drive import (gap)
**Persona**: Founder whose legal docs already live in a shared Google Drive.
**Goal**: Connect Drive so those files appear in the Data room.
**Preconditions**: S1; Google account connected under Integrations (Drive scopes) or not.
**Ideal path**: 3 — Connect Drive, pick folders, see them appear.
**Alternate paths**: Agents can use `drive_search` / `drive_read` tools on Drive directly (`packages/adapters/src/builtin-tools.ts:949-1010`), but results never enter the Data room.

### Steps
1. Open "Source" chip, sees "Google Drive" → chooses it → "No results".
2. Look for a connect button on the Data room → none.
3. Open Integrations, connect Google → Drive tools become available to agents; Data room unchanged.
4. Outcome: no Drive sync exists (planned phase 4, `docs/data-room/README.md:207`). Only manual download and upload works.

## STORY-022: Share the Data room with a cofounder

**Type**: short
**Topic**: Sharing (gap)
**Persona**: Founder whose cofounder joined the space and needs the same documents.
**Goal**: Let the cofounder see the documents.
**Preconditions**: S1; a second member "MOCK Sam Okafor" in the same space.
**Ideal path**: 2 — share folder, pick member.
**Alternate paths**: none found.

### Steps
1. Look for "Share" in the preview, "…" menu, or folder tree → none.
2. Cofounder signs in and opens Data room → sees their own (empty) Data room. V1 shows items only to the person who added them.
3. Outcome: founder must download and send files.

## STORY-023: Ask an agent about a contract

**Type**: medium
**Topic**: Agent tools over documents (gap)
**Persona**: Founder who wants a quick answer: "What's the notice period in our office lease?"
**Goal**: Get the answer from the stored lease without reading it.
**Preconditions**: S1; M2; consent recorded; any chat agent in the space.
**Ideal path**: 2 — click "Ask agent" on the preview, ask.
**Alternate paths**: Data room search with a question (semantic search returns a snippet, STORY-013); Download and read.

### Steps
1. Open the lease preview, look for "Ask" or "Chat about this" → none (planned "Ask agent", `docs/data-room/README.md:186-188`).
2. Open a chat with an agent and ask about "our office lease" → the agent has no `search_data_room` or `read_data_room_item` tool; it says it cannot see the document or asks for an upload.
3. Founder attaches the PDF to the chat instead → works through the chat attachment path, a separate copy outside the Data room.
4. Back in Data room, search "lease notice period" → with semantic search a snippet may show the clause highlighted.

## Redundancy Candidates

### Duplicate paths (same goal, multiple routes)
- Upload: "Choose files" (empty state), "+" "Add files" (header), drop on the Data room page, and drop on any page. All four call `uploadFilesToDataRoom` and land in the root; consistent result, but none upload into the selected folder.
- Item actions: the "…" menu appears on list rows, grid tiles, search results and the preview header, all opening the same Move / Rename / Delete dialogs.
- Choosing a folder: folder tree (wide) vs folder picker pill (narrow) vs Move dialog select. Same folder list, three widgets.
- Finding a document: folder browsing, free-text search, Type / Party / Date / Source chips, and sort by Type. Type filter and Type sort overlap with folders created by the classifier (`Finance / Invoices` vs Type "invoice").
- Restarting a failed item: only by re-uploading the identical file (hidden duplicate path); no visible retry.
- Consent: Settings "AI data sharing" switches and the (unbuilt in web) Data room consent cover similar ideas with different keys; a founder sees one and assumes it covers both.

### Duplicate information (same fact, multiple surfaces)
- Type, Date, Parties shown in the list row and again in the preview; status ("Reading", "Filing", "Failed") shown in the Type column, the row marker icon, the grid tile and the preview.
- Folder path shown in the preview "Folder" field, in the search results subtitle, the tree selection, and the narrow picker label.
- Source shown as an icon on each row (with tooltip) and as text in the preview and in search result subtitles.
- "Filed" in the upload toast vs "Filing" status in the list describe different moments with nearly the same word.

### Overlapping features/tools
- Data room vs chat attachments: both store files; dropping on the composer goes to chat, elsewhere to the Data room. Two destinations from the same gesture.
- Data room vs agent Drive tools (`drive_search`, `drive_read`): both "find a company document", with no link between them.
- Data room "Source" filter vs Inbox attachments: the filter lists Gmail, Drive, Chat, Finance, but only "Upload" is ever produced.
- Data room semantic search vs space-wide sidebar search (`Shell.tsx` SpaceSearchResults): the sidebar search does not include Data room items (verify during walk).

## Suspected problems

1. **No web UI grants Data room consent, so documents are never classified or filed.** The classifier skips silently when consent is missing (`packages/adapters/src/data-room-jobs.ts:323-328`), writing no error. `dataRoom.consent` / `dataRoom.consentGrant` exist (`packages/contracts/src/rpc.ts:1145-1146`, `apps/api/src/data-room.ts:239-283`) but nothing in `apps/web/src` calls them. The Settings "AI data sharing" switches (`apps/web/src/components/AiDataSharing.tsx:57-118`) use different keys than the `data-room:` key (`packages/adapters/src/data-room-models.ts:91-111`). A first-timer sees "ready" items with no type, no summary and no folders, and has no way to fix it.
2. **No way to create, rename, move or delete folders in the UI.** Folders come only from automatic filing (`packages/db/src/data-room.ts:776-778`), which depends on problem 1. API routes exist (`packages/contracts/src/rpc.ts:1125-1134`), but `ItemDialogs.tsx` and `FolderTree.tsx` offer nothing. Without consent the Move dialog lists only "No folder" (`apps/web/src/components/data-room/ItemDialogs.tsx:111-117`).
3. **Type and Party filters are exact, case-sensitive matches on free text.** A founder typing "Invoice" or "Acme" gets "No results" (`packages/db/src/data-room.ts:151`, `:175`; `apps/web/src/components/data-room/FilterBar.tsx:85-118`). Suggestions come only from the rows on screen (`apps/web/src/pages/DataRoom.tsx:289-290`), and types display as raw lowercase enum values (`ItemRows.tsx:156`, `Preview.tsx:116`).
4. **Uploads ignore the selected folder.** Dropping or choosing files while `Investors` is selected uploads to the root, and the item vanishes from the current view (`apps/web/src/components/data-room/upload-toasts.ts:94-95`, `apps/web/src/lib/data-room.ts:49`).
5. **Duplicate uploads look like successful new uploads.** The API returns `duplicate: true` (`apps/api/src/data-room.ts:430-433`), but the toast shows "Filed" anyway (`upload-toasts.ts:76-80`) and no new row appears. A different file name on the duplicate is dropped silently.
6. **The "Filed" toast appears before anything is filed.** It shows when the upload completes (`DropZone.tsx:141-152`), while the item is still "Pending". The list then says "Filing" for both classification and indexing (`format.ts:13-19`).
7. **The Source filter offers options that can never match.** "Google Drive", "Gmail", "Chat" and "Finance" are listed (`FilterBar.tsx:22-29`), but the only producer is upload (`apps/api/src/data-room.ts:436-438`). This implies imports that do not exist.
8. **Failed items have no retry.** The preview shows the error, and the menu has only Move / Rename / Delete (`ItemMenu.tsx:42-55`). "Couldn't classify" gives no reason or action (`Preview.tsx:112-114`).
9. **Delete has no permanence warning and no undo.** The dialog shows only "Delete {name}?" (`ItemDialogs.tsx:64`), and the stored file is removed about 60 s later (`apps/api/src/data-room.ts:229-236`).
10. **The name "Data room" sets an investor-sharing expectation the product cannot meet.** Sharing is owner-only in V1 (`docs/data-room/README.md:53-55`), and there is no Share control. The empty state also never explains what the room does (`DataRoom.tsx:266-278`).
11. **View and sort choices reset on every visit.** They are held in component state only, not in the URL or saved settings (`DataRoom.tsx:69-74`).
12. **The disclosure version is dated in the future.** `DATA_ROOM_DISCLOSURE_VERSION = "2026-10-22"` (`packages/contracts/src/data-room-api.ts:111`) is later than today (2026-10-16). It works as an opaque string but looks like a placeholder. Changing the model or embedding model also changes the consent key, which silently revokes consent (`data-room-models.ts:91`).
13. **"Embedding model" is a bare text field in model settings with no explanation** (`ModelSettingsOverlay.tsx:1563-1580`). A founder will not know that it controls Data room search quality, or what value to type.

## Gaps & Recommendations
- No stories for mobile; the Data room is not built there.
- Planned features (Data room agent, Ask agent, agent tools, Drive/Gmail sync, sharing) appear only as gap stories (020–023). Re-run this catalog when they ship.
- Verify during the walk: whether selecting a parent folder includes sub-folder items (STORY-011), and whether sidebar space search includes Data room items.
