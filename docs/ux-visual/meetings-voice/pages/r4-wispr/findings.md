# ux-visual round 4: Wispr Flow mockup and Granola Inbox

Session uxv4-wispr. Capture script: `capture-r4-wispr.mjs` (this folder). Second opinion skipped: no P0 or P1.

**Captured:** 138 states x viewports x themes (276 PNGs: viewport and full page). Desktop screens at 1440x900, 768x1024 and 375x812; phone frame at 1440x900; light and dark. Screens: Voice (6 states), AI data sharing (3, including `#screen-consent-model`), Voice call (2), Flow tile/agent/meetings (5), Mobile (6), Granola Inbox (5). Audits are in `audit.json`; `capture.log` records horizontal page overflow (none in any capture).

**Opened with Read:** the 1440 light set for each screen and the states tied to open items (consent-model, aioff, rejected, connected, cap, cite, agent, inbox, mail), plus 375 cite, confirm, aioff, consent-model and inbox mail, and the dark phone Connected state. The other captures were checked through the audits and `capture.log`, not opened one by one.

## Round-3 items

| id | status | evidence |
|---|---|---|
| R3-1 citation clipped at 375 | fixed | `375x812-light-flow-meetings-cite.png`: bottom sheet inside the window, Delete reachable |
| R3-2 Escape / outside click, title and date | fixed | Escape and a click outside both hide the popover (checked live); popover shows "Security sync, 14 Oct" and participants |
| R3-3 composer jump | fixed | composer sits at y=410 in both Agent answer and Citation |
| R3-4 checkmark vs "Transcribing" | obsolete (decided RX-59) | not re-raised |
| R3-5 key pane header, selection cue | fixed | phone key group has a "Wispr Flow" header and an "API key" placeholder |
| R3-6 key card 50 px away at 375 | fixed | `375x812-light-settings-voice-aioff.png`: card stacked under the list, 8 px gap |
| R3-7 account tabs inert | fixed | the three tabs switch the mail to-dos (checked live) |
| R3-8 pane never names provider | fixed | pane header "Wispr Flow" in every state |
| CS-1 consent off, no change in Voice | fixed | `...settings-voice-aioff.png`: row reads "AI data sharing off" (contrast 5.16 light, 7.33 dark) and links to the setting; phone row has a chevron |
| M-17 "API key" only label | fixed | follows R3-8 and TX-16 |
| IB-3, SV-4, M-11, SV-3, CL-2, XS-2 | obsolete (decided/rejected in fix-list-round-3) | not re-raised |
| M-16 no typing state on the Wispr phone | still-open, P3 | TX-13 covered only the Granola phone; Wispr phone has no Typing pill |
| SV-5 Replace key permanently disabled | still-open, P3 | `Replace key` has `disabled=true` and never enables when text is entered in the mockup |
| M-15 phone back not keyboard reachable | still-open, P3 | Back is a SPAN with tabindex -1 |
| IB-8 "Connect Gmail" copy | still-open, P3 | unchanged existing copy, `1440x900-light-flow-meetings-inbox.png` |

## New findings

| id | level | element | problem | norm | evidence | severity | found by | verified | target |
|---|---|---|---|---|---|---|---|---|---|
| R4-1 | component | Granola Inbox, Mail connected / consent off, account tabs at 375 | The third tab ("founder@example.org") is cut by the window edge with no scroll cue (spill 21-37 px in the geometry audit) | content must not be clipped without an affordance | `375x812-light-inbox-mail.png`, audit key `375x812-light-inbox-mail` | P3 | own | yes | Granola mockup |

## Screen verdicts

- **Voice (all 6 states):** pass. Pane header, consent link and rejected line are clear.
- **AI data sharing, including Anthropic off:** pass. The `#screen-consent-model` hash opens the Anthropic-off state; the three switches read clearly.
- **Voice call, cap:** pass. The composer is outside the call card.
- **Flow tile/agent/cite/delete/inbox:** pass at 1440, 768 and 375.
- **Mobile (6 states):** pass; only M-16 and M-15 remain.
- **Granola Inbox:** pass except R4-1.

## Excellent as is

- Citation sheet at 375: in-window, readable, Delete reachable.
- Flow row "AI data sharing off" on web and phone: one status, one link.
- Single list of to-dos from meetings and mail; tabs that switch.
- Phone frame: native back, grouped rows, success colour consistent with web.
- Light and dark themes are consistent across all captures.

## Counts

No P0, P1 or P2. New: 1 P3 (mockup). Still open: 4 P3.
