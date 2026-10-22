# Walk R2 (uxl18-R2): verify pass-17 fixes C11-C20

Demo stack :5381, mock-founder login, 1440x900 (390 wide device preset for one Finance check). Other walkers share the same account, so some state (toasts, new bots) changed under me.

## Verdicts (steps actual/ideal)
- C11 pending approval trace / Mercury entry: PARTIAL (6/4). Toast appeared within 2 s after leaving the email-agent chat and followed me across pages; collapsed "Email chats" group shows "Needs your answer". Toast later vanished (server seenAt set 1m44s after creation, likely by another walker on the same account) and did not return after reload, so "restore until answered" is unproven. Mercury detail page has no agent button because the agent does not exist until "Allow changes" is on (not toggled, would create an agent). Phone "one Open Inbox agent control" not checked.
- C12 Investors Draft reply: PASS (3/3). "Drafting..." within the same tick, button disabled (not "opens panel" on second click), panel opens by itself, about 55 s later the row says "No draft made, see Ask".
- C13 Finance burn chart: PASS (5/4). Year = one labelled "2026*" bar; Month 1 marker; Quarter markers 112 px apart; Week 15 px; 390 px wide chart clean. 44 px coarse-pointer targets BLOCKED (agent-browser cannot emulate pointer: coarse). Burn detail page still has two rings 8 px apart at Oct*.
- C14 Cleanup empty state: PASS (3/3). "Nothing to clean up. Senders need 3 or more messages, ..." plus Open Newsletters.
- C15 Data room Auto-sort: PASS (4/3). Nothing pre-checked, no duplicate Cap table folder (proposes "Fundraising / Cap Table"), Apply reads "Apply 2 changes" after checking two. Analysis took about 25 s.
- C16 Sidebar short screens: FAIL (2/2). At 800 high only 4 full chat rows (need 6); at 720 high 3 rows and no "+N more" cue for the groups below. 83-char name: SKIPPED (would need a new bot on shared demo).
- C17 Stuck Reading text: BLOCKED (needs a stuck worker for 3+ minutes).
- C18 GTM: PASS with nits (3/3). No empty caption, four social rows in one line, "Not connected" once. Cmd+K "gtm" still lists page GTM and bot "GTM agent".
- C19 Routines: PASS (4/4). Editor has no monitor icon, month option reads "Every month on the 1st". Tooltip over Close not reproducible (no tooltip shown on hover).
- C20 Space name / Contacts width: PASS (7 pages/7). Space name sits 12 px right of the h1 at y 32-48 on Inbox, Finance, Legal, Investors, Fundraising, Contacts, Artifacts. Contacts table right edge 1412 = header Ask right edge 1412.

## Findings
| id | sev | cat | what | evidence | suspected code | fix |
|---|---|---|---|---|---|---|
| R2-01 | P2 | bug | Approval toast disappeared after ~1m44s and was not restored on reload while approval still pending ("Needs your answer"). Observed; cause may be another walker on same account marking it seen. | pendingApprovals showed seenAt set; /tmp/uxloop18/R2/c12-b.png | apps/web/src/lib/notification-delivery.ts:43 (filters !n.seenAt) | Re-verify with one walker; restore toast from thread's pending ask state, not seenAt. |
| R2-02 | P2 | flow | Sidebar at 800 high shows 4 full chat rows (AC 6); at 720 high 3 rows with no "+N more" cue. | c16-800.png, c16-720.png | pinned Pages block in sidebar | Make Pages collapsible by default on short screens or cap its height. |
| R2-03 | P3 | copy | Investors row says "No draft made, see Ask" while the Ask button is hidden (agent panel open). | c12-b.png | Investors action items row | Say "see the Investors agent chat". |
| R2-04 | P3 | flow | Second click on Drafting is a disabled button, not "open the panel". | snapshot Drafting [disabled] | Investors action items | Keep enabled, open panel. |
| R2-05 | P3 | visual | Burn detail page: Out and Revenue end rings at Oct* are 8 px apart and overlap. | c13-m.png | Burn detail chart | Offset or draw one marker. |
| R2-06 | P3 | visual | Quarter view draws an unlabelled Financing ring at Q4 (Month/Week label it). | c13-quarter.png | Finance chart | Label or omit. |
| R2-07 | P3 | visual | GTM Email destination breaks mid-address when agent panel is open. | c18-gtm.png | GTM channels table | Allow break-all at "@" or widen column. |
| R2-08 | P3 | copy | Cmd+K "gtm" still returns page GTM and bot GTM agent. | c18-cmdk3.png | command palette | Decide if bot row should hide for page agents. |
| R2-09 | P3 | perf | `wait --load networkidle` never settles on Fundraising and Artifacts (page keeps polling); 20-30 s each. | loop timed out | Fundraising/Artifacts polling | Check for long poll/stream. |
| R2-10 | P3 | flow | Email agent "Draft a reply" ended "Done, 2 tools" with no visible text; approval card only came as toast. Observed once. | draft2.png | EmailAgentPanel | Show the pending card in panel on completion. |
