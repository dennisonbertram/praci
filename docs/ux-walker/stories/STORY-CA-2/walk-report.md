# STORY-CA-2 walk report

Screenshots cited here are kept locally and not committed; the written findings are the record.

Verdict: PASS with findings

Setup: mock demo, Gmail Sales account in place of Notion.

Flow log: Switch > confirm dialog > on persists. Agent chat: a send asked for two approvals (agent card, then tool card), approval sent mail ('Sent to test@example.com'). Second change asked again (approval did not carry over). Deny worked. Switch off was immediate with no dialog. 8 steps vs ideal 7. Not verified: turning off while an approval was pending; read-only request. Mobile: Agent card readable, wraps fine.

Findings: F-CA-2-1 (medium), F-CA-2-2 (medium), F-CA-2-3 (low), F-CA-2-4 (medium), F-CA-2-5 (suggestion)

Details and evidence are in findings.json; screenshots are in the screenshots folder.
