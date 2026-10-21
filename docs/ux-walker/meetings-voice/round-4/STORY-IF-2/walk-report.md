# STORY-IF-2: Founder with Gmail and Granola sees both kinds of to-dos (round 4)

**Result: PASS**

Walked: Granola mockup, inbox screen Mail connected, tabs clicked live. Current plans and mockups at commit 5ebb74d16; screenshots in `screenshots/`.

Outdated or changed by the plan: Step 2: the plan says mail rows show sender plus reason and the meeting row shows only the title line; the mockup shows "Re: Q4 pricing, 9 Oct" style mail detail, acceptable.

## Steps

- Step 1: All tab: five to-dos (three meeting, two mail) in one card below the tabs, then mail rows. (g-d-inbox-mail.png)
- Step 4: Clicking the acme tab: card lists the three meeting to-dos plus the acme mail to-do, and only acme mail rows. (g-d-inbox-mail-tab-acme.png)
- Step 4: Clicking the founder tab: the same three meeting to-dos plus the founder mail to-do. (g-d-inbox-mail-tab-founder.png)
- Step 5: Back on All: everything again. (g-d-inbox-mail.png)

Geometry audit (geometry-audit.js, one run per distinct state, other screens hidden): pageOverflowX 0 in every state. The only flags are the mockup state-pill row (not product UI), the "Get a key in Granola" link and citation chips reported as wrapped controls (false positives: one line in the screenshots), and the citation popover that sits below its chip.

**390 px spot-check:** g-m-inbox-mail.png: three tabs fit at 390 with the last one near the edge; no page overflow.

## Flow Log

Actual 2 steps (open Inbox, use tabs) matches ideal 1-2.

## Round-3 findings

| Round-3 id | Status | Evidence |
|---|---|---|
| F3-IF-2-01 | fixed | Two account tabs are drawn and switching shows each account mail to-dos plus all meeting to-dos (g-d-inbox-mail-tab-acme.png, g-d-inbox-mail-tab-founder.png). |

## New findings (round 4)

None.
