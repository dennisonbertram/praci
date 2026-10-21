# Findings: inbox-and-flow

Screens: Granola mockup `#screen-inbox` (5 states); Wispr Flow mockup `#screen-settings-voice` (5), `#screen-consent` (1, plus an interaction state with Flow switched off), `#screen-call` (2), `#screen-flow-meetings` (3). 16 states x 3 viewports x 2 themes = 96 captures (viewport and full page; 192 PNGs in `shots/`, plus interaction shots). Layout and geometry audits for every capture are in `audit.json` (mockup index nav, state pills and theme toggle ignored). Second opinions: `second-opinion.json` (MUSE Wonder, Gemini 4 Argon). Phone-frame screens were not in scope.

Method notes. Every capture hid the other screens and the index nav in-page; no mockup or plan file was edited. Layout-audit dead-space hits on `.pane` or `.win` are the frame's 300 px minimum height, not product layout, and are not counted. No capture at any viewport has horizontal overflow (0 of 96). At 768 and 375 the mockup hides the sidebar (breakpoint 820), so tablet and phone navigation is not drawn; that is not judged. One early capture of a toggle caught the knob mid-transition and looked grey; a settled re-capture was correct, so it is not a finding.

Attribution: [own], [muse], [argon]. External claims were checked against the screenshots; rejected claims are listed at the end.

## Per state verdicts

| Screen / state | Verdict |
|---|---|
| Inbox, Syncing | Acceptable. Bare word "Syncing" with no progress cue (IB-6). |
| Inbox, Empty | Good. Compact, honest line, no dead explainer. |
| Inbox, With to-dos | Good and the best frame in the set. Dark checkbox and amber contrast defects (IB-4, TK-1). Ticking the last item leaves a headless card (IB-2). |
| Inbox, Consent off | Does not work for the meeting-only journey. Mail wording, no sign that follow-ups are waiting (IB-1). |
| Inbox, Mail connected | Tabs visually scope a card that ignores them (IB-9). |
| Voice, Default | Good. One added row, no new chrome. |
| Voice, Flow no key | Good. Disabled Connect, disclosure below it (SV-4). |
| Voice, Verifying | Acceptable (SV-7). |
| Voice, Connected | Fails on "which provider transcribes" (SV-1) and on emphasis (SV-5). |
| Voice, Key rejected | Acceptable. Resubmits the same key (SV-6). |
| AI data sharing | Clean list, but one state only. Off state is faint and unexplained (CS-1, CS-2). |
| Call, During a call | Same as today by decision; no listening cue (CL-2). |
| Call, Daily limit | Message is right, next step is not visible (CL-1). |
| Flow, Tile | Good. Two identical tiles, no new chrome. |
| Flow, Agent answer | Good content. No composer, small chips (FM-1, FM-2). |
| Flow, Inbox | Good. One list for both sources. Wrong sidebar highlight (XS-1). |

## Findings

Levels: component, group, screen, layout. Target: M = fix in mockup HTML, P = plan must change. "Verified" means I checked the claim against a screenshot or a measured value.

| id | level | element | problem | norm | evidence | severity | found by | verified | target |
|---|---|---|---|---|---|---|---|---|---|
| IB-1 | screen | Inbox, Consent off: card "Let Praci sort your mail" | A meeting-only user with no mail account is asked about sorting mail. The To do card disappears with no trace, so nothing says that meeting follow-ups are waiting behind the Allow button. Wording was an open plan question and the frame confirms it reads wrong. | C1 plain labels, C3 status legible | shots/1440x900-light-inbox-consent.png; compare 1440x900-light-inbox-todos.png | P1 | own, muse, argon | yes | P (consent wording for meetings) and M (show follow-ups as locked or name them in the card) |
| SV-1 | group | Voice, Connected: providers list | After Flow connects, ElevenLabs ("Speak + transcribe") and Flow ("Transcribe only") both say "Connected". Nothing says which one transcribes the next call or that speech stays on ElevenLabs. The only difference is a faint fill that means "pane shown". | I6 recognition, C3 status | shots/1440x900-dark-settings-voice-connected.png; shots/1440x900-light-settings-voice-connected.png | P1 | own, muse, argon | yes | P (the plan needs one visible "used for transcription" marker) and M |
| CL-1 | group | Call card, Daily limit reached | Red line is accurate but gives no next step. Mute stays offered though the microphone is no longer heard. No composer is drawn, so the user cannot see that typing still works. The card looks like a live call that went deaf. | I3 recovery, C3 status | shots/1440x900-light-call-cap.png, shots/1440x900-dark-call-cap.png | P1 | own, muse, argon | yes | M (draw composer, drop or disable Mute) and P (the line could end with a pointer to typing; reset time stays out per FX-45) |
| IB-9 | group | Inbox, Mail connected: tabs above To do card | Tabs "All / acme@example.com" sit above the To do card, so the card looks filtered by the tab. By plan the to-dos are identical on every tab (FX-15). A user will click the account tab expecting a different list. | D4 proximity, I1 affordance | shots/1440x900-light-inbox-mail.png | P2 | own, argon | yes | M (put the card above the tabs or inside the All view only) |
| IB-2 | component | To do card after the last item is ticked | The card stays as a bare "To do" heading in a bordered box. No empty line, no collapse. | I8 states complete, D2 | shots/1440x900-light-inbox-todos-all-ticked.png | P2 | own | yes | M |
| IB-3 | component | To do rows: tick | A tick removes the row at once with no undo and no completed place. Rows have no way to dismiss a wrong AI-extracted to-do other than saying it is done. | I3 error prevention | shots/1440x900-light-inbox-todos-two-ticked.png; hit area measured 32x32 | P2 | own | partly (undo and dismiss are absences) | P |
| IB-4 | component | To do checkboxes in dark | Unchecked boxes render as solid white squares and read as checked. Native control with accent colour and no dark colour scheme. | H5 consistency, I8 | shots/1440x900-dark-inbox-todos.png; shots/1440x900-dark-inbox-mail.png | P2 | own, muse, argon | yes | M (the real component must show an outline when empty) |
| SV-2 | component | Provider rows and pane | Selected row is `--muted` on `--card`: contrast 1.12 light, 1.09 dark. Row buttons have no aria-selected or aria-current. The right pane never names its provider, so the pane is tied to a row only by that faint fill. | A1 (3:1 for UI state), A2, I6 | shots/1440x900-dark-settings-voice-connected.png; DOM check: aria null on all 5 rows | P2 | own, muse, argon | yes | M |
| SV-3 | component | Provider rows hover | No hover fill (computed background stays transparent while hovered). | I8 states complete | in-browser check, hover on OpenAI row | P2 | own | yes | M |
| SV-4 | component | Disclosure sentence under Connect | The only statement that recordings, text near the cursor and workspace names leave Rakazo sits under the button in small muted text and disappears once connected. The user reads it after the decision point. Same text and the D3 rule (asked once, at Connect) can stay; only position changes. | I3, C3 | shots/1440x900-light-settings-voice-empty.png | P2 | own, muse, argon | yes | M (place it between field and Connect) |
| SV-5 | component | Connected pane: Replace key and Disconnect | The only emphasised control is red-outlined Disconnect. Replace key is a disabled primary. Disconnect has no confirm and no line saying what changes (transcription returns to the voice provider). | H1, H2, I3 | shots/1440x900-dark-settings-voice-connected.png | P2 | own, muse | yes | M |
| CS-1 | screen | AI data sharing with Flow off | One state only. Turning Flow off shows nothing about the effect, while Voice settings still says "Connected" for Flow. No Settings context: sidebar highlights Inbox, no back or title path. | C3, I6 | shots/1440x900-light-consent-x-wispr-off.png vs shots/1440x900-dark-settings-voice-connected.png | P2 | own, muse, argon | yes | P (state for "connected but sharing off") and M |
| CS-2 | component | Switch, off | Off track is `#e6e6e6` on white card, contrast 1.25 (dark theme 1.25). The off state is barely visible. | A1 (3:1 UI boundary) | shots/1440x900-light-consent-x-wispr-off.png | P2 | own | yes | M and token |
| TK-1 | component | Token contrast | `--warning` text 12px on white 3.64 ("Today"); `--success` text 12px on white 4.06 ("Connected" in Voice rows); white 11px letters on bot orange 3.00 (avatars). All below 4.5. | A1 | audit.json lowContrast: 1440x900-light-inbox-todos, 1440x900-light-settings-voice-default, all inbox/flow captures | P2 | own | yes (audit values recomputed) | M and tokens |
| FM-1 | screen | Flow agent answer frame | The conversation has no composer, so the next question cannot be asked. The Granola mockup defines a composer; this one does not draw it. | P1 category pattern (composer pinned) | shots/1440x900-light-flow-meetings-agent.png | P2 | own, muse, argon | yes | M |
| FM-2 | component | Citation chips | Chips are 21 px tall (below 24 px). They carry no title, although the plan says provider shows only as hover title. href is `#screen-flow-meetings`. | I4 Fitts, C4 | in-browser check: height 21.19, title "" | P2 | own | yes | M |
| IB-6 | component | Inbox, Syncing | The word "Syncing" at muted weight is the whole state. No progress cue for something that can take a minute; the app already has a shimmer for AI moments. | I2 feedback, AGENTS reuse of `components/ai/` | shots/1440x900-light-inbox-syncing.png | P3 | own | yes | M |
| IB-7 | component | "From:" prefix on every row | Three rows repeat "From:" with no new information. Plan FX-22 already allows dropping it. Rows are not tappable by decision (FX-21). | C2, D5 | shots/1440x900-light-inbox-todos.png | P3 | own, muse (not tappable) | yes | P (FX-22) |
| IB-8 | component | "Connect Gmail to ... " card | Text says Gmail, button says "Connect mail". Existing copy, one concept two names. | C1 | shots/1440x900-light-inbox-todos.png | P3 | muse | yes | existing text |
| SV-6 | component | Key rejected | Field keeps the rejected key and Connect stays enabled, so pressing it resends the same key. | I3 | shots/1440x900-light-settings-voice-rejected.png | P3 | own, muse | yes | M |
| SV-7 | component | Verifying | Disabled "Connecting..." and a disabled field, with no spinner. | I2 | shots/1440x900-light-settings-voice-verifying.png (via lg montage) | P3 | own | yes | M |
| CL-2 | component | Call card, both states | No listening, timer or microphone cue. "During a call" and "Daily limit" differ by one line, so the live state is not legible. Existing card, so may already exist. | C3 | shots/1440x900-light-call-normal.png | P3 | own, muse | yes | M |
| FM-3 | component | Bot avatars in sidebar | Wispr Flow agent and Granola agent share one orange; only the letter differs. AGENTS says bots carry the identity colour, one per bot. | H5, H4 | shots/1440x900-light-flow-meetings-agent.png | P3 | own, argon | yes | M |
| XS-1 | layout | Sidebar active row | Active row does not match the page: Flow tile and Inbox states highlight "Wispr Flow agent"; AI data sharing and Call states highlight "Inbox". | I6 | shots/1440x900-dark-flow-meetings-tile.png; shots/1440x900-light-flow-meetings-inbox.png; shots/1440x900-light-consent-x.png | P3 | own, muse, argon | yes | M |
| XS-2 | layout | Spacing scale | Observed off-scale gaps 6, 7, 9, 10, 14, 22, 26 px in most captures. | D3 | audit.json spacing.offScale | P3 | own | yes | M |

## Counts

By severity: P0 0, P1 3, P2 13, P3 9 (25 findings). By level: component 17 (TK-1 included), group 3, screen 3, layout 2. Plan-level (target includes P): 6 (IB-1, SV-1, CL-1, IB-3, IB-7, CS-1). Mockup-only: 19.

## Excellent as is

- Inbox, With to-dos: three plain-language to-dos with detail and a due word, the To do card above the Gmail prompt for a meeting-only user, and 32 px hit area around 16 px boxes (measured). Cards, spacing and type are restrained and monochrome.
- Inbox, Empty: one short line, no explainer.
- Voice, Default: Flow is one extra row with "Transcribe only", no new selector or chrome; users who never use Flow see almost nothing new.
- Voice, Rejected: red field, one line, text kept in the field; no second explanatory paragraph.
- AI data sharing: one row per recipient with a switch and a precise detail line; the existing pattern reused.
- Flow, Inbox: one To do list for both sources, no source badges.
- Both themes hold together; no horizontal overflow at 1440, 768 or 375; tab order reaches checkboxes in order and focus rings are visible.

## External claims not accepted

- [muse] Due labels "Fri" and a blank are ambiguous: rejected, readable in the screenshot and consistent with the plan.
- [muse] Mail rows lack unread state, avatars and sort labels: rejected, existing mail list, out of scope.
- [muse] "Not now" low contrast: rejected, it is a ghost button at 5.33:1.
- [muse, argon] Citation chips do not show source: rejected as a finding, by decision FX-11; only the missing title (FM-2) stands.
- [argon] Two bots in the sidebar both answering is confusing: accepted as decided (D2, FX-48), not re-litigated.
- [argon] No dark-mode selection highlight: partly true; a fill exists but is 1.09:1 (SV-2).
