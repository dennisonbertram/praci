# Walk: Inbox triage and compose; Team Computer, artifacts, pages, routines (round 1)

Stories STORY-056 to STORY-077, 102 and 108. Steps are judged against board screenshots; boards are static. Findings are in `inbox-computer-findings.json` (33 total: 27 open, 6 resolved).

Limits: DS-04 and DS-05 screenshots are tall and downscaled; their specimens were read from the board source text (spec tables) instead of the image.

## Result

Open: 2 high, 18 medium, 6 low, 1 suggestion. Resolved this round: 6 (compose board, standard iPhone Inbox list, Cleanup board, Forward/Reply all entry, one approval card, agent page tile widths).

## Geometry audit (once per board)

| Board | Result |
| --- | --- |
| PH-Inbox | Only dot/text and name/time pairs flagged; the swiped row is cut off by design. Clean. |
| PH-Computer | Labels flagged as wrapped; screenshot shows single lines. Clean. |
| PG-A-Compose, PG-A-Cleanup | Only icon/label pairs flagged. Clean. |
| PG-A-AgentPage | Clean. Tile widths now equal (F-020 resolved). |
| PG-A-Artifact, Sheet, Split | Only paired-element width differences. Clean. |

## Step walk (what changed since the last walk)

- STORY-056 Triage: PH-Inbox draws sections, unread dots, label chips and Archive swipe on a standard iPhone (pass). Swipe specimen still lists Star and Mute (F-006). No Undo (F-005).
- STORY-057 Read and ask: PG-A-InboxMessage unchanged. On PH there is no message board and no Ask Inbox agent control (R1-001).
- STORY-058, 059, 065 Reply, Forward, Compose: PG-A-Compose draws New message, Reply and the Reply/Reply all/Forward menu (pass for the happy path). Failure, sending and discard states missing (R1-002). Forward is two taps deep (R1-005).
- STORY-060 Search and filter: three control sets remain (F-007).
- STORY-061 To-do: no Inbox board shows the card (F-013).
- STORY-062 Cleanup: entry (More menu), tick, bulk menu (Archive 3, Unsubscribe 2, Skip inbox 3, Spam 0), Done with Undo are drawn. Confirmations, failure, history missing (R1-003). More control absent on Sheet and PH-Inbox (R1-004). One prominent action (Archive 3) is correct.
- STORY-063, 066 Writes off, first open: still undrawn (F-004).
- STORY-064 Inner triage: message pane and compose pane absent (F-014). Approval card now matches PG-A-Thread (F-009 resolved).
- STORY-067, 068 Computer: PH-Computer draws Watching with Take control and In control with Release and key bar. Booting, handoff, errors missing (F-015). Five or six glass groups (F-016).
- STORY-069 to 072 Artifacts: unchanged; Share not prominent (F-017), no versions menu or delete confirm (F-019), chip row clipped (F-024).
- STORY-073 to 075 Page, list, routine: tile widths fixed. Same bubble icon three meanings (F-010). One routine only (F-021).
- STORY-076, 102 Handoff, laptop pose: only Finance in Desk (F-025).
- STORY-077 Load failures: text only, no retry control (F-022).

## Flow log

| Story | Designed vs ideal | Note |
| --- | --- | --- |
| 056 | 3 vs 3 | Star/Mute without behavior |
| 057 | 2 vs 2 on Duo; unknown on 393 pt | no Ask agent on PH-Inbox |
| 058, 059, 065 | compose drawn; Forward 2 extra taps | outcome states missing |
| 062 | entry, select, act, Undo drawn | no confirm, no entry on PH/Sheet |
| 067, 068 | Watch and control drawn; boot and handoff not | glass count over limit |
| 070 | 6 vs 6 | Versions button and pill duplicate |
| 073-075 | 3-5 vs 3-5 | same icon, three meanings |

## Open findings

- F-inbox-computer-004 (high, PG-A-Rules.dc.html): Still open: PG-A-Rules Inbox card lists only Inbox zero, loading and 'Could not load mail.' No reconnect, writes-off, no-account or consent state on any board.
- F-inbox-computer-005 (medium, DS-05-Lists.dc.html): Still open: DS-05 swipe specimen and DS-04 toast have no Undo after Archive and no failed-row state.
- F-inbox-computer-006 (medium, DS-05-Lists.dc.html): Still open: DS-05 swipe spec still lists Star and Mute (bell.slash) and no Spam/Trash. PH-Inbox shows only Archive, which now disagrees with the spec.
- F-inbox-computer-007 (medium, Split.dc.html): Still open: Split still draws eye and star; Sheet has search, filter, compose; PH-Inbox same plus none; Cleanup panel adds More. DS-04 filter options still Needs reply, Newsletters, Read mail.
- F-inbox-computer-010 (medium, PG-A-Routine.dc.html): Still open: PG-A-Rules still gives SF bubble.left to Ask Inbox agent, Open chat and Open conversation.
- F-inbox-computer-011 (medium, PG-A-InboxMessage.dc.html): Still open: PG-A-InboxMessage unchanged (one message, two attachment rows, no Unsubscribe, no agent failure state).
- F-inbox-computer-012 (low, Sheet.dc.html): Still open: Sheet still has a dot plus a second bullet per unread row and no label chips; PH-Inbox and Split show chips and a single dot.
- F-inbox-computer-013 (medium, DS-05-Lists.dc.html): Still open: PH-Inbox, Sheet and Split draw no To do card above the list.
- F-inbox-computer-014 (medium, Inner.dc.html): Still open: Inner shows the agent thread beside the list; no message pane, compose pane or folders.
- F-inbox-computer-015 (high, PG-A-Computer.dc.html): Partly addressed: PH-Computer draws Watching with Take control and In control with Release. Still missing: booting, Skip / I'm done handoff, lease expiry, reconnecting, takeover denied, load error.
- F-inbox-computer-016 (medium, PG-A-Computer.dc.html): Still open: PH-Computer in control shows close, status chip, keyboard, Release and the key bar (five floating groups); PG-A-Computer has six. README allows three.
- F-inbox-computer-017 (medium, PG-A-Artifact.dc.html): Still open: PG-A-Artifact has no prominent action; Share is an ordinary glass button while the rule card says Share is prominent.
- F-inbox-computer-018 (low, PG-A-Artifact.dc.html): Still open: 'Runway summary' appears in the capsule and the card heading; version switch exists in both the Versions button and the pill.
- F-inbox-computer-019 (medium, PG-A-Image.dc.html): Still open: no Versions menu, delete confirmation, Save to Photos feedback or More menu contents drawn.
- F-inbox-computer-021 (medium, PG-A-Routine.dc.html): Still open: PG-A-Routine unchanged (one routine, no list, history or failed state).
- F-inbox-computer-022 (medium, PG-A-Rules.dc.html): Still open: PG-A-Rules Agent page, list, routine and computer errors still have text only and no retry.
- F-inbox-computer-023 (low, PG-A-AgentList.dc.html): Still open: PG-A-AgentList has no conflict alert, delete affordance or keyboard state.
- F-inbox-computer-024 (low, PG-A-Artifacts.dc.html): Still open: Artifacts chip row still runs off the right edge ('Chief' clipped) with no fade; standard iPhone Artifacts has no board.
- F-inbox-computer-025 (medium, Desk.dc.html): Still open: Desk.dc.html still draws only Finance in laptop pose.
- F-inbox-computer-026 (medium, PG-A-Computer.dc.html): Partly addressed: PH-Computer covers Computer at 393 pt. Artifacts, Artifact, Image, Agent page, Agent list and Routine still have only the Duo outer board.
- F-inbox-computer-027 (low, PG-A-Rules.dc.html): Still open: 'Other mail today' on boards vs Today/Earlier in PH-Inbox; PH-Computer says 'In control', PG-A-Computer 'You have control'.
- F-inbox-computer-028 (suggestion, PG-A-AgentPage.dc.html): Still open (suggestion): runway figures repeat on four screens.
- F-inbox-computer-R1-001 (medium, PH-Inbox.dc.html): New in round 1.
- F-inbox-computer-R1-002 (medium, PG-A-Compose.dc.html): New in round 1.
- F-inbox-computer-R1-003 (medium, PG-A-Cleanup.dc.html): New in round 1.
- F-inbox-computer-R1-004 (medium, PH-Inbox.dc.html): New in round 1.
- F-inbox-computer-R1-005 (low, PG-A-Compose.dc.html): New in round 1.

## Resolved findings

- F-inbox-computer-001: PG-A-Compose draws New message, Reply and the Reply/Reply all/Forward title menu with From, To, Cc/Bcc, Subject, body, attachment, Send, Close. Remaining outcome states split into F-inbox-computer-R1-002.
- F-inbox-computer-002: PH-Inbox now draws the standard iPhone Inbox list with sections, chips, unread dots and swipe. Message view and Ask Inbox agent at 393 pt split into F-inbox-computer-R1-001.
- F-inbox-computer-003: PG-A-Cleanup draws the More menu entry, senders ticked, bulk action menu and Done with Undo. Remaining gaps split into R1-003 and R1-004.
- F-inbox-computer-008: Forward and Reply all are reachable from the Reply title menu drawn in PG-A-Compose. Discoverability (menu only after opening Reply) is R1-005.
- F-inbox-computer-009: PG-A-Thread and Inner now draw the same card: 'Re: Pilot timeline', Needs approval, Save and Send.
- F-inbox-computer-020: PG-A-AgentPage tiles are now 116, 118 and 116 px wide; geometry audit clean.
