# Topic 5: Teammates, permissions and mobile

Sources checked: README decisions 1, 3, 4, 8, Known limits, Phases; mockup.html (states 1-5); built phase 1 code in rakazo-sidebar-pages (`packages/contracts/src/sidebar-pages.ts`, `packages/db/src/sidebar-pages.ts`, `apps/web/src/components/SidebarPages.tsx`); `SpaceMember` model (single `role` string, "owner" or "member") in `packages/db/prisma/schema.prisma`. Mockup search: the strings "This is me", "Link", "approve", "request" do not appear in mockup.html. The only mention of teammate view is the bullet "Each person can see their own view." in the "What this reads" popover.

## STORY-501: Jonah hears his card exists and tries to find it
**Type**: medium
**Topic**: Teammates, permissions and mobile
**Persona**: Jonah Reyes, engineer and plain space member in a 12-person space. His manager Maya Okafor (space owner) mentioned in standup that "Team health" exists.
**Goal**: See what the page says about him.
**Preconditions**: Maya added Team health. Jonah is a `SpaceMember` with role "member". Not yet linked.
**Basis**: README decision 1 and 8; `sidebar-pages.ts:addBlocker` and `listSidebarPages` (ownerOnly templates are not in `addable` for non-owners); mockup state 1 (the "+ Add page" row).
**Ideal path**: 4 steps. Sidebar row visible, open it, "This is me" request, wait for approval.
**Alternate paths**: Ask Maya for the URL `/app/team-health`; ask the agent in chat.
### Steps
1. Jonah opens his sidebar → sees Inbox, Finance etc. No "+ Add page" row, because `addable` is empty for him (owner-only template) and the row is hidden when nothing is addable.
2. Jonah looks for a Team health entry → none. `SidebarPage` rows are per user and space, and only Maya has one.
3. Jonah types `/app/team-health` directly → Undefined. README does not say what the route shows an unlinked member (decision 8 says "Unlinked members get nothing"), and whether a request button appears there.
4. Jonah wants to ask for access → Undefined. Decision 8 and phase 3 name a "This is me" request, but no screen, button, or entry point is specified or mocked.
### Variations
- Jonah asks Maya in person; she can only send him the URL, since no invite/share control exists.
### Edge Cases
- Jonah guesses the URL and gets a generic 404 or blank page: he cannot tell whether the page does not exist or he lacks access.
### Does it make sense?
Broken at step 2-4. Decision 8 promises each person sees their own card, but the only mechanism (sidebar row) is closed to non-owners, and the request flow has no surface. A member can never reach the page. Smallest fix: when a linked (or link-pending) member is known, show them a Team health sidebar row that is not created through "+ Add page" but derived from their approved link; for unlinked members show nothing and give the owner a "Notify teammates" action, or let `/app/team-health` for an unlinked member show one "This is me" button with the matching `TeamMember` candidate.

## STORY-502: Owner approves a "This is me" request
**Type**: medium
**Topic**: Teammates, permissions and mobile
**Persona**: Maya Okafor, space owner, on the Team health page on her laptop.
**Goal**: Let Jonah see his own card.
**Preconditions**: Jonah has sent a "This is me" request (mechanism undefined, see STORY-501). Roster contains a `TeamMember` row for Jonah.
**Basis**: README decision 8, phase 3 ("This is me link request and owner approval"); mockup states 2-5 (no approval UI drawn).
**Ideal path**: 3 steps. Notice request, review who it links to, approve.
**Alternate paths**: Maya links Jonah first without a request (undefined).
### Steps
1. Maya opens Team health → page shows cards, header (Updated time, range chips, Ask agent). No pending-requests indicator exists in the mockup. Undefined.
2. Maya looks for where requests live → Undefined. No inbox item, notification, badge, or roster screen is specified. Decision 4 only mentions "split" and "hide" for roster corrections.
3. Maya approves → Undefined, including whether she sees which `TeamMember` row (name, emails, GitHub login) the requester would be bound to.
4. Wrong match (two "Jonah"s in the roster) → Maya should be able to pick the row or reject; neither is specified.
### Variations
- Maya misses the request for days; Jonah has no state to look at ("Waiting for approval") either.
### Edge Cases
- Approve is the step that exposes health data about a person to an account; a wrong approval shows one employee's signals to another member of the space. No confirmation naming both identities is specified.
### Does it make sense?
Undefined at step 1-3. A permission grant with no designed surface. Smallest fix: one row at the top of the page for the owner, "Jonah R. (jonah@example.com) wants to see their own card. Approve / Decline", showing the linked roster person, plus a notification through the existing inbox.

## STORY-503: Jonah sees his own card
**Type**: long
**Topic**: Teammates, permissions and mobile
**Persona**: Jonah Reyes, linked teammate, after Maya approved.
**Goal**: Read his own signals and add a note.
**Preconditions**: Link approved. Jonah has no Team health agent access.
**Basis**: README decision 8 and 9; mockup state 2 (summary `Take care of Maya and Jonah first. 2 others show rising after-hours work.`, sections "Take care of first", "Workload signals", "Revenue line", "N others"), popover bullet "Each person can see their own view."
**Ideal path**: 3 steps. Open page, read own card, add note.
**Alternate paths**: Table view with one row.
### Steps
1. Jonah opens the page → Undefined layout. The mockup is the owner's page only.
2. If the owner page is reused with rows filtered → the one-line summary still reads "Take care of Maya and Jonah first. 2 others show rising after-hours work." This names Maya and counts others, which is a privacy leak to Jonah.
3. The group filter, "N others · no sustained change" and the section counts also reveal how many other people are in each group → leak.
4. Coverage chips show Slack, Gmail, Calendar, GitHub, Linear (the owner's connections). Jonah sees which of Maya's accounts are connected, and "Gmail (owner mailbox only)" implies Maya's mailbox was read for threads he is on. Undefined whether chips are hidden.
5. Action buttons "Schedule 1:1", "Add second owner for Northwind", "Not an issue", "Done" → on his own card these are manager actions; "Not an issue" would snooze a signal the owner sees (decision 9). Undefined which feedback Jonah may write; decision 8 only allows a note.
6. Jonah adds a note → stored as `TeamHealthFeedback` note. Undefined: whether Maya sees it, whether Jonah is told that she does, and whether it can be edited or removed.
7. Ask agent button → decision 8 says no agent for linked teammates. The header button must be hidden, otherwise a dead control.
### Variations
- Revenue-line text "Sole owner of 9 of 12 threads with Northwind Labs" would name a customer to a teammate who may not otherwise know it.
### Edge Cases
- Jonah has zero signals: the empty text "No one matches these filters." is wrong for him.
### Does it make sense?
Broken at steps 2-3 if the owner page is reused: the summary line and group counts leak other people. Confusing at 4-5: owner-only chrome (Ask agent, coverage chips, manager actions). Smallest fix: a separate teammate layout with a server-built summary ("Your last 12 weeks"), no counts of others, no coverage chips, no Ask agent, and only a "Add a note" control, plus a line saying the owner sees notes.

## STORY-504: Member with unverified email, and teammate who is not a Praci user
**Type**: medium
**Topic**: Teammates, permissions and mobile
**Persona**: Priya Nair signed up with an email that was never verified; Tomas Weber is on the engineering roster (GitHub, Slack) but has no Praci account.
**Goal**: Priya wants to see her card. Tomas is simply measured.
**Preconditions**: Roster from first sync includes both. Deployment allows unverified emails.
**Basis**: README decision 8 ("only from a verified login email (`emailVerified`)"), decision 4 (roster from tool member lists); discovery "Teammates who are not Praci users ... never see the page."
**Ideal path**: 3 steps. Priya verifies email, link is proposed, owner approves.
**Alternate paths**: owner links manually (not specified).
### Steps
1. Priya requests "This is me" with an unverified email → Undefined. Decision 8 says email only proposes the link, but does not say whether an unverified user can still send a request, or what she is told.
2. Priya sees nothing → no message "verify your email first". Undefined.
3. Priya verifies → proposal appears for the owner (consistent with decision 8).
4. Tomas has no account → he is scored and named on Maya's page with no way to know. Nothing in the plan tells him or lets him opt out; the popover disclosure is read only by the owner.
5. Maya cannot add Tomas to the sidebar-visible audience → no path exists, by design.
### Variations
- Priya and Tomas share a work email domain alias; decision 4 says merge only when exactly one candidate matches, so an ambiguous alias leaves two rows. The owner needs the split tool.
### Edge Cases
- An unverified account claiming an address that belongs to a roster person is the impersonation case decision 8 guards against; the guard exists, but the user-facing message does not.
### Does it make sense?
Undefined at step 1-2 and 4. Smallest fix: if `emailVerified` is false, show on the request surface one line "Verify your email to request access" with the existing verify action; and add to the owner's page a roster note, "Tomas Weber is not a Praci user", so the owner can decide to tell him.

## STORY-505: Two owners in one space
**Type**: medium
**Topic**: Teammates, permissions and mobile
**Persona**: Maya Okafor and Dev Patel are both "owner" of the same space; both add Team health.
**Goal**: Each sees the team's health.
**Preconditions**: Dev connects his own Gmail/Calendar; Maya connects hers.
**Basis**: README decision 1 (SidebarPage unique on space + user + template), decision 3 (`ownerUserId` = user who added the page and whose connections were read), decision 4; `SpaceMember.role` is a single string.
**Ideal path**: 3 steps. Add page, sync, read.
**Alternate paths**: Dev never adds the page.
### Steps
1. Dev adds Team health → allowed; sidebar rows are per user (`addSidebarPage` upserts on spaceId+userId+templateKey).
2. Dev's first sync → writes `TeamActivityDay` rows with `ownerUserId = Dev`. Maya's rows are separate, so each owner sees a different Gmail lower bound ("only threads the owner is on").
3. Dev compares notes with Maya in a meeting → their pages show different revenue lines and different "Take care of first" lists, with no explanation.
4. Jonah is linked by Maya. Dev's page has its own roster? Undefined whether `TeamMember` is keyed by space or by space plus owner, so Jonah's link may be per owner, and Jonah may need two approvals or see one card built from Maya's data only.
5. "Not an issue" on Maya's page → Undefined whether it snoozes for Dev.
### Variations
- Dev never connects anything: his page shows the "nothing connected" state while Maya's is full.
### Edge Cases
- Duplicate people in the roster if both owners' syncs write `TeamMember` rows.
### Does it make sense?
Confusing at step 3, Undefined at step 4-5. Each owner's view is internally consistent but the plan does not say so. Smallest fix: state in decision 4 that `TeamMember` and feedback are keyed by space + owner (one dataset per owner), and show "Based on your connections" in the (i) popover.

## STORY-506: Owner is demoted, leaves the space, or has two spaces
**Type**: long
**Topic**: Teammates, permissions and mobile
**Persona**: Maya Okafor, owner of Space A and Space B (same Gmail). Later Dev demotes Maya in Space A, and she also leaves Space B.
**Goal**: Keep data ownership sensible.
**Preconditions**: Team health added in both spaces.
**Basis**: README decision 3 and 8; `sidebar-pages.ts` (owner role checked only when adding or listing addable, `isSpaceOwner`); `SpaceMember` cascade on delete.
**Ideal path**: 3 steps. Demotion removes access immediately; data is purged or handed over.
**Alternate paths**: none found.
### Steps
1. Maya has Space A and B → each has its own `SidebarPage`, `TeamMember`, and `TeamActivityDay` rows, scoped by `spaceId`. Both syncs read the same Gmail mailbox and the same internal-domain people, so Jonah appears in both spaces' rosters if he is in both; if he is in only A, Maya's Space B roster still includes him as an email-domain person. Undefined whether the roster is limited to members of that space.
2. Dev demotes Maya to "member" in Space A → her existing `SidebarPage` row remains. The built code checks owner only on add; reads are not built yet. Decision 8 says the page owner "must have `SpaceMember.role == "owner"`", so each call must check, which is stated only as "checks the subject". The sidebar row would remain and open to an error page. Undefined.
3. Maya's data about Jonah stays in Postgres with `ownerUserId = Maya`; Undefined whether it is deleted, frozen, or reassigned.
4. Maya leaves Space B → `SpaceMember` goes. Undefined: stored `TeamActivityDay`, feedback and links for that space and owner (Disconnecting a source deletes its rows; leaving is not mentioned).
5. A new owner adds Team health → starts from an empty page with 26-week backfill; the old owner's feedback (snoozes, notes) is not visible.
### Variations
- Maya is the only owner and is demoted: space with no owner; page cannot be re-added.
### Edge Cases
- Linked teammates keep read access to their card built from a former owner's connections.
### Does it make sense?
Undefined at steps 2-4. Smallest fix: one rule in decision 8: all reads require current owner role and a live link; on demotion or leaving, delete that owner's rows for the space and hide the sidebar row. Also hide the roster in Space B for people not in that space.

## STORY-507: Teammate asks to see, delete, or opt out of their data (EU team)
**Type**: long
**Topic**: Teammates, permissions and mobile
**Persona**: Lena Fischer, engineer in Berlin, linked teammate. Her works council asks what is stored.
**Goal**: Lena wants her data deleted or to be excluded.
**Preconditions**: Maya syncs data about Lena for 26 weeks.
**Basis**: README Known limits ("EU teams need legal review before enabling; the template stays available"), decision 2 (metadata only), decision 4 (hide a person from the "others" list); research.md section 4 (WP29, consent rarely valid in employment).
**Ideal path**: 3 steps. Lena requests exclusion, owner confirms, rows deleted.
**Alternate paths**: Maya hides Lena.
### Steps
1. Lena opens her card → can read counts and dates (STORY-503 layout).
2. Lena looks for "Delete my data" or "Exclude me" → none specified. Undefined.
3. Lena asks Maya in person; Maya can "hide" her from the "others" list (decision 4) → this hides her row only in one list. It does not stop collection, or delete `TeamActivityDay` rows, and does not remove her from Take care of first or Workload sections if she has signals. Confusing.
4. Maya in the EU turns on the page → template is available; no region warning or acknowledgment is shown. The legal risk is only in a README. Undefined.
5. Lena's right of access and erasure → no export or delete control; the plan has no purge job per person.
### Variations
- Lena is not a Praci user (STORY-504): she has no surface at all.
### Edge Cases
- The (i) popover says "Each person can see their own view", which is not true for non-users and unlinked members.
### Does it make sense?
Undefined at step 2-5; Confusing at step 3 because "hide" reads like opt-out but is cosmetic. Smallest fix: owner action "Exclude Lena" that stops collecting and deletes her rows, labelled differently from "Hide"; and a one-time owner acknowledgment before first sync for deployments flagged EU. Legal text is out of scope of v1 per Known limits.

## STORY-508: Desktop app
**Type**: short
**Topic**: Teammates, permissions and mobile
**Persona**: Maya on the Praci desktop (Electron) app.
**Goal**: Use Team health there as on web.
**Preconditions**: Page added on web.
**Basis**: README Goal ("Web and desktop ship first"); `SIDEBAR_PAGE_TEMPLATES` in `contracts/src/sidebar-pages.ts` (`platforms: ["web"]`, `available: false`); AGENTS.md (Electron hosts web UI).
**Ideal path**: 2 steps. Open app, click row.
**Alternate paths**: none found.
### Steps
1. Maya opens the desktop app → Electron hosts the web UI so the sidebar row is present if the list is served as-is. Built code does not filter by platform anywhere; `platforms` is data only.
2. She clicks Team health → loads `/app/team-health`.
3. "Add page" in desktop → template lists `platforms: ["web"]` and the union allows "desktop". If a future filter honours the field literally, desktop users lose the page.
### Variations
- Native OS notification on desktop: Undefined.
### Edge Cases
- Auto-refresh while window is in background: sync throttle 15 min applies; fine.
### Does it make sense?
Confusing at step 3: the plan says web and desktop, the constant says web only. Smallest fix: set `platforms: ["web", "desktop"]` for `team-health`.

## STORY-509: Owner on the phone
**Type**: medium
**Topic**: Teammates, permissions and mobile
**Persona**: Maya on her iPhone, away from her desk, after hearing "Jonah looked tired".
**Goal**: Check Team health on mobile.
**Preconditions**: Page added on web. Mobile v1 has no templates available.
**Basis**: README Goal and phase 6; decision 1 (mobile filters `sidebarPages.list` to supported templates, none in v1); decision 8 (agent tools check subject).
**Ideal path**: 1 step. Mobile tells her it is web only, or shows the page. Neither exists in v1.
**Alternate paths**: Open in mobile browser; ask the chat agent.
### Steps
1. Maya opens the app → no Team health row; the list is filtered to none. No message explains why. She may think the page was removed.
2. She opens the web app in Safari → the web page may work at phone width (not specified), signed in separately.
3. She asks the chat agent "who is overloaded?" → Team health agent is a reserved spawn key (phase 5); whether the general agent may answer from Team health data is Undefined. If it does, it must apply the same owner check, and it must never answer the same question for Jonah (decision 8: no agent).
4. Notifications: no phone notification exists in the plan ("Not in v1: automatic actions"). Maya must remember to open the page. Undefined.
### Variations
- Jonah on mobile: no row, no request flow (STORY-501).
### Edge Cases
- Maya adds the page on mobile: nothing to add, since `addable` filtered by platform and none is mobile.
### Does it make sense?
Confusing at step 1: silent absence. Undefined at step 3-4. Smallest fix: keep v1 as is, but in the Team health agent's answer or in a single mobile settings line say "Team health is on web and desktop"; confirm in a test that the general agent applies the owner check.

## Topic findings

1. **Broken - teammate page leaks others (STORY-503).** Reusing the owner page for a linked teammate shows the summary "Take care of Maya and Jonah first. 2 others show rising after-hours work.", group counts, "N others", coverage chips, Revenue line customer names. Fix: dedicated teammate layout built server-side with only own data, no counts of others, no chips, no Ask agent.
2. **Broken - a member cannot reach their card (STORY-501).** Sidebar pages are per user and `team-health` is `ownerOnly`, so linked members never get a row; the "popover" promise "Each person can see their own view" cannot be met. Fix: derive the row from an approved link, not from "+ Add page".
3. **Undefined - "This is me" request and owner approval have no UI (STORY-501, 502).** Not in the mockup. Fix: Request button on `/app/team-health` for unlinked members; one approval row for the owner showing the linked roster person, with Approve / Decline and an inbox notification.
4. **Undefined - demotion, leaving, deletion of data (STORY-506).** Fix: every read checks current owner role and live link; on demotion or leaving, delete that owner's rows for the space and hide the row.
5. **Undefined - erasure, opt-out, EU (STORY-507).** "Hide" is cosmetic. Fix: owner action "Exclude {name}" that stops collection and deletes rows; one-time acknowledgment before first sync; non-user teammates (STORY-504) shown with a "not a Praci user" note so the owner can tell them.
6. **Undefined - two owners and two spaces (STORY-505, 506).** Roster and feedback keying is unspecified. Fix: key `TeamMember`, links and feedback by space + owner, limit the roster to people relevant to that space, and say "Based on your connections" in the (i) popover.
7. **Undefined - unverified email (STORY-504).** Fix: one-line "Verify your email to request access".
8. **Confusing - teammate feedback and notes (STORY-503).** "Not an issue" and "Done" on one's own card would change the owner's view; notes visibility unstated. Fix: teammates get only "Add a note", with a line that the owner sees it.
9. **Confusing - desktop platform flag (STORY-508).** `platforms: ["web"]` contradicts "web and desktop ship first". Fix: add "desktop".
10. **Confusing / Undefined - mobile silence (STORY-509).** No row, no explanation, no notification, and unclear whether the chat agent answers Team health questions. Fix: one-line web/desktop-only note; owner check on any agent route.
