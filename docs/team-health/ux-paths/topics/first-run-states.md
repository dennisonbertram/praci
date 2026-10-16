# Topic 2: First run and data states

Sources: README decisions 2, 3, 4, 5, 7; mockup states 2 to 5 (`docs/team-health/mockup.html`); Finance pattern in `docs/finance/README.md`; `apps/web/src/lib/integrations.ts` (`StatusKind`: connected, reconnect, failed, connecting). The mockup has no sync-running, throttled, failed or reconnect state. Anything about those is marked Undefined.

## STORY-201: Owner adds Team health with nothing connected
**Type**: medium
**Topic**: First run and data states
**Persona**: Hana Voss, owner of a 12-person company space, has never connected a work tool to Rakazo.
**Goal**: Add Team health and find out what to do next.
**Preconditions**: Hana is `SpaceMember.role == "owner"`. No Slack, Gmail, Calendar, GitHub or Linear connection.
**Basis**: Mockup state 1 and state 4; README decision 1; Finance empty state ("Connect Mercury", finance README line 21).
**Ideal path**: 4 steps: Add page, choose Team health, Connect tools, authorise one tool.
**Alternate paths**: Open the page, then click the (non-existent in state 4) coverage chips; go to Integrations from the sidebar manually.
### Steps
1. Click "Add page" in the sidebar, choose Team health in "Page templates" → row appears and the page opens at /app/team-health.
2. Read the page → heading "Team health" and the text "Connect Slack, Gmail, Calendar or GitHub to see team health." with a primary "Connect tools" button. No Updated time, refresh, range chips, coverage chips or "What this reads" icon.
3. Click "Connect tools" → Undefined. The mockup does not say whether this opens Integrations (the dashed chips link to `#integrations`) or an inline picker.
4. Authorise GitHub in Integrations → Undefined how Hana returns to Team health, and whether the first sync starts by itself or waits for a click.
### Variations
- Hana opens "What this reads" first: state 4 has no (i) icon, so the metadata-only promise is invisible before she grants access.
- Hana connects only Linear: the empty text does not list Linear, so it is unclear whether Linear alone leaves the page empty.
### Edge Cases
- Hana connects a tool that is not one of the four named (for example Notion): nothing in the plan says what the page shows.
- Hana lands back on /app/team-health via the browser Back button: the page must re-read connections; not defined.
### Does it make sense?
Confusing at step 2, Undefined at steps 3 and 4. The empty text names four tools but "Connect tools" has no stated destination or return. Smallest fix: "Connect tools" opens Integrations filtered to the five Team health sources with a return link to the page (Finance does the same with "Connect Mercury"); show the (i) "What this reads" icon in state 4; add Linear to the sentence or say "any of these".

## STORY-202: Only Gmail connected (owner mailbox only)
**Type**: medium
**Topic**: First run and data states
**Persona**: Tomasz Brandt, owner of a 6-person agency, connects only his Google account.
**Goal**: See whether the page is useful with just email.
**Preconditions**: Gmail connected (owner mailbox only); no Slack, GitHub, Linear.
**Basis**: README Known limits ("Gmail covers only the owner's mailbox... tagged Low confidence"), decisions 4, 6, 7; mockup state 2 coverage chips.
**Ideal path**: 3 steps: connect Gmail, first sync completes, read a Low-confidence page.
**Alternate paths**: Also connect Calendar (same Google login) to get meeting hours.
### Steps
1. Connect Gmail in Integrations and open Team health → page must show something; the mockup has no state for one chip lit and the rest dashed.
2. Wait for the first sync → Undefined (no loading state).
3. Read the roster → people are proposed from internal-domain addresses seen in Tomasz's own threads only. People he never emailed are missing, and nothing says so.
4. Read cards → every signal carries Low confidence per decision 7; mockup table has a Confidence column with "Low"/"Medium" tags. Weekend and after-hours come from email timestamps only.
### Variations
- Tomasz is the only person in most threads: "Sole owner of N of M threads" is true for him but the cards are about teammates; the page may flag nobody or flag the wrong people.
- Calendar connected through the same Google connector: is it one chip or two? The mockup shows separate Gmail and Calendar chips.
### Edge Cases
- Fewer than two internal-domain people found: no roster to compare; not defined.
- Personal Gmail address (no company domain): "internal-domain" cannot be inferred; not defined.
### Does it make sense?
Confusing at steps 3 and 4. The Low tag appears per signal, but the page never says "only your mailbox, so people you did not email are missing". The summary line ("Take care of ... first") would read as authoritative. Smallest fix: when the only source is Gmail, replace the one-line summary with a short coverage note ("Based on your mailbox only") and keep the Low tags; define the minimum roster size below which the page shows a not-enough-data state.

## STORY-203: GitHub and Linear only
**Type**: medium
**Topic**: First run and data states
**Persona**: Mirela Tănase, CTO-owner of a 9-person engineering team with no Slack or Google Workspace.
**Goal**: See review load and open tickets per engineer.
**Preconditions**: GitHub and Linear connected; Slack, Gmail, Calendar not connected.
**Basis**: README decisions 5, 6, 7; mockup state 2 (Jonah's Reviews and "Commits after 10 PM" signals, Theo's "Tickets owned").
**Ideal path**: 3 steps: connect both, sync, read cards with review and ticket signals.
**Alternate paths**: none found.
### Steps
1. Open the page after sync → coverage chips show GitHub and Linear lit; Slack, Gmail, Calendar should be dashed links to Integrations.
2. Read cards → only Reviews, Tickets and late commits can appear. Meetings, Weekend (from Slack) and email revenue-line signals cannot.
3. Look for revenue line → "Share of changes to revenue services" works (repo names matching billing, checkout); email-based "sole owner of threads" does not exist. The summary line still says "Take care of X and Y first".
### Variations
- Time zone: README says defaults come from Slack or Calendar profile, else 9 to 18 in the owner's zone. For an engineer in another zone, "after 10 PM" uses the wrong clock. No profile source exists here.
### Edge Cases
- Someone has a GitHub login but no Linear id and no email: roster merge only by email when exactly one candidate matches; not defined for this case.
- Mockup state 2 draws the dashed chips only for Notion and CRM (state 5 shows Linear, Notion, CRM); README says Notion and CRM are not in v1. A reader may think a CRM can be connected.
### Does it make sense?
Makes sense in flow, Confusing on time zone and chips. Step 1 of Edge Cases: dashed Notion/CRM chips are clickable but cannot work in v1. Smallest fix: remove Notion and CRM dashed chips from v1 (or render them non-interactive "Soon"); show the assumed working hours near the late-work signals when no profile was found.

## STORY-204: First sync is running
**Type**: short
**Topic**: First run and data states
**Persona**: Ibrahim Soto, owner, has just connected Slack and GitHub.
**Goal**: Know whether the page is working or broken.
**Preconditions**: Page added, sources connected, 26-week backfill (decision 3) not finished.
**Basis**: README decision 3 (sync on demand from the page, claim token, backfills 26 weeks); mockup has no sync state.
**Ideal path**: 2 steps: open page, see progress, then the filled page.
**Alternate paths**: Ibrahim leaves and returns; another tab triggers a second sync.
### Steps
1. Open Team health right after connecting → Undefined. Mockup states: 2 (full data), 3 (popover), 4 (nothing connected), 5 (weeks collected). None is "syncing".
2. Wait → Undefined whether the page refreshes itself or needs the refresh icon.
### Variations
- Backfill takes minutes: the "Updated 9:40 AM" label has no value before the first sync finishes.
- Ibrahim presses refresh while the first sync holds the claim token: not defined.
### Edge Cases
- Browser tab closed mid-sync: sync is claimed by the server, so it should continue (backend owns orchestration); the page must show the result on return; not stated.
### Does it make sense?
Undefined at step 1. The only progress-like element is state 5's "Signals need 15 weeks of history. 9 weeks so far.", which Ibrahim may read as a sync-progress bar even though it shows history. Smallest fix: add one syncing state to the mockup (reuse the state 5 bar pattern with copy "Reading your tools", no new chrome) and say whether the page polls.

## STORY-205: Not enough history (state 5)
**Type**: medium
**Topic**: First run and data states
**Persona**: Grace Oduya, owner, connected a new GitHub org whose history starts 9 weeks ago.
**Goal**: Understand why no signals appear and when they will.
**Preconditions**: Sources connected, 9 weeks of data, rule needs 15 (README decision 5).
**Basis**: Mockup state 5; README decision 5; decision 3 (26-week backfill "usually provides it at once").
**Ideal path**: 2 steps: open page, read the bar and wait.
**Alternate paths**: Grace connects a second tool with longer history.
### Steps
1. Open Team health → state 5: "Updated 9:40 AM" with Refresh, coverage chips (Slack, Gmail, Calendar, GitHub lit; dashed Linear, Notion, CRM), text "Signals need 15 weeks of history. 9 weeks so far." and a progress bar with aria-valuenow 9 of 15.
2. Look for people → nothing. No range chips, no Ask agent, no filter. Revenue line rows (which use a 90-day window, not a baseline) are also hidden.
3. Come back 6 weeks later → the bar should reach 15 and the full page appears; refresh is throttled to 15 minutes but data accrues daily; how history is counted is not shown.
### Variations
- Weeks differ per person or per source (new hire, new tool): the bar is one number. Which one is not defined.
- "9 weeks so far" while the backfill is 26 weeks implies the tool only held 9 weeks. The page does not say that, so Grace may think sync is stuck.
### Edge Cases
- Backfill returns 26 weeks for Gmail but 9 for GitHub: does the page show the weakest, the strongest, or per-source history? Undefined.
- Some owners will want revenue-line information immediately; hiding it gives nothing for 6 weeks.
### Does it make sense?
Confusing at steps 2 and the variations. The bar is clear on its own, but the page is empty beyond it and the number's meaning (whole team vs weakest source) is not stated. Smallest fix: define the bar as the shortest history among connected sources that feed signals; keep the Revenue line table visible in this state since it needs no baseline.

## STORY-206: Refresh and the 15-minute throttle
**Type**: short
**Topic**: First run and data states
**Persona**: Leon Achterberg, owner, just fixed a mislabelled Linear ticket and wants the page to update.
**Goal**: Refresh data and see it change.
**Preconditions**: Page populated, last sync 5 minutes ago.
**Basis**: README decision 3 (15-minute throttle, claim token, re-reads last 3 days); mockup "Updated 9:40 AM" + Refresh icon (aria-label "Refresh").
**Ideal path**: 2 steps: click Refresh, see new "Updated" time.
**Alternate paths**: Double-click; click from two tabs.
### Steps
1. Click Refresh within 15 minutes of the last sync → Undefined. Candidates: button disabled, click silently ignored, or a message. The mockup shows only the enabled icon.
2. Click Refresh after 15 minutes → sync runs; "Updated" should change; no running indicator in the mockup.
### Variations
- Throttle is per space and owner (claim token on `TeamHealthSyncState`), so two tabs share it.
### Edge Cases
- Refresh returns nothing new: the time label should still tell Leon whether a sync ran or was skipped; not defined.
- Sync fails (see STORY-208): does a failed attempt consume the 15 minutes?
### Does it make sense?
Undefined at step 1. A silent no-op looks like a broken button. Smallest fix: when throttled, disable Refresh and give it a tooltip/accessible name "Next refresh at 9:55 AM"; show a spinner on the icon while a sync is running.

## STORY-207: Connect a missing source from a dashed chip, then return
**Type**: medium
**Topic**: First run and data states
**Persona**: Naomi Delacroix, owner, has Slack and GitHub and wants Linear tickets included.
**Goal**: Add Linear and see tickets signals appear.
**Preconditions**: State 5 or 2 coverage chips with Linear dashed.
**Basis**: Mockup state 5 `<a class="chip sm dash" href="#integrations">Linear</a>`; README decisions 3, 7.
**Ideal path**: 4 steps: click Linear chip, connect, return, see new data.
**Alternate paths**: Connect from Integrations directly; connect then refresh.
### Steps
1. Click the dashed "Linear" chip → goes to Integrations (mockup anchors `#integrations`).
2. Connect Linear → connection becomes "connected" (existing `StatusKind`).
3. Return to Team health → Undefined whether she is sent back. The chip should now be lit; the 15-minute throttle may block an immediate pull of Linear data.
4. Read cards → Tickets signals appear only after a sync; Linear history may be shorter than 15 weeks.
### Variations
- Connecting Linear adds Linear ids to the roster (decision 4); a mismatch with existing TeamMember rows follows the "exactly one candidate" merge rule. The owner sees no prompt.
### Edge Cases
- Throttle blocks the new source: connecting a source should probably bypass the 15-minute limit once; not defined.
- Authorisation cancelled: chip stays dashed; fine.
### Does it make sense?
Confusing at step 3. Smallest fix: a new connection triggers one sync regardless of the throttle, and the Integrations connect flow returns to /app/team-health when started from a chip.

## STORY-208: Disconnect a source, or the sign-in expires
**Type**: long
**Topic**: First run and data states
**Persona**: Pavel Nowak, owner, removes Slack from Integrations because the workspace is being closed; two weeks later his Google sign-in lapses.
**Goal**: Keep the page truthful after sources go away.
**Preconditions**: Slack, Gmail, GitHub connected and synced.
**Basis**: README decision 3 ("Disconnecting a source deletes its rows"); `integrations.ts` `StatusKind` ("reconnect", "failed"); mockup shows neither case.
**Ideal path**: 3 steps: disconnect, page updates, reconnect later.
**Alternate paths**: Disconnect the last source (returns to state 4).
### Steps
1. Disconnect Slack in Integrations → Slack rows are deleted. Slack chip should go dashed.
2. Open Team health → Undefined. Meetings and weekend signals that came from Slack vanish; some cards may drop from "Take care of first" with no explanation. Confidence tags (for example "Slack only") may change.
3. Disconnect GitHub and Gmail too → nothing connected, so state 4 ("Connect tools") should return. Not stated whether the roster and feedback (Not an issue, Done) are kept.
4. Reconnect Slack later → 26-week backfill reruns; feedback snoozes (8 weeks) may refer to signals that returned.
5. Google sign-in lapses (Gmail shows "reconnect" in Integrations) → Undefined. The page still shows old Gmail-based data with an old "Updated" time; there is no failed or stale marker in the mockup.
### Variations
- Sync fails on a transient error: unclear if a failed attempt shows anywhere.
### Edge Cases
- Disconnecting a source while a sync is writing its rows (claim token): races not defined.
- A person who only appeared via Slack becomes a roster row with no data.
### Does it make sense?
Undefined at steps 2, 3 and 5; Broken in effect at step 5 because stale data looks current. Smallest fix: show a lit chip as an amber "reconnect" chip linking to Integrations when the connection is not "connected", and compare "Updated" time against it; on disconnect, say once on the page "Slack removed. Signals recalculated." only if signals changed; state that roster and feedback are kept.

## STORY-209: "What this reads" popover and range chips
**Type**: short
**Topic**: First run and data states
**Persona**: Esther Quigley, owner, is worried about reading staff messages and tries the 4w chip.
**Goal**: Check what is read and see a short window.
**Preconditions**: Populated page (state 2), 12w selected.
**Basis**: Mockup state 3 (popover) and range group "4w / 12w / 6m"; README decisions 2, 5.
**Ideal path**: 2 steps: open (i), read; choose a range.
**Alternate paths**: Press the (i) button again or navigate away.
### Steps
1. Click the (i) icon "What this reads" → popover lists "Metadata only: timestamps, counts, participants' domains, PR authors and reviewers.", "Never message text.", "Each person is compared with their own 12-week baseline.", "Each person can see their own view." Popover is a dialog; in the mockup it works as a state toggle.
2. Click "4w" → Undefined. Baseline stays 12 weeks and signals need 3+ weeks above it. A 4-week view could show only the last 4 weeks of an unchanged signal, or hide signals older than 4 weeks. Same for "6m" versus the 26-week backfill.
3. Pick "6m" with 20 weeks of history → Undefined whether the page shows the shorter window or an error.
### Variations
- State 5 hides range chips, so the user cannot test them with too little history.
### Edge Cases
- Line "Each person can see their own view" is false until the owner approves a link (decision 8); a reader may think everyone already sees it.
- Range is in the URL (decision 6a lists view, filter, sort, not range).
### Does it make sense?
Popover: Makes sense, except the last line (Confusing: say "after you approve their link"). Range chips: Undefined. Smallest fix: state what the range changes (the trend window shown, not the baseline or signal rule) and drop 4w, since three weeks above baseline is not visible in four; keep 12w and 6m.

## STORY-210: Roster first proposed
**Type**: medium
**Topic**: First run and data states
**Persona**: Rukia Adeyemi, owner of a 14-person space with contractors who use personal email addresses.
**Goal**: Make sure "the team" on the page is the right set of people.
**Preconditions**: First sync completed with Slack, GitHub, Gmail.
**Basis**: README decision 4 (roster proposed by first sync from internal-domain addresses and tool member lists; owner can split a wrong merge or hide a person); mockup state 2 ("8 others · no sustained change" list).
**Ideal path**: 3 steps: open page, check people, hide or correct anyone wrong.
**Alternate paths**: Never review; trust the proposal.
### Steps
1. Open Team health after the first sync → people appear as cards, the Revenue line table and "8 others". No "this is your team" confirmation step in the mockup.
2. Look for a wrong person (a vendor with an internal-domain alias, a contractor missing) → the plan says hide and split exist, but the mockup shows no control for them. Per-card actions are Schedule 1:1, Not an issue, Done; the table "..." shows "Actions for {name}" without listed items.
3. Check a former employee still in Slack → included in the roster; not defined how it is removed.
### Variations
- Two people merged wrongly (same first name, one email match): "Split" is the only fix and has no visible entry.
### Edge Cases
- Contractors on personal domains are treated as external and may appear as a customer contact.
- The owner is on the roster and their own card could be flagged: not defined.
### Does it make sense?
Undefined at steps 1 to 3. The page names individuals by an inferred list that the owner never confirmed. Smallest fix: add one roster review entry (the table row "..." menu with Hide and Split) and, only on the first view, a single line "Showing 14 people from your tools" linking to the list.

## Topic findings

Broken
- STORY-208 step 5 (expired sign-in or failed sync): stale data looks current. Fix: turn a lit chip into a "reconnect" chip when the connection is not "connected", and show a failed/stale marker beside "Updated".

Undefined
- STORY-204: no first-sync or running state. Fix: add a syncing state (reuse the state 5 bar, copy "Reading your tools") and define polling.
- STORY-206: throttled refresh is undefined. Fix: disable Refresh with "Next refresh at HH:MM" and show a spinner while syncing; state whether a failed sync uses the window.
- STORY-209: range chips 4w/12w/6m have no stated effect. Fix: define them as trend window only; drop 4w.
- STORY-210: roster is never confirmed; hide and split have no UI. Fix: add Hide and Split to the table "..." menu plus a one-line first-view note.
- STORY-201: "Connect tools" destination and return path undefined. Fix: open Integrations filtered to the five sources and return to the page.
- STORY-207: return after connecting a chip, and the throttle blocking the new source. Fix: return link plus one unthrottled sync on connect.
- STORY-208 steps 2 to 4: disconnect effects on page, roster and feedback. Fix: say rows are deleted, roster and feedback kept, and show one removal note.
- STORY-202, 205: minimum roster/history for a Gmail-only or short-history page. Fix: define the thresholds and show the not-enough-data state.

Confusing
- STORY-205: history bar meaning (whole team or weakest source) and Revenue line hidden despite no baseline. Fix: define as shortest source history; keep the Revenue line table.
- STORY-202: Gmail-only page reads as authoritative. Fix: show "Based on your mailbox only" in place of the summary.
- STORY-203: dashed Notion and CRM chips look connectable but are not in v1. Fix: remove or mark them as not available; also show the assumed working hours when no profile exists.
- STORY-201: state 4 has no (i) icon and omits Linear in its sentence. Fix: add the icon, include Linear.
- STORY-209: "Each person can see their own view" is not true before link approval. Fix: reword to "after you approve their link".
