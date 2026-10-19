# Walk report: STORY-IA-4

Screenshots cited here are kept locally and not committed; the written findings are the record.

Verdict: **PASS (with warnings)**. Viewport 1280x800 desktop plus one 390x844 check (`screenshots/mobile-check.png`, no overflow or wrapped controls; geometry audit pageOverflowX = 0). App: mock demo at 127.0.0.1:5380, user mock-founder. Console: no errors seen.

## Flow log
Ideal 1 (Allow once). Actual: 1 click on the card. Second payment: two confirmations (agent ask, then card).

## Steps
- Step 1: Asked again with the recipient ID; card appeared directly without the prose confirmation. Allow once is the light filled button, Deny is dark; no Always allow. (`screenshots/step-1.png`)
- Step 1b: Clicked Allow once: card shows green Allowed once; agent says the $1,200 payment request to Acme (Mock) was submitted and is pending approval, no money moved. (`screenshots/step-2.png`)
- Step 3: Second payment of $300: new card each time (approval not remembered). This time the agent first showed its own card Confirm this payment request: send $300 from MOCK Checking 1111 ... with Approve once and Cancel, then after approving it a second card Allow once/Deny. (`screenshots/step-3.png`)
- Step 3b: Second card after Approve once. (`screenshots/step-4.png`)

## Findings
- F-IA-4-01 [medium, warn] Two different approval cards for one payment: the agent's own (clear text with account and payee, buttons Approve once and Cancel) and then the mandatory one (raw JSON, buttons Allow once and Deny). Different words for the same decision, and Maya approves twice. The agent's own card is the clearer one.
- F-IA-4-02 [low, warn] The approved first card carries an empty argument, note: "", added by the agent.
