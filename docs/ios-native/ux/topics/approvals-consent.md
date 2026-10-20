# Approvals and AI data consent: user stories

Scope: planned native SwiftUI iPhone app, phase P5 (#417) plus connector writes (#421). All people and figures below are invented.

Sources read: `docs/ios-native/README.md` section 6, `docs/ios-native/plan.md`, `docs/ios-native/ux/discovery.md`, boards `PG-A-Thread`, `Inner`, `DS-06-Chat` (Mail approval card, MCP tool approval, Ask card, Choice card), `PG-A-Rules`, `PG-B-Settings`, `PG-B-Rules`, `packages/contracts/src/rpc.ts` and `ai-consent.ts`, `packages/core/src/ai-consent.ts`, and the Expo files `apps/mobile/components/AskActions.tsx`, `McpApprovalCard.tsx`, `apps/mobile/lib/ai-consent.ts`, `apps/mobile/app/(settings)/ai-data-sharing.tsx`, `apps/mobile/app/thread.tsx`.

Label note: DS-06 labels the tool approval buttons "Allow once", "Always allow", "Deny" (they come from the ask actions `allow`, `always`, `deny`). The PG-A-Thread board and the inbox-agent approval card show "Deny" and "Allow" on a mail card in the thread, and DS-06's mail card shows "Save" and "Send". The Expo app uses "Allow once", "Always allow", "Deny" for tool asks and "Allow" and "Not now" for AI data sharing asks.

## STORY-001: Allow a payment tool once from the agent thread

**Type**: short
**Topic**: Approvals and AI data consent
**Persona**: Priya Nandakumar, founder of a 6-person logistics startup, Mercury agent connected
**Goal**: Let the Mercury agent send a pilot invoice payment after reading what it will do
**Preconditions**: Signed in, Mercury agent thread open, connector writes turned on, run is `run.waiting_input` with an `ask` block carrying `approvalEffectId` and actions allow, always, deny
**Device**: standard iPhone
**Ideal path**: 3 — read the card, tap "Allow once", see the resolved line
**Alternate paths**: (a) Answer from the iPhone Duo inner display in the 2/3 thread pane (same card). (b) Answer from the web app or Expo app; the native card then shows the resolved state after the next `threads/get` or event. (c) Tap the push notification, which opens the thread at the card (push tap behavior is not specified for approvals).
**Design source**: DS-06-Chat "MCP tool approval" card (all steps); PG-A-Thread rule card ("Allow in the approval card is the one prominent control"); resolved line from DS-06 "Resolved".

### Steps
1. Open the Mercury agent thread from Home → the thread shows the "Mercury agent wants to run requestSendMoney" card with Amount, Recipient "Northwind", Memo "Pilot invoice" in an inset well.
2. Tap "Allow once" (prominent) → the button shows a sending state, all three buttons disable, the run resumes.
3. Wait for the answer to land → the card collapses to one line "Allowed once: requestSendMoney" and the agent continues.

### Variations
- Tap "Always allow" instead: the line reads "Always allowed" (Expo wording). The rule appears under `approvalRules.list`; no iOS screen to see or remove it.
- Tap "Deny": line reads "Denied" and the agent replies it did not proceed.

### Edge Cases
- Network drops after tapping: error alert "Could not submit answer" (Expo wording), buttons re-enable. DS-06 says this is a native alert.
- The same ask was already answered from the web app: `threads/answer` returns CONFLICT (see STORY-006).
- Arguments longer than 4 lines: DS-06 caps the well at 4 lines; no way to see the full arguments is drawn.
- The thread is opened read-only (Expo has `useThreadReadOnly`): buttons should be hidden; no board.

### Design gaps
- Read-only thread state for approval cards has no board.
- No way to expand truncated arguments before approving a money action.
- "Always allow" has no confirmation and no screen to review or undo it (`approvalRules.*` has API, no iOS screen planned).

## STORY-002: Approve a drafted reply from the Inbox agent

**Type**: medium
**Topic**: Approvals and AI data consent
**Persona**: Marcus Oyelaran, solo founder answering a design partner while commuting
**Goal**: Send Ana Ruiz a reply the Inbox agent drafted, after checking recipients
**Preconditions**: Inbox agent thread open after asking "Reply to Ana: Thursday works, 10am"; an `ask.mail` of kind `mail_send` is pending; mail writes are on
**Device**: standard iPhone
**Ideal path**: 3 — open the agent thread, check the draft, tap "Send"
**Alternate paths**: (a) Start from Inbox message → "Ask Inbox agent", then land on the same card. (b) On Duo inner display the same card appears in the right 2/3 pane beside the inbox list (Inner board). (c) Tap "Save" to keep only a draft in the mail account. (d) Edit-and-send (STORY-003).
**Design source**: PG-A-Thread (card with "Needs approval", "Deny", "Allow" on the inbox agent thread); Inner (card with "Save" and "Send"); DS-06-Chat "Mail approval card" (anatomy, states Needs approval, Sent, Not sent). The two boards disagree on the buttons: PG-A-Thread shows "Deny"/"Allow", Inner and DS-06 show "Save"/"Send".

### Steps
1. In the Inbox, tap the row "Re: Pilot timeline" from Ana Ruiz, then tap "Ask Inbox agent" (prominent) → the Inbox agent thread opens with the composer "Message Inbox agent".
2. Type "Reply to Ana: Thursday works, 10am." and tap Send → the agent works ("Inbox agent is working"), "Searched mail, 12 results" appears.
3. The card "Re: Pilot timeline — Needs approval" appears with To Ana Ruiz and the body "Hi Ana, Thursday works. Let's start at 10am." Agent text says "Here is a draft. I have not sent it."
4. Read To, Cc and body → card shows all fields; no auto-send.
5. Tap "Send" (prominent tinted capsule) → status changes to "Sent" with a check mark.

### Variations
- Tap "Save": outcome `saved`; the card shows a saved state (no board for the word).
- Tap "Deny" (PG-A-Thread version): outcome "Not sent" with an x mark.
- Draft has a Cc: DS-06 shows a Cc row between To and the body.

### Edge Cases
- Draft has no recipient: DS-06 says do not show "Send".
- Send result is `unknown` (server cannot confirm): no board for this outcome; discovery lists it as an open case.
- Mail writes are off on the deployment: the agent cannot draft a send; no drawn state for what the card shows.
- Same information appears on Inbox agent thread, Inbox message (as agent entry) and Duo inner pane; the card is one component.

### Design gaps
- Conflict between PG-A-Thread ("Deny"/"Allow") and Inner/DS-06 ("Save"/"Send") for the same card.
- No board for the `unknown` and `failed` outcomes or for the post-save state.
- "View draft" (README mentions it) has no board; unclear whether the body is truncated on the card.

## STORY-003: Fix the recipient list, then edit and send

**Type**: long
**Topic**: Approvals and AI data consent
**Persona**: Lena Hartmann, founder of a 4-person climate data startup
**Goal**: Add Jordan Lee on Cc and fix a line in the draft before it goes out
**Preconditions**: Same as STORY-002; the draft body has a wrong time; mail writes on
**Device**: iPhone Duo outer display
**Ideal path**: 7 — open card, open editor, change Cc and body, confirm, send
**Alternate paths**: (a) Tell the agent in the composer "Add Jordan on Cc" (DS-06 shows this exact composer text) and let it produce a new draft, which needs a second approval. (b) Edit on web, then return. (c) Save only, edit in the mail account later.
**Design source**: DS-06-Chat "Mail approval card" (static card only); edit-and-send screen is NO BOARD; composer text "Add Jordan on Cc" is from DS-06 composer states.

### Steps
1. Open the Inbox agent thread at the pending card "Re: Pilot timeline — Needs approval" → card shown with "Save" and "Send".
2. Look for an edit control on the card → NO BOARD. README says edit-and-send exists (`answer: "allow"` plus `mail: {to, cc, bcc, subject, body}`) but no entry point is drawn.
3. Tap into the draft to edit (assumed entry) → an editable form appears (NO BOARD).
4. Add "Jordan Lee" in Cc (comma-separated text per the contract) → field accepts it.
5. Change "10am" to "10:30am" in the body → text updates.
6. Confirm the edit and tap "Send" → `threads/answer` with `allow` plus the changed fields; card shows "Sent".
7. Check the sent message in the Inbox → thread shows the edited body (verified on Inbox message screen).

### Variations
- Recipient suggestions from contacts: not designed.
- Remove the only recipient: "Send" must hide, as DS-06 says for a card with no recipient.

### Edge Cases
- Invalid email in To or Cc: no error state drawn; the server may reject.
- Keyboard covers the fields on the outer 466x678 display: sheets sit beside the strip; presentation not drawn.
- Edits abandoned by swiping down: draft discard or keep behavior is not defined.
- Unsaved edits when the app is backgrounded (the plan says saved chats redact secret asks only).

### Design gaps
- The whole edit-and-send screen (entry point, fields, Bcc, validation) is NO BOARD. Plan says "approve and deny first, edit-and-send after", so this may ship later.
- Duo inner and half-folded layout for the editor is not drawn.
- The Expo app has no equivalent screen found in the files read, so there is no label to match.

## STORY-004: First model use asks for AI data sharing consent

**Type**: medium
**Topic**: Approvals and AI data consent
**Persona**: Tomas Brandt, founder trying the app on a new self-hosted server
**Goal**: Send the first message to an agent and agree to share data with the model provider
**Preconditions**: New account, no recipient allowed in `aiConsent.status`; at least one bot exists
**Device**: standard iPhone
**Ideal path**: 3 — type, tap send, tap "Allow" in the prompt
**Alternate paths**: (a) Pre-grant in Settings → "AI data sharing" (STORY-005) before the first message. (b) A routine run or a mid-run `ai_consent` ask card (effect kind `ai_consent`) shows "Allow" and "Not now" inside the thread. (c) Voice first: needs consent for `voice` (STORY-008).
**Design source**: NO BOARD for the prompt. Composer states from DS-06-Chat; settings row "AI data sharing" only in PG-B-Settings. The Expo app shows a system alert titled "Share data with {name}?" with buttons "Not now", "Privacy policy", "Allow".

### Steps
1. Open any agent thread and type "Draft a launch note" in the composer → "Send" becomes prominent (DS-06 Typing state).
2. Tap Send → the client maps `threads/send` through `aiDataUsesForProcedure` to model and memory, calls `aiConsent/status` and finds unallowed recipients.
3. A prompt appears: "Share data with {provider}?" with the recipient detail, the disclosure text, and "You can turn this off in Account → AI data sharing." (Expo copy; no iOS board).
4. Tap "Allow" → client calls `aiConsent/allow` with scope, version and the recipient key, then sends the message.
5. The message appears in the thread and the agent starts working.

### Variations
- Two recipients (model provider and memory provider): the Expo helper prompts once per recipient, in turn, so step 3 repeats.
- Tap "Privacy policy": opens the link, then the prompt returns when the app is foregrounded again.

### Edge Cases
- Tap "Not now": send is blocked with "Review AI data sharing in Account settings before continuing."; typed text must stay in the composer (not specified).
- Consent status call fails (server unreachable): the Expo helper wraps this as a blocked consent error; what the user sees in native is not drawn.
- An older server without `aiConsent` (404): the client should treat as not supported; not specified.
- Tapping Send twice quickly: pending prompts are coalesced per recipient in `packages/core/src/ai-consent.ts`.

### Design gaps
- The consent prompt itself has no board (alert, sheet, or inline card?).
- No recipient icon, no layout for several recipients, no placement of the privacy link.
- Behavior of the composer text after "Not now" is not stated.

## STORY-005: Review and turn off an AI provider in Settings

**Type**: medium
**Topic**: Approvals and AI data consent
**Persona**: Grace Whitfield, privacy-minded founder of a health-adjacent startup
**Goal**: See who receives her data, then switch off the voice provider
**Preconditions**: Model and voice recipients are allowed
**Device**: standard iPhone
**Ideal path**: 4 — Settings, "AI data sharing", toggle voice off, confirm shown state
**Alternate paths**: (a) "Withdraw all permissions" (destructive row, confirm "Withdraw"). (b) Re-grant by retrying a blocked action and tapping "Allow" in the prompt. (c) On the Duo inner display, settings open in the 2/3 pane (rules for PG-B pages).
**Design source**: PG-B-Settings (root list row "AI data sharing" only); detail page is NO BOARD. Expo screen groups are "AI models", "Voice", "Memory", "Privacy policies", row "Withdraw all permissions".

### Steps
1. Tap Settings from the Home screen → Settings root list shows Account (Sam Rivera), Models, Voice, Device, Integrations, "AI data sharing", "Archived bots", "Change password" (PG-B-Settings).
2. Tap "AI data sharing" → page loads; loading, empty ("No AI services configured.") and failure ("Could not load permissions.") states exist in Expo.
3. Read the Voice group with its switch and footer disclosure → each recipient has name, detail and a switch labelled "Allow {name} on mobile".
4. Turn the voice switch off → `aiConsent/revoke` with that key; the switch reads off.
5. Tap "Privacy policies" → a provider's policy opens in Safari.

### Variations
- Turn a switch on: the same "Share data with {name}?" prompt appears before `aiConsent/allow`.
- "Withdraw all permissions": alert "Withdraw all permissions?" with "Cancel" / "Withdraw"; it revokes with key null.

### Edge Cases
- Revoke fails: alert titled "AI data sharing" with the error.
- Footer text says runs in progress and routines keep going until stopped; it matters because a revoked user may still see agent activity.
- The row also needs to be reachable from the blocked-message error text, which names "Account settings" while the iOS label is "AI data sharing".

### Design gaps
- The detail page has no board, including empty, loading and error states.
- Message text "Review AI data sharing in Account settings" does not match the iOS root, which has no "Account" screen listed in PG-B-Settings (it shows the signed-in user row).
- No link from the blocked-send error to the page is drawn.

## STORY-006: Second device answers the same approval first (CONFLICT)

**Type**: short
**Topic**: Approvals and AI data consent
**Persona**: Hannah Cho, cofounder who has the laptop open on the web app and the phone in hand
**Goal**: Understand why her tap on "Allow once" did nothing
**Preconditions**: A pending tool ask; cofounder (same user) allowed it on web seconds ago; phone has not yet refreshed
**Device**: standard iPhone
**Ideal path**: 2 — tap, read the message, card updates itself
**Alternate paths**: none found
**Design source**: DS-06-Chat "Ask card" (error: failed submit shows a native alert and re-enables); CONFLICT behavior has NO BOARD.

### Steps
1. Tap "Allow once" on a card the phone still shows as pending → request sent with `threads/answer`.
2. Server returns CONFLICT → the Expo alert would read "Could not submit answer" with error text; the card should refresh to "Allowed once".

### Variations
- Another bot or group member answered through a different thread target: same result.

### Edge Cases
- Buttons re-enable after the alert (DS-06), so a user could tap again and see the same alert; the plan does not say to refetch.
- If the SSE stream already delivered the resolved state, the buttons are gone before the tap.

### Design gaps
- CONFLICT has no designed message; a refetch of the thread after CONFLICT is not specified in the plan.

## STORY-007: Provide a login secret the agent needs

**Type**: medium
**Topic**: Approvals and AI data consent
**Persona**: Kofi Mensah, founder letting the Team Computer agent log in to a vendor portal
**Goal**: Give the agent a username and password without the app storing it
**Preconditions**: Agent thread with an `ask` block `input: "secret"` and a login credential (username and password), destination known
**Device**: iPhone Duo inner display flat
**Ideal path**: 4 — fill username, fill password, tap "Save", see "Saved"
**Alternate paths**: (a) Skip or ignore the ask and tell the agent in text (the secret then travels as a normal message, which the app does not prevent). (b) Answer from web.
**Design source**: NO BOARD for the secret ask. DS-06 has an "Ask card" (question 15pt/600, waiting line 13pt) that is the nearest style. Expo: secure text field, button "Save", destination label from `secretDestinationLabel`.

### Steps
1. Open the thread, see an ask card naming the destination → the card shows a username field and a secure password field (Expo behavior).
2. Type the username → field accepts, auto-capitalization off.
3. Type the password → dots shown, autocorrect off.
4. Tap "Save" → fields clear at once, `threads/answer` sends `answer` plus `username`.
5. Card shows "Saved" and the agent continues.

### Variations
- A non-login secret (an API key): one field only; Save enabled when non-empty.

### Edge Cases
- Send fails: Expo shows "Could not send answer" without the error detail; the field was already cleared, so the user must retype.
- App is killed during the ask: saved chats redact secret asks; the value must never be written to the snapshot, log, or outbox.
- Screenshots and app switcher preview of the card: not addressed.

### Design gaps
- No board for the secret card, its destination line, the "Saved" state, or error state.
- Keychain and AutoFill interplay is unspecified.
- Retry after failure loses the typed value.

## STORY-008: Voice call blocked until voice consent is granted

**Type**: medium
**Topic**: Approvals and AI data consent
**Persona**: Selin Arslan, founder who dictates replies while walking
**Goal**: Start a call with the agent and share recordings with the transcription provider
**Preconditions**: Voice provider configured, voice not yet allowed
**Device**: standard iPhone
**Ideal path**: 3 — tap call, tap "Allow", call starts
**Alternate paths**: (a) Grant in Settings → "AI data sharing" first (STORY-005). (b) "Not now" and use text only.
**Design source**: NO BOARD for the prompt or the call screen (DS-07 lists "Calls", no PG page). Settings root row "AI data sharing" on PG-B-Settings.

### Steps
1. Open a thread and start a call (control from the thread header; the call entry has no PG page) → client maps `voice/prepare` to the `voice` use and checks consent.
2. The prompt "Share data with {voice provider}?" appears with the disclosure "Your recordings are sent for transcription, and text you play is sent to generate speech." → user reads.
3. Tap "Allow" → `aiConsent/allow`, then the call begins.

### Variations
- "Not now": call does not start; message "Review AI data sharing in Account settings before continuing."

### Edge Cases
- Memory consent also missing: a second prompt for the memory recipient after the first (threads/send maps to model and memory).
- Dictation permission denied: Expo shows "Calls need transcription" with "Not now" and "Open Voice" — a different gate from consent.

### Design gaps
- Call screen has no PG page; consent prompt in the middle of a call start has no board.

## STORY-009: Approve a new MCP server from the thread

**Type**: short
**Topic**: Approvals and AI data consent
**Persona**: Diego Salazar, founder adding a spreadsheet tool server to his agent
**Goal**: Connect the MCP server an agent asked for
**Preconditions**: Thread contains an `mcp_approval` block, status pending, no OAuth needed
**Device**: standard iPhone
**Ideal path**: 2 — read card, tap "Approve"
**Alternate paths**: (a) Tap "Dismiss" and reconnect later from MCP settings. (b) If OAuth is needed, only a web hand-off exists (README: "MCP OAuth is web-only").
**Design source**: DS-06-Chat has the "MCP tool approval" card (a tool call approval, not a server connect) and a letter tile style; the server-connect card is NO BOARD. Expo card: "Connect MCP server {name}", "Approve", "Dismiss".

### Steps
1. Scroll to the card "Connect MCP server Sheets" with the endpoint or "stdio · {transport}" → card shows "Approve this server to let your agent use its tools."
2. Tap "Approve" → `mcp/assignments/approve`; text "Connected. Its tools are available from your next message."

### Variations
- OAuth server: Approve hidden, text "Finish MCP authorization in the web app."; no iOS route to open it.
- Dismiss: "Dismissed. Reconnect anytime from MCP settings." Native MCP settings screen is not planned.

### Edge Cases
- Approve fails: alert "Could not approve this server".
- The block shows the status from the server on reload even if local state said pending.

### Design gaps
- The server-connect card is NO BOARD, and the DS-06 MCP card is a different thing with a similar name.
- No iOS page for "MCP settings" is planned, so "Reconnect anytime from MCP settings" has no destination.

## STORY-010: Answer a choice card, then turn on connector writes

**Type**: long
**Topic**: Approvals and AI data consent
**Persona**: Aisha Karimi, founder of a 9-person SaaS company, first time using the Mercury agent
**Goal**: Pick a meeting length for a calendar action, then enable money writes and approve one payment request
**Preconditions**: Calendar agent in a group thread with a pending `choice`; Mercury connected with writes off (default); integrations list available
**Device**: iPhone Duo half-folded 1/2 + 1/2 (thread in right half)
**Ideal path**: 14 — answer choice, find the writes switch, turn it on, ask for a payment, approve once
**Alternate paths**: (a) Turn writes on from the web app (`connections.setWrites`). (b) Answer the choice by typing in the composer. (c) Use "Always allow" for the payment tool at step 13 instead of "Allow once".
**Design source**: DS-06-Chat "Choice card" ("Pick a meeting length", "30 minutes", "60 minutes", "Continue") and "Ask card" ("Which calendar should I use?", "Personal calendar", "Skip"); PG-B-Integrations for the connector page (rule card not re-read in detail); the writes switch is NO BOARD; tool approval is DS-06 "MCP tool approval".

### Steps
1. In the half-folded layout open the group thread on the right half → the Choice card "Pick a meeting length" shows "30 minutes — Fits Ana's open slot" and "60 minutes — Needs a longer slot".
2. Tap "30 minutes" → the row selects.
3. Tap "Continue" → `threads/answer`; the card collapses to a resolved line.
4. The agent asks "Which calendar should I use?" with "Personal calendar" and "Skip" → ask card.
5. Tap "Personal calendar" → answer sent; agent books the slot.
6. Type "Pay the Northwind pilot invoice" and tap Send → agent replies it cannot write because writes are off (message wording not defined).
7. Open Settings → Integrations → Mercury → connector page → the page shows the connection (PG-B-Integrations).
8. Look for the writes switch → NO BOARD; assume a switch calling `connections.setWrites`.
9. Turn writes on → switch reads on; footer wording not defined.
10. Return to the thread and repeat the request → agent works.
11. The card "Mercury agent wants to run requestSendMoney" appears with Amount, Recipient, Memo → card is the same as in STORY-001.
12. Read the amount row (tabular figures) and recipient → verified.
13. Tap "Allow once" → resolved line "Allowed once: requestSendMoney".
14. Confirm in the Finance page or chat finance card that the request was created → NO BOARD for the result of a write inside Finance.

### Variations
- "Skip" on the ask card: agent proceeds without a calendar.
- Writes off on a deployment-level switch: control is disabled with no drawn explanation.

### Edge Cases
- Half-folded 1/2 + 1/2 keeps nothing important at x 435-455 (PG-A-Rules): the card must not straddle the fold.
- Writes toggled while a run is waiting for approval: behavior not specified.
- Even with writes on, each write still asks (README), so turning on writes does not remove step 13.

### Design gaps
- The writes switch and its warning copy have no board; `connections.setWrites` and `mcp.servers.setWrites` have API but no iOS screen.
- No message designed for "writes are off" in the thread.
- Choice card multi-select vs single-select, and keyboard handling for free-text answers, are not drawn.

## STORY-011: Review what "Always allow" has already granted

**Type**: short
**Topic**: Approvals and AI data consent
**Persona**: Ravi Deshmukh, founder who tapped "Always allow" last week and wants to undo it
**Goal**: See and remove the standing rule for the payment tool
**Preconditions**: A rule exists (`approvalRules.list` has `always_allow` for tool requestSendMoney)
**Device**: standard iPhone
**Ideal path**: 3 — find the rules list, open the rule, remove it (if screen exists)
**Alternate paths**: Use the web app (the only place today); or ask the agent in chat (no known tool).
**Design source**: NO BOARD. The Settings root (PG-B-Settings) has no row for approval rules or auto review.

### Steps
1. Open Settings → the root list shows Account, Models, Voice, Device, Integrations, "AI data sharing", "Archived bots", "Change password" and no approval rules entry.
2. Look inside Integrations → connector page; no approval section drawn.
3. Fall back to the web app → rule removed with `approvalRules.remove`.

### Variations
- Turn auto review on or off (`autoReview.set`): no iOS screen.

### Edge Cases
- A later "Allow once" on the same tool still appears if the rule was removed.

### Design gaps
- Approval rules and auto review are in the API (`approvalRules.list/set/remove`, `autoReview.get/set`) and the README, but no board or plan phase shows them on iOS. A user who taps "Always allow" has no way to undo it on the phone.

---

Counts: short 4 (001, 006, 009, 011), medium 5 (002, 004, 005, 007, 008), long 2 (003, 010).
