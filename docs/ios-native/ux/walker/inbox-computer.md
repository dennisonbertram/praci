# Walk: Inbox triage and compose; Team Computer, artifacts, pages, routines (round 3)

Stories STORY-056 to STORY-077, 102, 108, 114 and 115, judged against the current board screenshots. Boards are static, so transitions are not verified. Findings are in `inbox-computer-findings.json` (43 total: 16 open, 27 resolved).

Limits: the PG-A-Rules cards and DS-04/DS-05 specimens were read from board text, not from the downscaled screenshots. Round 3 re-checked every board after the round-2 fix commit; most open items from round 2 are unchanged.

## Result

Open: 5 medium, 10 low, 1 suggestion; no critical or high. Resolved this round: F-009 (re-confirmed), F-014 (inner compose pane, empty detail and Cleanup now drawn). Partly improved but still open: Agent list (F-023), Artifacts (F-024). New: two medium findings about prominent actions, five low visual or consistency findings.

## Geometry audit (once per board, viewport 2000x2000)

All 17 boards: no page overflow and no text overflow spills. Buttons reported as wrapped (Team, Private, Take control, Esc, Save draft, Review draft, Edit, Send, Retry, version rows) are single lines in the screenshots. PH-Inbox reports the top-bar gaps 47/8 px (Back, then the control group, then Ask); this matches the leading Back and trailing actions in the screenshot. PG-A-Artifacts chips differ in width by label and the row is cut by the frame edge (F-024).

## Step walk

- STORY-056 Triage: PH-Inbox and Sheet draw sections, unread dot, chips, To do, swipe, Archived with Undo, Couldn't archive with Try again (pass). The prominent action differs between boards (R3-001), swipe actions differ (R3-007), toast shows rows through it (R3-006).
- STORY-057 Read and ask: PG-A-InboxMessage draws message, Reply menu, attachment preview, thread, Unsubscribe confirm, next message, failures (pass on Duo). No 393 pt message view (R1-001).
- STORY-058, 059, 065, 114 Compose: PG-A-Compose draws New message, Reply, Reply all and Forward menu, Cc suggestions, invalid address, discard sheets, sending, not sent, unknown result and writes off (pass on Duo). Retry and unknown-result banner are cramped (R3-004). Not drawn at 393 pt (R1-001).
- STORY-060 Search and filter: same control set on every board; Filter menu and results not drawn (R2-003).
- STORY-061 To do: card on PH-Inbox (pass).
- STORY-062, 115 Cleanup: entry through More, tick, menu, combined confirm, progress, failed, Done with Undo, empty, History (pass). Unsubscribe alone has no confirm (R2-002).
- STORY-063, 066 States: writes off, reconnect, no account, consent, declined, first sync all drawn (pass).
- STORY-064 Inner triage: Inner-Message draws message, Reply inner flat and half-folded, After Archive, Inbox zero, Cleanup (pass). Inner list rows differ from other boards (R3-005).
- STORY-067, 068, 102 Computer: eight states plus Private on Duo, eight on 393 pt, laptop pose with keyboard (pass). One prominent control per state; glass count within the rule.
- STORY-069 to 072 Artifacts: list now has empty, loading, error, search, no results; Artifact has More, Versions, Older version; Image has More, Versions, Delete confirm, Saved to Photos (pass). Older version has two prominent actions (R3-002). Chip row clipped (F-024).
- STORY-073 to 075, 077 Page, list, routine: routines list, run history, paused, failed, edit sheet, load errors with Retry drawn. Agent list conflict and delete not drawn (F-023).
- STORY-076 Handoff: every screen has a board; figures repeat (F-028).

## Flow log

| Story | Designed vs ideal | Note |
| --- | --- | --- |
| 056 | 3 vs 3 | Undo drawn |
| 057 | 2 vs 2 on Duo; unknown at 393 pt | no PH message board |
| 058, 059, 065 | Forward 2 taps via Reply menu | acceptable |
| 062, 115 | 5 vs 5 | Unsubscribe alone lacks confirm |
| 067, 068 | 2 vs 2 | all states drawn |
| 070 | 3 vs 3 | Share and Restore compete |
| 073-075 | 3-4 vs 3-4 | bubble opens the agent thread |

## Open findings

- F-inbox-computer-023 (low, PG-A-AgentList.dc.html): The Agent list has no design for the conflict alert ('The bot changed this list'), delete affordance, or keyboard covering the Add item field. Fix: Add swipe-to-delete and the conflict alert.
- F-inbox-computer-024 (low, PG-A-Artifacts.dc.html): The standard iPhone entry to Artifacts is undefined, and the Artifacts chip row is cut at the right edge with no overflow hint or fade; search is an icon with no expanded state. Fix: Draw the expanded search and a trailing fade on the chips.
- F-inbox-computer-026 (medium, PG-A-Computer.dc.html): Seven stories use a standard iPhone for Computer, Artifacts, Artifact, Image and Agent list, but all boards are Duo outer. Close, Keyboard, Fit to screen and Take control placement on a 393 pt width is undefined. Fix: Add a standard-width recipe to PG-A-Rules and one drawn example.
- F-inbox-computer-027 (low, PG-A-Rules.dc.html): Names differ between boards, plan and Expo: 'Other mail today' vs Today/Earlier, 'Ask Inbox agent' vs 'Ask agent', 'open computer' (lowercase in the rule card) vs 'Open computer'. Fix: Pick the board names and update the catalog and plan.
- F-inbox-computer-028 (suggestion, PG-A-AgentPage.dc.html): Runway figures appear on the Finance page, the Runway summary artifact, the agent page and the routine prompt with no link between them, and the agent page bullets ('4 card expenses need receipts') are not tappable. Fix: Make bullets link to the relevant screen, or drop duplicated tiles.
- F-inbox-computer-R1-001 (medium, PH-Inbox.dc.html): PH-Inbox now has the prominent Ask Inbox agent button, but there is still no standard iPhone message view or compose page; STORY-057, 058, 114 are judged against the Duo outer boards. Fix: Add the prominent Ask Inbox agent control to PH-Inbox (or say compose stays the single prominent action and the agent is in More) and add PH message and compose boards.
- F-inbox-computer-R2-001 (medium, PG-A-Rules.dc.html): The rule cards were not updated with the boards: Inbox lists only Inbox zero / loading / "Could not load mail"; Computer says "Booting [name]" with a progress bar while the board says "Starting Team computer" and puts Take control at the bottom, not in the strip; Agent page, list and routine errors have no Retry in text; Routine says prominent "Open conversation" while the board has Open last run plus a bubble; Artifact mentions Older/Newer versions. Fix: Rewrite the Inbox, Inbox message, Computer, Routine, Agent page/list and Artifact empty/error lines from the drawn frames.
- F-inbox-computer-R2-002 (low, PG-A-Cleanup.dc.html): Archive has a confirm sheet, but Unsubscribe from 2 senders does not; it cannot be undone (only said afterwards: "Unsubscribing can't be undone"), and the menu says "2 senders" while 3 are ticked with no reason given. Fix: Draw a confirm for Unsubscribe saying it cannot be undone, and say why only 2 of 3 senders qualify (for example, "1 has no unsubscribe link").
- F-inbox-computer-R2-003 (low, PH-Inbox.dc.html): No Inbox board draws the Filter menu, an active filter chip, search results or "No matching mail"; the filter options live only in the DS-04 spec (Needs reply, Newsletters, Read mail, Important only). Fix: Add frames for the Filter menu, search results and no results to PH-Inbox.
- F-inbox-computer-R3-001 (medium, PH-Inbox.dc.html): The one prominent action differs by device: on PH-Inbox the Compose button is the white filled control and Ask is glass; on Sheet, Inner-Message and PG-A-InboxMessage the Ask Inbox agent bubble is white and Compose is glass. Fix: Pick one prominent Inbox action for every layout and fill only that one.
- F-inbox-computer-R3-002 (medium, PG-A-Image.dc.html): In the Older version frame (Image and Artifact) both Share and the Restore pill are white and filled, so there are two prominent actions and the user cannot tell which is the next step. Fix: Make Share glass while an older version is shown; leave Restore as the only prominent action.
- F-inbox-computer-R3-003 (low, PG-A-AgentList.dc.html): Save error frame shows a white Retry button beside the white prominent chat bubble, and the Clear done items menu entry has no confirm. Fix: Draw Retry as a glass or text control, and add a confirm or Undo for Clear done items.
- F-inbox-computer-R3-004 (low, PG-A-Compose.dc.html): Not sent shows Retry as small text inside a 38 pt circle, and Send result unknown wraps its message to three lines with Open Sent and Send again squeezed beside it. Fix: Make Retry the normal Send control with a label, and stack Open Sent and Send again under the message.
- F-inbox-computer-R3-005 (low, Inner.dc.html): Inner draws mail rows differently from Sheet, PH-Inbox and Inner-Message: unread dot before the sender name, no label chips, Example Weekly has no unread dot, and the section is Other mail today 24. Fix: Reuse the PH-Inbox row (dot, chips, Today/Earlier) on Inner.
- F-inbox-computer-R3-006 (low, PH-Inbox.dc.html): In the Archived and Couldn't archive frames the translucent toast lets row text show through and a stray character pokes out at the right edge (also on Sheet). Fix: Make the toast background solid enough to hide rows, or clip the list above it.
- F-inbox-computer-R3-007 (low, Sheet.dc.html): The Sheet swipe frame offers only Archive while PH-Inbox swipe offers Spam and Archive; Spam on Sheet appears only in the press-and-hold menu. Fix: Show the same swipe actions on both boards.

## Resolved findings

- F-inbox-computer-001 (high, Sheet.dc.html): PG-A-Compose draws New message, Reply and the Reply/Reply all/Forward title menu with From, To, Cc/Bcc, Subject, body, attachment, Send, Close. Remaining outcome states split into F-inbox-computer-R1-002. (round 3: still holds)
- F-inbox-computer-002 (high, Sheet.dc.html): PH-Inbox now draws the standard iPhone Inbox list with sections, chips, unread dots and swipe. Message view and Ask Inbox agent at 393 pt split into F-inbox-computer-R1-001. (round 3: still holds)
- F-inbox-computer-003 (high, none): PG-A-Cleanup draws the More menu entry, senders ticked, bulk action menu and Done with Undo. Remaining gaps split into R1-003 and R1-004. (round 3: still holds)
- F-inbox-computer-004 (high, PG-A-Rules.dc.html): PH-Inbox and Sheet draw Inbox zero, Mail changes off (Turn on), Gmail needs reconnecting (Reconnect), No mail account (Connect Gmail), Consent needed (Allow / Not now) and First sync. Rate-limited state not drawn (minor). PG-A-Rules Inbox card still lists only the old states (R2-001). (round 3: still holds)
- F-inbox-computer-005 (medium, DS-05-Lists.dc.html): PH-Inbox and Sheet draw an Archived toast with Undo and a Couldn't archive toast with Try again; the same pair appears on PG-A-InboxMessage. (round 3: still holds)
- F-inbox-computer-006 (medium, DS-05-Lists.dc.html): DS-05 swipe specimen now offers Spam and Archive (Mark read / Mark unread on the leading side); Star and Mute are gone and PH-Inbox/Sheet match. (round 3: still holds)
- F-inbox-computer-007 (medium, Split.dc.html): Sheet, PH-Inbox and Split now share Search, Filter, Compose, More and the prominent Ask Inbox agent; eye and star are gone (Split keeps an inline search field in the list header, as the rule card says). Filter menu contents appear only in DS-04 (R2-003). (round 3: still holds)
- F-inbox-computer-008 (medium, PG-A-InboxMessage.dc.html): Forward and Reply all are reachable from the Reply title menu drawn in PG-A-Compose. Discoverability (menu only after opening Reply) is R1-005. (round 3: still holds)
- F-inbox-computer-009 (medium, Inner.dc.html): PG-A-Thread and Inner draw the same card: 'Re: Pilot timeline', Needs approval, Edit and Send (round 3 re-check).
- F-inbox-computer-010 (medium, PG-A-Routine.dc.html): Each screen now has its own accessible name in the rule cards (Ask Inbox agent, Open chat, Open conversation) and the Routine board has a separate Open last run with a clock glyph. The bubble still means "go to the agent thread" everywhere. (round 3: still holds)
- F-inbox-computer-011 (medium, PG-A-InboxMessage.dc.html): PG-A-InboxMessage now draws attachment preview, multi-message thread, Unsubscribe row and confirm, next message after Archive, Archive failed and Ask Inbox agent failed. (round 3: still holds)
- F-inbox-computer-012 (low, Sheet.dc.html): Sheet rows now have one unread dot and label chips (Draft ready, Needs attention, Newsletter, Junk), matching PH-Inbox. (round 3: still holds)
- F-inbox-computer-013 (medium, DS-05-Lists.dc.html): PH-Inbox and Sheet draw the To do card above Needs reply. Split and Inner do not show it (low; the inner list header could carry it). (round 3: still holds)
- F-inbox-computer-014 (low, Inner.dc.html): Inner-Message now draws the message beside the list, Reply in the inner and half-folded layouts, After Archive, Inbox zero (empty detail) and Cleanup. Folders do not exist in the Inbox plan (sidebar is Inbox only).
- F-inbox-computer-015 (high, PG-A-Computer.dc.html): PG-A-Computer and PH-Computer draw Watching, In control, Agent waiting (I'm done / Skip), Starting, Control ended (idle), Reconnecting, Control denied and Can't connect (Retry). Return is not on the key bar, but the system keyboard has it (Desk-Computer shows the keyboard). (round 3: still holds)
- F-inbox-computer-016 (medium, PG-A-Computer.dc.html): In control the outer and standard boards now show a Team chip, a Fit button and the key bar over the screen (three clear glass groups) plus the one prominent Release control; Close is hidden while in control per the rule card. (round 3: still holds)
- F-inbox-computer-017 (medium, PG-A-Artifact.dc.html): PG-A-Artifact draws Share as the ink-filled prominent button at the bottom of the strip. (round 3: still holds)
- F-inbox-computer-018 (low, PG-A-Artifact.dc.html): The card heading is gone (title in the capsule only) and versions switch through the pill; the Versions list lives in the More menu (drawn on PG-A-Image). (round 3: still holds)
- F-inbox-computer-019 (medium, PG-A-Image.dc.html): PG-A-Image draws the More menu (Versions, Delete), the Versions menu, the Delete confirmation with its warning copy and the Saved to Photos toast. (round 3: still holds)
- F-inbox-computer-020 (medium, PG-A-AgentPage.dc.html): Tile widths remain equal (116, 118, 116) in the current board. (round 3: still holds)
- F-inbox-computer-021 (medium, PG-A-Routine.dc.html): PG-A-Routine draws the Routines list (with Paused and Last run failed rows), Routine, More menu (Pause, Edit), Run history, Last run failed with Run again, and Load error. (round 3: still holds)
- F-inbox-computer-022 (medium, PG-A-Rules.dc.html): Agent page, Agent list, Routine and Artifact-family load errors on the boards now show an icon, title and a Retry button; Computer shows Retry. The rule cards still read as text only (R2-001). (round 3: still holds)
- F-inbox-computer-025 (medium, Desk.dc.html): Desk-Computer draws the Computer in laptop pose (screen above, Keyboard/Fit group, Release, key bar, system keyboard). Other pages derive their laptop pose from the rule cards, which is acceptable for static reading pages. (round 3: still holds)
- F-inbox-computer-R1-002 (medium, PG-A-Compose.dc.html): PG-A-Compose now draws Cc suggestions, invalid address, send disabled, sending, not sent (Retry), result unknown (Open Sent / Send again), mail changes off (Turn on), and the discard and save-draft sheets. (round 3: still holds)
- F-inbox-computer-R1-003 (medium, PG-A-Cleanup.dc.html): PG-A-Cleanup now draws confirm, in progress, failed (Try again), done with Undo, empty and History (with Undo per entry). Unsubscribe has no confirmation (R2-002). (round 3: still holds)
- F-inbox-computer-R1-004 (medium, PH-Inbox.dc.html): PH-Inbox and Sheet now have a More button in the control group; PG-A-Cleanup frame 1 draws the menu with Cleanup. (round 3: still holds)
- F-inbox-computer-R1-005 (low, PG-A-Compose.dc.html): PG-A-InboxMessage frame 2 draws the Reply menu (Reply, Reply all, Forward) from the Reply button. (round 3: still holds)
