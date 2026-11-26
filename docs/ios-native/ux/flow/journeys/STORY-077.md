# Journey critique: meetings (STORY-077, STORY-080, STORY-081, STORY-086)

Scope: record a team call (STORY-077), stop and wait (the Stop part of STORY-077/082), find the finished meeting and summary (STORY-081, STORY-086), tick a to-do (STORY-080). Evidence is Swift code and `docs/ios-native/ux/topics/meetings.md`; no device walk was done. Paths are under `apps/ios/Sources/Praci/`. "Measured" means counted or read from code. "Suspected" means it needs a device walk.

Verdict: **STORY-077 minimal** (three taps to start, one to stop), **STORY-081 convoluted when the user is not on the Meetings list** (acceptable when they are), **STORY-086 acceptable**, **STORY-080 minimal with two small hesitations**.

## 1. Friction scorecard

### STORY-077 Record a call (ideal 4: Record, Start, mic once, later Stop)

| Measure | Result | Evidence |
|---|---|---|
| Steps | Home "Meetings" row, Record, Start, later Stop = 4 taps (plus the system microphone prompt once). Matches ideal if Home to Meetings is not counted; counting it, 4. Measured. | `Home/HomeScreen.swift:218-222`; `Meetings/MeetingsScreen.swift:39-46`; `Meetings/RecordSheet.swift:85-89`; `Meetings/RecordingBar.swift:24` |
| Decisions | One optional: type a title. Default is "Meeting 2:05 PM" (`RecordSheet.swift:43-45`, `:106`). In a `confirm` space one required toggle (`:74-77`, `:87`). Measured. | |
| Re-entry | None. Space and policy come from the server (`RecordSheet.swift:19-30`). | |
| Confirmations | None. The footer "Tell everyone you're recording." is a notice, not a dialog (`:79`). | |
| Dead ends | If no speech-to-text provider is set up, the sheet shows only a link "Add speech to text" (`RecordSheet.swift:55-58`); the way on is clear. The sheet closes on Start and leaves the user on the Meetings list with the bar above it (`:108`). | |
| Hesitations | (a) Record is on the Meetings list only; Home has no shortcut (catalog Alternate paths for STORY-077), so a first-time user must know to open Meetings. (b) The Record button disappears while busy or when policy is off, with no hint why (`MeetingsScreen.swift:40`; `topics/meetings.md` STORY-012). (c) The sheet height is fixed at 230 or 280 pt (`RecordSheet.swift:66`), so the error line or larger Dynamic Type may clip (catalog finding 51, suspected, needs device walk). | |

### Stop and wait (STORY-077 steps 5-6, STORY-082)

One tap on the bar's Stop (`RecordingBar.swift:24`). The bar then dims and reads "Transcribing…" with no timer and no Stop (`:11`, `:14-15`, `:21`). The controller polls every 2 seconds until the server lists the meeting (`Meetings/CaptureController.swift:306-324`, `pollDelay` at `:85`). After that `storedCount` grows and `onStored(meeting)` runs. Measured. This is the right level of automation; the problem is the end of the wait, below.

### Find the finished meeting and summary (STORY-081, STORY-086, finding 11)

- **User still on the Meetings list:** 0 extra taps. `onStored` opens the meeting only when `app.path.last == .meetings` (`CaptureController.swift:112-115`), then the detail polls every 5 seconds and shows "Summarizing…" (`MeetingsModel.swift:72-93`, `MeetingDetailScreen.swift:66-69`). Ideal 2, actual 0 to 1. Measured.
- **User elsewhere (the usual case on a 45-minute call, STORY-086):** nothing opens. The bar vanishes: `endRecording()` runs before `onStored` (`CaptureController.swift:318-320`), no toast, no push (catalog finding 11; `topics/meetings.md` STORY-011 step 8). The user then needs Home, Meetings, tap the newest row = 3 extra taps, and must first realize the meeting exists. The state change is invisible, so this is the biggest hesitation in the journey. Measured for the missing signal; the "user does not notice" part is suspected, needs device walk.
- The summary also lands in two other places the user is never told about: the Hex agent thread and Data room > Recordings (`topics/meetings.md` STORY-006 steps 3-4, "same content on three surfaces"). The ideal in the catalog ("told in one place where the notes went") is not met. Measured from the topic file.
- A summary that never arrives: after 10 minutes the detail stops saying "Summarizing…" and shows only the subtitle (`MeetingsModel.swift:74` uses `< 600`), so a failed or empty summary looks like a blank screen (`topics/meetings.md` STORY-005 variations). Measured.
- STORY-086: while recording, the bar sits above Home and every pushed screen (`App/AppShell.swift:11-13`). Settings is a sheet outside that stack (`AppShell.swift:23-25`), so Stop is unreachable there (catalog finding 52, suspected for other sheets such as Compose; needs device walk). Mic and call buttons in the thread are disabled with no reason given (`topics/meetings.md` STORY-011 steps 3-4). Acceptable: the bar is the single control and it is where users look.

### STORY-080 Read a finished meeting and tick a to-do (ideal 3: open, scan, tap)

Open the row (1), scroll (scan), tap the circle (2). Matches. Measured: `MeetingDetailScreen.swift:59-112`. Optimistic toggle with rollback is good (`MeetingsModel.swift:100-113`). Friction points:
- Only the 44 pt circle toggles; tapping the to-do text does nothing (`MeetingDetailScreen.swift:92-110`). Suspected hesitation: users tap the text first.
- "Follow-ups" (plain text, no control, `:74-76`) and "Your to-dos" (tickable, `:77-79`) sit next to each other. A user may try to tick a follow-up, and both read as action lists. Suspected, needs device walk.
- The to-do list is below Decisions and Follow-ups, so on a long summary the only actionable section is off screen. Suspected.
- A failed save shows "Couldn’t save that", the same title as a failed delete (`MeetingDetailScreen.swift:50`; catalog finding 21). Measured.
- The same to-do may also appear in the Inbox "To do" card (same call, `MeetingsModel.swift:104`; not verified).

## 2. Take-away pass

**Meetings list** (`MeetingsScreen.swift:11-58`): rows show title and subtitle; search field; Record button. Nothing to remove. Search is hidden until pulled down, which is fine.

**Record sheet** (`RecordSheet.swift:69-91`): Title field, one footer line, Cancel, Start. Start is the one primary. The footer line is a required legal reminder; keep it. The title field is optional and the placeholder shows the default, so a user who ignores it is not blocked. Already minimal. No title edit exists afterwards, so a user who wants a name must decide before the call.

**Recording bar** (`RecordingBar.swift:8-36`): dot, title, timer, Stop. Timer is useful; "Offline, saved here" is relevant only when true. One primary (Stop, `glassProminent`). Minimal.

**Meeting detail** (`MeetingDetailScreen.swift:59-87`)
- First block mixes the date subtitle, a red partial warning, "Summarizing…" and the summary paragraph with no header. The summary is the main content and is unlabeled body text while smaller sections have headers; hierarchy is acceptable.
- "Summarizing…" is plain gray text with no spinner. A visible activity indicator would say "wait" without a word (suspected).
- Delete is a red text button in the nav bar for the whole life of the screen (`:22-29`). It is protected by a confirmation that guards something not undoable, so the dialog is legitimate (`:35-48`). The button is always visible and is the only toolbar item; a mis-tap is guarded. Acceptable.
- The transcript is behind a disclosure (`:80-84`). Good progressive disclosure.

## 3. The simpler version

1. Home, tap "Meetings" (or a Record shortcut, see JC-4).
2. Tap Record, then Start (microphone prompt once).
3. During the call use the app normally; the bar is visible.
4. Tap Stop on the bar. The bar shows "Transcribing…".
5. When the meeting is stored, wherever the user is, the bar shows "Meeting saved" with an Open button for a few seconds; on the Meetings list the meeting still opens by itself.
6. The meeting opens. To-dos are the first section after the summary. Tap a to-do anywhere on its row to tick it.

Changes to get there are in the Proposals below.

## 4. Clarity issues
- "Record" and "Add speech to text": the second tells the user nothing about why they see it instead of a title field (`RecordSheet.swift:56`). Suspected; one line of why costs copy (see AGENTS.md), so prefer to leave it unless the walk shows confusion.
- "Follow-ups" versus "Your to-dos": two names for next actions. Suspected confusion; the first is read-only.
- "Transcribing…" on the bar covers transcribing and storing; it can last longer than the name suggests on a weak connection (`topics/meetings.md` STORY-007). Suspected.
- "Couldn’t save that" for a failed delete (`MeetingDetailScreen.swift:50`). Measured.
- "Meetings" (nav and Home row) versus "Recordings" (Data room folder) for the same items. Measured from the topic file; not changed here.

## Proposals

| id | Problem and evidence | Proposal | Steps saved | Risk | Size | Device walk |
|---|---|---|---|---|---|---|
| JC-1 | STORY-081/086, finding 11: after Stop, if the user is not on the Meetings list, nothing signals that the meeting exists (`CaptureController.swift:112-115`, `:318-320`). The user needs 3 taps and the knowledge to look. | When `onStored` runs off the list, keep the glass bar for a few seconds with "Meeting saved" and an Open button that calls `app.open(.meeting(id:))`. Reuse the bar's existing capsule instead of a new toast. Optionally post a local notification when the app is in the background. | 3 taps and the "where is it" hesitation | Bar must not stack with another bar; timing of dismissal | M | y |
| JC-2 | STORY-080: only the circle toggles; the to-do text does nothing (`MeetingDetailScreen.swift:92-110`). | Make the whole row one button (keep the 44 pt circle as the visual). | 0 steps, fewer missed taps | Accidental toggles while scrolling | S | y |
| JC-3 | STORY-080: the only actionable section is third after the summary (`MeetingDetailScreen.swift:71-79`). | Move "Your to-dos" above "Decisions". Keep "Follow-ups" read-only after it. | Scroll distance on long meetings | Hides decisions slightly | S | y |
| JC-4 | STORY-077: Home has no Record shortcut, so every recording starts with Home, Meetings, Record (`HomeScreen.swift:218-222`). | Add a context-menu "Record" on the Home Meetings row that opens the same sheet through the existing route. Do not add a new Home control. | 1 tap for repeat users | Low discoverability; extra route state | M | y |
| JC-5 | STORY-081: after 10 minutes without a summary the screen shows only the subtitle (`MeetingsModel.swift:74`, `MeetingDetailScreen.swift:66-69`); failed and empty summaries look alike. | When there is a transcript but no summary and polling has stopped, show one muted line such as "No summary" (the only new word) and keep the transcript disclosure. | 0 steps; removes a blank-screen dead end | Adds one string | S | y |
| JC-6 | STORY-081: "Summarizing…" is text only (`MeetingDetailScreen.swift:66-68`). | Pair it with an inline `ProgressView` so the state reads as active. | 0 steps | None | S | y |
| JC-7 | STORY-080/084: a failed delete reuses "Couldn’t save that" (`MeetingDetailScreen.swift:50`; finding 21). | Give the delete failure its own alert title, "Couldn’t delete that". | 0 steps | None | S | n |
| JC-8 | STORY-086, finding 52: Stop is unreachable while a sheet (Settings, Compose) is open (`AppShell.swift:23-25`). | After the device walk confirms, repeat a compact bar inside Settings and Compose, or show Stop in the sheet's safe area. If rare, leave as is. | 1 close per stop from a sheet | Duplicate bars; layout | M | y |
| JC-9 | STORY-077: the Record button vanishes when busy or policy is off with no hint (`MeetingsScreen.swift:40`). | When busy, hide Record (as now) because the bar already explains; when policy is off, leave as is. No change unless the walk shows confusion. | 0 | None | S | y |
