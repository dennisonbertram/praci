# Walker report: thread topics (round 3)

Topics: Talking to an agent, Sending, attachments and offline, Approvals and AI data consent.
Stories walked: 36 (STORY-021 to 048, 050 to 055, 116, 117). Method: each step judged against the board that draws it, using its screenshot; boards are static, so nothing was clicked. Findings: `thread-findings.json` (59 findings: 43 resolved, 16 open).
Boards are in `docs/design-system/ios/boards/`.

## Result

Open findings: 0 critical, 0 high, 3 medium, 12 low, 1 suggestion (16 open).

Round 3 closed both open highs. DS-06-Chat is no longer clipped, so the secret ask error, Connect MCP, mail state, attachment chip and approval specimens can be seen. The model consent question is settled by design: the Connect sheet says what is sent to Model A, and a thread with sharing off shows "Model A sharing is off" with Turn on (PG-B-Consent, PG-A-HomeNoModel). Settings now lists only read-only "Allowed without asking" rules with a remove confirmation, the connector Allow writes switch has a confirmation and a Banking frame, Call is in the chat menu, and delete chat has a confirmation.

Open medium:
- F-thread-016 (PG-A-Home, PH-Home): no unread dot on Personnel rows and no group row, so a group thread has no entry on Home. Fix: add an unread dot and a Funding room row.
- F-thread-019 (Inner): the inner pose shows Inbox beside the thread, not Personnel (STORY-030). Fix: draw Personnel on the left or change the story.
- F-thread-R3-001 (PH-Thread, DS-06-Chat): PH-Thread's long-press menu has a reaction row and React, while DS-06 says React is deferred. Fix: pick one and align the boards and STORY-042.

## Geometry audit (once per board)

| Board | Result |
| --- | --- |
| PH-Thread (393x852) | clean; Edit, Send, Cancel and Clear "wrapped" flags are false positives (one line in the screenshot); page overflow is the grid |
| PG-A-ThreadStates | clean; button wrap flags are false positives |
| PG-B-Consent | clean; Allow, Not now, Turn on and link flags are false positives |
| PH-GroupThread | clean now; the header fits (212 + 134 pt capsules beside Back), confirmed in the screenshot |
| DS-06-Chat | clean; page height 10357 px with no clipped wrapper; the 116/83/83 table columns are intended |

## Journey walk

### Talking to an agent (STORY-021 to 032)
- 021 to 024, 028, 032: loading, could not refresh, NEW divider with Jump to latest, working dots, Reconnecting, unknown block and live draft states are drawn (PH-Thread, PG-A-ThreadStates). Pass.
- 022: Home has no unread dot (F-016). Warn.
- 025: Expand sheet for a table is drawn; code Expand is not (F-034). Warn.
- 026: group thread and chat menu drawn on PH-GroupThread; no group row on Home (F-016).
- 027: chips drawn; chip tap result unstated (F-020).
- 029: pass. 030: Personnel not beside the thread (F-019). 031: pass.

### Sending, attachments, offline (STORY-033 to 044, 116)
- 033 plain send: 2 taps ideal, 2 designed. Pass.
- 034, 035 attach: plus menu, uploading, error, converting, skipped line and four-chip composer are drawn; no Camera source (R3-003); menu icons missing in DS-06 (R2-007).
- 036 reply: pass; reply bar still blue (F-033). 037 mention: popover drawn; no empty list (F-036).
- 038 offline: banner, Waiting to send caption and toast; said three times (R2-006).
- 039 refused, 040 no model, 041 stop and correct: drawn. Pass.
- 042 react: PH-Thread now draws it (R3-001).
- 043, 044, 116: pass.

### Approvals and consent (STORY-045 to 055, 117)
- 045, 054 tool approval: Allow once, Deny; Always allow only for read-only tools. Pass.
- 046, 047 mail approval: Edit and Send, Updating, Draft replaced and Empty recipient states. No decline control (R1-005).
- 048 first consent: "Model A sharing is off" card with Turn on. Pass; in-thread ask card not drawn (R3-002).
- 050 to 053: conflict, secret, speech consent, Connect MCP drawn and visible. Pass.
- 055 Always allow management: Settings list with remove confirm. Pass.
- 117: Speech sheet, after Not now and Settings drawn. Pass.

## Resolved in round 3
F-007, 027, 035, R1-004, R1-007, R1-009, R2-001, R2-003, R2-004, R2-005, R2-008, R2-009 (each has a note in the JSON), plus earlier rounds.
