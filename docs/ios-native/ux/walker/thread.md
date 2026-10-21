# Walker report: thread topics (round 2)

Topics: Talking to an agent, Sending, attachments and offline, Approvals and AI data consent.
Stories walked: 36 (STORY-021 to 048, 050 to 055, 116, 117; 049 is merged into 048). Method: each step judged against the board that draws it, using its screenshot; boards are static, so nothing was clicked. Findings: `thread-findings.json` (56 findings: 31 resolved, 25 open).
Boards are in `docs/design-system/ios/boards/`.

## Result

Open findings: 0 critical, 2 high, 8 medium, 14 low, 1 suggestion (25 open).

Round 2 closed most round 1 gaps. The boards now draw the standard-iPhone thread and group thread with chat menus, an attachment menu with chip states, offline, failed, refused, loading, archived, read-only and stopping states, the secret ask card, Connect MCP card, mail conflict, failed, unknown and read-only cards, the connector writes switch, and a list of standing allow rules.

Open high:
- F-thread-007: the first-use sheet for the model ("Share data with Model A?") is no longer on PG-B-Consent, which now shows the speech sheet and the Settings page only. The first send of a new user has no screen (STORY-048, STORY-117).
- F-thread-R2-001: DS-06-Chat is cut off at 7400 px, so the secret ask error, Connect MCP and mail state tiles, attachment chips, composer running and pending states and the approval pill cannot be seen. Fix: remove the fixed height and overflow hidden from the wrapper.

Open medium: F-thread-016 (no unread dot or group rows on Home), F-thread-019 (Inner shows Inbox, not Personnel, beside the thread), F-thread-027 (no call control on any thread), F-thread-R1-004 (what happens after Not now), F-thread-R2-003 (PH-Group header clipped at the right edge), F-thread-R2-004 (Always allow list contradicts the card rule), F-thread-R2-005 (connector writes: no consequence text, no money connector frame), F-thread-R2-009 (stories 048 and 117 describe a frame that is gone).

## Geometry audit (once per board)

| Board | Result |
| --- | --- |
| PH-Thread (393x852) | clean; Edit and Send "wrapped" flags are false positives (one line in the screenshot) |
| PG-A-ThreadStates | clean; page overflow is the grid layout |
| PG-B-Consent | clean; Allow, Not now and link flags are false positives |
| PH-GroupThread | real defect: header capsule spills 17 px; confirmed in the screenshot (F-thread-R2-003) |
| PG-A-Thread | clean; page overflow is the grid layout |
| DS-06-Chat | clean in the measure, but the wrapper height clips the page (F-thread-R2-001); verified by scrolling and by setting the wrapper height to auto |

## Journey walk

Ideal and designed taps are given where they differ.

### Talking to an agent (STORY-021 to 032)
- 021 open a busy thread: PH-Thread; loading and could-not-refresh frames exist. Pass.
- 022 unread: NEW divider and Jump to latest drawn; Home has no unread dot (F-016). Warn.
- 023 watch live: working indicator and the approval pill are consistent now. Pass.
- 024 reconnect: Reconnecting banner drawn. Pass.
- 025 long reply: DS-06 specimens; Expand sheet has no board (F-034). Warn.
- 026 group thread: PH-GroupThread and PG-A-GroupThread; header clipped (R2-003); group has no entry on Home (F-016).
- 027 empty thread: chips drawn; tap behavior unstated (F-020). Warn.
- 028 unknown block: drawn. Pass.
- 029 Duo strip: pass; avatar mismatch in group capsule (F-032).
- 030 inner pane: Personnel not beside thread (F-019).
- 031 search jump: rule now says it opens at the message (F-028 resolved); the result row names chats.
- 032 mail draft live: pass.

### Sending, attachments, offline (STORY-033 to 044, 116)
- 033 plain send: composer with plus on every board. Pass. Ideal 2 taps, designed 2.
- 034, 035 attach and limits: menu, progress, error, converting, skipped and four-chip states exist in DS-06 but are clipped (R2-001); chips are plainer than the spec (R2-007); no Camera source.
- 036 reply: pass; reply bar color (F-033).
- 037 mention: popover drawn; no empty list (F-036).
- 038 offline send: banner, queued caption and toast; said three times (R2-006); caption small (R1-007).
- 039 refused: bubble shows the file; Remove file. Pass.
- 040 no model: Not sent: No model connected with Connect. Pass.
- 041 stop and correct: Running, text typed, Stopping states. Pass.
- 042 react: React deferred by the board; the story has no designed path (F-038).
- 043, 044, 116: compose of the above; pass once R2-001 is fixed.

### Approvals and consent (STORY-045 to 055, 117)
- 045, 054 tool approval: Allow once, Deny. Always allow only for read-only tools; Settings list contradicts it (R2-004). Connector writes (R2-005).
- 046, 047 mail approval: Edit and Send; edit screen on PG-A-Compose; no decline (R1-005).
- 048, 117 first consent: no model sheet (F-007, R2-009). Warn to fail.
- 050 conflict: tile drawn, clipped (R2-001).
- 051 secret: card drawn, clipped error.
- 052 voice consent: sheet drawn; no call control to trigger it (F-027).
- 053 Connect MCP: card drawn, clipped.
- 055 Always allow management: Settings list drawn (R2-004).

## Resolved in round 2
F-002, 003, 005, 009, 010, 011, 012, 013, 014, 015, 017, 018, 023, 024, 025, 026, 028, 029, 037, 039, R1-001, R1-002, R1-003, R1-006, R1-008 (each has a note in the JSON), plus those resolved in round 1.
