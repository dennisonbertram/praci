# Redundancy and information architecture (iOS)

Scope: the native iOS app in `apps/ios/Sources/Praci`. Evidence is Swift code read for this pass, plus the lead lists in `docs/ios-native/ux/catalog.md` ("Redundancy Candidates", "Code findings to verify"). No device was used. Every claim is tagged **[code]** (read in Swift, file:line given) or **[suspected]** (needs a device walk). Paths below are under `apps/ios/Sources/Praci` unless noted. Story ids come from the catalog. All example data is invented.

## Summary

The Home list is compact, but the app has three structural problems. Routines are built and routed yet no button opens them. The same Settings sheet is the answer to four different "Connect" buttons and always opens at its top level. Business pages repeat three small facts (hide amounts, "ask the agent", connect an account) with different controls on each page. Most "duplicate paths" in the catalog are deliberate gesture alternatives (swipe plus menu plus toolbar) and should stay. Naming is mostly consistent: the UI says "agent", never "bot", and "Praci" everywhere a person can read; the remaining drift is "Team computer" vs "Private computer" vs "Open computer" vs "Computer", the `rakazo://` URL scheme, and two Settings entry points on Home.

Counts: Duplicate Paths 9 (4 keep, 5 act), Duplicate Information 5 (2 act), Overlapping Features 6 (3 act), Hierarchy and IA 9. Proposals: R-1 to R-12.

## Duplicate Paths

Verdict key: KEEP (deliberate accelerator), CANONICAL (pick one), REMOVE.

1. **Archive a mail message. KEEP.** Swipe (`Inbox/List/InboxListView.swift:59-63`), long-press menu (`:83-85`), message toolbar button (`Inbox/InboxMessageScreen.swift:86`). All call the same archive action [code]. These are the standard iOS triple. Cleanup (`InboxListView.swift:38`) is a different job (bulk by sender, can unsubscribe, `Inbox/Cleanup/CleanupScreen.swift:48-62`), so it is not a duplicate [code]. STORY-057, STORY-063.
2. **Connect an app or model: Settings opens at its top level. CANONICAL, fix the target.** Finance "Connect" (`Finance/FinanceScreen.swift:20`), Cap table "Connect Carta" (`CapTable/CapTableScreen.swift:38`), Legal "Add your OpenRouter key" (`Legal/LegalScreen.swift:55`), Inbox "Reconnect" and "Connect Gmail" (`Inbox/List/InboxListView.swift:17,146` via `Inbox/InboxScreen.swift:22`) all set `app.showingSettings = true` and nothing else [code]. The person lands on the Settings list, then must pick Integrations or Models. Only the Home banner goes straight to the right screen (`Home/HomeScreen.swift:114,61`: `NavigationStack { ModelsScreen() }`). Drift, not design. STORY-102, 105, 108, 066.
3. **Sign out twice. REMOVE one.** Settings list (`Settings/SettingsScreen.swift:37-40`) and Account (`Settings/Account/AccountScreen.swift:34-36`), neither with a confirmation [code]. Keep the Settings list row only if Account stays a one-row destination; otherwise keep Account's. STORY-009, 126.
4. **Pin and archive an agent. KEEP the row menu, REMOVE the duplicate Pinned toggle.** Row context menu has Pin, Rename, Settings, Archive (`Manage/AgentRowMenu.swift:15-28`). Agent settings repeats Pinned, Section and Archive (`Manage/BotSettingsScreen.swift:43-47,60-67`); the thread menu repeats Settings and Archive (`Thread/ThreadScreen.swift:216-222`) [code]. Three places can archive; two can pin. The thread-menu Archive is the useful one (you are looking at the agent). Settings is the only place to set Section and Restore. Settings, `Archived`, and the row menu are three surfaces for one object. STORY-016.
5. **Open the computer. CANONICAL, fix target.** Home "Team computer" opens the first agent's computer (`Home/HomeScreen.swift:224-226`: `boot.bots.first`) while the thread menu opens that agent's own (`Thread/ThreadScreen.swift:209-210`) [code]. Same screen, different bots. The screen title then flips between "Private computer" and "Team computer" by mode (`Computer/ComputerScreen.swift:60`). STORY-115, 109.
6. **Open a meeting. KEEP.** List row, deep link, agent thread link. They arrive at the same `MeetingDetailScreen`. The Data room "Recordings" note is a Markdown copy, not the detail (see Duplicate Information). STORY-085, 088.
7. **Hide amounts. CANONICAL (Settings), keep the Finance button as shortcut but extend it.** Settings toggle (`Settings/SettingsScreen.swift:81-88`) and Finance toolbar (`Finance/FinanceScreen.swift:29-36`) write one server preference [code]. Legal masks values with the flag (`Legal/LegalScreen.swift:196,260`), Cap table has no toggle. Each of the three models reads the flag once on load [code, catalog finding 29], so toggling in one place does not update the others on screen until reload. Deliberate shortcut, incomplete implementation. STORY-103, 104.
8. **Delete a data room file or artifact. KEEP.** Swipe, toolbar and context menu are the iOS pattern (`Artifacts/ArtifactsScreen.swift:60-65`, `Artifacts/ArtifactScreen.swift:79`). Note the confirmation differs: artifact delete asks (`ArtifactScreen.swift:37-44`), data room item delete asks (`DataRoom/DataRoomScreen.swift:335`), fine and consistent [code].
9. **Ask an agent about a page. DRIFT.** Inbox has "Ask" (`Inbox/InboxScreen.swift:47`), Legal has "Ask Legal agent" (`Legal/LegalScreen.swift:40`), Cap table has "Ask Carta agent" (`CapTable/CapTableScreen.swift:50`); Finance, Data room and Meetings have none [code, grep for `bubble.left` hits only those three screens]. Three labels for one idea, and three pages without it.

## Duplicate Information

1. **Money figures and Hide amounts across Finance, Legal, Cap table.** Same flag, three models, three load-once reads (see Duplicate Paths 7). The repeat is not noise (each page has its own numbers) but the masking state is stale across pages. Action: one shared read of the flag. [code] STORY-104.
2. **Unread count: Home Inbox row (`Home/HomeScreen.swift:124-126`) and the Inbox screen.** Serves a new context (glance vs list). KEEP. [code]
3. **Account name: Settings profile row (`SettingsScreen.swift:51-57`, name plus the word "Account") and Account (`AccountScreen.swift:17-22`, avatar, name, email).** The Settings row is a label for the destination, not a repeat. KEEP, but the caption "Account" under the name is redundant with the row opening an Account screen. Minor. [code]
4. **Meeting content: Meetings detail and the Data room "Recordings" note.** Two copies of the same meeting, only one editable (to-dos live in the detail, `Meetings/MeetingDetailScreen.swift:78`). Per the catalog this is a Markdown export. Action: if the note is generated, label it as a copy or hide it from the Data room list. [suspected - needs device walk to see how it appears]. STORY-085, 088.
5. **A to-do: Inbox To do card and meeting to-dos.** The card hides itself when empty (`Inbox/Todos/TodosCard.swift:5`); meeting to-dos are a separate list in the detail. The catalog says one server call can surface a meeting to-do in both. [suspected - needs device walk]. STORY-064, 080.

Clean: the current space name appears only in the Home nav title and title menu (`Home/HomeScreen.swift:18-20`), which is one control, not two [code].

## Overlapping Features

1. **Artifacts vs Agent page. Differentiate by rename, do not merge yet.** Both are reached only from the thread menu (`Thread/ThreadScreen.swift:211-216`) as "Artifacts" and "Agent page" [code]. Artifacts is a versioned list of agent outputs (`ArtifactScreen.swift:61-76`), the Agent page is one live page with page picker and share (`AgentPages/AgentPageScreen.swift:85-112`). The share behaviour is separate (`ArtifactScreen.swift:27` ShareLink vs `AgentPageScreen.swift:99` Share/Stop sharing), and HTML runs differently in each (catalog finding 43). A person who asks the agent "make me a page" cannot predict which menu item will hold it. Action: one entry "Pages and files" in the menu with the page on top, or one explanatory merge in the list. [code for structure; user confusion suspected - needs device walk]
2. **Three to-do lists: Inbox To do, Legal deadlines, meeting to-dos. KEEP separate, link them.** Different sources and owners. The lists are defensible; the problem is nobody can see all open to-dos in one place. Do not merge screens. Only consider a Home "Today" row later. [suspected]
3. **Cleanup vs swipe Archive vs Unsubscribe. KEEP.** Not duplicates (Duplicate Paths 1). Unsubscribe in the message menu (`InboxMessageScreen.swift:104-110`) and in Cleanup (`CleanupScreen.swift:54,223`) have the same semantic with different confirmation text ("Unsubscribing can't be undone." in Cleanup). [code]
4. **Team computer vs Private computer. MERGE the name.** One screen, two titles chosen by mode (`ComputerScreen.swift:60,121`), a third name "Open computer" in the thread menu (`ThreadScreen.swift:209`) and a fourth, "Computer is asleep/stopped", in status text (`:104-110`). Mode is an implementation detail for most people. [code]
5. **Models vs Voice vs Integrations: three key screens.** All connect a provider (`Settings/SettingsScreen.swift:62-66`): Models (`ModelsScreen.swift`, keys), Voice (`VoiceSettingsScreen.swift:137`, "Connect"/"Replace key"), Integrations (connections). Voice is partly keys and partly device preference (`:15-37`). Keep three, but name them by outcome in one section. [code]
6. **Notification preferences vs Agent settings Voice vs Settings Voice.** "Read replies aloud" lives in Agent settings (`Manage/BotSettingsScreen.swift:51-52`) and "Call sounds"/"Waiting sound" in global Voice (`VoiceSettingsScreen.swift:35-37`). Catalog finding 36 says the first saves but nothing reads it. A saved setting that does nothing is worse than a missing one. [code]

## Hierarchy & IA

Home order (`Home/HomeScreen.swift:100-158`): error banner, model banner, Inbox row, Pinned, Agents (4 plus "Show N more"), custom sections, then Pages (Finance, Legal, Cap table, Data room, Meetings, Team computer) [code].

1. **Settings is two taps from Home and has eleven destinations** in four unlabeled sections (`Settings/SettingsScreen.swift:47-107`): Account, Models, Voice, Integrations, AI data sharing, Allowed without asking, Hide amounts, Appearance, Notifications, Usage, Archived agents, plus Sign out. The groups carry no headers, so "AI data sharing" and "Allowed without asking" sit with nothing to explain they are both privacy controls. [code]
2. **Two gear icons on Home.** Settings (`HomeScreen.swift:23`) and Space settings in the title menu (`:92-94`); both use `gearshape`. A person looking for "Settings" can open the wrong one. [code]
3. **"Computer" is filed under Pages.** It is a per-agent tool, not a business page like Finance (`HomeScreen.swift:224-229`), and it opens only the first agent's. Moving it to the thread menu only (where it already exists, `ThreadScreen.swift:209`) removes the row. [code]
4. **Routines are unreachable from the UI.** `RoutinesScreen`/`RoutineScreen` exist (`App/AppShell.swift:37-38`, `Routines/RoutinesScreen.swift:21`) and `rakazo://open/bot/<id>/routines` routes to them (`App/Route.swift:48`), but the only callers of `.routines(` outside Route/AppShell do not exist: the thread menu offers Computer, Artifacts, Agent page, Settings, Archive and no Routines (`ThreadScreen.swift:208-222`) [code, grep for `.routines(` and `.routine(`]. The feature is shipped dark. Highest-severity IA finding.
5. **Depth.** Mail Cleanup is Home > Inbox > More > Cleanup (3 levels, `InboxListView.swift:35-46`). Artifact detail is Home > agent > menu > Artifacts > artifact (4). A routine detail would be 4. Restore an archived agent is Home > Settings sheet > Archived (3) while its only quick path is an expiring undo toast. [code]
6. **Trivial at top level.** "Archived agents" gets its own Settings section (`SettingsScreen.swift:30-35`) as a one-row list; Usage sits beside Notifications and Hide amounts. Neither is a daily action. [code]
7. **Pages that can be hidden leave no trace.** `hiddenPages` removes rows silently (`HomeScreen.swift:192-217`); Meetings and Data room are listed in the hide set, Computer is not. Catalog finding 26. [code]
8. **One concept, one name.** Verified by grep over Swift string literals:
   - "bot" never appears in a visible string; the UI says "agent" (`BotSettingsScreen.swift:24` "Agent settings", `HomeScreen.swift:134` "Agents"). Internal Route names and the URL path `bot/<id>` (`Route.swift:41-49`) use bot. Clean in the UI. [code]
   - "Integrations": screen title `IntegrationsScreen.swift:48`, Settings row `SettingsScreen.swift:65`. No "Apps" or "Connect app" label found in any string literal (grep). Clean, matches the product decision "Integrations, not Apps". The catalog's "Connect an app" is its own wording, not the UI's. [code]
   - "Praci" is the only product name in visible strings (`AuthenticationView.swift:24`, `Meetings/MeetingDetailScreen.swift:44,46`, display name `project.yml:35`). "Rakazo" survives in the URL scheme (`project.yml:50`, `SSOBrowser.swift:108`, `App/Route.swift:29`), Swift module names (RakazoAPI/Core/UI) and bundle prefix `com.rakazo` (`project.yml:3`). The scheme is user-visible if a link is pasted or shared; the bundle id is already `ai.praci.mobile`. [code]
   - Computer: four names, see Overlapping 4.
   - "Agent page" vs "Pages" section on Home: Home "Pages" means business pages, thread "Agent page" means a page an agent built. Same noun, two meanings. [code]
   - "Cap table" in the row but "Carta agent" in the button; the row hides together with "investors" (`HomeScreen.swift:206`). [code]
9. **Clean areas.** Data room's Add menu (`DataRoom/DataRoomScreen.swift:247-256`) is one menu with Files, Photos, New folder, no duplicate entry. Meetings has one Record entry (`Meetings/MeetingsScreen.swift:41-42`). Group settings and Space settings do not overlap with other screens. Compose, Cleanup, and the approval cards have no paths I found that duplicate each other beyond what the catalog lists. [code]

## Proposals

**R-1. Open Routines from the UI.**
- Problem: Routines are built and routed but nothing opens them (`ThreadScreen.swift:208-222`, `App/AppShell.swift:37`, `Route.swift:48`).
- Proposal: add one "Routines" item to the thread menu next to Artifacts. If an agent has none, hide the item.
- Saved: the feature becomes reachable at all (0 to 2 taps from a thread).
- Risk: showing an empty list for most agents; hide when empty.
- Size: S. Device walk: n (confirm the item appears), y for the empty case.

**R-2. Make every "Connect" button open the right Settings screen.**
- Problem: Finance, Cap table, Legal and Inbox open the top of Settings (`FinanceScreen.swift:20`, `CapTableScreen.swift:38`, `LegalScreen.swift:55`, `InboxScreen.swift:22`); the Home banner already opens Models directly (`HomeScreen.swift:61`).
- Proposal: pass a destination (Integrations or Models) to the Settings sheet and push it immediately; reload the page under it on dismiss (catalog finding 27).
- Saved: 2 taps and one scan of an 11-row list per connect.
- Risk: sheet navigation state must survive dismiss; extra reload on every close.
- Size: M. Device walk: y.

**R-3. Remove one Sign out.**
- Problem: two Sign out rows (`SettingsScreen.swift:37`, `AccountScreen.swift:34`), no confirmation on either.
- Proposal: keep Account's (next to Delete account) and remove the Settings list section; add a confirmation.
- Saved: one list section, one destructive control on a primary screen.
- Risk: sign-out becomes one tap deeper (Settings > Account).
- Size: S. Device walk: n.

**R-4. One name and one Home position for the computer.**
- Problem: "Team computer" row opens the first agent only (`HomeScreen.swift:224`), title flips by mode (`ComputerScreen.swift:60`), thread menu says "Open computer".
- Proposal: title the screen "Computer" (agent name in the subtitle), remove the Home row (the thread menu is canonical), keep the deep link.
- Saved: one Home row; no wrong-agent ambiguity.
- Risk: loses a one-tap path for people with a single shared computer; check on device if "Team computer" is the only way anyone gets there.
- Size: S. Device walk: y.

**R-5. Group Settings and add headers.**
- Problem: 11 destinations in four headerless sections (`SettingsScreen.swift:47-107`); Archived agents alone in a section; two gear icons on Home.
- Proposal: headers "Connections" (Models, Voice, Integrations), "Privacy" (AI data sharing, Allowed without asking), "App" (Hide amounts, Appearance, Notifications, Usage); move Archived agents into the Agents area of Home as a row that appears only when something is archived; rename the title-menu item "Space settings" to a different icon (`person.2` or none).
- Saved: scanning cost on Settings; removes the one-row section.
- Risk: new copy (three header words); check against the copy rule in AGENTS.md. Header words are necessary only if scanning is the problem; simplest alternative is order only, no headers.
- Size: S. Device walk: y.

**R-6. Unify Hide amounts.**
- Problem: three models each read the flag once; toggling on one page leaves Legal and Cap table stale (`FinanceModel.swift:38`, `LegalScreen.swift:196`).
- Proposal: one shared flag on `AppModel`, written by Finance toolbar and Settings, read by all three.
- Saved: removes the stale-masking bug; Cap table gets masking.
- Risk: touches three models.
- Size: M. Device walk: y.

**R-7. One "Ask the agent" control across business pages.**
- Problem: Inbox "Ask", Legal "Ask Legal agent", Cap table "Ask Carta agent", nothing on Finance, Data room, Meetings (`InboxScreen.swift:47`, `LegalScreen.swift:40`, `CapTableScreen.swift:50`).
- Proposal: one toolbar item with a single label ("Ask") and the same `bubble.left` icon on every page whose agent exists; hide when no agent.
- Saved: one learned control instead of three labels; adds missing ones for free.
- Risk: some pages may have no dedicated agent; the item must hide, not guess.
- Size: S to M. Device walk: n.

**R-8. Remove the Pinned and Section duplicates from Agent settings, or the row menu entries, not both.**
- Problem: Pin lives in the row menu (`AgentRowMenu.swift:15`) and Agent settings (`BotSettingsScreen.swift:43`); archive in three places.
- Proposal: keep row menu Pin and thread-menu Archive; keep Agent settings for name, role, colour, section, restore. Drop "Pinned" from the form.
- Saved: one control; two fewer save-error paths in a form that already has dirty tracking.
- Risk: a person who looks for Pin in settings. Low.
- Size: S. Device walk: n.

**R-9. Explain or merge Artifacts and Agent page.**
- Problem: two menu items, two share mechanisms, two HTML runtimes (`ThreadScreen.swift:211-216`, `ArtifactScreen.swift:27`, `AgentPageScreen.swift:99`, catalog finding 43).
- Proposal: first, a single menu entry that opens the agent's page when it has one and the artifacts list otherwise; second (later), unify share and Stop sharing; third, align the HTML sandbox.
- Saved: one menu decision per agent.
- Risk: product call needed; merging changes what a "page" means and the web app may keep both.
- Size: L (full merge), S (single entry). Device walk: y.

**R-10. Remove "bot" from the URL path and note the scheme choice.**
- Problem: UI strings are clean but `rakazo://open/bot/<id>` (`Route.swift:29-49`) and the `rakazo` scheme (`project.yml:50`) leak the old product and entity names to shared links.
- Proposal: accept `praci://open/agent/...` as primary, keep `rakazo://` and `bot/` as aliases for old pushes and links.
- Saved: no UI steps; one naming surface.
- Risk: push payloads and server-built links must be updated together; the SSO callback scheme (`SSOBrowser.swift:108`) is a separate decision and is OAuth-sensitive.
- Size: M. Device walk: y (SSO round trip).

**R-11. Remove the no-op "Read replies aloud" setting until it works.**
- Problem: saved and shown (`BotSettingsScreen.swift:51-52`) but nothing reads replies (catalog finding 36).
- Proposal: hide the Voice section from Agent settings; keep global Call sounds.
- Saved: one section and one dishonest promise.
- Risk: if the server uses `autoSpeak` for the web app, hiding it only on iOS is correct.
- Size: S. Device walk: n.

**R-12. Trim the "Account" caption and merge Hide-pages visibility cue.**
- Problem: the Settings profile row repeats "Account" under the name (`SettingsScreen.swift:55`); hidden pages leave no trace on Home (`HomeScreen.swift:192`).
- Proposal: drop the caption; no placeholder for hidden pages, but show the page list state in Settings only if hiding pages is a real user setting on iOS (it is not editable on iOS, so skip).
- Saved: one visible word.
- Risk: none.
- Size: S. Device walk: n.
