# Document scanner: paper in, PDF in the Data room

Status: S2 desktop scanner service, S3 Scanner page and S6 Scanner agent implemented (#1229). Wi-Fi (S4, S5) remains later. Epic #1051 (#1045–#1050, #1065). File references were read at `origin/main` (c2be84f24). Format follows `docs/omi/README.md`. Mockups: `docs/scanner/page-mockup/index.html` (screenshots and HTML snapshots edited from the running app).

## Decisions

Decided by the owner on 2026-11-01 unless marked open.

| # | Question | Decision |
|---|---|---|
| D1 | Which scanner? | Fujitsu/Ricoh PFU ScanSnap iX1600 first (the owner's), iX1500 next. Any scanner the open-source SANE `fujitsu` backend drives should work, but only the iX1600 has been tried. |
| D2 | USB or Wi-Fi? | USB first. Wi-Fi is researched in parallel and built later as its own phase (see "Wi-Fi"). |
| D3 | Where does the scanner code run? | The Praci desktop app (Electron main process). It already holds the signed-in session, so no new credential is needed. |
| D4 | How does a scan start? | Both, with a switch: **Scan when paper is loaded** (on by default) and a **Scan** button in the app. The scanner's own touch-screen Scan button is still being investigated (S0). |
| D5 | Where do scans go? | A "Scans" folder at the top of the Data room, created on first use with `ensureDataRoomFolder` (`apps/web/src/lib/data-room.ts`). The folder can be changed in the scanner panel. Filing into "whichever folder is open" is not used: an automatic scan can happen while any page is open. |
| D7 | A page of its own? | Yes (2026-11-02): a **Scanner** page in the sidebar, laid out like Legal, with its own **Scanner agent** docked on the right like every page agent. |
| D8 | What is a scan in the Data room? | An ordinary Data room document with `source: "scan"`, filed into "Scans". The Scanner page lists every `source: "scan"` item wherever it is now, so moving one to Legal / Contracts keeps it on the page. |
| D6 | How does the desktop app get SANE? | v1 requires Homebrew `sane-backends` on macOS (or the distro package on Linux) and says so when it is missing. Bundling `libsane` into the signed app is a later step if the owner wants zero setup. |

## Summary

The user plugs the scanner into the Mac by USB and opens the Praci desktop app. The Data room shows the scanner as connected. The user puts paper in the feeder. About two seconds later the app scans both sides of every sheet, drops blank pages, makes one PDF, and uploads it to the "Scans" folder. The existing upload toast says "Uploaded to Scans" once the server has stored the file; the app also checks that the stored SHA-256 matches the PDF it made before deleting its local copy. The document then goes through the Data room's normal reading and indexing, and shows as ready like any upload. If the upload fails, the PDF stays on the Mac and is sent again; nothing is lost silently.

## User story

- **Faster.** No vendor app, no save dialog, no drag and drop. Paper in, document filed.
- **Simpler.** One switch and one button. The scanner either says it is connected or says what is wrong.
- **Certain.** The local copy is deleted only after the server confirms it stored exactly the bytes that were scanned; a mismatch shows an error and keeps the PDF.

## What is confirmed

### Hardware test on the owner's iX1600 (2026-11-01, macOS 15 on Apple Silicon, USB, ScanSnap Home not running, Homebrew `sane-backends` 1.4.0)

| Fact | Result |
|---|---|
| `scanimage -L` finds the scanner (`fujitsu:ScanSnap iX1600:<serial>`) | Works |
| Sources `ADF Front`, `ADF Back`, `ADF Duplex`; modes Lineart, Halftone, Gray, Color; 50–600 dpi | Read from `scanimage -A` |
| `page-loaded` sensor turns on when paper is put in the feeder | Works |
| `scanimage --source "ADF Duplex" --mode Color --resolution 300 --format=jpeg --batch` scans every side and stops with "Document feeder out of documents", exit code 0 | Works: two sides, 2550×3300 px each (US Letter at 300 dpi), upright and readable |
| `--swskip` (software blank-page skip) | Accepted; whether it dropped a real blank side was not tested |
| Touch-screen Scan button | Shows "ScanSnap is not responding" (it hands the press to ScanSnap Home). The SANE `scan` sensor never turned on in a 1 s poll. Under investigation (S0) |

### From SANE sources (not tried here)

- The `fujitsu` backend lists the iX1500 (`04c5:159f`) and iX1600 (`04c5:1632`) in `fujitsu.conf` (sane-backends 1.4.0).
- Only one program can hold the scanner. ScanSnap Home, if running, blocks SANE.
- The backend has no network support; Wi-Fi needs a separate client (see "Wi-Fi").
- The iX1500/iX1600 screen may dim after about 13 minutes on USB without vendor software; a tap wakes it (one project's report, `appositeit/panelbeater`).

## Design

### Desktop main process: scanner service (`apps/desktop/src/scanner.ts`)

- **Find SANE.** Look for `scanimage` on the usual paths (`/opt/homebrew/bin`, `/usr/local/bin`, `/usr/bin`). Missing → state `sane-missing`.
- **Find the scanner.** `scanimage -L`, keep `fujitsu:` devices. None → `not-found`. "Device busy" → `busy` (another app has it).
- **Watch the feeder.** While the app is open and auto-scan is on, read `page-loaded` once a second with `scanimage -d <dev> -A`. When it has been on for 2 s, scan. After a scan, wait for `page-loaded` to go off before arming again, so a jam does not cause a loop; keep a failed-scan error visible until the feeder clears or the user explicitly scans again.
- **Scan.** `scanimage -d <dev> --source "ADF Duplex" --mode Color --resolution 300 --format=jpeg --batch=<tmp>/page%03d.jpg --swskip <n>` into a fresh temporary directory. Exit 0 with at least one page → success, named `Scan YYYY-MM-DD HH.mm.pdf` in local time. Any other end (jam, double feed, cover open, cancelled) → no upload, pages deleted, state `error` with the reason; the user reloads and scans again. A partial document is never filed.
- **Make the PDF.** A dependency-free writer embeds each JPEG unchanged as a DCTDecode image on its own page, sized from the JPEG's frame header at the scan resolution. Unit-tested against fixture JPEGs.
- **Outbox.** The PDF and its SHA-256 metadata are fsynced together in a private staging directory under `<userData>/scan-outbox/`, then atomically published as a UUID-named ready bundle. Metadata binds each bundle to its user, space and server origin; staging entries are never replayed. After the renderer sets the signed-in scope, only matching pending bundles are replayed or returned by `pending()`. The local PDF is deleted only after `confirm(id, storedSha256)` verifies the recomputed local hash, stored hash and unchanged scope.
- **Settings.** Auto-scan on/off and target folder are machine-local in a separate private `scanner-settings.json`, written with the private-file primitives in `apps/desktop/src/setup-store.ts`. The default folder is `Scans`; folder segments use Data Room names such as `Legal/Employment Contracts`. Resolution and color mode are fixed at 300 dpi and Color for v1.

### IPC

Exposed on `window.rakazoDesktop.scanner` in `apps/desktop/src/preload.cjs`, only on macOS and Linux:

- `state()` and `onState(listener)`: `{ kind: "sane-missing" | "not-found" | "busy" | "ready" | "scanning" | "error", device?, error?, autoScan, folder }`.
- `scan()`: start a scan now. `cancel()`: stop a running scan; nothing is filed.
- `setAutoScan(on)`, `setFolder(path)` using Data Room folder names.
- `onDocument(listener)` and `pending()`: deliver/recover `{ id, name, bytes, sha256, pages, folder, userId, spaceId }`.
- `setScope({ userId, spaceId } | null)`: main treats renderer IDs as claims and verifies them through the app window's Electron session with `POST <trusted-origin>/rpc/me`, body `{"json":null}`, and `x-rakazo-space-id` set to the claimed space. Scope is accepted only when the response's `json.userId` and `json.spaceId` exactly match. Scan triggers, `pending()`, `confirm()`, and document delivery revalidate the session. Navigation forgets that window's claim; explicit `null` forgets it as well. Session-cookie changes and restored server switches clear scope, then reauthenticate the saved claim when possible; stale verification results are rejected.
- `confirm(id, storedSha256)`: main deletes the outbox file only when local and stored hashes match the unchanged scope.

### Scanner page (`/app/scanner`)

Built from the Legal page's parts (`apps/web/src/pages/Legal*`, the docked agent panel and the list rows), shown in the mockups:

- **Header:** "Scanner", the space switcher, a status line ("ScanSnap iX1600 · Scans when paper is loaded", "Scanning · page 3", "No scanner found", "Install sane-backends with Homebrew" with **Copy command**), a **Scan** button, a ⋯ menu with the **Scan when paper is loaded** switch and "Save to Scans · Change", and **Ask** for the Scanner agent.
- **List:** every `source: "scan"` item, newest first: the name, the folder it is in now, and "date · pages · type". A scan in progress shows as a top row ("Scanning…", "3 pages so far"); a new upload shows the Data room's existing "Reading" state until it is ready. Search and Type and Folder filters reuse the Data room's list parameters.
- **On web, mobile and Windows** the page still lists scans and the agent still answers; the header shows no status, and **Scan** and the ⋯ menu are hidden, because only the desktop app can reach the scanner.
- **Upload:** each delivered PDF goes through the existing `uploadFilesToDataRoom` (`apps/web/src/components/data-room/upload-toasts.ts`) into `ensureDataRoomFolder(["Scans"])` with `source=scan`, so progress, stalls, retry, duplicates and the folder toast are the ones every upload already has. Its `onUploaded` callback compares the item's `sha256` with the PDF's and calls `confirm`. A mismatch shows an error toast and leaves the PDF in the outbox.
- **Name** on arrival: `Scan 2026-11-02 09.31.pdf` (local time) until the Scanner agent names it.

### Scanner agent

A page agent like the Legal agent: spawn key `scanner-agent:<userId>` (one per user per space), created the first time the Scanner page opens, docked on the page, listed under Page agents.

- **After each scan is read**, a run names it ("MOCK Signed NDA - Bolt Freight"), sets its Data room type, and posts one line in the page chat ("Scanned 3 pages and saved them to Scans as …").
- **On request**, it answers questions about scans and hands a scan to another page agent ("Send it to the Legal agent"); filing into another folder is that agent's job or the user's.
- **Tools:** `search_data_room` and `read_data_room_item` limited to `source: "scan"` items, plus the existing Data room rename and set-type operations on those items. Handing a scan to another agent reuses the existing agent-to-agent message path, passing only the item id; which tool that is gets confirmed in S6. No mail, web, files or delete.
- **Untrusted text:** a scanned page can contain anything, including instructions. Scan text is wrapped as untrusted when given to a model, the agent's only writes are a rename and a type on the scan itself, and anything else needs the usual approval card.
- AI-data consent gates its runs, as for the Data room's own reading.

### Server

The signed-in web shell delivers pending desktop documents even when the Scanner page is closed. It captures the user, space and destination, uses the shared upload toasts, and retries transient failures every 30 seconds and when the network returns. A missing or mismatched server digest stops automatic retries for that document; **Retry pending scans** tries it again. The server rejects an `expectedUserId` that no longer matches the session before accepting the bytes. Signing out, changing scope or leaving the page cancels the renderer's delivery; only `confirm` can remove a verified local bundle.

The Scanner page reuses the Data room list, search, filters and preview with the source fixed to `scan`. Web and Windows show the same documents and agent without USB controls. Expo and native iOS expose a scan-filtered list and open the Scanner agent using their native navigation; they do not attempt to control hardware.

- Let `POST /api/data-room/upload` take `source=scan` (only `upload` and `scan` are accepted from that route) so scans are marked at the source.
- Add `sha256` to the Data room item returned by `POST /api/data-room/upload` and to `DataRoomApiItemSchema` (`packages/contracts/src/data-room-api.ts`, `itemDto` in `apps/api/src/data-room.ts`). The column already exists (`data_room_items.sha256`). No other server change: the route, storage, dedupe and ingest are reused.

### Security and tenancy

- The upload uses the signed-in session and the selected space, exactly like "Add files". No token is stored by the scanner service.
- The outbox holds documents on the user's own disk until confirmed; a confirmed file is deleted. Signing out or switching space stops delivery, and files wait until the same user, space and server origin are selected again.
- No scanned content in logs or error strings.

### Surfaces

| Surface | Behavior | Reason |
|---|---|---|
| Desktop, macOS | Full feature | USB scanner on the user's machine |
| Desktop, Linux | Same code; untested | SANE is native there |
| Desktop, Windows | Page and agent; no Scan button or status | No SANE; would need WIA or TWAIN |
| Web, mobile, iOS | Page and agent; no Scan button or status | A browser or phone cannot reach a USB scanner |

## The touch-screen Scan button (S0)

On USB, the iX1600 sends its Scan press to ScanSnap Home and shows "not responding" without it. To try:

1. Log every SANE hardware sensor while pressing the button. A first 4-minute log on 2026-11-01 (about 22 reads a second) saw no change except the scanner waking, but the paper sensor never turned on either, so the button was probably not pressed during it. Run again with someone at the scanner.
2. If nothing changes, the press is a vendor-specific USB message. Capturing it would need a USB trace on macOS, which is not practical without extra tools; stop there for USB.
3. On Wi-Fi the button is documented to work without ScanSnap Home (below), so the button may only come with the Wi-Fi phase.

## Wi-Fi (later phase)

Research summary (2026-11-01, from source; nothing run on hardware):

- **iX1500: feasible.** Two independent reverse-engineered projects scan and receive Scan-button presses over Wi-Fi: `elte0/scansnack` (MIT) and `appositeit/panelbeater` (GPL-2.0). They agree on the protocol: UDP 52217 discovery, TCP 53219 control, TCP 53218 scan channel tunnelling SCSI commands, a UDP datagram to the selected host on a button press, JPEG pages.
- **iX1600: unconfirmed.** No project has tested it.
- **Pairing** needs no key from ScanSnap Home: the app registers itself, then the user taps it once on the scanner's screen.
- **Wi-Fi and USB are exclusive**: an active Wi-Fi registration breaks USB scanning, and a USB cable blocks Wi-Fi registration.
- **No encryption or authentication.** Anyone on the LAN can register, trigger scans and, if selected, receive pages. Only on a trusted network.
- **Effort:** about 1,200–1,800 lines of TypeScript in the main process, ported from scansnack (MIT, keep its notice). panelbeater is GPL and may be read as protocol documentation only; no code is copied from it.
- **Gate:** before any Wi-Fi code, run scansnack's CLI once against the owner's iX1600 in a throwaway checkout (claim, scan, listen).

## Slices (one PR each)

| Slice | Scope | Depends on |
|---|---|---|
| **S0 Button probe** | Finish the sensor log for the touch-screen button; record the result here. Not merged code. | owner's scanner |
| **S1 Stored hash and scan source** | `source=scan` on the upload route; `sha256` on the upload response and `DataRoomApiItemSchema`; API test that the returned hash equals the uploaded bytes' hash; regenerate the API spec. | — |
| **S2 Desktop scanner service** | `scanner.ts` (SANE lookup, device list, feeder watch, scan, PDF writer, outbox), settings, IPC and preload. Unit tests drive a fake `scanimage` script (fixture JPEGs, empty feeder, jam, busy, missing SANE) so they run offline. | — |
| **S3 Scanner page** | Sidebar page, header states, ⋯ menu, scan list with filters, in-progress row; upload through `uploadFilesToDataRoom`; hash check and `confirm`; desktop-only controls hidden elsewhere. Storybook stories for every state with a mocked `rakazoDesktop.scanner`; E2E screenshot of the page. | S1, S2 |
| **S6 Scanner agent** | Spawn key, provisioning on first visit, docked chat, naming and typing each new scan, scan-only Data room tools, untrusted wrapping, hand-off to another page agent. Tests: exact tool set, an injection line in a scan cannot act beyond rename and type, a run per new scan. | S1, S3 |
| **S4 Wi-Fi gate** | Run scansnack against the owner's iX1600; record the result here. Not merged code. | owner's scanner |
| **S5 Wi-Fi client** | TypeScript client in the main process, pairing flow, button listener, same outbox and IPC. | S2, S4 passing |

### Offline S2 scanner fixture

The desktop unit tests and later cloud Electron acceptance can use
`apps/desktop/src/fixtures/bin/scanimage` without SANE hardware. Put that directory
first on `PATH` and set `RAKAZO_FAKE_SCANIMAGE_SCENARIO` to a JSON scenario file:

```json
{
  "pageLoaded": "on",
  "pages": ["page-one.jpg.b64", "page-two.jpg.b64"]
}
```

Use `"pages": []` for an empty feeder, `"busy": true` for a device held by another
app, or `"scan": { "exitCode": 1, "stderr": "Paper jam" }` for a failed batch
that leaves a partial page. `"scan": { "hold": true }` holds a scan until the
service cancels it. Fixtures are invented JPEG test patterns, not scanned
documents.

Hand test for S2 and S3: the owner's iX1600 on USB with the desktop app pointed at a demo stack (`DEMO_SLOT=<n> pnpm demo:up`), never the live stack. Load paper, see the in-progress row and the toast, see the Scanner agent name the scan, open the PDF in the Data room, check both sides are there. Unplug mid-scan and check nothing partial is filed. Stop the API mid-upload and check the PDF is sent again after it returns.

## Mockups

`docs/scanner/page-mockup/index.html`. Each frame was made by editing the running demo app's own page (Legal, its docked agent, the Data room) in the browser, so the sidebar, header, rows, chips, menus and chat are the app's real elements with invented MOCK data. Frames: ready with the Scanner agent open; scanning; a new scan being read; no scanner found; sane-backends missing; the Data room's Scans folder; the ⋯ menu. Known differences from a real build: the ⋯ menu was moved by hand under its button, and the composer placeholder "Message Scanner agent" is cut off by the real composer width.

## Not built

- ScanSnap Home profiles, OCR text layer (the Data room already reads scanned PDFs), deskew or crop beyond what SANE does, SV600 and iX2500 (not supported by SANE), Windows.
