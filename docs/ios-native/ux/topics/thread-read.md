# Stories: Talking to an agent: read and live thread

Planned native SwiftUI iPhone app (epic #427, phase issue #416 / P4). No Swift code exists; every step is planned or inferred from the boards, the plan, the Expo app and `packages/contracts/src/rpc.ts`. All people and figures are invented.

Board files are in `docs/design-system/ios/boards/`. "Thread rules" means the Agent thread rule card in `PG-A-Rules.dc.html`; "Group rules" means the Group thread rule card in the same file. Expo behavior is from `apps/mobile/app/thread.tsx` (group mode re-exported by `group-thread.tsx`).

## STORY-001: Open a busy agent thread and read the latest reply
**Type**: short
**Topic**: Talking to an agent: read and live thread
**Persona**: Maya Okafor, solo founder of a 3-person logistics startup
**Goal**: Open the Inbox agent from Home and read what it last said.
**Preconditions**: Signed in, a space selected, Inbox agent has a thread with prior messages and a saved-chat snapshot on the device.
**Device**: standard iPhone
**Ideal path**: 3 — tap the agent row on Home, see the saved snapshot at once, then the server snapshot replaces it with no extra action.
**Alternate paths**: (a) tap the Inbox agent's row inside the Activity card on Home (PG-A-Home); (b) tap "Ask Inbox agent" (prominent button) from Inbox or Inbox message, which lands in the same thread; (c) tap a push notification (phase #422, no board); (d) Open chat from Agent page (PG-A-AgentPage).
**Design source**: Step 1: `PG-A-Home.dc.html` (Personnel row; Home rule card). Steps 2-3: `PG-A-Thread.dc.html`, Thread rules, `DS-06-Chat.dc.html` (user bubble and agent message, tool-call label). Standard-iPhone top bar: NO BOARD (boards only draw the Duo outer strip; discovery says ordinary iPhones use a standard top bar).

### Steps
1. On Home, tap the "Inbox agent" row under Personnel → thread opens; the title capsule reads "Inbox agent" and the saved snapshot is on screen immediately, bottom-aligned.
2. Wait for `threads/get` to return → the server snapshot replaces the saved copy with no visible jump; the composer shows "Message Inbox agent".
3. Read the last agent bubble "Reply to Ana: Thursday works, 10am. Here is a draft. I have not sent it." and the collapsed tool label "Searched mail, 12 results" → thread is read; `threads/markRead` fires.

### Variations
- Same flow from the Activity card row, from "Ask Inbox agent", or from Agent page "Open chat": the same thread, same state.
- Thread has no saved snapshot (first open on this device): step 1 shows a loading state, then step 2 content (loading is not drawn, see gaps).

### Edge Cases
- `threads/get` fails and a snapshot exists: Expo shows "Couldn't refresh — showing the last loaded messages." and keeps the saved copy.
- `threads/get` fails with no snapshot: error text only in Expo; no board.
- The agent was archived or deleted while the thread is open: Expo shows a removed state with "Restore" for archived bots.

### Design gaps
- Initial loading state of a thread with no snapshot is not drawn (only "small spinner when loading earlier messages").
- Failed refresh over a saved snapshot ("Couldn't refresh — showing the last loaded messages.") has no board.
- Standard iPhone top bar for a thread (title, back, agent actions) has no board; the outer strip has Back, Page/List, More only.
- Archived or deleted bot thread state ("Restore") has no board.

---

## STORY-002: Catch up on unread messages with the "New" divider
**Type**: medium
**Topic**: Talking to an agent: read and live thread
**Persona**: Tomas Brandt, operator at a 12-person fintech seed company
**Goal**: Return to a thread after a few hours and read only what is new.
**Preconditions**: The Finance agent posted 7 messages while the app was closed; the thread has 40 older messages; the user last read up to message 40.
**Device**: standard iPhone
**Ideal path**: 3 — open the thread (lands on the unread position), read down to the latest, done.
**Alternate paths**: (a) open from a push tap; (b) open from Home and use "Jump to latest" immediately to skip the unread; (c) mark unread on a thread from the agent actions (API `threads/markUnread` exists, no planned entry point).
**Design source**: `PG-A-Thread.dc.html` (messages, composer); Thread rules. The "New" divider and the "Jump to latest" control: NO BOARD.

### Steps
1. Open "Finance agent" from Personnel → saved snapshot shows, then the server snapshot arrives with `unreadCount` of 7.
2. The thread positions at the first unread message and shows a divider labelled "New" above it (Expo label) → older messages sit above the fold.
3. Scroll up slightly → the small spinner at the top shows while earlier messages load (rule card: "Loading earlier messages: small spinner at the top").
4. Scroll down through the 7 new messages → each agent bubble (muted card fill) reads in order, caption under the last bubble of a run only.
5. A tool label "Opened Team Computer" appears mid-run; tap it → it expands to show "Computer: ..." and "Action: ..." detail.
6. Reach the bottom → `threads/markRead` clears the unread state; the Home Personnel row loses its unread indicator when you go Back.

### Variations
- Nothing unread: no divider, thread opens at the bottom.
- More than one page of unread: the divider stays put while older/newer pages load.

### Edge Cases
- A new message arrives live while reading older ones: Expo shows a "new messages" pill with a down arrow; staying put avoids losing the reader's place.
- The divider is computed from the first live snapshot only; later events do not move it (discovery: "unread divider computed only from the snapshot").
- Reading from the saved snapshot offline: divider placement is undefined.

### Design gaps
- The unread divider ("New" in Expo) is planned in phase 4 but not drawn in DS-06 or PG-A-Thread.
- The "new messages" / "Jump to latest" controls are in the Expo app, not on any board.
- Expo has an explicit "Load earlier messages" text button; the rule card shows only a spinner. Planned native behavior (auto-load on scroll vs button) is undecided.
- No Home-row unread indicator is drawn for Personnel rows (only an Activity dot).
- Entry point for `threads/markUnread` is not defined.

---

## STORY-003: Watch an agent work live, with tool steps and a streamed reply
**Type**: medium
**Topic**: Talking to an agent: read and live thread
**Persona**: Priya Natarajan, founder of a two-person climate-data startup
**Goal**: Send nothing; just keep the thread open while the Legal agent works on a task already started on the web, and read the answer as it arrives.
**Preconditions**: A run started from web is in progress on the Legal agent; the phone has the thread open.
**Device**: standard iPhone
**Ideal path**: 2 — open the thread, watch it fill in live; no taps are needed after opening.
**Alternate paths**: (a) watch the same run from a Group thread member line (STORY-006); (b) the Home Activity card shows the run as working (PG-A-Home) and opens the thread.
**Design source**: `PG-A-Thread.dc.html`; `DS-06-Chat.dc.html` (working indicator, tool-call label running state, agent message); Thread rules (Working row).

### Steps
1. Open "Legal agent" → snapshot arrives; the footer shows the working indicator: a 28 pt bot avatar with a rotating ring and a pill of three pulsing dots, with the label "Legal agent is working".
2. The agent starts a tool call → a tool label appears with a 14 pt spinner and a present-tense label ("Searching mail" style, per DS-06) → label turns to past tense ("Searched mail") when done.
3. The first token of the reply arrives → the working indicator disappears at once and an agent bubble starts growing with markdown text.
4. The reply finishes → the bubble stops growing; the composer's trailing control returns from Stop to Dictate (empty field).
5. Tap the tool label "Read 2 documents" → expands to the detail card; tap again → collapses (state is local, not persisted).

### Variations
- Reduce Motion on: no ring rotation, dots static at 60% opacity, VoiceOver label "Working".
- The run needs approval: the run goes to `run.waiting_input` and an approval card appears (belongs to the Approvals topic, #417; this story only observes it).

### Edge Cases
- Run fails: Expo shows "Last run failed: {error}" in red text after the messages.
- Stream drops mid-reply: see STORY-004.
- Tool label arguments are never shown by default (DS-06 rule).

### Design gaps
- Working label text differs: board shows "Inbox agent is working" with three dots; DS-06 specimen shows a name-less 36 pt slot; Expo shows "{name} is working" plus a status line and "Still waiting on {service}". The status-line behavior has no board.
- The rule card says "three blue dots" but DS-06 says dots use `mutedForeground` and the ring `statusWorking`; colour needs reconciliation.
- Failed-run note ("Last run failed") has no board; only the failed send bubble is drawn.
- Streaming partial markdown (open code fence, half a table) rendering is not specified.

---

## STORY-004: Reconnect after the live stream drops in a tunnel
**Type**: medium
**Topic**: Talking to an agent: read and live thread
**Persona**: Lars Eriksen, founder commuting by train with spotty signal
**Goal**: Keep following an agent's reply across a connection loss and see no duplicated or missing messages.
**Preconditions**: Thread open on the Finance agent, run in progress, SSE connected from the highest `seq`.
**Device**: standard iPhone
**Ideal path**: 1 — do nothing; the app reconnects itself. (Zero user taps is the target.)
**Alternate paths**: (a) pull up from Home and reopen the thread to force a fresh `threads/get`; (b) none for manual reconnect is planned.
**Design source**: NO BOARD for reconnecting, offline or stale state. Working indicator and bubbles: `DS-06-Chat.dc.html`. Behavior: `docs/ios-native/plan.md` Phase 4 and discovery "State Transitions".

### Steps
1. Train enters a tunnel while the Finance agent streams a reply → no data arrives; after 20 s idle the client sends a heartbeat; nothing returns.
2. At 45 s of silence the watchdog drops the connection → the thread stays on screen with the partial bubble; no error is drawn (undefined, see gaps).
3. The client retries with backoff 250 ms, 500 ms, 1 s, 2 s, then 5 s steady → each attempt first refetches the snapshot (`threads/get`) and then resubscribes from the highest `seq`.
4. Signal returns → the snapshot now contains the full reply; the partial bubble is replaced by the final bubble with no duplicate.
5. The stream resumes; the working indicator clears because the run is complete → the thread is quiet again.

### Variations
- Server restarts (older self-hosted server): subscribe fails; same backoff.
- Stream returns an `error` frame with status 401: the client does not reconnect; it signs out (session ended) or re-selects the space (user left the space).

### Edge Cases
- Device sleeps in the background: on return, the client refetches the snapshot before subscribing.
- Two quick drops: backoff keeps growing to the 5 s cap and resets after a successful frame (reset rule is implied, not stated).
- The user taps Stop while offline: not covered by this topic.

### Design gaps
- No board shows an offline, "Reconnecting" or stale-thread indicator; the brief lists it as "required by the brief but no board".
- The 401 error frame outcome (signed out or left space) has no board for the thread.
- Whether the user can see that a heartbeat or retry is happening is undecided; silent retry is assumed.
- Backoff reset behavior is not stated.

---

## STORY-005: Read a long agent reply with a table, code and an image
**Type**: medium
**Topic**: Talking to an agent: read and live thread
**Persona**: Hana Sato, operations lead at a 6-person marketplace startup
**Goal**: Read an agent's long markdown reply, copy a code snippet, expand a table and open an image.
**Preconditions**: The Inbox agent's last message is the "Pilot checklist" reply: heading, bulleted list, a code block labelled json, a vendor table, a chart image.
**Device**: standard iPhone
**Ideal path**: 6 — each of the four content kinds needs one tap to use it, plus Back from the sheet and viewer.
**Alternate paths**: (a) long-press the message → native context menu with Select and Copy for the whole message; (b) read the same table from the Agent page (PG-A-AgentPage, separate rendering of similar data).
**Design source**: `DS-06-Chat.dc.html` (Agent message, long markdown; inline image attachment); image viewer `PG-A-Image.dc.html`. Table Expand sheet: described in DS-06 text only, no PG board.

### Steps
1. Scroll to the agent bubble "Pilot checklist" → headings (19 pt h1, 16 pt h2), a bulleted list, and a link row with a 16 pt letter tile all render.
2. Tap "Copy" on the json code block → label changes to "Copied" for 1.5 s; the pasteboard holds the block text.
3. Tap "Expand" (arrow.up.left.and.arrow.down.right) on the "Vendor / Status / Amount" table card → a full-height sheet opens with tabular amounts (shown as `[AMOUNT]` in the board).
4. Dismiss the sheet → back at the same scroll position.
5. Tap the "chart.png" attachment (248 KB) → the full-screen viewer opens with "Share" and "Save to Photos".
6. Tap "Close" → return to the thread.

### Variations
- Long-press a bubble: "Copy" the whole message.
- Image fails to load: the card shows "Could not load image" with "Retry" (DS-06).
- Image is still loading: spinner on accent fill.

### Edge Cases
- A link opens outside the app (Safari); the thread keeps its position.
- Code blocks never scroll horizontally; the Expand route is offered instead (DS-06 rule says "offer Expand" but the code block header only shows Copy).
- Dynamic Type at large sizes: only partly specified.

### Design gaps
- Table Expand sheet and code Expand have no PG board (only described in DS-06).
- Link tap behavior (in-app browser vs Safari) is not specified.
- Dynamic Type and light-mode behavior of the long markdown are not verified on the boards.
- On standard iPhone the image viewer's "Close" and "Share / Save to Photos" placement is drawn only for the Duo outer strip.

---

## STORY-006: Follow a group thread with several agents working at once
**Type**: medium
**Topic**: Talking to an agent: read and live thread
**Persona**: Ines Duarte, CEO of a 9-person biotech tools startup
**Goal**: Open the "Funding room" group and see what each member agent is saying and doing before a board meeting.
**Preconditions**: A group of three bots (Finance agent, Legal agent, Chief) exists; Finance and Legal runs are in progress at the same time.
**Device**: standard iPhone
**Ideal path**: 2 — open the group row, read; per-agent lines show live state without any further taps.
**Alternate paths**: (a) open from a push notification (group wins over bot, phase #422); (b) open the group from Home Personnel groups; (c) tap "Members" in the side group on Duo outer (PG-A-GroupThread) for the member list.
**Design source**: `PG-A-GroupThread.dc.html`; Group rules; `DS-06-Chat.dc.html` (event label, working indicator).

### Steps
1. Tap "Funding room" in Personnel → group thread opens; title capsule shows the stacked member avatars and the name "Funding room".
2. Read the history → each bubble has the agent's name above it ("Finance agent", "Legal agent"); identity is the avatar color only, bubbles are not tinted.
3. See the footer → one working line per working agent: "Legal agent is working" (board shows one line; with two agents working, two lines).
4. A tool label "Read 2 documents" appears under the Legal agent's text → tap to expand.
5. An event label "Chief handed off to Finance agent" appears centered between hairlines → read-only system note.
6. Open the member list → on Duo outer, tap "Members" (person.2); on standard iPhone the entry point is undefined.

### Variations
- A member was removed from the group: its old bubbles keep its name; event label "Legal agent left the thread".
- Empty group thread: member avatars with "Message the group".

### Edge Cases
- Two agents finish within the same second: each working line disappears on its own first token.
- A bot in the group is archived: bubbles keep the name (archived label shown in Expo as "archived").
- Group `Send` is the prominent action (Group rules), unlike Agent thread where Allow is.

### Design gaps
- Member list pane has no board (only "extra level: member list opens as a third pane").
- Standard-iPhone entry to Members and to group settings is not drawn.
- The empty-state copy "Message the group" is only in the rule card, not drawn.
- Multiple simultaneous working lines: only one line is drawn; maximum visible count with 6 members is unspecified.
- Same information, different surfaces: working state shows on Home Activity card, the group footer, and (later) Live Activities.

---

## STORY-007: Start a fresh agent and see the empty thread
**Type**: short
**Topic**: Talking to an agent: read and live thread
**Persona**: Daniel Mercer, first-time founder trying the app on day one
**Goal**: Open a brand-new agent and understand what it can do before typing.
**Preconditions**: A bot just created; no messages exist.
**Device**: standard iPhone
**Ideal path**: 2 — create flow lands on the thread; the greeting and suggestions are readable without tapping.
**Alternate paths**: (a) from Home empty state "Tap + to create a bot" then New bot > Create, which opens the thread; (b) create from New group > "Create group" which opens a group thread (empty state "Message the group").
**Design source**: Thread rules (Empty row: "agent greeting and suggestions"); `PG-B-NewBot.dc.html` for step 1. Greeting and suggestion chips: NO BOARD.

### Steps
1. Finish New bot with a name and tap "Create" → thread opens for the new bot.
2. See the empty state → an agent greeting and suggestion rows; the composer reads "Message {agent name}".
3. Tap a suggestion → it fills the composer (send behavior belongs to the write-thread topic #417).

### Variations
- `needsModel` is true (no model connected): "Connect a model to start a run" (brief, no board).
- Group with no messages: "Message the group".

### Edge Cases
- Suggestion list is tall: Expo makes it scroll so the composer stays above the keyboard.
- No network at creation: not covered here.

### Design gaps
- Empty agent greeting and suggestion layout is described in the rule card but not drawn.
- "Connect a model to start a run" has no board.
- Whether suggestions send immediately or only fill the composer is undecided.

---

## STORY-008: Hit an unknown message block from a newer server
**Type**: short
**Topic**: Talking to an agent: read and live thread
**Persona**: Grace Whitfield, founder who self-hosts the server and updates it before the app
**Goal**: Keep reading a thread when an agent posts a block kind the app does not know.
**Preconditions**: Server returns a message whose block kind is not in the app's list (about 25 known kinds); the rest of the thread is normal.
**Device**: standard iPhone
**Ideal path**: 1 — scroll past; the placeholder tells her something is not shown.
**Alternate paths**: open the same message on web, which renders it (no link from the placeholder is planned).
**Design source**: NO BOARD (plan Phase 4: "Unknown block kinds show a neutral placeholder").

### Steps
1. Scroll to the agent turn with the new block → text blocks render normally; the unknown block shows a neutral placeholder row.
2. Continue reading → surrounding messages are unaffected and the thread keeps streaming.

### Variations
- A known block with an unknown field: renders as known (contract parsing is lenient).
- Block kinds belonging to later phases (ask, choice, mail approval, MCP approval) in a phase-4-only build: they use the same placeholder until phase 5.

### Edge Cases
- Message with only unknown blocks: the bubble would contain only the placeholder.
- Unknown product event type on the SSE stream: ignored by the reducer.

### Design gaps
- The placeholder itself has no board (copy, icon, whether it names the kind).
- Between phase 4 and phase 5, approval cards would show as the placeholder even though the board draws them; the interim behavior should be stated.
- No path to "open on web" from the placeholder.

---

## STORY-009: Read a thread on iPhone Duo outer display with the side strip
**Type**: long
**Topic**: Talking to an agent: read and live thread
**Persona**: Rafael Ortiz, founder who carries a folding phone and checks agents between meetings
**Goal**: Read the Inbox agent thread on the outer display, glance at its Page and List, and leave.
**Preconditions**: iPhone Duo, outer display (466x678 pt), closed. Thread has a draft awaiting approval.
**Device**: iPhone Duo outer
**Ideal path**: 4 — open thread, read, tap Page, Back.
**Alternate paths**: (a) Open chat from the Agent page; (b) List (checklist icon) in the strip opens the agent's list; (c) the More group opens agent actions (settings, open computer, clear, archive, delete).
**Design source**: `PG-A-Thread.dc.html`; Thread rules (outer layout); `PG-A-AgentPage.dc.html` for the Page destination; `Main.dc.html` for the outer chrome (not read in full).

### Steps
1. From Home tap "Inbox agent" → thread opens; the 60 pt left strip shows the Dynamic Island, time, a Back group, Page and List icons, a spacer, and a More group.
2. Read the content column (starts at x=72): glass title capsule "Inbox agent" at top, messages bottom-aligned, floating composer with "Message Inbox agent".
3. Read the "Needs approval" mail card: "Send reply", "To Ana Ruiz", body text, and the two actions "Deny" and "Allow" (Allow is the one prominent button).
4. Tap the Page icon (doc.text) in the strip → the agent's pinned Page opens, titled with the agent name, with "Open chat" as its prominent button.
5. Tap "Open chat" → return to the thread at the same scroll position.
6. Tap More → a menu lists the agent actions (settings, open computer, clear, archive, delete).
7. Tap away → the menu closes; the thread is unchanged.
8. Tap Back (strip) → return to Home.

### Variations
- Short height (466x420): strip items collapse bottom to top into More; the prominent action collapses last.
- Pins strip: if messages are pinned, a horizontal strip of chips sits under the title capsule (44 pt chips; tap scrolls to the message; long-press "Unpin"); hidden when empty.

### Edge Cases
- The More menu "clear" and "delete" are destructive and need a confirm (belongs to Home/Settings stories).
- The thread has an unread divider while in the strip layout: position relative to the capsule is undefined.
- Back goes to Home or to the Agent page depending on how the thread was entered; stack behavior is not specified.

### Design gaps
- The approval card on `PG-A-Thread` is the only card drawn at outer width; its action labels are "Deny" and "Allow" (board) while DS-06 uses "Allow once / Always allow / Deny" for MCP and "Save / Send" for mail; the board's mail card differs from DS-06's mail card (title "Send reply" vs "Re: Pilot timeline").
- No message-level context menu is drawn for the strip layout (long-press menu is native, not shown).
- Pins strip placement relative to the glass title capsule on the outer layout is not drawn.
- Standard-iPhone parity of Page and List is not drawn.

---

## STORY-010: Read the thread beside the Personnel list on the inner display
**Type**: long
**Topic**: Talking to an agent: read and live thread
**Persona**: Fatima Rahman, head of operations at a 20-person SaaS startup
**Goal**: Unfold the Duo while reading a thread, switch between agents from the sidebar, and keep reading.
**Preconditions**: iPhone Duo; thread open on the Inbox agent on the outer display; two other agents have unread messages.
**Device**: inner flat
**Ideal path**: 3 — unfold, tap the next agent in the sidebar, read.
**Alternate paths**: (a) half-folded 1/2 + 1/2: Personnel list left, thread with composer right; (b) laptop pose: thread on the top half, composer on the bottom half; (c) outer display: Back to Home then tap another agent (4+ steps).
**Design source**: `Inner.dc.html`, `Split.dc.html`, `Desk.dc.html` (not read in full here); Thread and Group rules for inner, half-folded and laptop descriptions; `PG-A-Thread.dc.html`.

### Steps
1. Unfold the phone with the thread open → the layout changes to 1/3 + 2/3 (890x626 pt, flat); the sidebar (right-edge side bar) and the third pane show the Personnel list; the thread stays on screen.
2. Read the Inbox agent thread in the two thirds → same bubbles, tool labels and working state as outer.
3. Tap "Finance agent" in the third → the thread pane switches to the Finance agent; its snapshot shows first, then the server snapshot replaces it.
4. See the unread divider in the Finance thread → read down to the latest.
5. Fold halfway → the layout snaps to 1/2 + 1/2 with nothing important at x 435-455; Personnel left, thread with its composer right.
6. Rotate to laptop pose (626x890) → thread on the top half, composer and quick actions as a horizontal bar on the bottom half; an approval card (if any) sits above the composer.
7. Unfold again to inner flat → the same agent stays selected and its scroll position is kept.

### Variations
- Open a group thread in the third pane: the sidebar lists Personnel and groups; the member list opens as a third pane.
- Agent page open next to the thread: thread in the third, page in the two thirds.

### Edge Cases
- A live stream is running while the layout changes: the stream must not restart; the reducer state survives the posture change.
- Switching agents quickly: the earlier thread's subscription must stop; unread state of the earlier thread is marked read only if the user reached the bottom.
- Fold line crossing a message bubble in half-folded mode.

### Design gaps
- Which thread the pane shows when the inner display opens with no selection (the "last opened thread" is only said for Home) is not defined.
- The sidebar unread indicator per agent is not drawn.
- Per-agent subscription lifecycle when switching is not specified (one stream or several).
- Duo APIs sit behind `if #available(iOS 27.1, *)`; behavior on earlier OS versions for a folded device is not drawn.
- The same thread is rendered on outer, inner, half-folded and laptop pose; state and copy must match, but parity of the pins strip and unread divider across them is not drawn.

---

## STORY-011: Review the full history of an agent: search jump, paging and saved chat
**Type**: long
**Topic**: Talking to an agent: read and live thread
**Persona**: Naomi Feldman, founder reconstructing what the Finance agent said about the Q3 runway three weeks ago
**Goal**: Jump to an old message, read around it, then return to the present without losing her place.
**Preconditions**: Finance agent thread has about 600 messages across many pages. A saved-chat snapshot of the last 50 exists on the device. Global search exists in the API (`search.query`) but is not drawn.
**Device**: standard iPhone
**Ideal path**: 6 — open thread, scroll up with paging, find the message, tap a pin chip if one exists, read, "Jump to latest".
**Alternate paths**: (a) Search from Home side strip (Search icon, PG-A-Home) and tap a hit to jump with `threads/messages({around})`; (b) tap a pinned-message chip under the title capsule (pins strip, DS-06); (c) open from a notification linking to a specific message (no board).
**Design source**: `PG-A-Thread.dc.html`, Thread rules (loading earlier); `DS-06-Chat.dc.html` (pins strip). Search results screen: NO BOARD. Pagination boundary and "around" window: NO BOARD.

### Steps
1. Open "Finance agent" → saved snapshot of the last 50 messages shows, then the server snapshot replaces it.
2. Scroll up to the top of the loaded messages → a small spinner shows and the next older page (`threads/messages` with `before`) is fetched; messages are inserted above without moving the visible position.
3. Keep scrolling up through three more pages → each page repeats the same spinner and insert.
4. Reach the beginning of the thread → the spinner stops and the first message is visible (end-of-history marker is undefined).
5. Read the message about runway and tap its tool label "Searched mail" → expands the detail card.
6. Long-press the message → native context menu; choose Copy.
7. Tap the "Jump to latest" control (Expo: down arrow button) → the thread scrolls to the newest message.
8. Check that live messages still arrive → the reducer applied them while the older pages were open.

### Variations
- Jump in from search with `around: {messageId}`: the thread shows a window of messages around the hit with newer pages loadable below; a "Jump to latest" control returns to the live end (Expo has a "pinned page" mode for this).
- Tap a pins-strip chip "Pilot terms": the thread scrolls to the pinned message; the current chip gets a 14% primary tint.
- Pins strip is empty: it is hidden.

### Edge Cases
- A new message arrives while viewing a window around an old hit: the live message is held and a "new messages" pill appears (Expo behavior).
- Paging fails midway (offline): Expo marks the newer load as failed and stops auto-retry; the native loading state is undefined.
- The saved-chat snapshot is for a different space or user (after space switch or sign-out): it must not display (caches are wiped or re-keyed on switch).
- Thread of 600 messages memory use: unspecified cap.

### Design gaps
- Global search results screen and message jump are planned in the API but not drawn.
- "Jump to latest" and "new messages" pill have no board.
- End-of-history marker and paging failure are not drawn.
- Pins strip exists on DS-06 but the Thread rule card does not list it in primary data or layout.
- Saved-chat snapshot: when it is stale, whether any signal is shown, and the retention size are not defined.

---

## STORY-012: Read and approve-view an agent's mail draft while the stream is live
**Type**: long
**Topic**: Talking to an agent: read and live thread
**Persona**: Jonah Whitaker, founder of a 4-person devtools startup, on a standard iPhone at a coffee shop
**Goal**: Watch the Inbox agent draft a reply to Ana, read the draft and the tool steps, and see the status change when the draft is sent from another device.
**Preconditions**: Thread open; mail writes are enabled; a run is in progress; the same user also has the web app open.
**Device**: standard iPhone
**Ideal path**: 5 — open thread, wait for the card, read, (decide in the write topic), watch the status flip.
**Alternate paths**: (a) approve from the web app; (b) approve from the Inbox message view via "Ask Inbox agent" thread; (c) decide in the phone thread (write behavior is the Approvals topic, #417).
**Design source**: `PG-A-Thread.dc.html` (Needs approval card, "Deny", "Allow"); `DS-06-Chat.dc.html` (Mail approval card: Needs approval, Sent, Not sent). Read-only phase-4 rendering of approval cards: NO BOARD.

### Steps
1. Open "Inbox agent" → snapshot arrives; the working indicator "Inbox agent is working" is at the bottom.
2. A tool label "Searched mail, 12 results" appears, then the agent bubble "Reply to Ana: Thursday works, 10am. Here is a draft. I have not sent it." streams in.
3. The mail approval card appears: status "Needs approval" in warning color, rows "To Ana Ruiz", subject, body "Hi Ana, Thursday works. Let's start at 10am."
4. The run goes to `run.waiting_input` → the working indicator is replaced by the card's waiting state; the composer remains available.
5. Jordan approves and sends the mail on the web app → a product event arrives on the SSE stream.
6. The card status flips to "Sent" with a checkmark and the actions are removed (live update, no refresh).
7. The agent posts a follow-up bubble "Sent." and the run completes → the working state clears.

### Variations
- Mail is rejected from web: status "Not sent" with an x mark.
- Phase-4-only build: the card renders as read-only or as the unknown-block placeholder (see STORY-008) and "Allow" does not act.
- Two devices act at once: a second answer to the same ask returns CONFLICT; the card shows the winning result.

### Edge Cases
- Stream drops between steps 5 and 6: the reconnect (STORY-004) refetches the snapshot, which already contains "Sent".
- Compose result `unknown`: never auto-retry (brief); card state is not drawn.
- Mail writes are off: "Changing mail is turned off."

### Design gaps
- The thread rule card names "Allow" as the one prominent action, but phase 4 is read only; interim behavior of approval cards in the read-only phase is undefined.
- Board mail card (title "Send reply", actions "Deny" / "Allow") and DS-06 mail card (subject "Re: Pilot timeline", actions "Save" / "Send") do not match.
- Live status flip from another device is not drawn; the "Sent" and "Not sent" specimens exist but no transition.
- "Changing mail is turned off." and CONFLICT outcomes have no board.
- The same approval is rendered on the thread, on the Inbox message view, on Home Activity ("needs approval") and in push; their labels need one source.
