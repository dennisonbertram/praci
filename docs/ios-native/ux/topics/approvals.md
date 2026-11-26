# Approvals in a thread: user stories (built iOS app)

Scope: the approval cards in `apps/ios/Sources/Praci/Thread/Approvals/*` (ask, choice, mail, secret, MCP server, connect app, info card), their models in `Packages/RakazoAPI/.../Models/Approvals.swift`, and the answer path in `ApprovalModel.swift`. All people, companies and amounts are invented. Everything below is read from code; nothing was run on a device or simulator. This file replaces the earlier planning-only stories, which are kept in `approvals-consent.md` (settings rules and AI data consent stay there).

Facts that shape the stories:
- The server owns each card's state. After every answer, and after a `CONFLICT` error, the client re-reads the thread. Answered, expired and replaced cards render read-only from the block itself.
- Only one ask is answerable at a time: the latest ask message whose run has status `waiting_input` (`answerableAskMessageID`). Older pending asks show "No longer active".
- The approval reason line (`approvalReason`) is drawn as plain footnote text under the card. iOS has no special handling for the "Firewall" reason or for "This chat read a meeting, so it asks first.". The web card adds a "Clear conversation" link next to the meeting reason; iOS shows only the sentence and has no Clear conversation action anywhere (the thread menu offers Open computer, Artifacts, Agent page, Settings, Archive agent).
- On the mail card the reason is shown only while the card is still waiting; on the standard ask card it stays after the answer.
- No card has an iOS-specific push or notification entry; opening the thread is the only route to a card.

## STORY-001: Allow a payment tool once

**Type**: short
**Topic**: Approvals in a thread
**Persona**: Priya Nandakumar, founder of a 6-person logistics startup, Mercury agent connected
**Goal**: Let the agent send a pilot invoice payment after reading what it will do
**Preconditions**: Signed in, Mercury agent thread open, run is `waiting_input`, latest ask has actions allow, always, deny and an `approvalEffectId`
**Ideal path**: 2. Read the card, tap the one prominent button. The payment label already says the amount, so no second confirmation is needed.
**Alternate paths**: Answer the same card from the web app or Expo app; the iOS card changes to the resolved line after the next thread refresh. Settings > "Allowed without asking" can pre-approve the tool so the card never appears.

### Steps
1. Open the Mercury agent from Home → the thread ends with a card titled with the agent's question, a monospaced detail well, and three full-width buttons.
2. Read the amount in the button label "Send $300.00" (labels starting "Send " are kept as the server wrote them) → the button is the prominent one; "Always allow" is secondary and "Deny" is plain grey-tinted.
3. Tap "Send $300.00" → the tapped button shows a spinner and the other two are disabled.
4. The answer is accepted → the buttons are replaced by a green check line "Allowed once", or "Approved here. Waiting for Mercury" when the block has `waitsFor`.

### Variations
- Tool without a payment label: buttons read "Allow once", "Always allow", "Deny".
- Raw arguments: when `detailFolded` is true the detail sits behind a "Details" disclosure; otherwise it is an inset well limited to 4 lines, with no way to read the rest.
- "Allow for this run" label is kept as written by the server.

### Edge Cases
- The request fails (offline, server error): alert "Could not submit answer" with the server's message and an OK button; the buttons come back.
- The card was answered on another device first: the server returns `CONFLICT`; the client refreshes silently and shows the other device's outcome, no error.
- The detail well truncates at 4 lines, so a long argument list cannot be fully read before allowing.

## STORY-002: Deny a tool call and see the resolved line

**Type**: short
**Topic**: Approvals in a thread
**Persona**: Marcus Oyelaran, operations lead
**Goal**: Stop an agent from running a tool he does not recognise
**Preconditions**: A waiting tool approval card
**Ideal path**: 1. Tap "Deny".
**Alternate paths**: Do not answer and instead type a new message; the run continues and the old card later shows "Replaced by a newer request" or "Stopped".

### Steps
1. Tap "Deny" → spinner on the button, other buttons disabled.
2. The thread refreshes → red cross and "Denied" replace the buttons.

### Variations
- Share card (`share: true`): buttons "Share" and "Don't share"; outcomes "Shared" and "Not shared".
- AI data consent card (`consent` present): buttons "Allow" and "Not now"; outcomes "Allowed" and "Not now".

### Edge Cases
- Between the tap and the refreshed block, the device shows its own answer (`sentAnswer`): "Denied" appears even before the server's card arrives. A non-standard answer id shows plain "Answered".
- "Deny" has a destructive role by label only; it uses the same bordered style as "Always allow", so the two look alike apart from text colour.

## STORY-003: A card that is no longer active

**Type**: short
**Topic**: Approvals in a thread
**Persona**: Hana Kobayashi, returns to a thread after lunch
**Goal**: Understand what happened to a request she did not answer
**Preconditions**: An ask whose run ended, was stopped, or was replaced by a newer ask
**Ideal path**: 1. Open the thread and read the resolved line.
**Alternate paths**: none found

### Steps
1. Scroll up to the old card → buttons are gone. One of these lines shows: "Expired", "Stopped", "Replaced by a newer request", or, when the server has not recorded an outcome but the run is no longer waiting, grey "No longer active".
2. A newer card sits at the bottom with live buttons.

### Variations
- Mail card: "Not sent" (red) for expired, stopped and replaced; "Not waiting for approval" in the header when the answer is unknown and the run is not waiting.
- Secret card: "No longer active" in place of the fields.

### Edge Cases
- Tapping an old card's button cannot happen (they are not drawn), but a card that becomes inactive while the person is typing a free-text answer loses its Send path; a send then fails with the alert "This request is no longer active." (the message's run id cannot be found).
- Nothing tells the person why it expired; there is no time stamp on the card.

## STORY-004: Answer a free-text question from the agent

**Type**: short
**Topic**: Approvals in a thread
**Persona**: Devon Whitfield, founder
**Goal**: Tell the agent which Mercury account to pay from
**Preconditions**: An ask block with no actions
**Ideal path**: 2. Type the answer, tap "Send answer".
**Alternate paths**: Reply in the normal composer. This sends a new message instead of answering the card, so the card ends as "Replaced by a newer request" or stays pending depending on the run.

### Steps
1. The card shows the question and a field "Type your answer" (grows over several lines) → "Send answer" is disabled while the field is empty or only spaces.
2. Type "Operating account ending 4421" and tap "Send answer" → spinner, then "Answered".

### Variations
- Ask with answer buttons (not approvals): buttons are bordered secondary, labelled as the server wrote them; the resolved line is "Answered: <label>".

### Edge Cases
- The typed text is kept in the field after a failed send.
- Two ways to answer the same question (card field and composer) with different effects is a redundancy and a trap; the composer does not mention the open question.

## STORY-005: Pick an option on a choice card, or dismiss it

**Type**: short
**Topic**: Approvals in a thread
**Persona**: Aisha Rahman, new user in first-run onboarding
**Goal**: Choose what the agent should help with first
**Preconditions**: A choice block with 3 options and an unanswered state
**Ideal path**: 2. Tap an option row, tap "Continue".
**Alternate paths**: Tap the small close (xmark, label "Dismiss") at the top right to skip.

### Steps
1. The card shows a question, an optional grey subtitle, and radio rows (44 pt tall each).
2. Tap "Set up my cap table" → the row gets a filled radio and a dark outline; "Continue" becomes enabled.
3. Tap "Continue" → spinner on the button (`onboarding/choose`), thread refreshes.
4. The card now shows only the chosen row with a filled radio and no buttons.

### Variations
- Dismiss: `onboarding/dismissFocus` is called; the whole card is then hidden (a dismissed choice is not drawn at all, no trace in the thread).

### Edge Cases
- The close button is a small plain icon, well below the 44 pt target used by the rows.
- The choice and dismiss calls need the agent id; if it cannot be resolved nothing happens and there is no message.

## STORY-006: Send, save or discard a drafted email

**Type**: medium
**Topic**: Approvals in a thread
**Persona**: Tomasz Wrona, founder, Gmail agent connected
**Goal**: Review an email the agent wrote to an investor, then send it
**Preconditions**: A mail approval card from a "create draft" or "send" tool
**Ideal path**: 2. Read the card, tap "Send".
**Alternate paths**: Tell the agent in the composer what to change; the agent then asks again with a new card. There is no edit screen on iOS. The Inbox draft view is a separate route to the same email.

### Steps
1. The card header shows the subject (2 lines max) and an orange "Needs approval" pill. Rows "To", "Cc", "Bcc" show addresses; the body shows up to 10 lines.
2. Buttons: "Save" (secondary when sending is possible), "Send" (prominent), "Discard" (red text).
3. Tap "Send" → spinner on "Send"; for a draft tool the call carries `send: true`.
4. Header turns to "Sending…" (grey), then "Sent" with a check once the mail outcome arrives.

### Variations
- Draft-only tool: only "Save" (prominent) and "Discard" are offered when the mail cannot be sent; "Save" then ends as "Draft saved".
- No recipient: an orange line "Add a recipient" appears under the header, "Send" is not offered; "Save" is the prominent action.
- Discard: ends as "Discarded" (red).
- Reason line under the buttons while waiting, for example "Firewall" or "This chat read a meeting, so it asks first." (see STORY-009).

### Edge Cases
- "Send" is immediate: no confirmation dialog, no undo window, and the body is clipped at 10 lines so a long email cannot be read in full before sending.
- Outcomes: "Not sent" / "Draft not saved" (failed, red), "Not confirmed" (unknown, grey).
- The reason line disappears after the answer on this card, but stays on the standard ask card.

## STORY-007: Give the agent a password or API key

**Type**: medium
**Topic**: Approvals in a thread
**Persona**: Lena Fischer, founder
**Goal**: Give the agent an API key for a vendor so it can continue
**Preconditions**: A secret ask (`input == secret`, no approval id) from the latest waiting run
**Ideal path**: 3. Paste into the secure field, tap "Save"; a password manager fill counts as the paste.
**Alternate paths**: Settings > Integrations holds connected apps, but not agent-requested keys; no other route.

### Steps
1. The card shows the request and, under it, the destination in grey (a site such as "api.example-vendor.com" or "Command variable · VENDOR_KEY").
2. A secure field labelled "API key" (or "Password", or "Code") appears; for a login request a "Username" field comes first (no autocapitalisation, username autofill).
3. Type or paste the key → "Save" enables once the field (and username) is non-empty; Return also submits.
4. Tap "Save" → fields clear immediately, button shows a spinner, then the green line "Saved". The secret is never shown again or kept.

### Variations
- Login request: "Username" plus "Password".
- Field title follows `purpose`: password → "Password", api_key → "API key", anything else "Code".

### Edge Cases
- Failure: alert "Could not submit answer" with fixed text "Couldn't save the credential. Try again." (server text is never shown, because it may echo the secret). The fields were already cleared, so the person must type again.
- Leaving the thread (view disappears) clears whatever was typed.
- No way to reveal what was typed; a typo in a pasted secret cannot be checked.

## STORY-008: Approve an agent-created MCP server

**Type**: short
**Topic**: Approvals in a thread
**Persona**: Ravi Subramanian, founder
**Goal**: Let the agent connect a docs search server it created
**Preconditions**: A `mcp_approval` block with status pending
**Ideal path**: 1. Tap "Approve".
**Alternate paths**: Settings > Integrations lists connections after they exist but has no approval for a pending agent-created server.

### Steps
1. The card shows a letter tile, "Connect MCP server Docs Search" and a 2-line summary.
2. Tap "Approve" → spinner; the server is assigned to this agent and thread.
3. The line "Connected" (green check) replaces the buttons.

### Variations
- "Not now" instead: line "Dismissed" (grey, no mark).
- Server needs OAuth: the text "Finish authorization in the web app." replaces "Approve"; only "Not now" is offered. There is no button that opens the web app.

### Edge Cases
- Server status changes elsewhere (another device approved): the block's status wins over this device's answer.
- Failure uses the shared alert "Could not submit answer".

## STORY-009: See why a call asks, including Firewall and meeting reasons

**Type**: medium
**Topic**: Approvals in a thread
**Persona**: Joanna Mbeki, founder who recently asked an agent to summarise a recorded meeting
**Goal**: Understand why an agent that normally sends mail on its own is now asking
**Preconditions**: An agent in a thread whose run is marked by the meeting taint or by the agent firewall; a mail or tool ask carrying `approvalReason`
**Ideal path**: 3. Read the reason, decide, and answer. To stop the asking she would need to clear the conversation, which iOS cannot do.
**Alternate paths**: Web app: the meeting reason has a "Clear conversation" link beside it and the bot context menu offers "Clear conversation". iOS has no equivalent on the card or in the thread menu.

### Steps
1. The agent's mail card shows "Needs approval" and, under the buttons, a footnote line. With the firewall: "Firewall". After a meeting was read: "This chat read a meeting, so it asks first."
2. Joanna reads the line → on iOS the sentence is plain grey text; "Firewall" is one word with no link to explain it.
3. She taps "Send" or "Discard" → the card resolves; on a mail card the reason line is removed afterwards.

### Variations
- Standard tool ask: the reason stays below the resolved line for the life of the card.
- Reason text from a rule (for example a background run): shown the same way, one sentence.

### Edge Cases
- Gap with web: "Clear conversation" is not offered, so the next call in the same chat will ask again with the same reason; the person has to go to the web app, or archive and start another agent.
- "Firewall" alone does not say what triggered it or how to change it.
- The reason is hidden once a mail card has been answered, so nothing records why it asked.

## STORY-010: Connect an app the agent needs

**Type**: medium
**Topic**: Approvals in a thread
**Persona**: Marta Delgado, founder
**Goal**: Connect Mercury so the agent can read balances
**Preconditions**: A `connect` or `app_connect` block whose app is not connected
**Ideal path**: 3. Tap "Connect", finish in the browser, close the sheet.
**Alternate paths**: Home > Settings > Integrations (the same screen, opened without leaving the thread).

### Steps
1. The card shows a letter tile, the app name and a 2-line description, with "Connect" on the right (VoiceOver: "Connect Mercury").
2. Tap "Connect" → a sheet with the Integrations screen opens over the thread, with "Done" at top right.
3. Complete the provider's authorization (Integrations opens Safari and waits).
4. Tap "Done" → the thread refreshes; the card shows "Connected".

### Variations
- Already connected: no button, green "Connected".

### Edge Cases
- Closing the sheet by swipe also refreshes (the refresh runs on dismiss).
- If authorization is abandoned the card still says "Connect"; the agent is not told, and nothing says what the agent is waiting for.
- A fresh connection does not prompt the agent; the person may need to message the agent to continue.

## STORY-011: Two cards waiting, answer the right one

**Type**: long
**Topic**: Approvals in a thread
**Persona**: Priya Nandakumar, back after a meeting
**Goal**: Clear a backlog of requests from one agent without approving the wrong one
**Preconditions**: A thread with an older ask (superseded), a newer mail card and a secret request; the run is `waiting_input`
**Ideal path**: 4. Scroll to the latest card, answer it, then answer the next.
**Alternate paths**: none found

### Steps
1. Open the thread → the unread divider "New" sits above the first unread card; the latest card is near the bottom.
2. An older ask shows grey "No longer active" or "Replaced by a newer request" → no buttons.
3. The live mail card shows "Needs approval"; tap "Send" → "Sending…" then "Sent".
4. The run asks again with a secret request → fields appear; paste the key, tap "Save" → "Saved".
5. While one answer is in flight, buttons on that card are disabled. Other cards are not touched, since each card has its own model.

### Variations
- Two devices: the first answer wins, the other shows the result without an error.
- Approval comes as a push: the push route opens the thread, not the card; the person scrolls.

### Edge Cases
- If the app is backgrounded mid-request the alert, if any, appears on return.
- A very long thread has no "jump to next pending approval" control; only "jump to latest".
- Offline: the answer calls fail with the shared alert; unlike messages, answers are not queued in the send outbox.

## Gaps and redundancy to note for the catalog

- iOS lacks "Clear conversation" for the meeting reason and gives no explanation for "Firewall".
- Answering a question has two routes (card, composer) with different results.
- Detail wells truncate at 4 lines and mail bodies at 10 lines before an irreversible approval.
- The OAuth MCP card tells the person to use the web app with no button.
- Dismissed choice cards disappear without a trace.
