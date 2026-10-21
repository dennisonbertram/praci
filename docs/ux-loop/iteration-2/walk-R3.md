# Walk R3: verify pass-1 fixes C27-C39 (demo stack, 1440x900 unless noted)

Target: mock-data demo only (web 5381). Signed in as the demo founder. The demo account is shared with other walkers, so some state changed while I walked (Cap table row vanished from and returned to the sidebar, bot avatars changed, unread counts moved). Screenshots: /tmp/uxloop2/R3/. Storybook was built to /tmp/uxloop2/R3-sb (the repo worktree has no node_modules, so I built from the main checkout with the output outside the repo).

## Cluster verdicts

| Cluster | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| C27 Cap table layout | FAIL (partial) | 3/3 | Header fixed (name untruncated, "Updated 5m ago" on one line, no Import/Add files). After choosing Investors: 6 rows visible, 45 px rows, sticky th. But the All tab still shows the 4 KPI tiles plus a ~490 px donut card with a large empty band; the table starts at y~830. See R3-05. |
| C28 Contacts feedback | PASS | 5/5 | Add shows "Saved Walker Test Person"; delete shows "Deleted ..." with Undo and Dismiss; Add contact defaults Kind to Investor; at 375 the organisation sits under the name. Nit R3-14. |
| C29 Finance | PASS (nits) | 3/3 | "Spent so far this month" label present; subscriptions table has a max width and blank zero-change rows; Receipt column gone; no clipped chart label at 375. Globex shows 35% on list and detail. Nits R3-10, R3-11. |
| C30 Data room | FAIL (partial) | 4/4 | Root is "All items"; dates are local. Auto-sort review is still a flat list of 60 ticked moves with a bare "Apply" (R3-01). Sort/Undo counts not verified: I did not apply, to avoid changing shared data. Header still has Import and Add files. |
| C31 Routine editor | PASS | 6/6 | Trigger menu opens downward without covering fields and offers only 2 items; no repeated schedule summary beside the selects. "Saved" flash and "Activity" heading not observed (R3-12). |
| C32 Approval rules | PASS | 3/3 | Both options are real switches (Privacy and approvals); toggling on then off works. |
| C33 Toasts | PASS (partial) | 3/3 | No "finished" toast for the chat in view (sent a message to Chief). Toasts expire within about 10 s. Dismiss exists in code (AppToaster dismissLabel) but I could not see it. A toast for another bot sits over the chat text (R3-13). Stack spacing not tested. |
| C34 Touch targets | BLOCKED live | - | agent-browser cannot emulate pointer: coarse (matchMedia false even with device "iPhone 12"). Code shows pointer-coarse:h-11 / size-11 in button, switch (hit area), checkbox, dropdown-menu. Settings tabs at 375 not reached. |
| C35 Artifacts | PASS | 3/3 | Filters collapsed behind one button, bot chips gone (single bot), panel collapses when an item opens, type once per card (MD badge), HTML gets its own icon. Nit R3-09. |
| C36 Hide amounts / menus | PASS | 3/3 | No eye in Inbox, Cap table, Data room, Finance headers. Account menu has menuitem roles, one Hide amounts item, divider before Log out. Bot menu says "Bot settings". |
| C37 Sidebar | FAIL (partial) | 4/4 | Counts have names ("Inbox, 12 unread", "Data room, 1 waiting"). Auto-group did not put Chief in a folder. But renaming a sidebar space to an existing name was accepted with no error (R3-06), and Auto-group moves Chief below all folders (R3-07). Rail dots and hidden-pages flash not verified. |
| C38 Bootstrap | BLOCKED | - | Could not force a slow bootstrap (route abort of /rpc/bootstrap had no effect), so "Still opening..." and Retry are unseen. Cold-load timing: 13 s for the first launch, 1.8 to 2.2 s for warm reloads, measured with machine load average 29 to 48, so not an idle-stack number. |
| C39 Legal | PASS at 1440, FAIL at 375 | 2/2 | Consent stated once (banner). At 375 the first contract title is at y=528 (target: above 500) and tiles are still 2x2 (R3-08). |

## Storybook smoke (apps/web, `node .storybook/smoke.mjs`)

1465 of 1480 stories render cleanly. 15 fail:

- 9 x shell-bot-settings (thirteen-skills-advanced-open, advanced-with-memory-scope-and-disabled-tools, advanced-open, runs-on-this-mac, notifications-off, default, long-profile-text, unknown-tool-name, save-failed): TypeError reading 'length' of null in BotSkillsSection (R3-02).
- 4 x dataroom-dataroompage (importing, with-items, with-ask-agent, empty): TypeError reading 'reading' of null in ProcessingStrip (R3-03).
- 2 x 404 resource: chat-sandboxedhtmlviewer--email-newsletter-with-remote-images, inbox-message-dialog--with-attachments (R3-04).

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| R3-01 | Data room Auto-sort (C30) | P2 | flow | Observed: review lists 60 ticked moves in one flat "Move" group, including in-folder moves like "HR to HR / Policies"; button is "Apply" with no count. Expected: grouped by destination, "Apply N moves", loose items first. | 14-autosort-review.png | apps/web/src/components/data-room/AutoSortDialog.tsx:110,247 | Group operations by destination, default-tick only loose items, label the button "Apply N moves". |
| R3-02 | shell-bot-settings (9 stories) | P2 | bug | Observed: all crash, null .length. Confirmed in code: the component calls rpc.agentSkills.drafts() and calls setDrafts(null) when the mock returns null; the stories do not mock it. | smoke log /tmp/uxloop2/R3-sb-smoke.log | apps/web/src/pages/shell/BotSkillsSection.tsx:128-134, 402; apps/web/src/pages/shell/bot-panel.stories.tsx:18 | Add "agentSkills.drafts": [] to the story setup. |
| R3-03 | DataRoomPage (4 stories) | P2 | bug | Observed: crash reading .reading of null; stories do not mock dataRoom.processing in load(), only one story does. | smoke log | apps/web/src/components/data-room/ProcessingStrip.tsx:9; apps/web/src/pages/DataRoom.stories.tsx:8 | Add a default "dataRoom.processing" response to load(). |
| R3-04 | SandboxedHtmlViewer, InboxMessageDialog stories | P3 | bug | Observed: console 404 for an asset, smoke fails. Cause suspected: remote image or attachment URL not covered by the stub. | smoke log | apps/web/.storybook/stubs.ts | Stub the URL or use a data URI in the story. |
| R3-05 | Cap table, All tab (C27) | P2 | visual | Observed: donut card is about 490 px tall with a large empty band between ring and legend; the tabs and table start at y~830, so the table is below the fold on All. Rows are 45 px (target 44). | 01-captable.png, 02-captable-investors.png | apps/web/src/pages/CapTable.tsx, components/cap-table/OwnershipDonut.tsx | Cap the donut card height (or lay the legend beside the ring) so tabs show above y=700; set rows to 44 px. |
| R3-06 | Sidebar rename (C37) | P2 | bug | Observed: renaming the sidebar section "Empty space" to the existing "Mail needs reconnect" was accepted; two sections now share a name, no inline error. I restored the name. I did not test user folders, but renameFolder has no duplicate check either (suspected). | 31-rename-dup.png | apps/web/src/pages/Shell.tsx:1898 | Reject a duplicate name in the rename input with an inline message. |
| R3-07 | Sidebar Auto-group (C37) | P2 | flow | Observed: Auto-group creates Apps, Workspace, Agents, Groups folders and leaves Chief ungrouped under a "Chats" heading at the bottom, below all folders. Chief, the main chat, is no longer at the top. The Undo toast was gone before I could use it (under about 10 s of walking time), and Delete folder has no confirm. I removed Apps and Groups; Workspace and Agents folders remain in the demo. | 33-autogroup.png, 34-autogroup-bottom.png, 35-restored.png | apps/web/src/pages/Shell.tsx:1918 (autoGroupSidebar), server rpc.sidebar.autoGroup | Keep Chief pinned first when grouping; keep the Undo toast until dismissed or the next action. |
| R3-08 | Legal at 375 (C39) | P3 | visual | Observed: banner and 2x2 tiles push the first contract to y=528; target was above 500 or tiles in one row. | 37-legal-375.png | apps/web/src/pages/Legal.tsx:136 | Make tiles a single scrolling row on narrow screens. |
| R3-09 | Artifacts viewer (C35) | P3 | copy | Observed: list cards drop the extension but the viewer title reads "MOCK Vendor Spend Review.md". | 29-art-open.png | apps/web/src/pages/Artifacts.tsx | Strip the extension in the viewer title too. |
| R3-10 | Finance vendor detail (C29) | P2 | copy | Observed: for Globex Cloud the list says "Per month $2,016" while the detail says "Monthly avg $1,728" (6-month average); the change reads "3 months" on the list and "Sep vs Jun" on the detail. Same percent, different bases for the dollar figure. | 09-finance-bottom.png, 10-vendor.png | apps/web/src/pages/Finance.tsx (subscriptions table, vendor view) | Label the list column "Latest month" or show the same average on both. |
| R3-11 | Finance overview (C29) | P3 | visual | Observed: overview still scrolls to 1693 px; lone narrow "Treasury yield" card under Subscriptions; "overlaps" tag still unexplained. | 09-finance-bottom.png | apps/web/src/pages/Finance.tsx:949 | Put Treasury yield in the KPI row; give the tag a title. |
| R3-12 | Routine editor (C31) | P3 | flow | Observed: Save accepted an empty Instruction and stored "Check in."; button showed "Saving..." then "Save" with no "Saved" seen at 1.5 s. | 21, 22-after-save.png | apps/web/src/pages/RoutineEditor.tsx | Require an instruction or show it as optional; flash "Saved". |
| R3-13 | Toasts (C33) | P3 | visual | Observed: a "Finance agent finished" toast sits over the bottom of the chat text (not the composer), partly covering the last user bubble. | 42-chief-reply.png | apps/web/src/components/AppToaster.tsx | Offset the toast stack above the composer or move it to the top right. |
| R3-14 | Contacts add notice (C28) | P3 | flow | Observed: "Saved X" notice appears inline at the end of the list (below the fold on long lists) and was gone within about 1.5 s; I did not see a row highlight. | 05-contact-saved.png | apps/web/src/pages/Contacts.tsx | Show the notice in the page header or toast area and keep it about 4 s. |
| R3-15 | Chief chat rendering | P2 | bug | Observed once: a long user message ("...this week's priorities?") rendered as a one-character-wide column about 1000 px tall at the right edge, pushing the thread. After a reload the same message was normal (604 px wide), so it appears tied to live layout state. Not reproduced. | 42-chief-reply.png, 43-chief-up.png | apps/web/src/pages/Shell.tsx (message list) or the chat bubble component | Reproduce by sending a long message from another session while the chat is open; check bubble width and virtualization measure. |
| R3-16 | Inbox consent banner | P3 | visual | Observed: the "Let Praci sort your mail" banner top edge sits under the filter chip row (banner y=160, chips y=144), so its top border is clipped. | 44-inbox.png | apps/web/src/pages/Inbox.tsx | Add spacing between chip row and banner. |
| R3-17 | Data room header (C30) | P3 | flow | Observed: Import and Add files are still two separate header buttons; the strip shows "Processing 1 file / 1 couldn't be read" with a permanently spinning "Reading" row (demo data). | 11-dataroom.png | apps/web/src/pages/DataRoom.tsx | Merge Import into the Add files menu. |

## Not verified

C34 on coarse pointers (tooling cannot emulate), C38 timeout and Retry screen, C37 collapsed-rail unseen dots and the hidden-pages flash, C30 Sort/Undo count equality, C33 stack spacing, C36 "Hide amounts" on the Legal header (Legal screenshot at 1440 shows none), Settings tabs at 375.

## Praise

Cap table header, Contacts add/delete feedback with Undo, Finance subscriptions table, the Artifacts filter popover, and the approval switches are clean and clearly better than pass 1.
