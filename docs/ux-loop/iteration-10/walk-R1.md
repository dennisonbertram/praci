# Walk R1: verify pass-9 clusters C1-C10 (mock demo stack, 1440x900 and 375x812 touch)

Method: seeded demo user (Maya) plus one fresh sign-up (Walker R1) for new-user checks. Phone checks used CDP touch emulation (pointer: coarse true). Screenshots in /tmp/uxloop10/R1/. The demo account is shared with other walkers, so some approvals and chat previews came from them.

## Verdicts

| Cluster | Verdict | Criteria (met / not met / partly) |
|---|---|---|
| C1 approval toasts | PASS (one part unverified) | Position: met (bottom-right on desktop, above content on phone; no header, dialog-close or primary button overlapped on Inbox, Finance, Legal, Fundraising, Settings, email dialog; Data room not probed with a toast). Tap opens approval card in one tap: met (toast removed as the chat opened). Not shown while chat open: met. Three approvals show one toast ("3 need approval"): met. Removed within 2 s of being answered: partly, I discarded in a second tab and the toast was still there after about 3 s; later it read "2 need approval" and I could not separate my approval from other walkers' |
| C2 Chief status card contrast | PASS (code and tokens only) | No `text-white` in transcript.tsx: met. Contrast text-foreground on bg-muted: 15.2:1 light, 12.9:1 dark: met. The card block did not appear in any live Chief reply on the demo, so I did not see it rendered |
| C3 Chief and Mercury | PASS (2 of 3 states) | Bank connected with agent: Chief showed "Messaged Finance agent" and answered cash and runway: met. Nothing connected (fresh user): "No bank is connected yet. Connect one under Integrations": met. Bank connected without agent: BLOCKED, the demo has no such state; unit test not run |
| C4 Inbox stability | PARTLY | Rows 153..381 did not move for 22 s after first paint (seeded user); after a To do card existed, reload showed it in the first paint and rows stayed at 354..582 for 12 s: met. Tabs hidden before sorting is allowed, stalled-sort retry, 375px tap within 10 s: not testable (demo mailbox is already sorted; a fresh user has no mail, needs Gmail OAuth: BLOCKED) |
| C5 Activity squeezes sidebar | PARTLY / FAIL | 1440: all 8 Pages rows visible: met. Chat rows visible: 2.5 (Chief, Investor Relations, Finance helper cut off by the footer), need 5: not met. Roster scroller bottom equals footer divider (785 vs 785): met. 375: 4 chat rows visible: met. A heading with no row beneath it: not seen |
| C6 payment approval label | PARTLY | Mercury agent row reads "Needs your answer" for a pending payment approval (another walker's): met. One definition of "Needs your answer" (roster-status.ts:15): met. "Needs you" gone as a heading: not met (Activity still shows the "Needs you" heading, ActivityList.tsx:173; transcript.tsx:1831 still compares against "Needs you") |
| C7 SAFE consistency | FAIL | Investors cap table lists Priya, Lee, Sora, Tomas ($350,000); the "SAFEs, if converted" block on the same page and Fundraising list Quill Capital and Harbor Angels ($300,000): not met. "Equity raised" is still a bare dash with SAFEs present: not met. Contacts right column dash has no header: not met |
| C8 empty states | FAIL | Fresh user: Investors shows grey placeholder rows plus Connect Carta, Use a Google Sheet, Type it in, Add contact, New update; Fundraising is entirely grey bars with Start a round and Add prospect: not met. User with a SAFE and no round (seeded): Round and Pipeline still grey bars: not met. Draft reply: button turns disabled but the label stays "Draft reply" with no spinner for 20 s: not met. 1920 width not measured |
| C9 phone row actions | PASS | Every roster row has "Actions for X", 44 x 44 px, opens the full menu (Pin, Move to, Mark as unread, Bot settings, Routines, Duplicate, Clear, Archive, Delete). Row tap opening the chat: not separately tapped |
| C10 single-space heading | PASS | Fresh one-space account: no Personal heading, chevron or menu; "Personal" text on none of Inbox, Finance, Legal, Investors, Fundraising, Contacts, Data room, Artifacts. Second-space return (unit test) not run. Seeded Maya shows a "Northwind Robotics" heading with a lock and menu, which is expected for a shared space |

Steps: not scored against catalog Ideal paths, because this run verified acceptance criteria rather than catalog stories.

## Findings

| id | story/page | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| R1-01 | C5 Activity | P2 | visual | Observed. With Activity open at 1440x900 the chat list shows about 2.5 rows (Chief, Investor Relations, half of Finance helper); the criterion asks for 5. Pages rows now fit, but Activity (about 160 px) and the Northwind heading take the rest | /tmp/uxloop10/R1/c5-1440.png | apps/web/src/pages/Shell.tsx (Pages/Activity height split near :4347-4391) | Give chat rows a minimum of 5 rows by capping the Activity block at 2 rows or letting Activity scroll inside a shorter box |
| R1-02 | C6 Activity | P3 | copy | Observed. The Activity heading and the transcript state still say "Needs you" while rows say "Needs your answer", so the C6 grep criterion fails | c5-1440.png; apps/web/src/pages/ActivityList.tsx:173, apps/web/src/pages/shell/transcript.tsx:1831 | those lines | Change the heading to "Needs your answer" and use the one shared label |
| R1-03 | C7 Investors/Fundraising | P1 | bug | Observed. Same SAFEs, different holders and totals: Investors cap table lists four Carta holders ($350,000), the conversion block and Fundraising list Quill and Harbor ($300,000). Equity raised is a bare dash. A founder cannot tell what has been raised | /tmp/uxloop10/R1/c7-inv.png, c7-fund.png | apps/web/src/pages/Investors.tsx, apps/web/src/pages/Fundraising.tsx (SAFE sources) | Build both pages from one SAFE list and show "SAFEs $X" in Equity raised |
| R1-04 | C8 Investors/Fundraising empty | P1 | visual | Observed. Grey static bars read as a loading state that never ends on a fresh Investors page and a fresh Fundraising page, and on Fundraising for a user with SAFEs but no round. Investors also shows three add options plus Add contact and New update at once | /tmp/uxloop10/R1/n-Investors.png, n-Fundraising.png, c7-fund.png | apps/web/src/pages/Investors.tsx, Fundraising.tsx (skeleton shown for empty data) | Replace the bars with one sentence and one primary button when there is no data |
| R1-05 | C8 Draft reply | P1 | flow | Observed. After clicking Draft reply the button greys out but keeps its label and shows no spinner for 20 s, so it looks frozen | script output; /tmp/uxloop10/R1/c8.png | apps/web/src/pages/Investors.tsx action items (:630 area) | Show "Drafting..." with a spinner while the draft runs |
| R1-06 | C1 phone drawer | P2 | visual | Observed at 375 touch. An approval toast sits over the open navigation drawer, covering the last chat rows, their Actions buttons and the Integrations row (toast 586-724 px, Integrations about 725 px) until dismissed | /tmp/uxloop10/R1/m2.png, m3.png | packages/ui-web/src/components/ui/notification-toaster.tsx | Hide approval toasts while the drawer is open, or lift them above it and dock them under the header |
| R1-07 | C1 desktop | P3 | visual | Observed. The bottom-right toast (976-1424 x 706-804) hides row actions (the three-dot button and status chip of the last Fundraising SAFE row, and the right edge of the Settings Account rows) until dismissed. Not a header or primary button, so it meets the criterion | c7-fund.png, c1-set.png | notification-toaster.tsx | Add bottom padding to scrolling pages when a toast is visible, or let the toast collapse to its icon after a few seconds |
| R1-08 | C1 | P3 | copy | Observed. The toast timestamp still reads "just now" about 40 s after it appeared | probe output at about 40 s | AppToaster.tsx | Tick the relative time |
| R1-09 | Chat page | P3 | visual | Observed. The "1 new message" pill overlaps the last text bubble at the chat bottom | /tmp/uxloop10/R1/s1.png, s2.png | apps/web/src/pages/shell/transcript.tsx | Keep the pill above the composer chip, not over text |
| R1-10 | Sidebar page agents | P3 | flow | Observed in the demo. Finance agent shows "Waiting for the model..." and Legal agent "Working..." for 10+ min with no end (demo has no model key; may not occur in real use). Suspected demo-only | roster text probe | n/a | Show a stalled run as "Stalled" after a time limit |

## Excellent

- Chief handed a cash question to the Finance agent and answered with the real figures and a link.
- Toast grouping ("3 need approval") and one-tap open of the approval card work.
- Phone row action buttons are 44 x 44 and the menu is complete.
- Fresh account sidebar is clean, with no Personal heading and no Personal text on any page.

## Not covered

Data room with a live toast, 1920 width cap table, Mercury-connected-without-agent state, Inbox gating of tabs and stalled-sort retry, second-space heading return.
