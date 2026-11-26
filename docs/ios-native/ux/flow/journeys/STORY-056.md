# Journey critique: morning inbox triage (STORY-056, 057, 063, 064, with 060/061)

Evidence: Swift code in `apps/ios/Sources/Praci/Inbox/` and `Packages/RakazoAPI/Sources/RakazoAPI/Models/Inbox.swift`, plus the steps in `docs/ios-native/ux/topics/inbox.md`. No device walk. Each claim is marked "measured from code" (M) or "suspected - needs device walk" (S).

**Verdict: acceptable.** One swipe per message and a sensible three-group list are already close to ideal. The main extra cost is that archiving from the message screen leaves the person on the screen, and Cleanup asks for two confirmations on a reversible action.

## 1. Friction scorecard

| Story | Ideal steps | Actual steps (M unless noted) | Decisions | Re-entry | Pointless confirmations | Dead ends | Hesitations |
|---|---|---|---|---|---|---|---|
| 056 triage | 3 (open Inbox, open top Needs reply, reply/archive) | 3 to reach the message (Home row, row tap); archiving from the message then needs a 4th step, Back, because the screen stays open (`InboxMessageScreen.swift:121-125`, `InboxMessageModel.swift:51-58` sets `archived = true` and does not dismiss) | read it? reply, archive, ask agent | none | none | after "Archived" the screen shows only Undo and "Ask Inbox agent" (`:121-152`) | the only visible indicator of "needs reply" is the group header; the row label says "Needs attention" which is a different term (`InboxRowView.swift:57`, `Inbox.swift:179-197`) |
| 057 swipe/long-press | 1 per message | 1 (swipe) (`InboxListView.swift:59-68`) | Archive vs Spam on the same swipe | none | none; Undo toast 5 s (`InboxScreen.swift:79-102`) | none | trailing swipe has two buttons, so full swipe archives (`allowsFullSwipe: true`, `:59`) and the Spam button is next to it; mis-swipe risk (S) |
| 063 Cleanup | 4 | 5 or 6: ellipsis menu, Cleanup, select, tap Archive, confirm alert (`CleanupScreen.swift:47-52`), then optionally a second action Unsubscribe with its own alert (`:53-66`, `:84-86`) | per-sender selection | none | the Archive alert guards a reversible action: its own text says "Undo brings them back." (`:51`) (M) | Done screen has a "Done" button as the only exit besides the two follow-ups (`:104`) | "Cleanup" is hidden in an ellipsis menu with one item (`InboxListView.swift:36-44`) |
| 064 To do card | 1 to complete, 2 to open | 1 / 2 (`TodosCard.swift:51-62`) | none | none | none | a done to-do disappears with no undo (S: depends on `TodosModel.complete`, not read) | the card sits above the Needs reply group and pushes the first mail down (`InboxListView.swift:21`) |
| 060/061 reading | 2 | 2 (open, scroll) (`InboxMessageScreen.swift:218-233`) | none | none | none | wide tables cannot be panned (catalog finding 40, 61); no "open in browser" | the 3 actions at the top right (Archive, Reply menu, More) are icon-only (M, `:86-112`) |

## 2. Take-away pass per screen

**Inbox list** (`InboxListView.swift:13-47`, `InboxRowView.swift:10-49`)
- Order: problem banner, To do card, Needs reply (with count), Today, Earlier. The group split is the best simplification in the app: it removes a decision (what first?). Keep. (M)
- Count shown only on "Needs reply" (M, `:24` vs `:25-26`). Good.
- Row has five items: unread dot, sender, label, time, subject, summary (M, `InboxRowView.swift:12-42`). The label ("Needs attention", "Newsletter") adds a second classification on top of the group it already sits in. In the Needs reply group the label "Needs attention" is a repeat; in Today a "Newsletter" label is useful. Hide the label when it matches the group. (M for the duplication; S for how often it appears)
- The summary line is a third line of text per row and is the line that makes triage decisions without opening. Keep.
- Toolbar: account picker (only with 2+ accounts, M `InboxScreen.swift:31`), Ask, ellipsis with one item. An ellipsis menu with one entry hides the item and costs a tap; either surface Cleanup where it matters (toolbar button, or a footer row when senders are piling up) or add a second entry. (M)
- Three swipe/menu surfaces for the same actions: leading swipe (read), trailing (archive, spam), context menu (all three) (M, `:59-89`). The context menu duplicates both swipes. It is a free accelerator for people who do not know swipes, so keep, but do not add more.

**To do card** (`TodosCard.swift:24-36`)
- Shows every open to-do at once (`ForEach(model.todos)`), with no cap (M). With 10 to-dos it pushes the mail below the fold. Cap at three with "Show all" (S, depends on data volume).
- Title "To do" is the only heading, fine. Row shows text, sender plus detail, and a due label: three lines of metadata for one to-do. Keep sender, drop `detail` unless it is the only context (S).
- Hides itself when empty (M, header comment `:5`). Good progressive disclosure.

**Message screen** (`InboxMessageScreen.swift`)
- Title bar "Message" is a constant and says nothing (M, `:39`). The subject is already the large title in the body (`:220`). Remove the nav title or make it the sender (M).
- Bottom bar: "Ask Inbox agent" is the prominent full-width button at all times (M, `:137-152`). For a message that needs a reply the natural primary action is Reply, which is in a menu in the toolbar (`:88-103`). The loudest control is a secondary route (STORY-062 "Ask Inbox agent" is the alternate path). Swap: Reply prominent, Ask as secondary. (M for the layout; S for how people choose)
- Archive is an icon-only button at top right; it is the main triage action and has no other surface on this screen. After tapping it the screen stays (M). Pop back to the list and show the same Undo toast the list shows (`InboxScreen.swift:79-102`).
- Header: sender, "to … · date", Cc line. Fine.
- "N earlier" disclosure (M, `:272-289`). Progressive. Keep.

**Cleanup** (`CleanupScreen.swift:98-139`)
- Bottom bar: a status line ("Select senders to clean up" / "3 senders selected"), Archive N emails (prominent), Unsubscribe. The status line when nothing is selected tells the person what the list already says. Removable. (M, `:125`)
- Two alerts for Archive (`:47`) and Unsubscribe (`:53`), then a third alert after the Done screen (`:59`). Archive is undoable by the screen's own message ("Undo brings them back.", `:51`) and the Done view has an Undo button (`:78-80`). Remove the Archive alert and keep the Done Undo. Unsubscribe really cannot be undone (`:57`, `:65`), keep that confirmation.
- The Done screen offers "Unsubscribe from N senders" as a follow-up (`:82-86`) after a second look at the same senders. Since the first screen already has an Unsubscribe button, this is a second route to the same alert. Keep as the single route and remove it from the first screen only if telemetry shows Archive is the common action (S).

## 3. The simpler version

### STORY-056 + 057 (triage)
1. Open Inbox (Home row).
2. Swipe each message you do not need (Archive). Tap one that needs an answer.
3. In the message tap Reply (primary), or Archive, and return to the list with the Undo toast.

Changes:
- Archive on the message screen pops back to the list and shows the existing Undo toast (JB-1).
- Reply becomes the prominent bottom action, "Ask Inbox agent" secondary (JB-2).
- Hide the row label when it repeats its group (JB-3).
- Cap the To do card at three rows with "Show all" (JB-4).

### STORY-063 (Cleanup)
1. Tap Cleanup (visible, not in a one-item menu).
2. Select senders.
3. Tap Archive. Results appear with Undo, and an "Unsubscribe from N senders" button only when it applies.
(One tap and one confirmation fewer than today.)

Changes: surface Cleanup (JB-5), drop the Archive confirmation (JB-6), remove the redundant status line (JB-7).

### STORY-060/061 (reading)
Two steps already (open, scroll). Wide tables remain unreachable (catalog finding 40). That is a bug rather than a flow cost; track it separately.

## 4. Clarity issues

| Label | Where | Problem | Suggest |
|---|---|---|---|
| "Needs reply" (group header) vs "Needs attention" (row label) | `InboxListView.swift:24`, `InboxRowView.swift:57` | Two names for near-identical ideas. One is a group; one is a category. (M) | Drop the row label inside the Needs reply group (JB-3); if kept elsewhere, name it "Important" or remove it (S) |
| "Read" / "Unread" on the leading swipe | `InboxListView.swift:72-73` | The label names the target state ("Read" on an unread row = mark as read), while the context menu says "Mark as read" (`:80`) (M) | Use "Mark read"/"Mark unread" on both |
| "Message" nav title | `InboxMessageScreen.swift:39` | Says nothing | Remove or show sender |
| "More" menu on message, containing only "Unsubscribe from X?" | `:104-113` | A menu named "More" for one destructive action | Show Unsubscribe in the footer of newsletter mail instead (S); the message already knows the sender is a bulk sender |
| "Cleanup" | `InboxListView.swift:38` | Not obvious it also unsubscribes | Fine once visible: the screen explains itself through the two buttons |
| "Spam" swipe | `InboxListView.swift:64-66` | Sits next to Archive, mis-swipe risk (S) | Keep; Undo toast covers it |

## Proposals

| id | Problem + evidence | Proposal | Steps saved | Risk | Size | Device walk |
|---|---|---|---|---|---|---|
| JB-1 | Archiving from the message leaves the person on the screen with "Archived" + Undo (M, `InboxMessageScreen.swift:121-125`, `InboxMessageModel.swift:51-58`). STORY-056, 057. Also the list does not refresh until pulled (catalog finding 28). | After archive, dismiss the message and show the list's Undo toast; remove the row from the list. | 1 tap per archived message (Back) | low-medium (list must receive the removal) | M | y |
| JB-2 | The primary bottom button is "Ask Inbox agent"; Reply is inside a toolbar menu (M, `InboxMessageScreen.swift:88-103`, `:137-152`). STORY-056, 062. | Reply is the prominent bottom action; "Ask Inbox agent" becomes secondary. Reply-all and Forward stay in the toolbar menu. | 1 tap (menu open) for reply | medium (changes the emphasis of the agent feature) | S | y |
| JB-3 | Row label repeats its group (M, `InboxRowView.swift:29`, `:57`; `Inbox.swift:179-197`). STORY-056. | Hide "Needs attention" inside Needs reply; keep Newsletter/Spam/Junk. | 0 | low | S | n |
| JB-4 | To do card shows all rows and pushes the list down (M, `TodosCard.swift:29-32`, `InboxListView.swift:21`). STORY-064. | Show three rows plus "Show all" when more. | 0 (less scrolling) | low | S | y (how many to-dos in practice) |
| JB-5 | Cleanup is behind a one-item ellipsis menu (M, `InboxListView.swift:36-44`). STORY-063. | Make it a toolbar button, or a row when the model has senders to clean. | 1 tap | low | S | n |
| JB-6 | Archive confirmation guards a reversible action (M, `CleanupScreen.swift:47-52`, own text "Undo brings them back."; Done Undo `:78-80`). STORY-063. | Remove the Archive alert; keep the Unsubscribe alert. | 1 confirmation | low | S | n |
| JB-7 | "Select senders to clean up" status line when nothing is selected (M, `CleanupScreen.swift:124-126`). STORY-063. | Show the count only once something is selected. | 0 | low | S | n |
| JB-8 | "Message" nav title is empty of information (M, `InboxMessageScreen.swift:39`). STORY-060. | Remove, or show the sender. | 0 | low | S | n |
| JB-9 | Swipe label "Read"/"Unread" differs from menu "Mark as read" (M, `InboxListView.swift:72-73` vs `:80-81`). STORY-057. | Use the menu wording in both places. | 0 | low | S | n |
| JB-10 | Unsubscribe lives in a "More" menu holding one item (M, `InboxMessageScreen.swift:104-113`). STORY-063, 065. | Show an "Unsubscribe" row at the foot of a bulk-sender message and remove the menu. | 1 tap | medium | M | y |
