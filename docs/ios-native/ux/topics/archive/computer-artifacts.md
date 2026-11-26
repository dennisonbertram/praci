# Topic: Team Computer, artifacts, agent pages and routines

Planned native SwiftUI iPhone app, epic #427, phase 8 (#420). Boards: PG-A-Computer, PG-A-Artifacts, PG-A-Artifact, PG-A-Image, PG-A-AgentPage, PG-A-AgentList, PG-A-Routine, and the Computer, Artifacts, Artifact, Image, Agent page, Agent list and Routine rule cards in PG-A-Rules. All boards are in docs/design-system/ios/boards/. Boards use [AMOUNT] and [N] placeholders; figures in this file are invented.

Same information on several surfaces: the runway figures appear in the Finance page, the Finance agent's Agent page, the "Runway summary" artifact, the Routine prompt, and chat finance cards. An artifact appears in the Artifacts list, in chat messages as an attachment or image block, and in the Image viewer.

## STORY-001: Watch the agent work on its Team Computer
**Type**: short
**Topic**: Team Computer, artifacts, agent pages and routines
**Persona**: Maya Okafor, solo founder of a bookkeeping startup
**Goal**: See what the Finance agent is doing on its desktop without touching it.
**Preconditions**: Signed in, a space with a Finance agent, its computer already booted, thread open.
**Device**: standard iPhone
**Ideal path**: 3 — More menu, Open computer, read the screen.
**Alternate paths**: (a) tap a computer block in the thread (Expo `ComputerCard` opens `/computer`); (b) laptop pose, where the thread stays in the bottom half while the screen is on top.
**Design source**: Agent thread: PG-A-Thread, PG-A-Rules "Agent thread" (More group lists "open computer"). Computer: PG-A-Computer, PG-A-Rules "Computer". The standard-iPhone top bar for Computer is NO BOARD (boards show the Duo outer display).

### Steps
1. In the Finance agent thread, tap the trailing More group, then "Open computer" → Team Computer screen pushes; clear-glass controls over the live screen; "Booting [name]" is not shown because it is already running.
2. Read the screen. The "Team" picker is top-left, the control chip is top-right. → The screen is view-only; no key bar is shown. Screen URL comes from `computer/screenUrl`; status is polled about every 2 s.
3. Tap "Close" → Returns to the thread.

### Variations
- Tap a computer block inside a message instead of the More menu.
- The agent finishes its task while the user watches; the screen stays as the last frame.

### Edge Cases
- Screen URL is a one-hour capability URL; at 50 minutes it must renew without reloading the web view.
- Backgrounding the app during a long watch: heartbeat (every 60 s) behavior is not specified.

### Design gaps
- No standard-iPhone layout for Computer: the board only shows the 466x678 outer display (side strip, clear glass). The Close, Keyboard, Fit to screen and Take control placement on a 393 pt iPhone is undefined.
- The More menu label "open computer" is lowercase in the rule card; the Expo label is "Open computer". Pick one.

## STORY-002: Boot a stopped Team Computer and take control for a login
**Type**: long
**Topic**: Team Computer, artifacts, agent pages and routines
**Persona**: Tomas Lindqvist, operator of a two-person logistics software company
**Goal**: Open a stopped computer, take control, log in to a vendor portal by hand, type a code, and hand control back so the agent continues.
**Preconditions**: Signed in; a bot whose computer is stopped; the agent has asked for a human login ("Needs you").
**Device**: iPhone Duo outer
**Ideal path**: 14 — open, boot wait, Take control, tap field, show keyboard, type, tab, enter, hide keyboard, Release, answer handoff, close.
**Alternate paths**: (a) use Release, "I'm done" in the handoff prompt instead of the Release button; (b) Skip in the handoff prompt when the user cannot log in; (c) laptop pose, key bar and Release on the bottom half; (d) inner display, thread beside the screen so the user can tell the agent what happened.
**Design source**: PG-A-Computer and PG-A-Rules "Computer" for screen, control chip, Team/Private picker, key bar (Esc, Tab, Ctrl, arrows), Take control and Release. Handoff Skip / "I'm done": described in the rule card text only, no drawn screen (NO BOARD for the handoff prompt itself). The thread message that asks for the handoff: DS-06-Chat / DS-07-Domain computer and handoff blocks (not verified in detail).

### Steps
1. In the thread, a "Needs you" computer block appears from the agent; tap it → Computer screen opens.
2. Screen shows "Booting [name]" with a progress bar → Progress advances; poll status about every 2 s.
3. Booted; the desktop appears in the web view → View-only. Prominent "Take control" button is last in the side strip.
4. Tap "Take control" → `computer/takeover` returns a lease (default 15 minutes). Prominent button becomes "Release" (lock.open). Control chip reads "You have control". Clear key bar appears at the bottom. The screen URL is re-read because control changed.
5. Tap the login field on the screen → Pointer input goes to `computer/input`; remote field focuses.
6. Tap "Keyboard" in the action group → iOS keyboard appears; typed characters go to the remote machine.
7. Type the username → Characters show on the screen.
8. Tap "Tab" on the key bar → Focus moves to the password field.
9. Type the password → Characters show (masking is up to the remote page).
10. Tap "Return" on the key bar (Expo label "Return") → Form submits; the vendor page loads.
11. Type the one-time code, then Return → Portal dashboard shows.
12. Tap "Keyboard" again → Keyboard hides.
13. Tap "Release" → Control returns to the agent. Handoff prompt asks "Skip" or "I'm done".
14. Tap "I'm done" → Lease released with reason `done`; control chip clears; the thread resumes and the agent says it is continuing.

### Variations
- Tap "Skip" at step 14: release reason `skipped`; the agent is told the human did not finish.
- Tap "Fit to screen" at step 3 if the remote desktop is larger than the phone.
- Switch the picker from "Team" to "Private" before taking control (Private is a per-user computer; see Edge Cases).

### Edge Cases
- Lease expires at 15 minutes while typing: the key bar should disappear and the screen go view-only; expiry copy is not specified.
- "Could not open computer" with retry at step 2.
- "Could not load the desktop." at step 3 (screen URL returns null).
- Another viewer already holds the lease: Expo `takeover` fails; message is "Could not continue" or similar, wording not specified in the boards.
- Network drops while in control: Expo shows "Reconnecting"; no board.
- Expo also has computer recovery flows ("Recover computer", "Reset computer", "Update computer", "Recovering Team Computer", "Updating Team Computer", "Update failed"). The boards define none of these.

### Design gaps
- Handoff prompt (Skip / "I'm done"): no drawn screen; presentation (alert, sheet, inline chip) is undefined, as is whether it also appears when the user taps Release outside a handoff.
- Lease expiry, "Reconnecting" and takeover-denied states: NO BOARD.
- Maintenance actions (Recover, Reset, Update computer, update progress) exist in Expo bot settings and the computer screen but are not in the board set or the Phase 8 plan text.
- Phase 8 plan says "keyboard bridge" but the board's key bar lists only Esc, Tab, Ctrl and arrow keys; "Return" and "Control" (Expo labels) are not on the board. Label mismatch: board "Ctrl" matches Expo "Ctrl"; Expo has "Escape" and "Return" as accessibility names.
- No pointer affordances (long press for right click, two-finger scroll, drag) are defined, although the API accepts `pointer` and `scroll` input.
- Clipboard input (`kind: "clipboard"`) has an API but no UI for pasting.

## STORY-003: Find last week's board update in Artifacts and read it
**Type**: medium
**Topic**: Team Computer, artifacts, agent pages and routines
**Persona**: Priya Raman, founder preparing a board call
**Goal**: Locate the "Board update draft" HTML artifact and read it.
**Preconditions**: Signed in; the space has artifacts from several bots (Finance agent, Legal agent, Chief, Inbox agent).
**Device**: standard iPhone
**Ideal path**: 4 — Artifacts, tap "Chief" chip, tap row, read.
**Alternate paths**: (a) search with "Search artifacts" and type "board"; (b) open the artifact from the chat message where Chief made it; (c) Duo inner display, bot filter as a vertical list and preview beside the rows.
**Design source**: PG-A-Home / PG-A-Rules "Home" for the Artifacts entry (side-strip group Activity / Search / Artifacts). PG-A-Artifacts and PG-A-Rules "Artifacts" for the list. PG-A-Artifact and PG-A-Rules "Artifact" for the preview.

### Steps
1. On Home, tap "Artifacts" (side-strip group on Duo; Home on a standard iPhone has an Artifacts entry in Expo at `index.tsx` but its native position is undefined) → Artifacts list opens with large title "Artifacts", chip row starting with "All bots" (active chip is ink), then divided rows.
2. Tap the "Chief" chip → List filters to Chief's artifacts. Row shows "Board update draft", "Chief · HTML · v2", "Yesterday".
3. Tap the "Board update draft" row → Artifact preview opens. Title capsule shows "Loading…" then the name. The HTML renders in a sandbox inside a preview card; floating version pill reads "v2 of 2".
4. Scroll and read → Content scrolls under the capsule and pill.

### Variations
- Type "board" in the search field first; rows filter and the empty result reads "No matching artifacts".
- Use "All bots" and scroll; paging uses `artifacts/listSpace` with a cursor (limit up to 60).

### Edge Cases
- "No artifacts yet" for a new space.
- "Could not load artifacts." with "Try again."
- "Could not load this artifact." in the preview.
- "No preview for this file type." for unsupported types.
- Many bots: the chip row must scroll sideways; not drawn.

### Design gaps
- Standard iPhone entry point to Artifacts is not specified (the Home rule card places it in the outer side strip only).
- The search field on the list is only an icon ("Search artifacts") in the strip; how it expands on a standard iPhone is not drawn.
- Chip overflow (more than about four bots) is not drawn.
- Row sort order and date grouping labels ("Today", "Yesterday", "Oct 17") are shown, but the rule is not stated.

## STORY-004: Compare versions of a runway summary and share it
**Type**: medium
**Topic**: Team Computer, artifacts, agent pages and routines
**Persona**: Jordan Reyes, investor-relations lead at a seed-stage company
**Goal**: Check that v5 of "Runway summary" differs from v4, then share the markdown file with an advisor.
**Preconditions**: Artifact "Runway summary" has 5 versions.
**Device**: iPhone Duo outer
**Ideal path**: 6 — open row, Versions, pick v4, back to v5, Share, pick target.
**Alternate paths**: (a) Share from a prior version; (b) laptop pose, version pill and Share as a bottom bar; (c) share the artifact from a chat message long-press (Expo message menus; not on a board).
**Design source**: PG-A-Artifacts, PG-A-Artifact and PG-A-Rules "Artifact". The versions menu is named in the rule card (Overlays, versions menu) but its list is NO BOARD.

### Steps
1. In Artifacts, tap the "Runway summary" row ("Finance agent · Markdown · v5", Today) → Preview opens with "Cash [AMOUNT]  Runway [N] mo", the paragraph "Cash fell in the last 30 days, mostly from two vendor payments.", rows "Northwind" and "Acme Payroll", and the pill "v5 of 5".
2. Tap "Versions" (square.stack.3d.up) in the action group → A versions menu lists v1 to v5 (list from `artifacts/listVersions` by `familyId`).
3. Choose v4 → Preview swaps to v4; pill reads "v4 of 5". Whether an older version is marked read-only is not drawn.
4. Scan the differences → The user compares by eye; no diff view exists.
5. Tap the pill and choose v5 → Back to the latest.
6. Tap "Share", the prominent button → iOS share sheet opens with the file; user picks Messages.

### Variations
- Share v4 instead of v5.
- Share an HTML artifact: the share target receives an HTML file, not a rendered image.

### Edge Cases
- Share fails: Expo alert "Could not share this artifact" with "Try again."
- A new version arrives while the user views v5: pill count and content refresh behavior is not specified.
- Versions menu for a single-version artifact: should the Versions button be disabled or hidden?

### Design gaps
- The versions menu contents and selected-state are not drawn.
- No diff or "what changed" view; the user has to compare by eye (a possible simplification, not a request).
- Behavior when a newer version arrives while viewing is undefined.
- Where "Share" sits on a standard iPhone: the rule card puts the prominent Share in the strip, but the board shows an in-page pill on the standard layout (not verified against the preview).

## STORY-005: Delete an outdated artifact
**Type**: short
**Topic**: Team Computer, artifacts, agent pages and routines
**Persona**: Hana Sato, operations lead
**Goal**: Remove an old "Filing calendar" artifact that has three versions.
**Preconditions**: "Filing calendar" (Legal agent, HTML, v3) exists.
**Device**: standard iPhone
**Ideal path**: 3 — long-press row, confirm Delete.
**Alternate paths**: (a) open the artifact, More menu, Delete, confirm; (b) none other found for deleting several at once.
**Design source**: PG-A-Rules "Artifacts" ("Long press a row: delete confirm") and "Artifact" (More, delete; "Delete confirms version count"). The confirm dialog itself is NO BOARD.

### Steps
1. Long-press the "Filing calendar" row → Confirmation appears: Expo reads Delete "Filing calendar"? with "This can't be undone." and mentions the version count.
2. Tap "Delete" (destructive) → `artifacts/remove` runs; the row disappears.
3. Check the list → "Filing calendar" is gone; other rows keep their order.

### Variations
- Tap "Cancel": nothing changes.
- Delete from the preview More menu; on success the preview pops back to the list.

### Edge Cases
- Failure: alert "Could not delete this artifact" with "Try again."
- The deleted artifact is still referenced in an old chat message: tapping it should show "Could not load this artifact." (not specified).
- Deleting the version the user was viewing on Duo inner display while the preview is open: the preview must clear.

### Design gaps
- Dialog is described only in text; the exact copy and whether it deletes all versions is not on a board. The rule card says "confirms version count", the API deletes by `artifactId` (it is unclear whether that removes the family).
- No undo.
- No multi-select delete.

## STORY-006: View a generated chart image full screen and save it to Photos
**Type**: medium
**Topic**: Team Computer, artifacts, agent pages and routines
**Persona**: Leila Haddad, founder who posts weekly updates
**Goal**: Open "vendor-payments-q3.png" full screen, zoom in, and save it to Photos.
**Preconditions**: The Finance agent made the image artifact "Vendor payments Q3" (Image, v1).
**Device**: standard iPhone
**Ideal path**: 4 — open row, image opens full screen, Save to Photos, Close.
**Alternate paths**: (a) tap the image block inline in the chat thread; (b) Share instead of Save to Photos; (c) laptop pose, image on top half and controls on the bottom half, free rotation.
**Design source**: PG-A-Image and PG-A-Rules "Image". Row: PG-A-Artifacts. Photos permission prompt: NO BOARD.

### Steps
1. In Artifacts, tap "Vendor payments Q3" ("Finance agent · Image · v1", Yesterday) → Full-screen image opens on black; 35% dim under the clear controls; name pill "vendor-payments-q3.png" floats at the bottom.
2. Pinch to zoom → Image zooms (Expo: zoom, share or export).
3. Tap "Save to Photos" in the action group → First time, iOS asks for add-to-Photos permission; allowing saves the image. A success confirmation is not drawn.
4. Tap "Close" → Returns to the Artifacts list at the same scroll position.

### Variations
- Tap "Share" in the same group for the system sheet.
- Tap the More group for any extra actions (contents not defined).

### Edge Cases
- "Could not load this image." with Close still available.
- Photos permission denied: no copy defined.
- Rotation of the phone: the rule card says Image "rotates freely".

### Design gaps
- Success and failure feedback for "Save to Photos" is not drawn.
- More group contents on Image are undefined (the card lists "More" but gives no actions).
- Expo has Share only; "Save to Photos" is new in the native app (feature added by the board, label from the board).
- Image viewer in Duo inner mode keeps the thread as the sidebar third; the artifact list is not part of that layout, so "back to the list" may differ.

## STORY-007: Read the Finance agent's pinned page, then jump to chat
**Type**: medium
**Topic**: Team Computer, artifacts, agent pages and routines
**Persona**: Maya Okafor (see STORY-001)
**Goal**: Read the Finance agent's "Runway summary" page and ask a follow-up about the receipts.
**Preconditions**: The Finance agent has saved a page (`pages/get` returns blocks). Amounts are visible (Hide amounts off).
**Device**: iPhone Duo outer
**Ideal path**: 4 — thread Page button, read, Open chat, ask.
**Alternate paths**: (a) agent thread More menu, Page; (b) inner display, page and thread side by side so the user asks without leaving the page; (c) laptop pose, page on top half and composer on bottom half; (d) Hide amounts (Expo shows "Hide amounts" / "Show amounts" on this screen).
**Design source**: PG-A-AgentPage and PG-A-Rules "Agent page". Chat: PG-A-Thread. Hide amounts toggle: NO BOARD on Agent page.

### Steps
1. In the Finance agent thread, tap "Page" (doc.text) in the side strip → Agent page opens. Capsule shows "Finance agent".
2. Read the document: title "Runway summary", figure tiles "Cash [AMOUNT]", "Burn [AMOUNT]/mo", "Runway [N] mo", a chart, then "Cash fell in the last 30 days, mostly from two vendor payments. At the current burn the runway is [N] mo." and the lines "4 card expenses need receipts" and "One invoice is due Friday".
3. Tap "Open chat" (prominent) → Returns to the Finance agent thread.
4. Type "Which four card expenses are missing receipts?" and send → The agent replies in the thread. The page is unchanged unless the agent saves a new page.

### Variations
- On the inner display step 3 is unnecessary; the thread sits in the third.
- Tap "List" (checklist) in the strip to jump to the agent's list (STORY-008).

### Edge Cases
- Empty: "No page yet."
- Error: "Could not load this page." (an already loaded page stays).
- "Chart could not be drawn." appears in place of the chart.
- The page changes while open (the agent updates it): refresh behavior is not specified; `pages/get`/`pages/save` has no push event in the board.

### Design gaps
- The page is not editable by the user (no API in the board for edits; `pages/save` exists). Confirm that read-only is intended.
- The bullet-style lines "4 card expenses need receipts" and "One invoice is due Friday" have no tap target; the user cannot go from a finding to the receipts.
- Hide amounts affects the tiles on the page in Expo; the board does not show the control.
- The same runway figures also live on the Finance page, the "Runway summary" artifact and the routine prompt; no cross-link between them is designed.

## STORY-008: Work through the "Close checklist" and add an item
**Type**: medium
**Topic**: Team Computer, artifacts, agent pages and routines
**Persona**: Tomas Lindqvist (see STORY-002)
**Goal**: Tick off finished month-end steps and add "Send invoice reminders".
**Preconditions**: The agent keeps a list titled "Close checklist" with items "Collect missing receipts", "Review vendor payments", "Send runway update to Jordan", "Confirm card limits", "File Q4 tax estimate".
**Device**: standard iPhone
**Ideal path**: 5 — open list, tick two items, type in Add item, add, done.
**Alternate paths**: (a) ask the agent in chat to add the item; (b) laptop pose, Add item field on the bottom half; (c) swipe or long-press to delete (Expo alert "Delete").
**Design source**: PG-A-AgentList and PG-A-Rules "Agent list". Delete confirmation and swipe affordance: NO BOARD.

### Steps
1. From the thread, tap "List" (checklist) → Agent list opens with capsule "Close checklist" and checklist rows.
2. Tap the checkbox for "Collect missing receipts" → Row becomes muted and struck through.
3. Tap the checkbox for "Review vendor payments" → Same.
4. Tap the floating field with placeholder "Add item", type "Send invoice reminders" → The prominent add button at the trailing end of the field becomes active.
5. Tap the add button → The new row appears at the bottom; the field clears. The change saves to the server.

### Variations
- Delete an item through the Expo alert "Delete" with "Cancel" / "Delete".
- Add several items quickly.

### Edge Cases
- Empty list: only the field with placeholder "Add item".
- "Could not load this list."
- Save failure: alert "Could not save this list." and the row reverts.
- The agent edits the list at the same time: Expo shows "The bot changed this list. Your last edit wasn't saved." The board has no design for this conflict.
- Keyboard covers the floating field on a small phone.

### Design gaps
- Conflict alert ("The bot changed this list. Your last edit wasn't saved.") has no board.
- Reorder and rename are not in either the board or the Expo app.
- Delete affordance (swipe vs long-press) is undefined.
- The boards title the capsule with the list name; the Expo app uses a "List" header title. The native app should use the list name.
- Done items: no "clear done" action.

## STORY-009: Check what a weekly routine did and open its conversation
**Type**: medium
**Topic**: Team Computer, artifacts, agent pages and routines
**Persona**: Priya Raman (see STORY-003)
**Goal**: See when the "Weekly runway summary" routine last ran and open the conversation it produced.
**Preconditions**: A routine exists on the Finance agent; Home shows an Activity item "routine ran".
**Device**: iPhone Duo outer
**Ideal path**: 3 — tap Activity item, read routine, Open conversation.
**Alternate paths**: (a) search hit of kind `routine` (Expo `search-destination` routes to `/routine`); (b) push notification for a routine run (push taps are phase 10; routine destination not specified); (c) inner display, the agent's routines list in the third, detail beside it.
**Design source**: PG-A-Routine and PG-A-Rules "Routine". Entry point from Home Activity: PG-A-Home / Rules "Home" ("routine ran" activity item). Routines list on the inner display: NO BOARD (rule card says "the agent's routines list").

### Steps
1. On Home, tap the Activity item for the routine → Routine detail opens. Capsule shows "Weekly runway summary".
2. Read the status card: "Every Monday at 8:00 AM", "Finance agent · Last ran today, 8:00 AM", "Next run Mon, Oct 26" → The user confirms the last run time.
3. Read the "PROMPT" card: "Summarize cash, burn and runway for the last 30 days. List vendor payments over [AMOUNT] and any card expenses missing receipts. Update the Runway summary page." → The user checks the instruction.
4. Tap "Open conversation" (prominent) → The thread produced by the run opens.

### Variations
- The user then taps "Page" in that thread to see the updated "Runway summary" page (STORY-007).
- Open the same routine from search.

### Edge Cases
- Loading: spinner. Errors: "Could not load routine", "This routine no longer exists", "Routine link is incomplete".
- A routine that has never run: the last-run line is undefined.
- A run that failed: the status card does not show success or failure.

### Design gaps
- Routine history is in the API (`routines/history`, with a cursor) and the plan says "routine detail and history", but PG-A-Routine has no history list; "Open conversation" opens one conversation only (which run is unclear).
- No create, edit, pause or delete UI for routines, although `routines/create`, update and remove exist. Confirm that read-only is intended.
- The routines list for an agent (the inner third) has no board; on a standard iPhone there is no way to browse an agent's routines at all.
- No failed-run or paused state on the status card.

## STORY-010: Run a month-end handoff across computer, artifact, page, list and routine
**Type**: long
**Topic**: Team Computer, artifacts, agent pages and routines
**Persona**: Jordan Reyes, a founder-operator running close alone
**Goal**: Start from a "Needs you" computer request, finish a portal download, check the artifact the agent produced, confirm the page and list are updated, and check the routine that will repeat it.
**Preconditions**: Finance agent has a booted computer, a routine, a page, a list and a new artifact "Runway summary" (v6). Amounts visible.
**Device**: iPhone Duo laptop pose (626x890, fold at y 435 to 455)
**Ideal path**: 22 — one pass through five screens with the thread always available.
**Alternate paths**: (a) skip the computer if the agent can finish without help; (b) use the inner book (890x626) with the thread in the third and the screen beside it; (c) on a standard iPhone every step is a push, with Back between screens.
**Design source**: PG-A-Computer, PG-A-Artifact, PG-A-AgentPage, PG-A-AgentList, PG-A-Routine, PG-A-Rules (laptop pose for Computer is "the main use of the pose"; Agent page, Agent list and Image are laptop-capable; Routine and Artifacts are not applicable and stay full height). Transitions between a laptop-pose screen and a not-applicable screen are NO BOARD.

### Steps
1. On Home, tap Activity item "needs you" for the Finance agent → Thread opens; the approval or handoff card sits above the composer.
2. Tap the computer block → Team Computer opens: screen on the top half; key bar, Release and thread composer on the bottom half.
3. Tap "Take control" → "You have control"; key bar appears.
4. Tap the portal's Download button on the screen → File downloads on the remote machine.
5. Tap "Release" → Handoff prompt "Skip" / "I'm done".
6. Tap "I'm done" → Control returns; the agent continues.
7. In the bottom-half composer, type "Thanks, check the runway" and send → Message goes to the thread.
8. Tap "Close" → Back to the thread.
9. The agent posts "Runway summary v6" as an artifact chip in the thread; tap it → Artifact preview opens (top half preview, bottom half version pill and Share).
10. Read the preview → Cash falls; the paragraph matches the Runway summary.
11. Tap "Versions" and compare to v5 → v5 shows; return to v6.
12. Close back to the thread (Back).
13. Tap "Page" → Agent page, top half page, bottom half composer.
14. Check the tiles "Cash [AMOUNT]", "Burn [AMOUNT]/mo", "Runway [N] mo" → They match the artifact.
15. In the bottom composer, ask "Which card expenses still need receipts?" → The agent answers.
16. Tap "List" → "Close checklist" opens.
17. Tick "Collect missing receipts" and "Review vendor payments" → Rows mute and strike through.
18. Back to the thread; open Home; tap the routine Activity item → Routine detail goes full height (laptop pose not applicable).
19. Read the status card: "Every Monday at 8:00 AM", "Next run Mon, Oct 26" → The user knows when this repeats.
20. Read the prompt card → It still says "Update the Runway summary page."
21. Tap "Open conversation" → The routine's thread opens.
22. Close the app or lock the phone → Nothing else is pending.

### Variations
- Steps 9 to 11 replaced by Artifacts list, filter "Finance agent".
- Do steps 13 to 17 on the inner book with the thread alongside.

### Edge Cases
- Posture change from laptop pose to flat while the computer is under control: the lease and screen state must survive (Duo posture changes are not specified).
- Lease expiry (15 minutes) while the user reads the artifact on another screen: the key bar is gone on return.
- The user leaves the Computer screen while holding control: whether leaving releases control is not defined.

### Design gaps
- Leaving the Computer screen while holding the lease: no rule or prompt.
- Moving between a laptop-capable screen and a not-applicable one (Routine, Artifacts) in laptop pose is not designed.
- The same Runway data appears on four screens; no deep link from the artifact to the page or from the routine to the artifact.
- The routine's link to "the conversation" does not say which run (see STORY-009).
- Selection and scroll survival across posture changes is not specified in the docs read.

## STORY-011: Recover when artifacts, the page and the computer fail to load
**Type**: medium
**Topic**: Team Computer, artifacts, agent pages and routines
**Persona**: Hana Sato (see STORY-005), on a train with poor signal
**Goal**: Recover from three load failures and get back to a working state.
**Preconditions**: Signed in; the connection drops in and out.
**Device**: standard iPhone
**Ideal path**: 6 — each failure has a retry; three retries.
**Alternate paths**: (a) reconnect and pull to refresh (not designed); (b) close and reopen the screen.
**Design source**: PG-A-Rules "Artifacts", "Agent page", "Computer", "Routine" (empty / loading / error lines). The retry control for Agent page and Routine is NO BOARD.

### Steps
1. Open Artifacts while offline → "Could not load artifacts." with "Try again."
2. Tap "Try again." after the signal returns → List loads.
3. Open the Finance agent page → "Could not load this page." (no loaded page to keep).
4. Go back and open it again → Page loads. No retry button on the page itself.
5. Open the computer → "Could not open computer" with retry.
6. Tap retry → "Booting [name]" with a progress bar, then the desktop. If the screen cannot load: "Could not load the desktop."

### Variations
- Open a routine offline: "Could not load routine".
- Open an artifact offline: "Could not load this artifact."

### Edge Cases
- Cached artifact lists exist in Expo (integrations and artifact caches are listed in the app map); whether stale rows show with the error is not specified.
- Server older than the app: a 404 on a newer procedure means "not supported"; no copy for it on these screens.

### Design gaps
- Agent page, Agent list and Routine errors show text but no retry control on the boards (only Artifacts and Computer have one).
- No offline banner or stale-data indicator.
- "Not supported by this server" copy is not defined for any of these screens.
- "Could not load the desktop." has no retry or "Try again" action drawn.
