# UX Walker Report: Granola meetings and Wispr Flow voice, 2026-10-20

**This walk was against static mockups. The features are unbuilt.** The stories were walked on `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html`, opened over `file://` in dark mode at 1280x900, with one 390x844 spot-check. Nothing was run against a live app, so a "fail" here means the plan or the mockup leaves a step undefined, not that code is broken. Of the 99 findings, 61 are about the plan and 38 are about the mockups.

## Run Summary

| Metric | Value |
|--------|-------|
| **Target** | `docs/granola/mockup.html` and `docs/wispr-flow/mockup.html` (static, `file://`). Plans: `docs/plans/granola.md` (epic #444), `docs/plans/wispr-flow.md` (epic #452) |
| **Run mode** | Full, first run, static mockups only |
| **Stories in catalog** | 38 (`docs/ux-paths/meetings-voice/catalog.md`) |
| **Stories walked** | 21 |
| **Stories skipped** | 17 (not walked in this run) |
| **Stories re-verified** | 0 |
| **Overall pass rate** | 4/21 (19%) |
| **Duration** | Not recorded |

Walked: GS-1, GS-2, GS-4, GS-5, GS-7, IF-1, IF-8, MB-1, MB-2, MB-3, MB-5, MB-6, MX-1, MX-3, MX-5, MX-6, MX-7, MX-8, WF-6, WF-7, WF-8.

Skipped: GS-3, GS-6, IF-2, IF-4, IF-5, IF-6, IF-7, MX-2, MX-4, MB-4, MB-9, WF-1, WF-2, WF-4, WF-5, MB-7, MB-8. The walk reports record no reason for most of these. The catalog says WF-1, WF-2, WF-4, WF-5, MB-7 and MB-8 depend on Flow's own app or device keyboards and cannot be walked in a browser.

Passed: MX-1, MX-5, MX-7, WF-7 (medium findings only). Failed: the other 17. Each of the 17 failures has at least one high finding, and every high finding is about the plan; no mockup finding is rated high.

## Findings Summary

No quick fixes were applied and no GitHub issues were filed by this walk. Every finding is routed to `docs/ux-paths/meetings-voice/fix-list.md`, which applies the maintainer's decisions (D1 to D4) and rejects findings that the code contradicts.

### By Severity

| Severity | Count | Quick Fixed | Issue Filed | Deferred |
|----------|-------|-------------|-------------|----------|
| Critical | 0 | 0 | 0 | 0 |
| High | 21 | 0 | 0 | 21 |
| Medium | 43 | 0 | 0 | 43 |
| Low | 35 | 0 | 0 | 35 |
| Suggestion | 0 | — | — | 0 |
| **Total** | **99** | **0** | **0** | **99** |

"Deferred" here means carried to the fix list; none of them is fixed or filed.

### By Kind

| Kind | High | Medium | Low | Total |
|------|------|--------|-----|-------|
| Plan (the plan leaves a step or state undefined) | 21 | 27 | 13 | 61 |
| Mockup (the mockup is wrong or incomplete) | 0 | 16 | 22 | 38 |

Of the 99, 25 carry a JF id from the catalog and 74 are marked NEW or have no JF id. All are mapped in the fix list.

### By Category

| Category | Count | Examples |
|----------|-------|---------|
| Flow | 22 | Consent prompt trigger undefined (WF-6); Disconnect has no stated outcome for kept data (GS-7) |
| Happy Path | 22 | No first-sync state (GS-1); meeting-only Inbox layout undefined (IF-1, IF-8, MB-3) |
| Visual | 16 | Author notes drawn as UI text (GS-2, GS-5, MX-8, WF-6); grey disabled Connect looks enabled in dark mode (GS-1) |
| Error Handling | 14 | One rejection line for every cause (GS-2, MB-2); `needs_reconnect` reuses the first-connect view (GS-5) |
| Consistency | 11 | "Signed in with Granola" group drawn on mobile (MB-1); Transcription row reads "Wispr Flow" before a key is verified (MB-5) |
| Accessibility | 5 | To-do checkbox 16x16 px (GS-1, IF-1); routine switch 36x20 px (MX-3) |
| Simplicity | 3 | Two Granola routes on one page with two "Disconnect" buttons (GS-1, GS-4) |
| Layout | 3 | Connected badge wraps onto its own line (GS-1); "After" state merges three screens (GS-7) |
| Disclosure | 2 | "Live questions" and "Sync" section labels (GS-1); consent heading beyond the plan (WF-6) |
| Hierarchy | 1 | Placeholder reuses the generic "API key" label (MB-5) |

## Quick Fixes Applied

None. This walk edited no code, plan or mockup.

## Issues Filed

None. No issues were filed by this walk.

## UX Audit Summary

### Common Patterns

- **Pattern**: The meeting-only Inbox is drawn in the mockup but does not exist in the plan or the code. The mockup shows the To do card alone; the web Inbox shows "No mail connected" first (`Inbox.tsx:1266`) and mobile clears to-dos with no account (`inbox.tsx:102`, `:458`).
  - Affected stories: IF-1, IF-8, MB-3, MX-8 (and GS-1 step 9)
  - Root cause: S5 names the files but not the zero-account layout.
  - Recommendation: specify the layout in S5 (fix list FX-14, FX-15).
- **Pattern**: Granola card states are missing or ambiguous: first sync, rejection cause, `needs_reconnect`, and what Disconnect keeps.
  - Affected stories: GS-1, GS-2, GS-4, GS-5, GS-7, MB-2, MX-8
  - Root cause: the plan lists one line per state ("Synced {n} meetings", "Granola rejected this key") and no transitions.
  - Recommendation: define the four states in S6 (FX-24, FX-26, FX-27, FX-32).
- **Pattern**: Flow voice consent and routing are defined in the wrong place. The re-prompt is drawn on the Inbox, mobile asks mid-call after audio is sent, and "This device" outranks the Flow choice.
  - Affected stories: WF-6, WF-8, MB-5, MB-6
  - Root cause: a global disclosure bump and a separate Transcription selector.
  - Recommendation: Flow as a "Transcribe only" provider row with consent at Connect (decision D3; FX-40, FX-42, FX-44).
- **Pattern**: Author notes and design comments are drawn as visible text in the mockups, which the repository's copy rule would treat as product copy.
  - Affected stories: GS-2, GS-5, GS-7, MX-1, MX-5, MX-7, MX-8, WF-6, WF-7
  - Root cause: notes were placed inside the frames instead of HTML comments.
  - Recommendation: move them to comments (FX-54 to FX-58, FX-64, FX-66, FX-68).
- **Pattern**: Mobile frames copy web patterns (a Live questions group, a switch, a picker screen, no Verifying or rejected state, 16 to 24 px tap targets).
  - Affected stories: MB-1, MB-2, MB-3, MB-5, MB-6
  - Root cause: the iPhone frames are HTML, not native controls.
  - Recommendation: redraw to the native pattern (FX-60, FX-61, FX-67).

### Systemic Issues

1. **Mockups show states the plan has not defined.** The unconnected tile, `needs_reconnect`, Syncing, the consent-off Inbox and the Key rejected state on mobile are either absent or drawn only in one place. Affects 12 stories.
2. **Mockup copy goes beyond the plans.** "Granola is busy. Retrying.", "Business plan", "API access required" and "Voice sharing has changed" are not in the plans. Each needs a deliberate decision, since the repository requires the PR to quote and justify every new visible word. Affects GS-1, GS-2, GS-4, WF-6, WF-8.
3. **Dead ends by design.** The "From:" line on a to-do, the citation popover and the connected key card lead nowhere. The plan excludes a meetings page on purpose, so these are decisions to record, not defects to fix. Affects GS-1, IF-1, MB-3, MX-7.
4. **Small touch targets in the mockups.** Checkboxes at 16 px (GS-1, IF-1), 24 px (MB-3) and a 36x20 px switch (MX-3). Mockup-only; the real components set their own targets.

## Top 5 Recommendations

1. **Specify the meeting-only Inbox before building S5** (FX-14, FX-15, FX-56). Would improve 5 stories: IF-1, IF-8, MB-3, MX-8, GS-1. Show the To do card, and the consent prompt when consent is off, above "Connect mail", and keep meeting to-dos visible on every account tab.
2. **Define the Granola card states in S6** (FX-24, FX-26, FX-27, FX-32, FX-55). Would improve 7 stories: GS-1, GS-2, GS-4, GS-5, GS-7, MB-2, MX-8. "Syncing", a rejected key with a hint on the detail page, `needs_reconnect` that keeps the sync history, and Disconnect reusing "Your data in {name} is not deleted."
3. **Carry decision D3 into the Wispr Flow plan and mockup** (FX-40 to FX-44, FX-64 to FX-67). Would improve 4 stories: WF-6, WF-8, MB-5, MB-6. Flow is a "Transcribe only" row in the providers list, consent is asked once at Connect, and the row ships with S3a.
4. **Clean the mockups of author notes and draw the missing states** (FX-53 to FX-61, FX-64 to FX-68). Would improve 12 stories. Notes become comments; draw the unconnected tile, rejected, Syncing and `needs_reconnect`.
5. **Fix what the meeting tools return** (FX-10 to FX-13). Would improve 4 stories: MX-1, MX-5, MX-7, MX-8. Escape forged closing tags, wrap `message_bot` replies, return provider and a literal "no transcript" or refusal reason, and cite each meeting once.

## Still Failing

All 17 failures are open and none was fixed or filed. "Blocked by" is the fix-list row that closes it.

| Story | Failure Point | Reason | Blocked By |
|-------|---------------|--------|------------|
| STORY-GS-1 | Steps 4 and 6 | No first-sync state; "Synced 42 meetings" may be partial | FX-27 |
| STORY-GS-2 | Rejected key | One line for a truncated, expired, wrong-scope or plan-limited key | FX-24 |
| STORY-GS-4 | Step 4 | A free-plan user gets a key field and no explanation | FX-24 |
| STORY-GS-5 | Step 1 | `needs_reconnect` reuses the first-connect view; no sign outside Integrations | FX-26, FX-12 |
| STORY-GS-7 | Steps 2 and 3, 5 | Disconnect is silent about kept data; no delete control | FX-32, FX-7, FX-8 (D4) |
| STORY-IF-1 | Steps 2 to 4 | Meeting-only layout not in plan or code | FX-14 |
| STORY-IF-8 | Steps 1 and 2 | Drawn empty state does not exist in the code path | FX-14, FX-20 |
| STORY-MB-1 | Steps 1 and 2 | No Integrations list row for Granola on mobile; "Add" starts OAuth | FX-30 |
| STORY-MB-2 | Rejected key | No cause and no next step on mobile | FX-24 |
| STORY-MB-3 | Mobile Inbox | No zero-account layout; to-dos cleared when no account | FX-14 |
| STORY-MB-5 | Picker | Flow offered to every user with no access signal | FX-40 (D3) |
| STORY-MB-6 | Steps 1 to 7 | Consent after audio is sent; "This device" outranks Flow | FX-42, FX-44 |
| STORY-MX-3 | Whole story | Weekly routine: no way to see or delete entries | FX-1 (S7 deferred, D1) |
| STORY-MX-6 | Step 5 | If S5 stops after pinning, the tile reads Connected and nothing else | FX-47 |
| STORY-MX-8 | Inbox | Meeting-only Inbox shows "Connect mail" | FX-14 |
| STORY-WF-6 | Consent | Re-prompt trigger and declined result undefined | FX-42 (D3) |
| STORY-WF-8 | Picker | Flow selectable without API access; error gives no next step | FX-40 (D3) |

## Story Results Detail

Findings are counted as high / medium / low.

| Story | Status | Findings | Fixed | Issues | Notes |
|-------|--------|----------|-------|--------|-------|
| STORY-GS-1 | Fail | 9 (1/5/3) | 0 | 0 | First-sync state, agent link, two Disconnect buttons |
| STORY-GS-2 | Fail | 6 (1/3/2) | 0 | 0 | One rejection line; rejected field drawn read-only |
| STORY-GS-4 | Fail | 4 (2/1/1) | 0 | 0 | Free plan; MCP-not-connected state not drawn |
| STORY-GS-5 | Fail | 5 (2/2/1) | 0 | 0 | `needs_reconnect` |
| STORY-GS-7 | Fail | 6 (2/3/1) | 0 | 0 | Disconnect and delete |
| STORY-IF-1 | Fail | 6 (1/4/1) | 0 | 0 | Meeting-only Inbox |
| STORY-IF-8 | Fail | 3 (1/1/1) | 0 | 0 | Empty state wording |
| STORY-MB-1 | Fail | 6 (1/2/3) | 0 | 0 | Mobile entry point |
| STORY-MB-2 | Fail | 4 (1/2/1) | 0 | 0 | Mobile rejection |
| STORY-MB-3 | Fail | 6 (1/2/3) | 0 | 0 | `TodoCard` exists on mobile |
| STORY-MB-5 | Fail | 9 (1/6/2) | 0 | 0 | Transcription row |
| STORY-MB-6 | Fail | 3 (2/0/1) | 0 | 0 | Call routing and consent |
| STORY-MX-1 | Pass | 4 (0/2/2) | 0 | 0 | Two agents, no provider shown |
| STORY-MX-3 | Fail | 4 (1/1/2) | 0 | 0 | Resolved by deferring S7 |
| STORY-MX-5 | Pass | 2 (0/1/1) | 0 | 0 | Summary-only meeting |
| STORY-MX-6 | Fail | 2 (1/0/1) | 0 | 0 | Stopped-S5 case not drawn |
| STORY-MX-7 | Pass | 3 (0/2/1) | 0 | 0 | Safe outcome only |
| STORY-MX-8 | Fail | 6 (1/3/2) | 0 | 0 | Both sources together |
| STORY-WF-6 | Fail | 5 (1/1/3) | 0 | 0 | Consent |
| STORY-WF-7 | Pass | 3 (0/1/2) | 0 | 0 | Daily cap |
| STORY-WF-8 | Fail | 3 (1/1/1) | 0 | 0 | No API access |

## Run History

| Run | Date | Walked | Passed | Failed | Fixes | Issues |
|-----|------|--------|--------|--------|-------|--------|
| 1 | 2026-10-20 | 21 | 4 | 17 | 0 | 0 |

---

*Generated by `/ux-walker`, 2026-10-20. Source: `docs/ux-walker/meetings-voice/stories/*/findings.json` and `walk-report.md`.*
