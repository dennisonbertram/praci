# Walk R1 - verification of pass-16 clusters C1-C10

Demo stack only (web :5381), 1440x900 unless noted. Seeded demo login, plus one fresh invented sign-up for the tour. Other walkers were active on the same stack, so some counters (Page agents, Inbox) moved during the walk.

## Verdicts

| Cluster | Verdict | Steps (actual/ideal) | Notes |
|---|---|---|---|
| C1 mail send wording and recovery | PARTLY (observed OK once) | 3/3 | Delegated send from the Investors agent via the Inbox agent card sent from the right account ("Mail Sent"), no "acct:" text anywhere. The failed-card state and "Open in composer" could not be triggered on the demo, so not observed. |
| C2 Investors Draft reply | PARTLY | 2/2 | The Ask panel opens on the conversation and the row shows "Drafting..." then returns to "Draft reply" with the answer in the panel. But on the first click the button stayed idle for about 9 s before "Drafting" appeared, and later clicks gave no visible response in 24 s (R1-02). |
| C3 Legal table | PASS (scan parts not tried) | 2/2 | Insurance name fully visible (34 chars); baseline spread 0 px on all 10 rows; no Status column; graph labels 12 px. Not tried: column shift when a scan adds a row, banner jump, Deadlines count during scan (scan needs AI consent). |
| C4 Inbox dialog and send | PASS | 5/5 | "Added to Data room" shown immediately; More menu has no Reply all on a single-recipient mail; Sending toast became Sent within about 2 s after Undo expired. Not checked: repeated Sent text, To do card jump, 8 px gutter. |
| C5 GTM | PARTLY | 4/4 | Pages menu unchecks and hides the row; Cmd+K "gtm" shows one Pages entry; sidebar row is an anchor to /app/gtm; opening GTM adds the agent under Page agents (2 to 3), not a top-level chat. Channels table text inset is 16 px vs 4 px on Contacts, and an empty "Written by GTM agent" box remains (R1-03). |
| C6 Data room list | PARTLY | 3/3 | Failed row 56 px (1440, 1920, phone 375) with its reason in the row; upload toast reads "Uploaded to Finance / Budgets". At 1920 (Name 735 px wide) the Parties cell still truncates "Northwind Robotics, Acme Vent..." (R1-04). |
| C7 First-run tour | FAIL / BLOCKED | n/a | Connect-card path BLOCKED (needs real OAuth). Dismissing the first-question card starts the tour on Chief (met). Reload at step 4/9 restarts at 1/4: step not restored and the stop count changed (R1-01). Ring at step 9 not reached. |
| C8 Touch and keyboard | PARTLY | 3/3 | Failed badge 24x25 px (met). Resize folders shows a 2 px ring on focus (met). Drawer row height and sticky hover need pointer: coarse, which agent-browser device emulation did not provide (matchMedia coarse was false), so NOT VERIFIED. |
| C9 Finance burn chart | PARTLY | 3/3 | Month: Oct* is a single hollow mark. Quarter: Q1 has data; Q4* shows two markers 111 px apart. Year: only a single "2026*" column with two dots and no line; it does not fill the plot width (R1-05). Coarse-pointer control width NOT VERIFIED. |
| C10 Routines | PARTLY | 4/4 | Test run on a delegating routine shows "Waiting on Legal agent" then "Waiting on Finance agent" (met); final Done not observed. Panel still shows an empty "Chief's computer" heading under Routines and a monitor icon on the header button (R1-06). Disabled Test run reason not tried. |

## Findings

| id | story/page | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R1-01 | C7 tour | P1 | bug | Reload during the tour does not restore the step: at 4/9 on Finance, reload gave 1/4 (also a different stop count). Expected same step. Observed. | /tmp/uxloop17/R1/tour4.png, tour5.png | first-run tour state (apps/web tour component) | Persist step index server-side or in storage and restore it on load. |
| R1-02 | C2 Investors | P2 | flow | Draft reply stays idle about 9 s before "Drafting..." appears; a repeat click after the first draft gave no visible change in 24 s. Expected immediate Drafting state. Observed. | inv-d1.png, inv-d4.png | apps/web/src/pages/Investors.tsx ~1162, components/investors/ActionItems.tsx | Set the row to Drafting synchronously on click and open the panel at once; on repeat click open the existing draft. |
| R1-03 | C5 GTM | P3 | visual | Channels table text starts 16 px from the table edge vs 4 px on Contacts; an empty "Written by GTM agent" box sits under the Connect card. Observed. | gtm.png | GTM page layout | Align inset with Contacts and hide the empty caption box. |
| R1-04 | C6 Data room | P2 | visual | At 1920 the Parties cell (224 px) still cuts "Northwind Robotics, Acme Vent..." while Name has about 500 px spare. Expected full text. Observed. | dr1920.png | Data room list column widths | Give Parties a flexible share of spare Name width. |
| R1-05 | C9 Finance | P2 | visual | Year view shows one "2026*" column with two unconnected dots and a mostly empty plot; Quarter Q4* shows two disconnected dots. Expected filled plot. Observed (data has one year). | fin-q.png, fin-y.png | Finance burn chart | Show at least trailing 4 quarters or months in Year view; connect partial point to last full point. |
| R1-06 | C10 Routines | P3 | visual | Routines-only panel still shows an empty "Chief's computer" heading and the header button keeps a monitor icon. Expected no heading and a clock/calendar icon. Observed. | routines.png | Chief computer/routines panel | Hide the computer section when empty; swap icon. |
| R1-07 | Data room page | P2 | perf | Cold load of /app/data-room sat on "Opening Praci..." for 12+ s then "Still opening..." before a retry worked. Possibly dev-server load from other walkers; suspected, seen once. | console had only vite messages | app boot / dev server | Check boot time under load; show retry sooner. |
| R1-08 | C8/C9 | P3 | a11y | Touch-target checks not verifiable here: device emulation did not set pointer: coarse. Not a product finding. | matchMedia false | n/a | Re-run with a real touch-emulating context. |

Praise: Data room upload toast "Uploaded to Finance / Budgets", the "Added to Data room" line, Legal table baseline alignment, and the failed-file row with its reason are clean.

Summary: PASS 2 (C3, C4), PARTLY 7 (C1, C2, C5, C6, C8, C9, C10), FAIL/BLOCKED 1 (C7). Findings: 1 P1, 4 P2, 3 P3.
