# STORY-CA-1 walk report

Verdict: PASS with findings

Setup: mock demo, Gmail Sales account in place of Notion.

Flow log: Gmail Sales mail stands in for Notion. Flow: Integrations > Gmail > Create agent > chat > back > Agent card. 5 steps vs ideal 4 (one extra, back navigation). Hesitation: Create agent beside Rename with no explanation; blank chat after creation. Expected result met: Create agent gone from the row, Agent card with changes off. Defaults: Allow changes off, Only this agent OFF. Used by is replaced by the Agent card for that account. Console: no errors. Geometry: no wrap/overflow; switch-thumb spill of 12px is the switch, ignored; sidebar uneven rows are timestamps. Mobile 390: no horizontal scroll, uneven action-row wrap.

Findings: F-CA-1-1 (medium), F-CA-1-2 (medium), F-CA-1-3 (low), F-CA-1-4 (low), F-CA-1-5 (low)

Details and evidence are in findings.json; screenshots are in the screenshots folder.
