# Topic: Data room, artifacts and agent pages

Native SwiftUI iPhone app (`apps/ios`), epic #427. Rewritten from the code in `DataRoom/*`, `Artifacts/*`, `AgentPages/*` and `Shared/SafeHTMLView.swift`, `Shared/SandboxedHTMLView.swift`. Nothing here was run on a device or simulator; steps say what the code does. All names, files and figures are invented.

Same information on several surfaces: a file's name, type and date appear in the Data room list row, the search-result row and the item screen. Failed-file errors appear in the list row and again on the item screen. An artifact appears in the Artifacts list (title, kind, "v2 of 3"), its own screen ("v2 of 3" strip and the Versions picker), and as a thread attachment. Delete exists in three places for a data room file (swipe, item screen toolbar, and search result swipe) and in three for an artifact (swipe, context menu, More menu on the detail screen).

## STORY-001: Browse the data room and open a PDF

**Type**: short
**Topic**: Data room, artifacts and agent pages
**Persona**: Maya Okafor, solo founder of a bookkeeping startup
**Goal**: Find the signed lease and read it.
**Preconditions**: Signed in; Data room row is not in `hiddenPages`; folder "Contracts" holds "Office lease 2026.pdf".
**Ideal path**: 3 — Data room, Contracts, file (a preview should open from the row).
**Alternate paths**: (a) Search at the top of the list, then tap the hit (skips the folder). (b) Deep link `rakazo://open/data-room` lands on the root. No other route to a single file.

### Steps
1. On Home, tap "Data room" in Pages → Root list opens, title "Data room". Sections: "Folders" (name, item count) and "Recently added" (name, type and date, e.g. "PDF · Oct 12").
2. Tap "Contracts" → A new list pushes with title "Contracts"; section label changes to "Files".
3. Tap "Office lease 2026.pdf" → Item screen: "Open" button, then rows Type, Size, Added, and a "Preview" text section if the server read text out of it.
4. Tap "Open" → Spinner beside the label; the file downloads to a protected temporary folder and Quick Look opens it.
5. Swipe or tap Done in Quick Look → Back on the item screen; the temporary file is deleted when the screen disappears.

### Variations
- The file is an image with a thumbnail: the item screen shows it above "Open" (max height 280) and the Preview text may be absent.
- Pull to refresh on the list reloads folders and items.

### Edge Cases
- Download fails (offline, 404): an alert titled "Data room" shows the error with OK; the spinner stops.
- The list holds more than one page: the next page loads when the last row appears; a failed page load shows the alert and retries on the next scroll.
- Folder has no files and no subfolders: "No files yet" with an "Add files" button (also inside a subfolder).

### Design gaps
- The item screen has no preview inline; "Open" is an extra step for every file type. Quick Look can take it, but the download is always full-size.

## STORY-002: Upload files and a photo, one fails and is retried

**Type**: medium
**Topic**: Data room, artifacts and agent pages
**Persona**: Tomas Lindqvist, operator of a two-person logistics software company
**Goal**: Add a signed contract from Files and a photo of a receipt, and recover from a dropped upload.
**Preconditions**: Signed in; inside folder "Receipts"; two files ready in Files and Photos; weak signal.
**Ideal path**: 4 — Add, Files, pick, done (progress and result in place).
**Alternate paths**: (a) Empty folder: "Add files" button opens the same Files picker (Files only; no Photos or folder option). (b) Photos and Files are both under the same Add (+) menu. No drag and drop or share-sheet entry.

### Steps
1. Tap the + ("Add") in the top bar → Menu: Files, Photos, New folder.
2. Tap "Files" → System file importer opens (any type, multiple allowed). Pick "Vendor agreement.pdf" and "Q3 invoice.pdf" → Each is copied to a protected temporary folder; an "Uploading" section appears at the top of the list with a name, percent and progress bar per file.
3. Tap + again, "Photos", pick a receipt photo → A third "Uploading" row appears (images and videos only).
4. Signal drops during "Q3 invoice.pdf" → Its row loses the percent, shows the error in red and a "Try again" button; the other rows continue.
5. Tap "Try again" → Progress resets to 0% and the upload restarts.
6. Upload finishes → Row disappears and the list reloads; the file appears under "Files" with "Reading…" and a mini spinner while the server indexes it.

### Variations
- Tap the X ("Cancel upload") on a row to drop it and delete its temporary copy.
- Upload a .zip: the row disappears and an alert says "Unpacking <name> in the background." Files show up later (the list is not refreshed again; pull to refresh).
- Upload a file already stored: alert "<name> is already in the data room."

### Edge Cases
- A file that cannot be copied shows an alert "Couldn’t read <name>." and the others still upload.
- Signing out, switching account or switching space cancels all uploads and deletes temporary copies silently; the user sees no message.
- Leaving the screen with uploads running: the model belongs to this screen, so the rows are gone on return (verify whether the task is cancelled or continues invisibly).
- Photo that fails to load: alert "Couldn’t read that photo."
- Retry is shown for any failure, including permanent ones such as "The server answered 413."

### Design gaps
- Failure text is the raw server or transport message; no hint whether retrying can help.
- No upload indicator outside the folder that was open; on another screen the user cannot see progress.

## STORY-003: Search the data room and open a hit

**Type**: short
**Topic**: Data room, artifacts and agent pages
**Persona**: Priya Raman, finance lead at a seed-stage startup
**Goal**: Find the paragraph about the notice period across all files.
**Preconditions**: Signed in; several indexed files.
**Ideal path**: 3 — type in search, read the snippet, tap the hit.
**Alternate paths**: (a) Failed-files filter shows only files that failed (no text search). (b) Search is per folder when started inside a subfolder (filters on that folder), so the same query gives different results at the root.

### Steps
1. Pull the list down or tap the search field ("Search") → Keyboard opens.
2. Type "notice period" → After 300 ms the list swaps to "2 results"; each row shows the name and a snippet, matched words in bold.
3. Tap the first hit → The item screen opens, with the Preview section.
4. Go back, clear the field → Browse list returns.

### Variations
- Hit with more results than one page: the next page loads at the last row.
- Swipe a hit left and tap the red Delete: same confirmation as in browse.

### Edge Cases
- No matches: system "No results for “notice period”" view.
- Search call fails: alert "Data room" and the list becomes empty (looks like no results).
- While the first search request runs, a centered spinner shows.
- Typing only spaces is treated as not searching.

## STORY-004: Fix failed files with the Failed files filter

**Type**: medium
**Topic**: Data room, artifacts and agent pages
**Persona**: Tomas Lindqvist, operator of a two-person logistics software company
**Goal**: See which uploads the server could not read and remove them.
**Preconditions**: Signed in; two files marked failed ("Scan 0042.tiff": "Couldn’t read this file"; "Cap table.xlsx").
**Ideal path**: 4 — Filter, Failed files, open or delete a row.
**Alternate paths**: (a) Browse and scan each row for the red line without the filter. (b) Open the file and read the error on the item screen.

### Steps
1. Tap the filter icon ("Filter") in the top bar → Menu with one toggle, "Failed files".
2. Turn it on → The icon fills, folders disappear, section label becomes "Files", and only failed rows remain, each with a red triangle and the error.
3. Tap "Scan 0042.tiff" → Item screen shows the same error in red under "Open" and no Preview.
4. Go back, swipe the row left, tap Delete → Dialog "Delete this file?" with "Delete Scan 0042.tiff".
5. Confirm → Row leaves the list. Turn the filter off.

### Variations
- Delete from the item screen: trash button in the top bar, dialog "Delete this file?" with "Delete"; success pops the screen.
- With the filter on and no failures: "No failed files" with a check mark.

### Edge Cases
- Filter is not shown as a chip; only the filled icon says it is on.
- No "retry reading" action exists. A failed file can only be deleted and uploaded again.
- The filter also applies to text search.
- Delete fails (network): alert with the error, the row stays.

### Design gaps
- No way to retry processing a failed file from the app.
- The Delete menu on the item screen is a bare trash icon at the top right, close to Back; confirm dialog title is the same "Delete this file?" as on the list.

## STORY-005: Allow AI to read the data room on first visit

**Type**: short
**Topic**: Data room, artifacts and agent pages
**Persona**: Maya Okafor, solo founder of a bookkeeping startup
**Goal**: Open the data room for the first time and decide whether AI may read the files.
**Preconditions**: Signed in; AI data consent for the data room not yet granted.
**Ideal path**: 2 — open the data room, Allow.
**Alternate paths**: (a) Settings, AI data sharing lists and revokes consent. (b) Dismiss with Not now and the sheet does not return until the app restarts.

### Steps
1. Tap "Data room" on Home → The list loads, then a half-height sheet "Let AI read your files?" opens, with a disclosure paragraph and one line per recipient (name and optional detail).
2. Read it, tap "Allow" → Consent is saved with its key and version; the sheet closes.

### Variations
- Tap "Not now" → The sheet closes and files still upload and open, but they are not read by AI.
- Swipe the sheet down: same as Not now.

### Edge Cases
- The consent check runs once per app run (a static flag), on the first screen that loads, whichever folder or Home entry that is. A second visit does not ask again, even when consent was not given.
- Granting fails: alert "Data room" with the error; the sheet stays open.
- Consent call fails on load: no sheet, silently skipped.
- "Not now" has no effect on what the user sees on the files (no label like "Not read"); the Reading… state will probably never end for new files (verify against the server).

### Design gaps
- The sheet appears over an already-loaded list rather than before it; users may have started scrolling.
- No path from this sheet to the revoke screen.

## STORY-006: Create folders and delete one

**Type**: short
**Topic**: Data room, artifacts and agent pages
**Persona**: Priya Raman, finance lead at a seed-stage startup
**Goal**: Make a folder "Tax 2026" at the root and remove an empty old folder.
**Preconditions**: Signed in; root has a folder "Old drafts".
**Ideal path**: 3 — Add, New folder, name, Create.
**Alternate paths**: (a) New folder is only in the Add menu (not in the empty state). (b) Folder delete is swipe-only; there is no folder screen menu.

### Steps
1. Tap + ("Add") → Menu opens.
2. Tap "New folder" → Alert "New folder" with a "Name" field, Cancel and Create.
3. Type "Tax 2026", tap Create → Folder appears in "Folders", sorted by name, count 0.
4. Swipe "Old drafts" left, tap Delete → Dialog "Delete this folder?" with "Delete Old drafts".
5. Confirm → Row leaves the list.

### Variations
- Create inside a subfolder puts the new folder under it (the list shows one level at a time).
- Empty or space-only name: Create does nothing (no message).

### Edge Cases
- Deleting a folder that holds files: what the server does with the files is not shown (the dialog does not mention them).
- Duplicate name: depends on the server; error appears in the alert.
- Subfolder count is not updated on the parent after upload until it is reloaded.

### Design gaps
- Folder-delete confirmation does not say how many files go with it.

## STORY-007: Read an agent's artifacts: list, image and PDF

**Type**: medium
**Topic**: Data room, artifacts and agent pages
**Persona**: Tomas Lindqvist, operator of a two-person logistics software company
**Goal**: Look at the charts and PDF the Ops agent made for the board update.
**Preconditions**: Signed in; bot "Ops" has 5 artifacts, including "Route cost chart" (image), "Board update" (PDF).
**Ideal path**: 4 — Ops thread, More, Artifacts, tap one.
**Alternate paths**: (a) Deep link `rakazo://open/bot/<id>/artifacts` or `rakazo://open/artifact/<id>`. (b) An artifact attachment in the thread. Group threads have no Artifacts entry.

### Steps
1. Open the Ops thread, tap the ellipsis menu, tap "Artifacts" → List titled "Ops artifacts", each row: title, kind ("Image"), date; a search field "Search artifacts".
2. Type "board" → The list filters by name; no match shows the search-empty view.
3. Tap "Board update" → PDF opens full-width in PDFKit, scaled to fit; share icon and an ellipsis menu in the bar.
4. Go back, tap "Route cost chart" → The image shows scaled to width inside a two-axis scroll view; there is no pinch zoom (verify).
5. Pull down on the list → Reloads all pages.

### Variations
- Artifact of kind other: "No preview for this file type", but Share still works if the server sent bytes.
- Markdown renders with the app's Markdown view; text shows monospaced and selectable.

### Edge Cases
- Zero artifacts: "No artifacts yet".
- Load fails: "Couldn’t load" with Try again.
- The list reads up to 10 pages (600 items) and no more.
- PDF or image bytes missing: the same "No preview" view appears, though the file may exist.

### Design gaps
- List rows do not show a preview thumbnail; every artifact looks the same except the kind word.
- Image does not zoom.

## STORY-008: Read an HTML artifact and see why it looks static

**Type**: medium
**Topic**: Data room, artifacts and agent pages
**Persona**: Maya Okafor, solo founder of a bookkeeping startup
**Goal**: Open an interactive dashboard the agent built as an HTML artifact and use its tabs.
**Preconditions**: Signed in; artifact "Cash forecast" of kind HTML containing a script-driven tab bar.
**Ideal path**: 3 — open the artifact, interact.
**Alternate paths**: (a) Same HTML as an Agent page runs scripts (SandboxedHTMLView). (b) The share sheet to open it in Safari.

### Steps
1. Open Artifacts for the agent, tap "Cash forecast" → HTML is rendered inside the page's own scroll view; the web view grows to its content height; the page scrolls as one.
2. Tap a tab in the page → Nothing happens: artifact HTML is shown with scripts off, a CSP of `default-src 'none'` and only inline styles and data:/https: images.
3. Tap a link in the page → Opens in Safari, only for http or https and only from a tap.
4. Tap the share icon → The share sheet offers the file named after the artifact (HTML source).

### Variations
- Same file as an Agent page: scripts run, no network, and the page is full-screen, not inside a scroll view.
- Dark mode: the HTML document is transparent with `color-scheme: light dark`, so unstyled content follows the system; a page with a white background stays white.

### Edge Cases
- Very tall HTML: the scroll view and the web view both own scrolling; height is measured once, so late layout changes may clip (verify).
- Wide tables are capped to the screen width.
- Sharing needs binary data; if the server sent only text, the share button may be missing (verify `detail.data` for HTML).

### Design gaps
- Interactive artifacts degrade silently; nothing tells the user that scripts are off. Same content behaves differently from the Agent page.

## STORY-009: Move between artifact versions and delete all of them

**Type**: medium
**Topic**: Data room, artifacts and agent pages
**Persona**: Priya Raman, finance lead at a seed-stage startup
**Goal**: Compare version 2 of the "Hiring plan" artifact with the latest, then delete the artifact.
**Preconditions**: Signed in; artifact has 3 versions; the list shows "Markdown · v3 of 3".
**Ideal path**: 5 — open, More, pick v2, read, Delete, confirm.
**Alternate paths**: (a) Delete from the list: swipe left or long press, Delete. (b) Open from the list at v3; older versions are only reachable through the More menu.

### Steps
1. Tap "Hiring plan" in the Artifacts list → Detail opens at the newest version; a strip reads "v3 of 3".
2. Tap the ellipsis ("More") → Menu has a "Versions" picker ("v3 · Today, 9:00 AM", "v2 · ..."), and Delete.
3. Pick v2 → The content reloads at that version; the strip reads "v2 of 3"; title may change with it.
4. Tap More, Delete → Dialog "Delete “Hiring plan”?" with "This deletes all 3 versions of this artifact. This can’t be undone."
5. Tap Delete → Screen pops back to the list; the row is gone (the list is not reloaded, so it stays until it refreshes; verify).

### Variations
- Only one version: no picker, no strip, and the message reads "This can’t be undone."
- Delete from the list: same dialog; success removes the row at once.

### Edge Cases
- Delete fails: alert "Couldn’t delete this artifact" with the message; user stays on the screen.
- Version list read fails: the picker is hidden with no hint.
- Delete while viewing v2 removes the whole family, not just v2.
- The Versions picker uses the family id from the route; selecting v1 then deleting still deletes the family.

### Design gaps
- No way to delete a single version and no way to compare two versions.

## STORY-010: Open an agent page, refresh a failed source and chat

**Type**: medium
**Topic**: Data room, artifacts and agent pages
**Persona**: Maya Okafor, solo founder of a bookkeeping startup
**Goal**: Check the Finance agent's page, notice a source warning, retry, and ask a follow-up in chat.
**Preconditions**: Signed in; Finance agent has two pages ("Runway" and "Invoices"); "Runway" has a metric block and a table whose source failed.
**Ideal path**: 4 — agent menu, Agent page, tap the warning, Retry.
**Alternate paths**: (a) Deep link `rakazo://open/bot/<id>/page`. (b) The "Open chat" button on the page returns to the thread. (c) Pages from Home: none; it is only in the thread's ellipsis menu.

### Steps
1. In the Finance thread, tap the ellipsis, tap "Agent page" → Page opens, title is the page title; Markdown shows text, metric rows (label and value) and a table; footer "Updated Oct 30, 2:15 PM"; "Open chat" button pinned at the bottom.
2. Tap the yellow triangle by the table (labelled "Source failed") → Popover shows the source error and "Retry".
3. Tap Retry → Sources rerun (up to 30 s); blocks keep old data if it fails again.
4. Tap the ellipsis ("More") → "Page" picker (shown when there are two or more pages), Share, and "Stop sharing" if this session shared one; pick "Invoices" → That page loads.
5. Tap "Open chat" → The Finance thread opens (pushes onto the stack, so Back from the thread returns here).

### Variations
- With "Hide amounts" on, dollar cells and chart text are masked.
- HTML page: full-screen sandboxed view, scripts on, no network, fed live data; the bottom inset still shows "Open chat".
- A paused source shows "Source paused" and no Retry.

### Edge Cases
- No page saved: "No page yet" and "Open chat" only; the More menu is hidden.
- Block placeholders when data is missing: "Waiting for approval", "Not approved", "Source not found", "Paused", "No data yet".
- Chart that fails to draw: "Chart could not be drawn."
- Picking a page while another is loading: the older response is ignored.
- "Open chat" opens a new thread screen even when the thread is underneath on the stack, so Back can show the chat twice.

### Design gaps
- The page screen has no control to refresh except the failure Retry; the pull-to-refresh reloads the page, not the live sources.
- "Open chat" duplicates the thread behind it when the user came from the thread.

## STORY-011: Share an agent page as a link and stop sharing

**Type**: short
**Topic**: Data room, artifacts and agent pages
**Persona**: Tomas Lindqvist, operator of a two-person logistics software company
**Goal**: Send a read-only link of the Ops page to an advisor, then turn it off.
**Preconditions**: Signed in; Ops page exists.
**Ideal path**: 4 — More, Share, send, More, Stop sharing, confirm.
**Alternate paths**: (a) Share an artifact file instead (artifact screen share icon): sends the file, not a link. (b) No Settings entry that lists active page links.

### Steps
1. Open the Ops agent page and tap More → Share → The server makes a link; the system share sheet opens with the URL.
2. Send it by Messages, close the sheet → Back on the page; More now has "Stop sharing".
3. Tap More, "Stop sharing" → Dialog "Stop sharing this link?" with Stop sharing and Cancel.
4. Tap "Stop sharing" → The link is revoked; the menu item goes away.

### Variations
- Share twice: each tap creates a link and replaces the one remembered for Stop sharing.
- Share is disabled while a request runs.

### Edge Cases
- Failure: alert "Something went wrong" with "Couldn’t share this page." or "Couldn’t stop sharing."
- Leaving and re-entering the screen forgets the link, so the menu no longer offers Stop sharing and the user has no way to revoke it from the app.
- Switching pages in the menu clears the remembered link.
- Server answers no link (null): nothing happens, no message.

### Design gaps
- No place to see or revoke existing links; Stop sharing only works in the same screen visit.
- The Stop sharing icon (`link.badge.plus`) looks like adding a link.
