# Topic: Meeting follow-ups in the Inbox (prefix IF)

Scope: Granola S5 (`docs/plans/granola.md`, "Digest and Inbox follow-ups", slice S5) as it meets the existing Inbox. Existing code read: `apps/api/src/inbox.ts` (`inboxTodosList`, `inboxTodoSetDone`, `inboxList`, `inboxUnreadCount`), `packages/adapters/src/inbox-triage.ts` (`triageStatus`), the `InboxTodo` model in `packages/db/prisma/schema.prisma`, web `apps/web/src/pages/Inbox.tsx` and `apps/web/src/components/inbox/TodoCard.tsx`, mobile `apps/mobile/app/inbox.tsx`. No mockup for this topic was available. Invented people and data only.

Facts from code that shape every story (all [exists] today):
- `inboxTodosList` returns `{ enabled: false, todos: [] }` unless mail triage is ready, and filters to `connectionId in connectedMailConnections` (`inbox.ts`, `inboxTodosList`).
- `inboxTodoSetDone` requires `connection.status: "connected"` in its where clause, so a to-do of a disconnected connection returns NOT_FOUND (`inbox.ts`, `inboxTodoSetDone`).
- `InboxTodo` is unique on `(userId, messageId)` and has `connectionId` required today (schema). S5 changes this (granola.md, "Data model", line on `InboxTodo.meetingId`).
- Web: `inboxList` with no mail connection returns early with no rows; the page then shows the empty state "No mail connected / Connect Gmail to read, sort and answer your mail here." with the button "Connect mail" (`Inbox.tsx`). The "To do" card renders only when `triage && !sorting && pile === "important"` and consent is not pending (`showTodos`). The card returns nothing when there are no visible to-dos (`TodoCard.tsx`: `if (visible.length === 0) return null`).
- Web to-dos are fetched per account tab: `rpc.inbox.todos.list(tab ? { connectionId: tab } : {})`.
- Mobile: `fetchList` clears the to-do list when `list.accounts.length === 0 || !list.enabled`; the empty screen with no account is a single "Connect mail" button.
- A to-do row shows the checkbox (accessible name = to-do text), the text, a small line `from · detail`, and a due label. The text is a link that opens the source email only when `messageId` is set (web `onOpen`). Mobile has no open-email link on a to-do.
- The sidebar Inbox unread badge counts only unread mail threads (`inboxUnreadCount`).
- The same "what I owe" information can appear on three surfaces: the Inbox "To do" card, the Granola agent's chat answer, and (S7) the agent's weekly memory entries. Noted per story for redundancy analysis.

---

## STORY-IF-1: Meeting-only founder finds her follow-ups in the Inbox
**Type**: long
**Topic**: Meeting follow-ups, meeting-only user versus user with mail
**Persona**: Maya Okafor, founder of Fernhill Labs (example.com). Uses Granola for every call, reads email in Superhuman, never connected Gmail to Rakazo.
**Goal**: After a pricing call, see "what I promised" in Rakazo without retyping it, and tick items off.
**Preconditions**: Maya has pasted a Granola API key on the Granola card (S6) and the first sync finished. AI data sharing is allowed for her model. No mail connection. Signed in as maya@fernhill.example.com; the meeting attendee list includes that address. The call "Pricing review" ended 20 minutes ago.
**Ideal path**: 3. Open Inbox; see the "To do" card with the meeting items; tick one. No extra setup step should stand between her and the items.
**Alternate paths**: Ask the Granola agent in chat "what did I promise in the pricing review?" [exists as a concept; planned: Granola S4 `meetings_*` tools]. Shows the same commitments as text, with no checkbox.
**Plan status**: Sync and digest [planned: Granola S3, S5]; Inbox sidebar entry [exists]; "To do" card for a user with no mail account [planned: Granola S5, but the empty state "No mail connected" is [exists] and takes the whole page]; tick [planned: Granola S5].
### Steps
1. Maya opens the sidebar "Inbox" → [exists] the page loads; `inbox.list` returns no accounts and `rows: []`.
2. Web shows the empty state "No mail connected" with "Connect mail" → [exists]. GAP: granola.md S5 says the list is shown "even with no mail account, with an empty state for a connected meeting source and no to-dos", but does not say where the "To do" card sits on a page whose only content today is the "No mail connected" empty state, or whether that state stays above or below the card (granola.md, "Digest and Inbox follow-ups", last bullet).
3. Maya, expecting follow-ups, reads "Connect Gmail to read, sort and answer your mail here" and hesitates; she does not own a Gmail account she wants connected → she scrolls looking for her meeting items. If the card is placed below the empty state she finds "To do" with "Send Dana the revised pricing" and "From: Pricing review, 12 Oct" [planned: Granola S5].
4. She notices the row has no sender name (mail rows show the sender in the small line; meeting rows have `from: null`) and no link; the text is plain → she cannot open the meeting (no meetings page by design, granola.md "Out of scope").
5. She ticks "Send Dana the revised pricing" → [planned: Granola S5] the checkbox fills, the text gets a strike-through, and after about 1.5 seconds (400 ms strike plus 1100 ms fade, `TodoCard.tsx`) the row collapses and leaves.
6. She reloads the page → the ticked item stays gone; open items remain.
### Variations
- Phone width: the card shows the first 2 open items and a "{n} more" button (`COLLAPSED_OPEN = 2`).
- Mobile: `fetchList` clears todos when `accounts.length === 0`, so unless S5 changes it, the mobile screen shows only the single "Connect mail" button. GAP in the plan's text: it lists `apps/mobile/app/inbox.tsx` as touched but defines no mobile layout for zero accounts.
### Edge Cases
- The Inbox agent panel and search bar are hidden when there are no accounts (`show = accounts.length > 0` on mobile; "Nothing to search or filter before mail is connected" on web), so a meeting-only user has no search over their to-dos.
- Maya may tick the wrong item and untick it within the fade window; the fade cancels (`TodoCard.tsx` effect). After the row has left, there is no "show done" view, so a mistaken tick cannot be undone from the list. [exists, same for mail to-dos]
- The sidebar Inbox badge stays at 0 because it counts unread mail only, so new meeting to-dos produce no signal (`inboxUnreadCount`). Plan is silent.

---

## STORY-IF-2: Founder with Gmail and Granola sees both kinds of to-dos
**Type**: medium
**Topic**: Meeting follow-ups, user with mail
**Persona**: Tomas Reyes, CEO of Bright Harbor (example.org). Gmail connected as the account "Work"; Granola API key synced.
**Goal**: See one list of what he owes, from email and from meetings, and know where each came from.
**Preconditions**: Mail triage is ready. Triage created two mail to-dos ("Sign the vendor form", due Friday; "Reply with venue options"). The digest of "Board prep" created "Send the updated runway slide to Priya" from a meeting. Two Gmail accounts connected: "Work" and "Personal".
**Ideal path**: 1. Open Inbox; the single "To do" card shows all three.
**Alternate paths**: Switch the account tab to "Work" or "Personal" and read the card again; ask the Inbox agent panel.
**Plan status**: Mail to-dos [exists]; combined list [planned: Granola S5]; per-tab behaviour for meeting to-dos: GAP.
### Steps
1. Tomas opens Inbox on the "All" tab → [exists] mail rows load; the "To do" card appears above them on the Important pile.
2. The card lists the two mail to-dos with a sender plus reason line, and the meeting to-do with "From: Board prep, 14 Oct" only [planned: Granola S5] → he can tell the source from the small line, but there is no icon, label or link difference besides that the mail items are links and the meeting item is plain text. GAP: plan does not define a visual cue for meeting versus mail; the only difference is the detail string (granola.md, "Digest and Inbox follow-ups").
3. He clicks the mail to-do text "Reply with venue options" → [exists] the email opens in a dialog. He clicks the meeting item text → nothing happens (no `messageId`, so it is not a link) and he clicks twice more.
4. He selects the "Work" tab → the web client calls `rpc.inbox.todos.list({ connectionId })`. GAP: meeting to-dos have `connectionId` null (granola.md, Data model), and `inboxTodosList` filters by `connectionId` when given. The plan says the list returns "mail to-dos as today plus meeting to-dos" but does not say whether a filtered tab keeps or drops meeting items. If dropped, the item vanishes on every account tab; if kept, it appears on both "Work" and "Personal".
5. He returns to "All" → the three items are back.
### Variations
- Tomas ticks the meeting item from the "All" tab; the cached lists of other tabs (`todosByTab`) still hold the open copy until `todoRefresh` runs, so "Work" may briefly show it as open. [exists behaviour for mail to-dos; applies equally]
### Edge Cases
- Due-date ordering: the card orders by creation time with done items last, not by due date (`orderBy createdAt asc`). A meeting commitment due tomorrow can sit below a mail to-do due next month.
- Identity: Tomas's Gmail account address and his sign-in email differ (tomas@brightharbor.example.org versus tomas.reyes@example.net). Either matches for ownership (granola.md, Identity), so the commitment still becomes his.

---

## STORY-IF-3: Completing a to-do after disconnecting Granola
**Type**: medium
**Topic**: Meeting follow-ups, completing after disconnect
**Persona**: Priya Nair, head of ops at Lantern Row (example.com). Disconnected Granola last week because she is switching tools, but still has open commitments.
**Goal**: Finish and tick the follow-ups that were already created.
**Preconditions**: Three open meeting to-dos exist. Priya clicked "Disconnect" on the Granola card (S6): secret deleted, sync stopped, connection row kept as `disconnected`, no confirm about data. She has no mail account.
**Ideal path**: 2. Open Inbox; tick the item.
**Alternate paths**: Ask the Granola agent for the list [planned: S4]; the agent still reads stored meetings if the agent exists.
**Plan status**: Disconnect [planned: Granola S6]; list and complete after disconnect [planned: Granola S5]; today's `inboxTodoSetDone` requires `connection.status: "connected"` [exists] and would return NOT_FOUND.
### Steps
1. Priya opens Inbox → the three items still show [planned: Granola S5; they must be listed "regardless of any connection's status"].
2. She ticks the first → [planned: Granola S5] the item completes. This works only because meeting to-dos have a null `connectionId`, so the `connection: { status: "connected" }` clause in `inboxTodoSetDone` must not apply to them.
3. She ticks a second item → if the setDone check were left as today, the request fails and the card shows the generic error line from `errorText`, with the checkbox state unchanged. The plan names this failure and its test ("completing after the source is disconnected").
4. She wonders whether disconnecting deleted her meetings and decides to check: she opens the Granola card → status shows disconnected. GAP: S6 copy lists "Disconnect" and the status/error strings but no line that says stored meetings and to-dos were kept (granola.md, Surfaces and S6 behaviour: "no data deletion, no confirm about data"). A cautious user cannot tell from the UI whether her notes are still there.
5. She reconnects later with the same key → sync resumes; the existing to-dos are not duplicated (unique on user, meeting, normalized text).
### Variations
- Priya also removes the Granola agent. To-dos still appear (granola.md, Agent provisioning, last bullet). She has no agent to ask about context, and no meeting screen, so the to-do text is all she has.
### Edge Cases
- A user whose mail connection is disconnected has the same stranding problem for mail to-dos today ([exists]); the plan fixes it only for meeting to-dos.
- Disconnecting the source while a digest job is queued: the digest reads stored meetings, not the source, so it can still add to-dos after disconnect. The plan does not say whether this is wanted (granola.md, S3/S5 behaviour), so a user may see a new to-do appear after she thought she had stopped Granola. Severity low.

---

## STORY-IF-4: No identity match, so no to-dos but the digest is stored
**Type**: medium
**Topic**: Meeting follow-ups, identity
**Persona**: Jonas Weber, solo consultant at Weber Advisory (example.net). Signs in to Rakazo with a personal address, jonas.w@example.org, but is invited to meetings as jonas@weberadvisory.example.net, a work address he has not connected.
**Goal**: Get his commitments from yesterday's client call into the Inbox.
**Preconditions**: Granola synced. No mail account connected. The attendee list shows jonas@weberadvisory.example.net. Granola's `speaker.attribution: "me"` is not present in the digest.
**Ideal path**: 2. Open Inbox; see the follow-ups. In reality the path ends with no items.
**Alternate paths**: Ask the Granola agent "what did I promise?" [planned: S4]. This works because "the digest is still stored and the agent can still answer from it" (granola.md, Identity).
**Plan status**: Identity matching [planned: Granola S5]; any UI that says why nothing appeared: GAP.
### Steps
1. Jonas opens Inbox after the call → the page shows "No mail connected" [exists], no "To do" card.
2. He waits 10 minutes, reloads, and checks again → nothing. There is no status such as "meeting analyzed, no commitments matched your email".
3. He asks the Granola agent "what did I promise Anna?" → the agent answers from the stored meeting and cites it, listing two commitments. He now sees information on one surface (chat) that is absent on another (Inbox) and cannot tell why.
4. He asks "why aren't these in my Inbox?" → GAP: the agent has no tool for explaining digest ownership results, and the plan defines no user-visible reason. The plan notes only that creation "is suppressed" (granola.md, Identity).
5. He connects his work Gmail account to fix it → the connected account's address joins the identity set; GAP: the plan does not say whether the already-stored digest is re-evaluated, so the earlier commitments may never become to-dos (granola.md, S5 behaviour: digest runs "after a meeting is stored").
### Variations
- The digest labels the speaker with the first name only ("Jonas") and the attendee has an email. Matching is by email against the owner field, so a name-only owner never matches.
- A different person in the meeting shares a nickname with the user. The regression "a commitment by someone else is never added to the user's to-dos" covers this; the user sees nothing and cannot audit.
### Edge Cases
- User.email is a valid identity even with no mail connection (granola.md, Identity), so any user whose sign-in email appears among the attendees is matched.
- Case differences in the address are matched case-insensitively.

---

## STORY-IF-5: AI consent is off
**Type**: medium
**Topic**: Meeting follow-ups, AI-data consent
**Persona**: Elena Petrova, controller at Marlowe Freight (example.com). She declined AI data sharing for her model when first asked in Gmail triage. She now has Granola only.
**Goal**: Understand why her meeting follow-ups never show up.
**Preconditions**: Granola synced; no mail account; AI-data consent for her model's recipient is not recorded.
**Ideal path**: 3. Open Inbox; see a clear prompt; allow; see items. In the plan, the digest "runs only with AI-data consent" (granola.md, Digest) but where the user is asked is not defined.
**Alternate paths**: Settings, AI data sharing (named in granola.md Open questions as "the existing AI data sharing setting") [exists].
**Plan status**: Digest gate [planned: Granola S5]; consent prompt for a meeting-only user: GAP.
### Steps
1. Elena opens Inbox → [exists] `inbox.list` returns `triageBlocked: { reason: "needs_consent", recipient }` (from `triageStatus`) but the web page shows the empty state "No mail connected" first, and the consent card `InboxConsentPrompt` lives only in the branch for a loaded mail list. GAP: with zero accounts she never sees the consent prompt (Inbox.tsx).
2. She sees no to-dos and no explanation. After three days she asks the Granola agent about her calls → the meeting tools also require consent (granola.md, Reading) so the agent says it cannot read meetings, or answers from live MCP if the tile exists. The reason shown is the agent's text only.
3. She finds Settings → AI data sharing, allows the recipient → [exists] consent saved.
4. She returns to Inbox → no to-dos yet. GAP: the plan does not say whether meetings stored while consent was off get a digest after consent (the digest job "runs only with AI-data consent"), so old meetings may stay undigested forever.
5. After the next meeting ends she sees one new to-do.
### Variations
- Elena has Gmail and Granola. She sees the consent card on the Important pile (existing behaviour, `shown.triageBlocked.reason === "needs_consent"`), and allowing it queues mail triage. GAP: whether Allow also queues meeting digests is unstated.
- She allows consent for the mail model but the digest uses the user's "configured model", possibly a different recipient; no single consent covers both unless they match (granola.md, Digest).
### Edge Cases
- Consent withdrawn later: existing open to-dos stay visible; `inboxTodosList` returns no to-dos when `enabled` is false for mail today. The plan says `enabled` becomes true if the user has meeting to-dos, so withdrawing consent would still show previously created meeting items. Plan does not say whether that is intended.
- Mobile: no consent card was found in `apps/mobile/app/inbox.tsx` for this state, only the zero-account button.

---

## STORY-IF-6: The same commitment appears from two meetings
**Type**: short
**Topic**: Meeting follow-ups, duplicate commitments
**Persona**: Samir Haddad, VP sales at Cobalt Mills (example.org). Said "I'll send the revised pricing to Dana" on a Monday call and repeated it on Wednesday's follow-up.
**Goal**: See one open item for one promise.
**Preconditions**: Both meetings are synced and digested. Digest text: Monday "Send Dana the revised pricing"; Wednesday "Send the revised pricing to Dana by Friday".
**Ideal path**: 1. A single to-do on the card.
**Alternate paths**: none found.
**Plan status**: dedupe key `(userId, meetingId, normalized text)` [planned: Granola S5].
### Steps
1. Samir opens Inbox → the card shows "Send Dana the revised pricing" (From: Pricing review, 12 Oct) and "Send the revised pricing to Dana by Friday" (From: Pricing follow-up, 14 Oct, due Fri). Two rows for one promise, since the key includes `meetingId` and the text differs; even identical text from two meetings would yield two rows. GAP: the plan defines dedupe within a meeting, not across meetings (granola.md, Digest and Inbox follow-ups).
2. He ticks the first, then the second → the same action done twice.
3. Next Monday's sync adds nothing new, but if the digest re-runs for an updated note (newer `sourceUpdatedAt`), a reworded commitment could produce a third row. Whether a re-digest of the same meeting creates new rows with new wording is not stated (granola.md, Sync says newer updates replace the meeting; S5 says "deduplicated"). Severity med.
### Variations
- Samir has already ticked the Monday item and then the Wednesday meeting repeats it: a new open item appears for a thing he finished.
### Edge Cases
- The card has no grouping or "from 2 meetings" cue; the detail line fits one meeting only.
- Long detail lines are truncated (`truncate` class in `TodoCard.tsx`), so both rows may look similar at narrow widths.

---

## STORY-IF-7: A to-do cites a meeting the user later deleted in Granola
**Type**: medium
**Topic**: Meeting follow-ups, source deleted
**Persona**: Hannah Cole, partner at Quill & Pine (example.com). Deleted a confidential call, "Layoff planning", in Granola last night, but Rakazo created a to-do from it yesterday afternoon.
**Goal**: Have the deleted meeting's follow-up and stored notes go away, or at least know they remain.
**Preconditions**: Personal Granola API key. The to-do "Draft the severance memo" with detail "From: Layoff planning, 15 Oct" is open. Retention is permanent (granola.md, Data model, retention).
**Ideal path**: 2. See that the item is tied to a deleted meeting, and remove it. In the plan no such path exists.
**Alternate paths**: Tick the item (marks done, does not delete it). Ask the agent to forget the meeting: no such tool (the meeting tools are read-only, granola.md, Reading).
**Plan status**: Deletion not mirrored [planned: Granola Sync, "Deletions: Granola deletions are not mirrored"]; no delete for meetings or to-dos: GAP.
### Steps
1. Hannah opens Inbox next morning → [planned: Granola S5] the item "Draft the severance memo — From: Layoff planning, 15 Oct" is still listed; the synced copy remains because a personal key cannot see `deleted_at` (granola.md, Sync).
2. She expects deletion in Granola to carry over and is unsettled to see the title → she ticks the item to clear it; it fades out. The row is marked done, not deleted (`doneAt` set); the `InboxTodo` row and the `Meeting` row with its transcript stay (no delete-on-disconnect, no expiry).
3. She asks the Granola agent "what do you have on Layoff planning?" → the agent still answers from the stored meeting (granola.md, Retention). She now has data in Rakazo she believed deleted.
4. She looks for a way to delete the stored meeting → GAP: no UI, RPC or agent tool deletes a stored `Meeting`; the plan mentions that the account export includes meetings and nothing about erase (granola.md, S1 behaviour). Severity high for privacy.
5. She disconnects Granola, hoping that clears the data → disconnect keeps all meetings and to-dos by design (S6), so the item is still there.
### Variations
- Detail text is plain text with no link, so there is no dead link to a missing meeting; the user sees only a title and date.
- If a to-do was completed already, the user never sees the meeting again in the Inbox, but the transcript remains stored.
### Edge Cases
- A tombstone exists in the S1 repository for providers that report deletions (granola.md, S1 behaviour), but the Granola adapter "never reports deletions", so it is unused for Granola.
- A shared note deleted by its owner leaves the same artifact for every recipient's sync.

---

## STORY-IF-8: Connected Granola, no commitments yet
**Type**: short
**Topic**: Meeting follow-ups, empty state
**Persona**: Leo Marsh, designer at Tideway Studio (example.net), just connected Granola this morning.
**Goal**: Know whether the Inbox follow-up feature is working.
**Preconditions**: Granola connected, first sync running or finished, no meeting to-dos, no mail account.
**Ideal path**: 1. Open Inbox; see one line that says follow-ups from meetings will appear here.
**Alternate paths**: Open the Granola card; it shows "Synced {n} meetings, {relative time}".
**Plan status**: Empty state for connected source and no to-dos [planned: Granola S5, wording not given: GAP]; `TodoCard` returns null when empty [exists].
### Steps
1. Leo opens Inbox → [exists] "No mail connected / Connect Gmail to read, sort and answer your mail here." with "Connect mail".
2. He thinks Rakazo wants Gmail for meeting notes and follows the button → Settings, Integrations opens [mobile pushes `/integrations`]. He connects nothing, returns.
3. He checks the Granola card → "Synced 12 meetings, 3 min ago" [planned: S6]. He sees the meetings synced and no to-dos in the Inbox, with no sentence connecting the two.
4. GAP: the plan requires "an empty state for a connected meeting source and no to-dos" but gives no text, and AGENTS.md requires quoting copy and justifying it in the PR. The risk is the opposite: adding a line that repeats the interface.
### Variations
- Digests failed and were silent (granola.md, Digest: "failed and silent after retries"); Leo cannot tell failure from "no commitments".
### Edge Cases
- Leo has the Granola MCP tile only (no API key): no sync, no digest, no to-dos. The Inbox looks identical to the story above; nothing says the API key card is what feeds it.

---

## Journey failures and gaps

1. Meeting-only user lands on "No mail connected" with no stated placement for the "To do" card (web `Inbox.tsx` empty state; granola.md S5 "show the to-do list ... with an empty state"). Plan section: Digest and Inbox follow-ups, Retrieval and completion. Severity: high.
2. Mobile Inbox clears to-dos when there are zero accounts or `enabled` is false, and the screen shows only "Connect mail"; plan lists the file but defines no zero-account layout. Plan section: S5 Owns. Severity: high.
3. Consent prompt (`InboxConsentPrompt`) is reachable only with a loaded mail list; a meeting-only user with consent off sees nothing explaining why no to-dos arrive. Plan section: Digest ("runs only with AI-data consent"), Open questions on the consent note. Severity: high.
4. Meetings stored while consent was off, or before an identity existed, may never be digested or re-evaluated. Plan section: S5 Behaviour. Severity: med.
5. No stored-meeting deletion path (UI, RPC or agent tool), and Granola deletions are not mirrored, so a deleted confidential meeting remains in Rakazo and its to-do stays. Plan sections: Data model retention, Sync "Deletions". Severity: high.
6. Duplicate commitments across meetings are not merged (dedupe key includes `meetingId`); a re-digest may add reworded duplicates. Plan section: Digest and Inbox follow-ups. Severity: med.
7. Account-tab filtering for meeting to-dos (`connectionId` null versus `inbox.todos.list({ connectionId })`) is not defined; items can vanish or repeat across tabs. Plan section: Retrieval and completion. Severity: med.
8. No cue to tell meeting to-dos from mail to-dos, and no way to open the source meeting (plain text, `from` null); the only context is the detail string or asking the agent. Plan sections: Digest, Out of scope (no meetings page). Severity: med.
9. No-identity-match gives no visible reason; the agent cannot explain it; connecting Gmail later may not recover earlier commitments. Plan section: Identity. Severity: med.
10. Empty-state copy for a connected source with no to-dos is unspecified, and the card returns nothing when empty today, so "digest failed" and "no commitments" look the same. Plan section: Retrieval and completion. Severity: low.
11. Disconnect gives no statement that stored meetings and to-dos were kept. Plan section: S6 behaviour, Surfaces copy. Severity: low.
12. Sidebar Inbox badge counts unread mail only, so meeting to-dos never signal; a meeting-only user may not open the Inbox at all. Plan section: Security (notifications), S5 Owns. Severity: low.
13. A queued digest can add to-dos after the user disconnects Granola, and withdrawing consent keeps previously created meeting items visible. Plan sections: S3/S5 behaviour, Retrieval and completion. Severity: low.
