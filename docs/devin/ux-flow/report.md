# UX Flow Critique: Devin page (planned) — 2026-10-20

Scope: the planned read-only Devin page and the existing surfaces it touches. The page is not built, so the evidence is the mockup (`docs/devin/mockup.html`), Storybook screenshots of the existing app, the code, and the story catalog (`docs/devin/ux-paths/catalog.md`). Nothing was exercised live; hesitations are suspected, not observed.

## Run Summary

| Metric | Value |
|--------|-------|
| Journeys critiqued | 8 |
| Evidence source | Mockup + existing-app Storybook screenshots + code (no live pass; feature not built) |
| Verdicts | 0 minimal · 6 acceptable · 2 convoluted |

## Friction Scorecard

| Journey | Steps (actual/ideal) | Needless decisions | Re-entry | Dead ends | Verdict |
|---------|----------------------|--------------------|----------|-----------|---------|
| STORY-001 Connect from the Integrations tile | 5/4 | 0 | 1 | 1 | acceptable |
| STORY-004 First load after connecting | 3–4/2 | 0–1 | 0 | 1 | acceptable |
| STORY-008 Glance: what needs me | 2/2 | 0 | 0 | 0 (zero state undrawn) | acceptable |
| STORY-010 Decide what to do about a needs-you session | 3/3 actions, 7 incl. reading | 1 | 1 | 2 | acceptable |
| STORY-012 Ask the agent what Devin is stuck on | 3/3 | 1 | 0 | 2 | acceptable |
| STORY-021 Notification while working in Rakazo | 5/2 | 2 | 0 | 1 | acceptable |
| STORY-022 Away: OS banner and phone push | 4–5/2 | 2–3 | 1 | 2 | convoluted |
| STORY-031 Teammate opens the Devin page | 7/5 | 3 | 1 | 2 | convoluted |

Per-journey detail: `docs/devin/ux-flow/journeys/`. Cross-cutting detail: `docs/devin/ux-flow/redundancy.md`.

## Redundancy Map

- **Needs-you count** is stated on the tile, the table group, the sidebar dot, the toast, the push and in chat. Keep the table group (canonical) and the sidebar dot (re-entry). The dot means "a session needs you", not "an unseen notification".
- **Three clocks**: header "Updated 1m ago", the per-row Updated column, and the sidebar. Keep the per-row column; show the header time only when data is stale.
- **PRs open tile** duplicates the Pull request column. **ACUs** (tile + column) is cost, not "what needs me", and has no defined window. In the mockup the tile (41.6) disagrees with its own rows (42.0).
- **Ask "What is Devin stuck on?"** repeats the table. The agent earns its place for questions the table cannot answer ("Anything merged today?", one repo's week).
- **"Allow changes in Devin" + Devin write tools + skill pointer** contradict the read-only page.
- **Header external-link icon** has no defined target; row links and "Answer in Devin" cover the job.
- **Naming**: Activity uses "Needs you" for the group and "Needs input" for row status; "From" holds a source, not a person; the Devin tile says "Coding sessions and repo docs" while the page shows only sessions.

## Simplification Proposals (ranked)

### 1. Notifications open the Devin session directly
- **Now**: toast → Rakazo page → find row → title link → Devin. The OS banner only focuses the window (`apps/web/src/lib/notification-delivery.ts`); a phone tap opens the agent thread, and `/app/devin` would be parsed as bot id `devin` (`apps/mobile/lib/notification-open.ts`).
- **Proposed**: each needs-you notification links to its own Devin session. The banner click marks the notification seen and opens the link (this also fixes banner clicks for every notification). Mobile opens the https link with the system browser. Fall back to `/app/devin` if a session URL cannot be built.
- **Saves**: 2–3 steps on STORY-021, 022, 023; removes two dead ends.
- **Effort**: M. **Evidence**: journeys/STORY-021.md, STORY-022.md.

### 2. Make the needs-you row self-sufficient
- **Now**: the question is clipped to a fragment; the only control is a plain title link; the loud amber badge is not clickable; nothing says where to answer.
- **Proposed**: show the question on up to two lines and add an "Answer in Devin" link on needs-you rows. Refetch on window focus so the row clears after answering; no refresh button.
- **Saves**: dead ends in STORY-010 and 012; removes the reason to ask the agent for the question text.
- **Effort**: S (depends on GAP-01, the read path for question text). **Evidence**: journeys/STORY-010.md, STORY-012.md; mockup-v2-full.png.

### 3. Cut the page to what answers "what needs me"
- **Now**: four equal tiles, a header clock, an unlabeled external-link icon, an ACUs column, the agent panel drawn open.
- **Proposed**: keep Needs you (emphasised) and Working tiles; drop PRs open, ACUs this week and the ACUs column; header meta shows the Devin org name instead of the clock; drop the icon; the panel is closed until Ask.
- **Saves**: ~6 elements on the most-visited screen; STORY-004, 008, 010.
- **Effort**: S. **Evidence**: journeys/STORY-004.md, STORY-008.md; redundancy.md.

### 4. Remove the write path for Devin
- **Now**: the Devin agent can offer "Allow changes in Devin" and send messages to Devin behind a JSON approval card.
- **Proposed**: no Devin write tools, no toggle, and the devin-sessions skill no longer points at it. The agent says to answer in Devin and links the session.
- **Saves**: a contradiction in STORY-018; a confusing approval card.
- **Effort**: S. **Evidence**: redundancy.md; catalog GAP-10.

### 5. Land on the page after connecting
- **Now**: the "Devin connected" screen ends with Done and nowhere to go; the key hint does not say where to create a key.
- **Proposed**: Connect closes the dialog and opens `/app/devin`; the key hint links to where Devin service-user keys are created and drops "org-scoped".
- **Saves**: 1 step and 1 dead end on STORY-001.
- **Effort**: S. **Evidence**: journeys/STORY-001.md.

### 6. One Devin connection per space (decision needed)
- **Now**: each member pastes their own org key; a teammate sees a bare "Connect Devin" and must ask for a key. Any key shows the whole org, so per-user keys add no privacy.
- **Proposed**: one shared space connection, with rules for who may add or remove it and who is notified. If per-user stays, connect in place on the page and name the org in the header.
- **Saves**: STORY-031 from 7 steps to 1; removes key sharing.
- **Effort**: M–L. **Evidence**: journeys/STORY-031.md.

### 7. Use the app's words
- Rows say "Needs input" under a "Needs you" group, as Activity does; "From" becomes "Source"; the tile subtitle drops "and repo docs"; the notification title becomes "Devin has a question" with the body "<session title>: <question>".
- **Effort**: S. **Evidence**: redundancy.md; journeys/STORY-021.md.

## Already Minimal

- The connection form itself: one key field, one primary button (STORY-001).
- The glance: the needs-you rows sort first and answer the question in two steps (STORY-008).
- The click path to ask the agent (STORY-012).
- Keeping the "Devin" page with a docked "Devin agent", the same pattern as Legal.
