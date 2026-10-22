# Walk R3 (uxl14-R3): verify pass-13 clusters C21-C31 + Storybook smoke

Stack: mock demo, web 5381. Scope note: `docs/ux-loop/iteration-13/clusters.json` holds only C1-C22, so C23-C31 do not exist; only C21 and C22 were verifiable. Phone checks used a 375x812 viewport; agent-browser 0.38 has no touch emulation, which does not matter here (no touch-target claims). Screenshots in /tmp/uxloop14/R3/.

## Story verdicts

| Cluster | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| C21 criterion 1: email subject on a phone | PASS | 3/3 (open Inbox, tap mail) | Subject uses `line-clamp-3`; a 2-line subject shows in full (c21-msg.png). A 4+ line subject was not available in mock data, so the clamp itself was only seen in code. |
| C21 criterion 2: email not broken at hyphen (Settings > Account) | PASS | 4/4 | `mock-founder@demo.rakazo.test` sits on one line (c21-settings.png). |
| C21 criterion 2 (same defect, other place) | FAIL | n/a | Open mail header still breaks the recipient at the hyphen: `to Maya Chen (Mock) <mock-` / `founder@northwind...>` (c21-msg.png). See R3-01. |
| C21 criterion 3: truncated Contacts emails carry `title` | PASS | 2/2 | Every email span has `title` with the full value; one truncated at 375 px (jamie@placeholder-ventures...) still shows the full value on hover (c21-contacts.png). |
| C22 criterion 1: one row height across three menus | FAIL (partly met) | 3/3 | Account menu 32 px, Create menu 32 px, Pages "Show in sidebar" menu 28 px (measured with getBoundingClientRect; c22-pages.png). Was 28 / 32-34 / 36-43, so improved. |
| C22 criterion 2: open Activity uses muted selected style | PASS | 1/1 | Open Activity button has `bg-sidebar-accent text-foreground` (rgb 42,41,39 bg, icon rgb 236,235,230), not a solid white icon (c22-activity-open.png). A white focus ring shows after the mouse click. |
| C22 criterion 3: no identical Artifact timestamp filler | PASS | 1/1 | Artifacts grid cards show no timestamp when all are equal (c22-artifacts.png). `Artifacts.tsx:507` implements this. |
| C23-C31 | SKIPPED | | Do not exist in clusters.json. |
| Storybook smoke | FAIL (2 of 1730) | | Built to /tmp/uxloop14/sb-static from the main checkout (the worktree has no node_modules; main is 2 merge commits from the worktree, story file identical). 1728 render cleanly; 2 fail, reproduced on a rerun. See R3-02. |

Geometry audit on Artifacts at 1440x900: pageOverflowX 0, no spills, no wrapped controls; unevenRows only in sidebar chat rows (name vs time, intentional). Console: no errors.

## Findings

| ID | Sev | Cat | Story/page | What happened vs expected | Evidence | Status | Suspected location | Proposed fix |
|---|---|---|---|---|---|---|---|---|
| R3-01 | P3 | visual | C21, Inbox open mail at 375 px | The "to ..." line uses `break-words`, which wraps at the hyphen in `mock-founder@...`, so the address is split across two lines. Expected: address on one line (the same rule C21 set for Settings). | /tmp/uxloop14/R3/c21-msg.png; element class `min-w-0 break-words sm:truncate`, height 32 px | Observed | apps/web/src/components/inbox/InboxMessageDialog.tsx:361, 381, 385 | Wrap each address in `whitespace-nowrap` (or `break-all` on the address only) so lines break between recipients, not inside an address. |
| R3-02 | P3 | bug | Storybook smoke | `shell-message-cards--app-connect-waiting` and `--app-connect-failed` fail in their play functions: they look for a button named `/^Connect$/` but the card's button is labelled "Connect Sample Mail". CI's `node .storybook/smoke.mjs` would fail. | Smoke output (1728/1730); the error lists `Connect Sample Mail` | Observed, reproduced on rerun | apps/web/src/pages/shell/message-cards.stories.tsx:139, 150 (button label from message-cards.tsx:263) | Change both queries to `{ name: /^Connect Sample Mail$/ }` (or `/^Connect/`). |
| R3-03 | P3 | visual | C22, Pages menu | Pages "Show in sidebar" rows are 28 px; account and Create menus are 32 px. The cluster asked for one row height. | Measured heights 28 vs 32 | Observed | apps/web/src/pages/Shell.tsx (Pages options menu items) | Give the checkbox items in the Pages menu the same `h-8` as the other menu rows. |
| R3-04 | P2 | perf | First load of a deep link | Opening `/app/inbox` directly after navigating showed "Opening Praci..." for over 10 s, then "Still opening... Try again"; Try again worked. The machine load average was above 100 from other walkers, so this may be load, not a defect. | Screenshot x.png (not retained); load average 113 | Suspected (load) | OpeningSpace in apps/web/src/pages/Shell.tsx | Re-measure on an idle machine before acting. |

Praise: Settings > Account now reads cleanly on one line; Contacts emails all carry full-value titles; Artifacts cards dropped the identical timestamps; Activity open state is a quiet muted pill.
