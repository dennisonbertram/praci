# Notifications and re-entry (Devin page, planned)

Evidence labels: [exists] is read in this repo's code. [planned] is the Devin page from `docs/devin/mockup.html` and `docs/devin/ux-paths/discovery.md`. Every Devin step is [planned]; the generic notification pipeline is [exists] unless noted. Everything is read-only toward Devin: the user answers Devin inside Devin.

Code facts used below:
- `runNotifyUser` / `createNotification`: dedupe key per (space, user, bot), 24-hour window; limits 5 per hour, 20 per day, 2 `attention` per hour per bot (`packages/db/src/notifications.ts`, `docs/plans/notifications.md`). The same session asking twice inside 24 hours returns "Already notified recently; nothing sent." unless the dedupe key differs.
- Surface for a Devin agent falls to `"thread"` in `defaultNotificationSurface` today; `surfaceOfPath` is a closed regex (`inbox|finance|legal|cap-table|data-room|artifacts`). Both need a `devin` entry [planned].
- Web delivery (`apps/web/src/lib/notification-delivery.ts`): focused visible tab gets a toast; otherwise after 1.5 s (`AWAY_DELAY_MS`) the tab shows an OS notification tagged with the id, if the Browser switch is on and permission is granted. Phone push is a separate delivery scheduled 30 s out and skipped if the notification was shown or seen by then.
- Dot: `useSidebarGlance` loads `unseenCounts` on mount, on every route change and on `rakazo:notifications-changed`; it calls `markSeen({ surface })` only while the tab is visible and focused and the user is on that surface's path. There is no timer that re-polls.
- Mobile tap (`apps/mobile/lib/notification-open.ts`): opens `/thread` for a `botId`, `/inbox` for the inbox, and parses `/app/<botId>` links. Mobile has no Devin page.
- Search: `appPages` in `Shell.tsx` lists app pages; a page appears in search/palette only if added there [planned for Devin].
- Hide: the Pages group "..." menu (aria-label "Page options") toggles `hiddenPages` per user.

---

## STORY-401: Devin asks a question while the founder is working in Rakazo

**Type**: medium
**Topic**: Notifications and re-entry
**Persona**: Maya Ortiz, founder of Acme Robotics, connected Devin yesterday, has the Inbox open on a laptop.
**Goal**: See that a Devin session is blocked on her, and reach the question.
**Preconditions**: Devin connected, Devin agent exists, writes off. Session "Fix flaky checkout test" moves to waiting_for_user in Devin. Rakazo has detected it (see STORY-406 for how). Browser tab is focused.
**Ideal path**: 3 — toast click lands on the Devin page, then the row's question text and "Open in Devin". A toast makes the dot unnecessary for a present user.
**Alternate paths**:
- A. Ignore the toast, click the sidebar "Devin" link (dot) instead: 3 steps.
- B. Press the palette hotkey, type "Devin", Enter: 4 steps, no dot knowledge needed.
- C. Click the toast, then "Ask" to ask the Devin agent "What is Devin stuck on?" instead of reading the row: 5 steps.
- D. Toast fades after 6 s untouched; she later notices the dot (alternate A).
### Steps
1. [planned] A notification with importance `attention`, title like "Devin needs you" and body "Fix flaky checkout test: which branch should I rebase onto?" is created with a `link` to the Devin page → [exists] the realtime event fires, the app root refreshes counts, and a toast appears bottom-right. Maya is reading mail and thinks "Devin? That was the thing I connected yesterday."
2. [planned] The sidebar "Devin" row (Pages group) shows a dot at the same moment (`unseenCounts` for surface `devin`) → duplicated info: toast and dot say the same thing. She does not need both, and hesitates over which to trust.
3. [exists] She clicks the toast → the toast marks the notification seen and navigates to `link`. [planned] That is `/app/devin`.
4. [planned] The page loads. The tile "Needs you" shows 1 and the table row has badge "Needs you" with the question under the title (12m ago style "Updated" column) → this is the third place the same fact appears (toast, dot, tile, row). She now knows which session, and the question text.
5. [planned] The dot disappears: she is on the surface, the tab is attended, so `markSeen({ surface: "devin" })` runs → dot cleared even though she has not answered the question. She wonders: "Did it clear because I answered?" No. The row still says "Needs you".
6. [planned] She clicks the session title or "Open in Devin" → the session opens in Devin in the system browser (Electron: `app-opener`). She answers there. Rakazo does nothing.
### Variations
- Electron desktop window focused: same as above; the toast is in-window.
- Window narrower than 1024 px: sidebar is a drawer, so the dot is hidden behind the hamburger; the toast is the only visible signal. [exists] drawer; no dot on the menu button is documented. GAP: the plan does not say whether the drawer button shows an aggregate dot.
### Edge Cases
- The question text can only come from `devin_session_interact` get_messages, which is a forced write today (discovery Open question 1). If it stays gated, the toast body and the row show no question. GAP: what the notification body says when the question text is unavailable.
- Toast is on screen and she is already on `/app/devin`: the surface is attended, so the notification is marked seen at once. GAP: whether a toast still shows for a page she is already viewing (the code toasts any attended arrival; nothing says it is suppressed on its own surface).

---

## STORY-402: Away from the keyboard: OS notification and phone push

**Type**: medium
**Topic**: Notifications and re-entry
**Persona**: Maya Ortiz, in a meeting; Rakazo desktop app in the background, phone in her pocket with the Rakazo app installed.
**Goal**: Find out a session is blocked without having Rakazo open, and get back to it.
**Preconditions**: Browser notification permission granted earlier; Expo push endpoint registered; the `attention` notification is created at 14:02.
**Ideal path**: 2 — tap the OS notification on the laptop, land on the Devin page. Phone is the fallback, not the first path.
**Alternate paths**:
- A. Desktop/web OS notification clicked: window focuses (`shown.onclick = window.focus()`); she is on whatever page she left, not necessarily Devin. 3 steps: click, click the dotted "Devin" row, read.
- B. Phone push tapped: opens the Devin agent thread (notification carries `botId`); 3 steps to reach the Devin session list is not possible on mobile.
- C. Neither device checked until later: STORY-404.
### Steps
1. [exists] The web tab is not focused, so `deliverNotification` waits 1.5 s, finds nothing shown, and calls `new Notification(title, { body, tag: id })` → an OS banner "Devin needs you" appears. Expectation she has: it is from Rakazo, not Devin.
2. [exists] A phone delivery is queued 30 s out. Because the OS banner is not a "shown" toast, the notification is not marked shown. 30 s later the worker sends the Expo push → both laptop and phone buzz. Duplicate info across devices. GAP: the plan skips the phone push only when the notification was shown as a toast or seen; an OS banner on the laptop does not suppress the phone push.
3. [exists] She taps the laptop banner → the window comes to the front but stays on its old route (`window.focus()` only). The OS notification does not navigate to `link`. GAP: the OS notification click does not open the Devin page; the notification `link` is used by the toast, not by `shown.onclick`.
4. [planned] She sees the dot on the "Devin" row and clicks it → page opens, dot clears (attended), row says "Needs you".
5. [exists] Alternatively she taps the phone push: `openNotificationResponse` routes to `/thread` for the `botId` → the Devin agent chat opens, empty or with the prior thread. She sees no list of sessions. She thinks "where is the thing Devin asked?"; she can type "What is Devin stuck on?" and the agent answers with "Open in Devin" links (reads only).
### Variations
- Browser switch off in Settings ("Browser"): no OS banner; the phone push still goes. Dot waits.
- Permission denied or never asked: `requestPermission` returns not granted, result "skipped". The dot is the only web signal.
- Electron: web Notification API is used (permission already granted by `session-permissions.ts`); behaves like the browser.
### Edge Cases
- Mobile link bug: if the notification `link` is `/app/devin` and no `botId` is in the push data, the mobile parser `^/app/(?:(g)/)?([^/]+)/?$` reads "devin" as a bot id and opens `/thread` with `botId: "devin"`. GAP: needs a `botId` in push data or a mobile rule for the `devin` path; mobile has no Devin page (`apps/mobile`, parity inventory).
- Hide money on: `attentionFromDto` masks currency in the toast and OS text. Devin text rarely has amounts; an ACU figure is not currency. No issue found.

---

## STORY-403: Clearing the dot (and the dot that clears too early)

**Type**: short
**Topic**: Notifications and re-entry
**Persona**: Maya Ortiz, glancing at the sidebar.
**Goal**: Understand when the Devin dot goes away and trust it.
**Preconditions**: One unseen `devin` notification; the row in Devin is still "Needs you".
**Ideal path**: 2 — open the Devin page; dot clears. This is the only designed behavior.
**Alternate paths**:
- A. Open the Devin agent thread instead of the page: clears every unseen notification from that bot (`markSeen({ botId })`), 3 steps.
- B. Visit the page in a background tab: nothing clears until the tab is visible and focused (`useAttended`).
- C. Answer in Devin without opening Rakazo: the dot stays (no clearing on resolution).
### Steps
1. [planned] She sees a dot on "Devin" (title "2 need you" in the mockup) → she reads it as "something needs me".
2. [exists] She clicks the row → on route change `unseenCounts` refreshes and, with the tab attended, `markSeen({ surface: "devin" })` runs and the dot goes out [planned: needs `devin` in `surfaceOfPath`].
3. [planned] She sees the table. The dot is gone but the "Needs you" tile still reads 2. She thinks the dot and the tile should agree. They do not: the dot means "unseen notification", the tile means "sessions currently blocked".
4. She leaves the page without answering. The sidebar now shows no dot while two sessions still need her. GAP: no persistent indicator of "still needs you" after the first visit; the design has only the unseen dot, and the plan says nothing about a glance value for Devin (other pages have counts like Inbox unread, Legal due soon). Candidate: a glance count for Devin, not designed.
5. She answers one session in Devin. The tile and row update only when the page next loads or refreshes (see STORY-406). Nothing clears because the dot is already gone.
### Variations
- Dot with count: mockup shows a dot only, not a number; the title text "2 need you" is a hover label. Whether the dot title is generated from the live count is unspecified. GAP.
- Rail (collapsed sidebar, >= 1024 px): dot remains on the icon.
### Edge Cases
- She clicks the toast for session A, which marks only that notification seen; the sidebar dot for session B (a second notification, same surface) clears too, because surface-level `markSeen` clears all `devin` notifications. She never saw B's question. GAP: opening the page marks every Devin notification seen, even for sessions she did not read.
- Dot appears after a refresh while she is on the page: attended + on surface, so it is cleared on the same render. She sees a flicker at most.

---

## STORY-404: Weekend away, many sessions blocked

**Type**: long
**Topic**: Notifications and re-entry
**Persona**: Maya Ortiz, offline Friday 18:00 to Monday 08:30; four Devin sessions go to waiting_for_user over the weekend.
**Goal**: On Monday, know which sessions are blocked and which are stale, without reading four pings.
**Preconditions**: Detection is working (STORY-406). Devin agent writes off. All four are in one space.
**Ideal path**: 3 — open the Devin page, read "Needs you 4", open each in Devin. The page is the reliable summary; the notifications are not.
**Alternate paths**:
- A. Start from the phone lock screen on Saturday: see push banners; do nothing (opening Devin would be a weekend act); Monday uses the page.
- B. Start from the Devin agent: "What is Devin stuck on?" returns a list with "Open in Devin" links, 4 steps.
- C. Start from Slack/Linear where Devin posts directly (outside Rakazo).
### Steps
1. [exists] Friday 20:10: first `attention` notification for session A. Web is closed; phone push goes after 30 s. The 2-per-hour `attention` limit is per (space, user, bot).
2. [exists] Friday 20:40 to Sunday: sessions B, C, D go to waiting_for_user. B and C are within the same hour as A: the third and later `attention` notifications within an hour return "Rate limited, do not retry." and are dropped (no row is created). GAP: a notification dropped by the rate limit is never retried; if detection runs once per transition, that session never produces a dot or push. The dot-only `info` path is not used as a fallback.
3. Saturday: Maya sees two phone banners. She hesitates: "Do I deal with this now?" She decides it can wait.
4. Monday 08:30 she opens Rakazo on the laptop. [exists] Unseen counts load on mount. [planned] The "Devin" row shows a dot. Toasts for old notifications do not replay: `notifications.list({since})` is used for reconnects, and toasts are for new arrivals. GAP: whether a notification that arrived while the app was closed produces a toast on open. The plan says only that reconnecting clients fetch by `since`.
5. She opens the page. [planned] Tile "Needs you 4" (computed from the live session list, not from notifications), four "Needs you" rows with ages "2d ago", "1d ago", "19h ago", "1h ago" → she sees all four even though only two pings reached her. The page is the source of truth.
6. She opens the oldest one in Devin first. It may have timed out or been suspended while waiting. [planned] Its row shows "Suspended" after refresh. GAP: Devin's behavior for a session left waiting for days is not documented (research did not capture status_detail values); the mapping of such sessions to "Needs you" vs "Suspended" is unverified.
7. After answering, she returns to Rakazo. The tile still shows 4 until refresh. She presses the browser reload (no refresh control is drawn in the mockup; the header meta is "Updated 1m ago").
### Variations
- Notifications retained 30 days: all four are listable later. There is no bell/history in v1, so no surface shows them. GAP: a missed notification cannot be reviewed, only its dot.
- Several spaces: notifications and Devin connection are per space; the dot is on the Devin row of the space she is in. A Devin block in space B shows nothing while she is in space A. GAP: no cross-space unseen indicator documented for page dots.
### Edge Cases
- Phone offline Saturday: deliveries retry up to 5 times with backoff; after that status `failed`. No later nudge.
- A teammate in the same Devin org also connected: they are not notified for Maya's sessions unless the session is theirs; the org key shows all sessions (discovery Open questions 3 to 5). GAP: who is the recipient per session; the plan implies only the user whose key detected it.

---

## STORY-405: Same session asks twice (dedupe)

**Type**: short
**Topic**: Notifications and re-entry
**Persona**: Maya Ortiz.
**Goal**: Not be pinged repeatedly, but not miss a second, different question.
**Preconditions**: Session "Migrate billing tables" asked about the schema at 10:00, Maya answered in Devin at 10:20, and Devin asks something else at 14:00.
**Ideal path**: 2 — one new notification per distinct question; the same question only once. This depends on the dedupe key chosen at design time.
**Alternate paths**: none found for the user. The two designs for the key (session id only vs session id plus question/event id) give different results, below.
### Steps
1. [exists] The first notification is created at 10:00 with dedupe key K. [planned] Key choice is open (discovery: "stable dedupe key, probably per session and per question").
2. If the key is the session id: the 14:00 attempt is within 24 hours, so `createNotification` returns "deduped" and nothing is sent. Maya is never told about the second question. Dot and push do not fire. She finds out only if she opens the page. GAP: a session that asks a second, different question the same day is silent under a session-only key.
3. If the key includes the question/event id: the 14:00 notification is created, toast or push fires, dot appears. She sees "Needs you" for a session she thought was resolved, and may think it is the old one. Row text is the new question.
4. If the same question is re-detected on every poll (state unchanged) and the key is stable, the 24-hour window blocks repeats. After 24 hours with the session still waiting, the key can notify again. She gets a reminder, which is useful, but nothing says it is a reminder. GAP: whether a day-old unresolved question should re-notify at all.
5. [exists] Default key when none is given is a hash of surface and title. With a title like "Devin needs you" for every session, two different sessions in one day dedupe against each other: the second session never notifies. GAP: the title must be unique per session or an explicit key must be passed.
### Variations
- Session answered and finished between polls: no notification; a stale dot cannot arise because none was sent.
### Edge Cases
- Dedupe returns the earlier notification; the dot reflects the first one's seen state. If she has already seen it, a deduped repeat will not re-light the dot.

---

## STORY-406: How Rakazo notices (no webhooks) and when it can be late

**Type**: medium
**Topic**: Notifications and re-entry
**Persona**: Dev Patel, the Rakazo engineer who must make the notification real; also Maya, who sees its effects.
**Goal**: Understand who looks at Devin and how often, to set expectations for the notification timing.
**Preconditions**: Devin MCP only; no webhook source (discovery: "Polling or event source for needs-you detection is not decided"). The existing cloud-agent poller is Cursor-specific.
**Ideal path**: not applicable (design question). The stories below name the options.
**Alternate paths**:
- A. Page-open polling: the Devin page fetches the session list when it opens or on an interval, and a change to "Needs you" calls a Rakazo endpoint that runs `notify_user`. Nothing happens when the page is closed.
- B. Server-side scheduled poll (a worker job per connected Devin server, like the Cursor poller). Notifications arrive with the page closed.
- C. A routine on the Devin agent that checks every N minutes and calls `notify_user` (the agent runs `devin_session_search`, so it can). Reuses routines; the run's own `notify` flag and the rate limits apply.
### Steps
1. [planned] A session moves to waiting_for_user in Devin. Rakazo is not told. → Time passes with no signal.
2. Under A: nothing until Maya opens the Devin page. Her first signal is the table itself. The toast and push the plan describes would not fire in her absence. GAP: with page-open polling only, the "30 s unseen then push/OS" promise cannot hold.
3. Under B or C: the detection runs on a cadence. The delay from the status change to her toast is up to one interval. GAP: no cadence is chosen, and no design says who owns the job, the key it uses, or what happens when the key is revoked (the job must stop; the Integrations card shows reconnect).
4. The detection must compare status against the last known value to know a transition occurred. GAP: where the last-seen status per session is stored. Durable state must live in Postgres (AGENTS.md); no table exists for it.
5. A first poll after connecting sees sessions that were already blocked. GAP: whether those notify (a burst, hitting the rate limit in STORY-404) or are only shown in the table.
6. Under B, the cost is one MCP call per connected user per interval on Devin's API, with unknown rate limits (discovery lists Devin rate-limit behavior as unknown).
### Variations
- "Updated 1m ago" in the mockup implies a refresh cadence of the page itself. Whether the page auto-refreshes while open is not stated. GAP.
- Multiple API processes: a poller must avoid duplicate notifications from two processes; the dedupe advisory lock in `createNotification` covers the notification, not the polling.
### Edge Cases
- The status mapping from Devin's `status` / `status_detail` to "Needs you" is unverified (discovery). A wrong mapping notifies on the wrong sessions.
- Key valid but lacking session-read permission: poll fails silently; no notification and no error state is designed.

---

## STORY-407: Finding Devin again by search, and a hidden or unconnected page

**Type**: medium
**Topic**: Notifications and re-entry
**Persona**: Maya Ortiz, who last used Devin two weeks ago. A second persona, Sam Lee, hid the Devin page from the sidebar ("Page options" menu) and has not looked since.
**Goal**: Get back to the Devin page, and for Sam, still learn when Devin needs him.
**Preconditions**: Maya: Devin connected, page visible. Sam: Devin connected, `hiddenPages` includes `devin`.
**Ideal path**: 2 for Maya — palette hotkey, type "Devin", Enter. For Sam, 3 — notification, then page.
**Alternate paths**:
- A. Sidebar search box (not the palette): type "Devin"; `searchPages` matches by label and keywords.
- B. Integrations: the connected Devin card has no "Open Devin" link today (Carta has "Open Cap table") [planned to add].
- C. Devin agent chat from the sidebar agent list; no session table.
- D. For Sam, "Page options", tick "Devin" to show it again.
### Steps
1. [planned] Maya opens the palette (`isCommandPaletteHotkey`) and types "Devin" → one result "Devin" with an icon, from `appPages` [planned: not in the list today]. She might also type "coding" or "agent": GAP: no keywords string is defined for Devin (Cap table has one).
2. She presses Enter → `openAppPage("devin")` navigates to `/app/devin`. The page loads; no unseen dot.
3. Sam: Devin is hidden, so there is no sidebar row. A notification arrives. [exists] `markSeen` is by surface; the sidebar row is not rendered, so no dot is visible anywhere. GAP: dots for a hidden page. The sidebar hides the whole row (`hiddenPages.includes(...) ? null`), and the plan says a rail shows dots on page items. A blocked session could be invisible to a user who hid the page.
4. Sam's toast and push still fire (importance `attention`), so he sees them. He clicks the toast → lands on the Devin page though it is hidden from the sidebar. Hidden pages remain reachable by URL and search. [planned] The page loads with no sidebar highlight.
5. Sam wonders whether to unhide. The dot never appears for him unless he does. GAP: no prompt to unhide, and no indication that a hidden page still notifies.
6. If Devin is not connected for a space member, "Devin" still appears in search (like Cap table) and opens a page with only "Connect Devin". Discovery Open question 13 decides if the row is shown at all. GAP.
### Variations
- Mobile search: no Devin page. Search would show nothing for Devin; the Devin agent bot appears in the agent list by name.
- Electron: palette hotkey is the same.
### Edge Cases
- Typing "Devin" also matches the "Devin agent" bot in space search, and the "Devin" page: two results with the same word. Which one is first is not specified. GAP: result order and labels to tell the page from the agent chat.
- Toast arrives for a space she is not currently in: not designed.
