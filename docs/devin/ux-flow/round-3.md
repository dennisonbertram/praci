# UX Flow Critique, round 3: Devin page (mockup v4), 2026-10-20

Scope: the eight journeys scored in `docs/devin/ux-flow/round-2.md`, re-scored on `docs/devin/mockup.html` (v4). Decisions in force: read-only; one shared Devin connection per space; the needs-you notification goes to whoever connected and opens the Devin session; mobile gets push only; no Devin write option. Shared colour tokens (V10) and the deferred list in `docs/devin/ux-visual/problems.md` are not re-raised.

Evidence labels. **Drawn** means I saw it in v4 in a browser (screenshots under `docs/devin/ux-walker/round-3/`). **Planned** means only a caption, a stub link or a decision supports it and the static mockup cannot show it (clicks to real Devin, refetch, notification delivery). Planned items are not counted as findings.

## Friction scorecard

| Journey | Round 2 (actual/ideal) | Round 3 (actual/ideal) | Needless decisions (R2 to R3) | Dead ends (R2 to R3) | Duplicated information | Verdict (R2 to R3) |
|---|---|---|---|---|---|---|
| STORY-001 Connect from the Integrations tile | 4/4 | 4/4 (last step planned) | 0 to 0 | 0 to 0 | none (key hint and link are different facts) | acceptable to **minimal** |
| STORY-004 First load after connecting | 2/2 | 2/2 | 0 to 0 | 0 to 0 | none | minimal to minimal |
| STORY-008 Glance: what needs me | 2/2 | 2/2 | 0 to 0 | 0 (zero state undrawn) to 0 (still undrawn, low) | tile and sidebar dot say the same fact, only the tile has a number | minimal to minimal |
| STORY-010 Decide what to do about a needs-you session | 2/2 | 2/2 (row click, then Devin) | 0-1 to 0 | 1 to 0 drawn (answer-landed sign is planned) | none (second link removed) | acceptable to **minimal** |
| STORY-012 Ask what Devin is stuck on | 0 needed; history 3/3 | 0 needed; history 2/2 (Ask, then a suggestion) | 1 to 0 | 2 to 0 drawn (intro and cannot-read now drawn) | question shown in the table and again in a panel answer (acceptable; the agent is for history) | acceptable to **minimal** |
| STORY-021 Notification while working in Rakazo | 2/2 (planned) | 2/2 (planned) | 1 to 0 | 0-1 to 0 | toast and dot, both short-lived (acceptable) | minimal to minimal |
| STORY-022 Away: OS banner and phone push | 2/2 laptop; 2-3/2 phone (planned) | not re-walked: nothing in v4 draws it | 1 to 1 | 0-1 to 0-1 | both devices buzz (GAP-40) | acceptable to acceptable |
| STORY-031 Teammate opens the Devin page | 2/2 | 2/2 (1/1 when she may not connect) | 0 to 0 | 1 to 0 drawn | none | acceptable to **minimal** |

Verdict count: round 2 had 3 minimal, 5 acceptable, 0 convoluted. Round 3 has 7 minimal, 1 acceptable, 0 convoluted. The 021 and 022 verdicts still depend on the planned notification link (GAP-48, GAP-52); if it cannot be built they fall back to acceptable and convoluted.

## Per-journey notes

### STORY-001 minimal
- **Drawn:** dialog with the letter tile, 'Connects Devin for everyone in this space. Read-only.', one field, the link 'Where to find your key', tinted footer; empty, connecting and refused states; the dialog drawn over the not-connected page (`STORY-001/1440-dialog-empty.png`, `1440-dialog-connecting-refused.png`). Round 2's sharing gap is closed.
- **Planned:** the caption 'Connect closes the dialog and opens /app/devin'.
- **Small cost:** the connecting frame has no visible 'Connecting' cue (F-STORY-001-06, low).

### STORY-004 minimal
- First visit, loading, load error and empty frames are drawn. Ask is hidden when there is nothing for it to read. The skeleton mirrors the final layout (two tiles, six rows). Duration of the first load is unobserved.

### STORY-008 minimal
- Amber 'Needs you 3' tile first; failed sessions sit in the same group with a destructive 'Error' badge, so one group and one number answer the question. The group heading has no number. 'Needs you 0' with other sessions present is still not drawn (F-STORY-008-05, low).

### STORY-010 minimal
- The whole row is one link: every cell of a row resolves to the same anchor, one tab stop per row, rows 38px or taller, the question wraps in full under the title (`STORY-010/1440-needs-you-rows.png`). The 'Answer in Devin' link and its 18px target are gone.
- **Still planned:** the page shows no sign that the answer landed (refetch rule, GAP-13).
- **Small cost:** the keyboard focus ring wraps only the title (F-STORY-010-06, suggestion).

### STORY-012 minimal
- The drawn states now cover the journey: closed with Ask, first Ask with two suggestions, running turn, populated thread with links that name the session, the agent that cannot read a question, and the agent-missing panel.
- **Small cost:** the 'cannot read' frame is drawn beside a table that shows that question (F-STORY-012-09, low). Clicking Ask on the first-visit frame opens nothing (F-STORY-034-01, low).

### STORY-021 minimal (planned)
- The toast is drawn over Inbox with 'Devin needs input', the full question, '2m ago' and 'Opens Devin'; a second frame shows the '+1' stack. The click and the open are planned. The toast body when the question cannot be read is not drawn (F-STORY-021-02, low).

### STORY-022 acceptable (planned)
- Nothing in v4 draws the OS banner or the phone push, and both depend on the planned link. Verdict carried from round 2.

### STORY-031 acceptable to minimal
- A member who may connect sees the Connect button, a member who may not sees 'Ask a space owner to connect Devin.', and a member of a connected space sees the table with 'acme' in the header. The round 2 dead end is gone.
- **Not drawn:** the key-rejected page for a member who may not reconnect (F-STORY-007-04, low; GAP-54). Who counts as 'a space owner' is undecided (GAP-50).

## Remaining friction, ranked

1. Key-rejected page: Ask is offered although the agent cannot read Devin, and Reconnect is shown to everyone (GAP-54, F-STORY-007-03 and -04). Low.
2. Frames that contradict themselves: the 'cannot read' panel next to a table showing the question (F-STORY-012-09), and Ask on the first-visit frame opening nothing (F-STORY-034-01). Low, mockup only.
3. Under 1024px no needs-you signal appears outside the drawer (F-STORY-033-06). Low.
4. Connecting state has no visible cue (F-STORY-001-06). Low.
