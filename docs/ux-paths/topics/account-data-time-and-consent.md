# Topic: account-data-time-and-consent

Source: Settings > General cards (`DataExport.tsx`, `AiDataSharing.tsx`, `NotificationSettings.tsx`, time zone picker in `AccountSettingsOverlay.tsx`), approval cards (`AskCard.tsx`, `approval-ask.ts`, `schedule-tools.ts`), `lib/local-timezone.ts`, `Shell.tsx`, `RoutineEditor.tsx`. Not walked in a browser.

## STORY-APP-343: Request and download my data export
**Type**: medium
**Topic**: account-data-time-and-consent
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Get a zip of everything Maya owns before she decides whether to keep using Praci.
**Preconditions**: Signed in with a password account (maya@northwind.example.test); no export yet; Settings open on General.
**Ideal path**: 3 — Request export, wait, Download
**Alternate paths**: Only the Account card in Settings > General; no other entry point found.
### Steps
1. Open Settings > General and scroll past the AI data sharing and Notifications cards to the "Export my data" card (`DataExportSection`, test id `data-export`). Maya thinks: "Where does my stuff go if I leave?" → Card shows only the title and an outline button "Request export"; no explanatory text.
2. On open the card silently calls `account.exportLatest`; with no job and no unexpired export, nothing else renders.
3. Click "Request export" → button disables while the request is in flight, then the card shows a `role=status` line "Preparing… 0%" and the button disappears (running state shows no button).
4. Wait. The card polls `exportLatest` every 2 seconds → the percent climbs ("Preparing… 35%"). Maya hesitates: there is no cancel and no estimate; she may leave the dialog open or close it.
5. When status becomes `ready` → text "Ready until {date}" (medium date, 7 days from request, `ACCOUNT_EXPORT_TTL_MS`) and a primary "Download" button.
6. Click "Download" → browser downloads `praci-export.zip` from `/api/account/exports/{id}/download` (zip, private, no-store).
7. Maya opens the zip. Per code comments it holds portable JSON plus original Data room files; secrets, tokens, mail bodies and run logs are not included. UNVERIFIED: exact file layout was not read.
### Variations
Closing and reopening Settings mid-build: the mount effect calls `exportLatest`, finds the running job and resumes the percent and polling. Reopening after ready shows "Ready until" and "Download" again.
### Edge Cases
A second request while one runs returns the same job (one active per user). A running row not updated for 1 hour is treated as dead and a new one may start (`STALE_MS`). After 7 days the zip is cleaned up and the card goes back to "Request export". Request errors appear as red `role=alert` text under the card. A `failed` job is not in the active filter and has no ready state, so the card shows "Request export" with no failure message (UNVERIFIED whether `exportLatest` returns failed rows).

## STORY-APP-344: Export link stops working after expiry
**Type**: short
**Topic**: account-data-time-and-consent
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Download an export she requested last week.
**Preconditions**: An export was ready; 7 days have passed.
**Ideal path**: 2 — reopen Settings, Request export
**Alternate paths**: none found
### Steps
1. Open Settings > General → `exportLatest` returns null because the row is expired (`expiresAt` not in the future).
2. The card shows "Export my data" and "Request export" only; the old "Download" is gone. Maya thinks: "Did it fail?" No message says the old export expired.
3. Click "Request export" → new job starts, "Preparing… 0%".
### Variations
If Maya kept a tab open with the old Download button, clicking it hits `/api/account/exports/{id}/download`, which returns JSON `{ error: "Not found" }` with 404 rather than a zip (expiry check is server side).
### Edge Cases
Another user's export id also returns 404 (query is scoped to `actor.userId`). A signed-out request returns 401.

## STORY-APP-185: Turn off AI data sharing for a model (folded into the existing story of this id, updated 2026-10-20)
**Type**: short
**Topic**: account-data-time-and-consent
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Stop Praci sending her messages to the model provider that runs her bots.
**Preconditions**: At least one AI model is connected; consent was granted earlier.
**Ideal path**: 1 — flip the switch
**Alternate paths**: The in-chat consent card and the Inbox prompt only allow; revoking is only here.
### Steps
1. Open Settings > General > "AI data sharing". Card text under the title is the model disclosure: "Messages, chat history, bot instructions, memories, attachments, screenshots and connected-app content are sent to run your bots, including routines." → one row per model recipient with a switch and the model name plus detail line.
2. Toggle the switch labelled "Allow {name}, {detail}" off → switches disable while saving, then show the new state; an open Inbox reloads (`INBOX_CHANGED_EVENT`) so its prompt and sorting match.
3. Maya goes to the Inbox → the Important pile now shows the "Let Praci sort your mail" card (see story on Inbox consent).
### Variations
Toggling on again calls `allowRecipient` at the current disclosure version.
### Edge Cases
The whole card is hidden if there are no model recipients or the status call fails (silent). Errors show red under the description. Only `use === model` rows appear; voice and memory recipients are not listed here (UNVERIFIED whether another surface lists them).

## STORY-APP-345: Allow Praci to sort mail from the Inbox prompt
**Type**: short
**Topic**: account-data-time-and-consent
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Let the Inbox agent sort her mail after she skipped consent earlier.
**Preconditions**: Gmail connected; model recipient not allowed; Inbox Important pile open.
**Ideal path**: 1 — click Allow
**Alternate paths**: Switch in Settings > General > AI data sharing; in-chat card when a bot reads mail.
### Steps
1. Open Inbox with the Important pile selected → region headed "Let Praci sort your mail" at the top. Text: "Senders, recipients, subjects and short previews go to the AI service that runs your bots ({model name})." Buttons "Allow" and "Not now".
2. Maya hesitates: the text names data classes but she wants to know if bodies go too. The card does not say; the Settings card text is broader (messages, attachments).
3. Click "Allow" → button disables, consent is recorded for exactly that recipient, the Inbox reloads and syncs; the status line "Sorting your mail…" follows while triage runs.
### Variations
Click "Not now" → card hides for this visit only; it returns next time Inbox opens. If Allow fails, the error shows red in the card and Allow re-enables.
### Edge Cases
The same permission is visible afterward as an on switch in Account settings, so the info appears on two surfaces. Only shown on the Important pile, not other piles.

## STORY-APP-346: Chat consent card when a bot first reads mail
**Type**: medium
**Topic**: account-data-time-and-consent
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Ask the Inbox agent to summarize this morning's mail and handle the consent request.
**Preconditions**: Inbox agent chat; model recipient not allowed.
**Ideal path**: 3 — ask, Allow, read the answer
**Alternate paths**: Settings switch or Inbox prompt (grant ahead of time).
### Steps
1. In the Inbox agent chat type "Summarize what came in this morning" and send → the agent tries to read mail and the run pauses with an approval-style card.
2. Card title (markdown): "Allow your mail to be sent to {name} ({detail})?" with a muted paragraph: the model disclosure plus "This stays on until you turn it off in Account settings." Buttons: "Allow" (primary) and "Not now".
3. Maya thinks: "Standing permission, not just this once?" The last sentence answers that. She clicks "Allow".
4. Card changes to the answered state "Allowed" with a check icon; the run resumes and the summary arrives.
### Variations
Allow once / Always allow buttons do not appear on a consent card; labels are fixed to "Allow" and "Not now".
### Edge Cases
If Maya clicks "Not now" the card reads "Not now" with a red X; the agent gets a decline and the same call is not asked again in that run, so the agent says it could not read mail. Asking again in a new message raises a new card. Parallel mail reads share one card. Older cards for a run that ended show "No longer active". Allow errors show "Could not submit this answer" or the server reason.

## STORY-APP-347: Decline consent and ask again later
**Type**: medium
**Topic**: account-data-time-and-consent
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Say no once, then change her mind without getting nagged.
**Preconditions**: Same as the consent card story.
**Ideal path**: 3
**Alternate paths**: Account settings switch after declining.
### Steps
1. Trigger the card by asking for a mail summary; click "Not now" → card shows "Not now"; the agent replies that it did not read mail and does not retry in a loop.
2. Maya wonders how to undo. Nothing in the card says; she opens Settings > General > AI data sharing → the switch is off.
3. Turn the switch on → permission recorded; open chat and ask again; no card appears and the agent reads mail.
### Variations
Instead of the switch, ask again in a new message and click "Allow" on the new card.
### Edge Cases
A decline is remembered per run, not forever, so a later message may card again.

## STORY-APP-127: Browser notifications: allow, blocked, unsupported (folded into the existing story of this id, updated 2026-10-20)
**Type**: medium
**Topic**: account-data-time-and-consent
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Get a desktop alert when a bot finishes.
**Preconditions**: Chrome on a laptop; browser permission is "default".
**Ideal path**: 2 — flip Browser on, accept prompt
**Alternate paths**: iMessage and Phone only appear once linked.
### Steps
1. Open Settings > General > Notifications → a list with one switch "Browser". Phone and iMessage rows are absent unless a phone is registered or iMessage linked.
2. Toggle "Browser" on → the browser permission prompt appears. Maya clicks the browser's Allow.
3. The switch turns on and preferences save with `browser: true`; other open tabs update through `NOTIFICATION_SETTINGS_CHANGED`.
4. Toggle off → saves `browser: false` without a prompt.
### Variations
If the browser permission was already denied the switch is disabled with muted text "Blocked in browser settings"; in an environment with no Notification API it reads "Not supported here". Dismissing the prompt without choosing leaves the switch off and unsaved.
### Edge Cases
After a block, Maya must change it in browser site settings; the app has no link to do so. A save error appears as red text above the list. Rows for Phone and iMessage use switches labelled "Phone" and "iMessage" and default on unless set false.

## STORY-APP-348: Change time zone and confirm it saved
**Type**: short
**Topic**: account-data-time-and-consent
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Fix a wrong time zone after moving to a co-working space in another city.
**Preconditions**: Settings open on General.
**Ideal path**: 3 — open picker, search, choose
**Alternate paths**: Browser auto-follow on app load.
### Steps
1. In Settings > General find the "Time zone" heading under the Language card → a full-width outline button shows the current zone as "{City} (UTC-4)" with a chevron.
2. Click it → popover with a "Search" field; the browser's zone is listed first, then the rest alphabetically.
3. Type "lisbon" → the list filters (keywords include the label); "No matches" shows if nothing fits.
4. Select "Lisbon (UTC+1)" → popover closes, button disables and shows the new label while saving; a "Time zone updated" success pop appears.
### Variations
Selecting the current zone does nothing.
### Edge Cases
Failure: the label reverts to the old zone and red text "Could not save time zone" appears under the picker. Time zone control only renders when the app has a zone value and handler; fallback is the browser zone.

## STORY-APP-349: Time zone follows the browser when Maya travels
**Type**: short
**Topic**: account-data-time-and-consent
**Persona**: a solo technical founder who flies between cities
**Goal**: Have times follow her laptop without visiting Settings.
**Preconditions**: A zone is already stored; this browser reported it before.
**Ideal path**: 0 — automatic
**Alternate paths**: Manual picker.
### Steps
1. Maya lands in Tokyo and opens Praci on the same laptop → on app load Shell compares the stored zone to the browser zone.
2. Because this browser reported before and the zone changed, it silently saves the new zone (`rpc.preferences.update`). No toast or message appears.
3. Settings > General > Time zone now shows Tokyo.
### Variations
A zone picked manually in Settings is not overwritten unless this browser's own zone changes after its last report. A browser that never reported leaves a stored zone alone. With no stored zone the browser zone is saved on first load.
### Edge Cases
Without localStorage the report is skipped when the server already disagrees. Failure to save is swallowed silently.

## STORY-APP-350: Agent creates a repeating schedule and Maya reads the approval card
**Type**: medium
**Topic**: account-data-time-and-consent
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Have the Chief send a Monday 8am investor-update reminder and approve it safely.
**Preconditions**: Time zone stored as America/Los_Angeles; Chief bot chat.
**Ideal path**: 3 — ask, read card, Create
**Alternate paths**: Create the routine in the Routines editor by hand.
### Steps
1. Tell the Chief: "Every Monday at 8am draft the investor update outline for Northwind." → the agent proposes a repeating schedule; the run pauses.
2. An approval card reads "Review before creating the repeating schedule “Monday investor update”" with a monospace detail block: `repeats: Every Monday at 08:00 (America/Los_Angeles)`, `next run: ...` in local time, and the whole `prompt:` text. Maya thinks: "Is that really my time zone?" The zone name is in the text, so she can check.
3. She reads the prompt line fully (not truncated) and clicks the allow button.
4. Card shows the answered state; the routine now exists with that zone.
### Variations
One-shot reminders ("in 10 minutes") need no card. Changing the prompt of a repeating schedule or making a one-shot repeat also raises a card; pausing or renaming does not. Deny stops the run from retrying the same schedule. Button label for this card: UNVERIFIED (schedule cards use the generic approval labels "Allow once", "Always allow this tool", "Deny", not "Create space").
### Edge Cases
If the schedule already has its own zone, the existing zone is used rather than the account zone. Times such as "Every 30 minutes" show no zone. An invalid zone argument produces no card (tool errors instead).

## STORY-APP-351: Changing account time zone does not move existing routines
**Type**: medium
**Topic**: account-data-time-and-consent
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Move her Monday routine to Eastern time after relocating.
**Preconditions**: Routine "Weekly runway check" saved at Monday 08:00 in Pacific time; account zone now Eastern.
**Ideal path**: 4 — open routine, adjust schedule, Save (UNVERIFIED whether zone updates)
**Alternate paths**: Ask the agent to update the schedule.
### Steps
1. In Settings > General > Time zone choose the Eastern city → "Time zone updated".
2. Open Routines > Weekly runway check → editor shows "When to run" with a small zone label next to it: the routine's own zone (Pacific), not Eastern. Maya is surprised.
3. She opens the schedule control ("How often", "Time of day") and Saves → UNVERIFIED whether saving rewrites the zone to the new account zone; Shell passes the routine's own zone to the editor.
### Variations
Create a new routine: the editor shows the browser's zone (`localTimezone()`), not the stored account zone, so these can differ.
### Edge Cases
Agent-made schedules keep the routine's existing zone, so a changed account zone only affects new ones. This is a place where one fact appears on three surfaces (Settings, routine editor label, approval card) and they may disagree.

## STORY-APP-352: Account trust review: data sharing, notifications and export in one visit
**Type**: long
**Topic**: account-data-time-and-consent
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Before sharing Northwind's cap table with a bot, Maya reviews what leaves the app, what interrupts her and how to get out.
**Preconditions**: Signed in; Gmail connected; model recipient not allowed; Chrome permission default; desktop and mobile not involved.
**Ideal path**: 10
**Alternate paths**: one Settings visit plus one Inbox visit covers it
### Steps
1. Open Settings → General. Maya scans cards top to bottom: Account, (Messaging if enabled), AI data sharing, Notifications, Export my data, Appearance, Language with Time zone.
2. Read the AI data sharing description and the single switch (off) → she thinks: "Off means my bots cannot run?" The text says data is sent to run bots; it does not say what happens when off. UNVERIFIED runtime behavior when off beyond the mail consent card.
3. Open the Inbox → Important pile shows "Let Praci sort your mail" with Allow / Not now. She clicks "Not now" → card hides.
4. Ask the Inbox agent for a summary → consent card "Allow your mail to be sent to ...?" She clicks "Allow".
5. Return to Settings > General → AI data sharing switch is now on (same permission, different surface).
6. Toggle Notifications > Browser on; accept the browser prompt → saved.
7. Ask the Chief for a Monday reminder → approval card with zone and prompt; she allows it.
8. Open Time zone and confirm it matches her city; choose it if not → "Time zone updated".
9. Click "Request export" → "Preparing… N%" climbs; she closes Settings.
10. Reopen Settings later → "Ready until {date}"; click "Download" → zip arrives.
11. Switch AI data sharing off again before the demo → Inbox shows the sort prompt again.
12. Open the Inbox again → the sort prompt returns, so Maya sees the switch and the card are the same permission.
13. Open Settings > General > Language and look at Time zone once more → unchanged, confirming nothing else rewrote it.
14. Open Routines and open the Monday reminder → the editor's "When to run" label shows the routine's zone, which matches the approval card text.
15. Back in Settings, confirm Notifications > Browser is still on after reload → preferences persisted server side.
16. Maya concludes she can leave: export done, sharing revocable.
### Variations
Phone and iMessage notification rows appear once linked, adding two switches.
### Edge Cases
Anything that fails shows an inline red message; the export card has no cancel; consent undone in Settings takes effect for the next mail read, not the one in progress (UNVERIFIED).

