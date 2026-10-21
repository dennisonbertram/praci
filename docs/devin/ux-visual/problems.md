# ux-visual round 1: problems and decisions (mockup v3)

Sources: `pages/devin-main/findings.md` (23), `pages/devin-parts/findings.md` (25), `../ux-walker/round-2/report.md` (27 open), `../ux-flow/round-2.md`. Duplicates across reviews are merged below; IDs in brackets are the source findings (M = main, P = parts, W = walker round 2).

Scope note: this is a mockup of an unbuilt page, so the skill's three-designer proposal and judging panel per cluster was collapsed into one decision per cluster by the orchestrator. Every decision follows the same rule: match the real component when one exists; when none exists, take the smallest change that meets the journey.

## Clusters (ranked)

### V1. Parts that do not match the real components (P1)
Root cause: the mockup redraws components instead of copying the real ones.
Covers: P01, P04, P06, P08, P10, P12, P13, P17, P18, P22, M01, M20, W-001-01, W-008-04, W-033-06.
Decision: copy the real anatomy and tokens for the connect dialog (384px, 32px input, 12px radius, title weight 500, 40px logo tile, tinted footer, blurred scrim, drawn as an overlay on the shell), the toast (32px dark circle, X on hover or focus), the panel header (generated avatar, name as a button, labeled focusable close), the composer (muted empty send, mic ring), the sidebar dot (aria-hidden plus screen-reader text), the sub-1024 top bar (hamburger only) and drawer (316px, scrim, Close, Devin link with dot). Tool rows use the app's real phrasing for MCP tools, as produced by `toolPhrase`/`toolWords` in `packages/core/src/events.ts`. Add `:focus-visible` with `--ring`.
Acceptance: side-by-side with each `real-*.png`, no visible anatomy difference; every control reachable by Tab with a visible ring; dialog fits at 375.

### V2. Key-rejected and error states look live and contradict themselves (P1)
Covers: M02, M03, M13, W-007-02.
Decision: use the real `ErrorNotice` framing and real Button variants. Key rejected: notice "Devin rejected the key. Alerts are paused." with "Reconnect"; tiles, badges and links dimmed to muted; sidebar dot hidden; header shows "Updated 4m ago" and every row time is at least that old. Load error: "Could not load Devin sessions." with "Try again". No layout shift: the notice takes the place of the tiles row.
Acceptance: nothing looks live in the rejected state; times are consistent; buttons match the app.

### V3. What "needs you" means (P1)
Covers: M04, W-008-02, W-008-06, W-021-02.
Decision: failed sessions belong under "Needs you" with the destructive "Error" badge and are counted in the tile. One vocabulary: group "Needs you" (app convention), badge "Needs input" or "Error", notification title "Devin needs input". The tile is the only count; the group heading carries no number.
Acceptance: one meaning per word; tile count equals rows in the group.

### V4. Needs-you rows are hard to act on (P2)
Covers: M05, M06, M17, P14, W-010-04, W-010-05, W-004-06.
Decision: the whole row opens the session in Devin (title carries an external glyph); the separate "Answer in Devin" link is replaced by the row itself, with the question shown in full (wraps, no clamp) under the title. In the agent's bubbles, links name the session ("Open Add CSV export in Devin") and carry the external glyph.
Acceptance: one target per row, at least 24px tall; the full question is readable without hovering.

### V5. Agent panel states are missing (P1)
Covers: P11, M19, W-012-06, W-012-07, W-012-08, STORY-034.
Decision: draw the first Ask (real `AgentPanelIntro` with two suggestions: "Anything merged today?", "What did Devin do this week?"), a running turn, the agent's reply when it cannot read a question ("I can't read that question. Open it in Devin."), and the agent-missing repair state as the real app shows it.
Acceptance: each state matches the real panel's equivalent story.

### V6. Connect dialog copy and states (P1)
Covers: P02, P03, P05, P07, W-001-05, W-002-02, W-002-05.
Decision: description "Connects Devin for everyone in this space. Read-only." plus "Where to find your key" as a visible external link. States: empty (Connect disabled), connecting, refused ("The key was refused" under the field, as the real dialog shows). Add the frame a member sees when they may not connect: the not-connected page with "Ask a space owner to connect Devin." and no button.
Acceptance: no "org-scoped" or "service-user"; all four states drawn; fits at 375.

### V7. Toast (P2)
Covers: P18, P19, P20, P21, W-021-04.
Decision: real toast anatomy; body "Add CSV export for invoices: Should the export keep the legacy CSV column order?"; an "Opens Devin" hint line in the muted style; time matches the row; the toast is drawn over another page (Inbox), not the Devin page; a second frame shows the real "+1" stack.
Acceptance: matches the real toaster stories; reachable by keyboard.

### V8. States without content still offer Ask; empty and loading are weak (P2)
Covers: M10, M11, M12, W-002-04.
Decision: hide Ask in not-connected, loading and load-error states; keep it in empty and populated. Empty: "No Devin sessions yet." plus an "Open Devin" link. Loading skeleton mirrors the final layout (header meta, two tiles at final height, row placeholders), visible in dark.
Acceptance: skeleton blocks align with the populated layout at 1440.

### V9. Layout details (P2)
Covers: M08, M09, M15, M16, M18, P09, P15, P24, W-033-03, W-033-04.
Decision: the two tiles split the full row like Legal's tiles. At 375 rows show title, badge, question and time only; empty fields are omitted. Below 1280 the overlay panel gets the real shell's behaviour (Escape and outside click close it; no new scrim, matching the app). Header meta reads "acme" with the label "Devin org" as screen-reader text and a tooltip. Narrow top bar has no extra label.
Acceptance: no "Pull request: —" at 375; tiles span the content width.

### V10. Shared colour tokens fail contrast (P2, plan decision)
Covers: M07, W-008-03.
Decision: the mockup keeps the real tokens. The failing warning (3.48:1) and success (4.17:1) text colours are app-wide tokens in `@rakazo/ui-tokens`; fixing them is a separate design-system change and is recorded as an open question in the plan, not patched in the mockup.

### Deferred (P3, no change)
M14 status pill borders (matches real Badge after V1), M21 and P25 mockup presentation artifacts, M22 static Working pill, M23 read-only line on not-connected (covered by V6), P16 composer edge offset (same in real app), P23 other rows' glance values (decoration only).
