# Topic: Updates and board

Round 6 re-checked the stories against the round-5 plan (portal notice rules, Unknown counts as resolved, Portal access defined). Round 5. Updated against the plan after round 4 (To list hidden without Gmail; portal notices for Post to portal; board update without Gmail; Unknown delivery state; Sending and Posted rows) and the new views `#ed-unticked`, `#ed-unknown`, `#ed-boardnog`, `#inv-sending`, `#inv-posted`. Round 4 text: updated against the plan after round 3 (sections "Update editor", "Updates", "Portal security", slice 5) and the mockup views `#editor`, `#ed-tbd`, `#ed-sending`, `#ed-failed`, `#ed-nogmail`, `#inv-sent`, `#inv-partly`, `#inv-reminder`, `#inv-updmenu`. Planned feature; all names and figures are invented. Gap tags: `PG-nn` is a round-1 gap still open; `NG-nn` is a gap from round 2, 3 or 4 that is still open (see `../catalog.md`, "Plan gaps (round 4)"). Update status words are exactly Draft, Sending, Sent, Partly sent and Posted. Round 3 model: Send is a background job; there are no per-update shares, so every sent or posted investors update is visible on the portal to every investor contact with portal access; board updates are never on the portal; a sent, partly sent or posted update is read-only. Email subjects use the editor's Subject, which defaults to "<Company> · <Period> update" (middle dot).

## STORY-201: Monthly reminder lands, founder reviews and sends the October update
**Type**: long
**Topic**: Updates and board
**Persona**: Maya Chen, solo founder of Example Robotics, pre-seed, one Gmail account connected
**Goal**: Turn the routine's draft into a sent investor update without writing it from scratch
**Preconditions**: Investors agent seeded with the routine "Investor update draft" (monthly, 1st, 09:00, active); Finance synced; Gmail connected; contacts Elena Ruiz, Tom Okafor, Sam Lind, Priya Raman (investors) and Marcus Webb (no email); a September update already sent.
**Ideal path**: 4 (open Investors, Open the action item, Send, return to Investors)
**Alternate paths**: Open the update from the Updates card; ask the Investors agent in chat.
### Steps
1. The routine runs `@investor-update` for the last period on the 1st → saves an `InvestorUpdate` draft through `investor_update_draft`, sends nothing, and the agent notifies "October update ready" → the Investors sidebar row shows a dot (accessible name "1 unseen notification").
2. Open Investors → Action items shows "October update · Drafted Oct 1" with the button "Open".
3. Click Open → the editor page `/app/investors/updates/:id` inside the shell: "← Investors", title "October update", tag Draft, Subject "Example Robotics · October update", To (one row per contact: Elena, Tom, Sam, Priya ticked; Marcus Webb greyed, unticked, "no email"), and the markdown body shown rendered (TL;DR, Numbers, Highlights, Lowlights, Asks). The From picker is absent (one Gmail account). Opening sets `reviewedAt`.
4. Read the body → "Customers: TBD" is highlighted. Maya types the real number over it; the footer shows "Saved" (autosave on change).
5. Click "Send" → the status flips to Sending in a transaction and a background job sends one recipient at a time; the button reads "Sending" and is disabled; each recipient row moves Sending, then Sent (`#ed-sending`). Every recipient gets their own email "Example Robotics · October update" from her Gmail with the body and one line "View online and past updates" carrying a new personal link (a new token minted per recipient). No per-update share is created.
6. Every recipient is Sent → the row is marked Sent, a toast reads "Sent to 4", and the page returns to Investors.
7. Read Updates → "October update · Investors · Oct 20" with the chip Sent, Open and a "…" menu (`#inv-sent`); the Action item is gone. On the portal every investor contact who holds a live link now sees it at the top, ticked or not (STORY-203).
### Variations
- Maya leaves one TBD in the body → Send first shows in the footer row "1 TBD left. Send anyway?" with Keep editing and Send anyway (`#ed-tbd`); the Send label never shows a count.
- Maya edits Subject first; the email subject is exactly that field.
### Edge Cases
- Second click on Send does nothing (the status is already Sending).
- One recipient fails → STORY-210.
- The Action item leaves when the draft is opened, even if unsent; the draft stays in Updates with the chip Draft.
- Dec 1 comes with the October draft still unsent: several drafts may be open at once, so a second draft appears and the first stays in Updates.
- Sam was revoked earlier → STORY-212.
- The API restarts while the status is Sending → the job retry resumes the update (STORY-210).

## STORY-202: Draft with agent fills a blank update
**Type**: medium
**Topic**: Updates and board
**Persona**: Tomas Reyes, founder; Finance has cash, burn and runway but no revenue data
**Goal**: Get a first draft inside a manually created update
**Preconditions**: Gmail connected; two earlier updates sent.
**Ideal path**: 4 (New update, Draft with agent, fill the TBDs, Send)
**Alternate paths**: Ask the Investors agent "draft the investor update" in chat (the same `investor-update` skill writes the row; there is no Gmail draft any more).
### Steps
1. Click "New update" in the Updates card → the editor opens with an empty body, Subject defaulted, To = all investor contacts ticked, and the button "Draft with agent" (it shows only while the body is empty).
2. Click Draft with agent without opening the chat → the body fills from Finance, the cap table and past updates in the same `##` sections; what the agent could not know (customers, revenue, highlights) is written as TBD and highlighted.
3. Open Ask → in the chat the agent asks for highlights, lowlights and asks; Tomas answers and the draft row updates.
4. Replace the remaining TBD → the highlight clears as he types; "Saved".
5. Click Send → "1 TBD left. Send anyway?" if one remains; otherwise sends as in STORY-201.
### Variations
- The agent run fails: the body stays empty and a toast reports it. Finance not connected: the draft is mostly TBD.
- The body already has text: the button is gone, so there is no overwrite.
### Edge Cases
- Leaving the editor while the agent is writing: the draft row is saved by the agent, so it is there on return.

## STORY-203: Choosing recipients
**Type**: short
**Topic**: Updates and board
**Persona**: Lena Park, founder with four investors and one angel she wants to skip this month
**Goal**: Send an update to a subset
**Preconditions**: Draft open; contacts Elena Ruiz, Tom Okafor, Sam Lind, Priya Raman (all with a live portal link), Marcus Webb (no email).
**Ideal path**: 2 (untick Priya, Send)
**Alternate paths**: none found
### Steps
1. Read To → one row per contact with a checkbox, all ticked; Marcus Webb is greyed, unticked and says "no email". There is no field for an ad-hoc address.
2. Untick Priya Raman → three ticked.
3. Click Send → three emails, each with its own link; the toast reads "Sent to 3"; the Updates row reads "Investors · Oct 20" with the chip Sent.
4. Under the list one line reads "Unticked investors still see this on the portal." (`#ed-unticked`) because Priya has portal access. Later she opens the portal with the link she already holds and sees the October update; unticking her withheld the email only. "Portal access" is defined in the Glossary (a live link token or session, or a send or portal notice already made, and not blocked), so an unticked investor who was never sent a link gets no line.
### Variations
- Unticking everyone → the Send button is disabled (resolved in round 3).
- A revoked contact is greyed, unticked and says "revoked"; it is never emailed (STORY-212).
### Edge Cases
- The audience is fixed by how the update was started (New update is investors, Message the board is board), so the list cannot be switched.

## STORY-204: No Gmail connected, Post to portal instead of Send
**Type**: medium
**Topic**: Updates and board
**Persona**: Ravi Anand, founder who uses Outlook and has no Gmail connection
**Goal**: Get the update to investors through the portal
**Preconditions**: Draft exists; no Gmail connection; Elena and Tom hold live portal links from earlier updates; Priya Raman has never been sent a link.
**Ideal path**: 1 (Post to portal; the notices go out by themselves)
**Alternate paths**: Copy the body into Outlook by hand; Connect Gmail and Send.
### Steps
1. Open the draft (`#ed-nogmail`) → the footer shows the filled "Post to portal" and the plain "Connect Gmail". There is no Send and no To list (it controls email only and is hidden without Gmail).
2. Click Post to portal → the update ends as Posted; each investor contact with an email who is not revoked (never-linked ones included) gets a short portal notice with a freshly minted link from the instance's `TransactionalEmailProvider`; the toast reads "Posted · 4 notified" and a Posted row heads Updates (`#inv-posted`). Contacts' Portal cells move to "Invited <today>".
3. Read Updates → the row reads "Posted", a different word from Sent, so nobody mistakes it for an emailed update.
4. Elena, Tom, Sam and Priya each open their notice and see the update, including Priya, who had no link before. Marcus Webb has no email, so nobody is told; his only route is Copy link in his contact menu. A revoked investor with an email is not counted and gets no notice; the footer before the click read "Notifies 4 investors", the same n as the toast.
5. Ravi chooses Copy link on Marcus (Contacts "…" menu) → a new link is shown once in the copy-link dialog (`#inv-copylink`, STORY-309).
6. Click Connect Gmail → [plan silent: where it goes and whether the editor returns afterward (PG-31)]
7. With Gmail connected, open the Posted update → it is read-only; Duplicate (row menu, `#inv-updmenu`) starts a new draft, and Send on that draft emails everyone. The portal now lists both entries until Ravi deletes the Posted original, which removes its portal copy. [plan silent: no "email this posted update" action (NG-52)]
### Variations
- No email provider configured either: Post to portal opens the copy-link dialog instead of notifying; the plan says it lists one link per contact with a Copy button each (not drawn: `#inv-copylink` shows one contact).
- A notice to one contact fails: the Posted row's sub-line reads "1 not notified" with Retry for those contacts only (not drawn).
### Edge Cases
- Post to portal with a leftover TBD. [plan silent: the TBD prompt is described for Send only (PG-29)]
- Gmail connected but needing reconnect: the footer shows the reconnect state of the connection.

## STORY-205: Two Gmail accounts, pick the sender
**Type**: short
**Topic**: Updates and board
**Persona**: Ines Alvarez, with ines@examplerobotics.example and a personal Gmail connected
**Goal**: Send from the company address
**Preconditions**: Two Gmail connections; draft open.
**Ideal path**: 2 (pick From, Send)
**Alternate paths**: none found
### Steps
1. Open the draft → a From field appears above the body only because more than one account exists.
2. Choose the company account → stored as `fromConnectionId` on the update.
3. Click Send → each message goes from that account.
### Variations
- Routine-created draft: From is unset until she opens it.
### Edge Cases
- The chosen account disconnects before Send: the send fails per recipient (STORY-210).

## STORY-206: Reminder in the Updates menu
**Type**: short
**Topic**: Updates and board
**Persona**: Maya Chen after closing a seed round; investors want fewer emails
**Goal**: Switch the reminder from monthly to quarterly
**Preconditions**: Routine "Investor update draft" active, monthly.
**Ideal path**: 2 (open the menu, choose Quarterly)
**Alternate paths**: The routine editor on the Investors agent; ask the agent.
### Steps
1. Click the "…" next to "New update" in the Updates card (`#inv-reminder`) → the menu offers Reminder with Monthly (ticked), Quarterly, Off. There is no Reminder button on the page.
2. Choose Quarterly → `investors.reminder` rewrites the routine: the 1st of January, April, July and October at 09:00 in her time zone; still active.
3. Choose Off later → routine inactive; a pending draft stays; there is no catch-up draft when it is turned on again.
### Variations
- Monthly again mid-month: the next draft arrives on the 1st of next month.
### Edge Cases
- There is no board reminder (decision 7): the Board tab's "Message the board" is the only board path.

## STORY-207: Update history, reopen a sent update
**Type**: short
**Topic**: Updates and board
**Persona**: Maya, checking what she told investors in September
**Goal**: Find and read a past update
**Preconditions**: Sent: September update (Oct 2), Q3 board update (Oct 6), August update (Sep 3).
**Ideal path**: 2 (open the row, read)
**Alternate paths**: Ask the agent "what did we tell investors in August".
### Steps
1. Read Updates → rows "September update · Investors · Oct 2", "Q3 board update · Board · Oct 6", each with the chip Sent, Open and a "…" menu.
2. Click Open on the September update → the editor in read-only form (a sent, partly sent or posted update has no footer button).
3. Open the row menu (`#inv-updmenu`) → Duplicate (new draft) and Delete.
4. Click "← Investors" → back to the page.
### Variations
- An update posted without Gmail reads Posted (STORY-204); a partly sent one reads Partly sent (STORY-210).
- A draft's menu has Delete only.
### Edge Cases
- Deleting removes the portal copy (STORY-211).

## STORY-208: Message the board
**Type**: long
**Topic**: Updates and board
**Persona**: Priya Shah, CEO with three board members (Mark Davis, Aiko Tanaka, Joel Weiss) as contacts
**Goal**: Send a quarterly board update
**Preconditions**: Board tab lists 3 contacts; Gmail connected.
**Ideal path**: 3 (Message the board, Draft with agent, Send)
**Alternate paths**: none (there is no board routine and no board reminder).
### Steps
1. Open Contacts and click the Board tab (`Board 3`) → the tab shows the three people and a "Message the board" button.
2. Click Message the board → the editor opens with audience board, Subject defaulted, To = the three board members ticked.
3. Click Draft with agent → the body is written from past board and investor updates, Finance and the cap table.
4. Edit, click Send → three plain-text emails, one per member, "Example Robotics · Q3 board update", with no portal link. A board update never appears on the portal and no control changes that.
5. Read Updates → "Q3 board update · Board · Oct 6" with the chip Sent.
### Variations
- The Board tab button shows only once a board contact exists, so there is no empty Board tab to open.
- Board member who is also an investor → STORY-610.
- No Gmail: the editor shows no To list and one button, "Connect Gmail to send" (`#ed-boardnog`); there is no Post to portal for a board update, so nothing can end as a Posted board update.
### Edge Cases
- Asking the agent to turn on a board routine: no such routine exists.

## STORY-209: Phone notification opens the agent chat
**Type**: medium
**Topic**: Updates and board
**Persona**: Maya Chen, away from her desk on the 1st, with the Rakazo mobile app
**Goal**: Read and adjust the draft from the phone; send it later on web
**Preconditions**: Mobile app; routine ran; the app has no Investors screen.
**Ideal path**: 3 (tap the notification, read, ask for a change)
**Alternate paths**: Open the Investors agent from the Bots list.
### Steps
1. The push "October update ready" arrives → tapping it opens the Investors agent chat (an ordinary bot).
2. Read the chat → the agent shows the draft it saved.
3. Ask "change runway to 15 months and add an ask for intros" → the agent edits the draft row through `investor_update_draft`.
4. The agent says sending is on web or desktop (it has no `mail_send`) → Maya sends later from Investors.
### Variations
- Asking the agent to save a Gmail draft: it has `mail_draft`, but the page flow is the supported path.
### Edge Cases
- Notification tapped after the update was sent from the web: the chat shows the earlier message.

## STORY-210: A recipient's send fails, Retry
**Type**: medium
**Topic**: Updates and board
**Persona**: Maya Chen
**Goal**: Finish a send where one message failed
**Preconditions**: Draft with four ticked recipients; Gmail rejects the message to Tom Okafor.
**Ideal path**: 3 (Send, see the Failed row, Retry)
**Alternate paths**: Retry from the Updates row without reopening the editor (below).
### Steps
1. Click Send → the background job starts; the button reads "Sending" and is disabled; the header chip reads Sending; the rows show Elena Sent, Tom Sending, Sam Sending, Priya Sending (`#ed-sending`).
2. Every recipient has resolved → Tom shows Failed with a Retry button (its slot was reserved, so rows do not shift); Elena, Sam and Priya show Sent (`#ed-failed`); the header chip reads Partly sent, the footer reads "3 of 4 sent" with one filled Done button.
3. Click Retry on Tom (a plain Failed row, not an Unknown one) → only Tom's message is attempted again; his row turns Sent and the update becomes Sent.
4. Click Done (or finish the Retry) → the page returns to Investors.
### Variations
- Retry fails again: the row stays Failed and the chip stays Partly sent.
- Maya clicks Done with Tom still Failed → on Investors the Updates row reads "October update" with "Tom Okafor failed · Investors · Oct 20" (an Unknown recipient reads "Tom Okafor unknown", `#inv-partly`), the chip Partly sent and a Retry button (`#inv-partly`), so the failure is visible without reopening the editor.
- Maya leaves the editor while the job runs → the job continues; the Updates row shows the chip Sending and Open with a disabled menu (`#inv-sending`), then flips to its final word by itself. [plan silent: whether the "Sent to <n>" toast still appears when the editor is closed]
### Edge Cases
- Maya clicks Send again while rows are Failed: it does nothing.
- The API restarts mid-send → the job retry resumes the update: recipients with a recorded result are skipped, never-attempted ones are sent, and a recipient attempted with no recorded result shows the amber state "Unknown — check Sent mail" with Retry (`#ed-unknown`); Retry asks once in the footer "May already be delivered. Send again?" with Cancel and Send again, and the message is never resent automatically. Unknown counts as resolved, so with Failed or Unknown among them the chip reads Partly sent; the Retry on the Updates row asks the same question once, only when an Unknown recipient is among those retried. After Maya checks Sent mail and sees it was delivered, Mark delivered (Updates row menu or editor footer) records the Unknown recipient as Sent; with nothing failed the update becomes Sent.

## STORY-211: Duplicate or delete a sent update
**Type**: short
**Topic**: Updates and board
**Persona**: Maya Chen
**Goal**: Reuse last month's text, and remove a wrong update
**Preconditions**: A sent September update that every investor contact with portal access can read.
**Ideal path**: 3 (row menu, Duplicate, edit)
**Alternate paths**: Draft with agent.
### Steps
1. Open the row menu on the September update (`#inv-updmenu`) → Duplicate and Delete. A sent update is read-only; there is no Edit.
2. Choose Duplicate → a new draft with the same audience and body opens in the editor; the sent update is unchanged.
3. Back on Updates, choose Delete on the sent update → a confirm dialog appears; confirming removes the row and its portal copy, so no investor sees it on their next portal request.
### Variations
- Delete a draft: its menu has Delete only, and it removes only the draft.
### Edge Cases
- Investors already have the email; deleting changes only the portal.
- Delete on an update that is Sending: not possible, the Sending row's menu is disabled (`#inv-sending`).

## STORY-212: Send with a revoked investor in the list
**Type**: short
**Topic**: Updates and board
**Persona**: Maya Chen, who revoked Sam Lind last month
**Goal**: Send the update without surprising anyone
**Preconditions**: Sam's Portal column reads "Revoked"; he is still an investor contact with an email.
**Ideal path**: 1 (Send)
**Alternate paths**: Unblock Sam first, then send.
### Steps
1. Open the draft → Sam Lind is greyed, unticked and says "revoked".
2. Click Send → the other ticked contacts each get an email with their own link; Sam gets nothing. He is blocked, so the portal refuses him whatever the update says.
### Variations
- Unblock Sam first (Contacts menu, `#inv-unblock`) → he is a normal ticked row again and Send mints him a new link, because Unblock does not restore old links.
### Edge Cases
- Sam's email holds old links and his old cookie; both stay dead, because Revoke deleted his tokens and sessions.

## STORY-213: The monthly routine with nothing to draft from
**Type**: short
**Topic**: Updates and board
**Persona**: Rina, brand-new founder with no investors yet, no Finance and no Gmail
**Goal**: Not be nagged by empty drafts
**Preconditions**: Investors visited once; the routine was seeded active on first visit.
**Ideal path**: 1 (nothing to do)
**Alternate paths**: Reminder, Off (STORY-206).
### Steps
1. On the 1st, 09:00 the routine runs → there is no investor contact with an email, so it saves no draft and sends no notification.
2. Rina adds her first investor contact with an email in November.
3. On Dec 1 the routine saves a draft and notifies "November update ready".
### Variations
- Rina turns the Reminder Off.
### Edge Cases
- An investor contact exists but Finance and Gmail do not: the draft is mostly TBD, and without Gmail the button is Post to portal (a board update would show "Connect Gmail to send").

## Gaps found
Open after round 5. Resolved and no longer listed: NG-28, NG-29, NG-30, PG-30 (round 3); NG-41 (To list line), NG-42 (portal notices), NG-43 (board without Gmail), NG-45 (Unknown state), NG-46 (Sending row), NG-52 (documented Duplicate, Send, Delete) (round 4).
- PG-29: TBD prompt on Post to portal (the plan describes it for Send only).
- PG-31: Connect Gmail destination and return.
- NG-53, NG-55, NG-56, NG-57, NG-58 are resolved in the round-5 plan (revoked and blocked contacts excluded, footer "Notifies n investors"; one link per contact; "n not notified" with Retry; Unknown resolved and Partly sent; Portal access in the Glossary). The copy-link list, the failed-notice row and the Unknown Retry question are not drawn.
- NG-60 resolved: Mark delivered is in the plan and drawn (`#inv-partly` row menu, `#ed-unknown` footer).
- NG-61 resolved: with no one to notify, the footer line is absent and Post to portal posts without a copy-link dialog; the footer reads "Notifies 1 investor" for one.
