# Walk R2 (iteration 22): verify pass-21 clusters C11-C20

Target: mock-data demo stack, 1440x900, dark theme, signed in as the seeded Maya Chen user. Screenshots (file names only, outside the repo): 01-home, 03-create, 05-cmdk, 06-cmdk-mock, 07-cmdk-bottom, 08-settings-url, 09-models, 10-integ, 11-artifacts, 12-inbox, 15-sent-final, 16-routines, 19-switcher, 20-emptyspace.
Console: no errors or warnings during the walk. Note: other walkers share this user, so some state (Hide amounts, a "New Bot" chat) changed during the walk and is not reported.

## Verdicts

| Cluster | Verdict | Steps (actual/ideal) | Notes |
|---|---|---|---|
| C11 empty spaces in sidebar | PASS | 3/3 | The sidebar lists only Northwind plus two spaces that hold an Inbox agent chat. "Reconnect needed" and "Empty space" appear only in the page-header switcher. Switching to "Empty space" shows its header (active, allowed) with clear gaps between space groups. The "No bots yet" chat pane was not opened (code: Shell.tsx:6093). |
| C12 Artifacts card heights | FAIL | 2/2 | Badge is now on the title row, but "MOCK Investor Update - September" wraps to two lines, so that card measures 95 px against 72 px for the others (see R2-22-01). |
| C13 Integrations "..." menu | PASS | 2/2 | Gmail, Carta, Mercury and Brex show no menu. Blockscout and Coinbase keep "..." with real items (Add API key, Manage agents). |
| C14 Cmd+K | PASS | 4/4 | Footer shows arrow, Enter and Esc as key caps. Empty query lists only pages (with Integrations and Settings), no page agents. Search "mock" highlights matches in bot names and descriptions, group, contacts and artifacts. Artifacts shows "See all in Artifacts"; Documents shows "See all in Data room". |
| C15 plain wording | PASS | 3/3 | Create menu reads New bot, New group chat, New space. Settings > Models has no repeated "Model" card title. run-phase.ts says "Starting up" and "Waiting for the model" (sidebar showed "Waiting for the model..."). "Starting up" itself was not seen live. |
| C16 /app/settings | PASS | 1/1 | Opens the app on Chief with the Settings dialog open (URL becomes the Chief chat). A later reload lands on the chat without the dialog, which is acceptable. |
| C17 cold loads | PARTIAL PASS | 3/3 | Cold load shows shell skeleton rows (sidebar rows, header bar, chat bubbles), not bare text. "First sync can take a minute" never appeared with the Inbox loaded. The "Try again after about 20 s" control was not observed because no load hung on this run (it exists in ShellSkeleton.tsx with a unit test). One first Artifacts load stayed in skeleton for more than 10 s while three other walkers were active; a repeat took under 3 s, so no defect is filed. |
| C18 Routines caption | PASS | 3/3 | New Bot Routines panel shows the Routines heading and "Create a routine" with no "<bot>'s computer" caption over blank space. |
| C19 header borders | PASS | 4/4 | No bottom border under the Chief chat header, Inbox, Finance, Integrations or the Routines panel header. Artifacts still has a rule under its toolbar row (search + filter), not under the title header. |
| C20 Inbox | PASS | 6/6 | To do card is one collapsed line. Replying to a Needs reply mail shows "Sending...", then "Sent. Moved out of Needs reply" in the mail dialog after about 5 s. "Show 16 more" is a 28 px ghost button whose left edge (344 px) matches the row edge. |

Summary: 8 PASS, 1 PARTIAL (C17, one criterion not exercisable), 1 FAIL (C12).

## Findings

| id | page/story | severity | category | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| R2-22-01 | Artifacts grid (C12) | P3 | visual | OBSERVED: the versioned card is 345x95 px; the other ten cards are 345x72 px. The v2 badge moved to the title row but takes width, so the title wraps to two lines. Expected: equal heights. | 11-artifacts.png, DOM measurement | apps/web/src/pages/Artifacts.tsx (grid card title row, near the badge) | Put the badge in the date/description row or truncate the title to one line so every card keeps 72 px. |
| R2-22-02 | Inbox, stuck load (C17) | P3 | flow | UNVERIFIED: the 20 s "Try again" control could not be triggered on a healthy stack. | none | apps/web/src/components/ShellSkeleton.tsx | Re-check with a throttled or blocked API request in a later pass. |

Praise: Cmd+K is now consistent and calm; the Inbox send confirmation is clear; the Integrations grid and Settings > Models are clean.
