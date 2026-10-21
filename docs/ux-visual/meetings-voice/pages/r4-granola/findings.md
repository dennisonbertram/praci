# Granola mockup, round 4: ux-visual findings (final check)

Mockup: `docs/granola/mockup.html` at commit 5ebb74d16 (round-3 fixes), all seven screens including `#screen-mobile` (eleven Granola states and three Inbox states). Session `uxv4-granola`, capture script `cap-r4-granola.mjs` in this folder. Desktop screens: 1440x900 light and dark, 375x812 light. Mobile frames: 1440x900 light and dark. 127 state captures (viewport and full-page shot each) in `shots/`, results in `audit.json`. 768 was not captured this round (round 3 found nothing specific to it). I opened the shots for the states that changed in round 3 and for the states that carry open items; the rest were checked through `audit.json`.

Hands-on: ticked all five Inbox phone to-dos (empty line appears), switched the three account tabs on the web Inbox (each tab shows its own mail to-do plus every meeting to-do), opened the citation sheet at 375.

Second opinion skipped as instructed: no P0 or P1.

Result: no P0 or P1. Audit: no horizontal page scroll anywhere; no low-contrast text except the animated "Connecting/Syncing" shimmer (false positive, as in round 3); one real overflow (R4-2).

## Round-3 items

| id | was | status | evidence |
|---|---|---|---|
| R3-1 | P2 popover gone at 375 | fixed | 375-light-citation-open-full.png: bottom sheet inside the frame, Delete reachable (44 px) |
| R3-2 | P2 "AI data sharing off" link to a missing screen | fixed | link goes to `../wispr-flow/mockup.html#screen-consent-model`; that id is opened by the Wispr mockup's hash handler (line 505). 32 px target on web, chevron row on phone (1440-light-mobile-aioff.png) |
| R3-3 | P2 sign-in card at equal weight in every state | fixed | compact row when a route is connected, "Sign-in only" and "Both connected" states with separate Disconnect (1440-light-api-key-both.png, 375-light-api-key-both-full.png) |
| R3-4 | P3 retention sentence flush against label; agent link crowded | still-open | 1440-light-api-key-disconnected.png (sentence 18 px above the label, agent link directly under the footnote); same in the Disconnect screen |
| R3-5 | P3 phone frames start at different heights | still-open | 1440-light-mobile-disconnected.png: left phone top y=229, right y=115 |
| R3-6 | P3 scrim covers only the pane | still-open | 1440-light-citation-confirm.png |
| R3-7 | P3 inline chip widens line pitch | still-open | 1440-light-agent-inject.png (lines at y=270 and y=295) |
| R3-8 | P3 red error under empty field | fixed in the plan (TX-2: passive Reconnect, red line only after a failed Connect). The "Reconnect, key rejected" frame still draws an empty field under the red line; that is mockup drawing only | 1440-light-api-key-reconnect.png (no red), 375-light-api-key-reconnectbad-full.png |
| R3-9 | P3 sidebar dropped at 820 px and below | still-open | 375-light-api-key-both-full.png has no navigation. Mockup responsive rule only |

Round-2 carry-overs: M-7 (orphan "To do" header) fixed, 1440-light-mobile2-alldone.png shows "No follow-ups from meetings yet". M-16 (no typing state) fixed, 1440-light-mobile-typing.png shows the keyboard with the key field and Connect above it. GD-08 and GD-10 / M-2 are decided (FX-63, FX-24); not re-raised. GD-26 ("Dana Reyes, you") and GD-21 (Disconnect frames have no page header) are still visible in the shots. The other P3 carry-overs (GD-16, GD-18, GD-19, GD-22, GD-23, GD-25, GD-28, M-15, M-18, M-20) were not re-examined this round; they remain P3 polish and, for GD-19 and GD-23, are supplied by the built components.

## New findings

| id | level | element | problem | norm | evidence | severity | found by | verified | target |
|---|---|---|---|---|---|---|---|---|---|
| R4-1 | page | Product name in copy | The Inbox consent card says "Let Praci sort your mail" (copied from the shipped English strings), while the new Granola copy says "Rakazo keeps your meetings and to-dos." (ten places, plus the delete dialog "from Rakazo"). One product shows two names in one flow. | C1 (consistent terms) | 1440-light-inbox-consent.png against 1440-light-api-key-disconnected.png; `apps/web/src/locales/en/messages.po` has "Let Praci sort your mail" | P2 | own | yes | mockup copy and plan: use the shipped product name in every new string (open question whether the rename to Praci is final; whichever name wins must be used everywhere) |
| R4-2 | component | Inbox account tabs at 375 | The third tab ("founder@example.org") is cut off at the pane edge and the strip does not look scrollable. | L6 (reflow), I1 | 375-light-inbox-mail-full.png; geometry overflowSpills 37 px on `.tabs` | P3 | own | yes | mockup (let the strip scroll with a visible fade, or wrap) |
| R4-3 | component | "API key · Synced 42 meetings" at 375, Both connected | The status wraps to two lines next to the Disconnect button; "meetings" sits alone on the second line. | D4 | 375-light-api-key-both-full.png | P3 | own | yes | mockup (drop the "API key ·" prefix to a label above, or shorten) |

## Counts

New: P0 0, P1 0, P2 1, P3 2. By level: page 1, component 2. By target: mockup 2, mockup and plan 1.
Round-3 items: 3 fixed (all P2), 1 fixed in plan, 5 still-open (all P3).
All open: P0 0, P1 0, P2 1 (R4-1), P3 about 14 (R3-4, R3-5, R3-6, R3-7, R3-9, R4-2, R4-3, GD-21, GD-26 and the carry-overs listed above).

## Excellent as is

- Both connected: two routes, each with its own status and Disconnect, labelled "Sign-in" and "API key".
- The 375 citation bottom sheet keeps the meeting title, attendees, link and Delete visible and reachable.
- Phone Typing state shows the keyboard with the field and Connect above it.
- Phone "AI data sharing off" is a native chevron row that replaces the sync status.
- Inbox account tabs filter correctly: each tab shows its own mail to-do plus all meeting to-dos.
- Reconnect needed is calm: warning dot, empty field, dimmed Connect, no red until a failed attempt.
- Delete dialog names the meeting and says the Granola note is unchanged.
- No horizontal overflow at 1440 or 375 in either theme, apart from R4-2.
