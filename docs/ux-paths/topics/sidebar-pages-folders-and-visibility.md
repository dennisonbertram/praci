# Topic: sidebar-pages-folders-and-visibility

Scope: the web/desktop sidebar below the search box. The PAGES group (collapse, "Page options", glance values and dots), the "Personal" heading, folders (New folder, rename, delete, collapse), drag and drop with pointer and keyboard, "Auto-group" with Undo, and the icon rail. Code read: `components/SidebarPagesGroup.tsx`, `SidebarPageLink.tsx`, `sidebar-glance.tsx`, `sidebar-folders/*`, `pages/shell/space-sidebar.ts`, `pages/BotContextMenu.tsx`, `pages/Shell.tsx` (page rows ~3950-4095, folder callbacks ~1775-1935, space menu ~5830-5870, undo notice ~6010), `lib/use-sidebar-glance.ts`, `packages/db/src/sidebar-folders.ts`. Nothing here was walked in a browser.

Facts the stories rely on:
- The group header is the word "Pages" (shown in capitals by CSS). Its collapsed state is kept in the browser (localStorage key per user), not on the server. Hidden pages (`hiddenPages`) are saved on the server through `preferences.update`, so they follow Maya to another device.
- Page rows in order: Inbox, Finance, Legal, Cap table, Contacts, Data room, Artifacts. Only Inbox (unread count), Finance (runway such as "24 mo"), Legal (due-soon count) and Data room (waiting count) can show a value. Cap table and Artifacts show only the unseen dot. Contacts has neither.
- Mouse drag starts after the pointer moves 6 px; touch drag needs a 250 ms hold; keyboard uses Space to pick up and drop, arrows to move, Escape to cancel.
- "Auto-group" files only unfiled, unpinned chats into folders named Workspace, Apps, Agents and Groups. It reuses a folder with the same name. The Undo notice lives in memory for 8 seconds.

## STORY-APP-320: Maya collapses the Pages group and learns what stays visible
**Type**: short
**Topic**: sidebar-pages-folders-and-visibility
**Persona**: Maya, first-time founder of Northwind Robotics, a few days into using Praci, one personal space, Gmail connected
**Goal**: Get the seven page rows out of the way so her chats sit near the top of the sidebar.
**Preconditions**: Signed in on the web, sidebar expanded, Inbox has unread mail, no other unseen notifications.
**Ideal path**: 1 — one click on the "Collapse Pages" header button.
**Alternate paths**: Hide individual pages through "Page options" (STORY-APP-321) removes them permanently instead of folding them. Collapsing the whole sidebar to the icon rail (STORY-APP-122) ignores this setting.
### Steps
1. Look at the sidebar. The small grey word PAGES has a chevron on its right and a "..." button next to it. Maya wonders if PAGES is a title or a button → it is a button; its accessible name is "Collapse Pages", and `aria-expanded` is true.
2. Click PAGES → the chevron turns to point sideways (name becomes "Expand Pages"). Rows disappear except the one for the page she is on, and any row with an unseen notification dot.
3. Maya notices Inbox is still there even though she did not open it. She reads the right side of the row: a small filled dot, not a number → Inbox has an unseen notification, so the row stays visible.
4. Click Inbox → the Inbox page opens; the dot clears after the page has been viewed with the tab focused, and (if she navigates away) Inbox hides again.
5. Click PAGES again → all seven rows return.
### Variations
- Reload the page while collapsed → it stays collapsed (browser storage). Open Praci in another browser → expanded there, because the setting is not saved on the server (UNVERIFIED across desktop versus browser, but the key is localStorage).
- With Inbox unread but no unseen notification, the row hides when collapsed. The unread number is not shown while collapsed, so the count is lost until she expands.
### Edge Cases
- The "Add page" row never shows while collapsed (and has no templates available today).
- On a phone the sidebar is a drawer; the group header behaves the same way inside the drawer.
- Maya hesitates because the collapsed group hides the count she cares about; there is no collapsed summary.

## STORY-APP-321: Hiding Contacts from the sidebar with Page options
**Type**: short
**Topic**: sidebar-pages-folders-and-visibility
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Remove a page she will not use yet (Contacts) from the sidebar.
**Preconditions**: Signed in, Pages group expanded, all seven rows visible.
**Ideal path**: 2 — open "Page options", uncheck Contacts.
**Alternate paths**: none found for hiding; Cmd/Ctrl+K and the sidebar search still reach the page.
### Steps
1. Click the "..." button on the right of the PAGES header (name "Page options") → a menu opens with seven checkboxes: Inbox, Finance, Legal, Cap table, Contacts, Data room, Artifacts, all checked.
2. Click "Contacts" to uncheck it → the Contacts row disappears from the sidebar at once (the change is applied first, then saved).
3. Maya presses Escape and the menu closes. She wonders whether the page is deleted → nothing is deleted; reopening "Page options" shows Contacts unchecked, and checking it brings the row back.
### Variations
- Uncheck several pages in a row: the menu stays open after each click or closes (UNVERIFIED which; the item is a checkbox item).
- If the save fails (network drop), the row reappears with no message; the failed save rolls back silently.
- Sign in on the desktop app: the same pages are hidden, because `hiddenPages` is stored on the server.
### Edge Cases
- Hiding the page she is currently on removes the row but leaves her on that page.
- Hiding Inbox or Finance drops the matching step from the first-run tour if she restarts it with "Take the tour" (the tour drops steps with no anchor on screen).
- Hide every page: the group header and "..." stay, rows are all gone.

## STORY-APP-322: A hidden page is still reachable by search, and Legal is missing from the search list
**Type**: medium
**Topic**: sidebar-pages-folders-and-visibility
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Open Cap table after hiding it, and find Legal by typing its name.
**Preconditions**: Cap table hidden through "Page options" (STORY-APP-321 steps repeated for Cap table); Legal row visible.
**Ideal path**: 4 — type in Search, click the Pages result.
**Alternate paths**: Cmd/Ctrl+K command palette, "Go to" > Pages group; re-check Cap table in "Page options".
### Steps
1. Click the Search box and type "cap" → the sidebar switches to search results; the PAGES group is replaced by a results list (when the query is not empty the page group is not drawn).
2. Look at the "Pages" results → "Cap table" appears even though its sidebar row is hidden. Maya thinks "I hid it, why is it here?" → search lists every page, not only visible ones.
3. Click "Cap table" → the search clears and `/app/cap-table` opens. The sidebar row stays hidden (the current-page highlight has no row to show).
4. Clear search, then type "legal" → results show chats and files that match, and no "Legal" entry under Pages. Maya is confused because Legal is in the sidebar → the page list used by search and the palette (`appPages` in `Shell.tsx`) holds Inbox, Finance, Cap table, Contacts, Data room, Integrations, Artifacts and Settings but not Legal. This is a code observation; it was not checked in a browser.
5. Press Cmd/Ctrl+K and type "legal" → the same list feeds the palette's Pages group, so the same gap is expected (UNVERIFIED).
6. Click the Legal row in the sidebar instead → Legal opens.
### Variations
- Type "equity" or "shares" → Cap table appears, because it carries extra keywords ("equity, ownership, shares, options, Carta").
- Type "Settings" → opens the Settings dialog rather than a page route.
### Edge Cases
- If Legal is hidden through "Page options", there is then no sidebar path to it other than a direct URL or an agent link.
- The same facts appear on three surfaces (sidebar rows, sidebar search, command palette) with different page lists.

## STORY-APP-323: Creating a folder and naming it inline
**Type**: short
**Topic**: sidebar-pages-folders-and-visibility
**Persona**: Maya, first-time founder of Northwind Robotics, with the Chief, Inbox and Finance agents plus one custom bot
**Goal**: Make a folder called "Fundraising".
**Preconditions**: One space, sidebar expanded, the heading reads "Personal".
**Ideal path**: 3 — open the heading menu, choose New folder, type the name and press Enter.
**Alternate paths**: Right-click a chat > "Move to" > "New folder" opens a dialog titled "New folder" that creates the folder and moves that chat into it. Right-click the "Personal" heading to open the same menu as the "..." button.
### Steps
1. Hover the "Personal" heading and click the "..." button with the name "Actions for Personal" → a menu named "Actions for space" opens with "New folder" and "Auto-group" (no "Rename space" or "Delete space" for the personal space).
2. Click "New folder" → a folder row named "Untitled folder" appears with a text field already focused and its text selected.
3. Type "Fundraising" and press Enter → the field closes; the row shows "Fundraising" with a count of 0 on the right.
4. Maya sees an empty folder and wonders what to do next → nothing explains it; she must drag a chat onto it (STORY-APP-325) or use "Move to".
### Variations
- Create a second folder without renaming: it is called "Untitled folder 2".
- Click away instead of pressing Enter: leaving the field also saves. Pressing Escape keeps the folder as "Untitled folder".
- Right-click a chat > "Move to" > "New folder": the dialog says "Create a folder and move {bot name} into it." with a Name field, Cancel and Create buttons.
### Edge Cases
- Blank text or the unchanged name just closes the field.
- Names are limited to 60 characters in both the inline field and the dialog.
- In the dialog, a duplicate name shows the server message under the field (the server says "Section name already used"; how it appears to Maya is UNVERIFIED). The inline path never produces a duplicate on create because it numbers the name.
- The words "folder" (sidebar) and "section" (server) differ; the user only sees "folder".

## STORY-APP-324: Renaming a folder to a name that already exists
**Type**: short
**Topic**: sidebar-pages-folders-and-visibility
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Rename "Untitled folder 2" to "Fundraising" when "Fundraising" is already a folder.
**Preconditions**: Folders "Fundraising" and "Untitled folder 2" exist.
**Ideal path**: 3 — hover the folder, open "Actions for Untitled folder 2", choose Rename, type the name.
**Alternate paths**: Right-click a chat inside the folder > "Move to" > "Rename" opens a "Rename" dialog (shows only when the chat is in a folder).
### Steps
1. Hover the folder row and click the "..." button named "Actions for Untitled folder 2" → menu with "Rename" and "Delete folder".
2. Click "Rename" → the name becomes an input with text selected.
3. Type "Fundraising" and press Enter → the row first shows "Fundraising", then returns to "Untitled folder 2" a moment later, with no message. Maya wonders whether it saved → the server refused the duplicate and the inline path rolls back silently.
4. Repeat through "Move to" > "Rename" → the dialog stays open and shows the server's error text under the field ("Could not rename folder" is the fallback). This difference between the two paths is a code observation.
### Variations
- The "..." button is hidden on touch screens (`pointer-coarse:hidden`), so a phone-width browser uses "Move to" > "Rename" from a chat's menu, or a long press.
- Folders in another space are read-only: no menu, no drag.
### Edge Cases
- Escape during rename leaves the old name.
- Leading or trailing spaces are trimmed.

## STORY-APP-325: Dragging chats into a folder with the mouse
**Type**: medium
**Topic**: sidebar-pages-folders-and-visibility
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Put the Inbox agent and Finance agent in a folder called "Workspace" and order folders.
**Preconditions**: A folder "Workspace" exists and is expanded; Maya has more than six chats.
**Ideal path**: 4 — drag each chat onto the folder header.
**Alternate paths**: Right-click chat > "Move to" > folder name (shows a check mark beside the current folder, and "Unassigned" for none); Auto-group (STORY-APP-327).
### Steps
1. Press on the Inbox agent row and move the pointer a few pixels → the row dims (40 percent) and a floating copy of the avatar and name follows the pointer. A plain click would have opened the chat, which is why the drag needs a small move first.
2. Move over the "Workspace" header → the header gets a ring and a tinted background ("drop into").
3. Release → the Inbox agent appears under Workspace, indented, and the header count goes from 0 to 1.
4. Drag the Finance agent to sit above the Inbox agent inside the folder → a line shows above the row it will land before; after release the order changes.
5. Drag the "Workspace" header itself above another folder → a line appears above the target folder; folders only reorder among folders.
6. Maya refreshes → the arrangement persists (stored on the server).
### Variations
- Drop a chat on the empty strip after the last row → it moves to the end of the unfiled list (the strip is called `root-end`; the screen-reader name is "Personal").
- Pinned chats (under a "Pinned" heading, set via right-click > "Pin") cannot be dragged.
- Searching disables dragging.
- Drop the pointer outside the list → nothing changes.
### Edge Cases
- If the server refuses the move, the list snaps back to what the server has, with no message.
- Chats from another space cannot be dragged.
- A child agent (nested under a parent bot) stays with its parent in Auto-group but can be moved on its own.
- Same information in three places: the folder count, the chat's own row position, and the "Move to" check mark.

## STORY-APP-326: Moving a chat into a folder with the keyboard only
**Type**: medium
**Topic**: sidebar-pages-folders-and-visibility
**Persona**: A solo technical founder at Northwind Robotics who uses a screen reader and the keyboard
**Goal**: Move the "Legal agent" chat into the folder "Workspace" without the mouse.
**Preconditions**: Folder "Workspace" exists; focus is on the chat row.
**Ideal path**: 5 — Space, arrows to the folder, Space.
**Alternate paths**: Context menu key on the chat > "Move to" > "Workspace".
### Steps
1. Tab to the "Legal agent" row → focus ring shows. Instruction text for assistive tech reads: "To pick up, press space. Use the arrow keys to move, space to drop, escape to cancel."
2. Press Space → live region says "Picked up Legal agent."
3. Press Down Arrow a few times → each step says "Legal agent is over {target}." until it reaches "Workspace".
4. Press Space → "Legal agent dropped on Workspace." The chat now appears under the folder.
5. Pick up again, then press Escape → "Move of Legal agent cancelled." Nothing moves.
### Variations
- Drop on itself or on its own place: "Legal agent dropped." with no change.
- Pick up a folder header and move it over other folders (folders only see folder targets).
### Edge Cases
- Pressing Space on the row when not dragging also activates a click on some controls; the row is a button (UNVERIFIED which key wins; dnd-kit handles Space for pick up).
- A folder header toggles on click and is also a drag handle; Enter toggles it.

## STORY-APP-327: Auto-group files everything, then Maya undoes it
**Type**: medium
**Topic**: sidebar-pages-folders-and-visibility
**Persona**: Maya, first-time founder of Northwind Robotics, with eleven unfiled chats and no folders
**Goal**: Let Praci tidy the list, check the result, and go back if it is wrong.
**Preconditions**: One pinned chat (Chief), ten unfiled chats: Inbox agent, Finance agent, Legal agent, Data room agent, Mercury agent, Brex agent, two custom bots ("Recruiting helper", "Board deck writer"), one group "Founders".
**Ideal path**: 3 — open the heading menu, click "Auto-group", read the result.
**Alternate paths**: Do the same by hand (stories 04 and 06), which takes many more steps.
### Steps
1. Click "..." beside "Personal" ("Actions for Personal") → menu: "New folder", "Auto-group".
2. Click "Auto-group" → the list reorganises into folders "Workspace" (Inbox, Finance, Legal, Data room), "Apps" (Mercury, Brex), "Agents" (Recruiting helper, Board deck writer) and "Groups" (Founders). Chief stays under "Pinned". A dark pill at the bottom reads "Auto-grouped" with an "Undo" button.
3. Maya has about 8 seconds. She reads the folders and wonders where Elio or her own bots went → custom bots are all under "Agents".
4. She does not like it and clicks "Undo" → the chats return to their old places and the folders Auto-group created disappear (only those that are empty again).
5. She opens the menu again and runs Auto-group a second time → same result, and she lets the notice expire; after 8 seconds the pill disappears with no way back except moving chats by hand.
### Variations
- Run Auto-group when everything is already filed → nothing changes and no "Auto-grouped" notice appears (only shown when something moved).
- A folder named "Workspace" already exists with her own chats in it → Auto-group puts new chats into that existing folder, after the ones already there, rather than making a second one.
- Reload before Undo: the snapshot is kept only in memory, so the Undo is gone.
### Edge Cases
- Nothing is deleted, and pinned chats are never moved.
- A child agent follows its parent into the parent's folder.
- Maya has already created "Agents" for another purpose → her chats mix with the auto-filed ones; Undo only moves back what Auto-group moved.
- The copy "Auto-grouped" says what happened but not where; the folder names are the only clue.

## STORY-APP-328: Deleting a folder and finding the chats afterwards
**Type**: short
**Topic**: sidebar-pages-folders-and-visibility
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Get rid of the folder "Apps" without losing the agents inside it.
**Preconditions**: Folder "Apps" holds the Mercury and Brex agents; unfiled chats exist.
**Ideal path**: 2 — open "Actions for Apps", click "Delete folder".
**Alternate paths**: none found (there is no way to delete a folder from a chat's "Move to" menu).
### Steps
1. Hover "Apps" and click "..." named "Actions for Apps" → "Rename", and a red "Delete folder".
2. Click "Delete folder" → the folder disappears at once. There is no confirmation dialog. Maya hesitates for a moment, expecting to lose the agents.
3. Look at the unfiled list → Mercury and Brex now sit at the end of the unfiled chats, in the order they had inside the folder.
### Variations
- A pinned chat in the folder returns to the pinned list at its pinned position.
- If the delete fails, the list reloads from the server and the folder reappears without a message.
### Edge Cases
- Undo is not offered for delete (only Auto-group has Undo).
- Deleting a folder that Auto-group made, then pressing Undo (if the notice is still showing) → UNVERIFIED: the snapshot restore checks that the folders it refers to still exist and may refuse.

## STORY-APP-329: A closed folder still shows that something needs attention
**Type**: short
**Topic**: sidebar-pages-folders-and-visibility
**Persona**: Maya, first-time founder of Northwind Robotics
**Goal**: Keep the "Workspace" folder closed but still notice when an agent inside it needs her.
**Preconditions**: Workspace holds Inbox, Finance, Legal agents. The Legal agent has raised an "urgent" notification and the Finance agent has an unread message.
**Ideal path**: 1 — read the folder header; click it only when she wants the list.
**Alternate paths**: Open the folder and look at each row's status icon.
### Steps
1. Click the "Collapse Workspace" header → the chats hide. The right side of the header shows an urgent status icon (the fire-truck pixel icon) and the count "3".
2. Maya notices the icon and no other signs → the header shows only the most urgent status among the chats inside (urgent beats needs input, failed, done, new).
3. Click the header again ("Expand Workspace") → the Legal row shows the same icon next to its time; screen readers hear "(urgent)".
4. Click the Legal agent → the thread opens; the icon on the row clears once she has looked at the thread, and the folder header loses it too.
### Variations
- With no status but an unread chat inside: a small dark dot appears instead of the icon.
- Hover the header with a mouse: the count and icons fade so the "..." button can show (`pointer-fine`).
### Edge Cases
- The same attention signal appears in the row, the folder header, and (for page agents) on the matching page row (STORY-APP-330).
- The state of collapse for the personal space's folders is saved on the server; for folders of other spaces it is stored in the browser.

## STORY-APP-117: What the "Personal" heading becomes when Maya adds a second space (replaces the earlier story of this id, updated 2026-10-20)
**Type**: medium
**Topic**: sidebar-pages-folders-and-visibility
**Persona**: Maya, first-time founder of Northwind Robotics, who also advises a friend's company "Harbor Labs"
**Goal**: Understand the sidebar headings after creating a second space, and know where she can make folders.
**Preconditions**: One space so far; her folders exist in it.
**Ideal path**: 5 — create a space, read the headings, open each menu.
**Alternate paths**: The create menu's "About spaces" button explains spaces.
### Steps
1. With one space, read the heading "Personal". Hover over it → tooltip may show the real space name when it differs (the heading replaces it only when she has a single space). Clicking the heading collapses her whole list; the accessible name is "Collapse Personal (Northwind Robotics)" (UNVERIFIED exact space name).
2. Open the create menu and choose "New space", then complete the dialog (named "Harbor Labs") → the sidebar now shows one heading per space: her current space first with a small dot, a lock icon on each, and the real names.
3. Look for "Personal" → gone; it was only a label for the lone space.
4. Open "Actions for Northwind Robotics" → "New folder" and "Auto-group" are present, plus "Rename space" / "Delete space" if she may.
5. Open the menu for "Harbor Labs" (not the current space) → no "New folder" or "Auto-group"; folders can be made only in the space being shown. Maya hesitates and needs to switch spaces first (clicking a chat in Harbor Labs switches).
6. Try to drag a Harbor Labs chat → it will not drag, because drag is limited to the current space.
### Variations
- Phone width: the same headings appear inside the drawer.
- Search the list: only folders that contain a match are shown.
### Edge Cases
- An empty second space shows only a heading; clicking it opens that space's onboarding.
- Pages group stays the same for every space (it sits above the headings).

## STORY-APP-330: Reading the numbers and dots on page rows
**Type**: medium
**Topic**: sidebar-pages-folders-and-visibility
**Persona**: Maya, first-time founder of Northwind Robotics, with Gmail, a bank connection and the Legal agent set up
**Goal**: Learn what each number or dot on the page rows means and how to hide the money value.
**Preconditions**: Inbox has 12 unread, Finance has a runway estimate of 18 months, Legal has 2 contracts due soon, Data room has 3 files waiting, Artifacts has a new item from a bot.
**Ideal path**: 3 — read the row, open the page, turn on Hide amounts.
**Alternate paths**: Expand a folder to see the same attention on agent rows.
### Steps
1. Read the page rows → Inbox "12", Finance "18 mo", Legal "2", Data room "3", Artifacts a dot, Cap table and Contacts nothing. Maya has no key; she guesses. The accessible names carry meaning, such as "Inbox, 12 unread" (only Inbox has a spoken label for its value).
2. Hover or focus "Legal" and "Data room" → no tooltip explains what 2 or 3 counts (code shows none in the expanded sidebar). She opens Legal to find out; the due-soon contracts are listed there.
3. Click Artifacts → the dot goes away after the page loads and the tab is focused.
4. Open the user menu and choose "Hide amounts" → Finance's "18 mo" value disappears (it is a money-derived number); other values stay.
5. Turn it off again → "18 mo" returns.
### Variations
- A row with both unseen notifications and a value shows the dot, not the value; the value returns after the notification is seen.
- A background tab never marks things seen; they are cleared when she returns.
### Edge Cases
- Contacts never shows a number or dot, so a new contact from an agent is invisible until she opens the page.
- In the icon rail (STORY-APP-122) only dots appear.
- Same information appears on the page header inside each page, which is the longer view.

## STORY-APP-122: Collapsing the whole sidebar to the icon rail (folded into the existing story of this id, updated 2026-10-20)
**Type**: short
**Topic**: sidebar-pages-folders-and-visibility
**Persona**: A solo technical founder at Northwind Robotics on a laptop, working in a half-width window
**Goal**: Give the main area more room but still see which pages need attention.
**Preconditions**: Sidebar docked and expanded; Pages group collapsed (STORY-APP-320); Legal has an unseen notification.
**Ideal path**: 1 — click "Hide sidebar".
**Alternate paths**: Drag the sidebar edge to resize; on a narrow window the sidebar becomes a swipe drawer instead of a rail.
### Steps
1. Click the edge button "Hide sidebar" → the sidebar becomes a narrow rail of icons.
2. Notice that all seven page icons are present although the group was collapsed → the rail ignores the collapse setting; hidden pages (via "Page options") are still absent.
3. Spot a small dot on the Legal icon (a notification), but a number badge for Inbox is not shown. Hover an icon → tooltip with the label; keyboard focus shows it too.
4. Folders appear as divider lines and chats as avatars; drag is disabled in the rail.
5. Click "Show sidebar" → full list returns and the search box takes focus.
### Variations
- Phone width: swipe from the left edge to open the drawer (a different component with the same rows).
### Edge Cases
- The rail has no "Page options" or PAGES header, so hiding or showing pages needs the expanded sidebar.

## STORY-APP-331: A full tidy-up of a crowded sidebar on a founder's second week
**Type**: long
**Topic**: sidebar-pages-folders-and-visibility
**Persona**: Maya, first-time founder of Northwind Robotics, who connected Gmail, a bank and Carta last week and now has fourteen chats
**Goal**: Turn a long, flat sidebar into a calm one: hide pages she does not use, fold the page group, auto-group, then fix the result by hand and check it all survives a second device.
**Preconditions**: Web app signed in; unfiled chats: Chief (pinned), Inbox agent, Finance agent, Legal agent, Data room agent, Carta agent, Mercury agent, "Recruiting helper", "Board deck writer", "Investor update writer", a group "Founders"; no folders; Legal has 2 due soon; Inbox 12 unread; desktop app also signed in.
**Ideal path**: 12 — one pass with Page options, Auto-group, two drags and a rename.
**Alternate paths**: Manual folders only (stories 04, 06); right-click "Move to" for each chat.
### Steps
1. Maya opens the app and scrolls: seven page rows, then sixteen chats. She thinks "this is too long" → no search needed yet.
2. Click "Page options" and uncheck Contacts and Artifacts → both rows vanish; she does not use them yet.
3. Click PAGES to fold the group → only Inbox remains (unseen dot) and the page she is on.
4. Open "Actions for Personal" > "Auto-group" → folders Workspace (Inbox, Finance, Legal, Data room, Carta), Apps (Mercury), Agents (Recruiting helper, Board deck writer, Investor update writer) and Groups (Founders) appear; "Auto-grouped" with "Undo" shows for 8 seconds.
5. Maya reads the result. She thinks Carta belongs with Apps → she keeps going; she does not click Undo.
6. Drag the Carta agent over the "Apps" header and release → it moves into Apps (count 1 to 2).
7. Hover "Agents", open "Actions for Agents" > "Rename", type "Writers", press Enter → the folder is renamed; the three agents stay inside. (She realises "Recruiting helper" is not a writer; she leaves it.)
8. Drag "Recruiting helper" onto the empty strip below the list → it becomes unfiled at the end of the list.
9. Close the Groups folder by clicking "Collapse Groups" → the header shows the count 1.
10. Right-click Chief > "Unpin" then "Pin" again to see how it sits above the folders → it appears under "Pinned" (UNVERIFIED exact heading when only one pinned chat exists).
11. Reload the page → folders, positions, hidden pages are the same; the PAGES fold and the closed Groups folder are the same too.
12. Open the desktop app on the same account → hidden pages (Contacts, Artifacts) and the folders match, because both are stored on the server. The PAGES fold may differ (browser storage); the closed Groups folder is also server-stored for her current space.
13. Type "contacts" in Search → Contacts appears under Pages in the search results even though it is hidden (STORY-APP-322). She clicks it, reads the page, and goes back.
14. Open "Page options" and re-check Contacts → the row returns after she realises she needs it for investors.
15. Run "Auto-group" again → only chats that are still unfiled (Recruiting helper) are filed, into "Agents"; Maya wonders why "Writers" was not used → Auto-group matches folders by their exact name, so it creates a new "Agents" folder (UNVERIFIED but implied by the by-name lookup in the code).
16. She clicks "Undo" in time → the new "Agents" folder is removed and Recruiting helper is unfiled again.
### Variations
- Do step 4 before step 2 → no difference in the end state.
- Use the keyboard for steps 6 and 8 (STORY-APP-326).
### Edge Cases
- Maya hesitates at step 5 (Carta) and step 15 (a second Agents folder).
- The same facts live on three surfaces: sidebar rows, the search results list, and the command palette (with Legal missing from the last two).
- Nothing in the app tells her that PAGES fold is per browser but Page options is per account.
