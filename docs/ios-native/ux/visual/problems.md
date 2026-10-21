# iOS design boards: ranked problems (round 3)

Source: round 3 audits from ux-flow (STORY-019, 043, 047, 064, 076, 085, redundancy), ux-walker (first-run-home, thread, inbox-computer, finance-settings, duo) and ux-visual (iphone, home, thread, account, inbox, pages), judged against the boards in `docs/design-system/ios/boards/`. All evidence is from static screenshots and board source.

Open counts are approximate after merging duplicates: critical 0, high about 9, medium about 62, low about 120. Raw audit totals are higher because many findings repeat. Severity mapping: visual P1 = high, P2 = medium, P3 = low.

Ranking is severity x journey centrality x reach / effort. Issue ids are the audits' own (STORY-nnn-R3-n, RED-R3-n, F-<area>-..., V-<area>-R3-n).

## Ranked clusters

### C1. First-run model connection (high)
- Root cause: the Connect sheet leads with API key, names only "Model A", offers no way to get or paste a key, and each state (Subscription, Local server, connected card) adds a second prominent action or a wrong default.
- Issues: STORY-019-R3-1, -2, -3, -6; V-home-R3-1, -2, -3, -4, -5; V-account-R3-1; V-thread-R3-10; RED-R3-15; RED-R3-17 (HomeNoModel part).
- Boards: PG-A-HomeNoModel, PG-A-ThreadStates, PG-B-Models.
- Evidence: r3/PG-A-HomeNoModel.png (Local server prefilled with localhost; Subscription "Sign in" gray beside a dimmed Connect).
- Acceptance: one prominent action per frame; "Get a key" link and Paste on the key frame; Local server Address empty with a LAN placeholder; card says Chief cannot reply until a model is connected; New hidden until first message; Chief row previews the latest message after first send; no-model thread disables the composer with a plain line and a real Connect button.
- Judgement: J1 (which method leads).

### C2. Draft edit "Done" and compose consistency (high)
- Root cause: Edit draft ends in the same round up-arrow as Send, and compose frames drift from each other.
- Issues: STORY-047-R3-1, -2, -3, -4; V-inbox-R3-11, -12, -13; RED-R3-4, RED-R3-6.
- Boards: PG-A-Compose, PG-A-Thread, PH-Thread.
- Acceptance: Edit draft ends in a labeled "Done" capsule, dimmed while an address is invalid; Send only on the card and New message; Cc row visible in every New message frame, Bcc behind a chevron; Not sent keeps the Send arrow with Retry in the banner; Cc suggestions overlay the body; discard prompt on Edit draft has only "Discard changes" and "Keep editing"; "Draft replaced" body shows 10:30; one wording for the mail setup prompt.

### C3. Inner display lacks parity with outer boards (high)
- Root cause: inner boards predate the outer revisions: no draft banner, thin Cleanup, thin reply composer, no Compose while reading, no Hide amounts in the half-folded capsule, template tokens.
- Issues: V-inbox-R3-1, -2, -3, -8, -9, -10, -14; STORY-064-R3-1..6; STORY-043-R3-2; STORY-085-R3-1, -2, -3; V-thread-R3-6, -7, -8; F-duo-001; F-finance-settings-R3-001; F-first-run-home-R3-002.
- Boards: Inner, Inner-Message, Split, Sheet, Desk.
- Acceptance: inner message pane draws the Draft ready card; inner Cleanup has back, History, Archive and Unsubscribe and no stray pill; reply composer has From, Cc/Bcc, attach, reply menu; Compose reachable while reading; half-folded Finance capsule has the eye first and no period tabs; no "[N]" or "[AMOUNT]" tokens (invented figures); one Send arrow style; unlabeled chips under the draft removed; frames with an Undo toast use a solid bar; at most three glass groups per frame; Split shows Settings list, Legal list and detail, and open space and New menus.

### C4. Computer screen states (high-medium)
- Root cause: three Computer boards were revised separately, so wording, banners, controls and the handoff entry differ.
- Issues: STORY-076-R3-1, -2 (chip frame, see C12), -3, -4; V-pages-R3-8, -9, -10, -11, -12; RED-R3-14; V-iphone-R3-4; RED-R3-17 (PH-Computer).
- Boards: PG-A-Computer, PH-Computer, Desk-Computer, PG-A-ThreadStates.
- Acceptance: "You are driving" everywhere; banners above the viewport; typing frame with keyboard; close X in every state; Control denied offers an ask action and disables Try again; keyboard row and action bar one glass group; no Team chip above "Team computer"; Finance row "Sign in to bank portal" with "Needs you" and a thread handoff card opening Computer; Desk-Computer hides the picker once control starts and has a Watching frame with Take control.

### C5. One identity and one vocabulary (medium, widest reach)
- Root cause: sample data and nouns were set per board.
- Issues: RED-R3-9; V-iphone-R3-5; F-duo-R2-002; RED-R3-8; RED-R3-10; RED-R3-11; F-first-run-home-R2-001; F-duo-R3-001.
- Boards: PH-Home, Split, PG-B-Settings, PG-B-Account, PH-Pages, PH-Spaces, DS-03, DS-04, PG-A-Home.
- Acceptance: one signed-in person (Alex Morgan, "AM") everywhere; no visible "bot" text; "Archived agents"; Settings uses one close control on all boards; "Page" names only content pages.

### C6. Cleanup flow (medium)
- Root cause: the only confirm archives and unsubscribes together; entry differs by board; label is tiny.
- Issues: STORY-062 and STORY-115 findings; V-inbox-R3-4, -5, -6; RED-R3-5; RED-R3-18.
- Boards: PG-A-Cleanup, PH-Inbox (Split and Sheet in C3).
- Acceptance: Archive and Unsubscribe have separate confirms; Undo offered once; "Skip inbox for future mail" explained or removed; one entry location on every board.
- Judgement: J2.

### C7. Chat run, reaction and archive behavior (medium)
- Root cause: thread states were drawn without agreed rules for typing during a run, reactions, and landing after archive.
- Issues: V-thread-R3-1, -2, -3, -4, -5; V-iphone-R3-1, -2, -3; F-thread-R3-001; STORY-043-R3-1, -3, -5; RED-R3-11.
- Boards: PG-A-Thread, PG-A-GroupThread, PG-A-ThreadStates, PH-Thread, PH-GroupThread, DS-06-Chat.
- Acceptance: running composer behavior drawn once and matching DS-06; Archive returns to the list with a bottom Undo toast; Agent-editing frame shows Stop and a working avatar; four-file frame shows "4 files is the maximum" with the story's file names; Add a recipient is a tappable row with chevron; reaction rule identical in DS-06 and PH-Thread; multi-select pickers drawn; Page and List moved into the chat menu; at most three glass groups.
- Judgement: J3.

### C8. Finance, Legal, Cap table, Data room, Agent page (medium)
- Issues: V-pages-R3-1, -2, -3, -4, -5, -6, -7, -13, -14, -17 (CapTable), -20..-29; STORY-085-R3-4, -5, -6 (board side); F-finance-settings-R3-002; V-iphone-R3-7.
- Boards: PG-B-Finance, PG-B-Legal, PG-B-CapTable, PG-B-DataRoom, PG-A-AgentPage, PG-A-Activity.
- Acceptance: Add holder Role shows role options and the sheet is named consistently with the rule card; Deadlines sorted soonest first with notice dates; scan-blocked copy "Contract scanning isn't set up" with "Set up scanning"; Not scanned keeps the rows; the task action is the prominent control in empty and blocked states; Data room folder frame exists; Finance loading, empty and error frames; Agent page subtitle links to its routine.

### C9. Account, Settings, Integrations structure and safety (medium)
- Issues: V-account-R3-2..22; RED-R3-1, -19; F-first-run-home-R3-001, -003..-009; V-thread-R3-9.
- Boards: PG-B-Settings, PG-B-Integrations, PG-B-Consent, PG-B-Account, PG-B-SignIn, PG-B-SignUp, PG-B-Server, PG-B-ForgotPassword, PG-B-Voice, PG-B-Models.
- Acceptance: "Allowed without asking" is a top-level Settings row; Language, Appearance, Hide amounts in Settings; Server appears once; Voice separates choosing from configuring; Integrations from Settings has no Skip or Continue; sign-up errors under their own field; focus ring on the active field only; Password changed keeps the full list; After delete reuses SignUp; AI data sharing toggles confirm; Switch server alert mentions unsent drafts; Privacy details is a full-width row.
- Judgement: J5 (where permissions and preferences live).

### C10. Home roster and entry points (medium)
- Issues: V-home-R3-6..12; V-iphone-R3-6, -8; RED-R3-2, -3, -7, -13; F-thread-016; STORY-085-R3-7.
- Boards: PG-A-Home, Main, PH-Home, PH-Spaces, PG-B-Spaces, PG-B-NewSpace, PG-B-NewBot, PG-B-NewGroup.
- Acceptance: one retry style for Could not load; Inbox row in one fixed slot; offline keeps the approval description; New space has a labeled keyboard, outlined Name field and placeholder; helper text under Name; Save in the sheet header; PH-Spaces menu has New space; every agent reachable from Home; one waiting-state phrase.
- Judgement: J4.

### C11. Prominence and glass budget (medium)
- Issues: RED-R3-17; F-inbox-computer-R3-001, R3-002; V-pages-R3-7, -14.
- Boards: PH-Inbox, PG-A-Image, PG-A-Artifact, PG-A-Cleanup, PG-A-Computer.
- Acceptance: exactly one tinted prominent action per frame; at most three glass groups.

### C12. Artifact, routine and agent list gaps (medium)
- Issues: V-pages-R3-15, -16, -17 (Routine), -18, -19; STORY-076-R3-2, -5.
- Boards: PG-A-Artifacts, PG-A-Artifact, PG-A-Image, PG-A-Routine, PG-A-AgentList.
- Acceptance: empty Artifacts has a next step; Version subtitle opens Versions; Restore is the only prominent action on an older version; Edit routine has a Discard alert; Delete routine with confirmation; Clear done items has undo; a "Runway summary" chip frame exists.

### C13. Standard iPhone (393 pt) coverage (medium, product call)
- Issues: F-inbox-computer-026, F-inbox-computer-R1-001, F-duo-R2-004, STORY-019-R3-4.
- Default: rule cards state that Duo is the spec for Artifacts, Image, Agent page, Routine and form sheets; add 393 pt Connect sheet frames to PH-Home.

### C14. Rule cards and catalog out of date (medium)
- Issues: F-inbox-computer-R2-001; STORY-085-R3-5, -6; F-finance-settings-R3-003, -004; STORY-043-R3-4; STORY-064-R3-7.
- Files: PG-A-Rules, PG-B-Rules, catalog.md, README.md.
- Acceptance: each card quotes the board's actual labels (Today and Earlier, Starting Team computer, Add holder, Scan now in content).

## Judgement clusters
J1 first-model connect method; J2 Cleanup entry and confirm; J3 chat run, reactions and archive landing; J4 Home roster and section noun; J5 location of permissions and preferences.
