# Walk report: STORY-IA-5

Verdict: **PASS**. Viewport 1280x800 desktop plus one 390x844 check (`screenshots/mobile-check.png`, no overflow or wrapped controls; geometry audit pageOverflowX = 0). App: mock demo at 127.0.0.1:5380, user mock-founder. Console: no errors seen.

## Flow log
Ideal 1 (click). Actual 1: no dialog, switch turned off at once, stayed off after reload.

## Steps
- Step 1: Switch on. Click turned it off with no dialog. (`screenshots/step-0.png`)
- Step 2: Asked for a $500 payment: agent says the payment action is not available here, no card, no money moved. It says to submit it in Mercury and does not mention the switch. (`screenshots/step-2.png`)
- Step 3: Reloaded the Mercury page: Allow changes is off. (`screenshots/step-1.png`)

## Findings
- F-IA-5-01 [low, warn] After turning changes off, the refusal says the payment action isn't available here and to submit it in Mercury, with no mention that Maya turned it off or how to turn it on again. Same wording issue as IA-2.
