# UX path catalog: Team health

Generated: 2026-10-16

- Total stories: 50 (IDs 001-009, 201-210, 301-312, 401-410, 501-509)
- Coverage: 16 of 16 feature areas from `discovery.md` have at least one story. Gaps inside areas are listed in the matrix.
- Verdicts: 7 Makes sense, 21 Confusing, 14 Undefined, 8 Broken.
- Sources: `discovery.md`, the five files in `topics/`, `../README.md` (decisions 1-10), `../mockup.html`. Phase 1 code (sidebar pages) is on `feat/sidebar-pages`; phases 2-6 exist only as plan and mockup.

## Summary

| Type | Count | Story IDs |
|---|---|---|
| Short | 16 | 001-004, 204, 206, 209, 302, 303, 304, 308, 309, 310, 404, 410, 508 |
| Medium | 28 | 005, 006, 007, 009, 201, 202, 203, 205, 207, 210, 301, 305, 306, 307, 312, 401-403, 405-409, 501, 502, 504, 505, 509 |
| Long | 6 | 008, 208, 311, 503, 506, 507 |

## Coverage matrix

| Feature area (discovery.md) | Stories | Gaps |
|---|---|---|
| Sidebar page: Add row and template menu | 001, 002, 009 | No keyboard or settings route to add; mockup menu differs from built menu |
| Sidebar page: row, remove, redirect, errors | 002, 005, 006, 007, 008 | "Page options" button on touch not checked in a browser |
| Availability, owner-only, platforms | 003, 004, 008, 508 | Non-owner URL handling undefined; `platforms` omits desktop |
| Header: Updated, Refresh, throttle | 204, 206, 207 | Failed sync and the throttle window not defined |
| Header: range chips | 209, 309 | No story covers range with a 40-person team |
| Coverage chips and Integrations | 201, 202, 203, 207, 208 | Notion and CRM chips; Slack-only case not walked |
| "What this reads" popover | 209, 302 | None beyond wording |
| Summary line | 301, 311, 503 | Generated-summary rules not defined |
| Toolbar: filter, sort, view toggle | 306, 307, 308 | URL state sharing not walked |
| Cards view and sections | 301, 302, 303, 304, 310, 312 | Revenue line section for revenue-only people |
| Table view and evidence rows | 305, 306, 311 | Column set at 40 people |
| States 4 and 5 (nothing connected, not enough history) | 201, 205, 210 | Minimum roster thresholds |
| Per-card actions via agent | 401, 402, 403, 404, 408, 410 | Rejected or expired approval; Revenue line "Add second owner" |
| Not an issue / Done | 405, 406 | Restore after snooze ends |
| Not revenue / note / roster hide and split | 407, 409, 210, 507 | No UI exists to walk; stories describe the missing control |
| Teammate self-view, permissions, spaces, mobile, desktop | 501-509 | Real teammate who is not a Rakazo user cannot be walked; mobile page is plan-only |

## Dependency graph

```
001 add page
 ├─ 002 already added -> 005 add fails -> 006 remove -> 007 re-add -> 008 two spaces / devices
 ├─ 003 non-owner never offered   004 template not available yet   009 discoverability
 └─ 201 first run, nothing connected
     ├─ 207 connect a chip -> 204 first sync running -> 205 not enough history
     │                                              └─> 202 / 203 partial coverage -> 304 confidence tags
     ├─ 206 refresh throttle     208 disconnect / expired sign-in
     ├─ 209 What this reads + range -> 309 range
     └─ 210 roster proposed -> 409 hide / split -> 507 erasure and opt-out
         └─ reading: 301 summary -> 302 why first -> 303 sparkline -> 305 evidence
              ├─ 306 cards/table -> 307 filter -> 308 empty result -> 310 others -> 311 40 people
              └─ 312 same fact on four surfaces
                  └─ acting: 401/402/403/404 actions via agent -> 408 Ask agent -> 410 phone
                       ├─ 405 Not an issue -> 406 Done
                       └─ 407 Not revenue / note
owner link approval: 501 teammate finds card -> 502 owner approves -> 503 teammate self-view
                      └─ 504 unverified email / non-user    505 two owners    506 demotion, leaving
                      └─ 508 desktop    509 owner on phone
```

## All stories

Format: ID, title, type, verdict.

### Add, open and remove the page ([topics/add-open-remove.md](topics/add-open-remove.md))
- 001 Owner adds Team health for the first time. short. Makes sense
- 002 Owner with the page already added. short. Confusing
- 003 A non-owner member does not see the page. short. Undefined
- 004 Template not available yet (phase 1 shipped, page not built). short. Makes sense
- 005 Add fails, then succeeds. medium. Makes sense
- 006 Remove while on the page, and while elsewhere. medium. Makes sense
- 007 Re-add after removal, and what persists. medium. Undefined
- 008 Same user, two spaces, and other devices. long. Undefined
- 009 Quick add and remove, and the discoverability of "Add page". medium. Confusing

### First run and data states ([topics/first-run-states.md](topics/first-run-states.md))
- 201 Owner adds Team health with nothing connected. medium. Confusing
- 202 Only Gmail connected (owner mailbox only). medium. Confusing
- 203 GitHub and Linear only. medium. Confusing
- 204 First sync is running. short. Undefined
- 205 Not enough history (state 5). medium. Confusing
- 206 Refresh and the 15-minute throttle. short. Undefined
- 207 Connect a missing source from a dashed chip, then return. medium. Confusing
- 208 Disconnect a source, or the sign-in expires. long. Broken
- 209 "What this reads" popover and range chips. short. Undefined
- 210 Roster first proposed. medium. Undefined

### Reading and triage ([topics/reading-triage.md](topics/reading-triage.md))
- 301 Monday-morning read of the summary and the first cards. medium. Confusing
- 302 Why is Maya "Take care of first"? short. Makes sense
- 303 Reading a sparkline and its baseline band. short. Broken
- 304 Confidence tags for a non-expert. short. Confusing
- 305 Opening evidence on a card and in the table. medium. Broken
- 306 Switch Cards to Table and keep filter and sort. medium. Confusing
- 307 Filter by Signal and Source. medium. Confusing
- 308 Empty filter result and Clear, and filtering to "No change". short. Confusing
- 309 Range 4w, 12w, 6m. short. Undefined
- 310 Expanding "8 others, no sustained change". short. Makes sense
- 311 A 40-person team. long. Confusing
- 312 Spotting the same fact on four surfaces. medium. Confusing

### Acting on signals ([topics/acting-on-signals.md](topics/acting-on-signals.md))
- 401 Schedule 1:1 with Maya. medium. Confusing
- 402 Move 4 reviews from Jonah to Sam. medium. Confusing
- 403 Add backup for Sam on checkout-api. medium. Undefined
- 404 Block focus time Thursday for Priya. short. Confusing
- 405 Not an issue, then change of mind. medium. Broken
- 406 Done on a sustained signal. medium. Confusing
- 407 Disagree with the data: Not revenue and "Wrong, I know why". medium. Broken
- 408 Ask agent "Who covers Jonah if he's out next week?" medium. Makes sense
- 409 Fix the roster: hide a person or split a wrong merge. medium. Broken
- 410 Acting from a phone. short. Undefined

### Teammates, permissions and mobile ([topics/teammates-permissions-mobile.md](topics/teammates-permissions-mobile.md))
- 501 Jonah hears his card exists and tries to find it. medium. Broken
- 502 Owner approves a "This is me" request. medium. Undefined
- 503 Jonah sees his own card. long. Broken
- 504 Member with unverified email, and teammate who is not a Rakazo user. medium. Undefined
- 505 Two owners in one space. medium. Confusing
- 506 Owner is demoted, leaves the space, or has two spaces. long. Undefined
- 507 Teammate asks to see, delete, or opt out of their data (EU team). long. Undefined
- 508 Desktop app. short. Confusing
- 509 Owner on the phone. medium. Confusing

## Redundancy candidates

Duplicate paths
- Two ways to ask the agent for the same action: a card button (drafted request) and the header "Ask agent" (401, 408). Keep both; the button is a shortcut. No change.
- Two ways to sort in Table: Sort menu and column headers (306). Fine.
- Two Clear buttons in the empty filter state (308). Keep the one in the message.
- Add second owner (Revenue line) and Add backup (Workload) are the same action kind (403). Define once.
- Connect a source: dashed chip and Integrations sidebar (207). Same destination; fine.

Duplicate information
- Who is "first" is stated by the summary, the "Take care of first" heading and the Group column (302, 312). The summary adds only the count of others.
- The same eight people appear in the "8 others" list and as "No change" rows in Table (310, 311).
- Revenue line appears as a card block, a section, a Table column, a Group tag and a filter value (312). One word, five roles.
- Source coverage is shown three ways: coverage chips, confidence reasons and the Source filter (304, 307).
- Confidence is per signal on cards and per person in Table, with different values (304, 312).
- "12-week baseline" is in the popover and the aria-label of every sparkline (303).
- "Changed 2 wk ago" and "over 6 weeks" sit under one word (312).
- "Done" and "Not an issue" are two buttons for one owner outcome (405, 406).

Overlapping features
- Filter by Group and the card sections do the same job in Cards; Sort by Group is redundant in Cards (306).
- Hide (cosmetic) and Exclude (stop collecting) both remove a person (409, 507).
- Range chips overlap with the fixed 12-week baseline wording (209, 309).

## Findings

Ordered by severity (Broken, Undefined, Confusing), then by number of stories affected. "Changes" says what has to be edited: mockup, plan (README decision), or phase 1 code (`feat/sidebar-pages`).

### Broken

1. **A linked teammate has no way to open their own card.** Sidebar pages are per user and `team-health` is owner-only, so no row is ever shown to a member; decision 8 promises a self view that cannot be reached.
   - Stories: 501, 503, 003, 502, 209
   - Where: README decisions 1 and 8; `db/sidebar-pages.ts:48-51`; mockup popover line "Each person can see their own view" (`mockup.html:241`).
   - Smallest fix: show a "Team health" row to a member whose link has been approved (derive it from the link, not from "+ Add page"). Until then, change the popover to "Each person can see their own view once you approve their link".
   - Changes: plan (decision 1/8), mockup (popover wording), phase 1 code later (list query).

2. **Reusing the owner page for a teammate leaks other people.** The summary ("Take care of Maya and Jonah first. 2 others..."), group counts, "N others", coverage chips and Revenue line customer names would all reach a teammate.
   - Stories: 503, 501
   - Where: README decision 8; mockup summary and sections.
   - Smallest fix: a separate teammate layout built on the server from their own data only: no counts of others, no chips, no Ask agent. Teammates get only "Add a note", with a line that the owner sees it.
   - Changes: plan (decision 8), phase 4 code.

3. **Roster correction has no UI.** Decision 4 promises hide and split, and the first-run roster is never confirmed, so a wrong merge produces wrong named-person signals with no remedy.
   - Stories: 409, 210, 310, 507
   - Where: README decision 4; mockup (no control in Table or "others").
   - Smallest fix: a "..." menu on Table rows and on names in "others" with Hide and Split, a "Hidden (N)" line to restore, and a one-line first-view note ("Roster proposed from your tools. Review.").
   - Changes: mockup, plan (one line in decision 4).

4. **"Not an issue" cannot be undone and snoozed items cannot be seen.** An 8-week hide of a wellbeing signal looks permanent.
   - Stories: 405, 406
   - Where: README decision 9; mockup card buttons.
   - Smallest fix: an "Undo" toast and a "Snoozed (N)" list with Restore. Snooze applies per signal key.
   - Changes: mockup, plan (decision 9).

5. **"Not revenue" and "Wrong, I know why" have no control.** Decisions 6 and 9 promise them; the mockup has no menu on Revenue line rows or cards.
   - Stories: 407, 403
   - Where: README decisions 6 and 9; mockup Revenue line table and cards.
   - Smallest fix: a "..." menu on Revenue line rows and cards with "Not revenue" and "Add note"; state whether notes are shown to the person. Also add "Not an issue" to Revenue line rows.
   - Changes: mockup, plan (decision 9).

6. **Stale data looks current after a disconnect or an expired sign-in.** A lit chip stays lit and "Updated" keeps its time.
   - Stories: 208, 207
   - Where: mockup coverage chips and "Updated" header; README decision 3 (disconnect deletes rows).
   - Smallest fix: when a connection is not "connected", show the chip amber with "Reconnect" linking to Integrations, and a "Sync failed" marker beside "Updated". State that roster and feedback are kept when rows are deleted.
   - Changes: mockup, plan (decision 3).

7. **Weekend sparkline band covers the full chart height**, so the chart says "normal" while the text says "4 of 6, baseline 1 in 6".
   - Stories: 303
   - Where: mockup weekend sparkline.
   - Smallest fix: draw the band from the baseline rate and add a "usual range" tooltip.
   - Changes: mockup, phase 4 component.

8. **Evidence is missing for some people.** Jonah has none in Table; Priya and Theo have none anywhere, though the plan promises evidence per signal.
   - Stories: 305
   - Where: mockup data arrays; README decision 5.
   - Smallest fix: add evidence for every person with a signal and show the expand chevron for all; keep open rows across re-render.
   - Changes: mockup.

### Undefined

9. **Range chips (4w / 12w / 6m) have no stated effect.** The baseline is fixed at 12 weeks and the signal rule needs 15 weeks.
   - Stories: 309, 209, 303
   - Where: mockup `mockup.html:232`; README decisions 5 and 6a (range not mentioned).
   - Smallest fix: define the range as the sparkline and evidence window only, keep it in URL state, and drop 4w (shorter than the 3-week signal window). If not worth defining, remove the chips.
   - Changes: plan (decision 6a), mockup.

10. **The "This is me" request and owner approval have no surface.**
    - Stories: 501, 502, 504
    - Where: README decision 8; mockup.
    - Smallest fix: a "Request my card" button for unlinked members; one approval row at the top of the owner page ("Jonah R. wants to see their card" with Approve and Decline) and an inbox notification. If the login email is unverified, show "Verify your email to request access".
    - Changes: mockup, plan (decision 8).

11. **No result is shown after an approved action, and what some actions do is not defined.** The card looks identical after a 1:1 is booked, so the owner may book twice. "Add backup" and "Add second owner" have no stated effect. Panel placement and approval content are unstated.
    - Stories: 401, 402, 403, 404, 410
    - Where: README decision 10; mockup card buttons.
    - Smallest fix: after approval, replace the button with a line such as "1:1 booked Thu 2 PM". Define "Add backup" and "Add second owner" as a draft message to the owner, with no repo or CRM write. Use a neutral invite title ("1:1 Ines / Maya"). State that card actions open the agent side panel (as Ask agent does) and show full content before approval; approvals appear in the mobile approval list.
    - Changes: plan (decision 10), mockup.

12. **First sync, refresh throttle, connect-and-return and minimum data are undefined.**
    - Stories: 204, 206, 207, 201, 202, 205
    - Where: README decision 3 (15-minute throttle); mockup states 4 and 5.
    - Smallest fix: a syncing state reusing the state 5 bar ("Reading your tools"); when throttled, disable Refresh with "Next refresh at HH:MM"; "Connect tools" opens Integrations filtered to the five sources and returns to the page; a new connection triggers one sync regardless of the throttle; define the minimum roster and history for a Gmail-only page. State 5 shows the shortest source history.
    - Changes: plan (decision 3 and 5), mockup.

13. **Roles over time: demotion, leaving, two owners, two spaces.** A user who stops being owner keeps a row that still renders; TeamMember, links and feedback keying is unspecified.
    - Stories: 506, 505, 003, 008
    - Where: README decisions 3, 4, 8; `db/sidebar-pages.ts` (`listSidebarPages`).
    - Smallest fix: key `TeamMember`, links and feedback by space and owner. Every read checks current owner role and a live link. On demotion or leaving, delete that owner's rows for the space and hide the row; in phase 1 code, drop owner-only rows for non-owners in `listSidebarPages`.
    - Changes: plan (decisions 4, 8), phase 1 code (small).

14. **Erasure, opt-out and non-user teammates.** "Hide" is cosmetic, so a teammate cannot be removed from collection; non-Rakazo people cannot be told apart.
    - Stories: 507, 504, 409
    - Where: README decision 4 and Known limits (EU).
    - Smallest fix: owner action "Exclude {name}" that stops collection and deletes their rows; a one-time acknowledgment before the first sync; a "not a Rakazo user" note on those rows. Full EU legal review stays out of scope.
    - Changes: plan.

15. **What "Remove from sidebar" does to stored data.** Not stated whether data, feedback and snoozes are kept, or what re-add shows.
    - Stories: 007, 208
    - Where: README decisions 1 and 3; `db/sidebar-pages.ts:89` (removes only the row).
    - Smallest fix: one line in decision 1: removal only hides the page and data is kept. Keep the current label.
    - Changes: plan.

16. **Routing and landing in phase 1 code.** `/app/team-health` is not routed and `/app/:botId` would catch it; a space switch from a sidebar-page route has no defined landing; a refused visit has no defined result.
    - Stories: 004, 003, 008, 002
    - Where: `App.tsx:192`; `Shell.tsx:1670-1672`.
    - Smallest fix: register the route (or a guard that redirects to `/app`) in the same change that flips `available: true`. A space switch from a sidebar-page route goes to `/app`. A refused visit redirects to `/app` without confirming the page exists.
    - Changes: phase 1 code (before flipping the flag).

17. **After "Add page" > "Team health" the user stays where they were.**
    - Stories: 001, 009
    - Where: `AddSidebarPage.tsx:24-50`.
    - Smallest fix: navigate to the page after a successful add.
    - Changes: phase 1 code.

18. **Mobile gives no sign the page exists.** No row, no note, and unclear whether the chat agent answers Team health questions.
    - Stories: 509, 410
    - Where: README phase 6; `sidebar-pages.ts` platforms.
    - Smallest fix: keep v1 as is; add one line "Team health is on web and desktop" where the agent declines, and require an owner check on any agent route.
    - Changes: plan.

### Confusing

19. **The summary is hard-coded and partly wrong.** "2 others show rising after-hours work" does not match Priya; it omits revenue-only people and the reason for Maya and Jonah.
    - Stories: 301, 311, 302, 503
    - Where: mockup summary line.
    - Smallest fix: generate it from data, name the reason in three words, cap at three names.
    - Changes: mockup, phase 4 code.

20. **`platforms: ["web"]` contradicts "web and desktop ship first".** README decision 1 also says "on web"; Electron hosts the web UI.
    - Stories: 508, 008
    - Where: `packages/contracts/src/sidebar-pages.ts:8`; README decision 1.
    - Smallest fix: set `platforms: ["web", "desktop"]` (or document that "web" includes desktop) and reword decision 1.
    - Changes: phase 1 code, plan.

21. **A failed `sidebarPages.list` is silent**, so "failed to load" looks the same as "nothing available"; a user who added the page loses the row with no error. Related: `rows` is not filtered by `available` or platform, and hiding works only because the list is skipped.
    - Stories: 002, 004
    - Where: `SidebarPages.tsx:39,45`.
    - Smallest fix: show the inline alert or retry on list failure; filter rows by `available` and the current surface.
    - Changes: phase 1 code.

22. **"Done" and "Not an issue" overlap.** `done` has no duration and appears on only two cards.
    - Stories: 406, 405
    - Where: README decision 9; mockup card buttons.
    - Smallest fix: define `done` as hide until the signal worsens, show "Marked done <date>" on return, and show it on every action card.
    - Changes: plan, mockup.

23. **Confidence tags and the Source filter disagree with evidence.** Tags mix missing data with interpretation caveats and conflict with a connected Calendar; the Source filter uses the person's source list, so Maya's Gmail-based evidence is excluded by the Gmail filter. A Gmail-only page reads as authoritative.
    - Stories: 304, 307, 202
    - Where: README decision 7; mockup tags and filter.
    - Smallest fix: tags only for coverage or single-source reasons, with High defined; derive sources from the evidence shown; replace the summary on a Gmail-only page with "Based on your mailbox only".
    - Changes: plan (decision 7), mockup.

24. **Filter and sort controls do not behave as labeled.** Sort by Group and Name act oddly in Cards; "Last after-hours" has no Table column; "Workload signals" vs "Workload"; "Filter · N" counts values; two Clear buttons; filtering to "No change" leaves a collapsed row; Table at 40 people has no grouping.
    - Stories: 306, 307, 308, 311
    - Where: mockup toolbar; README decision 6a.
    - Smallest fix: hide Group sort in Cards; add the column or drop the option; one name for the group; expand "others" when it is the only section; keep one Clear; group dividers in Table.
    - Changes: mockup, plan (decision 6a).

25. **Action labels over-promise.** "Block focus time Thursday" implies write access to Priya's calendar; "Move 4 reviews to Sam" targets the page's own single point of failure with no stated reason.
    - Stories: 404, 402
    - Where: mockup card buttons; README decision 10.
    - Smallest fix: relabel "Invite Priya to a focus block Thursday"; the approval prompt shows the PRs and Sam's current load, or says Sam is the only choice.
    - Changes: mockup, plan.

26. **Mockup differs from built code and from itself.** Mockup menu lists disabled "Cap table" and "Hiring pipeline" and still offers an already-added Team health; button label is "Team health menu: remove from sidebar" vs built "Page options"; state 4 has no (i) and omits Linear; dashed Notion and CRM chips look connectable but are not in v1.
    - Stories: 001, 002, 201, 203
    - Where: mockup states 1 and 4, chips.
    - Smallest fix: update the mockup to the built behaviour; add (i) and Linear to state 4; remove the Notion and CRM chips.
    - Changes: mockup.

27. **"Changed 2 wk ago" vs "over 6 weeks"** are two facts under one word.
    - Stories: 312
    - Smallest fix: rename to "Flagged" or show the duration.
    - Changes: mockup.

28. **Small phase 1 UI points.** "Page options" is `opacity-0` until hover or focus, so touch may not reveal it (not verified in a browser); the add/remove error stays until the next mutation; "+ Add page" is muted and appears after load so the sidebar shifts; assumed working hours are not shown when no profile exists.
    - Stories: 006, 005, 009, 203
    - Where: `SidebarPages.tsx:60,108`; `AddSidebarPage.tsx:23`.
    - Smallest fix: keep the button visible on coarse pointers; clear the error when the menu opens; reserve the row height while loading; show the assumed hours in the Table row detail.
    - Changes: phase 1 code, mockup.

## Not changing

- Names in the "8 others" list are dead ends (310): the Table view gives per-person detail; revisit after v1.
- Ask agent coverage questions (408): works as planned; only add the confidence tag to answers, which decision 7 already covers.
- Why Maya is "Take care of first" (302): readable after one read; no change.
- Revenue line named five ways (312): a naming cost, not a defect; leave until the page is built.
- Table with 8 columns at 40 people scrolling sideways (311): only the grouping part is kept (finding 24).
- Double-click on Refresh or an action (206, 401): the sync claim token (decision 3) covers sync; action drafts are per click and get the result line from finding 11.
- Gmail covers only the owner's mailbox and Slack sees only what the token sees (202): already stated under Known limits; the "Based on your mailbox only" line in finding 23 is the only addition.
- EU works-council and employee-monitoring rules (507): out of v1 scope per the README; only the Exclude action (finding 14) is proposed.
- Mobile Team health page (509, 410): v1 is web and desktop; finding 18 is a one-line note only.
- Calendar free/busy for an internal teammate (401): depends on the connector; decide when building phase 5.
