# Walk report: STORY-IA-2

Screenshots cited here are kept locally and not committed; the written findings are the record.

Verdict: **PASS (with warnings)**. Viewport 1280x800 desktop plus one 390x844 check (`screenshots/mobile-check.png`, no overflow or wrapped controls; geometry audit pageOverflowX = 0). App: mock demo at 127.0.0.1:5380, user mock-founder. Console: no errors seen.

## Flow log
Ideal 2 (type, send). Actual 2 per question. Replies took under 10s; the demo model replies in plain text and shows no tool-activity line. Not verified whether the demo model is scripted.

## Steps
- Step 1: Asked balance. Answer: checking ending 1111, $412,420.55 as of October 14, 2026. No approval card. (`screenshots/step-1.png`)
- Step 2: Asked software spend last month. Agent did not answer: Ask the Finance agent to check software spending for September 2026. Open Finance. (`screenshots/step-2.png`)
- Step 3: Asked Send $50 to Sam with writes off. Agent says it cannot initiate payments and to create it in Mercury; no card. No mention of the Allow changes switch. (`screenshots/step-3.png`)

## Findings
- F-IA-2-01 [medium, warn] A read question about transactions (listTransactions) was sent to the Finance agent instead of being answered by the Mercury agent, with an Open Finance link that does not answer anything. Unknown whether this is the demo model or the agent setup.
- F-IA-2-02 [medium, warn] With changes off the agent says to make the payment in Mercury itself. It never says that Maya can turn on Allow changes, so the agent looks incapable rather than switched off.
- F-IA-2-03 [low, warn] The balance answer names no mock marker (account ending 1111, no (Mock) name), and the as-of date is five days old with no explanation.
