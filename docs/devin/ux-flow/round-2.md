# UX Flow Critique, round 2: Devin page (mockup v3) — 2026-10-20

Scope: the eight journeys scored in `docs/devin/ux-flow/report.md`, re-scored against the revised mockup (`docs/devin/mockup.html`, v3) and the requester decisions now in force: read-only; one Devin connection per space; the needs-you notification goes to whoever connected; a notification links straight to the Devin session; mobile gets push only (no native screen); no Devin write option.

Evidence labels. **Drawn** means I saw it in the v3 mockup in a browser; screenshots are in `docs/devin/ux-walker/round-2/` (listed in `docs/devin/ux-walker/round-2/report.md`). **Planned** means the mockup has only a caption, a stub link, or nothing, and the behaviour comes from a decision or the catalog; I could not observe it. The mockup is static: every link is `href="#"` and the toast and rows have no click handler. Step counts below are for the intended path, and a step that depends on planned behaviour is marked. Nothing was run against Devin.

## Friction scorecard

| Journey | Round 1 steps (actual/ideal) | Round 2 steps (actual/ideal) | Needless decisions (R1 to R2) | Dead ends (R1 to R2) | Verdict (R1 to R2) |
|---|---|---|---|---|---|
| STORY-001 Connect from the Integrations tile | 5/4 | 4/4 (end step planned) | 0 to 0 | 1 to 0 drawn (done view dropped by caption) | acceptable to acceptable |
| STORY-004 First load after connecting | 3-4/2 | 2/2 | 0-1 to 0 | 1 to 0 | acceptable to **minimal** |
| STORY-008 Glance: what needs me | 2/2 | 2/2 | 0 to 0 | 0 (zero state undrawn) to 0 (zero state still undrawn) | acceptable to **minimal** |
| STORY-010 Decide what to do about a needs-you session | 3/3 actions (7 with reading) | 2/2 (3 with reading) | 1 to 0-1 | 2 to 1 | acceptable to acceptable |
| STORY-012 Ask what Devin is stuck on | 3/3 | 0 needed (table now answers it); history questions 3/3 | 1 to 1 | 2 to 2 | acceptable to acceptable |
| STORY-021 Notification while working in Rakazo | 5/2 | 2/2 (planned) | 2 to 1 | 1 to 0-1 | acceptable to **minimal** |
| STORY-022 Away: OS banner and phone push | 4-5/2 | 2/2 laptop; 2-3/2 phone (planned) | 2-3 to 1 | 2 to 0-1 | convoluted to **acceptable** |
| STORY-031 Teammate opens the Devin page | 7/5 | 2/2 | 3 to 0 | 2 to 1 | convoluted to **acceptable** |

Verdict count: round 1 had 0 minimal, 6 acceptable, 2 convoluted. Round 2 has 3 minimal, 5 acceptable, 0 convoluted.

Verdicts for STORY-021 and STORY-022 depend on the notification link behaviour, which is planned and not drawn; if the link cannot be built or the phone cannot open it (GAP-52, GAP-48), they fall back to acceptable and convoluted respectively.

## Per-journey notes

### STORY-001 Connect from the Integrations tile: acceptable
- **Drawn:** dialog with the hint, one field, and the link "Where to find your key" (`docs/devin/ux-walker/round-2/STORY-001/step-1-dialog.png`). Caption: "Connect closes the dialog and opens /app/devin." The "Devin connected / Done" stop is no longer in the plan, so the step count falls from 5 to 4 and the dead end goes. The ending is a caption, not a frame (planned).
- **Still costs:** the hint still says "org-scoped" (jargon). With one connection per space, the dialog does not tell the person that every member will see all org sessions (new finding F-STORY-001-05, medium). I hold the verdict at acceptable for that reason, not for step count.
- **Not drawn:** Connect disabled on an empty field, connecting, rejected key, could not reach Devin.
- **Dialog at 390px browser width:** the frame stays 440px and clips the Connect button (`docs/devin/ux-walker/round-2/STORY-001/browser-390-dialog.png`); mockup artifact.

### STORY-004 First load after connecting: minimal
- **Drawn:** first visit with the panel closed, the skeleton, the load error with Try again, and the empty state (`docs/devin/ux-walker/round-2/STORY-004/step-1-first-visit-closed.png`, `step-2-loading.png`, `step-3-load-error.png`, `docs/devin/ux-walker/round-2/STORY-005/step-1-empty.png`). Two tiles only (ACUs and PRs open removed). Header meta is the org name.
- Two steps: Connect lands on the page, read the Needs you group. The dead end in round 1 (no loading, error or empty state) is gone. Caveat: the skeleton is static, so how long the first load takes is unobserved.
- Residual: Ask is drawn on Loading, Empty and Load error frames (F-STORY-002-04, low).

### STORY-008 Glance: what needs me: minimal
- **Drawn:** the Needs you tile is the only amber element and the Needs you group comes first (`docs/devin/ux-walker/round-2/STORY-008/step-1-glance-first-visit.png`). Dark theme checked (`docs/devin/ux-walker/round-2/STORY-008/dark-check-first-visit.png`).
- Two steps, as before, but the round-1 hierarchy problem (tile same weight as the others) is resolved.
- Residual: Needs you 0 with other sessions present is still not drawn (F-STORY-008-05, low); badge text contrast 3.48:1 (warning) and 4.17:1 (success) is below 4.5:1 (F-STORY-008-03, medium).

### STORY-010 Decide what to do about a needs-you session: acceptable
- **Drawn:** each needs-you row shows the question (two-line clamp) and the link "Answer in Devin" (`docs/devin/ux-walker/round-2/STORY-010/step-1-needs-you-row-hover.png`, `step-2-keyboard-focus-answer-link.png`). Two actions: find the row, click the link. Round 1 had three actions and seven steps with reading.
- **Read-only decision:** no reply control exists, so the dead end where a user looks for a reply box is gone.
- **Still open:** after answering in Devin the page gives no drawn sign that the answer landed (refetch rule undecided, GAP-13). That is the one dead end left, and it is planned behaviour, so the verdict stays at acceptable.
- **Needless decision (0-1):** the row has two links (title and Answer in Devin), both `#`, so two tab stops to what is presumably one destination (F-STORY-010-05).

### STORY-012 Ask what Devin is stuck on: acceptable
- **Drawn:** the panel closed by default and open at 1440 with Ask hidden (`docs/devin/ux-walker/round-2/STORY-012/step-1-panel-open.png`). Tool rows read "Session search" and "Session get messages ×2".
- The question text is now in the table, so the journey in its old form (ask the agent to read me the question) is redundant: zero asks are needed. The agent still earns its place for history questions ("Anything merged today?", one repo's week), which cost three actions and have no shorter route.
- **Dead ends (2):** the first-open state (empty thread, intro, suggestion chips) is not drawn, because Ask in the first-visit frame hides the button and opens nothing (`docs/devin/ux-walker/round-2/STORY-012/step-2-ask-on-first-visit-frame.png`, F-STORY-012-08), and the wording when the agent cannot read the question is not drawn (F-STORY-012-07).

### STORY-021 Notification while working in Rakazo: minimal (planned)
- **Drawn:** toast "Devin has a question", body "<session title>: <question>", caption "Clicking opens that session in Devin (external) and marks the notification seen" (`docs/devin/ux-walker/round-2/STORY-021/step-1-toast.png`). **Planned:** the click, and that it opens the session. The toast has no click handler in the mockup.
- Two steps: see the toast, click it, and she is in Devin. Round 1 was five steps through the Rakazo page. Whoever connected receives it (decision); other members get none.
- Residual: one remaining double signal for a present user (toast and sidebar dot), and the toast is drawn over the Devin page itself, which the catalog suggests suppressing (F-STORY-021-04). Signing in to Devin in the system browser from Electron is unobserved.

### STORY-022 Away: OS banner and phone push: acceptable (planned)
- **Planned only, nothing drawn:** the banner click opens the Devin session (round 1: it only focused the window), and the phone tap opens the same https link (round 1: it opened the agent thread, or nothing for `/app/devin`). Both are decisions; the mockup has no frame for either.
- Laptop: 2 steps. Phone: tap, browser opens Devin, sign in if needed, 2 to 3 steps. The sidebar dot step and the agent-thread step are gone, which removes the re-entry and two dead ends.
- **Condition:** mobile must handle an external https notification link (GAP-48). If it does not, the phone path is a dead end again and the verdict falls back to convoluted.
- Left as is: both devices still buzz (GAP-40).

### STORY-031 Teammate opens the Devin page: acceptable
- Decision: one connection per space. Tom clicks Devin and sees the table with the org name in the header: two steps, no key, no Integrations visit. Round 1 was seven steps with three needless decisions (ask for a key, find the Integrations tile, paste a shared key).
- **Drawn:** the table with "acme" in the header (`docs/devin/ux-walker/round-2/STORY-004/step-1-first-visit-closed.png`). **Planned:** that Tom sees it without connecting.
- **Dead end (1):** not drawn is the page for a member who may not connect, replace or remove the shared connection, and who may press Reconnect on the stale frame (GAP-50, GAP-49). Tom also gets no alert; they go to the connector, and nothing says who that is or what happens when that person leaves (GAP-53, STORY-035).

## Redundancy: what round 2 resolved and what is new

**Resolved by v3 or by the decisions**
- Three clocks: the header time shows only on the stale frame (`docs/devin/ux-walker/round-2/STORY-007/step-1-key-rejected-stale.png`).
- PRs open tile, ACUs tile and ACUs column: removed.
- Header external-link icon with no target: removed.
- "From" column: now "Source".
- Allow changes in Devin, Devin write tools and the skill pointer: removed by decision.
- Needs you stated in the header and the table group count: group headings now carry no count.
- Per-user connections and key sharing: removed by decision.
- Agent thread as a phone destination: removed by decision (push opens the session).

**Still present**
- The needs-you fact on one screen: tile, group heading, two badges, sidebar dot, and in the open-panel frame the agent reply (F-STORY-008-02, low). The dot and the group heading are the cheapest to drop; the tile is the emphasised one.
- Three labels for one state: "Needs you" (tile, group), "Needs input" (badge), "has a question" (toast) (F-STORY-008-06, low).
- Toast, dot and tile for a user who is present.

**New in v3**
- Two links per needs-you row to presumably the same session (title and "Answer in Devin"), and two tab stops (F-STORY-010-05). Six entry points reach the same Devin session overall (title, Answer in Devin, toast, OS banner, phone push, agent "Open in Devin" twice); all but the first two are deliberate, because each is the only route from its context.
- The top bar below 1024px calls the page "Devin agent" while the page title is "Devin" (`docs/devin/ux-walker/round-2/STORY-033/switcher-900-closed.png`, F-STORY-033-06).
- On the stale frame, the header clock and the red notice both say the data is not current (`docs/devin/ux-walker/round-2/STORY-007/step-1-key-rejected-stale.png`). Low; the clock is the only cue that the rows are old, so keep it and add nothing.
- Ask is drawn where there is nothing to ask (Not connected, Loading, Empty, Load error).

## Round-1 simplification proposals: status

| # | Proposal | Round 2 |
|---|---|---|
| 1 | Notifications open the Devin session directly | Decided; planned, not drawn (GAP-48, GAP-52 remain) |
| 2 | Make the needs-you row self-sufficient | Drawn: question on two lines and "Answer in Devin"; refetch not drawn |
| 3 | Cut the page to what answers "what needs me" | Drawn: two tiles, org meta, no icon, panel closed |
| 4 | Remove the write path for Devin | Decided |
| 5 | Land on the page after connecting | Caption; help link drawn; "org-scoped" still in the hint |
| 6 | One Devin connection per space | Decided; governance and sharing disclosure undrawn (GAP-50) |
| 7 | Use the app's words | Partly: "Source" done; "Needs input" vs "Needs you" still differ |

## Remaining simplifications, ranked

1. **Say, in one clause, that the connection is shared** (connect and remove dialogs), and drop "org-scoped". Effort S. Closes F-STORY-001-05 and part of GAP-50.
2. **Mark stale rows as stale** (dim the tile and dot, or three words in the notice) so a rejected key does not look live and the user learns alerts are off. Effort S. F-STORY-007-02.
3. **One row, one link.** Make "Answer in Devin" the only link on a needs-you row, or make the whole row the link; drop the row hover otherwise. Effort S. F-STORY-010-05.
4. **Hide Ask until an agent exists.** Effort S. F-STORY-002-04.
5. **Use one word for the state** ("Needs you") on tile, group and badge. Effort S. F-STORY-008-06.
6. **Show the needs-you signal below 1024px** (dot on the menu button). Effort S. F-STORY-033-06.

## Already minimal

- The two-step glance and the one-click answer route (STORY-008, STORY-010).
- One tile pair, one table, one primary action per state.
- Panel closed until Ask, with Ask hidden once it is open.

## What I could not observe

- Any click target or navigation (all links are `#`), the toast click, the dot clearing, refetch after answering, the phone push, and the Devin tile and landing after Connect.
- The first-open panel state, because the mockup builds the panel only in its first frame.
