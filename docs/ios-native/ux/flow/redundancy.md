# Redundancy critique, round 1: planned native iOS app

Scope: the earlier critique (items D, I, F, H, C) re-checked against the current boards in `docs/design-system/ios/boards/`, plus the boards added or edited in the gap-fix pass (PH-Home, PH-Thread, PH-Inbox, PH-Computer, PH-Spaces, PG-A-HomeNoModel, PG-B-Spaces, PG-A-ThreadStates, PG-B-Consent, PG-B-SignUp, PG-B-ForgotPassword, PG-B-Account, PG-A-Compose, PG-A-Cleanup, and the Pages and space-title edits to PG-A-Home). Each cited board was viewed as a screenshot; strings were also read from the board HTML. Boards are static mockups, so a journey step is judged against the board that draws it. All findings are about planned design, not shipped behavior. Boards are cited by file stem, e.g. `PG-A-Home` = `docs/design-system/ios/boards/PG-A-Home.dc.html`.

Evidence grades: **Seen** = visible in a viewed screenshot. **Spec** = board text or catalog. Row heights were not re-measured this round.

Verdict: the gap-fix pass closed the biggest structural gaps (product name, mail-card buttons, outer-display route to pages, no-model state). The new boards introduced a second Home layout and a few new duplicates. Verdict per journey: acceptable, with Home and the mail journey convoluted across boards.

## Earlier items: status

| Earlier id | Status | Note |
| --- | --- | --- |
| D1 Inbox agent route | Open | `PG-A-Home` and `PH-Home` still have no Inbox agent row in Personnel; the agent shows only as an Activity row while it has work (Seen). Now also see RED-R1-8. |
| D2 bell and "See all" | Open | `PG-A-Home` still has both the bell (with dot) and "See all" (Seen). `PH-Home` has no bell, only "See all". |
| D3 outer route to Finance/Legal/Cap table/Data room | Resolved on Home | `PG-A-Home` and `PH-Home` now draw a PAGES section. `Main` still has none (RED-R1-1). |
| D4 "Connect apps" vs "Integrations" | Open | `Split` sidebar footer still says "Connect apps"; `PG-B-Settings` says "Integrations". |
| D5 fix a missing model | Resolved | `PG-A-HomeNoModel` draws the banner, the sheet and the after state. The sheet repeats the provider list of `PG-B-Models`; acceptable as a shortcut. |
| D6 NewBot sheet vs NewGroup page | Open | Boards unchanged (`PG-B-NewBot` sheet, `PG-B-NewGroup` pushed page). |
| I1 runway and cash in five renderers | Open | Finance boards unchanged. |
| I2 "Runway summary" page vs artifact | Open | Unchanged. |
| I3 two deadlines | Open, worse | Now shown twice on one screen on `PG-A-Home` (RED-R1-3). |
| I4 agent name three times on thread | Open | Also repeated on `PG-A-ThreadStates` and `PH-Thread`. |
| I5 artifact title twice | Open | `PG-A-Artifact` unchanged. |
| I6 inbox counts | Open, new variant | RED-R1-5. |
| I7 double unread dot | Open | `Sheet` still draws a dot before the sender and another before the preview (Seen). |
| I8 Title and Description of a bot | Open | `PG-B-NewBot` and `PG-B-BotSettings` still have both fields. |
| I9 initials AB vs SR | Open | Home shows "AB"; Settings and Account show "SR / Sam Rivera" (Seen). |
| F1 domain page vs domain agent | Open, worse | `PG-A-Home` now lists Finance (page), Finance agent in Activity, and Finance agent in Personnel on one screen. |
| F2 page / list / artifact / file | Open | Unchanged. |
| F3, C1 approval card vocabulary | Resolved | `PG-A-Thread`, `PH-Thread` and `Inner` all show "Re: Pilot timeline", "Needs approval", Save, Send. |
| F4 search | Open | `Split` still shows two search fields; `PG-A-Home` search still has no result board. |
| F5 voice global vs per bot | Open | Unchanged. |
| F6 inbox triage controls | Open, worse | `PG-A-Cleanup` adds a fourth mechanism (RED-R1-8). |
| H1 Rakazo vs Praci | Resolved | No "Rakazo" string remains in any board; sign-in, sign-up, server, sign-out and DS boards say "Praci". |
| H2 agent vs bot | Open | Rows say "agent"; actions say "New bot", "Create a bot" (`PG-A-HomeNoModel`), "Bot settings". |
| H3 Personnel | Accepted | Only a section label. |
| H4 integrations naming | Open | Same as D4. |
| H5 title treatment | Accepted | Deliberate. |
| H6 settings burial and thin Account | Partly resolved | `PG-B-Account` now exists. It creates a new duplicate (RED-R1-6). |
| H7 frequent destinations outer route | Resolved on Home | See D3. |
| H8 group name Funding room vs Operations | Open | Boards unchanged. |
| C2 bot identity | Open | Unchanged; the Inbox agent still has different shapes and colors on `PG-B-GroupSettings` and `PG-B-NewGroup` than on Home. |
| C3 Home differs by board | Open, worse | RED-R1-1. |
| C4 mail row, C5 eye icon | Open | RED-R1-9. |
| C6 metric tiles, C7 status styles, C8 row heights, C9 close controls, C11 glass count, C12 two prominent actions | Open | No board in these families changed. |

## Open issues

### RED-R1-1 (High) Home is drawn four different ways
Boards: `PH-Home`, `PG-A-Home`, `PG-B-Spaces`, `Main`, `Split`.
Problem (Seen): section order differs. `PH-Home` goes Inbox, PAGES, ACTIVITY, PERSONNEL. `PG-A-Home` and `PG-B-Spaces` go Inbox, ACTIVITY, PAGES, PERSONNEL. `PH-Home` lists five pages including Artifacts; `PG-A-Home` lists four and moves Artifacts to the side capsule icon. `Main` is the old Home: no Activity, no Pages, adds Brex agent. `Split` has no Activity section and no space title. The README promises the same features on every display. A person with both a phone and a Duo meets two layouts for one screen.
Fix: pick one order (Activity first, because it holds what needs me now) and one Pages list; update `PH-Home`, `Main` and `Split`. Put Artifacts in one place only (capsule or Pages row).

### RED-R1-2 (Medium) The current space has three names
Boards: `PH-Home`, `PH-Spaces`, `PG-A-Home`, `PG-B-Spaces`, `Split`.
Problem (Seen): `PH-Home` is titled "Northwind"; `PH-Spaces` (the same screen with the menu open) is titled "Personal" with Personal ticked; `PG-A-Home` and `PG-B-Spaces` say "Personal". `Split` shows no space title and no way to switch space, so the inner display cannot reach New space or Space settings. Space settings contains only Name and Delete space, so the second entry in the menu is thin.
Fix: use one space name in all Home samples and draw the switcher on `Split`. Optional: fold rename and delete into the menu's long press and keep Space settings only if it will hold more than a name.

### RED-R1-3 (Medium) Legal deadlines and Finance appear several times on one Home screen
Boards: `PG-A-Home`, `PH-Home`.
Problem (Seen): Legal page row badge "2" and the Legal agent row "2 deadlines due this week" sit on the same screen. Finance appears as the Finance page ("[N] mo"), the Finance agent in Activity ("Reading card expenses"), and the Finance agent in Personnel ("Runway summary for the last 30 days"). Inbox agent appears in Activity and, per RED-R1-8, nowhere else.
Fix: show a count only on the page row, and let agent rows show the agent's last message. Activity rows should be the only place an agent's live work shows; Personnel keeps last message and time.

### RED-R1-4 (Medium) Two data prompts after connecting a model
Boards: `PG-A-HomeNoModel`, `PG-B-Consent`.
Problem (Spec, Seen): a new person taps "Connect a model", chooses a provider and enters a key, then later hits "Share data with Model A?" on first use. The second prompt asks the same consent the person gave by connecting. Sequence: connect, send, allow. Settings also has AI data sharing with a switch for Model, Speech and Memory, while Models and Voice each hold their own connect and disconnect rows (three places per provider).
Fix: state the data use under the Connect button on the sheet, treat Connect as consent, and keep AI data sharing as the place to withdraw it. Ask a separate prompt only for Speech and Memory when first used.

### RED-R1-5 (Medium) Inbox counts disagree and are unlabeled
Boards: `PG-A-Home`, `PH-Home`, `PH-Inbox`, `Sheet`, `Split`.
Problem (Seen): Home row shows "3 need reply" and an unlabeled "42". `PH-Inbox` section is "Today 24"; `Sheet` and `Split` call the same section "Other mail today 24". 3 + 24 does not give 42, and nothing says what 42 counts.
Fix: label or drop 42 (unread count is the usual meaning; say so with the standard badge). Use one section name on all three inbox boards.

### RED-R1-6 (Medium) Change password and Account overlap
Boards: `PG-B-Settings`, `PG-B-Account`.
Problem (Seen): the new Account page has Change password, and Settings still lists Change password as its own row below Archived bots. One task, two routes, no stated canonical one. Sign out and Delete account live only on Account, which is good, so the Settings row adds nothing. Sign out also has a confirmation (`PG-B-Account`) on a reversible action.
Fix: remove Change password from Settings. Replace the sign-out confirmation with an immediate sign-out (the person can sign back in); keep the password prompt on Delete account.

### RED-R1-7 (Medium) Standard iPhone inbox has no route to the Inbox agent
Boards: `PH-Inbox`, `Sheet`, `Split`, `PG-A-InboxMessage`, `PG-A-Cleanup`.
Problem (Seen): on `Sheet`, `Split` and `PG-A-InboxMessage` the prominent bottom-left action is a chat button that opens the Inbox agent. On `PH-Inbox` that button is absent and the prominent tinted action is Compose (top right). So the same screen has a different main action by size, and the phone has no way to reach the Inbox agent from the Inbox. The Home Inbox row is the only route, and Personnel has no Inbox agent row (D1).
Fix: make the main Inbox action the same on every size (chat with the agent, compose in the toolbar) and add the chat button to `PH-Inbox`.

### RED-R1-8 (Medium) Four ways to triage mail, and two filtering words
Boards: `PH-Inbox`, `Sheet`, `Split`, `PG-A-Cleanup`, `PG-A-InboxMessage`.
Problem (Seen): archive by swipe (`PH-Inbox`), archive in the message capsule (`PG-A-InboxMessage`), bulk Cleanup by sender (`PG-A-Cleanup`, More menu), and the filter plus Important-only star plus row chips (`Split`, `PH-Inbox`). Cleanup's menu offers Archive, Skip inbox and Spam; Archive and Skip inbox both remove mail from the Inbox view and the difference is not visible. "Archive 3" counts senders while the result says "101 conversations archived", so the number on the button and the number in the result differ. Cleanup exists only on the outer display More menu; `PH-Inbox` has no More menu.
Fix: say in the menu what Skip inbox does ("Future mail skips Inbox") or drop it from the first menu; make the button count the senders and say "3 senders" in the label; add Cleanup to `PH-Inbox` (a More menu or the filter menu).

### RED-R1-9 (Medium) The mail row is drawn four ways
Boards: `PH-Inbox`, `Sheet`, `Inner`, `Split`, `DS-05-Lists`.
Problem (Seen): `PH-Inbox` puts sender and time first, then subject and preview on one line, and a status chip on a third line; `Sheet` uses three lines (sender, subject, preview) with two unread dots and no chips; `Split` puts the chip at the right of the row; `DS-05` specifies two lines. The eye "Hide amounts" control exists only on `Split`. The unread dot sits left of the sender on `PH-Inbox`, `Sheet` and `Split`, but `Sheet` adds a second dot before the preview.
Fix: one row anatomy from DS-05, one chip position, one dot; keep the eye only on pages that show amounts (Finance, Desk).

### RED-R1-10 (Medium) Two ways to reply, with different vocabularies
Boards: `PG-A-InboxMessage`, `PG-A-Compose`, `PG-A-Thread`, `PH-Thread`.
Problem (Seen): the message capsule has Archive and Reply (opens `PG-A-Compose`, title menu Reply / Reply all / Forward) and the prominent button opens the agent, whose draft card has Save and Send. The two reply paths use different end actions: Compose has an up-arrow send and an X that is not drawn as "save draft", the agent card has Save. It is not stated whether Save on the card and a draft left in Compose end up in the same Drafts. The "Reply" title is also the only title with a menu that changes the message type; Forward and Reply all are hidden behind it.
Fix: say in the catalog that Compose X keeps a draft (or draw a "Discard / Save draft" choice) and that the agent card's Save writes the same draft. Keep Reply for manual, chat for agent; do not add a third.

### RED-R1-11 (Medium) Inbox agent still has no Personnel row
Boards: `PG-A-Home`, `PH-Home`, `Main`, `Split`, `PG-B-GroupSettings`.
Problem (Seen): the Inbox agent appears in Activity only while it has work, in group member lists, and behind the Inbox chat button. There is no Personnel row, yet every other agent has one, and the person cannot open the thread from Home when nothing is pending.
Fix: either add the Inbox agent to Personnel and let the Inbox row be the mail view only, or state in the catalog that it is reached only from Inbox and remove it from group member pickers' default list.

### RED-R1-12 (Low) Bell and "See all", and search without a destination
Boards: `PG-A-Home`, `PH-Home`, `Split`.
Problem (Seen): `PG-A-Home` has a bell with a dot and "See all" for the same Activity list; `PH-Home` has only "See all" and a search button, so the two Home boards do not carry the same controls. Global search (Home, `Split` sidebar) has no result board, and `Split` shows two search fields on one screen (sidebar search and "Search mail").
Fix: make the bell and "See all" open the same list and say so, or drop the bell; draw one search overlay and give inbox-local search a different label only if its scope is shown.

### RED-R1-13 (Low) "Connect apps" vs "Integrations"; "bot" vs "agent"
Boards: `Split`, `PG-B-Settings`, `PG-B-Integrations`, `PG-A-HomeNoModel`, `PG-B-NewBot`, `PG-B-BotSettings`, `PG-B-GroupSettings`.
Problem (Seen): one destination has two names; one object has two names ("Inbox agent" in rows, "Create a bot", "New bot", "Bot settings", "3 of 4 bots can post").
Fix: use "Integrations" and "agent" everywhere visible; rename "New bot" to "New agent".

### RED-R1-14 (Low) Creation forms and bot fields
Boards: `PG-B-NewBot`, `PG-B-NewGroup`, `PG-B-NewSpace`, `PG-B-BotSettings`, `PG-B-GroupSettings`, `PG-A-GroupThread`.
Problem (Seen): New bot and New space are sheets, New group is a pushed page; Title and Description both exist on a bot with near-identical placeholders; the group thread is "Funding room" while its settings and the New group board show "Operations". New space is reachable from the Home New menu (catalog) and from the title menu (`PG-B-Spaces`).
Fix: make New group a sheet; keep one of Title and Description; use one group name in samples; pick one entry point for New space (the title menu).

### RED-R1-15 (Low) Finance numbers and the Runway summary
Boards: `PG-B-Finance`, `PG-A-AgentPage`, `PG-A-Artifact`, `Desk`, `PG-A-Artifacts`.
Problem: unchanged from I1, I2, I5, C6. Tiles use three label sets, the chart is "Monthly burn" in one place and "Monthly spend" in another, "Runway summary" is both an agent page and an artifact, and the artifact title appears in the pill and again as the card heading.
Fix: one tile component and label set; decide whether the agent page is the latest artifact; drop one of the two titles on `PG-A-Artifact`.

### RED-R1-16 (Low) Identity, status and glass rules still inconsistent
Boards: `PG-B-GroupSettings`, `PG-B-NewGroup`, `PG-B-BotSettings`, `PG-A-Home`, `PG-A-Thread`, `PG-A-Computer`.
Problem: unchanged from C2, C7, C11, C12. The Inbox agent has a different shape and color on group boards than on Home; status uses dots, colored words and pills; `PG-A-Thread` and `PG-A-Computer` draw more glass objects than the README's three-group limit if pills and composers count; a pending approval and the composer send both look prominent.
Fix: use the shipped avatar for every board, one status component, a README line saying whether title pills and composers are counted as glass groups, and a rule that the card's Send is the only tinted action while a card awaits approval.

## Counts

Earlier items re-checked: 38. Resolved: 6 (D3, D5, F3/C1, H1, H7, and the missing-board gaps for Account, Compose, consent, offline, no-model). Open and carried: the rest. New open issues in this round: 16 (RED-R1-1 to RED-R1-16; 8 of them cover earlier items that got worse or changed shape).

## Unverified

Row heights and radii were not re-measured. `DS-06` approval text, `PG-B-Legal`, `PG-B-CapTable`, `PG-B-DataRoom`, `PH-Computer` and `PG-A-Computer` were not re-read this round; their earlier findings are carried only where the board files were not edited in the gap-fix pass.
