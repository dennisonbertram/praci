# Visual findings: iPhone boards, round 2

Boards: PH-Home, PH-Thread, PH-GroupThread, PH-Inbox, PH-Computer, PH-Spaces. Every frame of each grid was judged. Screenshots are in `shots/` (scratch, not committed); audits are in `audit.json`; the second opinions are in `second-opinion.json` (both models ran). Found by: [own] my reading of the screenshot; [muse] Meta MUSE Wonder; [argon] Gemini 4 Argon. "Verified" means I checked the claim against the screenshot.

Audit summary: the boards are multi-frame grids wider than the 393 pt viewport, so page-level scroll and overflow numbers are meaningless; the audits reported no target under 44 pt and no off-screen primary action. Off-scale spacing values: Home and Spaces 3, 6, 7, 9, 10, 14, 18; Thread 6, 9, 10, 14; GroupThread 5, 6, 10, 14; Inbox 6, 10, 14; Computer 6, 10, 14, 18, 22. Several external claims were rejected after checking (keyboard row clipping, space-menu indent, Personnel having no card surface as a defect).

## Findings

| id | level | board | element | problem | norm violated | evidence | severity | found by | verified |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| V-iphone-R2-1 | page | PH-Spaces | "Switching to Northwind" frame, Pages list | Activity and Personnel show skeletons, but Pages still shows Personal's data (Inbox 3 need reply, Finance 6 mo runway, Legal 2 deadlines) under the Northwind title. The user cannot tell whether these numbers belong to Northwind. Round 1's stale-data issue is only half fixed. | H5, I6, C3 | PH-Spaces.png right frame vs PH-Home.png | P1 | own, muse, argon | yes |
| V-iphone-R2-2 | component | PH-Thread | "Agent editing the draft" frame, Send | The badge reads Updating and Edit is disabled, but Send is the bright white enabled action. The founder can send an email the agent is still rewriting. | I3, H1 | PH-Thread.png row 2, third frame | P1 | own, muse, argon | yes |
| V-iphone-R2-3 | component | PH-GroupThread | Header right glass group (people, page, more) | The group runs flush to the screen edge with no right gutter; the "..." button touches the edge. Thread and Inbox keep a 15 pt gutter. | L4, H5, I4 | PH-GroupThread.png both frames; crop at 3x | P2 | own | yes |
| V-iphone-R2-4 | group | PH-Home | No model frame | The same fact appears three times: "Connect a model to start chatting.", the "Connect a model" button, and the Chief subtitle "Connect a model to chat". | C2, C4 | PH-Home.png right frame | P2 | own | yes |
| V-iphone-R2-5 | group | PH-Home, PH-Spaces | Personnel list order and Inbox agent row | Order is 2:59 PM, Yesterday, 2:44 PM, 2:06 PM, so a "Yesterday" row sits above today's rows. The Inbox agent subtitle says "this morning" while the stamp says Yesterday. | C1, H5 | PH-Home.png left frame | P2 | argon, own | yes |
| V-iphone-R2-6 | page | PH-Home | Pages list, Inbox row | The first view fits only Activity, Personnel and the top of Pages; Inbox (3 need reply) is below the fold, and Team computer is not visible at all. The most frequent job (triage mail) costs a scroll. | L2, I5 | PH-Home.png left frame | P2 | own, muse | yes |
| V-iphone-R2-7 | component | PH-Inbox | "Archived, Undo" and "Archive failed" toasts | The toast sits at the top and covers the Inbox title (and the To do card is gone), and it is far from the thumb that just swiped. | L5, I4, P1 | PH-Inbox.png frames 3 and 4 | P2 | own, argon | yes |
| V-iphone-R2-8 | group | PH-Inbox | "Mail changes off" and "Gmail needs reconnecting" cards | The recovery buttons (Turn on, Reconnect) are grey, while the white prominent button is the header chat icon. The one prominent action points at the wrong thing. | H1, H2 | PH-Inbox.png row 2, frames 2 and 3 | P2 | own, argon | yes |
| V-iphone-R2-9 | group | PH-Thread, PH-Inbox | Header glass groups | Thread has back, agent pill, right group, and the composer: four glass groups. Inbox has back, search/filter/compose, more, and the chat button: four. The rules allow three. | Design rules (max three glass groups) | PH-Thread.png frame 1; PH-Inbox.png frame 1 | P2 | muse, argon, own | yes |
| V-iphone-R2-10 | group | PH-Inbox | Toolbar: compose and chat icons | Compose (pencil square) and the prominent chat bubble look alike and are unlabeled. A first-time user cannot tell which writes mail and which talks to the agent; the common action, compose, is the quiet one. | I6, C1, H2, A2 | PH-Inbox.png frame 1 | P2 | own, muse | yes |
| V-iphone-R2-11 | component | PH-Thread, PH-GroupThread | Chat menu: Clear chat, Archive, Delete chat/group | Delete is red and Clear chat is not, yet both erase the conversation; no confirmation or undo state is drawn for either. | I3, H2 | PH-Thread.png frame 4; PH-GroupThread.png frame 2 | P2 | own, muse | yes |
| V-iphone-R2-12 | component | PH-Computer | "Can't connect" frame | The error says what failed but not why or what to try besides Retry (offline, server down, not allowed). | I3, C3 | PH-Computer.png row 2, frame 4 | P2 | own | yes |
| V-iphone-R2-13 | page | PH-Inbox | "Consent needed" frame, "Not now" | Declining leaves an Inbox with nothing to show and no frame shows where "Not now" goes. | I3, I8 | PH-Inbox.png row 3, frame 1 | P2 | own, muse | yes |
| V-iphone-R2-14 | component | PH-GroupThread | Typing row | Legal agent's purple avatar appears next to its message and again beside the typing dots, so it reads as two participants. | D5, H5 | PH-GroupThread.png left frame | P3 | muse, argon, own | yes |
| V-iphone-R2-15 | component | PH-GroupThread | Composer white circle with square | A filled white circle looks like Send; it is Stop. A label or the 1:1 thread's send/stop pairing would help. | P1, I6 | PH-GroupThread.png left frame | P3 | muse, own | yes |
| V-iphone-R2-16 | component | PH-Thread | "Draft replaced" frame | One-line banner with no way to see what changed or open the old draft. | I3, C3 | PH-Thread.png row 2, frame 1 | P3 | muse, argon | yes |
| V-iphone-R2-17 | component | PH-Computer | Agent waiting: "Skip" | "Skip" is low contrast and does not say what is skipped (the sign-in step, or the whole task). | C1, A1 | PH-Computer.png frame 3 | P3 | own | yes |
| V-iphone-R2-18 | component | PH-Computer | In control, Agent waiting, Reconnecting | The X disappears with the Team/Private switch, so the only exit is Release; this is not explained. | I6 | PH-Computer.png frames 2, 3, 6 | P3 | argon | yes |
| V-iphone-R2-19 | component | PH-Thread | Header Page and List icons | Two similar document icons without labels in the visible UI; only the accessible-names frame explains them. | I6, A2 | PH-Thread.png frame 1 | P3 | own | yes |
| V-iphone-R2-20 | page | PH-Inbox | Frames 2 to 4 vs frame 1 | The To do card and title treatment appear only in frame 1; frames 2 to 4 drop them with no state reason. | H5, L5 | PH-Inbox.png row 1 | P3 | argon, own | yes |
| V-iphone-R2-21 | component | PH-Thread | Plus menu | The attachment menu covers the draft's Edit button and the page behind is not dimmed, unlike the long-press menu. | H5, L5 | PH-Thread.png frame 2 | P3 | argon, own | yes |
| V-iphone-R2-22 | component | PH-Home | "See all" and "PERSONNEL" label | "See all" is small text with a likely sub-44 pt target; "Personnel" is jargon for a founder who calls these bots agents. | I4, C1 | PH-Home.png | P3 | own | partly (target size unmeasured) |
| V-iphone-R2-23 | page | all six | Spacing and type | Off-scale spacing (3, 5, 6, 7, 9, 10, 14, 18, 22) and about six font sizes per board. | D3, H3 | audit.json | P3 | own | yes |

## Excellent as is

- PH-Home Connected: the Finance agent "Needs you" row at the top of Activity answers "what needs me" immediately; New is the single prominent action.
- PH-Home No model: the "Connect a model" button is the one prominent action.
- PH-Thread: the draft card (Needs approval, To, body, Edit, Send) makes the approve step obvious; the empty-recipient state shows the reason in amber and disables Send.
- PH-Computer: status pills say who is driving in words plus a dot, and the bottom bar changes verb by state (Take control, Release control, I'm done, Try again, Retry).
- PH-Inbox: state coverage is thorough (archive undo, failure, inbox zero, reconnect, no account, first sync skeleton), and swipe reveals Archive nearest the thumb.
- PH-GroupThread: sender labels and avatars make a two-bot conversation readable.
