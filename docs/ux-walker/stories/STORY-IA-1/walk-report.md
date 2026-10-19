# Walk report: STORY-IA-1

Verdict: **FAIL**. Viewport 1280x800 desktop plus one 390x844 check (`screenshots/mobile-check.png`, no overflow or wrapped controls; geometry audit pageOverflowX = 0). App: mock demo at 127.0.0.1:5380, user mock-founder. Console: no errors seen.

## Flow log
Ideal 3 steps (Integrations, Mercury tile, Create agent). Actual: not reachable by clicking; had to type the detail URL. Once on the page: Create agent (1 click) then chat opened.

## Steps
- Step 1: Integrations grid lists Mercury and Brex tiles. Mercury/Brex/Blockscout tiles have no link; Gmail and Carta tiles do. Clicking the Mercury tile body does nothing. The only link on it is Open Finance. (`screenshots/step-1.png`)
- Step 2: Opened /app/integrations/mcp/<id> by URL. Header buttons Reconnect, Disconnect sign-in, Create agent, Rename. No explanation of what Create agent does. (`screenshots/step-3.png`)
- Step 3: Clicked Create agent. Polled the route 4 times at 0.4s: first poll still on the Mercury page, next poll already /app/<newBotId> with Mercury agent header. Chief or another agent never appeared. Chat opens empty. (`screenshots/step-4.png`)
- Step 4: Mercury agent is in the main bot list. Its avatar is the same blue-violet heart as Finance agent. (`screenshots/step-4.png`)
- Step 5: Agent section shows link Mercury agent, Allow changes (off), Only this agent (off), with the hints from the story. Create agent button is gone. Mercury agent also appears in Used by as a switch that is on. (`screenshots/step-5.png`)

## Findings
- F-IA-1-01 [high, fail] The Mercury, Brex and Blockscout tiles on the Integrations grid have no link to their detail page. Gmail and Carta tiles link to it. The only link on the Mercury tile is Open Finance, so Create agent, Allow changes and Only this agent cannot be reached by clicking.
- F-IA-1-02 [medium, warn] Right after Create agent, the Used by list shows Mercury agent with a switch on, duplicating the Agent section above it. The switch can be turned off, which would cut the agent off from its own server.
- F-IA-1-03 [low, warn] The detail page header shows a grey M placeholder tile, while the grid tile showed the Mercury logo.
- F-IA-1-04 [low, warn] Create agent sits next to Reconnect with no hint of what it does (confirms the story's predicted hesitation).
- F-IA-1-05 [low, warn] The new Mercury agent gets exactly the same avatar as Finance agent, and Legal agent is nearly the same heart in blue, so the sidebar rows are hard to tell apart by icon.
- F-IA-1-06 [suggestion, warn] The new agent's chat is completely empty, no greeting or example question.
