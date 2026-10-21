# Walk: Inbox triage and compose; Team Computer, artifacts, pages, routines (round 2)

Stories STORY-056 to STORY-077, 102, 108, 114 and 115. Steps are judged against board screenshots; boards are static, so transitions and keyboard behavior are not verified. Findings are in `inbox-computer-findings.json` (36 total: 10 open, 26 resolved).

Limits: DS-04 and DS-05 specimens and the PG-A-Rules cards were read from board source text, because their screenshots are tall and downscaled.

## Result

Open: 4 medium, 5 low, 1 suggestion; no critical or high. Round 2 resolved 20 findings, including every prior high finding (compose, standard Inbox list, Cleanup, Inbox states, Computer states).

## Geometry audit (once per board, viewport 2000x2000)

| Board | Result |
| --- | --- |
| PH-Inbox, Sheet, Split, Inner, Inner-Message, PG-A-Cleanup | Only dot/text, name/time and icon/label pairs flagged; no overflow. Clean. |
| PG-A-Compose, PG-A-Computer, PH-Computer, Desk-Computer, PG-A-Image | Short button labels reported as wrapped; screenshots show single lines. Clean. |
| PG-A-InboxMessage, PG-A-Routine, PG-A-AgentPage, PG-A-AgentList, PG-A-Artifact | Only paired-element width differences. Clean. |
| PG-A-Artifacts | Chip widths differ by label (fine); the chip row is cut by the frame edge, confirmed in the screenshot (F-024). |
| Desk | Chart bars flagged; intentional. Clean. |

## Step walk

- STORY-056 Triage: PH-Inbox and Sheet draw sections, unread dot, chips, To do card, swipe (Spam, Archive), Archived toast with Undo, and Couldn't archive with Try again (pass). Specimen now matches (F-005, F-006 resolved).
- STORY-057 Read and ask: PG-A-InboxMessage draws message, Reply menu, attachment preview, thread, Unsubscribe row, failures (pass on Duo). No 393 pt message view (R1-001).
- STORY-058, 059, 065, 114 Reply, Forward, Compose: PG-A-Compose draws all editing, send, error, unknown, writes-off and discard states (pass on Duo). Standard iPhone compose is not drawn (R1-001).
- STORY-060 Search and filter: control set is now the same on every board (pass). Filter menu, results and no-results are not drawn (R2-003).
- STORY-061 To do: card drawn on PH-Inbox and Sheet (pass).
- STORY-062, 115 Cleanup: entry through More, tick, Archive confirm, in progress, failed, Done with Undo, empty and History drawn. Unsubscribe has no confirm (R2-002). One prominent action is correct.
- STORY-063, 066 Writes off, no account, first sync, consent: all drawn on PH-Inbox and Sheet (pass).
- STORY-064 Inner triage: Inner (agent thread) and Inner-Message (message) drawn. Compose pane, empty detail and folders are not (F-014, low).
- STORY-067, 068, 102 Computer: eight states drawn on both Duo and 393 pt, plus Desk-Computer in laptop pose (pass). Glass count is within the rule.
- STORY-069 to 072 Artifacts: Share is prominent, Image draws More, Versions, Delete and Saved to Photos (pass). Artifacts list is one frame with a clipped chip row and no standard iPhone board (F-024, F-026).
- STORY-073 to 075, 077 Page, list, routine, failures: Retry now on all load errors; routine list, history and failed run drawn (pass). Agent list conflict and delete not drawn (F-023).
- STORY-076 Handoff across screens: every screen has a board for the happy path; runway figures repeat (F-028).

## Flow log

| Story | Designed vs ideal | Note |
| --- | --- | --- |
| 056 | 3 vs 3 | Undo drawn |
| 057 | 2 vs 2 on Duo; unknown on 393 pt | no PH message board |
| 058, 059, 065 | compose drawn, Forward 2 taps via Reply menu | acceptable |
| 062, 115 | 5 vs 5 | Unsubscribe lacks confirm |
| 067, 068 | 2 vs 2 | all states drawn |
| 070 | 3 vs 3 | pill switches versions, Share prominent |
| 073-075 | 3-4 vs 3-4 | bubble means the agent thread everywhere |

## Open findings

- F-inbox-computer-014 (low, Inner.dc.html): Inner-Message draws the message pane beside the list (resolved part). Still missing: compose pane beside the list, empty detail pane, and folders. Severity lowered to low. 
- F-inbox-computer-023 (low, PG-A-AgentList.dc.html): PG-A-AgentList is unchanged: list and load error only. No conflict alert ("The bot changed this list"), no swipe-to-delete, no keyboard-open state. 
- F-inbox-computer-024 (low, PG-A-Artifacts.dc.html): PG-A-Artifacts is a single frame: the chip row still runs off the right edge ("Chief" clipped, no fade), and there are no search-open, no-results, empty or error frames; no standard iPhone Artifacts board. 
- F-inbox-computer-026 (medium, PG-A-Computer.dc.html): PH-Computer covers the Computer at 393 pt. Artifacts, Artifact, Image, Agent page, Agent list and Routine still have only the Duo outer board; no standard iPhone variants or entry to Artifacts. 
- F-inbox-computer-027 (low, PG-A-Rules.dc.html): Mixed names remain: Sheet, Split, Inner and the rule card say "Other mail today" while PH-Inbox and Sheet frames use "Today" and "Earlier"; Desk-Computer says "You have control" while the other Computer boards say "You are driving"; Rule card says "Open conversation" while the Routine board has "Open last run". 
- F-inbox-computer-028 (suggestion, PG-A-AgentPage.dc.html): Suggestion. Runway figures still repeat on the Finance page, artifact, agent page and routine prompt; page bullets are not links. 
- F-inbox-computer-R1-001 (medium, PH-Inbox.dc.html): Ask Inbox agent is now the prominent bubble on PH-Inbox (resolved part). Still missing at 393 pt: message view and compose page (STORY-057, 058, 114 judge them against the outer-display boards), and the Cleanup entry/Reply menu. 
- F-inbox-computer-R2-001 (medium, PG-A-Rules.dc.html): New in round 2. 
- F-inbox-computer-R2-002 (medium, PG-A-Cleanup.dc.html): New in round 2. 
- F-inbox-computer-R2-003 (low, PH-Inbox.dc.html): New in round 2. 

## Resolved findings

- F-inbox-computer-001 (high, Sheet.dc.html): PG-A-Compose draws New message, Reply and the Reply/Reply all/Forward title menu with From, To, Cc/Bcc, Subject, body, attachment, Send, Close. Remaining outcome states split into F-inbox-computer-R1-002.
- F-inbox-computer-002 (high, Sheet.dc.html): PH-Inbox now draws the standard iPhone Inbox list with sections, chips, unread dots and swipe. Message view and Ask Inbox agent at 393 pt split into F-inbox-computer-R1-001.
- F-inbox-computer-003 (high, none): PG-A-Cleanup draws the More menu entry, senders ticked, bulk action menu and Done with Undo. Remaining gaps split into R1-003 and R1-004.
- F-inbox-computer-004 (high, PG-A-Rules.dc.html): PH-Inbox and Sheet draw Inbox zero, Mail changes off (Turn on), Gmail needs reconnecting (Reconnect), No mail account (Connect Gmail), Consent needed (Allow / Not now) and First sync. Rate-limited state not drawn (minor). PG-A-Rules Inbox card still lists only the old states (R2-001).
- F-inbox-computer-005 (medium, DS-05-Lists.dc.html): PH-Inbox and Sheet draw an Archived toast with Undo and a Couldn't archive toast with Try again; the same pair appears on PG-A-InboxMessage.
- F-inbox-computer-006 (medium, DS-05-Lists.dc.html): DS-05 swipe specimen now offers Spam and Archive (Mark read / Mark unread on the leading side); Star and Mute are gone and PH-Inbox/Sheet match.
- F-inbox-computer-007 (medium, Split.dc.html): Sheet, PH-Inbox and Split now share Search, Filter, Compose, More and the prominent Ask Inbox agent; eye and star are gone (Split keeps an inline search field in the list header, as the rule card says). Filter menu contents appear only in DS-04 (R2-003).
- F-inbox-computer-008 (medium, PG-A-InboxMessage.dc.html): Forward and Reply all are reachable from the Reply title menu drawn in PG-A-Compose. Discoverability (menu only after opening Reply) is R1-005.
- F-inbox-computer-009 (medium, Inner.dc.html): PG-A-Thread and Inner now draw the same card: 'Re: Pilot timeline', Needs approval, Save and Send.
- F-inbox-computer-010 (medium, PG-A-Routine.dc.html): Each screen now has its own accessible name in the rule cards (Ask Inbox agent, Open chat, Open conversation) and the Routine board has a separate Open last run with a clock glyph. The bubble still means "go to the agent thread" everywhere.
- F-inbox-computer-011 (medium, PG-A-InboxMessage.dc.html): PG-A-InboxMessage now draws attachment preview, multi-message thread, Unsubscribe row and confirm, next message after Archive, Archive failed and Ask Inbox agent failed.
- F-inbox-computer-012 (low, Sheet.dc.html): Sheet rows now have one unread dot and label chips (Draft ready, Needs attention, Newsletter, Junk), matching PH-Inbox.
- F-inbox-computer-013 (medium, DS-05-Lists.dc.html): PH-Inbox and Sheet draw the To do card above Needs reply. Split and Inner do not show it (low; the inner list header could carry it).
- F-inbox-computer-015 (high, PG-A-Computer.dc.html): PG-A-Computer and PH-Computer draw Watching, In control, Agent waiting (I'm done / Skip), Starting, Control ended (idle), Reconnecting, Control denied and Can't connect (Retry). Return is not on the key bar, but the system keyboard has it (Desk-Computer shows the keyboard).
- F-inbox-computer-016 (medium, PG-A-Computer.dc.html): In control the outer and standard boards now show a Team chip, a Fit button and the key bar over the screen (three clear glass groups) plus the one prominent Release control; Close is hidden while in control per the rule card.
- F-inbox-computer-017 (medium, PG-A-Artifact.dc.html): PG-A-Artifact draws Share as the ink-filled prominent button at the bottom of the strip.
- F-inbox-computer-018 (low, PG-A-Artifact.dc.html): The card heading is gone (title in the capsule only) and versions switch through the pill; the Versions list lives in the More menu (drawn on PG-A-Image).
- F-inbox-computer-019 (medium, PG-A-Image.dc.html): PG-A-Image draws the More menu (Versions, Delete), the Versions menu, the Delete confirmation with its warning copy and the Saved to Photos toast.
- F-inbox-computer-020 (medium, PG-A-AgentPage.dc.html): Tile widths remain equal (116, 118, 116) in the current board.
- F-inbox-computer-021 (medium, PG-A-Routine.dc.html): PG-A-Routine draws the Routines list (with Paused and Last run failed rows), Routine, More menu (Pause, Edit), Run history, Last run failed with Run again, and Load error.
- F-inbox-computer-022 (medium, PG-A-Rules.dc.html): Agent page, Agent list, Routine and Artifact-family load errors on the boards now show an icon, title and a Retry button; Computer shows Retry. The rule cards still read as text only (R2-001).
- F-inbox-computer-025 (medium, Desk.dc.html): Desk-Computer draws the Computer in laptop pose (screen above, Keyboard/Fit group, Release, key bar, system keyboard). Other pages derive their laptop pose from the rule cards, which is acceptable for static reading pages.
- F-inbox-computer-R1-002 (medium, PG-A-Compose.dc.html): PG-A-Compose now draws Cc suggestions, invalid address, send disabled, sending, not sent (Retry), result unknown (Open Sent / Send again), mail changes off (Turn on), and the discard and save-draft sheets.
- F-inbox-computer-R1-003 (medium, PG-A-Cleanup.dc.html): PG-A-Cleanup now draws confirm, in progress, failed (Try again), done with Undo, empty and History (with Undo per entry). Unsubscribe has no confirmation (R2-002).
- F-inbox-computer-R1-004 (medium, PH-Inbox.dc.html): PH-Inbox and Sheet now have a More button in the control group; PG-A-Cleanup frame 1 draws the menu with Cleanup.
- F-inbox-computer-R1-005 (low, PG-A-Compose.dc.html): PG-A-InboxMessage frame 2 draws the Reply menu (Reply, Reply all, Forward) from the Reply button.
