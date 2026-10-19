# Walk report: STORY-IA-3

Screenshots cited here are kept locally and not committed; the written findings are the record.

Verdict: **FAIL**. Viewport 1280x800 desktop plus one 390x844 check (`screenshots/mobile-check.png`, no overflow or wrapped controls; geometry audit pageOverflowX = 0). App: mock demo at 127.0.0.1:5380, user mock-founder. Console: no errors seen.

## Flow log
Ideal 5 (switch, dialog, chat, ask, Deny). Actual: switch, dialog, chat, 4 messages (payee ID dead end, prose confirmation), card, Deny, then a second card and second Deny. About 9 steps because Acme's recipient ID was unknown and the agent could not look it up.

## Steps
- Step 2: Clicked Allow changes switch: dialog Allow changes in Mercury? with one bullet, buttons Cancel and Allow changes (red-tinted). Switch does not move until confirmed. (`screenshots/step-2.png`)
- Step 3: After Allow changes the switch is on. (`screenshots/step-3.png`)
- Step 4: Asked to pay Acme (Mock) $1,200. Agent says it lacks a recipient ID and shows JSON with recipientId TBD. (`screenshots/step-4.png`)
- Step 5: Said I do not know the ID, look it up. Agent: cannot look up recipients. Dead end unless the user knows an ID. (`screenshots/step-5.png`)
- Step 6: Gave invented ID. Agent shows the request in prose and JSON and says No payment has been submitted yet, but no card. (`screenshots/step-6.png`)
- Step 7: After Yes, submit it: card Review before mcp__finance-mercury__requestSendMoney -> 1200 with tool and arguments JSON, buttons Allow once and Deny. No Always allow. (`screenshots/step-7.png`)
- Step 8: Clicked Deny: card shows green Denied, and the agent immediately posted a second identical card (with an added note field) and no explanation. (`screenshots/step-8.png`)
- Step 9: Denied the second card: agent then explains: The payment request was denied, so no request was submitted and no money moved. I can't retry it. What would you like to do next? (`screenshots/step-9.png`)

## Findings
- F-IA-3-01 [high, fail] The approval card names the payment with an internal tool name and a bare number: Review before mcp__finance-mercury__requestSendMoney -> 1200. It does not show currency, payee name, or account name; details are raw JSON with ids chk-1111 and rcp-acme-mock. The one place Maya must be sure what she approves is the least readable.
- F-IA-3-02 [high, fail] After the first Deny the agent did not explain itself. It posted a second, nearly identical approval card (with an extra note field) seconds later. Only after the second Deny did it explain, and it then wrote I can't retry it right after it had retried.
- F-IA-3-03 [medium, warn] The payment needs a recipient ID. The agent cannot list recipients (no such tool in the demo) and asks Maya for an ID she would not know. Payment is not completable by a normal user.
- F-IA-3-04 [medium, warn] Maya is asked twice before the card: once in prose (Here's the payment request for your approval, then she has to type Yes, submit it) and then the card. Same approval is requested in two places.
- F-IA-3-05 [low, warn] Denied is shown in the same green as Allowed once, so a refusal looks like success.
- F-IA-3-06 [low, warn] The Allow changes dialog says change your Mercury data, which does not tell Maya this includes moving money. Single bullet in a list.
