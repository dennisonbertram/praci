# Topic: Monitoring sessions and needs-you

Status: the Devin page is PLANNED. Each step is marked [exists] (in code today) or [planned] (mockup only, `docs/devin/mockup.html`). Rakazo is read-only toward Devin: no launch, reply, or stop. Answering a Devin question happens in Devin. Data is invented (org acme; repos acme/web, acme/api, acme/mobile).

Where the same fact appears (relevant to every story below):

| Fact | Surfaces |
|---|---|
| Count of sessions that need the user | Sidebar dot on "Devin" (title "2 need you"), "Needs you" tile, "Needs you" badges in the table, agent chat answer, Rakazo notification |
| Question Devin asked | Gray line under the title of a needs-you row, agent chat answer (the agent's wording may differ from the row text) |
| Open PRs | "PRs open" tile, "Pull request" column, agent answer ("Anything merged today?") |
| Freshness | Header "Updated 1m ago" and per-row "Updated" column (two different clocks) |

---

## STORY-201: Glance at the page and see what needs me

**Type**: short
**Topic**: Monitoring sessions and needs-you
**Persona**: Maya, founder of acme, connected Devin last week
**Goal**: Learn in under 10 seconds whether any Devin session is waiting on her.
**Preconditions**: Devin connected. Two sessions in Needs you, two Working, one Error, one Suspended, two Finished.
**Ideal path**: 2 — click the sidebar "Devin" link, read the first tile and the top rows. The sidebar dot already told her before the click.
**Alternate paths**:
- Read only the sidebar dot ("2 need you") and never open the page.
- Command palette or search: type "Devin" [planned entry in `appPages`], Enter.
- Click the Rakazo notification for a needs-you session [planned], lands on the page.
- Ask the agent "What is Devin stuck on?" from the docked panel (see STORY-205).

### Steps
1. Maya sees the dot next to "Devin" in the sidebar Pages group, between Data room and Artifacts → [exists] pages group and glance dots (`use-sidebar-glance.ts`); [planned] the Devin entry and its dot. She thinks: "Two things need me."
2. Click "Devin" → [planned] page opens at `/app/devin`. Header "Devin", "Updated 1m ago", "Open Devin" icon, "Ask" button. Skeleton first, then the table.
3. Read the tiles: Needs you 2, Working 2, PRs open 3, ACUs this week 41.6 → [planned]. The first tile matches the dot.
4. Scan the Status column: two "Needs you" badges are the top two rows → [planned]. Each shows a one-line question under the title ("Should the export keep the legacy CSV column order?").
5. She decides whether to deal with it now → continues in STORY-203.

### Variations
- Nothing needs her: Needs you tile shows 0 and no badges. GAP: the mockup does not show the zero state of the tile or whether the sidebar dot disappears or shows a number elsewhere.
- She hides the Devin page via the Pages "..." menu [exists, `hiddenPages`]. The dot disappears with the link. GAP: does a hidden page still raise a notification? Not decided.

### Edge Cases
- The dot count and the tile can disagree if they are computed from different fetches. GAP: the design does not say whether both come from one cached result.
- "ACUs" is Devin jargon. Maya hesitates at "ACUs this week" and does not know if 41.6 is good. GAP: no tooltip or definition, and "this week" has no defined window (rolling 7 days vs calendar week; open question 6).

---

## STORY-202: Read the status of every session

**Type**: medium
**Topic**: Monitoring sessions and needs-you
**Persona**: Theo, engineering lead at acme
**Goal**: Understand what each of the 8 sessions is doing and which ones are healthy.
**Preconditions**: The mockup dataset: 2 Needs you, 2 Working, 2 Finished, 1 Error, 1 Suspended.
**Ideal path**: 1 — read the table top to bottom; the Status badge is the only thing he needs.
**Alternate paths**:
- Ask the agent "Which sessions failed?" (Error rows) and read its answer.
- Open each session in Devin to see the real state (slow, defeats the page).
- GAP: no sort or filter control exists on the table in the mockup, so there is no alternate "filter to Error".

### Steps
1. Open the page → [planned] table, newest activity first in the mockup (1m ago, 3m ago, 12m ago... but not strictly: the Needs you rows at 12m and 1h are above the Working rows at 1m and 3m). He notices the order is by status group, then time. GAP: the sort rule is not stated.
2. Read badges: "Needs you", "Working", "Finished", "Error", "Suspended" → [planned]. Colors are monochrome with warning/success/destructive tones.
3. He checks "Migrate billing webhooks to the new queue" with "Error" and "Yesterday" → [planned]. He thinks: "Error from what? Did a deploy break?" The row has no reason text. GAP: Devin's `status_detail` may carry a reason, but the mockup shows none and the status mapping is unverified.
4. He checks "Rewrite onboarding copy" "Suspended", 2d ago → [planned]. He wonders: "Suspended because of a limit, or because nobody replied?" GAP: no explanation of Suspended and no indication whether it is recoverable.
5. He checks "Finished" rows with PRs: "Fix flaky invoice export test" acme/web#418 merged; "Bump Expo SDK" acme/mobile#97 open → [planned]. Finished with an open PR means a human still has to review it; the table does not call that out.

### Variations
- A session Devin marks finished but with a status_detail suggesting it is waiting for approval: the mapping to Needs you vs Finished is unverified. GAP: the design has no rule for ambiguous status/status_detail pairs.
- Status values the mapping does not know (new Devin status): GAP: no fallback badge is defined. Showing a raw string would break the five-badge vocabulary.

### Edge Cases
- Badge text alone carries meaning on small screens; color-blind users rely on the words, which is fine.
- Session with no title: GAP: fallback label not defined (discovery lists this as a state).
- Origin "other", "jira", "teams", "cli" and others do not appear in the mockup's From values (Slack, Linear, Web, API). GAP: mapping from Devin `origin` (webapp, slack, teams, api, linear, jira, automation, cli, desktop, code_scan, other) to the labels shown.

---

## STORY-203: Decide what to do about a needs-you session

**Type**: long
**Topic**: Monitoring sessions and needs-you
**Persona**: Maya, founder, not an engineer; teammate Jorge is the tech lead
**Goal**: Get Devin unblocked on "Add CSV export for invoices" without Rakazo being able to reply.
**Preconditions**: Row says "Needs you", question "Should the export keep the legacy CSV column order?", origin Slack, 12m ago, no PR.
**Ideal path**: 3 — read the question on the row, click the title to open the session in Devin, answer there. The question is on the row, so she does not need the agent.
**Alternate paths**:
- Click "Open in Devin" in the agent's answer instead of the row title.
- Click the header "Open Devin" icon, then find the session in Devin's own list (more steps, no deep link).
- Forward the question to Jorge (copy the question text, send in Slack/email by hand). GAP: there is no "share" or "copy link" control on the row.
- Open the Slack thread where the session started (origin is Slack) and answer there. Rakazo has no link to that thread. GAP: Devin's Slack origin thread link is not in the MCP fields.
- Ignore it. The row stays "Needs you" and the dot stays lit.

### Steps
1. Maya opens the page from the notification [planned notification; notification path exists] → [planned] page, with the top row highlighted by position only. GAP: no row highlight or scroll-to for the session named in the notification.
2. She reads the row: "Add CSV export for invoices", Needs you, "Should the export keep the legacy CSV column order?" → [planned]. She thinks: "I do not know what legacy order means. Jorge would."
3. She hesitates: the page has no reply box. She looks for one and finds only the "Ask" button → [planned]. She learns that asking the agent only explains; it cannot answer Devin. GAP: nothing on the page says "answer this in Devin". The only cue is the missing control. The AGENTS.md copy rule discourages explainer text, so the design needs to decide whether the link label (e.g. "Open in Devin") carries that meaning.
4. She clicks the session title → [planned] opens Devin session in the system browser (Electron: via `app-opener.ts` [exists]). GAP: the session URL shape is unverified (open question 7); the `url` field comes only from the gated `get` call.
5. In Devin she may need to sign in again. She types "Keep the legacy order for now" and sends → happens outside Rakazo.
6. She returns to Rakazo. The row still says Needs you → [planned]. She thinks: "Did it go through?" The header says "Updated 1m ago". She hesitates about whether to wait.
7. After the next refresh the status becomes Working, the tile drops from 2 to 1, and the sidebar dot count changes → [planned]. GAP: refresh cadence is undecided (open question 5), so the delay between answering and the page changing is unknown. She cannot force a refresh in the mockup. GAP: no refresh control.

### Variations
- She does not know the answer. She forwards to Jorge and leaves the row. Next morning it is still Needs you. GAP: no age cue beyond "Updated 12m ago", no reminder or escalation.
- The question needs context (a long thread). The row shows one line. GAP: truncation behavior and whether the full question is readable on the page are not defined; the MCP returns truncated bodies.
- Question text could not be fetched (message read gated or failed): the row shows a title and "Needs you" without a subtitle. This matches the unresolved gate on `devin_session_interact` get_messages (`packages/contracts/src/devin.ts` lines 32-34).

### Edge Cases
- Session answered in Slack, not Devin: status leaves Needs you on the next refresh with no Rakazo-side record.
- Two people open the same session; one answers, the other still sees Needs you until the refresh.
- Devin asks a second question after the first answer: the row returns to Needs you with new text. A "needs you" notification for the same session needs a dedupe key per question, otherwise the second ask could be swallowed by the 24h dedupe (discovery, Data Entities).

---

## STORY-204: Stale data and refresh

**Type**: medium
**Topic**: Monitoring sessions and needs-you
**Persona**: Theo
**Goal**: Know if the page is current before he tells the team "nothing is blocked".
**Preconditions**: Page open in a tab for 45 minutes; the header still reads an old time.
**Ideal path**: 2 — look at "Updated Nm ago"; if old, reload the page. There is no refresh button.
**Alternate paths**:
- Wait for automatic refresh (cadence undecided).
- Switch to another sidebar page and back (remount triggers a fetch, probably).
- Ask the agent "What is Devin stuck on?", which reads Devin live and may contradict the table.
- Open Devin directly.

### Steps
1. Theo returns to the tab and reads "Updated 46m ago" next to the title → [planned]. He thinks: "So Needs you 0 may be old."
2. He looks for a refresh control. None in the mockup → [planned]. GAP: no refresh button, pull-to-refresh, or auto-refresh indicator defined.
3. He reloads the browser tab → [exists] browser reload; [planned] page refetches; header returns to "Updated 1m ago" or "Updated just now". GAP: copy for under one minute is not defined.
4. Counts change: Needs you 0 to 1 → [planned]. The sidebar dot, which updates on its own schedule, may have shown the new count earlier than the page did. Two clocks (header vs sidebar glance) can disagree.

### Variations
- Fetch fails on refresh: previous rows stay with an `ErrorNotice` [pattern exists in `components/finance/ui`]. GAP: does "Updated Nm ago" keep counting up (honest) while the error shows? Not defined.
- The per-row "Updated" column shows Devin's `updated_at` (e.g. "12m ago") while the header shows Rakazo's fetch time. A user may confuse them. GAP: no label explains the difference.
- Agent says one thing, table another: the agent reads live, the table is cached (tool calls in the chat show "Searched Devin sessions"). GAP: no rule for which wins.

### Edge Cases
- Laptop sleeps overnight; the page wakes with stale rows and no automatic refetch.
- Rate limit from Devin on refresh: behavior unknown (discovery: "Rate limit / slow response from Devin: unknown").
- The tool `devin_session_gather` blocks up to 590s and must not be used for page loads (Research); a slow list call must not freeze the page. GAP: loading state for a slow refresh with data already shown.

---

## STORY-205: Ask the agent instead of reading the table

**Type**: short
**Topic**: Monitoring sessions and needs-you
**Persona**: Maya on her phone browser at a narrow width (under 1024px)
**Goal**: Get a plain-language summary of what is blocked.
**Preconditions**: Devin connected; a model configured.
**Ideal path**: 3 — open the page, tap "Ask", type or pick a question. The panel overlays the page below 1280px.
**Alternate paths**:
- Open the Devin agent as a normal bot thread from the bot list [exists] (no page needed).
- Read the table directly (STORY-201).
- Use the dock's open-full-screen button (icon in the panel header, Cap table pattern).

### Steps
1. Tap "Ask" → [planned] panel opens (docked at 1280px and wider, overlay below) [exists as a pattern for Legal and Cap table].
2. Type "What is Devin stuck on?" → [planned] the agent runs "Searched Devin sessions" and "Read Devin messages ×2". Tool disclosure reads "Done · 2 tools · 4s".
3. Answer lists the two sessions with their questions and an "Open in Devin" link each → [planned].
4. She compares the answer to the table: same two sessions, same question text. Match reassures her.
5. She taps "Open in Devin" → leaves Rakazo, same as STORY-203 step 4.

### Variations
- Without a model configured, the panel says "Add a model" instead of suggestions [exists for page agents, `pageAgentNeedsModel`].
- The gate for message reads: if `get_messages` stays a forced write, an approval card appears in the chat each time. GAP: Maya sees an approval card for a read-only question. Open question 1.
- Maya asks "Reply yes to Devin": the agent has no write path (writes off by default, forced-write tools need approval). GAP: what the agent says is not designed. It should point to Devin without apologizing at length.

### Edge Cases
- The agent's wording of a question can differ from the row subtitle. Same information, two phrasings.
- Mobile app: no native Devin screen is planned. GAP: open question 11, the phone behavior for this story is undefined.

---

## STORY-206: Follow the PRs

**Type**: medium
**Topic**: Monitoring sessions and needs-you
**Persona**: Theo
**Goal**: Find which Devin PRs await review.
**Preconditions**: Rows with acme/api#212 open (Needs you), acme/api#215 open (Working), acme/mobile#97 open (Finished), acme/web#418 merged.
**Ideal path**: 2 — read the "Pull request" column and the "PRs open" tile (3), then click the PR link.
**Alternate paths**:
- Go to GitHub's PR list and filter by author (not through Rakazo).
- Ask the agent "Anything merged today?" and click the PR in the answer.
- Open the session in Devin and use its PR link.

### Steps
1. Read tile "PRs open 3" → [planned]. He counts the open PRs in the column: 212, 215, 97, which matches.
2. Click "acme/api#215" → [planned] opens GitHub in the system browser (Electron via `app-opener.ts` [exists]).
3. He notices #212 belongs to a Needs you session: the PR exists but Devin is stuck on migrations. He wants both facts together and finds them in the same row → [planned].
4. He notices #97 is open on a Finished session: Devin considers itself done; review is on him → [planned]. No cue distinguishes Finished-with-open-PR from Finished-and-merged beyond the small "open"/"merged" text.

### Variations
- A session with multiple PRs: Devin returns a `url[state]` list. GAP: the row shows one PR slot; how several PRs display is undefined.
- A PR was closed without merging: states other than open and merged. GAP: only "open" and "merged" appear in the mockup.
- PR for a repo other than acme/web, acme/api, acme/mobile: repo is inferred from the PR URL only; no repo field exists (Research). GAP: sessions without PRs show "—" and no repo at all, so a user cannot tell which repo a Working session touches.

### Edge Cases
- "PRs open" counts only what the fetched page includes. With over 100 sessions the tile can undercount (open question 6).
- A PR merged after the last refresh still shows "open" until the next fetch.

---

## STORY-207: Many sessions and a long list

**Type**: long
**Topic**: Monitoring sessions and needs-you
**Persona**: Priya, CTO at a bigger acme, 140 sessions in the last month, 7 Needs you
**Goal**: Find the sessions that need her without scrolling past hundreds of old ones.
**Preconditions**: Devin returns up to 100 sessions per call with a cursor; no status filter in the search tool.
**Ideal path**: 2 — rely on the Needs you rows being grouped at the top and read the tile. GAP: this depends on a sort rule that is not specified.
**Alternate paths**:
- Ask the agent "List everything that needs me" (agent can page).
- Scroll the table and read badges.
- Use Devin's own list.
- GAP: no search, filter, or "load more" control in the mockup, so there is no on-page way to narrow.

### Steps
1. Open the page → [planned] first request fetches the newest 100 sessions only. Tiles are computed from them. Priya sees "Needs you 7".
2. She scrolls. The table is long; the header does not stay in view in the mockup → [planned]. GAP: sticky header and pagination or virtualization are undefined.
3. A session needing her started 5 weeks ago and sits beyond the first 100 → it appears in neither the table nor the tile. She thinks the page is complete. GAP: no "showing 100 of N" signal; discovery lists "Truncated or over-100 session list" as a needed state.
4. She asks the agent, which searches again with a different filter and finds the old session → [planned]. The agent knows more than the page. Mismatch between tile (7) and agent (8).

### Variations
- Needs-you detection by `tags` or `origins` filters, which exist in the search tool, is an option for the backend. GAP: not part of the page design.
- ACUs this week across 140 sessions: sessions that began last week and consumed ACUs this week may be miscounted if the tile sums `acus_consumed` of the whole session.
- Dozens of Finished sessions bury Working ones if sorted purely by time. GAP: sort rule.

### Edge Cases
- Cursor expires between pages.
- Very long titles: fixed column widths (31% for Session) truncate or wrap; the mockup tests only short titles.
- Narrow widths (1024-1279px, below 1024px): 6 columns and 4 tiles need a collapsed list layout (Legal pattern `@container`).

---

## STORY-208: Teammate sessions and "who started this"

**Type**: medium
**Topic**: Monitoring sessions and needs-you
**Persona**: Maya (connector); Jorge and Amara are teammates who start Devin sessions in Slack and Linear
**Goal**: Know whether a Needs you row is her responsibility or Jorge's.
**Preconditions**: Org-scoped key, so the page lists every org session. The `user_id` returned by Devin is opaque, with no name or email.
**Ideal path**: 3 — read the "From" column (Slack, Linear), then ask Jorge in person. The page cannot name him.
**Alternate paths**:
- Open the session in Devin, which shows who started it (outside Rakazo, if Devin shows it).
- Ask the agent "Whose session is Prisma upgrade?". The agent only has the opaque id. GAP: no way to resolve it.
- Teammate connects their own key and sees the same org list [per user connection].

### Steps
1. Maya sees "Upgrade Prisma to 6.x", Needs you, From "Linear" → [planned]. She hesitates: "Did I start this? The question is for whoever owns the migrations."
2. The "From" column says where it started, not who → [planned]. She thinks of Jorge from context ("Linear, probably Jorge").
3. She opens the session in Devin and sees the real owner there → outside Rakazo.
4. She pings Jorge → outside Rakazo.

### Variations
- A teammate who does not have a Devin connection: sees "Not connected" with "Connect Devin" (per-user connection [exists in code: `McpServer` scoped to space and user]). Their page does not show the Needs you rows, and they receive no notification.
- Maya is the only connector, so only Maya gets the "needs you" notification, even for sessions started by Jorge. GAP: open question 5 (who is notified).
- Privacy: a session title like "Fire the contractor" is visible to every connector in the org. GAP: open question 3 (scope label or filter).

### Edge Cases
- Automation or code_scan origins have no human behind them; "From" would show an unmapped value. GAP: label for those origins.
- A teammate leaves acme; their sessions still appear with an id no one recognizes.

---

## STORY-209: Sidebar dot and notification stay in step with the table

**Type**: short
**Topic**: Monitoring sessions and needs-you
**Persona**: Maya
**Goal**: Trust that the dot means something, and that it clears once she has answered.
**Preconditions**: Two sessions Needs you; she answers one in Devin.
**Ideal path**: 2 — answer in Devin, return, see the dot and tile drop to 1.
**Alternate paths**:
- Open the notification and dismiss it without answering (dot stays).
- Mark the notification read from the notifications list [exists]; the Devin dot stays lit because it counts sessions, not notifications. GAP: the design does not say if the dot counts sessions or unseen notifications. The existing glance dots count unseen notifications by surface (`surfaceOfPath` regex), which would clear on viewing even when the session still needs her.

### Steps
1. A session turns Needs you → [planned] notification with link to `/app/devin` and a dot on "Devin" [exists as a mechanism; needs the Devin surface entry in `defaultNotificationSurface` and `surfaceOfPath`].
2. She opens the page → [planned]. If the dot counts unseen notifications, it clears on open although the session still waits. Opening the page and leaving makes her think she handled it.
3. She answers one in Devin and returns → [planned] after refresh, tile 1, badge gone for that row.
4. The second session stays Needs you. The dot (if tied to sessions) stays lit with "1 needs you".

### Variations
- The same session asks a second question: new notification only if the dedupe key includes the question.
- Mobile: the push arrives but the link target is undefined (open question 11).

### Edge Cases
- Notification for a session that is already Working again by the time she taps it: page shows no Needs you row. GAP: the notification has no "already answered" state.
