# Redundancy critique, round 2: planned native iOS app

Scope: round 1 items (RED-R1-1 to RED-R1-16) re-checked against the current boards in `docs/design-system/ios/boards/`, plus a new hunt across the boards added in the gap-fix pass and the older boards. Boards are cited by file stem (`PG-A-Home` = `PG-A-Home.dc.html`). Boards are static mockups, so a journey step is judged against the board that draws it. All findings are about planned design, not shipped behavior.

Evidence grades: **Seen** = visible in a screenshot I viewed this round (PH-Home, PG-A-Home, PH-Spaces, PG-B-Spaces, PH-Inbox, Sheet, Split, Main, PG-A-Cleanup, PG-A-Compose, PG-A-InboxMessage, PG-B-Account, PG-B-Settings, PG-B-Consent, PG-A-HomeNoModel, PG-A-Activity, PG-A-ThreadStates, PH-Thread, PH-Computer, PH-GroupThread). **Spec** = board text found by string search. Not re-viewed this round: DS-01 to DS-07 renders, PG-B-Finance, PG-B-Legal, PG-B-CapTable, PG-B-DataRoom, PG-A-Artifact(s), PG-B-NewBot, PG-B-BotSettings, PG-B-GroupSettings, PG-B-NewGroup, PG-B-Models, PG-B-Voice, Desk, Desk-Computer, Inner, Inner-Message. Items about those boards are carried from round 1 and marked "carried".

Verdict: the largest round 1 problems are fixed. The Home screens now agree, the Inbox agent has a Personnel row, the inbox count is gone, Change password lives only on Account, and the model-connect sheet states the data use. The remaining problems are smaller: one concept with several names ("needs me", "page", "bot"), three identities for the signed-in person, a few confirmations on undoable actions, and a mail journey with three separate permission gates. Journey verdicts: Home acceptable, Mail acceptable (convoluted at setup), Computer acceptable, Settings acceptable, Sign-in/Account minimal.

## Round 1 items: status

| Round 1 id | Status | Evidence |
| --- | --- | --- |
| RED-R1-1 Home drawn four ways | Mostly resolved | `PH-Home`, `PG-A-Home`, `Main` all go Activity, Personnel, Pages with the same rows (Seen). Remaining: `Split` sidebar has Pages before Personnel and puts Artifacts inside Pages (RED-R2-1). |
| RED-R1-2 space has three names | Resolved | Every Home sample says "Personal"; "Northwind" appears only as the other space in the switcher and in the delete-space example. `Split` has the switcher. Space settings still holds only Name and Delete space (RED-R2-14). |
| RED-R1-3 several mentions of Finance and Legal on Home | Open, changed | Count appears only on the page row and the agent row shows its last message, so the duplicate text is gone. A new variant remains: an agent row moves between sections (RED-R2-2). |
| RED-R1-4 two data prompts after connecting a model | Resolved | `PG-A-HomeNoModel` shows "Connecting sends your messages and attachments to Model A to run your agents. Privacy details" under Connect. `PG-B-Consent` keeps only a Speech first-use prompt and the AI data sharing page. |
| RED-R1-5 inbox counts disagree | Mostly resolved | Home shows only "3 need reply". The section name still differs: "Today" on `PH-Inbox` and `Sheet`, "Other mail today 24" on `Split` (RED-R2-8). |
| RED-R1-6 Change password twice | Resolved | `PG-B-Settings` has no Change password row. `PG-B-Account` has Sign out without a confirmation frame. |
| RED-R1-7 phone inbox has no Inbox agent route | Resolved | `PH-Inbox` has the prominent chat button in the top bar. Position differs from `Sheet` (bottom-left) by device, which is acceptable. |
| RED-R1-8 four ways to triage mail | Partly resolved | `PH-Inbox` now has a More menu. Cleanup now says "Archive 101 emails", and the sender-versus-email count mismatch is gone. Still open: Skip inbox wording and count mismatch in the Unsubscribe item (RED-R2-6); confirm on an undoable action (RED-R2-5). |
| RED-R1-9 mail row drawn four ways | Partly resolved | The double unread dot is gone. `Split` still puts the chip at the right and shows unread dots on Needs reply rows that other boards show without a dot (RED-R2-8). |
| RED-R1-10 two ways to reply | Partly resolved | `PG-A-Compose` now draws the close choice "Save draft / Discard draft / Cancel", so a draft is saved. Still open: the Reply/Reply all/Forward menu appears twice (RED-R2-4). |
| RED-R1-11 Inbox agent has no Personnel row | Resolved | `PG-A-Home`, `PH-Home`, `Main` list "Inbox agent, Sorted 14 emails this morning". `Split` does not (RED-R2-1). |
| RED-R1-12 bell and See all; search without destination | Open | `PG-A-Activity` is captioned "bell or See all", so the two controls open the same list. No search result board exists in the board list (RED-R2-9). |
| RED-R1-13 Connect apps/Integrations; bot/agent | Partly resolved | "Connect apps" survives only in `DS-07-Domain` (Spec). "Bot" is still visible in "New bot", "Create a bot", "Archived bots" (RED-R2-10). |
| RED-R1-14 creation forms and bot fields | Partly resolved | Group name is "Funding room" in `PH-GroupThread`, `PG-A-GroupThread`, `PG-B-GroupSettings`, `PG-B-NewGroup` (Spec); "Operations" no longer appears. `PG-A-Home` pinned frame calls a group "Launch team", a separate sample. New bot and New group sheet-versus-page and Title/Description duplication carried, not re-viewed (RED-R2-15). |
| RED-R1-15 Finance numbers and Runway summary | Carried, not re-viewed | RED-R2-16. |
| RED-R1-16 identity, status and glass rules | Open | RED-R2-11, RED-R2-3. |

## Open issues

### RED-R2-1 (Medium) The inner-display Home sidebar differs from the two outer Homes
Boards: `Split`, `PH-Home`, `PG-A-Home`, `Main`.
Problem (Seen): `PH-Home`, `PG-A-Home` and `Main` go Activity, Personnel, Pages. `Split`'s sidebar goes Activity (a single row "1 needs you"), Pages, Personnel. `Split` lists Artifacts inside Pages; `PG-A-Home` shows Artifacts as its own section after Pages (scrolled frames). `Split` Personnel shows Chief, Finance agent, Carta agent, Legal agent, with no Inbox agent or Mercury agent, while the other Homes list Chief, Inbox agent, Carta agent, Mercury agent. A person who folds the Duo sees a different list of agents.
Fix: use one order and one agent list in the sidebar. Put Artifacts in one place (its own section with See all) on every layout.

### RED-R2-2 (Medium) An agent row changes section while it works
Boards: `PG-A-Home`, `PH-Home`.
Problem (Seen): Finance agent and Legal agent appear in Activity while they work and are absent from Personnel in the same frame. In the "Pinned, group, unread" frame, Finance agent is back in Personnel. The person looking for the Finance agent in Personnel will not find it while it works, and the row identity jumps position.
Fix: keep Personnel as the full list; let Activity be a short list of what needs attention or is running now, and show the agent in both. Or state in the catalog that Activity rows replace Personnel rows and draw that deliberately.

### RED-R2-3 (Medium) Four words for "waiting on me"
Boards: `PG-A-Home`, `PG-A-Activity`, `PH-Thread`, `PH-Inbox`, `Sheet`, `PG-A-ThreadStates`.
Problem (Seen): Activity says "Needs you"; the approval card in the thread says "Needs approval"; mail rows say "Draft ready" and "Needs attention"; the Inbox page row says "3 need reply". "Needs you" and "Needs approval" can describe the same Finance payment approval.
Fix: choose "Needs approval" for anything that blocks on a tap (agent card, Activity) and "Needs reply" for mail only; use one chip style. Keep "Draft ready" as the only mail chip that points to an agent draft, and drop "Needs attention" or define it.

### RED-R2-4 (Medium) The Reply, Reply all, Forward menu appears in two places
Boards: `PG-A-InboxMessage`, `PG-A-Compose`.
Problem (Seen): the reply capsule icon on a message opens a menu with Reply, Reply all, Forward. The Compose title menu repeats the same three choices. Changing type after opening Compose also changes Subject and quoted text, so it is a second, less visible route to the same decision.
Fix: keep the menu on the message capsule only. In Compose show a plain title ("Reply", "Reply all", "Forward") with no menu.

### RED-R2-5 (Medium) Confirmations on actions that can be undone
Boards: `PG-A-Cleanup`, `PG-A-InboxMessage`, `PG-A-Compose`, `PG-B-Account`.
Problem (Seen): Cleanup asks "Archive 101 emails from 3 senders? You can undo this afterwards." and then the Done frame also offers Undo and History offers Undo again: confirm plus undo twice. Close in Compose with typed text and Edit draft ("Discard changes / Keep editing") each add a prompt; two different discard prompts exist, one for new messages (Save draft / Discard draft / Cancel) and one for edited drafts (Discard changes / Keep editing). Unsubscribe confirm is correct because it cannot be undone.
Fix: drop the Cleanup confirm (undo covers it) or drop the Done-frame Undo and keep it only in History. Use one close prompt for both Compose states.

### RED-R2-6 (Low) Cleanup menu counts and wording
Boards: `PG-A-Cleanup`.
Problem (Seen): with 3 senders selected, the menu offers "Unsubscribe from 2 senders" with no explanation of why 2, and "Skip inbox for future mail" is separate from Archive with no description of how it differs; Done says "2 unsubscribed" so the number is only discoverable after the fact.
Fix: label the menu "Unsubscribe (2 of 3 senders support it)" or hide senders that do not support it, and add a one-line description "Future mail skips Inbox" to Skip inbox.

### RED-R2-7 (Medium) Three setup gates before the Inbox works
Boards: `PH-Inbox`, `Sheet`, `PG-A-Compose`, `PG-B-Consent`, `PG-B-Integrations`.
Problem (Seen): No mail account shows "Connect Gmail"; the next screen "Let the Inbox agent read your mail? Allow / Not now"; later a banner "Changes to mail are off. Turn on" (and the same in Compose, "Sending is off for me@example.test. Turn on"). That is connect, consent to read, and consent to change: three prompts with three wordings for one person who wants "use my mail". The "Always allow" list on `PG-B-Settings` (AI data sharing) then holds a fourth set of mail permissions (Archive mail, Send mail, Create events) and mixes action approvals with data sharing.
Fix: after Connect Gmail, ask one question that states both read and change ("The Inbox agent reads your mail and can archive; it asks before sending") with Allow. Keep "Changes off" as a switch in Settings, not a banner that repeats on Compose. Move "Always allow" to its own row (for example "Approvals") or into Integrations.

### RED-R2-8 (Low) The mail list differs by board
Boards: `PH-Inbox`, `Sheet`, `Split`, `DS-05-Lists` (Spec).
Problem (Seen): section name "Today" versus "Other mail today 24"; `Split` shows unread dots on Needs reply rows and puts chips at the right of the row; `PH-Inbox` and `Sheet` put chips on a separate third line and show no dot on Needs reply rows. `Split` has no To do card and no Draft ready chips, though the same data exists.
Fix: use one row anatomy from `DS-05-Lists`, one section name ("Today"), and the same chips and To do card on the inner display.

### RED-R2-9 (Low) Bell, See all, search
Boards: `PG-A-Home`, `PH-Home`, `PG-A-Activity`, `Split`.
Problem (Seen): the bell with a dot and "See all" both open the same Activity list (board caption says so). The dot on the bell is not explained next to "Needs you" in the list itself. Global search (Home) and "Search mail" (Split, PH-Inbox magnifier) have no result board.
Fix: remove "See all" or the bell; draw one search result frame; label inbox search by scope.

### RED-R2-10 (Low) Bot versus agent, still
Boards: `PG-B-Settings`, `PG-B-NewBot`, `PG-A-Rules`, `PG-B-Rules`, `DS-03-Navigation`, `PG-B-Account`.
Problem (Seen/Spec): rows say "Inbox agent", the home menu says "New agent", but Settings has "Archived bots", the sheet is `NewBot`, and the delete-account text says "account, bots, conversations".
Fix: use "agent" everywhere visible. Rename "Archived bots" to "Archived agents" and the Account delete text to "agents".

### RED-R2-11 (Medium) Three identities for the signed-in person
Boards: `PG-A-Home`, `PH-Home`, `Split`, `PG-B-Settings`, `PG-B-Account`.
Problem (Seen): the Home avatar is "AB"; Settings and Account show "SR / Sam Rivera"; the `Split` sidebar footer shows "AM / Alex Morgan" with a gear. Besides the sample data, `Split` opens Settings by gear and the other layouts by tapping the avatar.
Fix: use one sample person (initials and name) on every board; on `Split` make the avatar row the Settings entry, as on the other Homes.

### RED-R2-12 (Medium) "Page" means three things
Boards: `PG-A-Home`, `PH-Thread`, `PG-A-ThreadStates`, `PG-A-AgentPage`.
Problem (Seen): Home "PAGES" lists Inbox, Finance, Legal, Cap table, Data room, Team computer; the thread header has a "Page" icon (accessible name "Open the page") that opens an agent page; Artifacts are a third list. The Finance agent's page and the Finance page in Home Pages are different screens with the same word.
Fix: call the Home list "Apps" or "Workspaces" (pick one) or name the agent's page "Summary". Keep one definition of "page" in the catalog.

### RED-R2-13 (Low) Chat menu has three overlapping destructive items
Boards: `PH-Thread`, `PG-A-Thread`, `PH-GroupThread`, `PG-B-Settings`.
Problem (Seen): the agent menu has Clear chat, Archive and Delete chat; the group menu has Clear chat, Archive, Delete group. Archive here archives the chat or the agent (Settings has "Archived bots"), which is unclear. Clear chat and Delete chat both remove messages.
Fix: keep Archive (it is undoable) and Delete; remove Clear chat or explain it. Say whether Archive archives the chat or the agent.

### RED-R2-14 (Low) Space settings holds one field
Boards: `PG-B-Spaces`, `PH-Spaces`.
Problem (Seen): Space settings has only Name and, for non-primary spaces, Delete space. A menu entry plus a pushed page plus a done tick for one text field.
Fix: rename and delete from the switcher row (long press or swipe), and add Space settings only when it holds another setting. New space has two entry points (the Home New menu and the title menu, both Seen); keep the title menu only.

### RED-R2-15 (Low) Creation forms, carried
Boards: `PG-B-NewBot`, `PG-B-NewGroup`, `PG-B-NewSpace`, `PG-B-BotSettings`.
Problem (carried, not re-viewed): New bot and New space are sheets and New group is a pushed page; a bot has both Title and Description with near-identical placeholders.
Fix: make New group a sheet; keep one of Title and Description.

### RED-R2-16 (Low) Finance numbers and the Runway summary, carried
Boards: `PG-B-Finance`, `PG-A-AgentPage`, `PG-A-Artifact`, `Desk`, `PG-A-Artifacts`.
Problem (carried, not re-viewed): three tile label sets, "Monthly burn" versus "Monthly spend", "Runway summary" as both an agent page and an artifact, and the artifact title twice in `PG-A-Artifact`.
Fix: one tile component and label set; decide whether the agent page is the latest artifact; drop one of the two titles.

### RED-R2-17 (Medium) Computer title says Team while the toggle says Private
Boards: `PH-Computer`, `PG-A-Computer`, `Desk-Computer`.
Problem (Seen on `PH-Computer`): the page is titled "Team computer" while the segmented control above it can select Team or Private. "Take control" is the tinted action; when the person is in control the "Team" chip sits above a "Team computer" title, saying the same thing twice. The status pill ("Finance agent is driving") and the in-page banner then add a third line. There are also three routes in: Home Pages row, the thread's "Open computer" menu item, and the thread's inline Team computer block with Take control.
Fix: title follows the selected scope ("Private computer") or drop the word from the title and use the chip; drop the second "Team" chip. Keep the three routes as shortcuts, but have the inline block's button open the computer page (not take control directly) so control starts in one place.

### RED-R2-18 (Low) Another path to connect a model
Boards: `PG-A-HomeNoModel`, `PG-A-ThreadStates`, `PG-B-Models`.
Problem (Seen): Home banner "Connect a model", the thread's "Not sent: No model connected. Connect" and Settings Models all open the same sheet. This is acceptable as shortcuts, but the Settings Models page and the sheet each hold the provider list; carried from D5.
Fix: keep all three; make Settings Models open the same sheet so the provider list exists once.

### RED-R2-19 (Low) Glass and tinted-action rules, carried
Boards: `PG-A-Thread`, `PG-A-Computer`, `PH-Computer`, `PH-Inbox`.
Problem: `PH-Inbox` has the chat button tinted in the top bar and the same screen can show tinted actions from banners ("Reconnect"); `PH-Computer` has the glass segmented control, the glass full-screen button and the glass bottom pill together. README limit (three glass groups, one prominent action) is not met in several frames; carried from C11 and C12.
Fix: add a README line on what counts as a glass group and apply it; one tinted action per frame.

## Counts

Round 1 items re-checked: 16. Resolved: 6 (R1-2, R1-4, R1-6, R1-7, R1-11, and R1-1 except for `Split`). Partly resolved: 6. Open or carried: 4. New or changed open issues this round: 19 (RED-R2-1 to RED-R2-19).
