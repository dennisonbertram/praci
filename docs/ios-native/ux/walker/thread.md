# Walker report: thread topics

Topics: Talking to an agent (read and live thread), Sending, attachments and offline, Approvals and AI data consent.
Stories walked: 34 (STORY-021 to STORY-048, STORY-050 to STORY-055; STORY-049 is merged into 048 in the catalog).
Method: each step judged against the board that defines it, with the PNG screenshot opened and checked. Boards are static, so nothing was clicked. Finding ids in this file are shortened (F-016 means F-thread-016). Findings are in `thread-findings.json` (39 findings: 12 high, 16 medium, 9 low, 2 suggestion).

Boards are in `docs/design-system/ios/boards/`. Ratings: pass, warn, fail. "NO BOARD" is a happy-path finding.

## Geometry audit by board

The audit script was run live on each board at its own size. Boards are mockups, so deliberate absolute positioning was ignored. The script's "wrappedControls" results (for example Deny, Allow, Save, Send, AB, Find models, Get credentials, Cancel, Done) are false positives: every one of those labels is on one line in the screenshot. The "unevenRows" results for label-plus-time and dot-plus-text rows are intentional flex layouts.

| Board | Result |
| --- | --- |
| PG-A-Thread | clean (header/status width difference is intended) |
| PG-A-GroupThread | clean |
| PG-A-Image | clean |
| PG-A-Home | clean |
| Main | clean |
| Sheet | clean |
| PG-A-AgentPage | violation confirmed: figure tiles 116/151/85 px wide (F-thread-030) |
| PG-B-Settings | clean |
| PG-B-Models | clean |
| PG-B-NewBot | clean |
| PG-B-Integrations | clean |
| Inner | clean (rows flagged only for unread dot height) |
| Split | clean |
| Desk | clean (279 px gap between title capsule and right group is intended) |
| DS-06-Chat | clean |
| DS-05-Lists | clean |
| DS-04-Overlays | clean by script; a visual defect the script misses: Cancel label invisible in the search overlay (F-thread-029) |
| PG-A-Rules | clean |

## Thread read and live (topic 1)

### STORY-021 Open a busy agent thread
- Step 1 tap row on Home: PG-A-Home (Personnel rows) pass. Duo outer only; standard iPhone NO BOARD (F-001).
- Step 2 server snapshot replaces saved copy: PG-A-Thread shows the settled thread, composer "Message Inbox agent" present; no loading or refresh-failed state (F-018) warn.
- Step 3 read last reply and tool label: PG-A-Thread shows "Here is a draft. I have not sent it." and "Searched mail, 12 results". Tool label sits after the draft text, bubble edges differ from label edges (F-031) warn.
- Geometry: PG-A-Thread clean.
- Flow Log: ideal 3, designed 3. No hesitation. Quoted text in the catalog ("Reply to Ana...") is the user bubble on the board, not the agent bubble.

### STORY-022 Catch up on unread with the New divider
- Step 1 open from Personnel: PG-A-Home rows show no unread state (F-016) fail.
- Step 2 divider position: divider exists only on DS-05 (teal "NEW", 2 pt line), not on any thread board (F-017) warn.
- Step 3 earlier-messages spinner: rule card text only (F-018) warn.
- Step 4 read down: PG-A-Thread pass for bubbles; caption rule not drawn on page (F-031).
- Step 5 expand tool label: DS-06 Tool-call label expanded specimen pass.
- Step 6 reach bottom, unread clears on Home: NO BOARD for the cleared state (F-016).
- Flow Log: designed steps cover reading but not the entry point or the return. Hesitation: whether the user sees "Jump to latest".

### STORY-023 Watch an agent work live
- Step 1 working indicator: PG-A-Thread draws blue dots plus "Inbox agent is working"; DS-06 draws ring avatar plus neutral dots with no text (F-015) warn.
- Step 2 tool label running then past tense: DS-06 collapsed/running specimen pass (spinner replaces the symbol).
- Step 3 first token removes the indicator: DS-06 rule text pass; streaming partial markdown NO BOARD (F-018).
- Step 4 Stop returns to Dictate: DS-06 Agent running (Stop) pass.
- Step 5 expand tool label: DS-06 expanded pass.
- Flow Log: ideal 2, designed 2. Duplicate info: the same working state appears on Home Activity, the thread footer and the composer placeholder "Agent is working".

### STORY-024 Reconnect after the stream drops
- Steps 1-5: NO BOARD for reconnecting, partial bubble on drop, or the 401 outcome (F-004, F-018) fail.
- Flow Log: ideal 1 (zero taps). The user gets no signal at all, which is acceptable only if the design says so. Not stated.

### STORY-025 Read a long reply with table, code, image
- Step 1 markdown: DS-06 Agent message long markdown pass.
- Step 2 Copy on code: DS-06 pass (Copied state drawn).
- Step 3 table Expand: button drawn ("Expand table"); the sheet has no PG board (F-034) warn.
- Step 4 dismiss sheet: NO BOARD.
- Step 5 open chart.png: PG-A-Image drawn on the Duo strip; Share and Save glyphs unlabelled (F-035) warn.
- Step 6 Close: PG-A-Image pass (X in strip).
- Flow Log: ideal 6, designed 6. The rule says code offers Expand but only Copy is drawn.

### STORY-026 Group thread with several agents
- Step 1 tap "Funding room": PG-A-Home has no group rows; DS-05 Group row exists (F-016) warn.
- Step 2 named bubbles: PG-A-GroupThread pass (name above bubble, avatar at the left).
- Step 3 one working line per agent: one line drawn only (F-022) warn.
- Step 4 tool label expand: pass.
- Step 5 event label: DS-06 event labels pass.
- Step 6 member list: strip has a Members button; pane has no board; standard iPhone NO BOARD (F-022) fail.
- Flow Log: ideal 2, designed 2 plus an undesigned member list. Group avatar shape differs between row and capsule (F-032).

### STORY-027 Start a fresh agent, empty thread
- Step 1 New bot Create: PG-B-NewBot shows a check button, no "Create" label; pass with note.
- Steps 2-3 greeting and suggestions: NO BOARD (F-020, F-021) fail.

### STORY-028 Unknown block from a newer server
- Steps 1-2: NO BOARD for the placeholder (F-026) fail.

### STORY-029 Thread on Duo outer with the side strip
- Step 1 strip: PG-A-Thread pass (Island, time, Back group, Page/List group, More bottom).
- Step 2 content column from x=72, capsule, composer: pass.
- Step 3 approval card: drawn with Deny/Allow; Allow prominent (ink). Conflicts with Inner and DS-06 (F-008) fail.
- Steps 4-5 Page and Open chat: PG-A-AgentPage pass; tile widths uneven (F-030) warn.
- Steps 6-7 More menu: DS-04 "Menu from a glass button" exists; agent actions content not confirmed on it, warn.
- Step 8 Back: pass.
- Geometry: PG-A-Thread, PG-A-AgentPage as above.
- Flow Log: ideal 4, designed 4 plus two hesitation points (which button declines, whether the working row still shows during approval).

### STORY-030 Thread beside Personnel on the inner display
- Step 1 unfold to 1/3 + 2/3 with thread: Split shows Inbox, not a thread (F-019) fail.
- Step 2-4 switching agents with unread: no unread rows in the sidebar (F-016) fail.
- Step 5 half-folded: Inner pass (nothing at x 435-455; fold between the Inbox list and the thread).
- Step 6 laptop pose: Desk shows the Finance page above and a thread below, not the thread-only pose (F-019) warn.
- Step 7 unfold again: NO BOARD (state continuity).
- Flow Log: ideal 3; only half-folded is actually drawn.

### STORY-031 Review full history
- Steps 1-4 paging: rule card spinner text only; end-of-history, failure NO BOARD (F-018, F-028) fail.
- Step 5-6 tool label, long-press menu: DS-04 Context menu pass (Reply, Copy, Select text, Pin, Delete).
- Step 7 Jump to latest: NO BOARD (F-017).
- Alt path search: DS-04 Command and search overlay drawn; agent-level hits only (F-028); Cancel label invisible (F-029).
- Pins chip: DS-06 Pins strip pass.

### STORY-032 Read and approve-view a mail draft live
- Step 1-2 working and tool label: PG-A-Thread pass.
- Step 3 card with Needs approval: pass; warning color plus word.
- Step 4 working replaced by waiting: board shows both the working row and the pending card, and an idle mic (F-015) fail.
- Steps 5-7 status flip to Sent from another device: DS-06 Sent specimen exists; transition not drawn (F-025) warn.
- Flow Log: ideal 5. Same approval has three labels across Thread, Inner and Home Activity (F-008).

## Sending, attachments and offline (topic 2)

### STORY-033 Send a plain text message
- Step 1 composer empty with mic: DS-06 Composer Empty pass; page boards pass for mic but have no plus (F-002) warn.
- Step 2 Send becomes prominent: DS-06 Typing pass (ink arrow, one prominent control).
- Step 3 Sending then Delivered: DS-06 user bubble caption pass; no caption on PG-A-Thread (F-031).
- Flow Log: ideal 3, designed 3. Double-tap guard and the multi-message caption rule not drawn.

### STORY-034 Attach a photo and a PDF
- Step 1 plus then source menu: plus on DS-06 only; menu NO BOARD (F-002, F-003) fail.
- Steps 2-3 chips: DS-06 chips pass; PDF chip uses an envelope glyph (F-033) warn.
- Step 4 Send: pass.
- Step 5 upload progress: NO BOARD (F-003) fail.
- Step 6 Delivered: pass.
- Flow Log: ideal 7, designed 5 of 7.

### STORY-035 HEIC, large video, fifth file
- Steps 1-3 rejection notice and conversion: NO BOARD (F-003, F-037) fail.
- Step 4 send: pass.

### STORY-036 Reply with a quoted snippet
- Step 1 long-press: DS-04 menu has Reply but also lacks React; stories list Reply, React, Copy (F-023) warn.
- Step 2 reply strip: DS-06 Composer reply preview pass; bar is blue where the line spec says muted (F-033) warn.
- Step 3 reply line: DS-06 pass.
- Step 4 tap reply line scrolls: text rule only.

### STORY-037 Mention a teammate-agent
- Step 1 popover: DS-06 mention popover pass (44 pt rows, role column).
- Steps 2-3 filter and pick: pass for the list; token look NO BOARD (F-036) warn.
- Steps 4-5 send and one working line: PG-A-GroupThread shows one line, pass.
- Flow Log: ideal 5, designed 4.

### STORY-038 Send fails offline and delivers later
- Step 1 offline thread: NO BOARD (F-004) fail.
- Step 2 queued bubble: only Sending at 70% (F-004) fail.
- Step 3 network returns: DS-04 banner says "Message not sent... Retry", conflicting with auto resend (F-005) fail.
- Step 4 Delivered: pass.

### STORY-039 Refused send, edit and retry
- Step 2 Not sent plus Retry: DS-06 failed bubble pass (red border, text not red).
- Step 3 retry fails again: same bubble, no reason (F-006) fail.
- Step 4 long-press Retry/Delete, edit missing (F-006) warn.
- Step 5 Delete: DS-04 alert pattern exists.
- Flow Log: ideal 6; the user cannot tell Retry will never work.

### STORY-040 No model connected
- Step 1 empty thread: NO BOARD (F-020).
- Steps 2-3 error: NO BOARD, wording conflict (F-006, F-021) fail.
- Steps 4-5 Settings to Models: PG-B-Settings and PG-B-Models pass (no "none connected" state).
- Steps 6-7 retry: DS-06 pass.

### STORY-041 Stop a running agent
- Step 1 Stop in the Send slot: DS-06 Agent running pass (same position as Send).
- Step 2 stopping state/failure: NO BOARD (F-014).
- Step 3 correction: pass; typed-text-while-running conflict (F-014) warn.

### STORY-042 React to an agent message
- Steps 1-3: DS-04 menu has no React; no picker; no reaction display (F-023) fail.

### STORY-043 Long founder session
- Steps 1-3 and 7: partly drawn (see 033-035).
- Steps 4-6 chips up to four and the max notice: NO BOARD (F-003) fail.
- Step 8-9 queue: NO BOARD (F-004).
- Steps 10-12 table sheet, reply: DS-06/DS-04 pass with F-034.
- Step 13 refused then retry: F-006.
- Step 14 inner display with draft kept: Inner shows an Inbox thread, not Finance with chips (F-019) warn.
- Step 15 React: F-023.
- Flow Log: ideal 22; five of the fifteen steps have no board.

### STORY-044 First message from a suggestion
- Steps 1-3: NO BOARD for suggestions (F-020) fail.

## Approvals and AI data consent (topic 3)

### STORY-045 Allow a payment tool once
- Step 1 card in thread: DS-06 MCP tool approval pass (title, inset well, three buttons); no PG board at outer width.
- Step 2 sending state: spec text only.
- Step 3 resolved line: DS-06 Resolved pass.
- Hierarchy: "Always allow" is at the same size under the prominent button (F-013); arguments cut at 4 lines (F-013); no standing rule screen (F-010).

### STORY-046 Approve a drafted reply
- Step 1-2 Inbox message then Ask Inbox agent: Sheet (Inbox) pass with prominent chat button.
- Step 3 card: Inner and DS-06 pass; PG-A-Thread shows other labels (F-008) fail.
- Step 4-5 read fields, Send: pass. Save, unknown, failed outcomes NO BOARD (F-025).
- Flow Log: ideal 3, designed 3.

### STORY-047 Fix recipients, edit and send
- Step 1 card: pass.
- Steps 2-7 editor: NO BOARD (F-012) fail.

### STORY-048 First model use asks for consent
- Step 1 typing state: DS-06 pass.
- Steps 2-5 prompt: NO BOARD; DS-04 alert cannot hold the content (F-007) fail.
- Not now keeping text and refused bubble: F-006.

### STORY-050 Second device answers first (CONFLICT)
- Steps 1-2: DS-06 states a failed submit uses a native alert and re-enables; CONFLICT NO BOARD (F-025) fail.

### STORY-051 Provide a login secret
- Steps 1-5: NO BOARD; nearest style is the DS-06 Ask card (F-009) fail.

### STORY-052 Voice call blocked until consent
- Step 1 call entry: NO BOARD (F-027) fail.
- Steps 2-3 prompt: NO BOARD (F-007) fail.

### STORY-053 Approve a new MCP server
- Steps 1-2: NO BOARD for the server-connect card (F-024) fail.

### STORY-054 Choice card, then writes on
- Steps 1-3 Choice card: DS-06 pass.
- Steps 4-5 Ask card: DS-06 pass (board also shows "Work calendar").
- Steps 6-10 writes switch: PG-B-Integrations draws no connector detail (F-011) fail.
- Steps 11-13 payment card: F-013.
- Step 14 result in Finance: NO BOARD.
- Flow Log: ideal 14; steps 6-10 are an undesigned detour through Settings.

### STORY-055 Review "Always allow"
- Steps 1-3: PG-B-Settings has no row (F-010) fail.

## Cross-cutting Flow Log
- Designed versus ideal: reading and sending text match the ideal path. Attach, offline, consent, secrets, edit-and-send, writes and reactions have no complete design.
- Hesitation points: which button declines a mail draft; whether a suggestion sends; what a waiting message looks like; where Always allow can be undone.
- Duplicated information: working state on Home, thread footer and composer placeholder; one approval on Home Activity, thread and Inner pane with three labels.
- Rules check (README): glass only for floating navigation holds on every page board; one prominent action holds on PG-A-Thread (Allow) and in DS-06 (Send, Stop, Continue); concentric corners look right on the composer and cards.
