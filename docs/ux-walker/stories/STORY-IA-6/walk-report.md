# Walk report: STORY-IA-6

Verdict: **FAIL**. Viewport 1280x800 desktop plus one 390x844 check (`screenshots/mobile-check.png`, no overflow or wrapped controls; geometry audit pageOverflowX = 0). App: mock demo at 127.0.0.1:5380, user mock-founder. Console: no errors seen.

## Flow log
Ideal 3 (switch, ask Chief). Actual: switch (1), ask Chief, Chief declined to ask the agent. Walked steps 1-2, 3, 6, 7, 8. Step 5 (payment via Chief, where does the card appear) not walked because Chief never messages the Mercury agent.

## Steps
- Step 2: Clicked Only this agent: applied at once, no dialog. Used by now lists only Mercury agent. (`screenshots/step-2.png`)
- Step 3: Asked Chief the Mercury balance. Chief: Please ask the Mercury agent in its chat. No peer message to the agent. (`screenshots/step-3.png`)
- Step 3b: Told Chief to message the Mercury agent itself. Chief: I can't retrieve the balance by messaging the Mercury agent from here. Please ask it in its chat. With an Open Finance link. (`screenshots/step-3b.png`)
- Step 6: Finance agent still answered runway (24.2 months from synced data). (`screenshots/step-6.png`)
- Step 7: Finance page unchanged. (`screenshots/step-7.png`)
- Step 8: Only this agent off: Used by lists all bots again with previous switches (Finance agent still on). (`screenshots/step-8.png`)

## Findings
- F-IA-6-01 [high, fail] With Only this agent on, Chief does not ask the Mercury agent. It tells Maya to go to the Mercury agent's chat herself, even when told to message it. The promise on the page (Other agents ask the Mercury agent instead) does not hold, so Maya loses Mercury answers in every other chat. The reply also carries an unrelated Open Finance link.
- F-IA-6-02 [medium, warn] Only this agent: for a first-time user the label could mean this agent is the only one that exists. The hint underneath does explain it. After turning it on, Used by quietly shrinks from nine rows to one with no note that other agents lost Mercury (Finance agent's Mercury switch had been on).
