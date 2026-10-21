# UX Flow Critique, round 4: Devin page (mockup v5), 2026-10-20

Scope: the eight journeys scored in `docs/devin/ux-flow/round-3.md`, re-scored on `docs/devin/mockup.html` (v5). Decisions in force: read-only; one shared Devin connection per space (space owners connect and reconnect, members see a notice without buttons); the needs-you notification goes to whoever connected and opens the Devin session; mobile gets push only; the agent has read tools only and questions are shown on the page only; the sidebar shows a count; the page header is the title only; Error rows count in Needs you. Shared colour tokens (V10) and the deferred list in `docs/devin/ux-visual/problems.md` are not re-raised.

Evidence labels. **Drawn** means I saw it in v5 in a browser (screenshots and audits under `docs/devin/ux-walker/round-4/`). **Planned** means only a caption, a stub link or a decision supports it and a static mockup cannot show it (clicks to real Devin, refetch, notification delivery). Planned items are not counted as findings.

## Friction scorecard

| Journey | Round 3 (actual/ideal) | Round 4 (actual/ideal) | Needless decisions (R3 to R4) | Dead ends (R3 to R4) | Duplicated information | Verdict (R3 to R4) |
|---|---|---|---|---|---|---|
| STORY-001 Connect from the Integrations tile | 4/4 (last step planned) | 4/4 (last step planned) | 0 to 0 | 0 to 0 | none | minimal to minimal |
| STORY-004 First load after connecting | 2/2 | 2/2 | 0 to 0 | 0 to 0 | none | minimal to minimal |
| STORY-008 Glance: what needs me | 2/2 | 1/1 on any page (sidebar count), 2/2 on the page | 0 to 0 | 0 (zero state undrawn) to 0 (zero, unknown, partial and two-PR frames drawn) | sidebar count and tile show the same number (acceptable: one is visible from other pages) | minimal to minimal |
| STORY-010 Decide what to do about a needs-you session | 2/2 | 2/2 (row click, then Devin) | 0 to 0 | 0 to 0 drawn (answer-landed sign is planned) | none | minimal to minimal |
| STORY-012 Ask what Devin is stuck on | 0 needed; history 2/2 | 0 needed; history 2/2 | 0 to 0 | 0 to 0 | question shown in the table only; the agent no longer repeats it | minimal to minimal |
| STORY-021 Notification while working in Rakazo | 2/2 (planned) | 2/2 (planned) | 0 to 0 | 0 to 0 | toast and sidebar count, the toast is short-lived (acceptable) | minimal to minimal |
| STORY-022 Away: OS banner and phone push | not re-walked in round 3 | not re-walked: nothing in v5 draws it | 1 to 1 | 0-1 to 0-1 | both devices buzz (GAP-40) | acceptable to acceptable |
| STORY-031 Teammate opens the Devin page | 2/2 (1/1 when she may not connect) | 1/1 for a member without rights (notice only), 2/2 when she may connect | 0 to 0 | 0 to 0 drawn | none | minimal to minimal |

Verdict count: round 3 had 7 minimal, 1 acceptable, 0 convoluted. Round 4 has 7 minimal, 1 acceptable, 0 convoluted. Nothing got worse. STORY-021 and STORY-022 still depend on the planned notification link (GAP-48, GAP-52); if it cannot be built they fall back to acceptable and convoluted.

## Per-journey notes

### STORY-001 minimal
- **Drawn:** dialog with the letter tile, 'Connects Devin for everyone in this space. Read-only.', one field, the link 'Where to find your key', Cancel and Connect; empty, 'Connecting…' and 'The key was refused.' states (`STORY-001/1440-dialog-empty.png`, `1440-dialog-connecting-refused.png`). At a real 390px viewport the dialogs are 358px wide.
- **Planned:** 'Connect closes the dialog and opens /app/devin'.
- Round 3's connecting cue is fixed (label only; no spinner drawn). A member who may not connect never reaches this dialog: the Not connected member frame has no button.

### STORY-004 minimal
- Skeleton, load error ('Could not load Devin sessions.' with Try again) and populated frames are drawn. The header is the title only, so the skeleton and the data differ only by the small placeholder beside the title. Ask is hidden until an agent can answer.

### STORY-008 minimal
- Sidebar link shows 3, the amber tile shows 3, the Needs you group holds two Needs input rows and one Error row. The same number is stated twice on the page (sidebar and tile). I do not count that as redundancy: the sidebar copy is the only signal once the user is on another page, and the tile is the answer on the page.
- New frames drawn: 'Needs you 0' (neutral tile, no group, no sidebar number), partial results ('Some sessions could not be read.'), two pull requests (stacked in one cell), unknown status (raw text in a neutral badge).
- **Small cost:** the unknown-status frame shows Working 2 for one Working row and files the unknown row under 'Working' (F-STORY-008-07, low).

### STORY-010 minimal
- The whole row is one anchor; every cell resolves to it; one tab stop per row; the focus ring now surrounds the row (`STORY-010/1440-keyboard-focus-row.png`). Wait time is still only the Updated column (F-STORY-010-03, suggestion).
- **Still planned:** the page shows no sign that the answer landed (GAP-13).
- **Small cost:** the ring touches the first letters of the title and question (F-STORY-010-07, suggestion).

### STORY-012 minimal
- Closed with Ask; first Ask with intro and two suggestions; running turn; populated thread with links that name the session; agent-missing panel with 'Create Devin agent'. The 'cannot read' frame is gone and the answers do not quote questions, so the page is the only place a question appears (round 3's contradiction is closed). Collapse icon is 28x28 (F-STORY-012-05, low).

### STORY-021 minimal (planned)
- Toast over Inbox with 'Devin needs input', the full question, '2m ago', 'Opens Devin'; the stacked frame shows '+1'; the unreadable-question frame reads 'Add CSV export for invoices is waiting for your answer.' The click and the open are planned.

### STORY-022 acceptable (planned)
- Nothing in v5 draws the OS banner or the phone push, and both depend on the planned link. Verdict carried over.

### STORY-031 minimal
- Not connected: owner sees Connect Devin; a member without rights sees 'Ask a space owner to connect Devin.' Connected: title-only header, tiles, table. Key rejected: the member frame shows the notice, no Reconnect, no Ask, muted rows.
- **Small cost:** the member notice names nobody to ask, unlike the Not connected member frame (F-STORY-007-05, suggestion). Who counts as 'a space owner' is a plan matter (S4), not a mockup one.

## Duplicated information and needless decisions

- Duplicates left on the populated page: sidebar count and tile (one number, two places, intended); group heading 'Needs you' and the tile title 'Needs you' (same word, different jobs: label and section); the badge says 'Needs input' for the row. I would not remove any of them. The key-rejected frame states the stale condition twice, in the notice and in the muted rows, which is the intent.
- Needless decisions: none found. The user chooses nothing on the page except whether to open a session or ask the agent. The owner is not asked to decide whether to alert teammates (decision: whoever connected).
- Under 1024px the signal that something needs the user is not visible outside the drawer (F-STORY-033-06, low). That is a missed glance, not a decision.

## Remaining friction, ranked

1. No needs-you signal in the top bar under 1024px (F-STORY-033-06). Low, carried from round 3.
2. Unknown-status frame: tile says Working 2 for one Working row; unknown row filed under 'Working' (F-STORY-008-07). Low, mockup and GAP-03.
3. Collapse icon 28x28 (F-STORY-012-05). Low, copies the real panel header.
4. Suggestions: member key-rejected notice names nobody (F-STORY-007-05); focus ring touches text (F-STORY-010-07); wait time only in Updated (F-STORY-010-03).
