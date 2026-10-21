# Granola mockup, round 3: ux-visual findings

Mockup: `docs/granola/mockup.html`, all seven screens, including `#screen-mobile` (nine key states and three Inbox states). Session `uxv3-granola`. Desktop screens (1 to 6) were captured at 1440x900, 768x1024 and 375x812, light and dark. Mobile frames were captured at 1440x900, light and dark. That is 198 state captures with a viewport shot and a full-page shot each, stored in `shots/` as `{viewport}-{theme}-{screen}-{state}.png`. `audit.json` holds the layout-audit and geometry-audit result for every capture (the mockup's index nav was hidden; its state pills and theme toggle were ignored). I opened the shots for every state at 1440 light, the dark and 375 or 768 shots that differ, and every mobile state. I did not open every one of the 198 pairs; the rest were checked through `audit.json` numbers (no horizontal scroll anywhere, no low-contrast text other than a false positive on the animated "Connecting" text).

Hands-on checks at 1440 light: Tab order on the key card (back link, Sign in, key link, field; the disabled Connect is skipped), a 224-character paste into the key field (Connect enables, field scrolls its own content, no layout change), Enter in the field (nothing happens), hover on Disconnect, Escape and outside click on the citation popover and the delete dialog, typing into the mobile key field (Connect enables), ticking every mobile to-do.

Second-opinion step skipped as instructed: there is no P0 or P1.

Result: no P0 or P1. All round-2 P1 findings (GD-01 to GD-05, M-1, M-4) are fixed. 8 P2 and 18 P3 remain open, 9 of them new this round.

## Round-2 findings

Status: fixed, still-open, obsolete. "n/a" means a Wispr Flow finding that this inspector does not cover.

### Granola desktop (GD)

| id | was | status | evidence |
|---|---|---|---|
| GD-01 | P1 After card said the wrong fact | fixed | 1440-light-disconnect-after-full.png: the card now says "Rakazo keeps your meetings and to-dos." and keeps the agent link |
| GD-02 | P1 Delete dialog did not name the meeting | fixed | 1440-light-citation-confirm.png: names "Pricing review" and says the Granola note is not changed |
| GD-03 | P1 Popover 411 px from its chip | fixed at 1440 and 768 | popover x=849.9, chip x=851.9. It breaks at 375, see R3-1 |
| GD-04 | P1 No MCP route on the detail page | fixed | "Sign in with Granola" is drawn above the key card; new "Sign-in only" state (1440-light-api-key-mcp.png) |
| GD-05 | P1 Tile unchanged when the key is revoked | fixed | 1440-light-integrations-reconnect.png: tile reads "Reconnect needed" with the warning color |
| GD-06 | P2 Green "Synced" over a rejected key | fixed | 1440-light-api-key-reconnect.png: warning dot, "Reconnect needed" |
| GD-07 | P2 No key link in Reconnect | fixed | same shot: link is present |
| GD-08 | P2 Red outline Disconnect is the loudest control | still-open | 1440-light-api-key-connected.png; now on six states including Sign-in only |
| GD-09 | P2 Agent in sidebar before any route connects | fixed | sidebar has no agent in Empty, Entering, Connecting, Offline, Rejected, Agent removed |
| GD-10 | P2 "· Business plan" fragment reads as a name | still-open | 1440-light-api-key-empty.png. The plan keeps it on purpose (FX-24), so it is a plan-level choice |
| GD-11 | P2 Key link wraps at 375 | fixed | 375-light-api-key-reconnect-full.png: link sits alone under the label on one line. The geometry audit still flags it (the link has a 32 px minimum height); the picture shows no wrap |
| GD-12 | P2 Field border 1.25:1 | fixed in the mockup | `--field` is #8a8a8a light and #7a7a7a dark. The shared token is unchanged (D-1 in the HTML comment) |
| GD-13 | P2 "From:" prefix | fixed | 1440-light-inbox-todos.png |
| GD-14 | P2 Citation chip hard to tell from tool chips, 21 px | fixed | 32 px filled pill; audit reports no small target for `.cite` |
| GD-15 | P2 Agent silent about stale data after Disconnect | fixed in the plan | `docs/plans/granola.md` Reading section: the skill adds "last synced" after Disconnect. The chat frame draws no such line, which is acceptable because the plan owns it |
| GD-16 | P3 Not-connected tile under "Connected apps", no click cue | still-open | 1440-light-integrations-new.png |
| GD-17 | P3 Connect button grows when Connecting | fixed | both states are 112 px wide |
| GD-18 | P3 Red outline buttons have no hover fill | still-open | computed background is rgba(0,0,0,0) while hovering Disconnect |
| GD-19 | P3 Escape and outside click do not close the popover or dialog | still-open | manual: popover hidden=false after Escape and after outside click; dialog hidden=false after Escape. Base UI supplies this when built, so this is a note for the story |
| GD-20 | P3 Bot avatar 3.0:1 | fixed | audit reports no low-contrast avatar |
| GD-21 | P3 Disconnect frames lack page header | still-open | 1440-light-disconnect-before.png |
| GD-22 | P3 Enter does nothing; disabled Connect looks like secondary | still-open | Enter left the state unchanged. Paste now enables Connect, which is correct |
| GD-23 | P3 Off-scale spacing | still-open | offScale values seen: 5, 6, 7, 9, 10, 11, 14, 18, 22, 26, 30 |
| GD-24 | P3 Dark checkbox looks checked | fixed | 1440-dark-inbox-todos.png |
| GD-25 | P3 Composer under the message, not pinned | still-open | 1440-light-agent-answer.png (short frame) |
| GD-26 | P3 "Dana Reyes, you" | still-open | 1440-light-citation-open.png |
| GD-27 | P3 "Synced 42 meetings" gives no sense of completeness | obsolete | the plan chose this on purpose (FX-27); noted only |
| GD-28 | P3 Agent link position differs | still-open | now under the status row when connected, but under the consent footnote in Reconnect and Disconnected (see R3-4) |

### Mobile (M), Granola rows

| id | was | status | evidence |
|---|---|---|---|
| M-1 | P1 "Business plan" hint lost on rejection | fixed | 1440-light-mobile-key-rejected-full.png |
| M-2 | P2 "Business plan" fragment | still-open | same shot; plan keeps it |
| M-3 | P2 Secondary text contrast | fixed | audit reports no low-contrast text in any mobile frame |
| M-4 | P1 Healthy status above a stale error | fixed | 1440-light-mobile-key-reconnect-full.png: one group, warning dot |
| M-5 | P2 "From:" prefix | fixed | 1440-light-mobile-key-empty.png (Inbox phone) |
| M-6 | P2 Tap anywhere on the row completes it | fixed | only the 44 pt checkbox target acts |
| M-7 | P2 Orphan "To do" header after the last tick | still-open | 1440-light-mobile-inbox-alldone-full.png: header with no rows and no empty line; the desktop card shows "No follow-ups from meetings yet", mobile does not |
| M-8 | P2 No spinner while Connecting or Syncing | fixed | 1440-light-mobile-key-connecting.png, -syncing.png |
| M-12 | P2 Not the real SettingsGroup | fixed | title-case 13 pt header, rows at least 52 pt, full-width Connect |
| M-13 | P2 Group position not drawn | fixed in the plan | plan says the row is visible without searching; the frame draws it under Slack |
| M-14 | P3 Connect enabled with an unchanged rejected key | fixed | dimmed until the key is edited |
| M-15 | P3 Back button | still-open | now 44 pt, but it is a `span role=button` with no tabindex, so it cannot be focused |
| M-16 | P2 No typing state | still-open | no frame shows the keyboard over the key field and Connect; Connect sits at the bottom of the form |
| M-17 | P3 Placeholder as only label | obsolete | marked "none" in round 2 |
| M-18 | P3 Slack row has no chevron | still-open | 1440-light-mobile-key-empty.png |
| M-20 | P3 "2 more" has no cue | still-open | 1440-light-mobile-inbox-todos |
| M-9, M-10, M-11, M-19 | Wispr | n/a | covered by the Wispr inspector |

Round-2 totals: GD 16 fixed, 11 still-open, 1 obsolete. M (Granola) 9 fixed, 6 still-open, 1 obsolete.

## Verdicts per state

| Screen / state | Verdict |
|---|---|
| 1 Not connected | Clear. The tile does not look clickable (GD-16). |
| 1 Detail page | Two cards: bare sign-in button, then key card. Complete, but the two routes are not related to each other (R3-3). |
| 1 Sign-in only | Tile "Connected", agent in sidebar. Good. |
| 1 Key connected | Tile "Synced 42 meetings". Good. |
| 1 Reconnect needed | Strong. Warning badge on the tile. |
| 2 Empty, Entering, Connecting | Good. Connect enables on paste (224 characters), button width stays 112 px, field keeps its value. |
| 2 Offline | Good. One plain line, Connect stays active. |
| 2 Syncing, Connected, Agent removed | Good. Disconnect is the loudest control (GD-08). |
| 2 Key rejected | Good. Border and words, link present. |
| 2 Reconnect needed | Fixed. Red error under an empty field reads slightly odd (R3-8). Agent link crowded under the footnote (R3-4). |
| 2 Disconnected | Retention sentence is present. It sits flush against the label (R3-4). |
| 2 AI data sharing off | The status is a link to a screen that is not drawn (R3-2). |
| 2 Sign-in only | Good. |
| 3 Pricing question, Vendor call | Good. The 32 px chip stretches one line (R3-7). |
| 4 Syncing, Empty, With to-dos, Mail connected, Mail consent off | Good. Dark checkbox fixed. |
| 5 Closed, Open | Popover now sits under its chip at 1440 and 768. At 375 it is gone (R3-1). |
| 5 Delete | Names the meeting and the Granola note. Scrim covers only the pane (R3-6). |
| 6 Before, After | After draws all three surfaces and says the data is kept. Frames lack headers (GD-21). |
| 7 Mobile Granola group | All nine states are clean and native-looking. No typing state (M-16). |
| 7 Mobile Inbox | Syncing and Empty good; after the last tick the header is orphaned (M-7). |

## New findings

Level is component, group, page or layout. Target says where the fix lives: mockup (fix in HTML) or plan. All were verified against a screenshot or a measurement.

| id | level | element | problem | norm | evidence | severity | found by | verified | target |
|---|---|---|---|---|---|---|---|---|---|
| R3-1 | page | Citation popover at 375 | At 560 px and below `.anchor` becomes `position:static`, so the popover's `top:100%` resolves against the pane and lands under it. The frame's `overflow:hidden` clips it: the "Open" state shows no popover and Delete cannot be reached. | L6 (reflow), I1 | 375-light-citation-open-full.png; popover y=416 against pane bottom 410 | P2 | own | yes | mockup |
| R3-2 | component | Status link "AI data sharing off" | The status line is an underlined link whose text names a state, not an action, and it points at `#screen-consent`, which does not exist in the mockup. Target is 111x16 px. A user cannot tell what a click does. | C1, I1, A3 | 1440-light-api-key-aioff.png; audit smallTargets 111x16; `href="#screen-consent"` | P2 | own | yes | mockup (draw or name the destination, 24 px target) |
| R3-3 | group | "Sign in with Granola" card | The sign-in button sits above the key card in every state, including Syncing, Connected and Reconnect needed, at equal weight and with no "or". A user whose key works is still offered to sign in. A first-time user is not told which route to use. No connecting or failure state for sign-in is drawn. | H1, C2, I2 | 1440-light-api-key-connected.png, 1440-light-api-key-empty.png | P2 | own | yes | plan (RX-40: hide or demote the other route once one is connected) |
| R3-4 | group | Disconnected and Reconnect key cards | The sentence "Rakazo keeps your meetings and to-dos." is flush against the field label (18 px apart) so it reads as part of the label. The agent link sits 25 px under the consent footnote with no separation. | D4 | 1440-light-api-key-disconnected.png, 1440-light-api-key-reconnect.png | P3 | own | yes | mockup |
| R3-5 | layout | Mobile phone frames | The left phone's nine pills wrap to three rows, so it starts 76 px lower than the right phone (191 against 115) and is cut off at 900 px high. | L4, L1 | 1440-light-mobile-key-empty.png; geometry unevenRows heights 898 against 822 | P3 | own | yes | mockup |
| R3-6 | component | Delete dialog scrim | The scrim covers only the pane; the sidebar stays undimmed, so the dialog reads as non-modal. | I7 | 1440-light-citation-confirm.png | P3 | own | yes | mockup |
| R3-7 | component | Inline citation chip | A 32 px chip inside a text line widens that line's pitch from 19 to 25 px, so the paragraph has uneven leading. | H6, D4 | 1440-light-agent-inject.png (text lines at y=270 and y=295) | P3 | own | yes | mockup (vertical-align, or negative margin) |
| R3-8 | component | "Granola rejected this key" in Reconnect needed | The error sits under an empty, red-bordered field before the user typed anything, so it reads as if the empty field was rejected. | C1, I3 | 1440-light-api-key-reconnect.png | P3 | own | yes | plan (wording of the reconnect line) |
| R3-9 | layout | Desktop frames at 820 px and below | The sidebar is dropped entirely at 768 and 375; no navigation replaces it, so the Granola agent and the Integrations page are not reachable in those frames. | L7 | 768-light-inbox-mail-full.png; 375-light-api-key-reconnect-full.png | P3 | own | yes | mockup (note, or draw the narrow nav) |

## Counts

New this round: P0 0, P1 0, P2 3, P3 6 (9 total). By level: page 1, component 4, group 2, layout 2. By target: mockup 7, plan 2 (R3-3, R3-8).

All open items (round-2 still-open plus new): P0 0, P1 0, P2 8 (GD-08, GD-10, M-2, M-7, M-16, R3-1, R3-2, R3-3), P3 18.

Audit notes: no horizontal scroll at any viewport or theme (pageScrollX 0 in all 198 captures). The only contrast failure reported is the animated "Connecting" and "Syncing" text (ratio 1.17). That is a false positive: the text is a transparent clip over a moving gradient and reads clearly in 1440-dark-api-key-verifying.png. The geometry audit flags the key link and citation chip as "wrapped controls"; the screenshots show single lines, caused by their 32 px minimum height.

## Excellent as is

- Reconnect needed is now consistent on the tile, the desktop card and the phone: one warning dot, the same words, one group.
- Disconnect After shows the consequence on three surfaces (card, chat, Inbox) and the card now states what is kept.
- The delete confirmation names the meeting, the cascade and the untouched Granola note.
- The citation popover opens directly under its chip at 1440 and 768, with attendees, a link and Delete only.
- The key card in every state is two or three lines with one primary action, and Connect enables on paste.
- Tab order on the key card is back, sign-in, key link, field; disabled Connect is skipped.
- The mobile Granola group follows the native grouped-list pattern with spinner rows, a dimmed Connect that enables on typing, a red Disconnect row, and nine clear states.
- The dark theme keeps the same structure and fixes the checkbox that earlier looked checked.
- No horizontal overflow at 375, 768 or 1440 in either theme.
