# Redundancy critique, round 3: planned native iOS app

Scope: the 19 round 2 items (RED-R2-1 to RED-R2-19) re-checked against the current boards in `docs/design-system/ios/boards/`, plus a new hunt for duplicate paths, duplicate information, overlapping features, hierarchy problems and cross-board drift, mainly between the boards added in the gap-fix pass and the older ones. Boards are static mockups, so each journey step is judged against the board that draws it. All findings are about planned design, not shipped behavior. Boards are cited by file stem.

Evidence: **Seen** means I viewed the round 3 screenshot of that board (PH-Home, PG-A-Home, PG-A-HomeNoModel, Split, PH-Inbox, PH-Thread, PG-A-ThreadStates, PG-A-Compose, PG-A-Cleanup, PG-B-Account, PG-B-Settings, PG-B-Consent, PG-B-Spaces, PH-Spaces, PG-B-SignUp, PH-Computer). **Carried** means I did not re-view the board this round and the item is unchanged from round 2 (PG-B-Finance, PG-A-AgentPage, PG-A-Artifact(s), Desk, Desk-Computer, PG-B-NewBot, PG-B-NewGroup, PG-B-NewSpace, PG-B-BotSettings, DS-01 to DS-07, Sheet, Inner, Inner-Message, Main, PG-A-InboxMessage, PG-A-Activity, PH-GroupThread).

Verdict: the Home screens now share one structure, mail rows agree across boards, the discard prompt is the same in both Compose states, and Cleanup counts are consistent. What remains is mostly naming and placement drift: the signed-in person has two identities, Server is reachable from three places, "bot" survives in visible text, and one sample group has two names. Journey verdicts: Home acceptable, Mail acceptable (setup still has three gates), Computer acceptable, Settings and Account acceptable, Sign-up minimal.

## Round 2 items: status

| Round 2 id | Status | Evidence |
| --- | --- | --- |
| RED-R2-1 Split sidebar differs | Partly resolved | Split now goes Activity, Inbox, Personnel, Pages, as the phone Homes do. Agent list still differs and Team computer is missing (RED-R3-1). |
| RED-R2-2 Activity rows leave Personnel | Open | PH-Home and PG-A-Home: Finance agent and Legal agent are absent from Personnel while they are in Activity (RED-R3-2). |
| RED-R2-3 four words for waiting on me | Open | "Needs you", "Needs approval", "Draft ready", "Needs attention" all still drawn (RED-R3-3). |
| RED-R2-4 Reply menu twice | Open | PG-A-Compose still has "Reply, title menu open" (RED-R3-4). |
| RED-R2-5 confirmations on undoable actions | Partly resolved | Both Compose discard prompts are now Save draft / Discard / Keep editing. Cleanup confirm now appears only when Unsubscribe is included, and says Archive can be undone. Still open: Undo in the Done frame and Undo in History (RED-R3-5). |
| RED-R2-6 Cleanup counts | Mostly resolved | Menu counts agree ("3 senders", "101 emails", "3 unsubscribed"). "Skip inbox for future mail" still has no explanation (RED-R3-5). |
| RED-R2-7 three mail setup gates | Open | PH-Inbox: Connect Gmail, "Let the Inbox agent read your mail?", "Changes to mail are off" banner, and "Sending is off" in Compose (RED-R3-6). "Always allow" is now "Allowed without asking" with a read-only note, which is clearer. |
| RED-R2-8 mail list differs by board | Mostly resolved | Split now says "Today", puts chips on the third line and shows unread dots only on Today rows, like PH-Inbox. Remaining: Split has no To do card and no Earlier section (RED-R3-12). |
| RED-R2-9 bell, See all, search | Open | Bell and See all still both open Activity; no search result frame (RED-R3-7). |
| RED-R2-10 bot versus agent | Open | "Archived bots", "bots cannot reply", "account, bots, conversations" (RED-R3-8). |
| RED-R2-11 three identities | Open | Homes show "AM"; Settings and Account show "SR Sam Rivera"; Split footer shows "AM Alex Morgan" (RED-R3-9). |
| RED-R2-12 "page" means three things | Open, softened | The thread header icon is now named "Open the agent page" (PH-Thread names list). Home still has a Pages list (RED-R3-10). |
| RED-R2-13 chat menu destructive items | Open | PH-Thread: Archive chat, Clear chat, Delete chat; the Archive toast says "Inbox agent chat archived" while Settings lists "Archived bots" with Inbox agent in it (RED-R3-11). |
| RED-R2-14 Space settings has one field | Partly resolved | New space now has one route (the Home New menu); the title menu has Personal, Northwind, Side project, Space settings only. Space settings still holds only Name plus Delete (RED-R3-13). |
| RED-R2-15 creation forms | Carried | Not re-viewed (RED-R3-16). |
| RED-R2-16 Finance tiles and Runway summary | Carried | Not re-viewed (RED-R3-16). |
| RED-R2-17 Computer title and Team chip | Open | PH-Computer "In control" and "Agent waiting": chip "Team" above title "Team computer" (RED-R3-14). |
| RED-R2-18 model connect routes | Resolved with note | Home banner, thread "Not sent: No model connected. Connect" and Settings Models are shortcuts to one sheet. The sheet copy is wrong for Local server (RED-R3-15). |
| RED-R2-19 glass and tinted rules | Open | Several frames still have two prominent actions (RED-R3-17). |

## Open issues

### RED-R3-1 (Medium) Server is reachable from three places, and the inner Home lacks Team computer
Boards: `PG-B-Settings`, `PG-B-Account`, `PG-B-SignUp`, `Split`, `PG-A-Home`.
Problem (Seen): Server has a row in Settings ("Server, Default") and another in Account ("Server, Default"); the sign-in and sign-up screens add "Use a custom server". The Account notes say the row matches Settings, so two screens edit one value. Separately, Split's Pages lists Finance, Legal, Cap table, Data room, Artifacts but no Team computer, and its Personnel lists Finance agent and Legal agent but no Inbox agent or Mercury agent, while the phone Homes list Chief, Carta, Mercury, Inbox agent. A person who unfolds the Duo sees different agents and loses the computer entry.
Fix: keep Server only in Settings (and the pre-sign-in link). Use one agent list and one Pages list, including Team computer, on every Home layout.

### RED-R3-2 (Medium) An agent row leaves Personnel while it works
Boards: `PH-Home`, `PG-A-Home`.
Problem (Seen): Finance agent and Legal agent appear in Activity and are absent from Personnel in the same frame, and the "Pinned, group, unread" frame lists Finance agent in Personnel again. Someone looking for the Finance agent in Personnel will not find it while it works.
Fix: keep Personnel as the full list and let Activity show a copy of rows that need attention or are running, or state in the catalog that the row moves and draw it deliberately.

### RED-R3-3 (Medium) Four words for the same waiting state
Boards: `PG-A-Home`, `PH-Thread`, `PH-Inbox`, `PG-A-ThreadStates`.
Problem (Seen): Home Activity says "Needs you"; the thread approval card says "Needs approval"; the mail row for the same agent draft says "Draft ready"; another mail row says "Needs attention". The Finance payment in Activity ("Needs you") and a mail draft ("Needs approval" on the card, "Draft ready" on the row) are the same kind of event with three words.
Fix: use "Needs approval" for anything that blocks on the person's tap (Activity and the thread card) and keep "Draft ready" only as the mail row chip. Define or remove "Needs attention".

### RED-R3-4 (Medium) The Reply, Reply all, Forward choice is made twice
Boards: `PG-A-InboxMessage` (carried), `PG-A-Compose`.
Problem (Seen on Compose): the Compose title is a menu with Reply, Reply all, Forward. The message view already has the same menu on its reply button (carried). Changing type inside Compose also changes To, Subject and quoted text.
Fix: keep the choice on the message view only. Show a plain title in Compose.

### RED-R3-5 (Low) Cleanup keeps two Undo buttons and an unexplained menu item
Boards: `PG-A-Cleanup`.
Problem (Seen): the Done frame shows Undo and the History list shows Undo for the same run. "Skip inbox for future mail" is a separate bulk item with no line saying it applies to future mail only, and it sits in a menu that also holds nothing else.
Fix: keep Undo on Done for the immediate case and drop it from History rows after the person leaves, or keep only History. Move Skip inbox into the row detail or add one line of description.

### RED-R3-6 (Medium) Three prompts before the Inbox is fully usable
Boards: `PH-Inbox`, `PG-A-Compose`, `PG-B-Settings`.
Problem (Seen): "No mail account, Connect Gmail", then "Let the Inbox agent read your mail? Allow / Not now", then a "Changes to mail are off, Turn on" banner, repeated in Compose as "Sending is off for me@example.test, Turn on". After declining, a fourth banner "Inbox agent is off, Allow". That is connect, read consent, change consent and a decline recovery, with three different wordings.
Fix: ask one question after Connect Gmail that covers read and change ("reads your mail, asks before sending"). Show the Changes off banner once on Inbox only; Compose just disables Send with a short reason.

### RED-R3-7 (Low) Bell, See all and search have no distinct destination
Boards: `PH-Home`, `PG-A-Home`, `PG-A-Activity` (carried), `PH-Inbox`, `Split`.
Problem (Seen): the bell with a dot and "See all" both open Activity. Search appears on Home, in the Inbox toolbar and as "Search mail" on Split, but no board draws a search result.
Fix: keep one of bell or See all. Add one search result frame and label Inbox search by scope.

### RED-R3-8 (Low) "Bot" still appears in visible text
Boards: `PG-B-Settings`, `PG-B-Account`, `PG-B-Consent`.
Problem (Seen): Settings row "Archived bots" and its page; the AI data sharing line "Turn off and bots cannot reply"; the Account delete text "account, bots, conversations"; the Memory line "bots do not keep summaries". Everywhere else the word is "agent".
Fix: say "agent" in all visible text and rename the Archived page.

### RED-R3-9 (Medium) Two identities for the signed-in person
Boards: `PH-Home`, `PG-A-Home`, `Split`, `PG-B-Settings`, `PG-B-Account`, `PG-A-Compose`.
Problem (Seen): the Home avatar is "AM" on every Home and Split shows "AM Alex Morgan"; Settings and Account show "SR Sam Rivera" with sam@example.com; Compose sends from me@example.test. Split opens Settings from a gear; the phone Homes use the avatar.
Fix: use one sample person and one sample mailbox on every board, and make the avatar the Settings entry on Split too.

### RED-R3-10 (Medium) "Page" names a list on Home and an icon in the thread
Boards: `PH-Home`, `PG-A-Home`, `PH-Thread`, `Split`.
Problem (Seen): Home has a "PAGES" list (Finance, Legal, Cap table, Data room, Team computer, with Artifacts as a separate section on PG-A-Home and inside Pages on Split). The thread header has an icon that opens an agent page. Finance the page and Finance agent's page are different screens with the same word, and Artifacts is placed differently on two layouts.
Fix: pick one noun for the Home list ("Apps") or call the thread icon "Summary". Put Artifacts in its own section on every layout.

### RED-R3-11 (Low) The chat menu has three removal items, and Archive is ambiguous
Boards: `PH-Thread`, `PG-A-Thread`, `PH-GroupThread` (carried), `PG-B-Settings`.
Problem (Seen): Archive chat, Clear chat and Delete chat. The Archive toast says "Inbox agent chat archived. Find it in Archived", but Settings lists "Archived bots" holding Inbox agent. A person cannot tell whether the chat or the agent was archived. Clear and Delete both remove messages.
Fix: remove Clear chat, or explain it; name the archive target the same in the toast and in Settings.

### RED-R3-12 (Low) Split Inbox lacks the To do card and the Earlier section
Boards: `Split`, `PH-Inbox`.
Problem (Seen): PH-Inbox has a To do card and an Earlier section; Split Inbox has neither, though the same data exists. Split's Needs reply rows now match the phone rows.
Fix: add the To do card and Earlier section to Split, or say in the catalog that the inner display omits them on purpose.

### RED-R3-13 (Low) Space settings is a page for one field, and Home puts Inbox in two places
Boards: `PG-B-Spaces`, `PH-Spaces`, `PG-A-Home`.
Problem (Seen): Space settings holds only Name and, for non-primary spaces, Delete space, with a Save button. Separately, the Inbox row sits below Activity on the main Home but at the top when there is no Activity (Pinned, Could not load, Empty space frames), so the row changes place.
Fix: rename or delete from the switcher row and add Space settings only when it holds another setting. Always place Inbox directly above Personnel.

### RED-R3-14 (Medium) The computer page says Team twice and gives two routes into control
Boards: `PH-Computer`, `PG-A-ThreadStates`, `PG-A-Computer` (not re-viewed).
Problem (Seen): in "In control" and "Agent waiting" a "Team" chip sits above the title "Team computer", then the status pill ("You are driving", "Finance agent is waiting for you") and, for waiting, a banner repeat the state. In the thread, the inline "Computer block" has its own "Take control" button, so control can start from the thread or the computer page.
Fix: drop the chip or the title word; fold the banner into the pill. Have the inline thread block open the computer page instead of taking control.

### RED-R3-15 (Low) Model sheet copy is wrong for Local server and Subscription
Boards: `PG-A-HomeNoModel`, `PG-A-ThreadStates`, `PG-B-Consent`.
Problem (Seen): the sheet's sentence "Connecting sends your messages and attachments to Model A to run your agents" stays unchanged when Local server is selected (data goes to a machine on the network) and when Subscription is chosen. The same disclosure also appears as the Model A toggle in AI data sharing, the "Model A sharing is off" banner on Home and the same banner above the thread composer.
Fix: vary the sentence by provider, and keep the sharing-off banner in one place (Home) with the thread showing only the composer disabled.

### RED-R3-16 (Low) Carried: creation forms, Finance numbers, group sample name
Boards: `PG-B-NewBot`, `PG-B-NewGroup`, `PG-B-NewSpace`, `PG-B-BotSettings`, `PG-B-Finance`, `PG-A-AgentPage`, `PG-A-Artifact`, `Desk`, `PG-A-Home`.
Problem (carried, not re-viewed): New agent and New space are sheets while New group is a page; Title and Description overlap on an agent; Finance tiles use different label sets across boards; "Runway summary" is both an agent page and an artifact. New and Seen: `PG-A-Home` names a group "Launch team" while the group thread boards use "Funding room".
Fix: make New group a sheet; keep one of Title and Description; use one tile component; use one group sample name.

### RED-R3-17 (Medium) Two tinted or prominent actions in several frames
Boards: `PG-A-HomeNoModel`, `PH-Inbox`, `PH-Computer`, `PG-A-Cleanup`.
Problem (Seen): "After connecting" shows "Message Chief" and the New button both prominent. Inbox "Mail changes off" shows a prominent "Turn on" and the lit compose button. Computer frames show a glass segmented control, glass full-screen button, key row and bottom pill together with a prominent Take control. Cleanup shows Archive (prominent) and Unsubscribe as large equal pills. README allows one tinted action and three glass groups per view.
Fix: draw one prominent action per frame (hide New while the connected banner shows; demote the compose highlight while a banner is open; make Unsubscribe secondary). Add to the README what counts as a glass group.

### RED-R3-18 (Low) Cleanup entry differs by display
Boards: `PG-A-Cleanup`, `PH-Inbox`, `Split`.
Problem (Seen): PG-A-Cleanup's first frame shows Cleanup as its own button in the side strip; the PH-Inbox note and `Split` say Cleanup is inside the "..." menu. Same feature, two entry points by layout.
Fix: use the More menu on every layout, or promote it everywhere.

### RED-R3-19 (Low) Preferences hide under Account
Boards: `PG-B-Account`, `PG-B-Settings`.
Problem (Seen): Account holds Hide amounts, Language and Appearance next to Change password, Server and Sign out. Settings holds Models, Voice, Integrations, AI data sharing, Server, Archived bots. A person looking for Appearance opens Settings and does not find it.
Fix: move Hide amounts, Language and Appearance to Settings; keep Account for identity, password and sign out.

## Counts

Round 2 items re-checked: 19. Resolved: 1 (R2-18, with a copy note). Mostly or partly resolved: 6 (R2-1, R2-5, R2-6, R2-8, R2-12, R2-14). Open: 10 (R2-2, R2-3, R2-4, R2-7, R2-9, R2-10, R2-11, R2-13, R2-17, R2-19). Carried: 2 (R2-15, R2-16). Open issues this round: 19 (RED-R3-1 to RED-R3-19) (9 Medium, 10 Low).

Medium issues: RED-R3-1, 2, 3, 4, 6, 9, 10, 14, 17. Low issues: RED-R3-5, 7, 8, 11, 12, 13, 15, 16, 18, 19.
