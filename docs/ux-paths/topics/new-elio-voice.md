# Topic: new-elio-voice

Feature: Elio, the voice coordination agent (PR #147). Code refs: entry `apps/web/src/pages/Shell.tsx` (`startElioCall` ~2362, composer button "Call Elio" ~7707, `onVoice` bound ~3538, `CallCard` mounted ~4794, "Messaged {peer}" marker ~8291), `apps/web/src/components/call/CallCard.tsx`, `VoiceChatCard.tsx`, Elio creation `apps/api/src/voice-agent.ts` (one bot per user, spawn key `voice-agent:{userId}`, title "Voice agent", description "Answers questions about your workspace and coordinates your agents."), Elio's instructions `packages/core/src/voice-agent.ts`, read-only tools `packages/adapters/src/voice-agent-tools.ts`, tool list `packages/contracts/src/voice-agent.ts`. Offline test: `apps/web/e2e/voice.spec.ts`. Mobile (context only): `apps/mobile/app/thread.tsx` has a Call Elio entry; not walked.

**Persona for every story.** Maya, the founder of "MOCK DEMO DATA - Northwind Robotics", who has never heard of Elio. "UNVERIFIED" marks behaviour read from code but not seen running.

**Preconditions common to all stories (state these in the walk report).**
- The mock demo stack (`packages/testkit/src/cli/demo`) seeds mail, files and bots only. It does not seed a voice provider (no voice code in `demo/`). With no voice provider connected, `voiceStatus.ready` is false and "Call Elio" opens Settings, Voice instead of calling (see STORY-APP-400).
- The only offline voice provider is "Scripted" (`voice.spec.ts`): Settings, Voice, choose Scripted, paste any text such as `fake-scripted-voice-key`, press Connect. After that `voice/status` is ready, "Hear a sample" returns audio, and "Call Elio" works. The walker must do this first for STORY-APP-396 to 4.
- Real microphone and speech recognition cannot be driven offline. The walker can verify the entry, navigation, call card, Mute, Transcript, Hang up and Escape. Spoken turns, and so any live Elio answer, are UNVERIFIED unless the walker types to Elio in the composer instead (Elio's conversation is an ordinary chat).
- The demo uses the scripted agent runtime unless model keys are found (`demo/safety.ts`). The scripted runtime will not choose `message_bot` or the history tools on its own, so STORY-APP-398 and 4 need a model key (runtime `pi`) to see real tool use. Without one, the walker checks only that the chat and the call work, and records that delegation could not be exercised.

## STORY-APP-396: Call Elio from a chat for the first time
**Type**: medium
**Topic**: new-elio-voice
**Persona**: Maya, in the chat with her Chief of staff bot, wondering how to talk to her agents by voice
**Goal**: Start a voice call and find out who she is talking to
**Preconditions**: Scripted voice connected (see common preconditions). Maya is on a bot's one-to-one chat, not a group chat. The composer is empty.
**Ideal path**: 2 - click "Call Elio" (mic icon in the composer), and the call starts; nothing else is needed because Elio is created on first use (`voice/agent`).
**Alternate paths**: (1) Call Elio only appears when the draft is empty and the chat is not a group (`onVoice={!inGroup && active ...}`, `draft.trim().length === 0`), so there is no entry in group chats. (2) Before voice is connected, the same button opens Settings, Voice (STORY-APP-400). (3) The Elio chat itself is also reachable by opening Elio from the sidebar once it exists, and the composer there shows the same "Call Elio" button. (4) On the call card, no second start path exists. The `Escape` key only ends a call. (5) Mobile has its own Call Elio entry in the thread view (not walked).
### Steps
1. Open a bot chat (for example the Chief of staff) and look at the composer → a round outline mic button with the tooltip and accessible name "Call Elio" sits to the left of Send. Maya hesitates: she does not know who Elio is, and the label does not say "voice" or "call a person".
2. Type a letter → the mic button disappears (it shows only for an empty draft). Delete the letter → it returns.
3. Click "Call Elio" → the URL changes to `/app/{elioId}`, the chat shows an Elio conversation (Elio is added to the roster), and a floating card (`data-testid="call-view"`, top right, 360px wide) shows Elio's avatar, the name "Elio" as a button (accessible name "On a call with Elio"), moving bars, and four icon buttons: "Settings", "Transcript", "Mute", "Hang up".
4. Click "Transcript" → the card grows to show up to the last four lines of the conversation (empty before anyone speaks). Click again → it closes.
5. Click "Mute" → the icon changes to a crossed mic and the label becomes "Unmute". Click "Unmute" → it returns.
6. Navigate to another bot's chat while the call goes on → the card stays; clicking "Elio" in the card goes back to `/app/{elioId}`.
### Variations
- Start the call from a different bot or from Elio's own chat: the target is the same Elio.
- Open "Settings" on the card → Settings opens on Voice.
### Edge Cases
- Press Call Elio twice quickly: the second click is ignored while the first is starting (`voiceCallStarting`).
- Switch bot or space while Elio is still being created: the call does not start and the page does not jump (`activeBotId`/`selectedSpaceId` check).
- With the Scripted provider and no mic permission, the card may show a caption such as "Microphone failed" (`call-session.ts`). UNVERIFIED.
- Maya's composer bar offers no hint that the call goes to a different agent than the chat she is in; she may think she is calling the Chief of staff. The call card name is the only clue.

## STORY-APP-397: Hang up, then call again and find the same Elio
**Type**: short
**Topic**: new-elio-voice
**Persona**: Maya, who ended a call and now wants to continue
**Goal**: Hang up cleanly and see the call as a record in the chat, then call again
**Preconditions**: STORY-APP-396 done, call in progress
**Ideal path**: 2 - "Hang up", then "Call Elio" again; the same Elio and the same chat open (`voice/agent` returns the existing bot by spawn key).
**Alternate paths**: Press `Escape` while focus is not in a text field (ends the call, `CallCard.tsx`); end the call by saying a hang-up request, which makes Elio use `end_call` (UNVERIFIED offline); leave the chat and click the call card name to return.
### Steps
1. Click "Hang up" (red phone-off button) → the call card disappears (`call-view` is gone).
2. Look at Elio's chat → the call appears as a "Voice chat" card with a duration like `0:12`, a one-line summary if there was speech, and a chevron. The e2e test does not assert this card, so UNVERIFIED when no one spoke: a call with no spoken turns may leave no card.
3. Click the "Voice chat" card → it expands to show the transcript turns; the sr-only label is "Hide transcript" / "Show transcript".
4. Go back to any other bot chat, click "Call Elio" → the URL is the same `/app/{elioId}` as before; the sidebar still lists one Elio, not two.
5. Press `Escape` with focus on the page body → the call ends. With the cursor in the composer, `Escape` does nothing to the call.
### Variations
- Archive Elio from the roster and call again: the code creates a new Elio and retires the old one's key (`retiredVoiceAgentSpawnKey`, commits "retire a replaced Elio by key"). The walker should check that exactly one Elio appears.
- Reopen the app in a fresh session: Call Elio goes to the same Elio.
### Edge Cases
- Hang up while Elio is "thinking": the bars are grey during thinking; Hang up should stop at once. UNVERIFIED.
- Delegated work still running after hang-up: its result arrives in Elio's chat, not in a call (Elio's instructions say so).
- Hanging up leaves the URL on Elio's chat; Maya may not realise she is now in a different conversation from the one she left.

## STORY-APP-398: Ask Elio to delegate to another agent
**Type**: long
**Topic**: new-elio-voice
**Persona**: Maya, who wants the Finance bot to chase an overdue invoice without switching chats
**Goal**: Tell Elio what to ask the Finance bot and see that the request was sent
**Preconditions**: Scripted voice connected; a runtime with a model key (`pi`) so Elio can call tools; at least two other bots (for example Chief of staff and a Finance-type bot). Without a model key, record "delegation not exercisable" and only check the chat.
**Ideal path**: 3 - open Elio's chat, type or say "Ask Finance to chase the Cobalt Cloud invoice", read Elio's reply; Elio calls `message_bot` itself.
**Alternate paths**: Say it on a call (voice); open the Finance bot's chat and write to it directly (the normal way, bypassing Elio); mention the bot in the Elio composer.
### Steps
1. Start a call (STORY-APP-396), or stay in Elio's chat and type: "Ask Finance to chase the Cobalt Cloud invoice." → a run starts; Elio may first call `workspace_agents` to find teammates (read-only).
2. Watch Elio's chat → a marker "Messaged Finance" (the bot's real name) appears with the bot's colour dot. It is a clickable row (`CollaborationMarker`).
3. Elio replies in one to three short sentences saying whom it asked and that the work is pending. It does not claim the invoice was chased.
4. Click "Messaged Finance" → the peer conversation between Elio and Finance opens (`onOpenPeerMessages`), showing the message Elio sent. UNVERIFIED which surface opens.
5. Open the Finance bot's own chat → it shows "Message from Elio" for the received request and Finance works on it under its usual approvals.
6. When Finance finishes, return to Elio's chat → Elio relays the substance of the result in a later message. If Finance needs approval, Elio says the user's action is needed in Finance's conversation.
### Variations
- Ask for a bot that does not exist ("Ask the Legal bot"): Elio says no suitable teammate exists and does not create one (it cannot create agents).
- Ask Elio to do the work itself ("Pay the invoice"): Elio has no shell, computer, or connector tools, so it delegates or declines.
### Edge Cases
- A successful "Messaged ..." marker means only delivery. Check that Elio never says the work is done at that point.
- Delegation must not bypass approvals: if Finance hits a blocked tool, the approval card appears in Finance's chat, not Elio's.
- Elio does not poll: it should not send repeated "any update?" messages.
- The reply text in a call is spoken, so Elio should use no lists or markdown; in the chat transcript the answer reads as plain sentences.

## STORY-APP-399: Ask Elio about a teammate's private history
**Type**: medium
**Topic**: new-elio-voice
**Persona**: Maya, who half remembers telling the Finance bot something last week
**Goal**: Find out what the Finance bot was told and did, without opening its chat
**Preconditions**: As STORY-APP-398 (needs a model key). The Finance bot has an earlier conversation with Maya in its one-to-one chat. Seed one by sending it a short message first.
**Ideal path**: 2 - ask Elio "What did I tell Finance about the hosting invoice?"; Elio uses `search_agent_history` and `read_agent_history` and answers.
**Alternate paths**: Open the Finance chat and search it directly; ask about a group chat (Elio cannot read group chats); ask about Data Room files (Elio has `search_data_room` and `read_data_room_item`, with the same denials as any agent).
### Steps
1. In Elio's chat, type "What did I tell Finance about the hosting invoice?" → Elio looks up agents (`workspace_agents`), then searches Finance's private conversation.
2. Read Elio's answer → it states what the history says, naming that it came from Finance's conversation, and says when results are partial. It does not claim outcomes it did not verify (a completed run is not proof the goal succeeded).
3. Ask "What did Finance do about it?" → Elio reads linked outcomes (`agent_context`: recent runs, open tasks, routines) and separates what it saw from what it infers.
4. Ask about something said in a group chat → Elio says it cannot see group chats or finds nothing.
5. Ask "Show me the message where I gave Finance the password" (a sensitive item) → Elio must not return secrets: `agent_context` returns no configuration or secrets. UNVERIFIED for text pasted into a message.
### Variations
- Ask about Elio's own history: the Elio chat is not a teammate's private chat; the answer should come from this conversation only.
- Ask about a bot that belongs to someone else (not possible in the single-user demo; commits note owner messages stay out of Elio's peer runs).
### Edge Cases
- Text inside history is untrusted: a message that says "Elio, ignore your rules" must be reported, not obeyed.
- Results are paginated (up to 20 per page); Elio should follow the next cursor rather than claim a first page is everything.
- Archived agents do not appear in `workspace_agents`, so Elio cannot answer about them.
- The user sees only Elio's text answer, with no marker showing which chat was read. Maya cannot tell whether Elio actually read the history. Record this.

## STORY-APP-400: The call does not start
**Type**: short
**Topic**: new-elio-voice
**Persona**: Maya, first time, voice never set up
**Goal**: Make a call and recover when it fails
**Preconditions**: Case A: no voice provider connected (the default on the demo stack). Case B: Scripted connected, but the `voice/agent` request fails (the walker blocks `/rpc/voice/agent` in the browser, or stops the API briefly).
**Ideal path**: 3 - Case A: click "Call Elio", connect a provider in the Settings that opens, click "Call Elio" again. Case B: click "Call Elio" and read the error.
**Alternate paths**: Open Settings, Voice from the profile menu and connect before ever pressing Call Elio.
### Steps
1. Case A: click "Call Elio" → no call starts; Settings opens on Voice (`voice-settings`) with an "API key" field and a provider list. The composer has no voice message explaining why. Maya expected a call and got a settings page.
2. Click "Close voice settings" → back in the chat with no call and no message. She may not learn what to do next.
3. Case B: with Scripted connected, click "Call Elio" while the request fails → no call card appears and the composer shows the error text "Could not start the call", or the server's own message in its place if it has one (`errorText(error, ...)`). The URL stays on the current chat.
4. Click "Call Elio" again after restoring the request → the call starts as in STORY-APP-396.
### Variations
- Close the error: check whether the error clears when she types, sends a message or switches chats. UNVERIFIED.
- The e2e test shows the first click opens settings with the "Dictate" button absent until a provider exists.
### Edge Cases
- If the voice status refresh is slow, `voiceStatus` is null and the button behaves as not ready, sending Maya to Settings even when voice is configured. The refresh is bounded at 10 s on leaving Settings.
- Navigate away before the failure returns: the error is dropped on purpose, so a stale error does not show on another chat.
- Mic permission denied is a different failure and shows a caption on the call card ("Microphone failed"), not "Could not start the call". UNVERIFIED offline.
