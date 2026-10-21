# Walker report: thread topics (round 1)

Topics: Talking to an agent (read and live thread), Sending, attachments and offline, Approvals and AI data consent.
Stories walked: 34 (STORY-021 to STORY-048, STORY-050 to STORY-055; STORY-049 is merged into 048).
Method: each step judged against the board that draws it, using the screenshot of that board. Boards are static, so nothing was clicked. Findings are in `thread-findings.json` (48 findings: 7 resolved, 41 open).
Boards are in `docs/design-system/ios/boards/`. The boards added or edited in the gap-fix pass that matter here: PH-Thread, PG-A-ThreadStates, PG-B-Consent, PG-A-HomeNoModel, PG-A-Compose, PG-B-Settings (AI data sharing row), PG-A-Thread (Save/Send card).

## Result

Open findings: 0 critical, 4 high, 22 medium, 13 low, 2 suggestion (41 open). Resolved: 7.

Open high: F-thread-003 (attach menu and states), F-thread-009 (secret ask card), F-thread-010 (no screen for Always allow rules), F-thread-011 (connector writes).

## Geometry audit (run once per board used)

| Board | Result |
| --- | --- |
| PH-Thread (393x852) | clean; header gap 8/59 between back, title and right group is intended; Save/Send "wrapped" flag is a false positive |
| PG-A-Thread | clean (same false positive) |
| PG-A-ThreadStates | clean |
| PG-B-Consent | clean; Allow, Not now and link flags are false positives (single line in the screenshot) |
| PG-A-Compose | clean; Cc/Bcc row width difference is a label plus chevron |
| PG-A-HomeNoModel | clean |
| PG-A-GroupThread | clean |
| PG-A-AgentPage | clean (F-thread-030 resolved) |
| DS-06-Chat, DS-04-Overlays | page overflow is the specimen layout; no real violation. Visual defect the script cannot see: search overlay Cancel is unreadable (F-thread-029, confirmed in a screenshot) |

## Re-check of earlier findings

Resolved: F-001 (PH-Thread), F-004 (offline banner and Waiting to send), F-006 (Failed vs Refused), F-007 (consent sheet and Settings page), F-008 (Save/Send everywhere), F-021 (HomeNoModel), F-030 (tiles even). Still open with notes: see the `note` field of each finding. Severity lowered: F-002, F-005, F-012 (to medium), F-022 (to low).

## Walk by topic

### Thread read and live (STORY-021 to 032)
- 021 Open a busy thread: PH-Thread and PG-A-Thread show the settled thread and composer. Pass on the standard iPhone. No loading or refresh-failed state (F-018). Ideal 3 taps, designed 3.
- 022 Unread divider: no unread dot on Home (PH-Home, PG-A-Home) and no NEW divider on any thread board (F-016, F-017). Fail.
- 023 Watch live: both thread boards show "Inbox agent is working" under a pending approval card while the composer shows an idle mic (F-015). Warn.
- 024 Reconnect after a drop: the Offline frame covers send only; a dropped stream is not drawn (R1-003). Warn.
- 025 Long reply with table, code, image: DS-06 specimens pass; Expand sheet has no board (F-034).
- 026 Group thread: PG-A-GroupThread (Duo only) has avatars, Members and one working line. No standard-iPhone version (R1-002), no stacked working lines (F-022).
- 027 Empty thread: still a rule-card sentence (F-020).
- 028 Unknown block: no board (F-026).
- 029 Duo outer strip: PG-A-Thread passes; tool label edge differs from bubble edge (F-031).
- 030 Inner beside Personnel: Inner shows Inbox beside the thread (F-019).
- 031 History and search jump: search hit goes to a chat, not a message (F-028); no end-of-history or paging state (F-018).
- 032 Mail draft while live: card is consistent as Save/Send on all boards. Pass.

### Sending, attachments, offline (STORY-033 to 044)
- 033 Plain send: PH-Thread composer with plus, capsule and mic. Pass on the standard iPhone. Duo composers lack the plus (F-002).
- 034, 035 Attach and limits: plus is drawn but the source menu, progress, error, HEIC and Skipped states are not (F-003). Fail.
- 036 Reply with quote: DS-06 reply preview pass; reply bar colour mismatch (F-033).
- 037 Mention: no empty list or token specimen (F-036).
- 038 Offline send: PG-A-ThreadStates Offline pass (banner above the thread, queued bubble, caption). DS-04 toast still says "Message not sent" with Retry (F-005). Caption is small (R1-007).
- 039 Refused send: Refused frame shows the cause and Edit. The failed bubble has no attachment chip (R1-008). Pass with warn.
- 040 No model: Home route pass (PG-A-HomeNoModel: message, Connect sheet, after state, one prominent button each). The thread send failure is not drawn (R1-006).
- 041 Stop and correct: Send and Stop share one slot, no stopping state (F-014).
- 042 React: no React menu item or picker (F-023).
- 043 Long session: composes 034, 036, 038, 039; same gaps.
- 044 First message from empty thread: empty state and suggestion behavior undecided (F-020).

### Approvals and consent (STORY-045 to 055)
- 045 Allow a payment tool once: DS-06 tool card pass; Always allow sits under the prominent action with no confirm (F-013).
- 046 Approve a drafted reply: pass (Save prominent-secondary, Send prominent, one tinted action). No visible decline (R1-005).
- 047 Edit and send: PG-A-Compose draws a full compose, but the card has no edit control and nothing links them (F-012).
- 048 First consent: PG-B-Consent first-use sheet pass (title, one sentence, Allow prominent, Not now, Change in Settings). Nothing after Not now (R1-004).
- 050 Second device answers first: no CONFLICT state (F-025).
- 051 Secret: no board (F-009). Fail.
- 052 Voice consent: no board (R1-004). Calls have no control (F-027).
- 053 Connect MCP server: no card (F-024).
- 054 Choice card, then connector writes: choice card pass; writes toggle has no board (F-011).
- 055 Always-allow review: AI data sharing row exists in PG-B-Settings, but no Always allow page (F-010).
- 094 (related) Settings consent page: switches pass; effect of turning one off not stated (R1-009).

### New this round
R1-001 No More menu on PH-Thread. R1-002 No standard-iPhone group thread. R1-003 Stream drop not drawn. R1-004 After Not now and voice consent not drawn. R1-005 No decline on mail card. R1-006 No-model send failure in the thread. R1-007 Waiting caption too small. R1-008 Refused bubble hides its attachment. R1-009 Consent switch effect.
