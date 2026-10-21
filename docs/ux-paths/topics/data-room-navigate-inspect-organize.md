# Topic: Data room, navigate, inspect, organize

Code read: `apps/web/src/pages/DataRoom.tsx`, `pages/Shell.tsx` (renders it at `/app/data-room`, passes `agents`, `onSendToAgent`, `onAskAgent`), `components/data-room/{PathBar,ResizableFolders,FolderTree,DataRoomStats,Preview,PreviewActions,SendToAgent,ItemMenu,ItemDialogs,AutoSortDialog,ImportFromEmail (ImportSources),ImportFromDrive,FilterBar,ProcessingStrip,ImportActivity,ConsentPrompt,FolderDocuments,DropZone,upload-toasts}`, `components/SheetPreview.tsx`, `components/PdfViewer.tsx`, `lib/send-to-agent.ts`, `pages/CapTable.tsx` (~968).

Key facts from the code (used below):
- The folder is the only state in the URL: `/app/data-room?folder=<id>`. A document link is `/app/data-room?item=<id>`; it shows the item's folder and its preview. View (List/Grid) and sort are remembered in this browser. The folder column width (180 px minimum, default 244 px, at most half the body) and the preview pane width (320 px minimum, default 360 px) are remembered in this browser (localStorage).
- Header view switch has three toggles: "List view", "Grid view", "Stats". Stats is a third way to see the same folder and filters; picking List or Grid turns it off. The header also has "Import" (menu: "Email", "Google Drive", "Box"), "Add files", the hide-amounts button and (when the Data room agent is not already open) an Ask button for "Data room agent". On a short line the labelled buttons shrink to icons with tooltips.
- The folder tree (role tree, "Folders") shows only when the page body is at least 800 px wide. Below that, the FilterBar shows a folder picker pill, a "New folder" icon button and an "Auto-sort" icon button. Auto-sort and "New folder" also sit at the bottom of the tree.
- The Path bar ("Path") shows only inside a folder: "All items" then each folder as a link, current folder as plain text. More than 4 segments hide the middle ones behind a "Hidden folders" menu.
- The preview pane shows beside the list at 560 px body width or more; narrower, a click opens it in a dialog. Pane header: "Open in new tab", "Download", "Full screen" (only for a readable PDF, image or sheet), the "More actions for <name>" menu, "Close preview". Below the header: file name, the file, then summary, a note line, and fields Type, Date, Parties, Amount, Tags, Folder, Source, Size.
- A PDF is shown in the browser's own viewer with its toolbar hidden (`#toolbar=0`), so there is no in-app PDF toolbar; Open in new tab and Download are the pane's buttons. UNVERIFIED how the Electron app's embedded viewer behaves with that flag.
- Spreadsheets (csv, tsv, xls, xlsx) show in `SheetPreview` with a "Sheets" tab row, a "Load more" button and "This sheet is empty." Other types (for example Word) show a file icon only; the pane still shows facets. UNVERIFIED whether a separate Office or scanned-PDF preview exists beyond this; the code read shows only the file icon fallback in the pane.
- With "Hide amounts" on, PDF and image previews are replaced by "Hidden while amounts are hidden" (images: "Image hidden while amounts are hidden"), Amount shows a masked value, and Open in new tab is disabled.
- "Send to agent" is a submenu in the "More actions" menu (and the right-click menu) of a file, listing unarchived agents, most recently active first. It appears only when there is at least one agent. Agents that can read the Data room get the file by reference (chip in the composer, up to the per-message cap); agents without Data room tools (Carta, integration agents, or `read_data_room_item` disabled) get a downloaded copy as an ordinary attachment. The app then goes to that agent's chat (`/app/<botId>`). Failed copies produce "Skipped <names>" in the attachment notice.
- Auto-sort dialog: title "Auto-sort", plan with groups "Merge", "Move", "Rename", each change ticked, "Cancel" and "Apply". Nothing changes until Apply and only ticked rows are sent. Results toast: "Sorted # item(s)" with "Undo". Empty plan: "Already tidy." No model or no AI consent: "Turn on a model and allow AI access to sort files." with "Retry"; model error: "The model could not sort your files."
- Import menu: "Email", "Google Drive", "Box". A source that is not connected stays in the menu and navigates to its connect page (Gmail `/app/integrations/app/google/gmail`, Drive `/app/integrations/app/google/googledrive`, Box `/app/integrations?connect=box`). Gmail and Drive items are left out when the server catalog does not offer them. Box shows when anything is offered; it is considered connected when a Box MCP server exists.
- Information on more than one surface: folder (tree, folder picker, Path bar, preview "Folder" row, Move dialog); status (Status column, Stats "Status" card, tile line, Processing strip); type/party/source (filter pills, preview facets, Stats bars); the Cap table "Documents" list reads the Data room folder Finance / Cap Table.

---

## STORY-DRM-111: Find a file by walking the folder tree and path bar
**Type**: short
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya, first-time founder of Northwind Robotics, looking for the signed SAFE she filed last month.
**Goal**: Open the folder that holds the SAFE and get back to the top without losing her place.
**Preconditions**: Data room has folders Finance, Finance / Cap Table, Legal, Legal / Contracts and at least a dozen files. Window wider than 800 px.
**Ideal path**: 3 — click the folder, click the file, read the preview.
**Alternate paths**: Folder picker pill when the tree is hidden; type in "Search names and text"; deep link `/app/data-room?folder=<id>`.
### Steps
1. Open Data room in the sidebar → page header "Data room", the folder tree on the left starting with "All items", list on the right.
2. Click "Legal" in the tree → list shows Legal's files and sub-folder rows; the URL gains `?folder=<id>`; a Path bar appears above the list: "All items" (link) › "Legal" (plain text).
3. Click the sub-folder "Contracts" in the list's sub-folder rows (or in the tree) → Path bar reads All items › Legal › Contracts; the tree row is highlighted.
4. Click the file "Northwind SAFE - Harbor Ventures.pdf" → preview pane opens on the right with the file, Type, Date, Parties, Folder "Legal / Contracts".
5. Maya thinks: "Which folder am I in?" She reads the Path bar and the Folder row in the pane, and sees the same path twice.
6. Click "Legal" in the Path bar → the list shows Legal; the pane stays only if the file is still in the results, otherwise it closes (the page never picks another file for her).
7. Click "All items" in the Path bar → Path bar disappears (nothing at top level), the whole room shows.
### Variations
- Press browser Back after step 3 → returns to Legal (a folder she chose is a new history entry).
- Reload on step 3 → the same folder opens (URL holds it); the pane is closed because nothing is previewed until she picks a file.
### Edge Cases
- Deep path of more than 4 folders → Path bar shows All items, a "Hidden folders" "…" menu and the last two; she hesitates over the "…" button because it has no label until opened.
- A bookmarked folder that was deleted in another tab → toast "That folder no longer exists" and All items shows.

---

## STORY-DRM-112: Resize the folder column and keep it that way
**Type**: short
**Topic**: data-room-navigate-inspect-organize
**Persona**: A solo technical founder with long folder names such as "Board materials 2026 Q3".
**Goal**: Make folder names readable and have the width stick.
**Preconditions**: Page body at least 800 px wide, folders with long names.
**Ideal path**: 1 — drag the edge once.
**Alternate paths**: Keyboard on the handle; double-click to reset.
### Steps
1. Look at the folder column → names truncate with an ellipsis; hovering a name shows its full text as a tooltip (title).
2. Hover the right edge of the column → cursor becomes a column resize cursor and a thin line appears (handle "Resize folders").
3. Drag right → the column widens, no wider than half the page body.
4. Tab to the handle and press Left Arrow, Right Arrow, Home, End → width moves in 32 px steps, Home goes to 180 px, End to the maximum.
5. Double-click the handle → width returns to 244 px.
6. Reload → the last width is used.
### Variations
- Shrink the browser below 800 px body width → the whole column disappears; a folder picker pill, "New folder" and "Auto-sort" icon buttons appear in the filter row (see STORY-DRM-113). The saved width is not lost.
- Right-to-left language → arrow keys swap direction.
### Edge Cases
- Storage blocked → width lasts until the page closes (no message).
- Drag to the minimum → the column stops at 180 px; names are cut more.

---

## STORY-DRM-113: Navigate and organize on a narrow window
**Type**: medium
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya on a laptop with the sidebar open, so the Data room body is narrower than 800 px.
**Goal**: Reach a folder, create a new one and open a file without a visible tree.
**Preconditions**: Folders exist; browser width small enough that the body is under 800 px but over 560 px.
**Ideal path**: 4 — folder picker, New folder, name, Create.
**Alternate paths**: Make the window wider; use search.
### Steps
1. Open Data room → no tree; the filter row has a pill reading "All items" with a chevron, then two icon buttons.
2. Click the pill → radio menu of "All items" and every folder by full path (for example "Finance / Cap Table").
3. Choose "Finance / Cap Table" → pill shows the folder's own name; list shows its files; Path bar shows the path.
4. Hover the folder icon button → tooltip "New folder"; click it → dialog "New folder" with an input labelled "New folder name", an "Inside" selector and "Cancel" / "Create".
5. Type "Fundraising 2026" and press Create → toast "Created Fundraising 2026"; the new folder opens (it is empty: "This folder is empty. Drop files here or add them." with an "Add files" button).
6. Maya hesitates because the new folder was created inside the open folder (Inside defaults to the open folder, UNVERIFIED which value the selector starts with); she reads the Path bar to confirm.
7. Click "Add files" in the empty state → file picker; choose a PDF → upload toast appears; the file lands in this folder (files go into whatever folder is open).
### Variations
- Below 560 px body width: clicking a file opens the preview in a dialog titled "Preview" instead of a side pane.
- Name with a slash → inline error "Enter a folder name without slashes".
### Edge Cases
- Create fails (name in use or server error) → error text stays in the dialog; UNVERIFIED exact wording from the server.

---

## STORY-DRM-114: Stats view and drill into a result
**Type**: medium
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya, wanting to know what is in the room before a board meeting.
**Goal**: See counts by type, source and month, then jump to the matching files.
**Preconditions**: At least 20 files, mixed sources (Upload, Gmail, Google Drive), some tagged, one failed, one duplicate.
**Ideal path**: 3 — click Stats, click a bar, read the list.
**Alternate paths**: Use filter pills "Type" or "Source" directly.
### Steps
1. Click the "Stats" toggle (chart icon) in the header → list replaced by cards: Documents, Size, Searchable (percent), Failed; headed by the scope "All items".
2. Read "Documents over time" → month bars; hover shows "Oct 2026: 6". A small top-of-scale number sits at the left.
3. Read the Types, Sources, Top parties, Largest files, Status and Amounts cards → each is a bar list; Status shows Ready / Reading / Not searchable / Failed; a line "# duplicates" appears when duplicates exist.
4. Click the "Contracts" row in Types (label from the doc type) → Stats closes, List returns, the Type pill reads "Type: <name>", only matching files show.
5. Click "Stats" again → the scope header still says the folder or "All items" and shows "Clear filters" because a filter is on; counts now match the filtered set.
6. Click "Clear filters" → counts return to the whole room.
7. Click a row in "Largest files" → Stats closes and that file opens in the preview via `?item=`.
### Variations
- Click a month bar → the Document date pill becomes "Document date: Oct 1, 2026 – Oct 31, 2026".
- Open a folder first, then Stats → scope header shows the folder path; all counts are for that folder only.
- Hide amounts on → the Amounts card shows masked values and no bars.
### Edge Cases
- No documents match → "No results".
- Stats request fails → red error text with "Retry".
- Searching: the "Searchable" card equals Ready / Documents, so a room with many "Reading" files shows a low percent; Maya may read this as a failure (UNVERIFIED whether she would).

---

## STORY-DRM-115: Inspect a PDF: open in new tab, download, full screen
**Type**: medium
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya checking the signature page of a 40-page PDF.
**Goal**: Read the PDF at a usable size and keep a copy.
**Preconditions**: A ready, tagged PDF "Series Seed Term Sheet.pdf" in Legal / Contracts.
**Ideal path**: 3 — click file, click "Full screen", read.
**Alternate paths**: "Open in new tab"; "Download".
### Steps
1. Click the file → pane shows a "Preview" header, the file name as a heading, a skeleton box while it loads, then the PDF inside a frame about 60% of the viewport height.
2. Scroll inside the frame → the browser's PDF viewer scrolls; there is no toolbar in the frame (hidden on purpose, so no second Download or Print).
3. Hover the icons in the pane header → tooltips "Open in new tab", "Download", "Full screen".
4. Click "Full screen" → a nearly full-window dialog titled with the file name, with Open in new tab and Download icons and the PDF filling the dialog; it reuses the file already loaded, so there is no second wait.
5. Press Esc → dialog closes, pane remains.
6. Click "Open in new tab" → a new tab opens at once and shows the file; the tab title is the file name.
7. Click "Download" → the browser saves the file with its name.
### Variations
- In the Electron desktop app, if a new tab is refused, Open falls back to saving the file (UNVERIFIED which the walker sees).
- Hide amounts on → the frame is replaced by "Hidden while amounts are hidden"; Open in new tab is disabled; "Full screen" is not offered.
### Edge Cases
- File cannot be read → file icon in a grey box, no Full screen button.
- Download fails → red text under the pane header with the error.
- Failed file (status Failed) → Open in new tab disabled; Download still enabled.

---

## STORY-DRM-116: Preview a spreadsheet with several sheets
**Type**: short
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya, a founder reviewing a cap table export.
**Goal**: See each sheet without leaving the Data room.
**Preconditions**: A ready xlsx "Northwind Cap Table Export.xlsx" with sheets "Common", "Options", "SAFEs"; and a csv with more rows than the first page.
**Ideal path**: 2 — click file, click a sheet tab.
**Alternate paths**: "Full screen" for a wider grid; Download for Excel.
### Steps
1. Click the xlsx file → pane shows a bordered sheet viewer about half the screen high, with a "Sheets" tab row.
2. Click the "Options" tab → grid switches to that sheet.
3. Click "Full screen" → dialog with the same viewer at full size.
4. Close, select the csv, scroll to the bottom → a "Load more" button appears; click it → more rows load.
### Variations
- Pick another file then return → the viewer reloads per file (key is the item id).
### Edge Cases
- A sheet with no cells → "This sheet is empty."
- Load fails → "Could not load this file."; loading more rows fails → "Could not load more rows."
- A type the viewer cannot show → "Preview isn't available for this file type — download it to view it."
- A Word file → the pane shows only the file icon plus facets; UNVERIFIED whether any Office preview exists elsewhere.

---

## STORY-DRM-117: Send a document to an agent
**Type**: medium
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya, wanting her Legal bot to summarize a term sheet.
**Goal**: Start a chat with the file already attached.
**Preconditions**: At least two agents (a general agent, "Legal", and "Carta" integration agent); one PDF in the room.
**Ideal path**: 3 — open the file's menu, Send to agent, pick an agent.
**Alternate paths**: Right-click the row; the pane's "More actions" menu; ask in an agent chat with the file referenced.
### Steps
1. Hover the row of "Series Seed Term Sheet.pdf" → a "More actions for Series Seed Term Sheet.pdf" button shows.
2. Click it → menu: "Send to agent" (submenu), "Move", "Rename", "Delete".
3. Hover "Send to agent" → list of agents with avatars, most recently active first.
4. Choose "Legal" → app navigates to that agent's chat; the composer shows a file chip for the document (sent by reference because the agent can read the Data room).
5. Maya thinks: "Is it uploaded again?" The chip refers to the Data room file; no copy is uploaded.
6. Go back to Data room, repeat and choose "Carta" → the app downloads the file and attaches it as an ordinary attachment (Carta has no Data room tools). A moment of delay while it is copied.
### Variations
- Right-click on the row opens the same items.
- Open the pane's own menu: same items.
- No agents available → the "Send to agent" item is not shown at all.
### Edge Cases
- Copy fails → composer notice "Skipped Series Seed Term Sheet.pdf".
- Sending the same file to the same agent twice → the earlier chip for that agent is replaced, not duplicated.
- More files than the per-message limit are not possible here (one file at a time).

---

## STORY-DRM-118: Auto-sort a messy room, apply some, undo
**Type**: medium
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya after importing 40 unsorted attachments.
**Goal**: Let Praci propose folders, accept most, and reverse the batch.
**Preconditions**: Model configured and "Let Praci read your documents" allowed; many files at the top level; two near-duplicate folders "Contracts" and "Contract".
**Ideal path**: 4 — Auto-sort, review, Apply, done.
**Alternate paths**: The narrow-window "Auto-sort" icon button; none from the file menu.
### Steps
1. Click "Auto-sort" at the bottom of the folder tree → dialog "Auto-sort" with a loading line "Reviewing 40 files" and the file names shimmering.
2. Wait → each file's outcome appears in turn (for example "Move → Legal / Contracts", "No change"), within about 1.5 seconds of reveal, then the review replaces the list. Apply is disabled meanwhile.
3. Read the review → sections "Merge" (Contract → Contracts), "Move" (file with from → to), "Rename" (old name, "→ new name"). Every row is ticked.
4. Maya unticks one Rename she does not like → Apply stays enabled while at least one row is ticked.
5. Click "Apply" → dialog closes, list refreshes, folders reload; toast "Sorted 17 items" with an "Undo" link.
6. She dislikes the merge; click "Undo" → toast "Undid 17" (or "Undid 15, skipped 2" if some changed since); list reloads.
### Variations
- Click "Cancel" at step 3 → nothing changes.
- Only the first 300 newest classified files are planned; with more loaded, the list shows "+N more".
### Edge Cases
- Nothing to change → "Already tidy." and Apply disabled.
- AI not allowed or no model → "Turn on a model and allow AI access to sort files." with "Retry".
- Model failure → "The model could not sort your files." with "Retry".
- Plan request fails → red error with "Retry"; Apply failure shows the error under the list.
- Untick everything → Apply disabled.

---

## STORY-DRM-027: Rename, move and delete from menus and tree (folded into the existing story of this id, updated 2026-10-20)
**Type**: medium
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya tidying folders by hand.
**Goal**: Rename a folder, move a file into it, delete an empty folder, and learn why a full one is refused.
**Preconditions**: Folder "Misc" containing one file; empty folder "Old"; file "scan0012.pdf" at top level.
**Ideal path**: 3 per action — menu, dialog, confirm.
**Alternate paths**: Right-click on a folder in the tree; context-menu key or Shift+F10; "…" in the tree row (shown on hover or focus).
### Steps
1. Right-click folder "Misc" in the tree → menu "Move", "Rename", "Delete".
2. Choose "Rename" → dialog "Rename Misc" with the name field; type "Reference" and "Save" → toast "Renamed" with the new name; tree and Path bar update.
3. Click "More actions for scan0012.pdf" → "Move" → dialog "Move scan0012.pdf to" with a "Folder" select ("No folder", folders by path, "New folder…").
4. Pick "Reference" and Save → file leaves All items top level; if she is viewing "All items" it still shows with its Folder path.
5. Open the menu for "Reference" → "Delete" → dialog "The folder Reference isn't empty" explaining "It holds 2 items. Move or delete what is in it first; only an empty folder can be deleted." Buttons "Cancel" and "Open folder".
6. Click "Open folder" → the folder opens so she can clear it.
7. Delete the empty "Old" folder → "Delete the folder Old?" "This can't be undone." Click "Delete" → toast "Deleted" with "Old".
### Variations
- Choose "New folder…" in the Move dialog → extra field "New folder name" and "Inside" select; the new folder is created and the file moved in one step.
- Delete a file that backs a Legal contract → description adds "This also removes the Legal contract <title> ... and its links in the Legal graph. This can't be undone."
- Delete the previewed file → the pane shows its neighbour; the last item closes the pane.
- Delete the open folder → the parent opens.
### Edge Cases
- Name containing a slash → "Enter a name without slashes".
- Move into itself or a child → blocked options in the select (UNVERIFIED how they are shown).
- Server conflict on a non-empty folder → "Move or delete what is in this folder first."

---

## STORY-DRM-119: Import from Email, Drive and Box when some are not connected
**Type**: medium
**Topic**: data-room-navigate-inspect-organize
**Persona**: A solo technical founder who connected Gmail but not Drive or Box.
**Goal**: Pull a Gmail attachment into the open folder, then discover how to connect Drive.
**Preconditions**: Gmail connected, Google Drive not connected but offered, no Box MCP server. Folder "Finance" open.
**Ideal path**: 3 — Import, Email, pick, Import.
**Alternate paths**: Mail attachment chip "Add to Data room" in the Inbox; auto-file setting (different topic).
### Steps
1. Click "Import" (download icon with chevron) → menu "Email", "Google Drive", "Box".
2. Click "Email" → dialog "Import from email" with a "Search mail" box and a list of attachments from mail.
3. Tick two PDFs → the button changes from "Import" to "Import 2 files".
4. Click it → dialog closes; an Import activity strip "Importing 2 of 2" appears above the list, then a Processing strip counting files through "Reading text", "Indexing for search", "Tagging"; files land in "Finance".
5. Back in the Import menu click "Google Drive" → the app leaves the page and opens `/app/integrations/app/google/googledrive` (the Drive connect page), because it is not connected.
6. After connecting she navigates back; she hesitates because she lost her place unless she returns by the Back button.
7. Choose "Box" → goes to `/app/integrations?connect=box`.
### Variations
- Drive connected → dialog "Import from Google Drive" with "Search Drive", a "Back" button to leave a folder, files and whole folders; button reads "Import 3" after picking three.
- Box connected → "Import from Box" with "Search Box".
- Items already in the room → notice "Already in your Data room" instead of a strip.
- Catalog without Gmail or Drive → those two menu items are absent; Box always shows.
### Edge Cases
- Mail problem → text with "Reconnect" and "Couldn't load mail" fallback.
- Empty search → "No files found"; "Load more" for more results.
- Import started from the empty room: same Import control sits under "Drop files here" (see STORY-DRM-001).

---

## STORY-DRM-001: First arrival in an empty Data room (folded into the existing story of this id, updated 2026-10-20)
**Type**: short
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya on day one at Northwind Robotics.
**Goal**: Understand what the page is for and add the first file.
**Preconditions**: New space with no files and no folders.
**Ideal path**: 2 — "Choose files", pick a file.
**Alternate paths**: Drag a file anywhere in the window; "Import" menu in the card.
### Steps
1. Open Data room → header shows only "Data room" (no view switch, no Add files, no Import); a dashed card "Drop files here" with "Keep contracts, board decks and investor documents in one place."
2. Click "Choose files" → file picker; choose "Northwind Bylaws.pdf".
3. Upload toast shows progress; the page switches to the normal layout with the file in the list; header now shows the three view toggles, "Import" and "Add files".
4. A card reads that Praci does not tag files until it can read them ("Let Praci read your documents" with Allow, or the line about setting up a model in Settings if no model exists). Maya hesitates about sending text to an AI service.
### Variations
- Drag a file over the window → full-window drop target appears; drop → same as step 3.
- "Import" in the card → same menu as STORY-DRM-119.
### Edge Cases
- Upload fails → toast with a reason such as "Unsupported file name" or "Upload failed".
- A zip → toasts "Opening <name>", "Adding 3 of 120 · <file>", "Reading 10 of 120"; failures: "This zip is password-protected", "This zip has more than 10,000 files", "This zip is too large to unpack", "This zip has unsafe file paths", "This zip can't be read".
- Hide amounts is hidden until there are files.

---

## STORY-DRM-120: Cap table "Documents" list opens a file in the Data room
**Type**: short
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya, working on the Cap table page and wanting the signed SAFE.
**Goal**: See documents for the Cap table without opening the Data room first.
**Preconditions**: The Data room folder "Finance / Cap Table" holds at least one file; none for a second space.
**Ideal path**: 2 — scroll to Documents, click the name.
**Alternate paths**: Data room page, Finance / Cap Table folder.
### Steps
1. Open the Cap table page and scroll below the table → a "Documents" section with columns "Name", "Type", "Added" (Type hides on narrow widths); up to 10 newest files.
2. Click the name "Harbor Ventures SAFE.pdf" → app goes to `/app/data-room?item=<id>`, opens the "Finance / Cap Table" folder and shows the file's preview in the pane (or a dialog on narrow widths).
3. Click "Close preview" → focus returns to that row.
### Variations
- Upload or import via the Cap table page's own Import and Add files → the Documents list reloads (via a change event).
- Hide amounts on → file names that contain currency amounts are masked.
### Edge Cases
- Folder missing, empty or unreadable → the Documents section does not appear at all (no message).
- A deleted document link → toast "That document could not be found" and the query param is removed.

---

## STORY-DRM-121: Quarter-end clean-up, a long cross-feature journey
**Type**: long
**Topic**: data-room-navigate-inspect-organize
**Persona**: Maya, first-time founder of Northwind Robotics, preparing a data room for an investor diligence call at the end of Q3.
**Goal**: Import scattered documents, let Praci tag and sort them, check what is in the room, read a few files, ask an agent about one, and tidy the folders.
**Preconditions**: Gmail connected; Drive not connected; a model configured; the room holds 8 uploaded files at the top level; 5 PDFs with attachments in Gmail; the Cap table has an existing "Finance / Cap Table" folder; two agents exist ("Legal" and a general agent).
**Ideal path**: 18 — import, wait, auto-sort, stats, preview, send, tidy.
**Alternate paths**: Mail attachment "Add to Data room" from the Inbox; drag files in; ask the Data room agent instead of browsing.
### Steps
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
### Variations
- At step 4 she picks the dismiss option instead; a line "Praci doesn't tag new files." with "Let Praci read documents" stays as a quiet reminder.
- At step 7 with no model → "Turn on a model and allow AI access to sort files." and she cancels.
- Ask the "Data room agent" from the header at the start instead of browsing; agent button is hidden when its chat is already open.
### Edge Cases
- Auto-sort moves a file that was previewed → pane keeps it if still in results, otherwise closes.
- Unseen "Hide amounts" on during step 13 → PDF hidden; she must turn it off to read.
- Importing while processing → the Import strip is hidden and the Processing strip carries the "Importing x of y" line.
- Information repeated: the folder appears in tree, Path bar, preview "Folder" and Move dialog; status appears in the row, the Processing strip and Stats.

---

## STORY-DRM-036: Search inside a folder, then widen to all items (folded into the existing story of this id, updated 2026-10-20)
**Type**: medium
**Topic**: data-room-navigate-inspect-organize
**Persona**: A solo technical founder looking for a clause.
**Goal**: Find "indemnification" in Legal, then check the whole room.
**Preconditions**: Text-indexed files in Legal and Finance; one file in Finance also contains the word.
**Ideal path**: 3 — open folder, type, click "Search all items" if needed.
**Alternate paths**: Filter pills; Data room agent.
### Steps
1. Open "Legal" → file list.
2. Click "Search documents" (placeholder "Search names and text") and type "indemnification" → after a short pause the list changes to matching rows with highlighted snippets; a line "Searching in Legal" appears with a "Search all items" link; sub-folder rows are hidden while searching and the grid view falls back to the list.
3. Sort control now offers "Relevance" and "Document date".
4. Click the first result → pane opens; if the result set changes and drops the file, the pane closes rather than picking another.
5. Click "Search all items" → folder filter clears; results now include the Finance file with Source in its row.
6. Clear the search box → list returns at once (no wait), with the previous sort.
### Variations
- Add a Type pill filter while searching; pills show only values present in the open folder given other filters (no combination that yields nothing).
- Click the "x" on a pill ("Remove filter Type") to clear it.
### Edge Cases
- No match → "No results", "Search looks for these words in names and text.", and "Clear filters" when a filter is on.
- List request fails → red error with "Retry".
- Large result sets show "Load more".
