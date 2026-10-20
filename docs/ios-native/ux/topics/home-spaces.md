# Home, Personnel and space switching: user stories

Target: the planned native SwiftUI iPhone app (epic #427, phase 3 issue #415). No Swift code exists. Sources: `docs/ios-native/ux/discovery.md`, `docs/ios-native/plan.md` (Phase 3), `docs/design-system/ios/boards/PG-A-Home.dc.html`, `PG-B-NewBot`, `PG-B-NewGroup`, `PG-B-NewSpace`, `PG-B-BotSettings`, `PG-B-GroupSettings`, the rule cards in `PG-A-Rules.dc.html` and `PG-B-Rules.dc.html`, the Expo app in `apps/mobile` (`app/index.tsx`, `app/new*.tsx`, `app/bot-settings.tsx`, `app/group-settings.tsx`, `components/bot-organize-modal.tsx`, `components/inbox-render-item.tsx`, `lib/bot-lifecycle.ts`, `app/(settings)/archived-bots.tsx`) and `packages/contracts/src/rpc.ts` (`spaces.*`, `bootstrap`, `bots.*`, `groups.*`, `botSections.*`).

Known board facts used throughout. The outer Home board (`PG-A-Home`) shows: an Inbox row ("Inbox", "3 need reply", count 42), an ACTIVITY card with "See all" and rows ("Finance agent / Reading card expenses / Working", "Inbox agent / Reply to Ana is ready to send / Approve", "Weekly runway / Ran at 8:00 AM / Done"), and a PERSONNEL list (Chief, Finance agent, Carta agent, Legal agent, Mercury agent). The side strip holds an Account group, an Activity/Search/Artifacts group, and the prominent New button, whose menu is "New bot, New group, New space". No board draws a space switcher, a space list, section headers, pinned rows, or the row long-press menu.

Cross-surface note: Home content (Personnel list, Inbox summary, Activity) is the same data on web and Expo; the native app must show the same state on outer, inner, half-folded and standard iPhone layouts. Laptop pose is "Not applicable" for Home (stays one column).

---

## STORY-001: Check what needs me and approve from Home
**Type**: short
**Topic**: Home, Personnel and space switching
**Persona**: Maya Okafor, solo founder of a 4-person logistics startup
**Goal**: See at a glance whether anything needs her, then approve the Inbox agent's reply without hunting through threads.
**Preconditions**: Signed in, Personal space selected, Inbox agent has a drafted reply waiting for approval, Finance agent is mid-run.
**Device**: standard iPhone
**Ideal path**: 3 — open the app (Home is the root), tap the "Approve" row in ACTIVITY, tap the approval card's Allow in the thread.
**Alternate paths**: (a) Activity icon in the side strip/toolbar (carries a dot when something needs you) then the same row. (b) PERSONNEL row "Inbox agent" then find the approval card in the thread. (c) Push notification tap (phase 10, no board for the banner) routes straight to the thread.
**Design source**: PG-A-Home / PG-A-Rules "Home" (Inbox row card, ACTIVITY card, Personnel rows, Activity dot); PG-A-Thread / PG-A-Rules "Agent thread" for the approval card (prominent action is Allow). Standard iPhone layout of Home: NO BOARD (boards are 466x678 outer display, inner and half-folded only).

### Steps
1. Launch the app with a saved session → Home shows the saved Home snapshot, then fresh `bootstrap`/`spaces.list` data replaces it; Inbox row reads "Inbox", "3 need reply".
2. Glance at the ACTIVITY card → "Finance agent / Reading card expenses / Working" and "Inbox agent / Reply to Ana is ready to send / Approve".
3. Tap the "Inbox agent" Activity row → the agent thread opens with the approval card visible; Home's Activity dot clears once nothing needs her.
4. Tap Allow in the approval card → run continues; "Approve" row disappears from ACTIVITY when she navigates Back.

### Variations
- Nothing running: ACTIVITY card is hidden ("Activity hides when nothing is running"); Home shows only the Inbox row and PERSONNEL.
- Several approvals: rows stack in ACTIVITY; "See all" opens the full list (destination of "See all" is NO BOARD).

### Edge Cases
- Cold start with no network: saved Home snapshot renders; no board shows an "offline" or "stale" marker.
- Approval was already answered on web: the thread shows the ask as resolved; a second Allow returns CONFLICT (discovery: "A second answer to the same ask returns CONFLICT").

### Design gaps
- "See all" destination (full Activity list) has no board; the Activity icon in the side strip also has no destination board.
- Standard iPhone (393 pt) Home layout is not drawn; where Account/Activity/Search/Artifacts and New sit in the horizontal toolbar is only described in text.
- Expo labels these header controls "Account", "Activity", "Search", "Artifacts", "Create"; the board names the prominent button "New". Pick one accessible name.
- Saved-Home-snapshot behavior (stale marker, timestamp) is in the plan but not drawn.

---

## STORY-002: Create the first bot from an empty Home
**Type**: short
**Topic**: Home, Personnel and space switching
**Persona**: Tomas Reyes, first-time founder who just signed up
**Goal**: Create a bot named "Bookkeeper" and be ready to chat with it.
**Preconditions**: New account, Personal space with no bots.
**Device**: standard iPhone
**Ideal path**: 4 — New, New bot, type Name, Create.
**Alternate paths**: (a) Tap the Personnel row for an existing integration agent instead of creating a bot. (b) Create from the empty state itself: the empty copy says "Tap + to create a bot" but is not tappable in the board. (c) Create via web and wait for sync.
**Design source**: PG-A-Home / PG-A-Rules "Home" (empty state, New menu); PG-B-NewBot / PG-B-Rules "New bot" (large sheet; fields Name, Title, Description; Create disabled until Name has text; pending "Creating").

### Steps
1. Open Home → centered empty line "Tap + to create a bot".
2. Tap the prominent New (plus) → menu with "New bot", "New group", "New space".
3. Tap "New bot" → large sheet "New bot" with grabber and fields Name, Title, Description; Cancel (xmark) top-left, Create prominent but disabled.
4. Type "Bookkeeper" in Name → Create becomes enabled.
5. Tap Create → button shows "Creating"; sheet dismisses; Bookkeeper appears in PERSONNEL (Expo: also navigates into the new thread, `app/new.tsx`).

### Variations
- Fill Title ("Describe what this bot does" placeholder in Expo) and Description ("What this bot is for") before Create.
- Swipe down with a dirty form → "dirty form asks before discarding" (alert wording NO BOARD).

### Edge Cases
- Server rejects: red line "Could not create bot" appears, fields keep input.
- User has no model connected (`me.needsModel`): bot is created but first message will fail; see STORY-009.
- Duplicate bot names: no rule on whether allowed.

### Design gaps
- Discard-changes confirmation for a dirty New bot sheet is described but not drawn.
- After Create, is the user taken to the thread or returned to Home? Rules do not say; Expo opens the thread.
- Empty-state copy "Tap + to create a bot" names a "+" but the board's button is labeled New; also does not mention groups or spaces.
- Expo `app/index.tsx` has a fallback that creates a bot literally named "New Bot" without a form; the board has no such path.

---

## STORY-003: Recover when Home fails to load, then reach Personnel
**Type**: short
**Topic**: Home, Personnel and space switching
**Persona**: Priya Nair, operations lead on a train with flaky signal
**Goal**: Get Personnel to load after an error.
**Preconditions**: Signed in, server temporarily unreachable.
**Device**: standard iPhone
**Ideal path**: 2 — open Home and see the error, tap "Try again".
**Alternate paths**: (a) Pull to refresh (not specified in boards). (b) Force quit and relaunch to re-run bootstrap. (c) Switch network and wait for automatic retry (not specified).
**Design source**: PG-A-Rules "Home" empty/loading/error text; no Home error board is drawn. Loading: three placeholder rows (text only). Error: "Could not load bots" plus "Try again" (text only).

### Steps
1. Launch app → three placeholder rows show while `bootstrap`, `me`, `spaces.list` load.
2. Request fails → centered "Could not load bots" with a "Try again" button; Activity hidden.
3. Tap "Try again" → placeholders reappear, then PERSONNEL fills in with Chief, Finance agent, and so on.

### Variations
- A saved Home snapshot exists: it renders instead of placeholders, and the error should not blank it (rule not stated).
- 401 without a space header: user is signed out and lands on Sign in (discovery "Session end").

### Edge Cases
- 401 with a space header (stale space): client re-probes without the header and recovers to the default space; user sees no error.
- Error on only `spaces.list` while bots loaded: not specified.

### Design gaps
- The error message says "Could not load bots" even when the failure is spaces or Inbox summary; the rule does not separate partial failures.
- No board for loading, error, or snapshot-stale states of Home; only text in the rule card.
- Pull-to-refresh is not mentioned in the boards or plan.

---

## STORY-004: Create a group of agents and send it to the group thread
**Type**: medium
**Topic**: Home, Personnel and space switching
**Persona**: Jonas Weber, head of finance and legal at a 15-person SaaS startup
**Goal**: Make a "Closing team" group containing the Finance agent and the Legal agent, then open its thread.
**Preconditions**: Personal space has Chief, Inbox agent, Finance agent, Legal agent.
**Device**: iPhone Duo outer (466x678)
**Ideal path**: 7 — New, New group, type name, tick two members, Create group, open group from Personnel, (thread opens).
**Alternate paths**: (a) Open an existing group's thread and add members from Group settings instead. (b) Create the group on web and see it in Personnel after refresh. None other planned on iPhone.
**Design source**: PG-A-Home (New menu); PG-B-NewGroup / PG-B-Rules "New group" (push, title "New group", Back, Name field, Members list with check marks, prominent "Create group"); PG-A-GroupThread / PG-A-Rules "Group thread" for the result.

### Steps
1. On Home tap the prominent New in the side strip → menu: "New bot", "New group", "New space".
2. Tap "New group" → pushed page "New group" with Back (chevron.left) and prominent "Create group"; Name field and Members list (Chief, Inbox agent, Finance agent, Legal agent).
3. Type "Closing team" in Name (Expo placeholder "Name this group").
4. Tap "Finance agent" and "Legal agent" in Members → check marks appear.
5. Tap "Create group" → pending state "Creating…"; page pops back to Home.
6. See "Closing team" in PERSONNEL → tap it → group thread opens with stacked avatars in the title capsule and the empty state "Message the group".
7. Tap Back → Home still shows the group.

### Variations
- Same flow on inner display: bot list in 1/3, form in 2/3, and the group thread then fills the 2/3.
- Create with zero members: allowed? Not specified.

### Edge Cases
- No bots exist: Members shows "one muted line pointing to New bot".
- Create fails: red inline "Could not create group" and selection is kept.
- Group name left empty: Create disabled (inferred from New bot; not stated for New group).

### Design gaps
- Whether Create group is disabled with no name or no members is not stated.
- Where the group appears in Personnel (grouped under bots, sections, pinned) is not drawn.
- Mixed list: board shows only bots in Personnel; groups' row design (avatar stack, preview) appears only in the Expo app (`GroupRow`) and is not on PG-A-Home.
- Expo creates the group then pops; the plan says "Group threads reuse the thread screens"; whether to open the new group directly is open.

---

## STORY-005: Create a second space for a client and switch into it
**Type**: medium
**Topic**: Home, Personnel and space switching
**Persona**: Leila Haddad, fractional COO who runs her own company and one client
**Goal**: Create the space "Acme Labs" and work in it with a clean Personnel list.
**Preconditions**: Signed in, one space ("Personal") exists.
**Device**: standard iPhone
**Ideal path**: 5 — New, New space, type name, Create space, (space opens automatically).
**Alternate paths**: (a) Create the space on web, then pull it into the app with a space switcher (NO BOARD). (b) Accept an invite to a shared space (no API: "space member management" is a missing API in plan.md).
**Design source**: PG-A-Home (New menu includes "New space"); PG-B-NewSpace / PG-B-Rules "New space" (medium-detent sheet, Cancel xmark, prominent "Create space", error "Could not create space"). The switcher: NO BOARD.

### Steps
1. Tap New on Home → menu; tap "New space".
2. Medium sheet "New space" slides up with a Name field and prominent "Create space"; detent grows with the keyboard.
3. Type "Acme Labs" → Create space enabled (inferred).
4. Tap "Create space" → `spaces.create` succeeds, client sets `x-rakazo-space-id`, wipes or re-keys caches, reloads Home.
5. Home now shows Acme Labs' own Personnel (empty state "Tap + to create a bot") and an empty ACTIVITY.

### Variations
- Rename later: Expo reuses the same sheet titled "Rename space" with button "Rename space"; the board has no rename variant.
- Space name limit: contract says 1 to 60 characters, trimmed; the board shows no counter or error for 61+ characters.

### Edge Cases
- Created but could not be opened: alert with "Try again from the sidebar" (Expo text: "Space created" / "It could not be opened. Try again from the sidebar."). The rule mentions a sidebar that is NOT drawn on iPhone.
- Error "Could not create space" in red; field keeps input.
- The user's Inbox summary row refers to the Personal space's mail; in the new space it should show the new space's own connections (not specified).

### Design gaps
- No space switcher board: how a user sees all spaces, which one is current, and how to leave Acme and return to Personal is undesigned (Expo lists spaces as headed groups in the Home list with a per-space actions menu).
- No indicator of the current space's name anywhere on the Home board.
- The rule "Try again from the sidebar" assumes a sidebar that standard iPhone does not have.
- Space rename, delete, and "default space" (all in Expo) have no boards and no confirmation copy.
- Space membership/invite flows have no API (plan.md "Missing server APIs").

---

## STORY-006: Switch between two spaces while a thread is open elsewhere
**Type**: medium
**Topic**: Home, Personnel and space switching
**Persona**: Leila Haddad, fractional COO (same user as STORY-005)
**Goal**: Move from Acme Labs back to Personal and open her Finance agent there, without seeing Acme's data.
**Preconditions**: Two spaces exist; current space is Acme Labs; Personal has Finance agent with a running routine.
**Device**: iPhone Duo inner flat
**Ideal path**: 3 — open switcher, choose Personal, tap Finance agent.
**Alternate paths**: (a) Tap a push notification from a Personal agent: client switches space first, then opens the thread (phase 10, no board). (b) Tap a search hit from another space (search board NO BOARD). (c) Tap that space's bot row directly if the Home list shows all spaces together, as Expo does.
**Design source**: Home on the inner book: Main / Inner boards and PG-A-Rules "Home" (inner: Personnel with Inbox pinned on the left third, Activity and last thread on the right). Space switcher: NO BOARD.

### Steps
1. On the inner display's left third, open the space control (NO BOARD) → list of spaces ("Personal", "Acme Labs").
2. Choose "Personal" → client calls `spaces.setActive`-style switch, sets `x-rakazo-space-id`, discards or re-keys every cache; Home reloads; the right pane shows Personal's Activity and last thread.
3. Tap "Finance agent" in the left third → right pane shows the Finance agent thread; Home stays visible in the left third.

### Variations
- Standard iPhone: same two steps in one column; Back from the thread returns to Home of Personal.
- Half-folded: Inbox + Personnel left, selected thread right.

### Edge Cases
- Switch fails: Expo alert "Could not switch spaces" / "Try again." and the previous space stays selected.
- Stale response from the previous space arrives after the switch: must be dropped (Expo invalidates request ids; plan says "wipe or re-key every cache").
- Open thread belongs to Acme: after the switch, the detail pane should not keep showing it (not specified).
- A 401 with a stale space header recovers to the default space silently.

### Design gaps
- Entire switcher control (placement, current-space indicator, loading and failure state) has no board.
- Inner display detail pane when the new space has no last thread: undefined.
- Which space is "default" and how to change it: Expo has it, plan does not mention it.
- The same Personnel data is rendered on web, Expo and native; Expo shows all spaces inline in one list, the boards show one flat Personnel list. This is a behavior decision, not a style one.

---

## STORY-007: Edit a bot's profile, voice and model, and save
**Type**: medium
**Topic**: Home, Personnel and space switching
**Persona**: Sam Whitfield, head of growth who wants the Finance agent to sound less formal
**Goal**: Rename "Finance agent" to "Money desk", pick a color, turn on spoken replies, and set a lower thinking level.
**Preconditions**: Finance agent exists; a model is connected.
**Device**: standard iPhone
**Ideal path**: 7 — Home, Finance agent row, thread menu, bot settings, edit name, toggle voice, Save.
**Alternate paths**: (a) Long-press the bot row in Personnel (Expo opens the organize sheet, which is pin/move, not settings; settings is not reachable there). (b) Open the agent page's menu (NO BOARD for a settings entry). (c) Account settings > Models for model defaults (PG-B-Models), not per-bot.
**Design source**: PG-A-Thread (More menu, entry point not drawn); PG-B-BotSettings / PG-B-Rules "Bot settings" (large title "Chat settings", grouped fields, Voice group, Advanced row, prominent Save with spinner); DS-04 for pickers.

### Steps
1. On Home tap "Finance agent" → thread opens.
2. Open the bot menu in the trailing toolbar group → choose settings (menu item label NO BOARD) → pushed "Chat settings" with Back and prominent Save (checkmark).
3. Edit Name to "Money desk" → field updates.
4. Tap a color swatch in Color → swatch selected (Expo: eight colors plus "Custom image").
5. Turn on "Read replies aloud" → Voice group shows voice choice and "Device voice" option.
6. Tap Advanced → rows "Model" and "Thinking" (Expo values include Minimal, Low, Medium, High, Extra high, Max, plus "Default (medium)" and "Space default").
7. Pick "Low" for Thinking → row updates.
8. Tap Save → spinner on the button, page pops back to the thread, title now "Money desk"; PERSONNEL on Home also shows the new name.

### Variations
- Edit Title and Description fields ("Describe what this bot does", "What this bot is for").
- Toggle "Notifications" and the Skills list (Expo only; not on the board).
- Inner display: bot list 1/3, form 2/3 (max 560 pt, left aligned).

### Edge Cases
- Save fails: red line above the toolbar action, "Could not save bot", fields keep input.
- Voice list fails to load: Expo "Could not load voices".
- Model settings fail to load: "Could not load model settings".
- Back with unsaved edits: no rule.

### Design gaps
- How to reach bot settings from a thread or Personnel row is not drawn ("Push from the bot menu" only).
- Board title "Chat settings" vs the object being a bot (rule card calls it "Bot settings"); naming mismatch.
- Skills and Notifications rows exist in Expo but not on PG-B-BotSettings.
- Unsaved-changes handling and per-field validation are undefined.
- Voice sample button "Hear a sample" belongs to PG-B-Voice, not to this page; Expo plays "Hi, this is how I'll sound." inline.

---

## STORY-008: Archive a bot from its thread and restore it later
**Type**: medium
**Topic**: Home, Personnel and space switching
**Persona**: Dana Kowalski, COO tidying Personnel before an investor update
**Goal**: Remove "Old Recruiter" from Personnel without losing its chat, then bring it back two weeks later.
**Preconditions**: Bot "Old Recruiter" exists with history.
**Device**: standard iPhone
**Ideal path**: 6 — Old Recruiter row, bot menu, Archive; later Account (Settings), Archived bots, Restore.
**Alternate paths**: (a) Restore from the archived thread's own banner (Expo shows "Archived. Chat, memory, and files kept." with a restore action). (b) Delete instead of archive ("Delete {name}?" with "Keep memories" or "Delete memories too"); destructive, no board. (c) Archive from web.
**Design source**: Archive action and restore: NO BOARD. Archived bots list is part of Settings (PG-B-Settings, not read in depth here; rows beyond the listed ones are undefined). Delete confirmation: DS-04 alert pattern only.

### Steps
1. Tap "Old Recruiter" in PERSONNEL → thread.
2. Open the bot menu → tap "Archive" → confirmation (Expo uses an alert; wording NO BOARD).
3. Confirm → `bots.archive`; thread closes or shows the archived state; Home PERSONNEL no longer lists the bot.
4. Two weeks later: open Account from the Home side strip → Settings sheet; tap "Archived bots" → list; empty state would read "No archived bots".
5. Tap "Old Recruiter" → restore choice (Expo calls `restoreArchivedBot`); on success the bot returns to Personnel.
6. Back to Home → bot visible again with its history.

### Variations
- Archive a group instead: `groups.archive` and `groups.listArchived` exist in the API; Expo's archived list covers bots.
- Last bot archived: Home returns to "Tap + to create a bot".

### Edge Cases
- Archive fails: alert "Could not archive bot" / "Try again."
- Restore fails: "Could not restore bot"; list load fails: "Could not load bots" + "Try again."
- Archived bot has an active routine or pending approval: behavior not specified.
- A push notification arrives for an archived bot: routing undefined.

### Design gaps
- Archive entry point, confirmation, and the thread's archived banner have no board.
- Archived bots list and its empty/error states are not on any Home board; PG-B-Settings does not draw the "Archived bots" row in the version read.
- Groups can be archived and restored through the API (`groups.archive`, `groups.listArchived`), but Expo's list and the boards cover only bots.
- Delete (separate from archive) has no board and no copy for the memory choice.

---

## STORY-009: First run with no model connected: from Home to a working bot
**Type**: long
**Topic**: Home, Personnel and space switching
**Persona**: Ravi Patel, solo founder who signed up with a new account on the default server
**Goal**: Land on Home, understand a model is needed, connect one, create a bot, and send a first message.
**Preconditions**: New account, new Personal space, no model, no bots, no integrations, `me.needsModel = true`.
**Device**: standard iPhone
**Ideal path**: 14 — see below; an ideal flow would pre-empt the dead end with a single prompt on Home.
**Alternate paths**: (a) Create the bot first and be told at first send ("Connect a model to start a run."). (b) Settings > Models directly from Account. (c) A deployment-provided model (`defaultProvider` without a key) means `needsModel` is false and the flow shortens to STORY-002.
**Design source**: PG-A-Home empty state; PG-B-NewBot; PG-B-Models and PG-B-Settings for model connection (not read in depth here); Sign in handoff: PG-B-SignIn. The `needsModel` prompt: NO BOARD.

### Steps
1. Finish Sign in → bootstrap, `me`, `spaces.list` run; Home loads with three placeholder rows then the empty state "Tap + to create a bot".
2. Client notes `me.needsModel` and routes toward connecting a model (destination and prompt copy NO BOARD).
3. Tap Account in the toolbar → Settings opens as a sheet.
4. Tap "Models" → pushed Models page (PG-B-Models); list of providers.
5. Choose a provider and enter an API key (secrets are never shown after entry) → connection succeeds; `needsModel` becomes false.
6. Close Settings → back on Home, empty state remains.
7. Tap New → tap "New bot" → New bot sheet opens.
8. Type Name "Chief of staff", Title "Runs my week" → Create enabled.
9. Tap Create → "Creating", sheet closes, bot in PERSONNEL.
10. Tap the bot row → empty agent greeting and suggestions appear in the thread.
11. Type "What should I do first?" in the floating composer → send.
12. Working indicator "Chief of staff is working" with a stop control appears.
13. Reply streams in; Home's Activity card (after Back) briefly shows "Working" then "Done".
14. Back to Home → bot row preview shows the first reply line and time.

### Variations
- Rotate the order: create the bot (step 7 to 9) before the model; first send then fails with the no-model error and a path to Models.
- Use the Server board's custom server: deployment owner may have a model preset.

### Edge Cases
- User skips the model: Home works but every send fails with "Connect a model to start a run."
- Consent not given: a call fails with "Review AI data sharing in Account settings before continuing."; client should check `aiDataUsesForProcedure` and prompt.
- Network drop between steps 5 and 6: Models shows saved state on reopen.

### Design gaps
- The `needsModel` handoff has no screen: no banner, no empty-state variant, no deep link from Home to Models.
- Expo's `lib/api.ts` carries `needsModel` but no Home UI for it was found (Expo discovers it only as a server error at send time).
- AI data sharing consent prompt: no board; only Account settings text.
- Model picker rows and key entry are on PG-B-Models, outside this topic's scope.
- Home empty state has one line of text and no action; the rule says "Tap + to create a bot" only.

---

## STORY-010: Organize Personnel with a pin and a section, then trim a group
**Type**: long
**Topic**: Home, Personnel and space switching
**Persona**: Hannah Lindqvist, chief of staff at a 30-person fintech, who has 12 agents and 3 groups
**Goal**: Pin "Finance agent", move "Legal agent" and "Carta agent" into a new section "Investors", and remove "Mercury agent" from the "Closing team" group.
**Preconditions**: 12 bots, groups "Closing team" and "Weekly review", no sections yet.
**Device**: iPhone Duo inner flat (1/3 Personnel, 2/3 detail)
**Ideal path**: 16 — see steps; each organize action costs 2 taps (long-press, choose), the section creation 4.
**Alternate paths**: (a) Web Personnel drag-and-drop (not available on iPhone). (b) Group membership via Group settings only; no shortcut from Personnel. (c) On standard iPhone the same actions in a single column.
**Design source**: Home Personnel list: PG-A-Home / PG-A-Rules "Home" (flat list, no sections or pins drawn). Organize and member pickers: DS-04 (listed in discovery as the source, no per-page board). Group settings: PG-B-GroupSettings / PG-B-Rules "Group settings" (Name, Members list, "Delete group", Save prominent, "Delete asks first (alert, Cancel / Delete)").

### Steps
1. On the inner display's left third find "Finance agent" in Personnel; long-press it → organize sheet (Expo: "Pin", "Silence notifications", "Move to", "New section").
2. Tap "Pin" → sheet closes; Finance agent moves under a "Pinned" heading at the top of Personnel.
3. Long-press "Legal agent" → organize sheet.
4. Tap "New section" → inline field "Section name" with "Create".
5. Type "Investors", tap "Create" → section "Investors" is created (`botSections.add`) and the bot is moved into it.
6. Long-press "Carta agent" → in "Move to" tap "Investors" → bot moves under that section heading.
7. Tap the "Investors" heading → section collapses (`botSections.setCollapsed`); tap again to expand.
8. Long-press a heading's bot → "Rename section" to "Investor tools" → "Save".
9. Tap the "Closing team" group row → group thread opens in the right pane.
10. Open the thread's More menu → "Members" or group settings (More group of the strip) → "Group settings" pushes in the right pane (rule: "Group thread in 1/3, settings in 2/3").
11. In Members, untick "Mercury agent" → check mark clears.
12. Tap Save → spinner then the pane returns to the thread; the thread's title capsule shows one fewer avatar.
13. Old Mercury bubbles in the thread keep its name ("One member removed: its bubbles keep the name").
14. Back to Personnel: pinned and section layout persists after force quit and reopen (state is server-side).
15. Open "Weekly review" → Group settings → tap "Delete group" → alert "Delete this group? Bots and their solo threads are kept." with Cancel / Delete.
16. Tap Delete → group removed from Personnel; its bots remain.

### Variations
- Unpin by repeating "Unpin" in the organize sheet.
- "Unassigned" in Move to returns a bot to the default area.
- "Silence notifications" / "Resume notifications" toggle from the same sheet.
- Standard iPhone: swipe or long-press then the same sheet.

### Edge Cases
- Section name empty: Create presumably disabled (Expo has "Section name" placeholder; behavior not documented).
- Section name over 60 characters: contract limit 60.
- Organize action fails: Expo text "Could not update chat".
- Group not found (deleted on web): centered "Group not found" and Back. Save error appears inline in red ("Could not save group").
- Spaces other than the current one: Expo only offers organize actions on the current space's rows (`item.space === meSpaceId`).

### Design gaps
- Pinned headings, section headings, collapse affordance, and the long-press organize sheet are not drawn on PG-A-Home; the board shows a flat Personnel list. "Pin", "Move to", "New section", "Rename section", "Unassigned" exist only in Expo.
- Long-press has poor discoverability and no VoiceOver action is specified; plan says "sections and pinning" without a gesture.
- Group entry to settings is only "Push from the group thread header"; the control is not drawn.
- DS-04 contains "organize and member pickers" per discovery, but no screen shows them in context.
- The same Personnel organization is rendered on web, Expo, and native; a pinned/section difference between surfaces would be visible to the user, so the native app must match the server order exactly.
- Section removal (`botSections.remove`) and reorder have API but no UI described.
