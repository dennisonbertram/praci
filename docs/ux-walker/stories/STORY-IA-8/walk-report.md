# Walk report: STORY-IA-8

Screenshots cited here are kept locally and not committed; the written findings are the record.

Verdict: **PASS (with warnings)**. Viewport 1280x800 desktop plus one 390x844 check (`screenshots/mobile-check.png`, no overflow or wrapped controls; geometry audit pageOverflowX = 0). App: mock demo at 127.0.0.1:5380, user mock-founder. Console: no errors seen.

## Flow log
Ideal 2 (switch on, ask). Actual 2. Used Brex because Mercury already had an agent from earlier stories. Brex write flow cannot be tested (read-only tools).

## Steps
- Step 1: Brex page before an agent: Create agent button, Used by with Finance agent on. (`screenshots/step-1.png`)
- Step 2: Switched Finance helper and Chief on under Used by. (`screenshots/step-2.png`)
- Step 3: Asked Chief what Brex bills are unpaid: one unpaid bill, Placeholder Legal LLP (Mock), $2,000. (`screenshots/step-3.png`)
- Step 4: Clicked Create agent: opened new Brex agent chat directly. (`screenshots/step-4.png`)
- Step 5: Brex page: Agent section appears; Chief and Finance helper still switched on in Used by. (`screenshots/step-5.png`)

## Findings
- F-IA-8-01 [medium, warn] Used by and Create agent are two ways to give a bot Brex access and the page does not say how they differ. A plain switch gives a bot every tool the server offers; nothing marks it as the riskier route.
- F-IA-8-02 [low, warn] After Create agent, Chief and Finance helper remain switched on in Used by. Nothing shows they now read only (the story says non-agents become read-only).
