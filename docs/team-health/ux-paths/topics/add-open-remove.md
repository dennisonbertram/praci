# Topic 1: Add, open and remove the page (sidebar pages)

Sources: built code on `feat/sidebar-pages` (`SidebarPages.tsx`, `AddSidebarPage.tsx`, `SidebarPageLink.tsx`, `sidebar-page-copy.ts`, `packages/contracts/src/sidebar-pages.ts`, `packages/db/src/sidebar-pages.ts`, `router.ts` `sidebarPages.*`), README decisions 1 and 8 and "Phases", mockup state 1.

Key code facts used below: the "Add page" row renders nothing when `addable` is empty (`AddSidebarPage.tsx:23`); the list is not even requested when no template is `available` (`SidebarPages.tsx:39`), and `team-health` is `available: false` in phase 1 (`sidebar-pages.ts:9`); `addable` excludes pages already added and owner-only pages for non-owners (`db/sidebar-pages.ts:48-51`); a failed `list` is swallowed silently (`SidebarPages.tsx:45`); a failed `add` or `remove` shows an inline `role="alert"` message with `errorText(cause)` (`SidebarPages.tsx:60,108`); removing the open page navigates to `/app` (`SidebarPages.tsx:67-72`); remove only deletes the `SidebarPage` row (`db/sidebar-pages.ts:89`). A space switch that changes the space does a full page load (`Shell.tsx:1670-1672`), so the list reloads per space.

## STORY-001: Owner adds Team health for the first time
**Type**: short
**Topic**: Add, open and remove the page
**Persona**: Maren Okafor, founder and space owner of a 14-person company, has never used Team health.
**Goal**: Put Team health in her sidebar and open it.
**Preconditions**: Maren has `SpaceMember.role == "owner"` in the current space. The `team-health` template is `available` (phase 2+ flag flipped). She has no `SidebarPage` row for it.
**Basis**: `AddSidebarPage.tsx:24-50`; `db/sidebar-pages.ts:37-53`; README decision 1; mockup state 1 (Add page menu open, "Page templates").
**Ideal path**: 3 steps: click "Add page", click "Team health", click the new "Team health" row.
**Alternate paths**: None found (no keyboard shortcut or settings route for adding).
### Steps
1. Sidebar loads; list request returns `addable: ["team-health"]` → a muted "+ Add page" row appears under the Inbox/Finance rows.
2. Click "Add page" → menu opens listing "Team health" with the description "Workload and key people, from your connected tools".
3. Click "Team health" → `sidebarPages.add` runs; the menu closes and a "Team health" row appears with a "Page options" button on hover. The "Add page" row disappears (nothing left to add).
4. Click the "Team health" row → navigates to `/app/team-health`; row shows `aria-current="page"`.
### Variations
- Mockup shows two more disabled entries, "Cap table" and "Hiring pipeline", tagged "Soon". The built menu shows only addable items, so these never appear.
- Keyboard only: the trigger is a button, the menu is a Base UI dropdown, so Enter/arrow keys work (not exercised).
### Edge Cases
- Adding does not navigate. After step 3 the user stays where they were; nothing says the page now exists except the new row.
- The row lands below the other page rows in `position` order (oldest first), not at a chosen place.
- Double-click on the menu item: `add` is an upsert, so no duplicate (`db/sidebar-pages.ts:73-77`).
### Does it make sense?
Verdict: Makes sense, with two small gaps. (a) Step 3 gives no confirmation or navigation, which is acceptable because the new row is the confirmation, but a first-time user who "added" a page may expect to land on it. Smallest fix: navigate to `route` after a successful add (one line, matches the mockup flow where the user reaches state 2). Undefined in the plan, so flagging rather than assuming. (b) Mockup menu shows disabled "Soon" templates and the code does not; the plan says "list of page templates" (Goal) but decision 1 says only `team-health` is available. Decide which is true and align the mockup.

## STORY-002: Owner with the page already added
**Type**: short
**Topic**: Add, open and remove the page
**Persona**: Tomás Reyes, space owner, added Team health last week and returns today.
**Goal**: Open Team health from the sidebar and find nothing extra in the way.
**Preconditions**: A `SidebarPage` row exists for Tomás in this space; no other template is addable.
**Basis**: `AddSidebarPage.tsx:23`; `db/sidebar-pages.ts:50` (already-added keys leave `addable`); mockup state 1.
**Ideal path**: 1 step: click "Team health".
**Alternate paths**: Direct URL `/app/team-health`.
### Steps
1. Open the app → sidebar shows the "Team health" row; no "Add page" row.
2. Click "Team health" → page opens.
### Variations
- Mockup state 1 draws Team health already in the sidebar while the Add page menu still lists "Team health" as selectable. The built code would not show it again. Mockup and code disagree.
### Edge Cases
- While `sidebarPages.list` is in flight, nothing shows (state is null); on a slow connection the row pops in late and shifts the rows below it.
- If `list` fails, the failure is swallowed (`.catch(() => {})`): the user sees no Team health row and no "Add page" row and no message. Looks the same as "not available".
### Does it make sense?
Verdict: Confusing at the edges. Step 1 is fine. The silent `list` failure leaves a user who added the page with no way back to it and no error; "row hidden" is indistinguishable from "load failed". Smallest fix: on list failure, show the same inline alert used for add/remove, or retry once. The mockup/code mismatch (menu still offering an added page) should be fixed in the mockup.

## STORY-003: A non-owner member does not see the page
**Type**: short
**Topic**: Add, open and remove the page
**Persona**: Priya Nair, an engineer who is a `member` in Maren's space, hears Maren mention "Team health" in standup.
**Goal**: Find Team health to look at it.
**Preconditions**: Priya's role is `member`. Template is available and ownerOnly.
**Basis**: `db/sidebar-pages.ts:30-32,48`; `sidebar-pages.ts:10` (`ownerOnly`); README decision 8; discovery roles (unlinked member sees nothing).
**Ideal path**: Not applicable: the correct outcome is that she cannot add it. Shortest observed path: 1 step (look at sidebar, no entry).
**Alternate paths**: Direct URL `/app/team-health`; `sidebarPages.add` called by a hand-written client (server returns `owner_only`).
### Steps
1. Priya opens the sidebar → no "Add page" row (empty `addable`) and no Team health row.
2. Priya types `/app/team-health` in the address bar → undefined in built code (route is not registered; `App.tsx:192` `/app/:botId` would treat "team-health" as a bot id).
### Variations
- A linked teammate (README decision 8, "This is me" approved) is meant to see only her own card. Nothing in the sidebar-pages code gives a linked teammate a row, because `addable` and `pages` are per user and owner-only. The plan never says how a linked teammate reaches her own card.
### Edge Cases
- The server error `owner_only` ("Only the space owner can add this page") is only reachable by a stale client. A user who was demoted from owner after adding the page keeps her `SidebarPage` row (remove/list do not re-check role), so she still sees the row and the page's own server checks must reject her.
### Does it make sense?
Verdict: Undefined. Step 1 is right (nothing is offered, nothing to explain). Step 2 and the demoted-owner case are undefined: the plan does not say what a non-owner sees at the URL (404, redirect to `/app`, empty state) or whether a former owner's row is hidden. Also the linked-teammate entry point is missing from phase 1 (see STORY-008 in topic 5 if present). Smallest fixes: `listSidebarPages` should drop owner-only rows for non-owners; unauthorised URL should redirect to `/app` without confirming the page exists.

## STORY-004: Template not available yet (phase 1 shipped, page not built)
**Type**: short
**Topic**: Add, open and remove the page
**Persona**: Dev Kapoor, space owner, on a deployment that has phase 1 merged but not the page.
**Goal**: Add Team health.
**Preconditions**: `team-health` has `available: false` (`sidebar-pages.ts:9`). Dev may have a leftover `SidebarPage` row from a pre-release build or manual insert.
**Basis**: `SidebarPages.tsx:38-39`; `db/sidebar-pages.ts:29,49`; README Goal (mobile "filters ... to templates it supports, which in v1 is none").
**Ideal path**: Not applicable; expected result is nothing offered.
**Alternate paths**: none found.
### Steps
1. Dev opens the app → no list request is made at all; no "Add page" row, no Team health row.
### Variations
- Mobile: the plan says mobile filters the list to supported templates (none in v1). Mobile code was not found in the checkout (`apps/mobile` has no sidebar-pages references), so mobile behaviour is plan-only.
- If a second template were available, the list would load and `rows` (`SidebarPages.tsx:75`) does not check `available`, so a leftover Team health row would appear and lead to a route that does not exist.
### Edge Cases
- Even with a row, `/app/team-health` is not routed in phase 1; `/app/:botId` catches it (`App.tsx:192`).
### Does it make sense?
Verdict: Makes sense for the shipped state (nothing shown, no dead link). Gap: hiding saved rows when unavailable works only by accident (list is skipped when nothing is available). Smallest fix: filter `rows` by `template.available` and `platforms` so the rule holds when other templates become available; also register the route (or a guard) in the same change that flips `available` so the row never opens a bot-id page.

## STORY-005: Add fails, then succeeds
**Type**: medium
**Topic**: Add, open and remove the page
**Persona**: Ines Duarte, space owner, on hotel Wi-Fi.
**Goal**: Add Team health despite a flaky connection.
**Preconditions**: Owner, template available, not yet added. The `add` request will fail once, then succeed.
**Basis**: `SidebarPages.tsx:52-65,108-112`; `errorText` in `lib/user-error`.
**Ideal path**: 3 steps if the first try works.
**Alternate paths**: Reload the page and retry.
### Steps
1. Click "Add page" → menu opens.
2. Click "Team health" → request fails; menu closes; a red message appears under the page rows (`role="alert"`, text from `errorText`). No "Team health" row. "Add page" row is still there.
3. Click "Add page" again → opening the menu does not clear the message; the old error remains until the next mutation starts.
4. Click "Team health" → `setError("")` runs on start; the request succeeds; the error vanishes and the row appears.
### Variations
- Server returns `unavailable` or `owner_only` (role changed in another tab): the user sees the mapped message from `sidebarPageError` (wording not checked) and "Add page" stays until the next list load; retrying will fail again with the same message.
### Edge Cases
- Add then immediately Remove (quick succession): `latest` counter makes only the newest response apply (`SidebarPages.tsx:35,53`), so the UI follows the last click. The server still processes both in arrival order; if they arrive reversed the screen and database can disagree until the next load.
- The error text is not tied to the failed action ("Team health" is not named); with several templates later it would be unclear which add failed.
### Does it make sense?
Verdict: Makes sense. The failure is visible, the state is not corrupted, and retry works. Minor Confusing point at step 3: the stale error stays while the user retries. Smallest fix: clear the error when the Add page menu opens. Name the page in the error copy once there is more than one template.

## STORY-006: Remove while on the page, and while elsewhere
**Type**: medium
**Topic**: Add, open and remove the page
**Persona**: Jonas Weber, space owner, tried Team health for a week and now wants it gone.
**Goal**: Remove Team health from his sidebar.
**Preconditions**: Page added. Variant A: Jonas is viewing `/app/team-health`. Variant B: he is in a chat.
**Basis**: `SidebarPages.tsx:67-72,92-104`; `SidebarPageLink.tsx`; mockup row label "Team health menu: remove from sidebar"; README gives no data-retention rule for removal.
**Ideal path**: 3 steps: hover row, click "Page options", click "Remove from sidebar".
**Alternate paths**: Keyboard: the "Page options" button becomes visible on focus (`focus-visible:opacity-100`).
### Steps
1. Hover (or focus) the "Team health" row → a "…" button labelled "Page options" appears at the right.
2. Click it → a menu with one item, "Remove from sidebar".
3. Click "Remove from sidebar" → request runs.
4. Variant A (on the page): on success `navigate("/app")`, the row disappears, "Add page" returns. Variant B (elsewhere): the row disappears and "Add page" returns; the current screen is unchanged.
### Variations
- Remove fails: the row stays, inline error shows, and the user stays on the page (redirect only on success).
- Touch screens and web in a narrow window: the "…" is `opacity-0` until hover/focus; there is no hover on touch, so discoverability is poor. Not verified in a browser.
- The mockup's accessible name is "Team health menu: remove from sidebar"; the built name is "Page options". The mockup shows the menu button, but the item text "Remove from sidebar" matches.
### Edge Cases
- Remove is immediate with no confirmation and no undo. Because the page stays cheap to re-add (STORY-007) this is acceptable, but nothing tells the user their synced data was kept.
- Another tab/device still shows the row until reload (no push). Clicking it opens a page the user no longer has; undefined (see STORY-007 for the remove-then-open case).
- Redirect goes to `/app`, not to the previous page, so a user who removes it from a deep link loses their place.
### Does it make sense?
Verdict: Makes sense for the main flow. Two gaps: (a) hidden "…" on touch widths, so removal may be undiscoverable; smallest fix is to keep the button visible at coarse pointers. (b) Whether the "Remove from sidebar" action keeps or deletes Team health data is not stated in the plan (README decision 3 only deletes rows when a source disconnects). The label says "from sidebar", which implies only hiding; plan should say so explicitly.

## STORY-007: Re-add after removal, and what persists
**Type**: medium
**Topic**: Add, open and remove the page
**Persona**: Jonas Weber again, two weeks later, after a bad week with his team.
**Goal**: Bring Team health back and see what he had before.
**Preconditions**: Jonas removed the page (STORY-006). `SidebarPage` row deleted; `TeamActivityDay`, `TeamMember`, `TeamHealthFeedback` rows (phases 2-3) are not touched by `removeSidebarPage`.
**Basis**: `db/sidebar-pages.ts:82-91`; README decisions 3, 4 and 9 (feedback stored, 8-week snooze); mockup state 1.
**Ideal path**: 3 steps: "Add page", "Team health", click row.
**Alternate paths**: none found.
### Steps
1. Click "Add page" → menu lists "Team health" again (it left `addable` only while added).
2. Click "Team health" → row returns at the end of his page list (new position).
3. Click the row → page opens.
### Variations
- Jonas had marked "Not an issue" on a card before removing. The sidebar code does not touch feedback, so snoozes would persist and the card stays hidden until the 8-week snooze ends. Nothing on the page says so.
- If sync did not run in the two weeks away (sync is on demand, README decision 3, 15-minute throttle), the page shows a stale "Updated" time; the first open must trigger a sync. Undefined who triggers it on open.
### Edge Cases
- Remove then re-add changes the row position (appended last), so Team health may move relative to other added pages.
- If another owner (co-owner) in the same space added the page, rows are per user (`spaceId` + `userId`), so Jonas's re-add does not touch the other owner's page. But data ownership is by `ownerUserId` (decision 3): two owners adding the page would each have their own `ownerUserId`'s synced data. Whether data is keyed to the user or the space on re-add is not stated.
### Does it make sense?
Verdict: Undefined. The click path is trivial. The plan does not say what removal means for stored data and feedback, nor whether a removed-then-re-added page resumes from existing data or starts clean. Smallest fix: add one line to README decision 1 or 3: "Removing the sidebar row hides the page only; data and feedback are kept and shown on re-add." If instead removal should purge data (privacy-sensitive: named people, workload signals), say that, and the menu label "Remove from sidebar" would be wrong.

## STORY-008: Same user, two spaces, and other devices
**Type**: long
**Topic**: Add, open and remove the page
**Persona**: Amara Singh owns "Brightline Studio" and is only a `member` of "Harbor Co-op". She uses the web app on her laptop, the desktop app, and the phone.
**Goal**: Have Team health where she is owner and nowhere else, on every device.
**Preconditions**: Amara is owner in Brightline, member in Harbor. Template available and ownerOnly. She starts with no pages.
**Basis**: `db/sidebar-pages.ts:15,43,48` (scoped by `spaceId` + `userId`, role checked per space); `Shell.tsx:1660-1672` (space change reloads); README Goal (web and desktop first, mobile filters to supported templates, none in v1) and decision 8; `sidebar-pages.ts:8` (`platforms: ["web"]`).
**Ideal path**: 4 steps: in Brightline, add the page; switch to Harbor and see nothing; open desktop, see the row; open the phone, see no row.
**Alternate paths**: none found.
### Steps
1. In Brightline on web, click "Add page" then "Team health" → row appears.
2. Switch to Harbor from the space switcher → full page load; sidebar loads Harbor's list: no row, no "Add page" (she is a member there).
3. Switch back to Brightline → row is there (stored per space and user in Postgres).
4. Open the Electron desktop app (same account) → it hosts the web UI, so the row appears after the list loads.
5. Open the mobile app → plan: mobile filters `sidebarPages.list` to templates it supports (none in v1), so no row and no link. Not verifiable in code: no mobile sidebar-pages code exists in the checkout.
### Variations
- Amara is currently on `/app/team-health` in Brightline and switches to Harbor: where she lands is undefined (`Shell.tsx` navigates to a `path` argument; what the space switcher passes for a page route is not stated). If she lands on `/app/team-health` in Harbor, the page must refuse (README decision 8) and the plan does not say how it looks.
- Her role changes to member in Brightline: the row stays (list does not drop owner-only rows) while the page's server checks refuse her.
### Edge Cases
- `platforms: ["web"]` marks the page as web only, but the plan says desktop also ships first. Desktop is the web UI, so it works, but the contract has no `"desktop"` entry; any code that filters on `platforms` by surface would hide it on desktop. Check before relying on it.
- On mobile, Amara has no indication that the page exists. Fine in v1; once phase 6 ships the row appears on mobile only if `platforms` includes mobile.
### Does it make sense?
Verdict: Makes sense for spaces and web/desktop; Undefined for the in-page space switch and the mobile expectation. The per-space and per-user scoping matches the multi-tenant rule in AGENTS.md. Gaps: (1) define where a space switch lands when the current route is a sidebar page the new space doesn't have (smallest fix: go to `/app`); (2) set `platforms` to `["web", "desktop"]` or document that "web" covers desktop; (3) a short, explicit rule that a former owner's row is hidden.

## STORY-009: Quick add and remove, and the discoverability of "Add page"
**Type**: medium
**Topic**: Add, open and remove the page
**Persona**: Leila Haddad, a new owner who just created her space, impatient, clicks around.
**Goal**: Find out whether Team health exists and try it, undoing if it is not for her.
**Preconditions**: Owner, no pages added, template available.
**Basis**: `AddSidebarPage.tsx:23`; `SidebarPages.tsx:34-35,53,76`; `AddSidebarPage.tsx:28-37` (muted-foreground row); mockup state 1.
**Ideal path**: 2 steps: "Add page" then "Team health".
**Alternate paths**: none found.
### Steps
1. Leila looks at the sidebar → a muted "+ Add page" row sits below Inbox, Finance, and any other page rows. It shows only after the list loads.
2. Click "Add page", then "Team health" → row appears.
3. At once she opens "Page options" and clicks "Remove from sidebar" → row disappears, "Add page" returns. Final state matches her last action.
4. Rapid add, remove, add: the `latest` counter applies only the newest response, so the screen settles on the last action; database order follows request arrival.
### Variations
- A brand-new space with Team health already added by default: not planned.
- A user who never opens "Add page" never learns Team health exists. There is no empty-state hint, onboarding step or Integrations link to it.
### Edge Cases
- Once everything is added, "Add page" vanishes. A user who removed the page then looks for how to bring it back may not realise the row reappears automatically; it does reappear, so the case works.
- The row hides while the list loads, so on a slow network the sidebar jumps when it appears (layout shift).
### Does it make sense?
Verdict: Confusing on discoverability, otherwise fine. The hidden-until-addable rule keeps the sidebar clean (matches the "minimal UI" instruction), but the feature is only findable by someone who already scans for "Add page" in muted text. Smallest fix, if discoverability matters: leave as is and surface Team health from the first-run/Integrations screen (topic 2); do not add persistent copy. Reserve the row's height while loading to avoid the jump. Rapid add/remove ordering is acceptable but untested against reversed arrival (see STORY-005).

## Topic findings

Ranked by severity (Broken > Undefined > Confusing). No story found a flow that fails outright in the shipped phase 1 behaviour; the Broken class is limited to future route handling.

1. **Undefined (STORY-004, STORY-003)**: `/app/team-health` is not routed in phase 1, and `App.tsx:192` `/app/:botId` would catch it as a bot id. Fix: register the route (or a guard that redirects to `/app`) in the same change that flips `available: true`.
2. **Undefined (STORY-007)**: Plan does not say whether "Remove from sidebar" keeps or deletes Team health data, feedback and snoozes, nor what re-adding shows. Fix: add one line to README decision 1 or 3 that removal only hides the page and data is kept (or say it purges, and rename the menu item).
3. **Undefined (STORY-003, STORY-008)**: A user who stops being a space owner keeps her `SidebarPage` row and the row still renders; no rule for what she sees on the page. Fix: drop owner-only rows for non-owners in `listSidebarPages`, and redirect refused URL visits to `/app` without confirming the page exists.
4. **Undefined (STORY-008)**: Where a space switch lands when the current route is a sidebar page the new space does not have; also mobile is plan-only (no mobile code found). Fix: space switch from a sidebar-page route goes to `/app`.
5. **Undefined (STORY-003)**: No entry point for a linked teammate to open her own card (sidebar pages are owner-only; decision 8 gives teammates a self view but no way to reach it). Fix: decide the entry (for example, a row offered only to approved-linked members) and add it to the plan.
6. **Undefined (STORY-001)**: After "Add page" > "Team health" the user stays where she was. Fix: navigate to the page after a successful add, or state that staying put is intended.
7. **Confusing (STORY-002)**: A failed `sidebarPages.list` is swallowed, so "failed to load" looks identical to "nothing available" and the user who added the page loses the row silently. Fix: show the inline alert or retry.
8. **Confusing (STORY-004)**: `rows` does not filter by `available` or `platforms`; hiding saved rows works only because the list is not fetched when nothing is available. Fix: filter rows by `available` and the current surface.
9. **Confusing (STORY-001, STORY-002)**: Mockup differs from code: mockup menu lists disabled "Cap table" and "Hiring pipeline" ("Soon") and still offers an already-added Team health; its button label is "Team health menu: remove from sidebar" versus built "Page options". Fix: update the mockup to the built behaviour.
10. **Confusing (STORY-006)**: The "…" "Page options" button is `opacity-0` until hover/focus, so touch and narrow layouts may not reveal it. Fix: keep it visible on coarse pointers (check in a browser; not verified).
11. **Confusing (STORY-008)**: `platforms: ["web"]` omits "desktop" although the plan ships web and desktop together. Fix: list `"desktop"` or document that "web" includes it.
12. **Confusing (STORY-005)**: Stale add/remove error stays visible until the next mutation starts, and the message does not name the page. Fix: clear when the menu opens; name the page once multiple templates exist.
13. **Confusing (STORY-009)**: "+ Add page" is muted text and appears only after load, so Team health is hard to discover and the sidebar shifts when it appears. Fix: reserve the row height while loading; surface the page from first-run/Integrations rather than adding persistent copy.
