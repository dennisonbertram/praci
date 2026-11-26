# Home and spaces: user stories (native iOS app)

Topic: Home and spaces. Sources read for this pass: `apps/ios/Sources/Praci/Home/*` (`HomeScreen`, `HomeModel`, `HomeRows`, `RowTime`), `Spaces/*` (`NewSpaceSheet`, `SpaceSettingsSheet`, `SpacesModel`), `Manage/AgentRowMenu.swift`, `Manage/UndoToast.swift`, `Manage/NewBotSheet.swift`, `Manage/NewGroupSheet.swift`, `Manage/ManageClient.swift`, `Meetings/RecordingBar.swift`, `App/AppShell.swift`, `App/AppModel.swift`, and `Packages/RakazoAPI/.../Models/Home.swift` (`Roster`). Behavior below is what the code does; nothing was run on a device. All names and data are invented. This file replaces the older plan-era `home-spaces.md`, which described a layout (a "Personnel" list and an Activity card) that the built app does not have.

Facts used across stories:

- Home is one `List` with these sections in order: refresh-error block (only after a failed refresh), needs-model block (only if `me.needsModel`), Inbox row, "Pinned" (only if any), "Agents", one section per custom bot section, "Pages".
- Nav bar: gear "Settings" on the left; "New" (plus) menu on the right with "New agent", "New group", "New space"; the title is the current space name and is a menu (`toolbarTitleMenu`).
- Title menu: an inline picker "Spaces" listing every space, then "New space" and "Space settings".
- Row long-press menu (`AgentRowMenu`): Pin or Unpin, Rename, Settings, Archive.
- The roster sorts by most recent activity. Pinned rows leave the Agents list. The collapsed Agents list shows the 4 most recent rows plus every unread row, then "Show N more" / "Show less".
- The recording bar is a safe-area inset at the top of Home and of every pushed screen (`AppShell`), but not of the Settings sheet.
- Same data on several surfaces: an agent's name and unread state also appear in its thread header and in Archived (Settings); the unread count on the Inbox row is the same number as the Inbox screen; the space name appears in the nav title and in the title menu picker.

---

## STORY-H01: Open the app and get to the agent I need
**Type**: short
**Topic**: Home and spaces
**Persona**: Maya Okafor, solo founder of a four-person logistics startup, three agents set up
**Goal**: See which agent has something for her and open it
**Preconditions**: Signed in, one space ("Okafor Freight"), agents "Finance", "Inbox helper", "Ops". Finance has an unread message.
**Ideal path**: 2. One look at Home shows which agent needs her (unread dot, status text), one tap opens the thread.
**Alternate paths**: Tap the Inbox row for mail instead of an agent. Open a thread from a push notification (`NotificationRouter.open`). Pin the agent so it sits at the top (see H05).

### Steps
1. Launch the app → Home loads (spinner, then list). Title reads "Okafor Freight". Inbox row shows "Inbox" with a count.
2. Scan the Agents section → "Finance" has a filled dot next to its time and a subtitle ("Needs you" if waiting on input, "Working" if running, otherwise the last message preview).
3. Tap the "Finance" row → thread opens.

### Variations
- Only the unread rows beyond the first 4 stay visible when Agents is collapsed, so a quiet agent can be hidden behind "Show N more" while an unread one is not.
- Large Dynamic Type: the time moves to its own line and the name may wrap to two lines.

### Edge Cases
- Row time is empty if `updatedAt` cannot be parsed.
- A group row has no avatar color from the server and uses the default avatar; its status is always idle, so it never shows "Working".

---

## STORY-H02: First launch with no agents
**Type**: short
**Topic**: Home and spaces
**Persona**: Tomas Reyes, new user, just verified his email
**Goal**: Create the first agent from an empty Home
**Preconditions**: New account, no bots, no groups, no model connected
**Ideal path**: 3. Tap "New agent" on the empty state, type a name, tap "Create".
**Alternate paths**: "New" (plus) in the nav bar, then "New agent" (same sheet). No other route.

### Steps
1. Land on Home → Inbox row, Agents section with "No agents yet" and a "New agent" button, Pages section.
2. Tap "New agent" → sheet "New agent": Name, Role fields, Color swatches.
3. Type "Ops" in Name (Create is disabled until the name is non-empty; the footer says "Add a name to create the agent.") → Create enables.
4. Tap "Create" → sheet closes and the app opens the new agent's thread.
5. Go back → Home now lists "Ops" under Agents; the needs-model block above Inbox says "Ops cannot reply until a model is connected." with "Connect a model".

### Variations
- Name and Role left blank: only Create stays disabled; Role is optional.
- Server rejects the name: red error text under the form, sheet stays open.

### Edge Cases
- The "Team computer" page row appears only once a bot exists, so it is missing in step 1 and present in step 5.
- There is no onboarding; the empty state and the needs-model block are the only guidance.

---

## STORY-H03: Connect a model from the Home banner
**Type**: medium
**Topic**: Home and spaces
**Persona**: Tomas Reyes
**Goal**: Make his agent able to answer
**Preconditions**: One agent "Ops", `me.needsModel` is true
**Ideal path**: 4. Tap "Connect a model", pick a provider, finish the key or sign-in, return to Home with the banner gone.
**Alternate paths**: Settings (gear) then the Models screen reaches the same place. Opening the thread and trying to send does not offer a link (not verified in this pass; belongs to the thread-send topic).

### Steps
1. On Home read the block: "Ops cannot reply until a model is connected." → "Connect a model" button below it.
2. Tap "Connect a model" → a sheet opens with the Models screen in its own navigation stack.
3. Choose a provider and enter an API key (or use the provider's sign-in) → provider appears connected.
4. Dismiss the sheet → Home is still showing the banner until it reloads.
5. Pull down to refresh → `bootstrap` reloads, `needsModel` is false, the block disappears.

### Variations
- Banner names the first bot in the list; with no bots it says "Your agent".
- A user who connected the model on the web sees no banner at all.

### Edge Cases
- Step 4 is a likely moment of doubt: nothing in the code reloads Home when this sheet closes, but `onAppear` only fires on navigation return, not sheet dismissal. The banner may stay until a pull to refresh, a space change, or returning from a pushed screen. This needs a check on a device.

---

## STORY-H04: Create a group of agents
**Type**: medium
**Topic**: Home and spaces
**Persona**: Maya Okafor
**Goal**: Put Finance and Ops in one chat to plan a quarter
**Preconditions**: At least two agents ("Finance", "Ops", "Inbox helper")
**Ideal path**: 5. Plus, "New group", name, pick two members, Create.
**Alternate paths**: From the empty-state "New agent" button for agents only; groups have one route (nav-bar plus menu).

### Steps
1. Tap the plus in the nav bar → menu with "New agent", "New group", "New space".
2. Tap "New group" → sheet "New group" with Name and a Members list, footer "0 selected".
3. Type "Q4 planning" → Create still disabled.
4. Tick "Finance" → footer "1 selected" and "Choose 2 to 6 members."
5. Tick "Ops" → footer "2 selected", Create enables.
6. Tap "Create" → sheet closes and the group thread opens.
7. Back to Home → "Q4 planning" is in the Agents list (groups are mixed with agents, ordered by recent activity).

### Variations
- Select a seventh member: unticked rows are disabled once 6 are picked.
- Members list fails to load: retry control from the shared loading view.

### Edge Cases
- The group row never shows "Working" or "Needs you", only the preview.
- Archiving a member agent later does not appear to change the group row on Home (not verified).

---

## STORY-H05: Pin, rename and archive from the row menu, then undo
**Type**: medium
**Topic**: Home and spaces
**Persona**: Maya Okafor
**Goal**: Tidy Home: pin Finance, rename "Inbox helper", archive an old agent by mistake and bring it back
**Preconditions**: Five agents in one space, none pinned
**Ideal path**: 3 per action (long-press, choose, confirm if needed). Undo adds 1.
**Alternate paths**: The same actions exist in the agent's Settings screen (row menu "Settings"). Archive also reachable from agent Settings, which pops to Home and shows the same toast. Archived items are restored from Settings, Archived. Pin has no other route found.

### Steps
1. Long-press "Finance" → menu: Pin, Rename, Settings, Archive. The label is Pin because the app loads the real pin state only when the menu opens.
2. Tap "Pin" → the row jumps to a new "Pinned" section above Agents after the reload.
3. Long-press "Inbox helper", tap "Rename" → a system alert "Rename" with a text field holding the current name.
4. Replace with "Mail triage", tap "Save" → row shows the new name after reload.
5. Long-press "Old demo", tap "Archive" (red) → row disappears at once, with no confirmation. A toast "Archived Old demo" with "Undo" shows near the bottom for 5 seconds.
6. Tap "Undo" before it fades → the agent returns to Home.

### Variations
- Let the toast time out: restore is then only available in Settings, Archived.
- Rename with the same name or only spaces: Save does nothing, the alert just closes.
- Unpin the last pinned row: the Pinned section disappears.

### Edge Cases
- A failed pin, rename or archive call is swallowed (`catch {}` / `try?`); the user sees nothing happen and no error.
- Archive also sets `app.path = []`, so archiving from the Home menu while another screen is on the stack (not possible from Home) would pop it; harmless here.
- If the name had not loaded yet when Archive is tapped quickly, the toast reads "Archived " with a blank name (name loads asynchronously when the menu opens).
- The toast lives in its own window and sits at a fixed offset from the bottom, so it may overlap the home indicator area or an open keyboard; check on a device.

---

## STORY-H06: A crowded roster: show more, sections and collapse
**Type**: medium
**Topic**: Home and spaces
**Persona**: Priya Nair, head of operations at a 30-person startup, 12 agents and groups
**Goal**: Reach an agent that is below the fold in a custom section
**Preconditions**: 12 rows, one custom section "Finance team" with 3 rows (one section collapsed by the server flag), 2 pinned rows, 1 unread row deep in the list
**Ideal path**: 3. Scroll, tap the section header to expand, tap the row.
**Alternate paths**: Pull to refresh does not change what is visible. Section assignment is only changed from an agent's Settings screen (a "Section" picker); no creation or editing of sections on Home was found in the code.

### Steps
1. Open Home → Pinned (2 rows), Agents (4 most recent plus the unread one), then "Show 3 more", then the "FINANCE TEAM" header with a right chevron (collapsed).
2. Tap "Show 3 more" → the list animates open; the button becomes "Show less".
3. Tap the "FINANCE TEAM" header → chevron turns down and its 3 rows appear.
4. Tap "Carta agent" inside the section → thread opens.
5. Go back → both the expanded Agents list and expanded section are still as left (kept in `HomeModel` while Home is alive).

### Variations
- Fewer than 5 agents: no "Show more" button at all.
- A pinned row that belongs to a section shows only under Pinned, not in the section.
- A row whose section id the server no longer lists falls back to the Agents list.

### Edge Cases
- The collapsed state comes from the server only the first time Home loads in a launch; later server changes to the flag are ignored until relaunch.
- VoiceOver reads the section header as the section name with value "Collapsed" or "Expanded".
- An empty custom section still shows its header.

---

## STORY-H07: Switch to another space
**Type**: short
**Topic**: Home and spaces
**Persona**: Priya Nair, owns "Brightwell Labs" and is also invited to "Brightwell Advisory"
**Goal**: See the other space's agents
**Preconditions**: Two spaces
**Ideal path**: 2. Tap the title, pick the space.
**Alternate paths**: Opening a push notification for another space switches `app.spaceID` automatically. Nothing else on Home switches space.

### Steps
1. Tap the title "Brightwell Labs" in the nav bar → menu: inline picker "Spaces" with a check on the current one, then "New space" and "Space settings".
2. Tap "Brightwell Advisory" → menu closes; Home shows the loading spinner, then that space's roster, Inbox count, banner state and pages.

### Variations
- The choice is saved per server address, so the app reopens in the same space next launch.
- If the saved space no longer exists (removed on another device), the first call is rejected, the app clears it and retries without a space, landing in the server's default space.

### Edge Cases
- The title menu has no visible affordance (no chevron) on the title; the user must know to tap it.
- Space settings and New space are in this menu and "New space" is also in the plus menu: two routes to one action.
- A thread open in another screen is not affected until the user returns to Home.

---

## STORY-H08: Create a space and rename it
**Type**: medium
**Topic**: Home and spaces
**Persona**: Priya Nair
**Goal**: Start a clean workspace for a side project and fix a typo in its name
**Preconditions**: One existing space
**Ideal path**: 4. Plus, "New space", name, Create (then 4 more for a rename).
**Alternate paths**: Title menu, "New space" reaches the same sheet. Rename only through title menu, "Space settings".

### Steps
1. Tap plus, then "New space" → sheet "New space" with a focused Name field (keyboard up).
2. Type "Side proj" → "Create" enables (disabled while blank; names are trimmed and cut at 60 characters).
3. Tap "Create" → a spinner replaces Create; on success the sheet closes and Home switches to the new, empty space, which shows "No agents yet".
4. Tap the title, then "Space settings" → sheet "Space settings" with the name field and, if allowed, a red "Delete space".
5. Change to "Side project", tap "Save" → sheet closes, the title updates after reload.

### Variations
- Server rejects the name: red error text under the field, sheet remains.
- A space the user cannot rename (`canRename` false): the field is disabled and Save stays disabled.

### Edge Cases
- Save is disabled when the name is unchanged or blank.
- The new space starts with none of the agents from the other space; the user has to create again.
- Both sheets use a medium detent; at the largest text size or with the keyboard up the buttons are in the nav bar, so they are not clipped.

---

## STORY-H09: Delete a space
**Type**: short
**Topic**: Home and spaces
**Persona**: Priya Nair
**Goal**: Remove the unused "Side project" space
**Preconditions**: Two spaces, current space is "Side project" and `canDelete` is true
**Ideal path**: 3. Title menu, Space settings, Delete space, confirm (4 with the confirm).
**Alternate paths**: none found

### Steps
1. Tap the title, then "Space settings" → sheet.
2. Tap "Delete space" (red) → dialog "Delete Side project?" with message "This removes its agents, chats and files. This cannot be undone." and a red "Delete".
3. Tap "Delete" → spinner; the sheet closes and Home switches to the space the server names as active.

### Variations
- `canDelete` false (the last or default space): the Delete button is not shown at all, with no explanation.
- Cancel the dialog: stays in the sheet.

### Edge Cases
- There is no Undo here, unlike agent archive.
- Home's data after deleting is loaded by the space change; if the call fails, the error shows under the name field in the sheet.

---

## STORY-H10: Pull to refresh with a flaky connection
**Type**: short
**Topic**: Home and spaces
**Persona**: Maya Okafor on a train with weak signal
**Goal**: Check for new messages
**Preconditions**: Home already loaded, then the network drops
**Ideal path**: 1. Pull down; if it fails, one tap on "Try again".
**Alternate paths**: Returning from any pushed screen reloads Home quietly; an agents-changed notification also reloads it.

### Steps
1. Pull down on the list → spinner; the request fails.
2. Home keeps its old rows and adds a block at the top: a warning icon with the error message and "Try again".
3. Tap "Try again" after reconnecting → reload succeeds, the block disappears.

### Variations
- First launch with no network: no list at all, only the full-screen "Couldn't load" and "Try again" from the shared loading view.
- The Inbox count is loaded separately; if only that call fails, the Inbox row simply shows no count (no error).

### Edge Cases
- Old rows can look current while the error block is the only sign they are stale.
- The quiet reload on return runs every time Home reappears, so a failure there also surfaces the same error block without a user action.

---

## STORY-H11: Check Home while a recording is running
**Type**: medium
**Topic**: Home and spaces
**Persona**: Maya Okafor, mid-meeting
**Goal**: Leave the recording running, look at an agent's reply, and stop the recording afterwards
**Preconditions**: A meeting recording started from the Meetings page; the user returns to Home
**Ideal path**: 3. Tap back to Home, tap the agent, later tap "Stop" on the bar.
**Alternate paths**: Stop also from the recording screen or sheet in Meetings (not covered here).

### Steps
1. On Home, a capsule bar sits above the list: a red dot, the meeting title (or "Recording"), a running timer and a "Stop" button.
2. Tap "Finance" → thread opens; the bar is still on top of the thread (each pushed screen carries its own bar).
3. Go back to Home and tap "Stop" → the bar shows "Transcribing…" with a dimmer dot; the timer and Stop disappear.
4. When transcription ends, the bar disappears.

### Variations
- Offline: the bar shows "Offline, saved here" under the title.
- Open Settings (gear) during a recording: the sheet has no bar, so Stop is not reachable from it.

### Edge Cases
- Two bars could stack if both Home and a pushed screen show the inset during a push transition; check on a device.
- The Record button is not on Home. Starting a recording requires going through Pages, "Meetings".
- With a space policy "off", Record is unavailable but a running bar from another space would still show on Home after a space switch (not verified).

---

## STORY-H12: Find Finance and Legal pages when some are hidden
**Type**: short
**Topic**: Home and spaces
**Persona**: Jordan Lee, an invited advisor with limited access
**Goal**: Open the Meetings page and see why Finance is missing
**Preconditions**: `hiddenPages` contains "finance" and "legal"
**Ideal path**: 2. Scroll to Pages, tap Meetings.
**Alternate paths**: none found for pages other than Meetings, which is also opened from a push or from meeting-related links.

### Steps
1. Scroll to the Pages section → rows: Cap table, Data room, Meetings, Team computer (no Finance or Legal).
2. Tap "Meetings" → Meetings screen opens.

### Variations
- If "cap-table" or "investors" is hidden, Cap table is hidden.
- No bots in the space: "Team computer" is also missing.

### Edge Cases
- Hidden pages leave no placeholder or explanation. A user who expects Finance has no way to learn why it is absent.
- Team computer opens the first bot's computer, whichever bot is first in the server order, not the most recently used one.
