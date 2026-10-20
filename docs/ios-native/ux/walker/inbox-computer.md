# Walk: Inbox triage and compose; Team Computer, artifacts, agent pages and routines

Stories STORY-056 to STORY-077 (22 stories). Steps are judged against the board screenshots; boards are static, so nothing navigates. Findings are in `inbox-computer-findings.json` (28). Result key: pass / warn / fail.

Limits: DS-04 and DS-05 screenshots are tall and downscaled and were not legible; their specimens (swipe, to-do card, filter, toast, search) were judged from the catalog's description of them, not seen directly.

## Geometry audit (live, once per board)

| Board | Result |
| --- | --- |
| Sheet, Inner, Split | Only dot/text and name/time pairs flagged (unread dot top drift 15 px is deliberate). Clean. |
| PG-A-InboxMessage, PG-A-AgentList, PG-A-Routine | clean |
| PG-A-Home | AB avatar flagged as wrapped; screenshot shows one line. Clean. |
| PG-A-Computer | Key bar and Team/Private flagged as wrapped; screenshot shows single lines. False positive. Clean. |
| PG-A-Artifacts | Chips are uneven by content width (normal). Chip row reaches the right edge. Clean (see F-024). |
| PG-A-Artifact, PG-A-Image, PG-A-Thread, Desk | clean |
| PG-A-AgentPage | VIOLATION confirmed: tile widths 116/151/85 px (F-020). |

## Inbox

STORY-056 Morning triage. 1 Inbox list: Sheet (warn, standard iPhone has no board; Needs reply and "Other mail today" sections drawn, section name differs from catalog). 2 Pull to refresh: no board (happy-path). 3 Swipe archive: DS-05 specimen (warn, Star/Mute unsupported, no Undo, no failure state). 

STORY-057 Read and ask agent. 1 Open message: PG-A-InboxMessage (pass; subject, sender, body, two attachment rows drawn). 2 Read: pass. 3-4 Attachment preview: NO BOARD (fail). 5 Ask Inbox agent: pass for the button (icon only, warn a11y). 6 Agent thread: PG-A-Thread (pass; working indicator, approval card; card differs from Inner).

STORY-058 Reply. 1 Reply button: PG-A-InboxMessage (pass). 2-4 Compose sheet, send, confirmation: NO BOARD (fail).

STORY-059 Forward. 1 Entry point: NO BOARD (fail, strip has Archive and Reply only). 2-6 compose, From picker, attachments: NO BOARD (fail).

STORY-060 Search and filter. 1 Inbox on outer: Sheet (pass). 2 Search field: Split draws an inline field, Sheet draws an icon, expanded state not drawn (warn). 3 Results: DS-05 "Results 3" (not seen, pass per catalog). 4 Filter sheet: DS-04 (not seen; options mismatch, warn). 5 Sort: pass. 6 Swipe: warn as 056.

STORY-061 To-do. 1 Card on Inbox: no Inbox board places it (fail). 2 Checkbox: DS-05 specimen (warn; no failure or Undo).

STORY-062 Cleanup. 1-18: NO BOARD (fail). No entry point.

STORY-063 Writes off or reconnect. 1 List: Sheet (pass). 2 Archive fails: NO BOARD (fail). 3-4 Reply/Send disabled: NO BOARD (fail). Reconnect banner: NO BOARD.

STORY-064 Inner triage. 1 Home inner: Split/Main (pass). 2 Inbox list in third: Inner and Split (warn; folders not drawn). 3-4 Message in detail: no board with a message pane (fail). 5-6 Reply and Send: NO BOARD. 7-8 Archive/next: no strip for message pane (fail). 9-11 Ask agent and approve: Inner (warn, card differs). 12-13 Archive, header count: no board. 14-16 Filter, Important only: Split strip (warn, eye/star inconsistency). 17-21 Compose: NO BOARD. 22-24 Swipe, refresh, Inbox zero in two panes: not drawn (fail).

STORY-065 Compose. 1 Compose button: Sheet (pass). 2-4 sheet, From picker, Send: NO BOARD (fail).

STORY-066 First open. 1-4 empty "Connect mail", first sync: NO BOARD (fail); "Inbox zero" would mislead.

## Team Computer, artifacts, pages, routines

STORY-067 Watch computer. 1 Thread More, Open computer: PG-A-Thread (pass, More shown). 2 Screen view-only: PG-A-Computer draws only the in-control state (warn). 3 Close: pass (X in strip). Standard iPhone: NO BOARD.

STORY-068 Boot and control. 1 Needs you block: not verified. 2 Booting: NO BOARD. 3 Take control: not drawn (prominent shows Release). 4 Control chip and key bar: pass. 5-12 Typing: warn, no Return key. 13-14 Handoff Skip / I'm done: NO BOARD (fail). Glass count 6 (F-016).

STORY-069 Find artifact. 1 Entry from Home: PG-A-Home draws Activity/Search/Documents icons; Artifacts icon not labeled (warn). 2 Chip filter: PG-A-Artifacts (pass; chip row clipped at edge). 3-4 Open and read: PG-A-Artifact (pass; "v2 of 2" pill style drawn as "v5 of 5").

STORY-070 Compare versions. 1 Open: pass. 2 Versions menu: NO BOARD (fail). 3-5 Switch via pill: pill drawn (warn, duplicates Versions). 6 Share: drawn but not prominent (warn).

STORY-071 Delete. 1 Long-press confirm: NO BOARD (fail). 2-3 pass per rule text.

STORY-072 Image. 1 Open: PG-A-Image (pass). 2 Zoom: pass. 3 Save to Photos: icon drawn, feedback and permission NO BOARD (warn). 4 Close: pass.

STORY-073 Agent page. 1 Page button: PG-A-Thread (pass). 2 Read page: PG-A-AgentPage (warn, uneven tiles). 3 Open chat: drawn as icon only (warn). 4 Ask: pass.

STORY-074 Checklist. 1 Open list: PG-A-AgentList (pass). 2-3 Tick: pass (muted, struck). 4-5 Add item field and prominent add: pass. Delete and conflict: NO BOARD.

STORY-075 Routine. 1 Activity item: PG-A-Home (pass). 2 Status card: PG-A-Routine (pass). 3 Prompt: pass. 4 Open conversation: icon only (warn). History, list: NO BOARD.

STORY-076 Month-end handoff. 1-8 Computer on laptop pose: NO BOARD (rule card only; Desk shows Finance). 9-12 Artifact laptop pose: NO BOARD. 13-17 Page and list laptop pose: NO BOARD. 18-21 Routine full height: PG-A-Routine pass; transition NO BOARD. 22 pass.

STORY-077 Recover. 1-2 Artifacts error and retry: rule card text only. 3-4 Page error: no retry (fail). 5-6 Computer error and retry: text only; "Could not load the desktop." no retry (fail).

## Flow Log

| Story | Designed vs ideal | Hesitation / duplication |
| --- | --- | --- |
| 056 | list and swipe drawn; ideal 3 | Star/Mute choice with no behavior |
| 057 | 2 as ideal | three different approval cards |
| 058, 059, 065 | ideal 4 / 6 / 4 but compose undrawn | Forward entry hunt |
| 060 | search and filter drawn on Duo only | three conflicting Filter homes |
| 062 | ideal 18; none drawn | no entry point |
| 064 | list and agent drawn; message pane and compose not | strip contents unknown per pane |
| 067 | ideal 3; matches | none |
| 068 | ideal 14; handoff and boot missing | Return key missing |
| 070 | ideal 6 | Versions button and pill duplicate; Share not prominent |
| 073-075 | ideal 3-5; matches | same icon, three meanings; runway figures on four screens |
| 076 | ideal 22; laptop layouts undrawn | five screen changes |
