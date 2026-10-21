# Topic: Audit requests (slice 7)

> **Superseded after the Astra plan review (see README, Review record):** a row no longer closes by itself when a reply is sent and a done row never reopens on a later message (including a thank-you). Only Mark done and Dismiss close a request. Stories below that describe automatic closing or reopening (the holding-reply story, NG-39) no longer apply.

Round 4 (no step changed; round 3 did not touch audits). Updated in round 3 against the plan after round 2 ("Audits": intake on arrival from the mail sync with a match rule and a daily cap, filed once, drafted, closed by a sent reply; no routine, no Add form) and the mockup views `#inv-audit` (row menu, New row, both warnings) and `#inv-auditdone` (Show done). Action item labels are from the mockup: "Audit request · Northwind Ventures Fund II", "Holdings as of Sep 30 · due Nov 15", chip "Draft ready", button "Open draft" (filled); "Audit request · Birch Audit LLP", "Sender not in Auditors · due Nov 30", "Holdings as of today, not Dec 31", chip "New", button "Open"; row menu Mark done, Dismiss; **Show done** is a button in the block header and becomes Hide done. Planned feature; all funds and people are invented. Gap tags: `PG-nn` round-1 gap still open; `NG-nn` gap from round 2 or 3 that is still open (see `../catalog.md`, "Plan gaps (round 4)").

## STORY-401: Plain email with a PDF confirmation letter, happy path
**Type**: long
**Topic**: Audit requests
**Persona**: Mara Quill, solo founder of a pre-seed company; Gmail and Carta connected; the sender is already an Auditors contact
**Goal**: Answer an audit confirmation from Northwind Ventures Fund II without writing the reply from scratch
**Preconditions**: Mail sync running; Data room auto-file on (the plan does not depend on it); a plain email "Audit confirmation request" with a 120 KB PDF "as of Sep 30" arrives.
**Ideal path**: 3 (see the notification, Open draft, send in Gmail; the row closes itself)
**Alternate paths**: Open the filed PDF from Documents first; ask the agent what it compared.
### Steps
1. The mail sync inserts the message and calls `enqueueAuditIntake` → the subject matches "audit" and the message has a document attachment (and the sender is an Auditor), so one `auditIntakeJob` is queued for it (at most 10 runs per user per day).
2. `runAuditIntake` files the PDF with `fileMailAttachment` (the same bytes already filed by auto-filing return the existing item), finds the sender among Auditors contacts (`senderKnown`), sees no `AuditRequest` for this thread, and queues one Investors agent run.
3. The `audit-response` skill reads the message and the filed item, extracts fund, as-of date and due date, and calls `audit_request_upsert` → a row appears under Action items: "Audit request · Northwind Ventures Fund II", chip "New", button "Open".
4. The agent builds the holdings statement from `cap_table_read`, finds supporting files with `search_data_room`, writes the reply with `mail_draft` in the thread with a "still needed from you" list, and moves the row to drafted → chip "Draft ready", the row reads "Holdings as of Sep 30 · due Nov 15", and the filled button reads "Open draft". One notification "Audit request from Northwind Ventures Fund II" is sent and the Investors sidebar row shows a dot.
5. Mara opens Investors → Action items is a bordered block; this row's button is the filled one.
6. Click Open draft → the Gmail draft opens in a new tab; she compares figures with the PDF (Documents row "Audit request, Northwind Fund II"), edits one line and sends from Gmail. The draft is text only (`mail_draft`), so any attachment is added by hand.
7. On the next mail sync the sent reply is cached with `fromSelf` after the row's `createdAt`; `closeAnsweredAuditRequests` marks the row done and it leaves Action items without a message.
### Variations
- The PDF text cannot be read by `mail_get`: the draft says to read the attached letter and the comparison is manual.
### Edge Cases
- Mara sends the reply and the next sync has not run: the row stays until it does.
- Mara deletes the Gmail draft and clicks Open draft. [plan silent: what the link opens (NG-13)]
- A later "thanks" from the auditor in the same thread after the row is done. The plan reopens a done row as New when a newer received message arrives, and intake treats the thread as a reminder. [plan silent: whether courtesy mail should reopen a request the founder closed (NG-39)]

## STORY-402: DocuSign envelope request
**Type**: medium
**Topic**: Audit requests
**Persona**: Mara Quill
**Goal**: Handle a DocuSign "please sign" notice from Ashgrove Partners Fund I's auditors
**Preconditions**: A DocuSign notice, no attachment; the body names the fund and a due date but shows no figures; the sender is not an Auditors contact.
**Ideal path**: 4 (see New, open, read the numbers, sign in DocuSign)
**Alternate paths**: none found
### Steps
1. The sync matches "DocuSign" and a DocuSign sender → intake runs even though nothing can be filed (it does not depend on the auto-file setting); the row appears: "Audit request · Ashgrove Partners Fund I", chip "New", "Sender not in Auditors · due <date>".
2. The agent drafts the answer: body only, with the numbers to compare, and no "sign it" verdict because there are no figures in the notice.
3. Read the row → button "Open draft" once drafted. While New with nothing filed, Open opens the mail thread in Inbox, where the DocuSign notice and its link are.
4. Mara signs in DocuSign from the original email → Rakazo is untouched.
5. No sent reply appears in the thread, so the row does not close itself; Mara chooses Mark done in the row menu.
### Variations
- The notice shows figures that match Carta: the note says they match; figures that differ: the draft is a reply to the auditor.
### Edge Cases
- A lookalike DocuSign mail: the "Sender not in Auditors" flag is the only warning; the agent does not follow links in the email.

## STORY-403: Portal-link request
**Type**: medium
**Topic**: Audit requests
**Persona**: Mara Quill
**Goal**: Track a request that only says "log in to the portal to respond"
**Preconditions**: An email with a portal link, no attachment; fund and as-of date in the body.
**Ideal path**: 4 (open the row, read the numbers, respond in the portal, Mark done)
**Alternate paths**: none found
### Steps
1. Intake creates the row (New) with fund, as-of date and due date.
2. The agent builds the statement and saves a Gmail draft in the thread (text only). While New, Open opens the mail thread in Inbox; the draft is a reply to the sender even though the real answer goes into the portal.
3. Mara copies the figures from the draft, follows the portal link from the original email and submits there; computer-use filling of portals is a follow-up.
4. No reply leaves Gmail, so nothing closes the row; she chooses Mark done.
### Variations
- The portal wants a signed PDF: out of scope.
### Edge Cases
- The due date is missing: the row sorts after rows with a due date (order: due date first, then newest).

## STORY-404: Dismiss a false positive
**Type**: short
**Topic**: Audit requests
**Persona**: Mara Quill
**Goal**: Remove a row that is not a real request
**Preconditions**: A valuation vendor's invoice email with a PDF attached and "409A" in the subject matched intake; the row "Audit request · Redwood Valuation" is New.
**Ideal path**: 2 (row menu, Dismiss)
**Alternate paths**: Ask the agent to dismiss it.
### Steps
1. Open the "…" on the row → Mark done, Dismiss.
2. Choose Dismiss → the row is hidden and keeps its dedupe key.
3. A later message on the same thread arrives → it is treated as a reminder (updates `lastMailAt` only); the row does not come back.
### Variations
- The row had a filed attachment: the Data room item stays.
### Edge Cases
- A dismissed row by mistake: Show done lists done and dismissed rows (STORY-411).
- A newsletter that matches a keyword but has no attachment, no Auditor sender and no DocuSign sender starts no agent run, and runs are capped at 10 a day; a vendor email with a PDF still does, which is why this false positive exists.

## STORY-405: A request that arrived outside Gmail
**Type**: medium
**Topic**: Audit requests
**Persona**: Mara Quill
**Goal**: Track a request the fund's CFO sent as a PDF over chat, and get a draft
**Preconditions**: The PDF is on her laptop; nothing in her mailbox.
**Ideal path**: 3 (upload the PDF, Ask with the details, Open draft)
**Alternate paths**: Forward the PDF to herself from chat; intake then runs on arrival.
### Steps
1. In the Data room use Add files → the PDF is filed.
2. On Investors click Ask and write "audit request from Cedar Hollow Fund, as of Dec 31, due Mar 15, file is in the Data room, use @audit-response" → the agent reads the item with `read_data_room_item`.
3. The agent calls `audit_request_upsert` with no thread → a row appears (New, then Draft ready if it can draft). There is no Add form on the page; asking the agent is the way.
4. Mara opens the draft → with no thread the draft is a new message to the sender; Open opens that draft.
### Variations
- The same request later arrives by email: its thread is new but (fund, as-of) matches, so the existing row is updated.
### Edge Cases
- No Gmail connected: the agent says it cannot draft and the row stays New.

## STORY-406: A request arrives off-season
**Type**: medium
**Topic**: Audit requests
**Persona**: Mara Quill, today is Oct 20
**Goal**: A fund with a June fiscal year sends a confirmation in October; she wants it found without doing anything
**Preconditions**: No routine exists; intake runs on mail arrival all year.
**Ideal path**: 2 (notification, Open draft)
**Alternate paths**: none found
### Steps
1. The email arrives Oct 14; the next sync queues intake as in STORY-401.
2. Mara gets "Audit request from Cedar Hollow Fund" and a dot on the Investors row.
3. She opens Investors → the row is in Action items, sorted by due date, then newest.
4. Open draft → Gmail.
### Variations
- The sync runs while Mara is offline: the notification is waiting when she returns.
### Edge Cases
- The mail was older than the sync window when Gmail was first connected. Only mail the sync inserts is considered; old mail is reached by asking the agent (STORY-409).

## STORY-407: The same fund sends a reminder
**Type**: medium
**Topic**: Audit requests
**Persona**: Mara Quill
**Goal**: Not get a second row when the fund follows up
**Preconditions**: A Draft ready row for Northwind Ventures Fund II, as of Sep 30; the draft is unsent.
**Ideal path**: 1 (nothing: the row is unchanged)
**Alternate paths**: none found
### Steps
1. A "second notice" arrives on the same thread → intake sees an `AuditRequest` for the thread and updates `lastMailAt` only; no agent run, no new row.
2. The fund opens a fresh thread for the same fund and as-of date → the agent's `audit_request_upsert` dedupes on (fund, as-of) and updates the same row.
3. The fund corrects the as-of date to Dec 31 → a different (fund, as-of) key, so a second row appears; Mara dismisses the old one.
### Variations
- A reminder after the row is done: the thread has a request, so it only touches `lastMailAt`.
### Edge Cases
- A dismissed fund and as-of stays dismissed.

## STORY-408: SAFE holder versus equity holder, and as-of mismatch
**Type**: long
**Topic**: Audit requests
**Persona**: Mara Quill, with a fund holding a SAFE and a fund holding preferred shares
**Goal**: Each statement says the right thing at the right date
**Preconditions**: Two rows: Harbor Lane Ventures (a $50,000 post-money SAFE, Signed) and Fenwick Ridge (120,000 Seed Preferred). The Carta snapshot is "as of Sep 30"; both requests ask for Dec 31.
**Ideal path**: 6 (open each row, compare, edit, send, repeat)
**Alternate paths**: Ask the Investors agent for changes since Dec 31.
### Steps
1. Open Action items → both rows read "Holdings as of today, not Dec 31" in the warning style (`asOfMatched` false).
2. Open Harbor Lane's draft → the statement lists a $50,000 post-money SAFE, no shares issued, from `cap_table_read`, which now returns SAFEs.
3. Open Fenwick Ridge's draft → 120,000 Seed Preferred.
4. Ask the agent "any issuances since Dec 31?" → it answers from the snapshot and the SAFE rows; the Carta "as of" support is still an open item in the plan.
5. Mara edits each draft to say the figures are as of today, sends both from Gmail → each row closes on the next sync.
### Variations
- A holder with both a SAFE and shares: one draft with two lines.
- Source is a sheet or typed in: the same fallback applies.
### Edge Cases
- The auditor's figures differ from Carta: the draft lists each difference.

## STORY-409: A request the matcher missed, ask the agent
**Type**: short
**Topic**: Audit requests
**Persona**: Mara Quill
**Goal**: Get a row for an email whose subject and snippet never mention audit, confirmation, 409A or DocuSign
**Preconditions**: The email "Quick question on holdings" from an auditor sits in the inbox; nothing matched.
**Ideal path**: 2 (Ask, read the answer)
**Alternate paths**: none found
### Steps
1. Click Ask on Investors → the Investors agent panel opens.
2. Write "the email 'Quick question on holdings' is an audit request, please draft the reply" → the agent finds it with `mail_search`, runs `audit_request_upsert` and `mail_draft`, and answers in chat.
3. The row appears in Action items (the page picks it up on its next load).
### Variations
- The agent also drafts only; it never sends.
### Edge Cases
- Mobile: the chat works, the Action items list does not exist.

## STORY-410: A reply closes the row, and Mark done is the fallback
**Type**: medium
**Topic**: Audit requests
**Persona**: Mara Quill
**Goal**: Know when a row closes by itself and when she has to close it
**Preconditions**: Two rows: one Draft ready (mail thread), one DocuSign row with no reply expected.
**Ideal path**: 2 (send; for the DocuSign row, Mark done)
**Alternate paths**: none found
### Steps
1. Mara sends the Gmail draft → on the next sync the row leaves Action items with no message.
2. For the DocuSign row she signs in DocuSign → nothing reaches the thread; she opens the row menu and chooses Mark done.
3. Another row: she first sends a short holding reply, "will answer Friday" → the sync sees a sent message in the thread after the row's creation and closes the row. Any sent reply closes; a newer received message later reopens the row as New.
4. Choose Show done in the Action items header → finished rows are listed as history.
### Variations
- Dismiss and Mark done differ only in what the history shows.
### Edge Cases
- The reply goes out from another mail client, not Gmail: no sent message is cached, so the row stays.

## STORY-411: Show done, the history
**Type**: short
**Topic**: Audit requests
**Persona**: Mara Quill
**Goal**: Check what she answered last quarter
**Preconditions**: Three done rows and one dismissed row; at least one open row.
**Ideal path**: 1 (Show done)
**Alternate paths**: none found
### Steps
1. Click "Show done" in the Action items block header (`#inv-auditdone`) → the button becomes "Hide done" and finished rows are listed with fund, as-of date and done date, including the dismissed row.
2. Click "Hide done" → the list returns to open rows.
### Variations
- A done row reopens as New when a newer message arrives in its thread.
### Edge Cases
- With no open rows the Action items block is absent and Show done is not offered, so history cannot be reached from the page then (by design). Ask the agent.
- A dismissed row stays dismissed even when a reminder arrives; the page has no restore.

## STORY-412: Sender not in Auditors
**Type**: short
**Topic**: Audit requests
**Persona**: Mara Quill
**Goal**: Mark a legitimate new auditor as known
**Preconditions**: A row "Audit request · Birch Audit LLP", chip New, "Sender not in Auditors · due Nov 30".
**Ideal path**: 3 (read the flag, add the auditor, continue)
**Alternate paths**: Dismiss the row if it is not legitimate.
### Steps
1. Read the row → the flag says the sender is not an Auditors contact.
2. Click Add contact in the header → the dialog creates an Auditors contact with the sender's email.
3. Return to the row → the flag stays, because `senderKnown` was stored at intake. [plan silent: whether the flag clears once the auditor exists (NG-12)]
### Variations
- The sender is added from the Auditors tab instead.
### Edge Cases
- A lookalike sender: Mara does not add it and dismisses the row.

## Gaps found
Open after round 5. Resolved in round 2 and no longer listed: PG-54 (Show done), PG-58, PG-59, NG-10, NG-11.
- NG-12 (nice): sender flag after adding the auditor.
- NG-13 (nice): Open draft after the Gmail draft was deleted.
- NG-39 (new, nice): a done row reopens as New on any later received message, including a courtesy reply.
