# Fix list, round 3: Granola and Wispr Flow

Sources:
- ux-visual round 3: `docs/ux-visual/meetings-voice/pages/r3-granola/findings.md` and `pages/r3-wispr/findings.md`
- ux-walker round 3: `docs/ux-walker/meetings-voice/round-3/`
- ux-flow round 3: `docs/ux-flow/meetings-voice/round-3/report.md`

Round 3 found no P0 or P1 findings and no high-severity walker findings. Rejected rows from earlier rounds stay rejected.

## Plan rows

| id | source | target | change | stories |
|---|---|---|---|---|
| TX-1 | visual r3-granola R3-3, walker F3-GS-3-01, flow R3-4 | granola plan S6 Surfaces (#442) | The MCP sign-in card is the main block only while no route is connected. Once either route is connected, the sign-in card becomes one compact row with its own status and its own Disconnect, still above the key card. When both routes are connected, each card disconnects only its own route, and the row labels say which route that is. | GS-1, GS-3, GS-4 |
| TX-2 | flow R3-2 | granola plan S6 `needs_reconnect` (#442) | "Reconnect needed" is the passive state. The red "Granola rejected this key" line shows only after a failed Connect attempt. | GS-5, MB-2 |
| TX-3 | flow R3-1 | granola plan S6 consent-missing bullet (#442) | "AI data sharing off" replaces the "Synced" status line on web and on the phone. The two never show together. | GS-1, IF-5 |
| TX-4 | visual r3-wispr CS-1 | wispr plan S3a (#447) | If consent for the Flow recipient is turned off, the Flow row status reads "AI data sharing off" and links to the setting, mirroring Granola. Transcription falls back to the voice provider until consent returns. | WF-6, MB-5 |
| TX-5 | flow R3-3 | wispr plan S3a daily cap (#447) | The call card has no input today (`CallCard.tsx`). Reword the cap text to: "the thread composer stays available below the call card". | WF-7, MB-6 |
| TX-6 | walker F3-IF-5-01 | granola plan S5 (#441) | After "Not now" on the mail consent prompt, the Inbox behaves as it does today, and meeting to-dos already stored stay visible. Say so in the plan. | IF-5 |

## Mockup rows

| id | source | target | change |
|---|---|---|---|
| TX-7 | visual R3-1 (both), walker F3-GS-7-01, F3-MX-5-01 | both mockups, citation popover | At widths of 560 px and below, open the popover as a bottom sheet inside the window, so it is visible and Delete can be reached at 375. |
| TX-8 | visual r3-wispr R3-2, R3-3 | wispr mockup, citation | Escape and clicking outside close the popover. Show the meeting title and date. Remove the 70 px spacer so the layout does not jump. Apply the same close behaviour to the Granola popover. |
| TX-9 | visual r3-granola R3-2 | granola mockup | Draw "AI data sharing off" as a status line (TX-3) whose link opens `../wispr-flow/mockup.html#screen-consent`, the AI data sharing screen. The link target is at least 32 px (44 pt on the phone). |
| TX-10 | TX-1 | granola mockup, screens 1 and 2 | Draw the compact sign-in row for every connected state, and add a "Both connected" state. |
| TX-11 | TX-2, TX-3 | granola mockup, web and phone | Reconnect needed is passive, with no red line until a failed Connect. The phone "AI data sharing off" row replaces the "Synced" row. |
| TX-12 | visual M-7 | granola mockup, phone Inbox | After the last tick, show "No follow-ups from meetings yet" under the To do header, matching web. |
| TX-13 | visual M-16 | granola mockup, phone | Add a Typing state that shows the keyboard, with the list scrolled so the key field and Connect stay visible above it. |
| TX-14 | walker F3-MX-1-01 | granola mockup | Give Granola citation chips `title="Granola"`. |
| TX-15 | walker F3-IF-2-01, visual R3-7 | granola mockup, Inbox "Mail connected" | Draw two account tabs. Each tab shows its own mail to-do plus all meeting to-dos, and the tabs switch. |
| TX-16 | visual R3-5, R3-8, walker F3-MB-5-1 | wispr mockup, web pane and phone | The key pane gets the header "Wispr Flow". On the phone, the key group gets a "Wispr Flow" header, so Disconnect clearly belongs to Flow. |
| TX-17 | walker F3-MB-1-1 | granola mockup, phone | The empty SecureField shows the placeholder "API key". "Rakazo keeps your meetings and to-dos." becomes the group's first row (F3-MB-1-2). |
| TX-18 | walker F3-MB-5-2, flow note | wispr mockup, phone | "Transcribing" uses the same success color as on web. Add Fish Audio to the phone provider list. |
| TX-19 | visual R3-6 | wispr mockup, Voice at 375 | Stack the list and the key card with an 8 px gap, so the card stays next to its row. |
| TX-20 | TX-4, TX-5 | wispr mockup | Draw the Flow row with "AI data sharing off". Remove the composer drawn inside the cap frame. Note that the thread composer is below the card. |

## Rejected or kept as decided

- **IB-3, undo for a tick, and dismissing a wrong to-do:** rejected again (RX-14). A tick is reversible through the agent, and a dismiss control adds surface.
- **SV-4, putting the consent sentence above Connect:** rejected (RX-32).
- **GD-08, a quieter Disconnect:** rejected (FX-63).
- **M-11, one error line for both causes:** decided (D3).
- **R3-4, the reading of the phone checkmark:** decided (RX-59).
- **Bulk delete, an MCP-only to-do notice, an "all meetings" hint and identical tile subtitles:** rejected in round 2.
- **XS-2, spacing values off the scale, and SV-3, row hover:** mockup polish that the built components supply.
- **CL-2, a listening cue:** existing call UI, out of scope.
