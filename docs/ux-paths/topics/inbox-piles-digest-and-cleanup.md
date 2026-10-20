# Topic: inbox-piles-digest-and-cleanup

Stories for the Inbox pile tabs, sender groups, multi-select bulk actions, the Newsletters Digest, the Cleanup screen (with History and Undo), the Spam pile, and the sorting states. Sources read: `apps/web/src/pages/Inbox.tsx`, `apps/web/src/components/inbox/{InboxPileTabs,InboxSenderGroup,InboxDigest,InboxCleanup,CleanupActionBar,CleanupHistory,CleanupSenderRow,InboxRow}.tsx`, `packages/core/src/{mail-cleanup,mail-cleanup-run,inbox-sender-groups}.ts`, `apps/api/src/inbox-cleanup.ts`, `packages/adapters/src/mail-piles.ts`, `apps/mobile/app/{inbox,inbox-cleanup}.tsx`.

Facts the stories rely on (from code):
- Pile tabs: Important, Updates, Newsletters, and Spam (with a count; shown only when the count is above 0 or Spam is the open pile). Important is the default and omits `?pile=`. Other piles set `?pile=updates|newsletters|spam`.
- Updates and Newsletters group mail by sender. A group header shows the sender, a count, the newest subject and summary, and a chevron (`aria-expanded`). A sender with one message shows as an ordinary row.
- Digest is a Toggle (newspaper icon, aria "Digest") shown only on Newsletters. It lists mail from the last 7 days, newest first, one card each, with "Open" and an "Archive all" icon button. Empty digest shows "No mail". Switching pile turns Digest off.
- Selection bar (when any row is checked): "N selected", Archive, Spam (or Not spam on the Spam pile), Trash, Clear. Toast text: "Archived N", "Marked N as spam", "Moved N to trash", "Marked N as not spam", each with Undo.
- Cleanup: the Cleanup icon button in the Inbox header (aria "Cleanup") sets `?cleanup=1`; Back (aria "Back") removes it. Sender rows are ranked by unopened mail. A sender is preselected only if it is newsletter or non-updates bulk mail, has at least 3 messages in the window, under 20% read, you never wrote to it, it is not marked important, not spam-like, not already skipped.
- Cleanup action bar: "Archive N", "Unsubscribe N", "Skip inbox N", and More (aria "More") > "Spam N". N is the number of conversations (inbox threads) the choice touches for the ticked senders. A button is disabled when its N is 0.
- Skip inbox leaves out senders marked "Looks like spam". Unsubscribe leaves out senders with no unsubscribe method.
- Unsubscribe by mailto asks "Send an unsubscribe email to {address}?" with Cancel / Send. Link-based senders show an "Open link" button. Failures show "Couldn't unsubscribe from {name}" or "Couldn't update {name}".
- History lists past actions ("Archived N", "Skipped inbox for N", "Unsubscribed and archived N", "Marked N as spam", "Marked N as not spam", "Moved N to trash") with sender, an "Automatic" tag for automatic ones, a time and Undo.

---

## STORY-INB-007: Maya finds out why her Inbox opens on "Important" and what the other tabs hold (replaces the earlier story of this id, updated 2026-10-20)
**Type**: short
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, first-time founder of Northwind Robotics, on the web app, Gmail connected two days ago, mail sorting allowed.
**Goal**: Understand the four pile tabs and see where a vendor receipt and a newsletter went.
**Preconditions**: One Gmail account (maya@northwind.example) synced; triage finished. Mail exists in all piles; at least 3 spam messages.
**Ideal path**: 3 — open Inbox, click Updates, click Newsletters.
**Alternate paths**: Deep link `/app/inbox?pile=newsletters`; Filter menu > Categories > Newsletters (a different view: it clears the pile tab selection, so no tab is highlighted). Command palette "search mail" does not show piles.
### Steps
1. Click "Inbox" in the sidebar PAGES group → Inbox opens on the Important tab (selected), URL has no `pile` param. Sections read "Needs reply", "Today" (or "Other mail today" when Needs reply is shown) and "Earlier".
2. Click the "Updates" tab → URL gains `?pile=updates`. Receipts and alerts from e.g. billing@payments.example.test are grouped by sender, each group showing the sender, a count and the newest subject.
3. Click the "Newsletters" tab → Newsletter senders (e.g. weekly@robotics-digest.example.test) appear grouped the same way, and a newspaper icon (aria "Digest") appears to the right of the tabs.
4. Notice the "Spam 3" tab at the end → it exists only because the count is above 0.
### Variations
- Maya has two Gmail accounts: a second row of account tabs ("All" plus one per account) appears under the pile tabs; the pile and the account choice combine.
- Triage is off (no model or no consent): the Important pile has no "Needs reply" and the Filter menu gains an "Important" item. UNVERIFIED whether the pile tabs themselves still show with triage off; the code renders them whenever an account exists.
### Edge Cases
- Maya thinks: "Where did the receipt go? It is not in Important." She hesitates because nothing says Updates is where receipts live. The only hint is the tab name.
- Opening a Filter or search clears the pile selection; no tab is highlighted until she clicks one. The same mail can be reached from the pile tab, the Filter menu (Categories) and `from:` search.

---

## STORY-INB-101: Maya reads the week's newsletters as a Digest and archives them all
**Type**: short
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, Northwind Robotics founder, web, Monday morning.
**Goal**: Skim the week's newsletters in one place and clear them.
**Preconditions**: Newsletters pile has 9 messages from the last 7 days and 6 older ones; Digest off.
**Ideal path**: 3 — Newsletters tab, Digest toggle, "Archive all".
**Alternate paths**: Expand each sender group and archive per group (the Archive icon on the group header); tick rows and use the selection bar's Archive. Mobile: the Digest option in the Inbox pile menu then an "Archive all" alert (UNVERIFIED exact control; code in `apps/mobile/app/inbox.tsx`).
### Steps
1. Click the "Newsletters" tab → grouped sender list.
2. Click the newspaper icon (aria "Digest") → the list becomes cards, newest first, only the 9 messages from the last 7 days. Each card: sender, time, subject, a one-line summary (the model's reason, else the snippet), and an "Open" button.
3. Click "Open" on one card, "Robotics Weekly #212" → the message dialog opens. She reads it and closes it.
4. Click the archive icon (aria and tooltip "Archive all") above the cards → the 9 cards disappear and a toast reads "Archived 9" with Undo.
5. Click the Digest toggle again → back to the grouped list, which still holds the 6 older messages.
### Variations
- Click Undo on the toast → the 9 return. If she waits too long, the toast goes away (Undo from here is gone; the Cleanup History does not list these, since this is a hand-picked archive; UNVERIFIED whether the Inbox archive is logged in History).
- Switching to Updates and back to Newsletters turns Digest off (it ends when another pile opens).
### Edge Cases
- "Archive all" archives every card shown, not the whole pile. Maya may expect the 6 older ones to go too; the toast count (9) is the only signal.
- Hide amounts on: dollar figures in subjects and summaries are masked in the cards.
- A pile with nothing in the last 7 days shows only "No mail" with no toggle hint.
- Maya hesitates: "Archive all" has no confirmation, so she relies on Undo.

---

## STORY-INB-102: Expand a noisy sender and archive just that group
**Type**: short
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: A solo technical founder (Dev) at Northwind Robotics, web, keyboard user.
**Goal**: Clear 14 build-notification emails from one sender without touching other Updates mail.
**Preconditions**: Updates pile contains 14 messages from ci@buildbot.example.test and 5 other single messages.
**Ideal path**: 2 — hover the group, click its Archive icon.
**Alternate paths**: Select the group's checkbox ("Select") then the selection bar's Archive; focus the group header with j/k and press e.
### Steps
1. Open the Updates tab → one group row "buildbot" with count 14, and 5 ordinary rows (single-message senders show as plain rows, not groups).
2. Click the group header → it expands (chevron rotates, `aria-expanded=true`) and the 14 messages show indented.
3. Collapse it again, hover the header and click the Archive icon (tooltip "Archive") → toast "Archived 14" with Undo; the group leaves the list.
### Variations
- Tick the group's checkbox (aria "Select"): checking some of the children shows it as indeterminate; the selection bar reads "N selected".
- Touch screen: the Archive icon is always visible on the group (`pointer-coarse`).
### Edge Cases
- Keyboard: the header has its own id (`group:<key>`), j/k can land on it, Enter toggles it, x selects it.
- A group with one message is not a group, so there is no count or chevron; Maya might look for a chevron that is not there.
- Archive moves only inbox mail; messages already archived in the group are not counted. UNVERIFIED how the count handles mixed archived/inbox rows (`archivableIds`).

---

## STORY-INB-103: Select several rows across a pile and move them to Spam, then undo
**Type**: medium
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, Northwind Robotics founder, web.
**Goal**: Mark three suspicious "invoice" emails as spam together, then recover one that was real.
**Preconditions**: Important pile has 3 emails from "Accounts Dept" at *.example.test addresses with a "Suspicious" icon on one; the Spam tab is not shown yet if the spam count is 0.
**Ideal path**: 5 — tick three rows, click Spam, read toast, open Spam tab, tick the real one, click Not spam.
**Alternate paths**: Per-row More menu > Spam (single); Cleanup > More > "Spam N" by sender (see story 7); toast Undo reverses the whole batch.
### Steps
1. Hover the first row and tick its checkbox (aria "Select") → a selection bar appears at the top of the list: "1 selected", Archive, a shield icon (aria "Spam"), a trash icon (aria "Trash"), Clear.
2. Shift-click the third row's checkbox → rows 1-3 are ticked, bar reads "3 selected".
3. Click the shield icon (aria and title "Spam") → the rows leave the list at once, toast "Marked 3 as spam" with Undo. The tab strip gains "Spam 3".
4. Click the "Spam" tab → the three mails show with a Junk or Spam badge. The bar's shield now says "Not spam".
5. Tick the real invoice and click the shield (title "Not spam") → toast "Marked 1 as not spam"; the Spam count drops to 2.
6. Click the Important tab → the invoice is back and stays out of Spam (not spam is sticky).
### Variations
- Click Undo in step 3 instead → all three return, Spam tab disappears when count hits 0 (unless it is the open pile).
- Choose the trash icon instead → "Moved 3 to trash".
- Press Clear → ticks are removed with no change.
### Edge Cases
- If one message fails: error line "Couldn't archive 1" (reused wording even for spam/trash) and the list reloads to show what really happened.
- Maya hesitates between Spam and Trash: Spam teaches the sender's reputation; Trash does not. UNVERIFIED whether the UI says so (it does not).
- The Spam tab disappears if she is on another pile and the count reaches 0; if she is on Spam when it reaches 0 the tab stays so the open tab never vanishes.
- The same actions appear in the row's More menu (Spam, Trash, Not spam) and on the sender's Cleanup row, so one decision can be made from three surfaces.

---

## STORY-INB-025: Maya waits through "Sorting your mail…" on a fresh account (replaces the earlier story of this id, updated 2026-10-20)
**Type**: short
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, new to Praci, web, just connected Gmail and allowed AI data sharing.
**Goal**: Know whether the Inbox is broken or still working.
**Preconditions**: First sync just finished; the model is still classifying; Important pile open.
**Ideal path**: 1 — read the status line and wait.
**Alternate paths**: If sorting stalls, "Try sorting again".
### Steps
1. Open Inbox → under the tabs a spinner and "Sorting your mail…" appear on the Important pile; the mail is listed below it.
2. Wait → the status line goes away and "Needs reply" / "Today" sections and the to-do card (if any) fill in.
3. If it takes too long, the line changes to "Sorting is taking longer than usual. Your mail is below." with a "Try sorting again" button; Maya clicks it → the status returns to "Sorting your mail…".
### Variations
- Consent not yet given: instead of the status line, the Important pile shows the consent prompt ("Let Praci sort your mail" with Allow / Not now). After Allow, the status line takes the prompt's place at the same height so the page does not jump. After "Not now" the prompt hides for this visit. 
- The status shows only on the Important pile; Updates, Newsletters and Spam never show it.
### Edge Cases
- Maya thinks: "Is my mail missing?" The words "Your mail is below" are only in the stalled version.
- The same sorting state also governs whether Needs reply exists; if she gives up and browses Updates, those mails may still shift pile once sorted. UNVERIFIED.

---

## STORY-INB-104: First Cleanup pass: archive the preselected bulk senders
**Type**: medium
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, Northwind Robotics founder, web, 2,000-message inbox, never opened most promotions.
**Goal**: Clear out bulk senders in one action.
**Preconditions**: One Gmail account; sender stats built; five senders qualify for preselection (3+ messages, under 20% read, never written to, not marked important).
**Ideal path**: 4 — open Cleanup, review ticks, click "Archive N", read toast.
**Alternate paths**: Per-group archive in the pile tabs (story 3); selection bar after ticking rows (story 4); the Inbox agent via "Ask" (not covered here).
### Steps
1. Click the Cleanup icon (aria and title "Cleanup") in the Inbox header → page "Cleanup" with a Back arrow, then a loading skeleton, then a list of senders ranked by most unopened mail. Five rows are already ticked.
2. Read a row: "Loop Hardware Deals · deals@loophw.example.test", right side "42 · 0% read · Oct 18". Maya hesitates at the one she half-remembers buying from and unticks "Select Loop Hardware Deals".
3. Look at the action bar → "Archive 31", "Unsubscribe 29", "Skip inbox 31", and a More button. The numbers count conversations in the inbox for the ticked senders, not messages.
4. Click "Archive 31" → the button shows a spinner and all controls wait; then a toast "Archived 31" with Undo (10 seconds). The list reloads and the archived senders usually drop off because they no longer have inbox mail.
5. A History section appears at the bottom: "Archived 31 · Meridian Promos +3" with a time and Undo.
6. Click the Back arrow → the Inbox returns, unread count in the sidebar is refreshed.
### Variations
- Nothing qualifies: nothing is ticked, the bar buttons show 0 and are disabled until she ticks rows by hand.
- No senders at all: "Nothing to clean up", no bar.
- Two accounts: each row also shows the account label.
### Edge Cases
- Archive keeps working in pages of 50 conversations per sender; a large sender may take a few seconds. If a page stops with mail remaining, the row reports "Couldn't update {name}" under the list.
- Archive does not unsubscribe, so new mail from the same sender will return to the inbox. That is the reason the other two buttons exist; Maya may not realise this.
- Browser Back from Cleanup returns to the Inbox because cleanup is a URL state (`?cleanup=1`) of the same route.
- Same info on multiple surfaces: "N% read" and the message count also reflect what the pile tabs hold for that sender; the Updates/Newsletters group count is mail in the window, the Cleanup count is conversations in the inbox. These can differ.

---

## STORY-INB-105: Unsubscribe from a newsletter by mailto and by link
**Type**: medium
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, Northwind Robotics founder, web.
**Goal**: Stop two newsletters for good, and see what happens when the sender needs an email or a web page.
**Preconditions**: Cleanup lists "Robotics Weekly" (unsubscribe by mailto to unsubscribe@robotics-digest.example.test) and "Sensor Deals" (a web unsubscribe link). A third sender, "Parcel Alerts", has no unsubscribe method.
**Ideal path**: 6 — tick two senders, click "Unsubscribe N", confirm Send, click Open link, read toast.
**Alternate paths**: Open the newsletter and use its own unsubscribe link outside Praci; Skip inbox (story 8) when Maya only wants quiet, not removal.
### Steps
1. Open Cleanup and tick "Select Robotics Weekly", "Select Sensor Deals" and "Select Parcel Alerts" → "Unsubscribe N" counts only the first two (senders with no method are left out of that count).
2. Click "Unsubscribe N" → for the mailto sender the app stops with a dialog "Send an unsubscribe email to unsubscribe@robotics-digest.example.test?" with Cancel and Send.
3. Click Send → the email is sent for her and the sender's mail is archived. 
4. For the link sender a line appears under the list: "Sensor Deals" with an "Open link" button (opens in a new tab). Maya clicks "Open link" → the sender's own page loads where she may need to press a final button. 
5. A toast reads "Unsubscribed from 2" with Undo; History adds "Unsubscribed and archived N".
### Variations
- Click Cancel on the dialog → nothing is sent and that sender is skipped for this run (neither unsubscribed nor archived).
- Several mailto senders: the dialog appears for each in turn.
- The unsubscribe fails: line "Couldn't unsubscribe from Sensor Deals", plus an "Open link" if the server has a page to try by hand.
- Mobile: the same confirmation is a native alert "Send an unsubscribe email to {address}?" with Cancel / Send, and the choice is first confirmed by an alert titled like the button (e.g. "Unsubscribe 29").
### Edge Cases
- Maya hesitates at the mailto dialog: it says only the address, not that her own Gmail will send it; the mail goes from her account. UNVERIFIED what the server uses to send.
- Mail-writes switched off on the server (`mailWritesDisabled`): the call fails with "Changing mail is turned off." and shows as a failure line. 
- Undo from the toast reverses the archive, not the unsubscribe request already sent. UNVERIFIED in UI; History Undo works on archive batches only.
- A "Looks like spam" sender is not unsubscribed from; the server refuses ("This sender looks like spam.") so sending an unsubscribe request to a spammer is avoided.

---

## STORY-INB-106: Skip inbox for a sender, see the Gmail filter note, and stop it later
**Type**: medium
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, Northwind Robotics founder, web, wants her investor-update list "out of sight but kept".
**Goal**: Keep a sender's mail out of the inbox from now on without unsubscribing, then reverse that.
**Preconditions**: One Gmail account without the Gmail "make filters" permission; the sender "Fund Updates" (updates@fund.example.test) sends monthly.
**Ideal path**: 6 — tick sender, "Skip inbox N", read row state, later click "Stop".
**Alternate paths**: Unsubscribe (story 7) removes the mail at the source; Archive (story 6) does it once only; Mark noise on a row (More/hover action "Mark noise: all mail from {sender}") treats mail from the sender as noise in Praci only.
### Steps
1. In Cleanup, tick "Select Fund Updates" and click "Skip inbox 3" → the sender's current inbox mail is archived and a decision is recorded; mail that arrives later is archived by sync. A toast reads "Skipping inbox for 1 sender" with Undo.
2. The row stays listed (even with nothing left to archive) with the label "Skipping" and a "Stop" link, so the decision can be undone.
3. Because Gmail has not allowed filters yet, an "Also in Gmail" link appears under the action bar (account label first when there are several accounts). Maya hesitates: it does not say what it does. Clicking it starts a Google sign-in to grant permission.
4. After granting, she clicks "Skip inbox" again for the sender if the row shows "Couldn't add Gmail filter" → the filter is retried. If it shows "Gmail filter limit reached", no new Gmail filter can be made; the skip still works inside Praci.
5. Weeks later, Maya opens Cleanup, finds the row with "Skipping" and clicks "Stop" → the decision (and the Gmail filter if one was made) is forgotten and the row loses its label.
### Variations
- Select a "Looks like spam" sender: "Skip inbox N" does not count it; the server also refuses it.
- History records "Skipped inbox for N" with a "Skip inbox" reason tag shown only when it differs from the action name.
### Edge Cases
- Mail Maya sees arrive in Gmail's own app is archived by the Gmail filter, but in Praci only by sync; the two are different mechanisms. UNVERIFIED timing.
- Undo on the toast removes the skip for the sender: UNVERIFIED whether History Undo also removes the Gmail filter.
- "Stop" fails: an error line (red) above the list; the list reloads either way.

---

## STORY-INB-107: Undo a Cleanup from History, and forget a learned pile
**Type**: medium
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, Northwind Robotics founder, web. She archived a sender last week and now needs its mail back.
**Goal**: Restore archived mail from History, and correct Praci's guess that "Jordan at Pacific Supply" is a newsletter.
**Preconditions**: History holds "Archived 12 · Pacific Supply Co." (source manual) and an "Unsubscribed and archived 8 · Robotics Weekly +1 · Automatic". Pacific Supply has the label "Learned Newsletters".
**Ideal path**: 4 — open Cleanup, Undo the action, Forget the learned pile, check Inbox.
**Alternate paths**: Undo from the 10-second toast right after the action; the Inbox "Moved ... to Inbox" Undo. Mark important on a row sets the pile too (explicit marks override learning).
### Steps
1. Open Cleanup and scroll to the History heading → list of actions, newest first, each with a time and an Undo button.
2. Click Undo on "Archived 12 · Pacific Supply Co." → the button waits; the 12 conversations return to the inbox and the sidebar unread count refreshes. The row's Undo is disabled once the action is undone.
3. On the Pacific Supply row, read "Learned Newsletters" with a "Forget" link next to it → click Forget. The label goes away.
4. Click Back and open the Newsletters tab → Pacific Supply mail is judged by the rules again (no learned pile). It may sit under Important or Updates on the next sync. UNVERIFIED whether pile membership changes immediately or after the next sync (`applyPileRules` runs on sync).
### Variations
- The "Automatic" tag marks an action done by the system on Maya's earlier choice (for example mail archived by a Skip inbox decision when it arrived). Maya can undo these too.
- Undo fails: a red error line above the list.
### Edge Cases
- Unsubscribe actions' Undo brings the mail back but does not re-subscribe her.
- Where Maya looks for recent actions: History exists only on the Cleanup screen. The Inbox toasts for hand-picked archives have no History equivalent. UNVERIFIED which Inbox bulk actions are logged (spam/trash batches are undone by batch id, so they are logged).
- The History list names only the first sender and "+N" for the rest; Maya cannot see all senders of a batch without opening the Inbox.

---

## STORY-INB-108: Cleanup on the phone
**Type**: medium
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, Northwind Robotics founder, Expo mobile app on iPhone, waiting in a queue.
**Goal**: Archive and unsubscribe from bulk senders using the phone.
**Preconditions**: iOS 26 (native header menu) or earlier (fallback button); Gmail connected; same senders as story 6.
**Ideal path**: 5 — open Cleanup, adjust ticks, choose action from the header menu, confirm alert, read result.
**Alternate paths**: Do it on the web (stories 6-8). Phone has no Skip-inbox Gmail-permission link in the code read (UNVERIFIED).
### Steps
1. In the Inbox screen, open the header menu and choose "Cleanup" (icon: checklist) → the Cleanup screen shows sender rows; preselected ones are ticked.
2. Read a row: "Meridian Promos", "42 messages · 0% read · Oct 18", and notes "Looks like spam", "Skipping" + "Stop", "Learned Newsletters" + "Forget".
3. Open the header menu again → "Archive 31", "Unsubscribe 29", "Skip inbox 31", "Spam 2" (counts as on web).
4. Tap "Archive 31" → a native alert titled "Archive 31" with Cancel and "Archive 31". Maya confirms.
5. See the result: the list reloads. Failures appear in the list as "Could not update {name}" with "Open link" when a page is available.
6. Tap a History item → alert with the action line (for example "Archive · 12 · Pacific Supply Co.") with Cancel / Undo.
### Variations
- Load failure: "Could not load senders" with a "Retry" button. Empty: "Nothing to clean up".
- Mobile pile picker: Important, Updates, Newsletters, Spam (behind its count) in the Inbox; Newsletters has a digest option with "Archive all" in an alert.
### Edge Cases
- Wording differs from web: "Could not update {name}" (phone) vs "Couldn't update {name}" (web); "Could not load senders" vs "Couldn't load senders". The same screen on two surfaces; a UX catalog should list both.
- There is no 10-second Undo toast on phone; Undo lives in History only. UNVERIFIED; no toast code was seen in `inbox-cleanup.tsx`.

---

## STORY-INB-109: A Monday-morning inbox reset across piles, Digest, Cleanup and Spam
**Type**: long
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: Maya, first-time founder of Northwind Robotics, web, first real session after a week away; 340 unread. Gmail account maya@northwind.example, triage on.
**Goal**: Get to a manageable Important pile, make newsletters a one-minute read, stop three recurring senders, and recover one mistake.
**Preconditions**: Mail sorted; Newsletters has 12 recent issues; Cleanup has 6 preselected senders; Spam holds 4 messages, one of them a real customer's reply.
**Ideal path**: 24 — a long journey with natural backtracking; no shortcut covers all of it.
**Alternate paths**: Ask the Inbox agent to tidy ("Ask"); use only the Filter menu (Unread, Categories); keep a single large Cleanup pass (story 6).
### Steps
1. Click "Inbox" → Important pile; she sees "Needs reply" (2), "Today" ("Other mail today"), "Earlier". Status line "Sorting your mail…" shows briefly and clears.
2. Open the first Needs reply email → the message dialog opens (prev/next, Reply, Archive). She replies later and closes the dialog → the list is unchanged.
3. Click the "Spam 4" tab → four mails with Junk/Spam badges. Maya spots "Alex, Brightline Customer" asking about an order.
4. Tick that row (aria "Select") → bar shows "1 selected" with a shield (title "Not spam"). Click it → toast "Marked 1 as not spam", count becomes "Spam 3".
5. Tick the other three and click Trash (aria "Trash") → toast "Moved 3 to trash"; the Spam tab remains because it is the open pile.
6. Click the "Important" tab → the customer's email is back in Important and stays (not spam is sticky).
7. Click the "Newsletters" tab → groups by sender; she notes 5 groups with counts.
8. Click the newspaper icon (aria "Digest") → 12 cards from the last 7 days. She reads three summaries and clicks "Open" on one, "Robotics Weekly #212", then closes it.
9. Click the archive icon "Archive all" → "Archived 12", then clicks the Digest toggle off. 
10. Click the Cleanup icon in the header (title "Cleanup") → skeleton, then the sender list. Six are preselected.
11. Untick "Select Loop Hardware Deals" (she buys from them) → action counts drop.
12. Tick "Select Fund Updates" (investor newsletter she wants kept but quiet).
13. Click "Archive 31" for the ticked set → toast "Archived 31"; History shows a new row.
14. Re-tick only "Fund Updates", click "Skip inbox 3" → toast "Skipping inbox for 1 sender"; the row shows "Skipping" with "Stop".
15. Tick "Robotics Weekly" and "Sensor Deals"; click "Unsubscribe 2" → the dialog "Send an unsubscribe email to unsubscribe@robotics-digest.example.test?" appears; click Send.
16. Under the list, "Sensor Deals" with "Open link" appears; click it → the sender's page opens in a new tab; she completes it there and returns.
17. Toast "Unsubscribed from 2". She realises she wanted Sensor Deals' discount codes; scrolls to History.
18. Click Undo on "Unsubscribed and archived ..." → mail returns to the inbox (the unsubscribe request already sent is not reversed).
19. Click the Back arrow → Inbox; the sidebar unread count has dropped from 340.
20. Click the "Updates" tab → groups; expands "buildbot" (14), collapses it, hovers and clicks Archive → "Archived 14".
21. She leaves the toast alone; after 10 seconds it goes away and the group stays archived.
22. Open Filter menu > Unread → the pile tabs deselect and a "results" strip with "Clear" appears; she scans unread items and clicks "Clear" → back to the pile.
23. Click "Important" → a short list. She is done.
### Variations
- Do the Cleanup pass first, then the piles; History then also shows the pile actions that were logged.
- If sync is still running or the sort is stalled, steps 1 and 7-9 change; see story 5.
### Edge Cases
- Maya hesitates at step 15: nothing in the dialog says it sends from her own address. 
- The same mailbox state is reflected in five places: the sidebar unread badge, the pile counts (Spam only), the Cleanup rows, History, and the Inbox lists. After each action only some update at once; the others update on reload.
- Browser Back at step 19-20 returns to the Inbox from Cleanup because it is a URL state, but a refresh keeps `?cleanup=1`.
- Hide amounts: any amount in a Digest card is masked.

---

## STORY-INB-110: Cleanup when Gmail needs permission, mail changes are off, or there is nothing to do
**Type**: short
**Topic**: inbox-piles-digest-and-cleanup
**Persona**: The deployment owner on the desktop app, running Praci on a local stack with mail writes disabled for safety.
**Goal**: See what Cleanup does when it cannot change mail.
**Preconditions**: `mailWritesDisabled` is on for this deployment (operator setting, name from code); Gmail connected read-only.
**Ideal path**: 3 — open Cleanup, tick a sender, click Archive and read the error.
**Alternate paths**: Re-enable mail writes (operator setting; outside the UI).
### Steps
1. Open Cleanup from the Inbox header → senders list loads normally (reading is allowed).
2. Tick one sender and click "Archive N" → the call fails with "Changing mail is turned off." 
3. The error shows as a line "Couldn't update {sender name}" under the list and, because the screen already has data, an extra red line above it; no toast, no History row. 
### Variations
- Load fails altogether (Gmail down): a "Couldn't load senders" alert with "Try again" instead of the list.
- No senders: "Nothing to clean up" and no action bar.
- Gmail rate limit or sign-out at the Inbox level: see the existing Gmail rate-limit topic (`new-gmail-rate-limit.md`); not repeated here.
### Edge Cases
- The Archive button looks active until clicked; the setting is not shown in the UI before the error. UNVERIFIED whether another place tells the owner mail writes are off.
- Duplicate failure text: the same failure shows on the sender line and in a red banner, so it can read as two errors.
