# Stories: iPhone Duo and device adaptation

Status: planned native SwiftUI app (epic #427, phase 7 issue #419, push #422, extras #425). No Swift code exists. Every behavior below is planned or inferred from the boards and plan, not observed.

Boards used: `docs/design-system/ios/boards/Main.dc.html` (outer Home), `Sheet.dc.html` (outer Inbox), `Split.dc.html` (inner sidebar + Inbox), `Inner.dc.html` (inner Inbox + Inbox agent), `Desk.dc.html` (laptop pose Finance), `DS-03-Navigation.dc.html` (bars, collapse, split, laptop pose), and the rule cards in `PG-A-Rules.dc.html` and `PG-B-Rules.dc.html`. Rule-card names are written as "PG-A-Rules > Home".

Placeholder figures use `[AMOUNT]` and `[N]`, as the boards do.

---

## STORY-001: Open an agent from Home on the outer display and approve a request
**Type**: short
**Topic**: iPhone Duo and device adaptation
**Persona**: Maya Okafor, solo founder checking in between meetings
**Goal**: Read the Finance agent's latest message and allow a pending action without unfolding the phone.
**Preconditions**: Signed in, space selected, Finance agent has a message with an approval card pending. Phone closed, outer display (466x678).
**Device**: iPhone Duo outer
**Ideal path**: 3 — tap the agent row, scroll to the approval card, tap Allow. No other control is needed.
**Alternate paths**: (a) Home Activity (bell icon with a dot) opens the "needs approval" item and lands in the same thread. (b) Tap the push notification, which lands in the thread directly (phase 10). (c) Home search (magnifier) then the agent.
**Design source**: Home: `Main.dc.html`, PG-A-Rules > Home. Thread: PG-A-Rules > Agent thread (`PG-A-Thread.dc.html` for the approval card). Activity list: NO BOARD for the Activity screen itself (only the icon and its dot are defined).

### Steps
1. On Home, find "Finance agent" under PERSONNEL (preview "Runway summary for the last 30 days", time "Yesterday") and tap the row. → Thread opens. The 60 pt strip stays; the content column pushes in. A Back group fades in at the top of the strip.
2. Read the glass title capsule and the latest message. → Messages are bottom-aligned; the composer floats 12 pt above the bottom.
3. Tap "Allow" on the approval card. → "Allow" is the one prominent control on this page. The run resumes (`run.waiting_input` to running); the card collapses to its resolved state.

### Variations
- The approval card is taller than the visible column: it scrolls with the messages, and Allow stays inside the card, not the strip.
- The agent is an integration agent (Carta, Mercury, Brex): row shows a letter tile instead of a bot shape. Same flow.

### Edge Cases
- A second tap on Allow after another device answered returns CONFLICT. The board set does not show how this is presented.
- Outbox: if the network drops while the thread is open, an inline "Failed to send message" with retry appears for sent text; approvals are not sent text, so the failure copy for Allow is undefined.

### Design gaps
- The strip has no prominent button on the thread page (Back, Page, List, More only). Nothing tells the user the approval is waiting if the card is scrolled out of view; no "jump to approval" control exists.
- No board for the post-Allow resolved state or the CONFLICT case.
- Activity screen (opened from the Home strip) has NO BOARD; the dot is defined, the destination is not.

---

## STORY-002: Triage mail on the outer display, then ask the Inbox agent
**Type**: medium
**Topic**: iPhone Duo and device adaptation
**Persona**: Tomas Reyes, founder answering customers from a train
**Goal**: Open a reply-needed email, archive it, and ask the Inbox agent to draft a reply, using the vertical toolbar only.
**Preconditions**: Gmail connected, Inbox has 3 in "Needs reply". Outer display, full height.
**Device**: iPhone Duo outer
**Ideal path**: 5 — Home, Inbox row, message row, Ask Inbox agent, Send in the draft card.
**Alternate paths**: (a) Search mail (magnifier in the Inbox strip group) to find Ana's message, then open it. (b) Reply (arrow in the message strip) writes by hand instead of asking the agent. (c) Skip Home and open from a push tap (kind inbox, phase 10).
**Design source**: `Main.dc.html` (Inbox row), `Sheet.dc.html` (Inbox list), PG-A-Rules > Inbox and > Inbox message (`PG-A-InboxMessage.dc.html`), `Inner.dc.html` for the draft card ("Needs approval", Save, Send).

### Steps
1. On Home, tap the "Inbox" row ("3 need reply", count "42"). → Inbox list opens with a 28 pt "Inbox" title. Sections "Needs reply" (3) and "Other mail today" (24).
2. Look at the strip. → Back, a group of Search mail / Filter / Compose, a spacer, and the prominent "Ask Inbox agent" (bubble.left) at the bottom. Aria labels on the board: "Search mail", "Filter", "Compose", "Ask Inbox agent".
3. Tap the row "Ana Ruiz — Re: Pilot timeline". → Message page: 22 pt subject, sender line, body 15 pt. Strip changes to Back, Archive / Reply, spacer, prominent "Ask Inbox agent".
4. Tap "Ask Inbox agent". → Opens the Inbox agent thread (pushed). Composer reads "Message Inbox agent".
5. Type or dictate "Reply to Ana: Thursday works, 10am." and send. → Agent shows "Here is a draft. I have not sent it." and a card "Re: Pilot timeline", "Needs approval", "To Ana Ruiz", with Save and Send.
6. Tap "Send". → Draft is sent after approval; card resolves. Message page later shows a Sent check beside the date.

### Variations
- Tap Archive in step 3 first: row leaves "Needs reply"; Back returns to the list.
- Same information (inbox sections, draft card, the same message) is rendered on the outer display, inner book (`Inner.dc.html`, list beside the agent thread) and standard iPhone (large title with inline search).

### Edge Cases
- Inbox empty: "Inbox zero" with the last sync time. Error: "Could not load mail." with retry.
- Message with an attachment over the size limit: row shows size and a disabled state.
- Unread dot is the only unread marker; no tinted rows.

### Design gaps
- The Filter menu contents (and "Important only" shown on `Split.dc.html`) are not defined in Rules; only icon names exist.
- Compose screen has NO BOARD. Reply composer is described only as "Reply opens the composer under it" for half-folded.
- Search mail overlay appears in DS-03 (TOP HITS) but not as a page rule with empty/error states.
- Label mismatch: Expo uses `t("inbox")` / "Inbox"; the board "Ask Inbox agent" has no Expo equivalent string found in `apps/mobile/app/index.tsx`.

---

## STORY-003: Unfold to the inner display mid-task and keep working
**Type**: medium
**Topic**: iPhone Duo and device adaptation
**Persona**: Priya Nair, founder reading a long thread then unfolding for room
**Goal**: Start in an agent thread on the outer display, unfold, and continue in the same thread beside Personnel.
**Preconditions**: Chief agent thread open on the outer display with a half-typed draft in the composer and scroll position mid-thread.
**Device**: iPhone Duo outer, then inner flat
**Ideal path**: 1 — unfold the phone; the app should arrive in the same thread with the Personnel list added as the 1/3 sidebar.
**Alternate paths**: Unfold and then navigate by tapping a Personnel row. Or open the app fresh on the inner display and choose the agent.
**Design source**: `Split.dc.html` (inner sidebar + list), `Inner.dc.html`, PG-A-Rules > Agent thread ("Sidebar third: Personnel list (extra level). Detail: the thread."), DS-03-Navigation "Flat, book hold, 890 x 626pt: one third + two thirds".

### Steps
1. With the outer display showing the Chief thread, unfold the phone to book hold. → The inner display shows a 277 pt floating sidebar: "Search", "PERSONNEL" with "Chief", "Finance agent", "Carta agent", "Legal agent", and "Connect apps"; profile "Alex Morgan" at the bottom. The thread fills the 2/3 detail.
2. Check the thread content. → Same messages, same state, same copy as outer. The sidebar adds one hierarchy level.
3. Check the toolbar. → The side bar moves to the right edge as a vertical bar (Page, List, More). Nothing interactive in the fold zone x 435 to 455.
4. Tap "Finance agent" in the sidebar. → Only the right pane pushes; the sidebar keeps its selection ("Only the right pane pushes").

### Variations
- Draft preservation: the half-typed message should survive the display change.
- If the user was on Inbox, the sidebar third shows folders and sections and the list sits beside the open message.

### Edge Cases
- Display change while a run is streaming: the SSE subscription should continue or resume from the highest `seq`.
- Unfold while a sheet (New bot) is open: the sheet should re-center over the 2/3 pane at 420 pt width.

### Design gaps
- Docs do not specify whether the app is relaunched or the scene changes when going outer to inner; draft text, scroll position, and the selected row survival are all unspecified (discovery.md "Duo posture changes").
- Which Personnel row is highlighted in the sidebar for a Group thread, or when the open page is Inbox, is shown only for Inbox (`Split.dc.html` filled "Inbox" row).
- Sidebar "Search" has NO BOARD for its results state.

---

## STORY-004: Work through the Inbox with list and message side by side on the inner display
**Type**: medium
**Topic**: iPhone Duo and device adaptation
**Persona**: Grace Lindqvist, founder clearing a morning backlog at a desk
**Goal**: Read several emails in sequence without leaving the list, and ask the Inbox agent about one.
**Preconditions**: Inner display flat (890x626), Inbox selected.
**Device**: inner flat
**Ideal path**: 2 per message — tap the next list row; the message replaces the right pane. One more tap on "Ask Inbox agent" for the agent.
**Alternate paths**: Half-folded 1/2 + 1/2 gives the same content with different widths. Outer display needs Back, then a row, for each message (about 2 taps per message plus Back).
**Design source**: `Split.dc.html`, `Inner.dc.html`, PG-A-Rules > Inbox ("list becomes the sidebar, message the detail") and > Inbox message ("the list stays visible").

### Steps
1. On Home (inner), tap "Inbox" (pinned at the top of Personnel in the 1/3). → The 2/3 shows the Inbox list "Needs reply" / "Other mail today", with a "Search mail" field.
2. Tap "Ana Ruiz — Re: Pilot timeline". → The list moves to the sidebar third (selected row filled `#252523`) and the message opens in the detail.
3. Tap "Jordan Lee — Intro: design partner". → Only the detail pane replaces; selection moves in the list.
4. In the vertical bar, tap "Ask Inbox agent". → The Inbox agent thread is shown beside the list (`Inner.dc.html`).
5. Ask "Reply to Ana: Thursday works, 10am." → Draft card with Save and Send appears.
6. Tap "Send". → Sent; the list row for Ana loses "Needs reply" status after sync.

### Variations
- Half-folded: right half shows the selected message or the Inbox agent thread; Reply opens the composer under the message.
- Unread row opened: dot disappears (opening mail marks it read; this matters on the real mailbox).

### Edge Cases
- Fold zone: with 3 panes (sidebar, list, message) nothing interactive may sit in x 435 to 455; the boards show a two-pane arrangement only.
- Message HTML preview is sandboxed and never glass.

### Design gaps
- Inner Inbox shows three columns' worth of content (Personnel, list, message) in a two-pane `NavigationSplitView`. The rule card says "folders and sections in the third" and "list beside the open message", but no board shows how a user goes back to Home's Personnel from here.
- Row labels "Needs attention", "Newsletter", "Junk" appear on `Split.dc.html` but no board defines what tapping a label does.
- Compose (the third bar icon) has NO BOARD.

---

## STORY-005: Hold the phone in laptop pose to watch the Team Computer and take control
**Type**: long
**Topic**: iPhone Duo and device adaptation
**Persona**: Devon Park, founder supervising an agent filing a form in a web portal
**Goal**: Watch the agent's screen on the top half, talk to the agent on the bottom half, take control to finish one step, then release.
**Preconditions**: Chief agent has a Team Computer session; a handoff ask is pending. Phone half-folded into laptop pose (626x890, fold at y 435 to 455). Standard portrait first.
**Device**: laptop pose
**Ideal path**: 4 — open computer from the agent menu, Take control, do the step, Release. The thread and key bar are already on the bottom half.
**Alternate paths**: (a) Tap a "computer" block inside the thread. (b) Use the handoff card's "I'm done" or "Skip" without taking control (the agent proceeds). (c) Use "Open in full window" (Expo label) in place of the pose.
**Design source**: `PG-A-Computer.dc.html`, PG-A-Rules > Computer ("Top half: the screen (watch). Bottom half: key bar, Release, thread composer. This is the main use of the pose."), DS-03-Navigation laptop pose section. Entry point: PG-A-Rules > Agent thread (More menu).

### Steps
1. In the Chief thread, tap More (ellipsis) and choose "Open computer". → "Booting [name]" with a progress bar, then the live desktop.
2. Fold the phone into laptop pose. → Screen on the top half; controls on the bottom half as horizontal bars. Fold gap y 435 to 455 stays clear of the screen content.
3. Look at the overlays over the screen. → Clear Team/Private picker top-left, control chip top-right; clear glass with 35% dim.
4. Read the handoff card from the agent. → Card offers "Skip" and "I'm done".
5. Tap "Take control". → Prominent action changes to "Release" (lock.open); control chip says "You have control" (Expo copy); key bar appears.
6. Tap "Keyboard" (SF: keyboard) and type into the portal field. → Characters reach the remote screen; "Fit to screen" resizes the view.
7. Tap the Team/Private picker and choose "Private". → Screen URL is re-read for the private session; the picker shows the new mode.
8. Tap the Team/Private picker and choose "Team" again. → Screen reloads for the team session.
9. Tap "Fit to screen". → Remote screen scales to fit the top half.
10. Tap "Keyboard" again. → Key bar hides.
11. Tap "I'm done" on the handoff card. → Handoff recorded (`done`); the agent resumes and the card resolves.
12. Tap "Release" if still in control. → Back to watch mode; "Take control" returns as the prominent action.
13. Ask in the bottom composer "Is the form submitted?" → Agent replies in the bottom bar; the screen stays on top.
14. Unfold to book hold. → Layout changes to thread 1/3 + screen 2/3; the session continues without reconnecting (not specified; see gaps).
15. Fold back to laptop pose. → Screen top, controls bottom again.
16. Tap "Close" (xmark) in the strip or bar. → Computer closes; thread shows the "computer" block.

### Variations
- Switch the Team/Private picker: the screen URL is re-read on each control change.
- Rotate to portrait while in control: the pose layout goes away; the thread should move into the sidebar third (inner) or behind a Back (outer). Not defined.
- Standard iPhone (393 pt): same screen and controls in the horizontal bar.
- The same Team Computer information (screen, control state) is shown on outer display (clear strip, thread not visible), inner flat (thread 1/3, screen 2/3), half-folded (1/2 + 1/2), and laptop pose.

### Edge Cases
- Screen URL capability expires at 1 hour; renewal at 50 minutes should not reload the screen.
- Lease default 15 minutes: expiry while typing needs a visible state. Not on a board.
- Errors: "Could not open computer" with retry; "Could not load the desktop."; Expo adds "This device cannot reach the screen URL."
- Handoff ask answered from another device: CONFLICT.

### Design gaps
- No board shows the computer page in laptop pose with real controls; `Desk.dc.html` is Finance only, and the Computer page card is text only.
- Lease expiry and the "Could not switch computer" error (Expo) have no designed state.
- "Open computer" is in the planned agent actions menu (PG-A-Rules > Agent thread: "settings, open computer, clear, archive, delete") but the Expo label is the same text, whereas the Computer strip uses "Close" and "Take control". Label match is fine; the entry from a thread's computer block has NO BOARD.
- Keyboard focus and the software keyboard in laptop pose (it would cover the bottom half) is undefined.
- How the 1/3 thread and composer behave for push to a different bot while a computer session is open is not defined.

---

## STORY-006: Review Finance in laptop pose and ask the Finance agent about a spike
**Type**: medium
**Topic**: iPhone Duo and device adaptation
**Persona**: Lena Haddad, founder reviewing monthly spend at a standing desk
**Goal**: See the burn chart on the top half and ask why one month jumped, on the bottom half, with amounts masked for a screen share.
**Preconditions**: Finance connected (Mercury or Brex); Finance has data. Laptop pose (626x890).
**Device**: laptop pose
**Ideal path**: 3 — open Finance from the sidebar, tap "Hide amounts" (optional), type the question in "Message Finance agent".
**Alternate paths**: (a) "Ask Finance agent" in the strip on outer display opens the thread instead. (b) From Home, open the Finance agent thread directly. (c) On inner flat, pick "Burn" in the 1/3 section list.
**Design source**: `Desk.dc.html` (laptop pose), PG-B-Rules > Finance, `PG-B-Finance.dc.html`, DS-03-Navigation laptop pose.

### Steps
1. In the sidebar/Home, open "Finance" (meta "[N] mo"). → Finance page: period tabs, "Runway [N] mo", "Cash [AMOUNT]", "Monthly spend / Last 6 months" bar chart (May to Oct, Sep highlighted).
2. Tap "Hide amounts" (eye) in the horizontal bar. → Amounts show a mask; this is a device-only setting and also hides amounts in chat finance cards.
3. Tap the highlighted Sep bar or read the chart. → Chart detail is shown on the top half (tap behavior on bars is not defined).
4. In the bottom bar, tap "Message Finance agent" and type "Why did spend jump last month?". → The agent replies "Two annual renewals landed in the same month, [AMOUNT] together. Without them, spend was flat." in a compact thread above the composer.
5. Tap "Back". → Returns to Home; the pose is irrelevant there.

### Variations
- Period tabs and Accounts list are on the bottom half in laptop pose (PG-B-Rules > Finance), so the composer shares the bottom half with them; only `Desk.dc.html` shows the composer and chart, not the accounts list.
- Standard iPhone: same page, horizontal toolbar, "Ask Finance agent" prominent at the bottom.
- Outer display: strip action group (eye, refresh), prominent "Ask Finance agent".

### Edge Cases
- Not connected: empty state "No accounts yet" with "Add account".
- Error: red banner with Refresh; loading: skeleton KPIs.
- Non-USD accounts are left out of totals (discovery note); chart label is not defined for that.

### Design gaps
- The Desk board shows a chat bubble pair in the bottom half, but PG-B-Rules says "period tabs, accounts and Ask controls on the bottom half". The two do not agree on where the agent reply goes and where Accounts go.
- Laptop pose with the keyboard open covers the bottom half; no layout shown.
- Hide amounts icon is placed in the bar on Desk but in the strip action group on outer; label "Hide amounts" is consistent.

---

## STORY-007: Create a new bot from the outer display and from the inner display
**Type**: medium
**Topic**: iPhone Duo and device adaptation
**Persona**: Isaac Brandt, founder adding a recruiting agent
**Goal**: Create a bot with the "New" menu; confirm the sheet never crosses the fold on the inner display.
**Preconditions**: Signed in; Home visible. Start outer, then repeat on inner flat and half-folded.
**Device**: iPhone Duo outer; inner flat; half-folded
**Ideal path**: 4 — New, New bot, type a name, Create.
**Alternate paths**: Home empty state "Tap + to create a bot" (Expo copy and PG-A-Rules > Home) goes straight to the same sheet. The same menu offers "New group" (push) and "New space" (medium sheet).
**Design source**: `Main.dc.html` (prominent New), PG-B-Rules > New bot (`PG-B-NewBot.dc.html`), > New group, > New space, DS-03-Navigation sheet header.

### Steps
1. On Home (outer), tap the prominent "New" button at the bottom of the strip. → Menu: "New bot", "New group", "New space".
2. Tap "New bot". → A large-detent sheet appears in the content area beside the strip, radius 34, with a grabber. Strip shows Cancel (xmark) and prominent Create (checkmark).
3. Type a name. → "Create" enables only when Name has text.
4. Tap "Create". → Button shows "Creating"; sheet dismisses; the new bot appears in PERSONNEL.
5. Repeat on inner flat: tap the "Create" (plus) icon in the sidebar bar. → A 420 pt-wide sheet is centered over the dimmed 2/3 pane with Cancel top-left and the confirm button top-right.
6. Fold to half-folded while the sheet is open. → The sheet recenters in the right half and does not cross the fold.

### Variations
- Dirty form: swipe down or Cancel asks before discarding.
- "New space" medium sheet: the detent grows with the keyboard; the sheet is smaller on inner (420 pt, small variant).
- "New group" is a push, not a sheet. Selecting 2 to 6 bots enables "Create group".

### Edge Cases
- Error line in red above the actions; "Could not create bot" (Expo copy).
- New group with no bots: Members shows a muted line pointing to New bot.
- New space created but not opened: alert with "Try again" from the sidebar.

### Design gaps
- The confirm label differs by board: strip uses "Create" (outer), the inner sheet shows "Done" in DS-03 sheet-header examples ("Cancel / New bot / Done"). The label for the same action differs between boards.
- The inner display's "Create" plus icon (aria-label "Create" on `Split.dc.html`) is a different label from the outer "New" prominent button.
- Sheet behavior at 466x420 (short outer height) is not drawn.

---

## STORY-008: Use a short outer display and recover hidden actions from More
**Type**: short
**Topic**: iPhone Duo and device adaptation
**Persona**: Naomi Castellan, founder using the phone half-open on a table
**Goal**: Reach "Clear conversation" and "Archive" when the outer strip is only 420 pt tall.
**Preconditions**: Agent thread open; height reduced to 466x420.
**Device**: iPhone Duo outer (reduced height)
**Ideal path**: 2 — tap More, tap the item.
**Alternate paths**: Use the inner display, or the standard iPhone toolbar menu ("Bot actions", Expo label).
**Design source**: DS-03-Navigation "Reduced height, 466 x 420pt" and "COLLAPSE ORDER"; PG-A-Rules > Agent thread.

### Steps
1. Open the Chief thread. → At 420 pt the strip cannot hold every group.
2. Observe the strip. → Items collapse bottom to top into More: last action in the actions group first; the prominent action collapses last (below about 300 pt). More stays pinned at the bottom.
3. Tap More. → Menu lists collapsed items plus agent actions: "Chat settings" (Expo label; the board says "settings"), "Open computer", "Clear conversation", "Archive", "Delete…".
4. Tap "Clear conversation". → Confirm alert with "Clear"; on confirm the thread empties.

### Variations
- Page and List (doc.text, checklist) move into More first on a thread; on Inbox the Compose item collapses before Search mail.
- Each toolbar item needs an icon and a title so it can live in the menu.

### Edge Cases
- Keyboard open on the outer display reduces height; the same collapse should apply.
- "Archive" failure shows "Could not archive bot" (Expo copy).

### Design gaps
- Label mismatch: PG-A-Rules uses "settings" while Expo uses "Chat settings" and, for groups, "Group settings".
- The collapse order is described for one example (Inbox); the order for Agent thread, Computer and Finance is not listed.
- What happens to a prominent action that collapses (e.g., "Ask Inbox agent") on the Inbox is not shown.

---

## STORY-009: Tap a push notification while the phone is folded or unfolded
**Type**: medium
**Topic**: iPhone Duo and device adaptation
**Persona**: Rohan Mehta, founder away from the desk; a Legal agent notice arrives in a different space
**Goal**: Tap the notification and land in the right thread in the right space, on whichever display is active.
**Preconditions**: Two spaces ("Personal", "Northwind"); Northwind is not the selected space. APNs token registered (phase 10). App in background.
**Device**: iPhone Duo outer, then inner flat (variation)
**Ideal path**: 1 — tap the notification; the app switches space and opens the thread.
**Alternate paths**: Open the app, switch space from the sidebar, find the Legal agent row. Or use Home Activity.
**Design source**: NO BOARD for the notification itself. Landing screens: `Main.dc.html` Home, PG-A-Rules > Agent thread. Plan: `docs/ios-native/plan.md` phase 10; discovery "Push" transition.

### Steps
1. A banner "Legal agent: 2 deadlines due this week" arrives (copy invented from the Home preview line "2 deadlines due this week"). → The system shows the banner on the outer display or the inner display, whichever is on.
2. Tap the banner. → The app switches the space first (`x-rakazo-space-id`), wipes or re-keys caches, then opens the thread. Group wins over bot if both are in the payload.
3. Observe the outer display. → Thread pushes over Home: strip with Back, content column with the thread.
4. Fold and unfold the phone. → On the inner display, the thread is the detail and Personnel is the sidebar for the new space.

### Variations
- Thread already open: banner is suppressed for the open thread.
- Signed out: tap is ignored.
- Live Activity for a running agent (phase 13): shows in the Dynamic Island and in the vertical form on Duo; no board.

### Edge Cases
- Notification for a space the user left: 401 on the stream; re-select the space.
- Older self-hosted server without APNs support: the app registers as `expo`/none; no push arrives.
- Stale bot id (bot archived): destination undefined.

### Design gaps
- NO BOARD for permission prompt, notification settings (Account has no board), Live Activity, or the in-app presentation after a push.
- Which display the app opens on, and the sidebar selection after space switch on inner, are unspecified.
- No board for share extension ("sends to an agent or the data room"), so the picker layout on Duo is undefined.

---

## STORY-010: Open Settings on the inner display and change the default model
**Type**: medium
**Topic**: iPhone Duo and device adaptation
**Persona**: Sofia Brandão, founder who just switched model providers
**Goal**: Open Settings from the sidebar profile and change the default model with the list and detail visible together.
**Preconditions**: Signed in; inner display flat; at least one provider connected.
**Device**: inner flat
**Ideal path**: 4 — tap the profile, tap Models, pick Default model, choose a model.
**Alternate paths**: (a) On outer display, Settings sheet then Models is a push inside the sheet (Done to close). (b) Legal's "Add your OpenRouter key" row opens Models directly. (c) Half-folded: list left, Models right.
**Design source**: `PG-B-Settings.dc.html`, `PG-B-Models.dc.html`, PG-B-Rules > Settings and > Models, `Split.dc.html` (profile "Alex Morgan" at the sidebar bottom).

### Steps
1. In the 1/3 sidebar, tap the profile row at the bottom ("Alex Morgan"). → Settings opens as a sheet that stays inside the content area and never crosses the fold.
2. Observe the sheet. → Settings list in 1/3 (selected row filled) and the selected detail in 2/3: profile, Models, Voice, Integrations, AI data sharing, Archived bots, Change password. Done (xmark) closes.
3. Tap "Models". → Detail shows Default model, Providers, Add a server.
4. Tap "Default model" and choose "Model A" from the menu. → Green line "Now using Model A".
5. Tap "Find models" for a local server. → Row shows a spinner; success or "Server unreachable" red line; "No matching models" for no match.
6. Tap "Done". → Sheet closes; Home returns.

### Variations
- Outer display: each row pushes inside the sheet with Back; no split.
- Voice shows "Hear a sample" as the prominent button; Integrations "Continue" only inside setup.
- Account (profile detail) holds sign out and delete account; no board for the detail.

### Edge Cases
- Values load after the list renders; rows show no value until loaded.
- Self-hosted older server: the model procedure returns 404 meaning "not supported".

### Design gaps
- Account, AI data sharing, Archived bots, Change password: NO BOARD (the list rows exist; the details do not).
- Boards show "Settings" as a sheet from the profile, but the inner sidebar bar has no visible entry for it besides the profile row; Expo calls it "Account" (Home icon label "Account").
- A sheet containing its own split view (list 1/3 + detail 2/3) inside a 2/3 content area is not drawn; width of the nested split is unspecified.

---

## STORY-011: Open an artifact image and share it, across display modes
**Type**: short
**Topic**: iPhone Duo and device adaptation
**Persona**: Beatrix Lindahl, founder sending a chart to an investor
**Goal**: View an agent-made image full screen and share it.
**Preconditions**: Artifacts list has an image artifact. Outer display, then rotation.
**Device**: iPhone Duo outer
**Ideal path**: 3 — Artifacts (Home strip), tap the image row, Share.
**Alternate paths**: Tap an image inside a thread (opens PG-A-Image directly). Save to Photos instead of Share.
**Design source**: PG-A-Rules > Artifacts (`PG-A-Artifacts.dc.html`), > Artifact (`PG-A-Artifact.dc.html`), > Image (`PG-A-Image.dc.html`).

### Steps
1. On Home, tap Artifacts (strip group with Activity and Search). → List with 28 pt "Artifacts" title, filter chips (All bots first), divided rows with type tiles. No prominent action.
2. Tap the image artifact row. → Full-screen image with a 35% dim under clear-glass controls: Close, Share / Save to Photos, More; a clear name pill at the bottom.
3. Tap "Share" (square.and.arrow.up). → System share sheet.

### Variations
- Inner display: the bot filter is a vertical list in the 1/3, rows in the detail, and preview as the extra level; the image fills the 2/3 with the thread as the sidebar third.
- Half-folded: image on one half, thread on the other. Laptop pose: image on top, controls on the bottom; rotates freely.
- Non-image artifacts (Artifact page): Share is the prominent action, Versions in the strip, version pill floats.

### Edge Cases
- "Could not load this image." with Close still available; "No preview for this file type."
- Long press a row in the list: delete confirm lists the version count.

### Design gaps
- The Image rule says the image page has no prominent action while Artifact has "Share" as prominent; opening an image from the Artifacts list vs from a thread both reach PG-A-Image, but the Artifact page rule does not say when an image artifact uses which screen.
- Laptop pose is applicable to Image but not Artifacts; the transition from the list (full column) to the image (pose) is not specified.
- Save to Photos permission denial state has NO BOARD.

---

## Summary table

| Story | Type | Device |
|---|---|---|
| STORY-001 | short | outer |
| STORY-002 | medium | outer |
| STORY-003 | medium | outer to inner |
| STORY-004 | medium | inner flat |
| STORY-005 | long | laptop pose |
| STORY-006 | medium | laptop pose |
| STORY-007 | medium | outer, inner, half-folded |
| STORY-008 | short | outer (reduced height) |
| STORY-009 | medium | outer / inner |
| STORY-010 | medium | inner flat |
| STORY-011 | short | outer |
