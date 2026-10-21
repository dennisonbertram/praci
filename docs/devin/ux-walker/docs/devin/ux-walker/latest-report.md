# Devin page UX walk, latest report

## Run metadata
- Date 2026-10-20. Stories STORY-001, 002, 004, 008, 010, 012, 021, 033.
- Planned steps walked on the static mockup (`docs/devin/mockup.html`, theme toggle only). Existing components walked in Storybook (apps/web). The dev server on :5273 was not used. Both servers started for this run were stopped.
- Viewport 1440x900; responsive checks at 1280x800, 1100x800, 900x800, 390x844; light theme plus one dark check (mockup toggle).
- No quick fixes were applied and no GitHub issues were filed, by request. Nothing outside `docs/devin/ux-walker` was edited.

## Findings by severity

- critical: 0
- high: 2
- medium: 18
- low: 13
- suggestion: 2

Total 35.

## Findings by category

- a11y (4): F-STORY-002-03, F-STORY-008-03, F-STORY-008-04, F-STORY-012-05
- consistency (3): F-STORY-001-01, F-STORY-012-02, F-STORY-012-03
- disclosure (3): F-STORY-002-01, F-STORY-004-05, F-STORY-012-06
- error-handling (4): F-STORY-004-01, F-STORY-008-05, F-STORY-012-07, F-STORY-021-02
- flow (6): F-STORY-001-04, F-STORY-002-02, F-STORY-010-02, F-STORY-010-03, F-STORY-021-03, F-STORY-033-05
- happy-path (3): F-STORY-001-02, F-STORY-004-02, F-STORY-010-01
- hierarchy (4): F-STORY-008-01, F-STORY-008-02, F-STORY-012-01, F-STORY-021-01
- layout (6): F-STORY-004-03, F-STORY-004-04, F-STORY-033-01, F-STORY-033-02, F-STORY-033-03, F-STORY-033-04
- visual (2): F-STORY-001-03, F-STORY-012-04

## All findings

- **F-STORY-001-01** [medium/consistency] The Devin dialog (CustomConnectionDialog first-party mode) looks different from the generic ConnectionDialog used by other API-key apps: Devin has a text hint, a visible 'API key' label, no app tile, white footer; the generic one has an app letter tile in the header, a placeholder-only field, no label and a grey footer band. Both are 'Connect <app>' dialogs a few clicks apart.
- **F-STORY-001-02** [medium/happy-path] Hint says what the key is, not where to create it. The generic ConnectionDialog already has a 'Where to find your key' help link pattern (story with-help-link-and-two-fields) but Devin's dialog has none.
- **F-STORY-001-03** [low/visual] No Devin tile story exists, so the tile could not be walked. Letter-only tiles (Brex, Demo CRM) sit next to logo tiles (Mercury, Alchemy, Coinbase), so a Devin 'D' tile will read as less official (per catalog). Observed on stand-in tiles only.
- **F-STORY-001-04** [medium/flow] Not observed (no story or mockup frame for the done view). Per catalog the done view says 'Devin connected' with 'Done' and no link to the new page, so the user lands back in the catalog.
- **F-STORY-002-01** [medium/disclosure] The Not connected frame is a title and one black button on an empty card. The real Legal not-ready page explains what is needed and shows zeroed tiles and a centered one-line explanation. The mockup version gives a first-time visitor nothing about what the page will show; the frame is also drawn without sidebar and panel, so the real page chrome is not designed for this state.
- **F-STORY-002-02** [low/flow] The dialog frame is shown with a prefilled key and enabled Connect; the empty-field state (Connect disabled) and the after-connect result on this surface are not drawn. Catalog gap on whether the dialog closes onto the page is still open.
- **F-STORY-002-03** [low/a11y] Not observed: whether the sidebar link shows a dot or label when not connected is not drawn; the dot is a span with aria-label but no role.
- **F-STORY-004-01** [medium/error-handling] The mockup has no loading, error, zero-session, or stale ('Updated' old) frames. Real Legal has stories for loading, load error ('Could not load Legal' + Try again) and empty. A slow Devin API has no designed state.
- **F-STORY-004-02** [medium/happy-path] 'ACUs this week' is Devin jargon with no definition and no window ('this week' rolling or calendar); value 41.6 has no unit or comparison.
- **F-STORY-004-03** [medium/layout] With the panel docked at 1440px, 3 titles ('Add pagination to the audit l...', 'Migrate billing webhooks to t...') and both Needs-you question subtitles are ellipsized with no title attribute or expand. The question text is the most valuable cell and is cut at about 45 characters while ACUs and From get full space. Real Legal wraps long cells instead of cutting them.
- **F-STORY-004-04** [low/layout] Geometry audit: PR cell 'acme/web#418 merged' spills 12px and 'acme/mobile#97 open' 7px past its cell, leaving 9px to 'Slack'.
- **F-STORY-004-05** [medium/disclosure] First visit shows the panel already open mid-conversation (two prior questions). The real pattern is an intro with suggestion chips (sb-pages-agent-panel-intro). First-use state and default open/closed (open question) are undecided; a fresh user would see an empty thread, not this.
- **F-STORY-008-01** [medium/hierarchy] Needs you is the only thing the user came for, yet its tile has the same style as Working, PRs open and ACUs; badge weights are all thin outlines (amber, grey, green) so the two Needs-you rows are found by position only. Squint test: the black dot in the sidebar pops more than the tile.
- **F-STORY-008-02** [medium/hierarchy] The Needs-you fact is stated four times in the 1440px frame: dot, tile (2), two badges, and again in the agent reply. Catalog says notifications repeat it too.
- **F-STORY-008-03** [medium/a11y] Measured contrast on the light page: warning text 3.48:1, success text 4.17:1 (12px badge text) against #fafaf8; both below 4.5. Destructive 4.62:1 passes. Existing 'Active' badge in Legal uses the same success token, so this is systemic.
- **F-STORY-008-04** [low/a11y] The sidebar dot is a span with aria-label and no role, so many screen readers will not announce '2 need you'. Real sidebar dot behaviour not checked in a story.
- **F-STORY-008-05** [low/error-handling] Zero state (Needs you 0, no badges, dot gone) is not drawn. Real Legal draws zero tiles (sb-legal-page--needs-consent.png).
- **F-STORY-010-01** [medium/happy-path] A needs-you row has no visible way to act. Only the title is a link; row hover underlines the title and the cursor is a pointer for the whole row, but only the title is clickable. The 'Open in Devin' wording exists only in the agent reply. A user who looks for a reply box sees only Ask, which cannot answer Devin.
- **F-STORY-010-02** [medium/flow] After answering in Devin the page gives no sign the answer landed: 'Updated 1m ago' is static, there is no refresh control, and the refresh cadence is undecided. Not observed live (frame is static).
- **F-STORY-010-03** [suggestion/flow] No cue for how long a session has waited beyond the Updated column ('12m ago' vs '1h ago'); an old Needs you looks the same as a new one.
- **F-STORY-012-01** [medium/hierarchy] The Ask button stays in the header while the panel is already open. The existing pattern (Legal) shows Ask only when the panel is closed.
- **F-STORY-012-02** [low/consistency] User bubbles are purple (bot colour) in the mockup. The real user bubble is a neutral grey (sb-chat-usertextbubble--text); the mockup even defines an unused --chat-user token. If real threads are bot-tinted this needs confirming in the shell, since only a bubble story was seen.
- **F-STORY-012-03** [low/consistency] Tool step labels 'Searched Devin sessions' and 'Read Devin messages x2' are invented; real labels come from humanizeToolName and look like 'Checked active integration' and 'Mail search'.
- **F-STORY-012-04** [low/visual] 'Open in Devin' wraps in both bullets and leaves 'Devin' alone on a line at 384px; the same link is repeated twice.
- **F-STORY-012-05** [low/a11y] Panel collapse icon is 28x28 and the sidebar icon buttons are 34x30, under 32/44px targets. Sidebar ones come from the real app; the 28px one is mockup-specific.
- **F-STORY-012-06** [suggestion/disclosure] The composer has no suggestion chip; 'What is Devin stuck on?' is the obvious one and the real intro panel pattern supports chips.
- **F-STORY-012-07** [medium/error-handling] Not observed: wording and UI when the agent cannot read question text (write-gated get_messages) is not drawn; the mockup only shows the ideal reply.
- **F-STORY-021-01** [medium/hierarchy] Toast, dot, tile and row say the same fact. Real toast structure observed (title, one-line body, age) has no action label; the whole card is presumably the target. Devin copy not rendered, so toast text could not be compared.
- **F-STORY-021-02** [low/error-handling] Not observed: toast body when the question text is unavailable and toast suppression when already on the page are undecided.
- **F-STORY-021-03** [low/flow] Dot clears on arrival even though the row still says Needs you (per catalog; not observable in static mockup).
- **F-STORY-033-01** [high/layout] The mockup is a fixed 1440x900 shell. At 1280 the panel is cut by 160px, at 1100 the panel is nearly off-screen, at 900 the table is cut after the first columns and the sidebar stays, and at 390 only the sidebar is visible while the page itself overflows to 456px. Measured: wrapper scrollWidth 1440 at every width, main column 740px always. The real shell collapses the sidebar to a drawer and overlays the panel (width 384) under 1280.
- **F-STORY-033-02** [high/layout] No narrow layout for the six-column table. The real Legal page shows what is needed: at 900 and 390 the table becomes stacked label/value blocks with the badge top right. The Devin row has two lines (title + question) and a PR link that must wrap without cutting off.
- **F-STORY-033-03** [medium/layout] At 1100 the real overlay panel (observed in the resizable side panel story) covers the right 384px, so ACUs and Updated would sit under it when Ask is clicked (derived, not rendered with Devin content). Saved width is ignored under 1280.
- **F-STORY-033-04** [low/layout] Mockup connect-dialog section is fixed 440px and pushes the page 66px wider than a 390px viewport (scrollWidth 456). Mockup artifact only.
- **F-STORY-033-05** [medium/flow] Not observed: mobile has no Devin screen and push taps carrying only /app/devin do nothing (catalog + code claim). No web surface to walk.

## UX audit summary and systemic issues

1. The mockup draws one happy path at one fixed width. It has no loading, error, zero, first-visit or narrow states (F-STORY-004-01, -05, F-STORY-033-01, -02).
2. The most important content (the question a session is waiting on) is the part that is clipped, and the row has no explicit action (F-STORY-004-03, F-STORY-010-01).
3. Needs you is repeated in four places but emphasised in none (F-STORY-008-01, -02, F-STORY-021-01).
4. Warning and success small text fail 4.5:1 contrast; this comes from shared tokens (F-STORY-008-03).
5. Mock-only inventions that differ from the real app: Ask stays visible with the panel open, purple user bubbles, invented tool labels.

## Visual consistency and flow

Geometry audit (mockup, 1440): pageOverflowX 0; two PR cells spill 7px and 12px (F-STORY-004-04); the 'wrapped controls' hits on td cells were false positives; the dashed toolbar row is mock chrome. Storybook states used (home, dialogs, legal page, sidebar, composer, toast, panel): no overflow or wrapped controls except the 16px form spill in ConnectionDialog (inside a scroll container, not visible in the screenshot, not logged).

| Story | Specified steps | Ideal | Notes |
|---|---|---|---|
| 001 | 5 | 5 | key help link missing, done view unverified |
| 002 | 4 | 3 | empty page adds a read step |
| 004 | 5 | 2 | panel steps are not needed for the goal |
| 008 | 5 | 2 | scan status column after tiles |
| 010 | 7 | 3 | no row action, no refresh |
| 012 | 7 | 3 (0 if readable) | clipped question |
| 021 | 6 | 3 | four duplicate signals |
| 033 | 7 | 7 | layout evidence only |

Duplicated information on one screen: Needs you (dot, tile, badges, reply), question text (row and reply), 'Open in Devin' per bullet.

## Mockup versus real app

- Connect dialog: matches the real CustomConnectionDialog (440px, hint, label) but differs from the generic ConnectionDialog (letter tile, placeholder-only field, grey footer, 385px). F-STORY-001-01.
- User bubble: purple in the mockup, neutral grey in the real bubble story. F-STORY-012-02.
- Tool rows: summary format 'Done · N tools · Ns' matches; step verbs are invented. F-STORY-012-03.
- Composer: pill shape matches; mockup adds a mic; real intro panel has suggestion chips, mockup none. F-STORY-012-06.
- Page header and tiles: same 4-tile layout, title 18px, Ask button; real header meta reads 'Last scan 5d ago. Scans daily.' and real Legal has tabs and Scan now; mockup adds an external-link icon. No visible mismatch in tile size.
- Table: real Legal wraps cells and becomes a stacked list at 900 and below; mockup truncates and has no narrow form. F-STORY-004-03, F-STORY-033-02.
- Sidebar dot: matches the real 8px dot; real glance also uses text values ('3', '24 mo').
- Badges: Active/Expired style matches; 'Needs you' amber and 'Error' red fill are new variants.
- Not-ready page: real Legal draws a card, zero tiles and a centered line; mockup frame is a bare header with a button. F-STORY-002-01.
- Right panel: real panel docks at 384 and overlays under 1280; mockup is fixed. F-STORY-033-01.

Screenshots for comparisons: `docs/devin/ux-walker/shared/` (mockup-*.png and sb-*.png).

## Top 5 recommendations

1. Draw narrow-width frames (1280, 1100, 900, 390) using the real overlay panel and drawer sidebar, and a stacked list layout for sessions, reusing Legal's pattern.
2. Stop clipping the question: wrap the Needs-you subtitle (two lines) or widen Session, and give each Needs-you row an explicit 'Open in Devin' action.
3. Make Needs you the one emphasised element (tile or badge) and reduce repeats on the page.
4. Draw the missing states: loading, load error with retry, zero sessions, first-visit panel (closed or intro with suggestion chips), Not connected inside the shell.
5. Fix connect-step gaps: help link for where to create the key, 'Open Devin' on the done view, one consistent connect dialog shell; darken warning and success small-text tokens.

## What could not be walked and why

- Devin tile in the catalog: no story renders it (stand-in tiles used).
- Connecting state, done view, and any call to Devin: needs the real API; not tried.
- All actions in the mockup (Ask, links, row clicks): stubs.
- Notification click, dot clearing, refresh, Electron external-link handling, mobile push and thread: not represented or not runnable here.
- Question text, 'Open in Devin' URL, ACU definition: undecided in the plan.
