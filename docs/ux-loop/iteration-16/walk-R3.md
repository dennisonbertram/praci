# Walk R3 (iteration 16): verify pass-15 clusters C21-C25

Target: mock demo stack (web :5381), 1440x900 unless noted, user mock-founder. Screenshots in /tmp/uxloop16/R3/.
Scope note: clusters.json in iteration-15 has only 25 clusters, so C26-C31 do not exist and were not walked.
Cluster ids are used as story ids; steps are counted for the check path.

## Verdicts

- C21 Palette empty copy: PASS (2/2). Cmd+K, typing "zzzqqq" shows "No matches" plus "Search mail for ...", no source list. Footer uses one Kbd style for arrows, Enter, Esc.
- C21 Search focus ring on load: PASS (3/3). After sign-in and on reload, focus stays on body and Search is not focus-visible. The thick ring in the very first screenshot is the tour spotlight on step 1/9 ("Search"), not autofocus.
- C21 Page agents open/closed state: PASS (6/6). Collapsed state stayed across Legal, Contacts, Inbox, Chief; expanded stayed across Finance.
- C21 Open on a second space: PASS by owner decision (2/2). "Open Empty space" creates that space's Chief with the first-question card (first use).
- C22 axe (aria-allowed-role, landmark-one-main, color-contrast): PASS (4/4). Zero violations on Chief chat and the bot settings panel; composer textarea has no role; sign-in has one main and a text-balance h1 (Auth.tsx:527,539). Sign-up shares the same layout (code only, not run).
- C23 Account card: PASS (1/1). Title "Account" above the rows, row labels at body weight.
- C23 One control named Advanced in Settings: PASS (2/2). Only the nav item is named Advanced; Models has no second disclosure here.
- C23 Bot panel sticky header: PASS (3/3). At 1440x500 scrolled 150 px, content clips under a solid header, no overlap.
- C23 Models card / Advanced group styling: FAIL (P3). See R3-16-01 and R3-16-02.
- C24 Routine Test run row: PASS (8/6). Run history row is titled with the routine name ("R3 cash check"), delegated prompt is secondary text. Extra steps are because Test run stays disabled until a schedule is chosen and saved.
- C24 Schedule flyout alignment: PASS (1/1). Flyout items line up with their row (about 6 px offset, was 17).
- C24 Mercury card title and copy: PASS (2/2). Before allowing: "Mercury agent", "On: creates a Mercury agent that can read and, after you approve, make changes."
- C24 Routines icon and "computer" heading: FAIL (P3). See R3-16-03.
- C24 New Mercury agent chat suggestions: BLOCKED. The agent's first chat already held another walker's message ("Please send $... to Acme"), so the empty state could not be seen. Code has suggestions only in composer.tsx; not verified.
- C24 Reply From line "Gmail <address>": SKIPPED (needs a live reply flow; not in R3 scope time).
- C25 Contacts at 1920: PASS (1/1). Name column starts 344, Email 590 (246 px apart; limit 300).
- C25 Empty Contacts: PASS (3/3). Empty space shows one "Add contact" button in the body only.
- Storybook smoke: PASS. Built with `pnpm --filter @rakazo/web build-storybook` (worktree needed `pnpm install --offline --frozen-lockfile --ignore-scripts` first), `node .storybook/smoke.mjs storybook-static`: 1747/1747 stories rendered cleanly, no failing story.

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R3-16-01 | Settings > Models (C23) | P3 | visual | Observed. Models is still a one-line sentence plus a button floating on a large empty panel; every other section uses cards. Cluster said to wrap it in the same card. | /tmp/uxloop16/R3/models.png | apps/web/src/pages/ModelSettingsOverlay.tsx | Put the Models summary and "Use my own model" in the same card style as General. |
| R3-16-02 | Bot settings > Advanced group (C23) | P3 | visual | Observed. After expanding Advanced, Workspace, Open work, Model, Thinking use the same left edge, label weight and spacing as the top-level fields (Name, Audience), so the group boundary is unclear. Cluster said to indent or separate. | /tmp/uxloop16/R3/botadv.png | apps/web/src/pages/shell/bot-panel.tsx | Indent the expanded Advanced group or add a divider and lighter label weight. |
| R3-16-03 | Routines panel (C24) | P3 | visual | Observed. A routines-only panel (menu > Routines on Finance helper and Mercury agent) still shows a floating "{bot}'s computer" heading mid-panel with nothing under it, and the chat header uses a monitor icon for it. Cluster asked to drop the empty heading and use a calendar/clock icon. | /tmp/uxloop16/R3/routines.png, mercury5.png | apps/web/src/pages/Shell.tsx:5958 (Monitor icon), computer panel heading "{0}'s computer" | Hide the computer heading when no screen exists and always show the Clock icon for the Routines panel. |
| R3-16-04 | Routines run row (C24) | P3 | flow | Observed. Test run is disabled until a schedule is chosen and the routine saved; nothing says why (button just dims). A first-time user must discover choose-when then Save then Test run. | /tmp/uxloop16/R3/routine-new.png, saved.png | apps/web/src/pages/RoutineSchedule.tsx and routine editor | Let Test run work on an unsaved routine, or add a tooltip "Save first". |

No P0 or P1 found. Praise: sign-in and bot-panel axe clean; the palette empty state and key-cap footer are now consistent; Contacts empty state is clean; Mercury card copy states exactly what the switch creates; schedule flyout now lines up with its row.

Walk side effects on the demo: created and deleted routine "R3 cash check" on Finance helper; turned on "Allow changes in Mercury" (creates Mercury agent, mock); "Open Empty space" created a Chief in the Empty space.
