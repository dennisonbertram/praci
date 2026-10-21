# UX Flow Critique: Granola meetings and Wispr Flow voice, 2026-10-20

Nothing in this critique is built. Every step count is "as planned or mocked": counted from the plans (`docs/plans/granola.md`, `docs/plans/wispr-flow.md`), the two mockups, and today's code that the plans extend. The ids `FX-n` point to rows in `docs/ux-paths/meetings-voice/fix-list.md`, which holds the exact change for each proposal and applies the maintainer's decisions (D1 to D4, below).

## Run Summary

| Metric | Value |
|--------|-------|
| Journeys critiqued | 5 (STORY-IF-1, STORY-GS-1, STORY-MX-8, STORY-WF-6, STORY-MB-1), plus the variations MB-4, GS-3, MX-3, MX-7, WF-8 and MB-6 |
| Evidence source | Live pass over the static mockups (`docs/granola/mockup.html`, `docs/wispr-flow/mockup.html`) with screenshots in `journeys/*-screens/` and `redundancy-screens/`, plus the plans and the mobile and web code. There is no running feature to traverse. |
| Verdicts | 0 minimal, 3 acceptable (IF-1, GS-1, MX-8), 2 convoluted (WF-6; MB-1 as the code stands today, acceptable as planned) |
| Variation verdict | MX-3 (weekly memory routine) convoluted; resolved by D1, which defers S7 |
| Redundancy findings | 19: 5 duplicate paths, 4 duplicate information, 5 overlapping features, 5 hierarchy and IA |

### Maintainer decisions applied

- D1: Defer the Granola weekly memory routine (S7, #443). Meetings stay reachable through the meeting tools.
- D2: One Granola agent. The API-key connection attaches to the existing one, otherwise it creates one.
- D3: Wispr Flow is a "Transcribe only" row in the existing Voice providers list, with no separate Transcription selector. Consent is asked once at Connect, per recipient, with no global re-prompt. The row ships with S3a.
- D4: The person who connected can delete a stored meeting with its to-dos. Everything else is kept permanently.
- Earlier decisions stand: Business and higher API sync, meetings private to the connecting user, follow-ups as Inbox to-dos, Flow API slices #447 and #448 blocked on access.

## Friction Scorecard

"As planned" is before the decisions above. Dead ends and decisions are counted as the critics listed them.

| Journey | Steps (actual/ideal) | Needless decisions | Re-entry | Dead ends | Verdict |
|---------|----------------------|--------------------|----------|-----------|---------|
| STORY-IF-1: meeting-only founder finds follow-ups in the Inbox | 3 / 2 (web, as plan plus code) | 0 | 0 | 3 (From line not tappable, no undo after fade, badge counts mail only) | acceptable |
| STORY-GS-1: paste a Granola key, get a first answer | 7 / 3 to first answer; 8 / 4 to the Inbox to-do | 3 (which route, which agent, whether 41 meetings is complete) | 0 measured, 1 suspected (reopening the detail page) | 3 (connected card has no next step, citation popover, From line) | acceptable |
| STORY-MX-8: first week, Granola and Flow together | about 13 / 7 real actions | 4 (route, agent, whether to ask, consent) | 0 | 4 (no key for a Pro plan, no key link, consent-off empty state is false, From line) | acceptable (MX-3 variation: convoluted) |
| STORY-WF-6: choose Flow as the transcription provider | 8 / 7 on web; 9 / 7 on phone | 2 (global consent re-prompt, "This device" versus server provider) | 0 | 2 (API access required, daily cap) | convoluted |
| STORY-MB-1: paste a Granola key from the phone | 6 or more / 4 (not possible today) | 0 as planned; 1 today (generic "Add" starts OAuth) | 0 | 1 (connected card has no onward action, accepted) | convoluted today, acceptable as planned |

Effect of the decisions on the counts: D3 takes WF-6 to 7 actions on web and 7 on phone and removes the mid-call prompt (MB-6 goes from 5 steps to 2). D1 removes the MX-3 variation. D2 removes the agent choice in GS-1, GS-3 and MX-8. None of the decisions changes IF-1, which needs the Inbox layout row (FX-14).

## Redundancy Map

Source: `redundancy.md`. Each item shows the critic's recommendation and what the decisions changed.

### Duplicate paths

- **Granola MCP sign-in and the API key on one page.** Keep both. The key is canonical (it alone gives stored meetings and to-dos); MCP is the only route on the free plan and on a phone. Show one status line, drop the "Live questions" and "Sync" labels. FX-23, FX-24.
- **Two Granola agents once both routes are connected.** Merge. Decided by D2: one agent. FX-5, FX-6.
- **Three things users call "voice"** (Call Elio, Settings Voice, Flow's own hotkey). Keep all three. Call Elio is the only "Voice" feature; the Flow row says "Transcribe only"; no copy about Flow's hotkey. FX-40.
- **Two API key fields on mobile Voice.** Merge. Decided by D3: Flow is a row in the provider list, with its key in the same pane. FX-40, FX-67.
- **Two to-dos for one promise.** Keep both sources. Dedupe on `(userId, normalized text)` for meeting to-dos (FX-18). Linking a mail to-do to a meeting to-do is rejected: no reliable key (FX-39).

### Duplicate information

- **"What I owe" in four places** (Inbox card, agent answer, stored digest, S7 memory). The Inbox card is canonical. S7 is removed by D1. The agent answer stays because it answers a question.
- **Sync health in three places.** The card is canonical. The agent adds "last synced" only when sync is failing. FX-12.
- **Consent state in four places.** Settings, AI data sharing is canonical. Granola consent shows in the Inbox where the action happens (FX-14). Flow consent moves to Connect (D3), so the Inbox voice card goes (FX-65).
- **Two statements about whose data stays.** One wording: reuse "Your data in {name} is not deleted." on Disconnect. FX-32.

### Overlapping features

- **Granola MCP tools versus `meetings_*`.** `meetings_*` is canonical when a key exists; MCP fills in when the store is empty; one citation format. FX-13.
- **Granola versus Flow meetings, and Flow MCP versus `meetings_*`.** Each agent answers from the shared store; the agent name is not a scope; do not merge the agents. Do not ship stored Flow meetings until the real tool names are pinned. FX-47, FX-48.
- **Providers that already transcribe versus a new transcription row.** Merged by D3. One routing rule: a chosen server provider wins on every surface (FX-44).
- **Weekly memory routine (S7) versus the digest and `remember`.** Removed by D1.

### Hierarchy and IA

- **One concept, one name.** "Voice" for calls, "Transcribe only" for the row, no "dictation" in product copy. FX-40.
- **Meeting to-dos on a mail page.** Keep them in the Inbox; the zero-account case needs one layout. FX-14.
- **Meetings have no home.** Keep. The plan excludes a meetings page on purpose. The agent is listed under the same name as the tile.
- **Mobile key card has no home.** A dedicated Granola row on `integrations.tsx` with the key field inline; drop the MCP group from the mobile mockup. FX-30, FX-60.
- **Two "Meeting notes" tiles with no shared level.** No new surface. Rejected as a tile rename because the Flow tile is outside S5 (FX-51); provider shows in the chip hover title (FX-11).

## Simplification Proposals (ranked)

Ordered by (journeys improved x steps or elements removed) / effort, weighted by how central the journey is. The first-week path (IF-1, GS-1, MX-8) counts more than a settings flow.

### 1. Show the To do card first for a user with no mail account
- **Now**: A meeting-only user opens Inbox and sees "No mail connected" and "Connect mail". Web branch `Inbox.tsx:1266` runs before the card and before the consent prompt. Mobile returns early (`inbox.tsx:102`, `:458`). Meeting to-dos have a null `connectionId`, so the query (`inbox.ts:780`) drops them on every tab.
- **Proposed**: In the zero-account branch, show the To do card, and the existing consent prompt when consent is off, above "Connect mail". Return meeting to-dos on every account tab. FX-14, FX-15, FX-56.
- **Saves**: 1 step and one misleading page title on the main path; 4 journeys improved (IF-1, MX-8, GS-1 step 9, MB-3/MB-4). Fixes a hidden failure: to-dos vanish on an account tab.
- **Effort**: S to M (two branches and one query clause).
- **Evidence**: `journeys/STORY-IF-1.md`, `STORY-IF-1-screens/inbox-empty.png`, `inbox-todos.png`; catalog JF-1, JF-2, JF-16.

### 2. Flow as a "Transcribe only" provider row, consent at Connect, shipped with S3a (D3)
- **Now**: A second "Transcription" selector above the Providers list; a global consent re-prompt for every user on an Inbox card; on phone a picker screen and a mid-call alert after audio was already sent; a Flow option visible before it can work.
- **Proposed**: One row in the existing list, one key pane, one Connect with a single consent sentence under it, recorded for that recipient. Users who never choose Flow see nothing. FX-40, FX-42, FX-64 to FX-67.
- **Saves**: 1 control and 1 screen on phone; 3 actions on phone (9 to 7 total); the Inbox card; the mid-call prompt; the WF-8 dead end. 4 journeys improved (WF-6, MB-5, MB-6, WF-8).
- **Effort**: S for the plan; the code is the same size as before.
- **Evidence**: `journeys/WF-6.md`, `WF-6-screens/2-nokey.png`, `5-consent.png`, `8-m-picker.png`, `10-m-blocked.png`; JF-11, JF-12, JF-13.

### 3. Defer the weekly memory routine (D1)
- **Now**: S7 writes up to five bot-memory entries a week from digests that are already stored, with no Memory view, no per-entry delete, a silent toggle, and an exception in the S4 allowlist that opens the only write path from untrusted transcripts to memory.
- **Proposed**: Close #443 as deferred; delete the S4 exception and the "remember a decision" sentence. FX-1 to FX-4, FX-53.
- **Saves**: 1 slice, 1 mockup screen, 1 allowlist exception, 3 gaps; MX-3 goes from convoluted to out of scope.
- **Effort**: S (deletion).
- **Evidence**: `journeys/MX-8.md` (MX-3 variation), `MX-8-screens/granola-routine.png`; JF-8, JF-9, JF-28.

### 4. One Granola agent and one status line on the tile (D2)
- **Now**: Two Granola agents once both routes are connected, with no distinguishing label; a tile with three rows of text and an "Add key" button that duplicates the tile click; two "Disconnect" buttons on one detail page.
- **Proposed**: The key connection attaches to the existing agent. The tile shows one status line and no "Live questions", "Sync", "Business plan" or "Add key". FX-5, FX-23, FX-54.
- **Saves**: 2 decisions (route and agent), about 6 visible strings, 1 click. 4 journeys improved (GS-1, GS-3, MX-8, MX-1).
- **Effort**: S to M (link instead of create; tests for both orders).
- **Evidence**: `journeys/GS-1.md`, `GS-1-screens/1-tile.png`, `2-detail.png`; JF-17.

### 5. After Connect: show "Syncing" and link to the agent
- **Now**: The card jumps to "Synced 42 meetings, 3 minutes ago" and offers only Disconnect. The user reopens the page to check progress and searches the bot list for the agent.
- **Proposed**: The status row reads "Syncing" until the first sync ends; the connected card renders the existing `IntegrationAgentSection` link. FX-27, FX-6, FX-26.
- **Saves**: about 3 actions (steps 5 and 6 and the bot-list search) in 2 journeys (GS-1, MX-8); also the `needs_reconnect` view keeps the sync history.
- **Effort**: S.
- **Evidence**: `journeys/GS-1.md`, `GS-1-screens/3-key-connected.png`; JF-5, JF-6, JF-18.

### 6. A Granola row on the mobile Integrations list with the key field inline
- **Now**: Mobile builds tiles from the server catalog, an unconnected tile has only "Add" (which starts browser OAuth), and the mockup's page has no way in. The journey cannot be completed.
- **Proposed**: A dedicated row, visible without searching, that renders the secure field and Connect directly. The mobile mockup drops the MCP group. FX-30, FX-60.
- **Saves**: Makes a 4-step journey possible; avoids a second sign-in on web. 1 journey (MB-1), plus MB-2 and MB-9.
- **Effort**: M.
- **Evidence**: `journeys/STORY-MB-1.md`, `STORY-MB-1-screens/mobile-empty.png`; JF-3.

### 7. One rejection line with a plan hint on the detail page and a link to the key
- **Now**: "Granola rejected this key" for a typo, an expired key, a wrong scope and a plan without API access; a Pro user retries a key that can never work, and the empty field gives no path to the key.
- **Proposed**: A muted "Business plan" after the key label (detail page only), one link beside the empty field. No branch on 401 versus 403. FX-24, FX-25.
- **Saves**: A repeated dead end for every non-Business user; 4 journeys (GS-2, GS-4, MB-2, MX-8). Adds 2 strings, each to be justified in the PR.
- **Effort**: S.
- **Evidence**: `journeys/MX-8.md` (dead ends 1 and 2), `GS-1-screens/3-key-rejected.png`; JF-4.

### 8. Say which wins on mobile: "This device" or a server transcription provider
- **Now**: `resolveVoiceCallPlan` returns `device` before it reads `voice/status`, and native recognition runs before the recorder, so a Flow choice is ignored or audio goes to Flow for someone who chose on-device only.
- **Proposed**: A chosen server provider wins for listening and turns "This device" off. FX-44.
- **Saves**: Removes an ambiguous pair of settings in 2 journeys (MB-5, MB-6) and a privacy surprise.
- **Effort**: S to M (blocked with S3b).
- **Evidence**: `journeys/WF-6.md` (MB-6 variation); JF-11.

### 9. Fix what the meeting tools return
- **Now**: Chips show title and date only; two chips for one meeting in one answer; a forged `</meeting_notes>` is not escaped; a `message_bot` reply is not wrapped; a summary-only meeting looks like a transcript.
- **Proposed**: Provider, date and link in the tool output, "no transcript" as a literal, escape the closing tag, wrap `message_bot` replies, cite once per meeting. FX-10, FX-11, FX-13.
- **Saves**: 0 steps. It removes 4 gaps in 4 journeys (MX-1, MX-5, MX-7, GS-1) with no new UI.
- **Effort**: S.
- **Evidence**: `journeys/GS-1.md` (agent chat), `MX-8.md` (MX-7 variation); JF-10, JF-21, JF-26, JF-27.

### 10. Delete a stored meeting, and say plainly that Disconnect keeps data (D4)
- **Now**: Disconnect is silent, the existing sentence says "not deleted", and a confidential meeting deleted in Granola stays in Rakazo with its to-do.
- **Proposed**: One owner-only delete for a meeting and its to-dos, reached from the web citation popover, with a tombstone so sync does not bring it back. Disconnect reuses "Your data in {name} is not deleted." FX-7, FX-8, FX-9, FX-32, FX-59.
- **Saves**: Closes the one privacy gap; adds one action and one confirmation for a rare journey (GS-7).
- **Effort**: M.
- **Evidence**: catalog JF-7; `MX-8-screens/granola-disconnect.png`.

### 11. Remove author notes and unplanned copy from the mockups
- **Now**: Design notes render inside frames as visible text in nine walked stories; "Granola is busy. Retrying.", "API access required", "Voice sharing has changed" and "Business plan" are not in the plans.
- **Proposed**: Move notes to comments; delete the unplanned copy unless a PR justifies it. FX-53 to FX-58, FX-64 to FX-68.
- **Saves**: About 10 visible strings that would otherwise be read as product copy.
- **Effort**: S.
- **Evidence**: `docs/ux-walker/meetings-voice/latest-report.md` (systemic issues); JF-33.

## Already Minimal

- **Paste and connect.** One field and one button is the minimum for the key (MB-1: "no simplification found for the paste-and-connect interaction itself").
- **Disconnect with no confirmation dialog.** Correct while stored data is kept. D4 keeps it so.
- **Tick a to-do.** One action, no confirmation; the existing undo-during-fade covers a slip. A done view and a sidebar badge were considered and left out.
- **To do row structure.** Checkbox, text, source line, due label. Nothing to remove except the optional "From:" prefix (FX-22).
- **No meetings page.** Keeping meetings reachable through the agent holds the product small (redundancy H3).
- **No injection warning UI.** The tool allowlist limits the worst case to a wrong sentence; a detector would add copy and be unreliable (MX-7 verdict: acceptable).
- **Call card with Flow transcription.** Unchanged from today by design; only the daily cap line is new.
- **Flow dictation with the system hotkey.** No Rakazo copy about Flow's hotkey.
- **Per-recipient consent toggle in AI data sharing.** The right granularity, already an existing pattern.

No journey is fully minimal; the five critiqued paths are short and the extra cost sits in a few undefined states and surfaces.

## Not verified

Everything is read from plans, mockups and code. Not observed: any running feature, first-sync timing, whether Granola's API distinguishes a plan limit from a bad key, whether Flow's responses distinguish "no API access", per-recipient consent behaviour in `apps/api/src/ai-consent.ts` for a recipient added without a version bump (the consent rows are keyed by recipient, so it looks workable), and any user test.
