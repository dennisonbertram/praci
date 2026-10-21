# ux-visual round 3: Wispr Flow mockup and Granola Inbox

**Screens:** every screen and state in the Wispr Flow mockup, plus the Granola `#screen-inbox`.

**Captures:**
- Desktop screens at 1440x900, 768x1024 and 375x812, in light and dark.
- The phone frame at 1440x900, in light and dark.
- 118 captures in all. None has horizontal overflow.
- The audits are in `audit.json`.

**Second opinion:** skipped, because no finding is P0 or P1. Every finding is [own].

## Round-2 rows

Of the 36 rows reviewed, 22 are fixed, 2 are obsolete and 12 are still open.

| Status | Rows |
|---|---|
| Fixed | IB-1, SV-1, CL-1, IB-2, IB-4, SV-2, CS-2, TK-1, FM-1, FM-2, IB-6, IB-7, SV-6, SV-7, FM-3, XS-1, M-3, M-8, M-9, M-10, M-12, M-14 |
| Obsolete | IB-9 (decision FX-15), M-19 (decision RX-59) |
| Still open, P2 | IB-3, SV-4, CS-1, M-11, M-16 |
| Still open, P3 | SV-3, SV-5, IB-8, CL-2, XS-2, M-15, M-17 |

The open rows:
- **IB-3:** a tick fades the to-do at once, with no undo and no way to dismiss a wrong to-do. Plan-level.
- **SV-4:** the consent sentence sits below Connect.
- **CS-1:** turning Flow off in AI data sharing doesn't change its Voice status. The screen also has no Settings context. Plan-level.
- **M-11:** the same line shows for a rejected key and a network failure. Decision D3 accepts this.
- **M-16:** no typing state; a keyboard would cover Connect.
- **SV-3:** no hover fill on the rows.
- **SV-5:** Replace key is a permanently disabled button.
- **IB-8:** the existing "Connect Gmail" copy.
- **CL-2:** no listening or timer cue during a call.
- **XS-2:** gaps that are off the spacing scale.
- **M-15:** the phone back control can't be reached with the keyboard.
- **M-17:** "API key" is the only label for the field.

The 9 Granola phone rows were not in scope for this round.

## New findings

Target: M is the mockup HTML, P is the plan.

| id | level | element | problem | severity | target |
|---|---|---|---|---|---|
| R3-1 | group | Flow Citation at 375 px | The popover sits below the window edge (top 596.6 px against a 591.6 px window), so it is clipped and invisible | P2 | M |
| R3-2 | component | Flow Citation popover | Escape and clicking outside don't close it; it shows no title or date | P3 | M |
| R3-3 | layout | Agent answer to Citation | A 70 px spacer makes the composer jump when the popover opens | P3 | M |
| R3-4 | group | Phone, Connected | The "This device" checkmark and "Transcribing" can both read as active | P3 | P |
| R3-5 | group | Phone, Key | The key field has no header and no selection cue on the row | P3 | M |
| R3-6 | layout | Voice at 375 px | The key card drops 50 px below the list, away from its row | P3 | M |
| R3-7 | component | Inbox account tabs | The tabs don't switch anything, so the per-tab rule isn't shown | P3 | M |
| R3-8 | component | Voice provider pane | The pane never names its provider | P3 | M |

## Excellent as is

- **Voice row:** a single extra row, with "Transcribe only" and "Transcribing".
- **Daily limit:** the call card at the daily limit.
- **Delete confirmation:** the dialog names the meeting.
- **Citations:** two bot colours and 32 px chips.
- **Inbox:** one list of to-dos from both sources.
- **Phone frame:** native in feel.
- **Themes:** light and dark are consistent.
