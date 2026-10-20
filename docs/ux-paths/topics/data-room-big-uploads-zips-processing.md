# Data room: big uploads, zips and processing

Sources read: `apps/web/src/components/data-room/{DropZone.tsx,upload-toasts.ts,ProcessingStrip.tsx,ImportActivity.tsx,use-data-room-processing.ts,Preview.tsx,format.ts,ItemMenu.tsx,DataRoomImportMenu.tsx,DataRoomStats.tsx}`, `apps/web/src/pages/DataRoom.tsx`, `apps/web/src/lib/data-room.ts` (`uploadToDataRoom`), `packages/adapters/src/zip-unpack.ts`, `docs/data-room/README.md`.

Cross-story notes:
- The zip limit in code is 10,000 files (`ZIP_MAX_ENTRIES`, and the toast says "This zip has more than 10,000 files"). `docs/data-room/README.md` still says 1,000. The code and toast are treated as correct here; the README is stale.
- Upload toasts live in `DataRoomDropZone`, mounted for every signed-in page, so the same toast appears wherever the file was dropped.
- Retired: the 50 MB refusal toast. There is no size cap on direct upload.

## STORY-DRM-004: Drop one large board deck onto the Data room and watch the upload card (replaces the earlier story of this id, updated 2026-10-20)

**Type**: short
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, first-time founder of Northwind Robotics, preparing for investor diligence
**Goal**: Get a 700 MB recorded board meeting walkthrough PDF into the Data room and know when it is safely there.
**Preconditions**: Signed in; Data room open at All items; space has at least one item; file is on the desktop.
**Ideal path**: 2 — drag the file onto the window, then click "View" on the finished card.
**Alternate paths**: "Add files" toolbar button (file picker); empty-state "Choose files" button; drop on any other page.

### Steps
1. Drag the file over the window. → Full-window overlay with dashed box "Drop to add to Data room". Any open menu closes (an Escape is dispatched, unless a dialog is open).
2. Release over the page. → Overlay goes away. A card appears bottom right with the file name (truncated, full name on hover), a percentage such as "12%", and a thin progress bar. Maya thinks: "Is it really uploading, or frozen?" The percent ticking is her reassurance.
3. Wait until 100%. → Percent is replaced by an X (aria-label "Dismiss"). Line below shows "Uploaded" in green and a "View" link. The card auto-dismisses after 10 seconds, but not while her pointer rests on it.
4. Click "View". → Card closes and the item's preview opens. The row also appears in the list (Data room reloads on upload).

### Variations
- Dismiss with the X before it finishes: not available while uploading (the percent replaces the X). UNVERIFIED whether the upload can be cancelled; no cancel control exists in the card.
- Maya navigates to Inbox mid-upload: the card stays (drop zone is mounted app-wide).

### Edge Cases
- Maya hesitates at 100% while the file is still "Reading" in the list: "Uploaded" only means stored, not searchable. Processing is shown separately (see STORY-DRM-102).
- Closing the tab mid-upload loses the upload; no resume control found in code.
- Switching space or signing out clears all cards and stops reporting from running uploads.

## STORY-DRM-002: Choose several files with "Add files" and get one card per file (replaces the earlier story of this id, updated 2026-10-20)

**Type**: short
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics
**Goal**: Add a 409A report, a signed SAFE and a cap table export in one go.
**Preconditions**: Data room open, folder "Legal" selected in the folder tree.
**Ideal path**: 3 — "Add files", multi-select in the picker, confirm.
**Alternate paths**: Drag the three files onto the window; both go to the open folder.

### Steps
1. Click "Add files" in the toolbar (tooltip also "Add files"). → The OS file picker opens; it allows multiple selection.
2. Select three files and confirm. → Three separate cards stack bottom right, each with its own percent and bar.
3. As each finishes, its card changes to "Uploaded" plus "View". → Files appear in "Legal" because uploads go to the folder the page currently shows.

### Variations
- From a folder that is empty, the line "This folder is empty. Drop files here or add them." has its own outlined "Add files" button; same behavior.
- On the empty Data room, the button reads "Choose files" next to the Import menu.

### Edge Cases
- If the "Legal" folder was deleted in another tab, the card reads "This folder no longer exists" with a link "Upload to All items". Clicking it re-uploads the same file at the top level (see STORY-DRM-107).
- A file name the server rejects shows "Unsupported file name".

## STORY-DRM-101: Upload a zip of diligence documents and follow the card line by line

**Type**: medium
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics, handed a "Series A diligence.zip" (about 340 files, 1.2 GB) by her lawyer
**Goal**: Unpack the zip into the Data room without handling files one by one.
**Preconditions**: Data room open, All items. AI consent granted so tagging will run later.
**Ideal path**: 2 — drop the zip; wait for "Added 340 files".
**Alternate paths**: "Add files" and pick the zip; drop it on another page (same card).

### Steps
1. Drop the zip on the window. → Overlay "Drop to add to Data room", then a card named "Series A diligence.zip" with a percent and bar while the bytes upload.
2. Upload reaches 100%. → The server answers with an import id (HTTP 202). The card switches to an animated full-width pulsing bar and a shimmering line "Opening Series A diligence.zip". Maya thinks: "Has the upload finished? Why a new line?"
3. A second or two later (the card polls the import row every 1 second). → Line becomes "Found 340 files".
4. Files start landing. → Line reads "Adding 12 of 340 · term-sheet-v3.pdf", with the current file name changing.
5. All files are filed. → Line reads "Reading 40 of 340" while text is extracted for the first files.
6. Import finishes. → Card turns to green "Added 340 files" with "View". Autodismiss after 10 seconds.
7. Click "View". → Data room opens at its root; the new items are listed, many with the Reading state.

### Variations
- Only the card narrates this zip. The page-level import row ("Importing 12 of 340") deliberately leaves it out so the same import is not shown twice.
- Zip with folders: only files are counted; folders, `__MACOSX` and hidden files are skipped.

### Edge Cases
- If Maya reloads the page during step 4, the card is gone. The import itself continues on the server, and the import appears in the page-level "Importing X of Y" row, since the page no longer treats it as narrated. UNVERIFIED in a live browser.
- A zip that holds only files already in the Data room finishes with "Already in your Data room" instead of "Added N files".

## STORY-DRM-102: Read the processing strip and open Details

**Type**: medium
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics
**Goal**: After the zip lands, see how much is still being read and tagged, and decide whether to wait before asking the Data room agent questions.
**Preconditions**: STORY-DRM-101 just finished; 340 files, roughly 300 still in the pipeline.
**Ideal path**: 3 — glance at the strip, click "Details", close it.
**Alternate paths**: The Stats view shows a "Reading" and "Failed" count (see STORY-DRM-108).

### Steps
1. Look at the top of the list, below the path bar. → One slim line: shimmering "Processing 298 files", then a step word and file name such as "Reading board-minutes-2025.pdf". A thin bar along the bottom edge fills as the backlog shrinks.
2. Click the chevron button with aria-label "Details". → The chevron rotates and a list opens: "Reading text 120", "Indexing for search 60", "Tagging 118". Steps with a zero count are hidden.
3. Click it again. → The list closes. Maya thinks: "Reading, indexing, tagging: do I need all three?" The current-step word is the earliest step that still has files, so the word moves from Reading to Indexing to Tagging.
4. Keep working: search for "safe". → The strip stays; the list keeps refreshing (the page asks for a reload every 3 seconds while files remain).
5. The last file finishes. → Strip becomes "All files processed" for about 3 seconds, then disappears.

### Variations
- With "Hide amounts" on, the current file name is masked in the strip.
- If an import is also running (for example from the Import menu), the strip starts with a spinner and "Importing 10 of 40" followed by a dot and the processing count.

### Edge Cases
- The bar percent uses the largest backlog seen in this batch, so adding more files mid-run makes the bar jump forward rather than backward.
- If files fail, a line "N couldn't be read" sits in the strip. When nothing else remains, that line is all the strip shows and it does not offer a Retry (Retry is per item; see STORY-DRM-105).
- When only the "Reading" row hint shows on item rows, hovering shows the longer step title (for example "Indexing for search").

## STORY-DRM-103: A password-protected zip is refused before anything is added

**Type**: short
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics, received "payroll-2025.zip" from an outside accountant
**Goal**: Understand why her zip did not import and what to do next.
**Preconditions**: Data room open.
**Ideal path**: 2 — drop zip, read the red line.
**Alternate paths**: none found for entering the password in-app.

### Steps
1. Drop the zip. → Card shows upload percent as normal.
2. The server inspects the zip directory and answers 400 with code `encrypted`. → The card turns to a red line "This zip is password-protected" with an X. No import is queued and no "Opening" line appears.
3. Maya has no way to type a password. She dismisses the card (it also disappears by itself after 15 seconds) and unpacks the zip on her computer. → She drops the extracted files instead (STORY-DRM-002).

### Variations
- The same card shape appears for four more whole-zip refusals: "This zip has unsafe file paths" (entries that escape the folder, or symlinks), "This zip is too large to unpack" (bomb-like compression ratio or oversized directory), "This zip has more than 10,000 files", and "This zip can't be read" (damaged archive).
- Any other server failure shows the generic "Upload failed".

### Edge Cases
- The refusal arrives after the whole zip has uploaded, so a 3 GB protected zip wastes the full upload time first. Maya hesitates: "Could it have said so earlier?" No client-side check found.
- Nothing is added when a zip is refused; no partial results.

## STORY-DRM-104: A zip with 12,000 files and a zip with unsafe paths

**Type**: medium
**Topic**: data-room-big-uploads-zips-processing
**Persona**: A solo technical founder exporting a repository archive plus a downloaded customer data pack
**Goal**: Try to import two large archives and learn what the limits are.
**Preconditions**: Data room open; archive A has 12,000 small files; archive B was made on an unusual tool and holds a path starting with `../`.
**Ideal path**: 4 — drop both; read two red lines; split archive A into smaller zips.
**Alternate paths**: Drive or Box folder import for very large trees (Import menu), UNVERIFIED whether it has a file count limit.

### Steps
1. Drop archive A and B at the same time. → Two cards, each with its own percent.
2. Archive A finishes uploading. → Red line "This zip has more than 10,000 files".
3. Archive B finishes uploading. → Red line "This zip has unsafe file paths".
4. Maya re-zips A as three zips of 4,000 files and drops all three. → Three cards run in parallel: "Opening ...", "Found 4000 files", "Adding ...".
5. She waits; the three finish with "Added 4000 files" style lines. → The strip "Processing N files" covers all three zips together because it counts the whole Data room pipeline, not one zip.

### Variations
- Dotfiles and `__MACOSX` entries in the zip are skipped, so the counted total can be lower than the file count in Finder.

### Edge Cases
- The limit is checked against entries counted while reading the zip directory; whether skipped hidden files count toward 10,000 is UNVERIFIED.
- Three simultaneous zips make three polling loops (one request per second each). Slow machines may feel it; UNVERIFIED.

## STORY-DRM-105: A zip finishes but some files could not be read, then retry one

**Type**: medium
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics
**Goal**: After a diligence zip, find the one scanned file that failed and read it again.
**Preconditions**: Zip imported earlier; one 90 MB scanned PDF failed during ingest.
**Ideal path**: 4 — see the strip's failed count, open the failed row, choose "Try again".
**Alternate paths**: Right-click or the row's menu "Try again" without opening the preview.

### Steps
1. After the zip card says "Added 338 files", look at the strip. → "2 couldn't be read" is shown in the strip. (The plural form is the same for one or many.)
2. Look for the file in the list. → A failing row shows a red icon with label "Failed" and no longer shows the working "Reading" hint.
3. Click the row. → The preview shows the file viewer, then a red heading "Couldn't read this file" and the server's error text below it, if any.
4. Open the row's menu and choose "Try again". → A notice toast "Reading board-scan.pdf again" appears. The row goes back to "Reading".
5. The strip counts it again as "Processing 1 file", then "All files processed". → Maya thinks: "Good, but did it truly fix it?" If it fails again, the "couldn't be read" line returns.

### Variations
- "Try again" only appears in the menu when the item status is failed.
- Stats view card "Failed" shows the same count with a "Failed" entry in its status breakdown.

### Edge Cases
- A file that imports with `0` successes and only failures makes the zip card say "This zip can't be read" (red) instead of "Added 0 files". Maya sees the same red line as a damaged zip.
- If only some entries failed, the card says "Added N files" with no mention of failed ones; the failures show only in the strip and in the page import row, which skips narrated imports. So failed entries of a zip you watched appear on one surface only (the strip count).

## STORY-DRM-005: Upload a file that is already there (duplicate) (replaces the earlier story of this id, updated 2026-10-20)

**Type**: short
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics
**Goal**: Drop "SAFE-Acme-signed.pdf" again, not remembering she filed it last week.
**Preconditions**: Same bytes already in folder "Investors / SAFEs" as "Acme SAFE (signed).pdf".
**Ideal path**: 2 — drop; read "Already in ...".
**Alternate paths**: A zip full of known files (STORY-DRM-101 edge case).

### Steps
1. Drop the file while viewing All items. → Normal upload card with percent.
2. Upload ends. → No green "Uploaded". The card reads "Already in Investors / SAFEs as Acme SAFE (signed).pdf" with a "View" link. Maya thinks: "Good, no second copy."
3. Click "View". → Opens the existing item, not a new one.

### Variations
- Same name, same folder: line reads "Already in Investors / SAFEs" (no "as" part).
- Item at the top level with a different name: "Already in your Data room as Acme SAFE (signed).pdf".
- Item at top level with the same name: "Already in your Data room".
- Files are matched by contents (SHA-256), not by name.

### Edge Cases
- The folder path is looked up after the upload; if that lookup fails, the card falls back to the shorter "Already in your Data room" wording.
- The bytes still travel over the network in full before the duplicate is found (the server checks after the write), so a duplicate 700 MB file takes the full upload time.

## STORY-DRM-106: Large file that is stored but "Too large to search inside"

**Type**: medium
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics, with a 400 MB scanned PDF of the original incorporation binder
**Goal**: Find out why searching for a phrase from the binder returns nothing, though the file is listed.
**Preconditions**: A PDF over 50 MiB uploaded earlier and fully processed.
**Ideal path**: 3 — search by name, open item, read the small note.
**Alternate paths**: Data room agent ("Ask") also cannot read its text; UNVERIFIED how the agent words that.

### Steps
1. Type a phrase from inside the binder in the search field. → Result list says "No results" and, under it, "Search looks for these words in names and text."
2. Search for the file's name instead. → The row appears (still findable by name).
3. Click it. → The preview opens; the file viewer shows the PDF. Under the summary area a small gray note: "Too large to search inside". No red error and no "Try again".
4. Maya hesitates: "Can I fix this?" The UI offers no action next to the note. She splits the PDF into smaller files and drops them (STORY-DRM-002).

### Variations
- Text files over 5 MiB are read from their first 5 MiB at any size; they do not get this note.
- Video and other types with no reader are never read.
- Size in the row shows MB only (the formatter stops at megabytes), so a 3 GB file would read as thousands of MB; UNVERIFIED how it looks in a live row.

### Edge Cases
- This note does not appear while the item is still Reading, only when it is settled.
- Priority of notes in the preview: "Too large to search inside" wins over "Couldn't classify" and over "Not tagged yet..."; Maya may miss a tagging problem on the same file.

## STORY-DRM-107: Drop a file from another page, then recover when the folder is gone

**Type**: medium
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics, in the middle of reading email
**Goal**: Save an attachment she just downloaded without leaving the Inbox, and recover when the target folder has been deleted by a teammate.
**Preconditions**: Inbox open. Earlier she left the Data room with the folder "Q3 board" selected. A teammate deleted "Q3 board" afterwards.
**Ideal path**: 3 — drop on Inbox, see the card, click "Upload to All items" when told.
**Alternate paths**: "Add to Data room" on an email attachment chip (mail attachments are a separate flow).

### Steps
1. Drag a file from Finder over the Inbox. → The "Drop to add to Data room" overlay appears, unless a composer or other drop target on the page claims the drag first (then no overlay and no Data room upload).
2. Release. → Card appears with percent. Because Maya is not on the Data room page, the file goes to the top level. (The open-folder memory is cleared when she leaves the page.)
3. The upload completes. → "Uploaded" and "View"; "View" opens the item.
4. Later she goes back to the Data room, selects "Q3 board" from an old link, and drops a file there. → Card turns red: "This folder no longer exists" with a link "Upload to All items". The page reloads and falls back to All items.
5. Click "Upload to All items". → That card closes and a new card starts uploading the same file at the top level.

### Variations
- The "Add files" input in a sidebar-created folder path creates the folder first; if folder creation fails a notice shows the error text.

### Edge Cases
- Dropping a file on the compose box in the Inbox attaches it instead; both surfaces use the same drag, so Maya must watch for the overlay text.
- The 404 for a folder is the only 404 the upload can get, so the message is always about the folder.

## STORY-DRM-108: Stats view and failed counts while a batch is processing

**Type**: short
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, Northwind Robotics
**Goal**: See, in numbers, how much of the new batch is read and how many files failed.
**Preconditions**: Batch from STORY-DRM-101 still processing; Data room open.
**Ideal path**: 2 — toggle "Stats", read the cards.
**Alternate paths**: The processing strip's "Details" (STORY-DRM-102).

### Steps
1. In the view switch, click the "Stats" toggle (next to the list and grid toggles). → The list is replaced by Stats for the same folder and filters.
2. Read the status cards. → "Reading" shows files still working and "Failed" shows files that failed.
3. If the stats call fails, an error with a "Retry" button appears. Click "Retry". → Stats reload. If there is nothing, "No results" is shown.
4. Click the list toggle. → Back to the file list; the processing strip is still on top.

### Variations
- Stats count only the open folder and active filters, while the processing strip counts the whole Data room, so the two numbers can differ. Maya may think one is wrong.

### Edge Cases
- Stats are read only while shown; the 3-second refresh is for the list and strip. Whether Stats auto-refresh is UNVERIFIED.

## STORY-DRM-109: End-to-end diligence day, from zip to answered question

**Type**: long
**Topic**: data-room-big-uploads-zips-processing
**Persona**: Maya, first-time founder of Northwind Robotics, with a Series A investor asking for a data room by end of day
**Goal**: Get a 1.2 GB lawyer zip, a loose 600 MB walkthrough video, a duplicate SAFE and a protected payroll zip into one tidy Data room, then ask the Data room agent about it.
**Preconditions**: AI consent granted; embedding model configured; Data room has about 20 existing items; Gmail connected.
**Ideal path**: 14 — upload, wait on the strip, fix failures, sort, ask.
**Alternate paths**: Import menu (Email, Drive, Box) for the same documents without downloading.

### Steps
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

### Variations
- Maya on the desktop app: same page hosted by Electron; the OS file picker replaces the browser's.
- If AI consent is off: items settle without tags and the preview says "Not tagged yet. Files are tagged once you let Praci read documents; you can still search it by name and text."

### Edge Cases
- Many toasts at once stack above the bottom bar on phones; on wide screens they are 18rem wide at bottom right and can cover the lower right of the list.
- The same zip progress appears on one surface (its card) during the upload, then the processing strip takes over, then the final result is a plain list: three places tell the same story with different words ("Adding", "Processing", "Reading").

## STORY-DRM-110: Another import runs while the strip is showing

**Type**: medium
**Topic**: data-room-big-uploads-zips-processing
**Persona**: A solo technical founder with a Drive folder of 200 spreadsheets and a zip of PDFs
**Goal**: Understand why the same page shows a card for the zip but a different line for the Drive import.
**Preconditions**: Data room open; Drive connected. Import menu available.
**Ideal path**: 5 — start both, read the two surfaces.
**Alternate paths**: none found.

### Steps
1. Use the Import menu to import a Drive folder. → An import row begins: a spinner and "Importing 3 of 200" (page-level import activity).
2. Drop a zip of PDFs. → The zip gets its own card ("Opening ...", "Adding ..."). The page-level row ignores it.
3. Files from both begin to be read. → The two surfaces merge: the strip shows a spinner, "Importing 3 of 200", a dot and "Processing 40 files". The separate import row hides itself (it would repeat the same count).
4. Drive import ends. → An import row appears: "Imported 200 files" (or "Already in the Data room" if nothing new) plus up to three file names as links, with an X "Dismiss".
5. Click a file name link. → That file opens in the preview.
6. Click "Dismiss". → The row goes away.

### Variations
- Partial failures: the row also shows "Couldn't import 3 files".

### Edge Cases
- Dismissing the row only dismisses those imports for the list; whether the dismissal persists after reload is UNVERIFIED.
- Zip imports are never in this row, even after the card is gone, because the page treats the id as narrated for the session.
