# Walk report: STORY-IA-7

Screenshots cited here are kept locally and not committed; the written findings are the record.

Verdict: **PASS (with warnings)**. Viewport 1280x800 desktop plus one 390x844 check (`screenshots/mobile-check.png`, no overflow or wrapped controls; geometry audit pageOverflowX = 0). App: mock demo at 127.0.0.1:5380, user mock-founder. Console: no errors seen.

## Flow log
Ideal 3 (archive, open page, Create agent). Actual 3 plus a reload because the old page stayed stale. Archived list not opened.

## Steps
- Step 1: Turned on Only this agent and Allow changes, then archived Mercury agent from the sidebar menu (Pin, Move to, ..., Archive, Delete). No confirmation dialog. (`screenshots/step-1.png`)
- Step 2: Page that was open still showed the Agent section with live switches after the archive. (`screenshots/step-2.png`)
- Step 3: After reload: Agent section gone, Create agent back, Used by lists all bots again. (`screenshots/step-3.png`)
- Step 4: Create agent: opened a new, empty Mercury agent (new id, purple avatar). Archived count went from 1 to 2. (`screenshots/step-4.png`)
- Step 6: Allow changes and Only this agent both off on the new agent. (`screenshots/step-6.png`)

## Findings
- F-IA-7-01 [medium, warn] Create agent after archiving makes a fresh bot. The conversation, including the earlier payment approvals, stays in the archived bot and the new chat is empty.
- F-IA-7-02 [low, warn] Archiving the agent gives no dialog or note that this also releases Mercury and resets Allow changes and Only this agent. An open copy of the Mercury page still showed the old Agent section until reloaded.
