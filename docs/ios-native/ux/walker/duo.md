# UX Walk: iPhone Duo and device adaptation

Walker: walk-duo. Date: 2026-10-20. Target: the planned native SwiftUI iPhone app (epic #427, phase 7 is #419).
Scope: catalog stories STORY-098 to STORY-108 (10 stories; STORY-101 was merged into STORY-064 and is not walked again).

Method: every step was judged against the board that defines it. Each cited board was viewed as a rendered screenshot, the DS-03 and DS-04 overlay sections were rendered at full size and cropped, and the geometry audit was run live once per board. The boards are static, so nothing navigates; "pass" means the expected result is drawn, "warn" means it is drawn but incomplete or in conflict with another board, "fail" means the drawn result contradicts the step, and "NO BOARD" means no board shows that screen at all. Finding IDs (F-duo-NNN) are in `duo-findings.json`.

Boards actually drawn for Duo adaptation (this matters for every story below):

| Pose | Boards that draw it |
| --- | --- |
| Outer 466x678 | Main, Sheet, all `PG-A-*` and `PG-B-*` pages |
| Inner flat 890x626 | `Split.dc.html` (Inbox only), sidebar in DS-03 section 6 |
| Half-folded 1/2 + 1/2 | `Inner.dc.html` (Inbox + Inbox agent only), DS-03 section 7 schematic |
| Laptop pose 626x890 | `Desk.dc.html` (Finance only), DS-03 section 7 schematic |

Every other page has inner, half-folded and laptop layouts only as text in the rule cards (`PG-A-Rules`, `PG-B-Rules`). This is the root cause of most findings below (F-duo-001).

## Geometry audit results (one run per board, boards at their own size)

| Board | Result |
| --- | --- |
| Main | clean. Script flagged icon+text rows and the "AB" avatar as uneven or wrapped; all are deliberate (avatar, text, time). |
| Sheet | clean. Only icon-dot versus text rows flagged (8 px unread dot beside text), deliberate. |
| Split | clean for overflow. 44 px Create button is 30 px wide (tap target, F-duo-032); sidebar page rows are 38 px tall. |
| Inner | clean. Unread dot rows flagged, deliberate. Save and Send buttons "wrapped" flag is a false positive (single-line labels). |
| Desk | clean. Bottom bar gap 8 / 279 is Back + pill, spacer, group; deliberate. |
| PG-A-Home | clean (same deliberate rows as Main). |
| PG-A-Thread | clean. |
| PG-A-InboxMessage | clean (no violations). |
| PG-A-Computer | clean. Team / Private segments are 36 px tall (F-duo-032). |
| PG-A-Image | clean. |
| PG-A-Artifacts | chip row is 456 px wide in a 390 px column: the last chip is cut off with no edge fade (F-duo-039). Not an overflow bug (row scrolls), but there is no visual cue. |
| PG-A-Artifact | clean. Older/Newer version buttons are 36 px wide (F-duo-032). |
| PG-B-NewBot, NewGroup, NewSpace, Settings | clean (no violations). |
| PG-B-Models | clean. |
| PG-B-Finance | clean. |
| DS-03-Navigation | Script hits are card rows and the capsule row. Confirmed by eye: (1) in the iPhone 393 pt sample the title capsule touches the trailing group with 0 px gap (spec says 8 pt) (F-duo-035); (2) in section 9 the States paragraph runs into the "Default" caption below it, so text overlaps (F-duo-034). |
| DS-04-Overlays | not run through the script (board is 11200 px tall); viewed by eye. The fold diagram's dashed annotation label overlaps list text (F-duo-034). |

## STORY-098: Open an agent from Home on the outer display and approve a request (#419, #417)

Walk narrative:
1. Home, tap the "Finance agent" row. Board: `Main.dc.html` / `PG-A-Home.dc.html`. PASS for the row, preview and time; the three-icon group (bell, magnifier, stacked pages) is drawn. The Finance approval itself is not drawn: the only approval card on any board belongs to the Inbox agent.
2. Read the title capsule and latest message. Board: `PG-A-Thread.dc.html`. WARN: the capsule, bottom-aligned messages and floating composer match. The board is the Inbox agent, not Finance. "Inbox agent is working" (blue dots) appears while the same card says "Needs approval" (F-duo-009).
3. Tap Allow. Board: `PG-A-Thread.dc.html`. WARN: Allow is the one ink-filled button and sits inside the card, as the Rules say. The card is titled "Send reply" with Deny / Allow, but the same draft on `Inner.dc.html` has Save / Send (F-duo-005). The resolved state after Allow is NO BOARD (F-duo-007).
Alternate (a), Home Activity: `PG-A-Home.dc.html` draws the Activity card and the bell dot; the "See all" destination and the "needs approval" row target are NO BOARD (F-duo-008).
Alternate (b), push tap: no board (see STORY-106).

Geometry: Main, PG-A-Home, PG-A-Thread clean.

Flow Log:
- Ideal 3 taps. Designed: 3 taps, no extra step. Matches.
- Hesitation: if the card is above the visible area, nothing in the strip points to it and the strip has no prominent action (F-duo-006).
- Duplicated info: working indicator and "Needs approval" shown together (F-duo-009); "Needs approval" also appears as "Approve" in the Activity row and as a card label (catalog item I1).

## STORY-099: Triage mail on the outer display, then ask the Inbox agent (#419, #418)

Walk narrative:
1. Tap the Inbox row on Home. Board: `Main.dc.html`. PASS ("Inbox", "3 need reply", "42").
2. Look at the strip. Board: `Sheet.dc.html`. WARN: strip is Back, Search mail / Filter / Compose, prominent Ask Inbox agent, which matches the Rules. But `Split.dc.html` and DS-03 section 1 draw a different set (eye, star, filter, compose) for the same page (F-duo-003, F-duo-004).
3. Tap the Ana Ruiz row. Board: `PG-A-InboxMessage.dc.html`. PASS: 22 pt subject, sender line, body, attachments, Back / Archive / Reply, prominent Ask Inbox agent.
4. Tap Ask Inbox agent. Board: `PG-A-Thread.dc.html` (Inbox agent). PASS for the destination thread. The step that moves from message to thread is a push; no transition board for it, acceptable (DS-03 section 5 covers pushes).
5. Send "Reply to Ana..." and see the draft card. Board: `Inner.dc.html` (draft card). WARN: card shows Save / Send, `PG-A-Thread.dc.html` shows Deny / Allow for the same draft (F-duo-005).
6. Tap Send. WARN: step names "Send" but the outer board says "Allow". Sent check beside the date on the message page: described in the Rules, not drawn.
Variations: Search mail overlay: DS-04 "Command and search overlay" and DS-03 section 4 draw it; Filter contents are drawn twice and disagree (menu "Sort by / Show / Select messages" in DS-04 versus "Important only / Filter / Compose / Mark all as read" in DS-03) (F-duo-003). Compose: NO BOARD (belongs to #418).

Geometry: Main, Sheet, PG-A-InboxMessage clean; Split and Inner: 4-icon strip group (F-duo-004).

Flow Log:
- Ideal 5 steps. Designed 6 including the typed request. Matches except the Send/Allow label question.
- Hesitation: step 2 has three possible "ask the agent" routes (Personnel row, Inbox prominent button, Inbox message prominent button), catalog item P1; acceptable because each page keeps exactly one.
- Duplicated info: mail row styled as separate cards in DS-03 section 1 but as divided rows in `Sheet.dc.html` and the Rules (F-duo-037).

## STORY-100: Unfold to the inner display mid-task and keep working (#419)

Walk narrative:
1. Unfold with the Chief thread open. NO BOARD. The nearest boards are `Split.dc.html` (sidebar + Inbox list, not a thread) and `Inner.dc.html` (Inbox list + Inbox agent thread, half-folded). A thread at 2/3 beside the Personnel sidebar is not drawn (F-duo-001).
2. Check the thread content. NO BOARD for flat; `Inner.dc.html` shows the same messages and draft card at half width. WARN.
3. Check the toolbar. WARN: `Split.dc.html` shows the vertical bar on the right edge and nothing in x 435 to 455. `Inner.dc.html` shows Page and List on the right edge and the fold clear. The thread's More button sits beside the composer, not in the strip, which is different from the outer board where More sits at the bottom of the strip.
4. Tap Finance agent in the sidebar. WARN: DS-03 section 5 and section 6 draw "only the right pane pushes; the sidebar keeps its selection" and the row selected state. The Personnel rows in `Split.dc.html` are not highlighted because no thread is open there.
Edge cases: draft and scroll survival, stream resume, open sheet re-centering are not drawn or decided (F-duo-002).

Geometry: Split, Inner as in the table above.

Flow Log:
- Ideal 1 action (unfold). Designed: no board for the result, so the ideal cannot be confirmed.
- Hesitation: none drawn; the risk is silent loss of the half-typed draft (F-duo-002).
- Duplicated info: the sidebar is drawn four different ways (F-duo-010), so build agents have no single source for what it contains.

## STORY-102: Hold the phone in laptop pose to watch the Team Computer and take control (#419, #420)

Walk narrative:
1. More, "Open computer". NO BOARD for the thread More menu (F-duo-028). Booting state "Booting [name]" with progress bar is text only in the Rules.
2. Fold to laptop pose. NO BOARD: only `Desk.dc.html` (Finance) draws laptop pose; Computer is rule-card text (F-duo-001).
3. Overlays over the screen. Board: `PG-A-Computer.dc.html` (outer). PASS: clear Team / Private picker top-left, "You have control" chip top-right, key bar at the bottom.
4. Handoff card with Skip / "I'm done". NO BOARD (F-duo-013).
5. Tap Take control. FAIL: the board only shows the in-control state; the watching state with prominent Take control (cursorarrow) is not drawn, and the prominent button is an unlabeled lock.open glyph (aria-label "Release") (F-duo-013).
6. Keyboard and type. WARN: Keyboard button and a key bar (Esc, Tab, Ctrl, arrows) are both drawn; the step implies Keyboard toggles the key bar, but the board shows the key bar and the Keyboard button together. A software keyboard in laptop pose would cover the bottom half (F-duo-014).
7 to 9. Team/Private picker, Fit to screen. PASS on the outer board (picker and Fit button drawn). Picker segments are 36 px tall (F-duo-032).
10 to 12. "I'm done", Release. WARN: Release is drawn; "I'm done" is not.
13. Ask in the bottom composer. NO BOARD in laptop pose (F-duo-001); `Desk.dc.html` shows a similar composer for Finance, so the pattern is clear but not drawn for Computer.
14 to 15. Unfold and refold. NO BOARD; session continuity is not decided (F-duo-002).
16. Close. PASS: X (aria-label "Close computer") on the outer board.
Edge cases (lease expiry, "Reconnecting", takeover denied): no board, already tracked under #420.

Geometry: PG-A-Computer clean (picker height noted).

Flow Log:
- Ideal 4 (open, Take control, do step, Release). Designed: 16 steps in the story; only 5 have a board in any pose.
- Hesitation: at step 5 the user must infer state from an icon; at step 6 "Keyboard" versus the always-visible key bar.
- Duplicated info: "Close" (X in strip) and the later "computer" block in the thread are the same exit; fine.

## STORY-103: Review Finance in laptop pose and ask the Finance agent about a spike (#419, #424)

Walk narrative:
1. Open Finance. Board: `Desk.dc.html`. WARN: Runway, Cash and a 6-bar "Monthly spend / Last 6 months" chart on the top half. The outer board `PG-B-Finance.dc.html` calls the chart "Monthly burn" with 12 bars and has period tabs (F-duo-016).
2. Hide amounts. PASS on the icon (eye, aria-label "Hide amounts") in the bottom bar. Mask state not drawn.
3. Tap the Sep bar. NO BOARD for bar detail. The Sep bar is the white (ink) bar; no tooltip state.
4. Type in "Message Finance agent". PASS: composer and the reply "Two annual renewals landed in the same month..." are drawn in the bottom half.
5. Back. PASS: chevron in the bottom bar.
Parity: the outer page has Accounts, Upcoming, period tabs, Refresh and a prominent Ask Finance agent; the Desk board has none of Accounts, Upcoming, period tabs or Refresh (F-duo-015). PG-B-Rules says period tabs, accounts and Ask controls live in the bottom half, which does not match the board (F-duo-015).

Geometry: Desk clean; PG-B-Finance clean.

Flow Log:
- Ideal 3 (open, hide optional, type). Designed: matches for the Ask path.
- Hesitation: no way to reach Accounts or change the period in this pose (F-duo-015).
- Duplicated info: the chart is titled and filled differently on two boards (F-duo-016).

## STORY-104: Create a new bot from the outer display and from the inner display (#419, #415)

Walk narrative:
1. Tap New on Home. Board: `Main.dc.html`. PASS for the prominent "+" (aria-label "New"). The New menu (New bot / New group / New space) is not drawn on any board; only the rule text names the items.
2. Tap New bot. Board: `PG-B-NewBot.dc.html`. WARN: large sheet with grabber, X in the strip, check as the prominent control (aria-label "Create"). Three fields: Name, Title, Description (F-duo-020). The sheet is mostly empty (F-duo-021).
3. Type a name. WARN: the disabled Create state is not drawn (F-duo-022).
4. Tap Create. WARN: "Creating" and the new bot in Personnel are not drawn.
5. Repeat on inner flat: tap "Create" (plus) in the sidebar. WARN: `Split.dc.html` shows a "+" (aria-label "Create"); the outer button is named "New" and opens a menu, the inner button's behavior is not drawn (F-duo-025). The 420 pt centered sheet is NO BOARD (F-duo-001); DS-04 "Where overlays sit on the inner display" gives the placement rule only.
6. Half-fold with the sheet open. NO BOARD.
Variations: New group: `PG-B-NewGroup.dc.html` (push, Back chevron, check). WARN: Members rows have no selection marks and the 2 to 6 rule is not shown (F-duo-022); bot avatars do not match the shipped shapes (F-duo-023). New space: `PG-B-NewSpace.dc.html`: medium sheet shown with the error line "Could not create space" already visible and an input whose accessible name is the example value (F-duo-024).
Label conflict: strip says Create (check glyph); DS-03 section 9 shows text capsules "Cancel / Done" and says not to label a discarding control "Close" (F-duo-019). Sheet inset is 8 pt in DS-04 and 6 pt in `PG-B-Rules` (F-duo-027).

Geometry: PG-B-NewBot, NewGroup, NewSpace clean.

Flow Log:
- Ideal 4 (New, New bot, name, Create). Designed: 4 on outer. Matches.
- Hesitation: the inner "+" has no drawn menu; the user cannot tell whether it creates a bot, a group or a space.
- Duplicated info: Title and Description fields ask nearly the same thing (F-duo-020).

## STORY-105: Use a short outer display and recover hidden actions from More (#419)

Walk narrative:
1. Open the Chief thread at 466x420. NO BOARD for a thread at reduced height.
2. Observe the collapsed strip. Board: DS-03 section 1 "Reduced height". WARN: only Inbox is drawn. The strip keeps Back, one eye icon and the prominent bubble, with More pinned; the menu lists "Important only, Filter, Compose, Mark all as read". The eye stays in the strip while "Mark all as read" appears in the menu, and the eye is labeled "Hide amounts" on `Split.dc.html` (F-duo-003). Collapse order for thread, Computer and Finance is not shown, nor what a collapsed prominent action looks like (F-duo-029).
3. Tap More. NO BOARD for the thread's More menu (settings, open computer, clear, archive, delete) (F-duo-028).
4. Tap "Clear conversation". NO BOARD for the confirm alert in either pose; DS-04 only shows "Archive Finance agent?" and says alert placement on the inner display is custom and unconfirmed (F-duo-026).

Geometry: DS-03 measured (iPhone sample gap, text overlap noted).

Flow Log:
- Ideal 2 (More, item). Designed: cannot be confirmed for a thread.
- Hesitation: user has to guess that Search mail is not in the collapsed menu (DS-03 reduced menu omits it).
- Duplicated info: same actions appear in the strip, in the menu and in DS-04's "Menu from a glass button" with different contents (F-duo-003).

## STORY-106: Tap a push notification while the phone is folded or unfolded (#419, #422)

Walk narrative:
1. Banner arrives. Mostly OS-drawn. The foreground in-app banner is drawn in DS-04 "Toast and notification banner" (agent finished, "Tap opens the chat"); the story and catalog say there is no board for it. WARN: the toast uses a teal circle with the letter "F" for Finance agent, but Finance is the orange wedge (F-duo-023).
2. Tap the banner (switch space first). NO BOARD for the space switch. Home and the strip show no space name anywhere, so after switching the user cannot see which space they are in (F-duo-031).
3. Observe the outer display. PASS by reference: `PG-A-Thread.dc.html` is the landing screen.
4. Fold and unfold. NO BOARD (F-duo-001, F-duo-002).
Edge: Live Activity, share extension, notification settings are NO BOARD (tracked under #422, #425).

Geometry: DS-04 not run (viewed by eye).

Flow Log:
- Ideal 1 (tap). Designed: 1 tap, but the landing space is not visible.
- Hesitation: none until the user wonders which space they are in.
- Duplicated info: pending approval appears as push text, Activity row and card (catalog I1).

## STORY-107: Open Settings on the inner display and change the default model (#419, #421)

Walk narrative:
1. Tap the profile row at the sidebar bottom. FAIL: `Split.dc.html` has no profile row (the sidebar ends with "Connect apps"); DS-03 section 6 draws "Alex Morgan" at the bottom (F-duo-011). The outer Home uses an "AB" avatar (aria-label "Account") (F-duo-033).
2. Settings sheet with list 1/3 and detail 2/3. NO BOARD (nested split in a sheet, F-duo-001). `PG-B-Settings.dc.html` draws the outer list: profile row ("Sam Rivera"), Models, Voice, Integrations, AI data sharing, Archived bots, Change password, X (aria-label "Done").
3. Tap Models. PASS on the outer board `PG-B-Models.dc.html`.
4. Choose Model A. WARN: the Default model picker menu is not drawn; the green "Now using Model A." sits directly under a row already saying "Model A".
5. Find models. PASS: row and "Found 3 models." drawn. Spinner, unreachable and no-match states not drawn.
6. Tap Done. WARN: on Models the strip has only Back; Done exists only on the Settings root.
Details for Account, AI data sharing, Archived bots, Change password: NO BOARD.

Geometry: PG-B-Settings, PG-B-Models clean.

Flow Log:
- Ideal 4 (profile, Models, Default model, pick). Designed: first tap has no target on the inner board.
- Hesitation: the confirmation line repeats the row value (low).
- Duplicated info: profile name differs between boards (F-duo-033).

## STORY-108: Open an artifact image and share it, across display modes (#419, #420)

Walk narrative:
1. Tap Artifacts on Home. Board: `PG-A-Home.dc.html`. WARN: Artifacts is the third unlabeled icon of a three-icon group (F-duo-038). List board `PG-A-Artifacts.dc.html`: title, chips, divided rows, image rows with an image tile. PASS. Chip row cut off at the right with no cue (F-duo-039).
2. Tap the image row. Board: `PG-A-Image.dc.html`. PASS: Close, Share, Save to Photos, More, name pill under a dim; contrast measured about 5.7 to 1.
3. Tap Share. PASS: icon drawn; the system share sheet is OS.
Variations: `PG-A-Artifact.dc.html` for documents: Share and Versions in a plain group, no prominent action although the Rules call Share prominent (F-duo-017); the title appears twice (F-duo-018). Inner, half-folded and laptop layouts for Artifacts and Image: NO BOARD (F-duo-001).

Geometry: PG-A-Artifacts (chip row), PG-A-Artifact (36 px version arrows), PG-A-Image clean.

Flow Log:
- Ideal 3 (Artifacts, row, Share). Designed: 3. Matches.
- Hesitation: finding the Artifacts icon.
- Duplicated info: artifact title in capsule and card heading (F-duo-018).

## Cross-story summary

- Only three Duo layouts are drawn beyond the outer display (Inbox inner, Inbox half-fold, Finance laptop). Nine stories depend on layouts that are only prose.
- The Inbox strip is defined five different ways across Sheet, Split, DS-03, DS-04 and the Rules (F-duo-003).
- The inner sidebar is defined four different ways (F-duo-010).
- Posture-change behavior is undecided and affects drafts, scroll, streams and the Computer session (F-duo-002).
