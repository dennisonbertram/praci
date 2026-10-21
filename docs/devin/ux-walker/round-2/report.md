# Devin page UX walk, round 2 (mockup v3)

## Run metadata

- Date 2026-10-20. Mockup `docs/devin/mockup.html` (v3), served as a static file on a local port (not :5273). Browser session `ux-walker-devin-r2`. The server was stopped at the end.
- Stories walked: STORY-001, 002, 004, 005, 007, 008, 010, 012, 021, 033. STORY-005 and STORY-007 were added because v3 now draws their states (empty list, key rejected).
- Viewport 1440x900, light theme (one dark check). Responsive: the mockup Width switcher (1100, 900, 390) and real browser widths 1100x800, 900x800, 390x844.
- Every screenshot listed below was opened with the Read tool. Geometry audit (`geometry-audit.js`) was run at each state; results are in the Measurements section.
- The mockup is static. Links are `href="#"`, the toast and rows have no click handlers, and the panel is only built in the first frame. Planned behaviour (navigation, refetch, dot clearing, notification routing) is marked as not observable.
- No code or mockup file was edited; nothing was committed.

## Round-1 findings: status

| Status | Count |
|---|---|
| Resolved | 17 |
| Still present | 17 |
| Not applicable | 1 |
| Total | 35 |

Evidence per finding is in `docs/devin/ux-walker/round-2/findings.json` (`round1_status`). Summary:

| ID | Status | Now | Evidence |
|---|---|---|---|
| F-STORY-001-01 | still present | low | Dialog still has a hint and a visible label, no app tile, unlike the generic ConnectionDialog (round-1 text). Help link now added, so the gap is smaller; severity lowered. (docs/devin/ux-walker/round-2/STORY-001/step-1-dialog.png) |
| F-STORY-001-02 | resolved | - | Dialog now shows the link 'Where to find your key' under the field (target is '#', not observable). (docs/devin/ux-walker/round-2/STORY-001/step-1-dialog.png) |
| F-STORY-001-03 | still present | low | No Devin tile is drawn in v3; still unobservable.  |
| F-STORY-001-04 | resolved | - | Caption under the dialog frame: 'Connect closes the dialog and opens /app/devin.' This is a caption, not a drawn frame, so the landing is planned behaviour. (docs/devin/ux-walker/round-2/STORY-001/step-1-dialog.png) |
| F-STORY-002-01 | resolved | - | Not connected frame now sits inside the shell with sidebar, one line 'Connect Devin to see its sessions here.' and one primary button. (docs/devin/ux-walker/round-2/STORY-002/step-1-not-connected.png) |
| F-STORY-002-02 | still present | low | Disabled-Connect (empty field) and error states of the dialog are not drawn; only the prefilled state. The after-connect result is now covered by the caption. (docs/devin/ux-walker/round-2/STORY-001/step-1-dialog.png) |
| F-STORY-002-03 | resolved | - | Not connected frame shows the Devin sidebar link without a dot. (docs/devin/ux-walker/round-2/STORY-002/step-1-not-connected.png) |
| F-STORY-004-01 | resolved | - | Loading skeleton, empty, load error and stale frames are drawn. (docs/devin/ux-walker/round-2/STORY-004/step-2-loading.png) |
| F-STORY-004-02 | resolved | - | ACUs and PRs open tiles and the ACUs column are gone; only Needs you and Working tiles remain. (docs/devin/ux-walker/round-2/STORY-004/step-1-first-visit-closed.png) |
| F-STORY-004-03 | resolved | - | Titles wrap (no ellipsis) and the question wraps to two lines at 1440 and at every width tested. Residual clamp logged as F-STORY-004-06. (docs/devin/ux-walker/round-2/STORY-004/step-1-first-visit-closed.png) |
| F-STORY-004-04 | resolved | - | Geometry audit at 1440, 1100, 900, 390: overflowSpills is empty; PR cells no longer spill. (docs/devin/ux-walker/round-2/STORY-012/step-1-panel-open.png) |
| F-STORY-004-05 | resolved | - | 'First visit, panel closed' frame exists; the Ask button is the only entry. The closed-to-open transition is not drawn (F-STORY-012-08). (docs/devin/ux-walker/round-2/STORY-004/step-1-first-visit-closed.png) |
| F-STORY-008-01 | resolved | - | Needs you tile has an amber border and amber value, and the Needs you group is first. Squint test: tile and dot now read as the lead signal. (docs/devin/ux-walker/round-2/STORY-008/step-1-glance-first-visit.png) |
| F-STORY-008-02 | still present | low | Count is still stated by tile, dot (no number), two badges, and the agent reply in the open-panel frame. The header count and the ACUs repeat are gone, so severity lowered. (docs/devin/ux-walker/round-2/STORY-012/step-1-panel-open.png) |
| F-STORY-008-03 | still present | medium | Measured at 1440 light: warning badge text 3.48:1, success badge text 4.17:1 (12px). Unchanged tokens. Destructive 4.62:1 passes. (docs/devin/ux-walker/round-2/STORY-004/step-1-first-visit-closed.png) |
| F-STORY-008-04 | still present | low | Sidebar dot is a span with aria-label '2 need you' and role=null. (docs/devin/ux-walker/round-2/STORY-008/step-1-glance-first-visit.png) |
| F-STORY-008-05 | still present | low | Empty frame draws no tiles; 'Needs you 0' with other sessions present (dot gone, tile not emphasised) is not drawn. (docs/devin/ux-walker/round-2/STORY-005/step-1-empty.png) |
| F-STORY-010-01 | resolved | - | Each needs-you row has a visible 'Answer in Devin' link with an external-link icon; keyboard focus ring is visible. (docs/devin/ux-walker/round-2/STORY-010/step-2-keyboard-focus-answer-link.png) |
| F-STORY-010-02 | still present | medium | No refresh control or cue is drawn; the header shows 'Updated 4m ago' only on the stale frame. The refetch rule is planned behaviour and cannot be observed in the static mockup. (docs/devin/ux-walker/round-2/STORY-007/step-1-key-rejected-stale.png) |
| F-STORY-010-03 | still present | suggestion | Wait time is still only the Updated column. (docs/devin/ux-walker/round-2/STORY-004/step-1-first-visit-closed.png) |
| F-STORY-012-01 | resolved | - | Ask is hidden whenever the panel is open: 1440 open frame, and after clicking Ask at 1100, 900, 390. (docs/devin/ux-walker/round-2/STORY-012/step-1-panel-open.png) |
| F-STORY-012-02 | still present | low | User bubbles are still purple (bot colour). Not re-checked against the real bubble story this round. (docs/devin/ux-walker/round-2/STORY-012/step-1-panel-open.png) |
| F-STORY-012-03 | resolved | - | Tool rows now read 'Session search' and 'Session get messages x2' (noun first, like 'Mail search'); the invented verbs are gone. Not compared with humanizeToolName output. (docs/devin/ux-walker/round-2/STORY-012/step-1-panel-open.png) |
| F-STORY-012-04 | resolved | - | At the 384px panel, 'Open in Devin' stays on one line in both bullets (no orphan word). (docs/devin/ux-walker/round-2/STORY-012/step-1-panel-open.png) |
| F-STORY-012-05 | still present | low | Panel collapse icon measured 28x28. (docs/devin/ux-walker/round-2/STORY-012/step-1-panel-open.png) |
| F-STORY-012-06 | still present | suggestion | No suggestion chip; the first-open intro state is not drawn. (docs/devin/ux-walker/round-2/STORY-012/step-2-ask-on-first-visit-frame.png) |
| F-STORY-012-07 | still present | medium | Agent reply still shows only the ideal case; wording when question text cannot be read is not drawn. (docs/devin/ux-walker/round-2/STORY-012/step-1-panel-open.png) |
| F-STORY-021-01 | resolved | - | Toast title 'Devin has a question', body '<session title>: <question>', caption says click opens the session in Devin. Remaining duplication is logged under F-STORY-008-02. (docs/devin/ux-walker/round-2/STORY-021/step-1-toast.png) |
| F-STORY-021-02 | still present | low | Body when the question is unavailable is not drawn. (docs/devin/ux-walker/round-2/STORY-021/step-1-toast.png) |
| F-STORY-021-03 | still present | low | Dot clearing rule is not observable and still undecided in the catalog.  |
| F-STORY-033-01 | resolved | - | Width switcher: 1100 keeps sidebar and shows overlay panel (dock 384, absolute); 900 and 390 swap the sidebar for a top bar; no frame overflow (pg scrollWidth equals clientWidth). (docs/devin/ux-walker/round-2/STORY-033/switcher-900-closed.png) |
| F-STORY-033-02 | resolved | - | At 390 the table becomes a list with the badge at top right, 'Answer in Devin' inside the row, and a Pull request/Source/Updated block. (docs/devin/ux-walker/round-2/STORY-033/switcher-390-closed.png) |
| F-STORY-033-03 | still present | low | Open overlay covers Pull request, Source, Updated at 1100 and 900 (dock left edge 716 of 1100, 516 of 900). Same pattern as the real app; status and title stay visible. Severity lowered. (docs/devin/ux-walker/round-2/STORY-033/switcher-900-ask-open.png) |
| F-STORY-033-04 | still present | low | Real viewport 390: dialog stays 440px, document scrollWidth 456 (66px overflow), Connect button clipped. Mockup artifact. (docs/devin/ux-walker/round-2/STORY-001/browser-390-dialog.png) |
| F-STORY-033-05 | not applicable | - | Decision: mobile gets push only, no native screen. Residual question (push tap target) moved to catalog GAP-48.  |

## New findings (10)

| ID | Severity | Category | Description | Screenshot |
|---|---|---|---|---|
| F-STORY-001-05 | medium | disclosure | Connect dialog does not say the connection is shared with the whole space or that every member will see all org sessions; hint still says 'org-scoped' (jargon). | docs/devin/ux-walker/round-2/STORY-001/step-1-dialog.png |
| F-STORY-002-04 | low | happy-path | Ask button is drawn on Not connected, Loading, Empty and Load error frames; before connecting there is no Devin agent, and what Ask does is not drawn. | docs/devin/ux-walker/round-2/STORY-002/step-1-not-connected.png |
| F-STORY-002-05 | low | error-handling | Not connected frame does not cover a member who is not allowed to connect or replace the shared connection; no 'ask whoever connected it' state is drawn. | docs/devin/ux-walker/round-2/STORY-002/step-1-not-connected.png |
| F-STORY-007-02 | medium | error-handling | Key-rejected frame keeps the tile (2), the Needs input badges, 'Answer in Devin' links and the sidebar dot looking live. The notice says only 'Devin rejected the key.'; nothing says alerts have stopped, and a member who did not connect gets a Reconnect button with no word on who can use it. | docs/devin/ux-walker/round-2/STORY-007/step-1-key-rejected-stale.png |
| F-STORY-004-06 | low | layout | At the open-panel width (page column 740px) the second needs-you question clamps at two lines with an ellipsis ('...the older one...'). Full text only in Devin. | docs/devin/ux-walker/round-2/STORY-012/step-1-panel-open.png |
| F-STORY-010-04 | low | a11y | 'Answer in Devin' link measures 102x18px; both small. Under the 24px minimum target of WCAG 2.2. | docs/devin/ux-walker/round-2/STORY-010/step-2-keyboard-focus-answer-link.png |
| F-STORY-010-05 | suggestion | flow | Each needs-you row has two links (title and 'Answer in Devin') that presumably open the same Devin session, so two tab stops per row; row hover highlights the whole row with a pointer cursor but a click on the row outside the links does nothing. | docs/devin/ux-walker/round-2/STORY-010/step-1-needs-you-row-hover.png |
| F-STORY-021-04 | low | flow | Toast frame is drawn on the Devin page itself (needs-you rows visible behind it), although the catalog proposes suppressing it on /app/devin; the toast also covers the right part of the Working rows. | docs/devin/ux-walker/round-2/STORY-021/step-1-toast.png |
| F-STORY-033-06 | low | hierarchy | Under 1024px the sidebar dot is hidden with the sidebar and the top bar has no indicator; the top bar names the page 'Devin agent' while the page title is 'Devin'. | docs/devin/ux-walker/round-2/STORY-033/switcher-900-closed.png |
| F-STORY-008-06 | low | consistency | Three labels for one state: group and tile 'Needs you', row badge 'Needs input', toast 'Devin has a question'. | docs/devin/ux-walker/round-2/STORY-021/step-1-toast.png |

## Open findings (still present + new)

| Severity | Still present | New | Open total |
|---|---|---|---|
| critical | 0 | 0 | 0 |
| high | 0 | 0 | 0 |
| medium | 3 | 2 | 5 |
| low | 12 | 7 | 19 |
| suggestion | 2 | 1 | 3 |
| **Total** | 17 | 10 | **27** |

Medium items: F-STORY-008-03 (badge text contrast), F-STORY-010-02 (no refresh cue), F-STORY-012-07 (agent cannot-read-question wording), F-STORY-001-05 (dialog does not say the connection is shared), F-STORY-007-02 (stale page looks live, alerts-off not stated).

Round 1 had 2 high findings (F-STORY-033-01, -02); both are resolved.

## Screenshot log (one line per screenshot, all opened)

STORY-001
- `STORY-001/step-1-dialog.png`: Connect dialog, 440px, hint, label 'API key', grey link 'Where to find your key' under the field, Cancel and black Connect. No tile, nothing about sharing. LOOK pass: aligned, footer buttons sibling-sized (68 and 77px wide).
- `STORY-001/browser-390-dialog.png`: real 390 viewport; dialog is 440px wide and the Connect button is clipped at the right edge (F-STORY-033-04).

STORY-002
- `STORY-002/step-1-not-connected.png`: Not connected inside the shell: sidebar with Devin selected and no dot, title 'Devin', Ask button, centred line 'Connect Devin to see its sessions here.' and a black Connect Devin button. Ask is drawn although no agent exists (F-STORY-002-04).

STORY-004
- `STORY-004/step-1-first-visit-closed.png`: first visit with the panel closed; tiles Needs you (amber border, value 2) and Working 2; table Session, Status, Pull request, Source, Updated; Needs you rows show the question and 'Answer in Devin'. No overflow, titles wrap. Header meta shows only 'acme'.
- `STORY-004/step-2-loading.png`: skeleton for header line, two tiles and the table; no dot on the sidebar link; Ask visible.
- `STORY-004/step-3-load-error.png`: red 'Could not load Devin sessions.' with a 'Try again' button, no tiles or table; Ask visible.

STORY-005
- `STORY-005/step-1-empty.png`: 'No Devin sessions yet.' centred, no tiles, no dot; Ask visible. Gives no next step (acceptable: nothing to do until Devin has sessions).

STORY-007
- `STORY-007/step-1-key-rejected-stale.png`: header 'acme - Updated 4m ago', red 'Devin rejected the key.' with 'Reconnect', and the full table below, including live-looking Needs input badges and the sidebar dot (F-STORY-007-02).

STORY-008
- `STORY-008/step-1-glance-first-visit.png`: the glance: Needs you tile is the only emphasised element; two Needs you rows come first. Tile, group heading and two badges all state it.
- `STORY-008/dark-check-first-visit.png`: dark theme: amber tile border and text readable, badges visible, dot visible; no unreadable text.

STORY-010
- `STORY-010/step-1-needs-you-row-hover.png`: hover on the first Needs you row highlights the whole row and underlines the title; only the two links are clickable in the mockup (F-STORY-010-05).
- `STORY-010/step-2-keyboard-focus-answer-link.png`: keyboard focus on 'Answer in Devin' shows a dark ring; the link is 102x18px (F-STORY-010-04).

STORY-012
- `STORY-012/step-1-panel-open.png`: panel docked at 1440; Ask hidden, panel header with collapse icon (28x28), two Q and A turns, tool rows 'Session search', 'Session get messages x2', 'Open in Devin' on one line. Purple user bubbles. Second question clamps with an ellipsis.
- `STORY-012/step-2-ask-on-first-visit-frame.png`: after clicking Ask in the first-visit frame, the Ask button disappears and no panel appears (the panel is built only in the first frame): F-STORY-012-08.

STORY-021
- `STORY-021/step-1-toast.png`: toast 'Devin has a question', 'now', body 'Add CSV export for invoices: Should the export keep the legacy CSV column order?', close X. Drawn over the Devin page itself, covering the right part of the Working rows.
- `STORY-021/browser-390-toast-frame.png`: the toast frame at a real 390 viewport (the frame is fixed 1440px wide and scrolls horizontally; this is the mockup design, not a layout bug).

STORY-033
- `STORY-033/switcher-1100-closed.png`: 1100: sidebar kept, five-column table fits, Ask visible.
- `STORY-033/switcher-1100-ask-open.png`: overlay panel (384px) covers Pull request, Source, Updated; Ask hidden.
- `STORY-033/switcher-900-closed.png`: 900: top bar (menu icon and 'Devin agent'), no sidebar, no dot anywhere (F-STORY-033-06); table fits.
- `STORY-033/switcher-900-ask-open.png`: overlay covers the right 384px of the table.
- `STORY-033/switcher-390-closed.png`: 390: list layout, badge top right, 'Answer in Devin' inside the row, label/value block for Pull request, Source, Updated.
- `STORY-033/switcher-390-ask-open.png`: panel fills the frame with a 6px sliver of the page at the left.
- `STORY-033/browser-1100-top.png`, `browser-900-top.png`, `browser-390-top.png`: real browser widths. The frames are fixed 1440px and scroll inside a wrapper, so the browser width does not change the frame layout; only the Width switcher does. The caption row reflows. Page overflow is 0 at 1100 and 900, and 66px at 390 (the dialog frame).

## Measurements

- Geometry audit, all states, 1440: pageOverflowX 0; overflowSpills empty (round 1 had two PR-cell spills); unevenRows only hit the mockup toolbar and the dialog footer buttons (mock chrome, not product); the 'wrappedControls' hits are `td.dim.tab` time cells and are false positives (they are not controls and show on one line in the screenshots).
- Width switcher, main frame: 1100 sidebar flex, table; 900 sidebar none, top bar flex, table; 390 table none, list block; main column scrollWidth equals clientWidth at all three widths.
- Real viewport 390: document scrollWidth 456, dialog 440px wide (66px overflow).
- Contrast (light, against #fafaf8): warning text 3.48:1, success text 4.17:1, destructive 4.62:1, muted 5.00:1 (meta, help link, question text), 'Answer in Devin' 16.65:1.
- Dot: `role` null, `aria-label` '2 need you'. Sidebar links in the mockup are divs (mock chrome, not logged).
- Targets: Ask 68x32, Answer link 102x18, title link 372x21, panel collapse 28x28.

## What could not be observed

- Where any link goes (all `href="#"`), whether the toast click opens Devin, whether the dot clears, refetch behaviour, and push taps. These are planned behaviour.
- The Devin tile in the Integrations catalog and the 'Devin connected' landing (only a caption).
- Question text readability from the real Devin API.
