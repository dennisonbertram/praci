# Walk J3: phone width (375x812) sweep

Session uxl14-J3, mock-data demo stack (web :5381), signed in as the seeded mock founder. Touch targets were measured with touch emulation on (pointer: coarse, hover: none). Screenshots are under /tmp/uxloop14/J3/. Browser console and page errors were empty for the whole walk. First contentful paint 328 ms.

Method note: with touch emulation on, the agent-browser `click` command hangs, so interactions were done with in-page `.click()`. Those are DOM clicks, not real taps.

## Story verdicts

| Story | Verdict | Steps actual/ideal |
|---|---|---|
| Sign-in at 375 px (landing, Sign in, form, submit) | PASS | 4/4. Clean layout, no overflow, show-password toggle present |
| Sidebar drawer (open, tour, pages, account menu) | PASS with finding J3-01 | 3/3 |
| Inbox triage (list, open mail, More menu, Reply composer, Ask agent, Draft a reply, Send, Cleanup, Filter) | PASS with finding J3-03 | Open mail 2/2; reply via agent and send 4/4 |
| Finance overview (cards, period tabs, burn chart, breakdown, upcoming, subscriptions) | PASS with finding J3-02 | 2/2 |
| Data room browse and preview (list, failed row, filters, preview card) | PASS with finding J3-04 | Preview 2/2 |
| Agent chat with an approval (Inbox agent: draft card, Send, Sent; Investor Relations question card) | PASS | 2/2 from the card. Draft took 59 s (J3-05) |
| Settings (General, Privacy and approvals, Models, Memory) | PASS | 3/3 |

Geometry audit: page overflow was 0 px on every screen (Sign-in, drawer, Inbox, mail dialog, composer, Finance, Data room, preview, Settings, chat). The audit's "wrapped controls" and "spill" hits were checked against screenshots and were false positives (sticky bar with negative margins, multi-line cards, tab list). Touch-target scan: all controls in the drawer, mail dialog, composer, approval card, question card, preview card and Settings are 44 px or larger (switches are 32x18 but have a 58x44 expanded hit area, verified with elementFromPoint).

Praise: the phone mail dialog is full screen with labelled Reply / Archive / Ask agent / More, and every control is 44 px. The email-agent flow is one tap from draft card to "Sent". Needs reply shows five rows with "Show 15 more", and a replied thread leaves that list. The Settings select is a native select with a fixed-height sheet. Finance cards read at a glance.

## Findings

| ID | Sev | Cat | What happened vs expected | Evidence | Suspected location | Fix |
|---|---|---|---|---|---|---|
| J3-01 | P2 | flow | Observed. Open a chat deep in the sidebar (for example Inbox agent under Page agents), then reopen the drawer: the list is still scrolled down, so Pages (Inbox, Finance, Data room) are off-screen and the user sees only chats and must scroll up. Expected: the drawer opens at the top, or at least shows Pages. | /tmp/uxloop14/J3/dr2.png | apps/web/src/pages/Shell.tsx (mobile sidebar scroll container, near the mobileSidebarOpen handling; the scroll offset persists while closed) | Reset the sidebar scrollTop to 0 each time the mobile drawer opens. |
| J3-02 | P3 | a11y | Observed with touch emulation. Finance Subscriptions: the vendor link is 173x18 px inside a 44 px row. Other Finance links use the `rk-tap` expander. | Measured: Cloudnine Hosting (Mock) link 173x18 | apps/web/src/pages/Finance.tsx:999 (className lacks `rk-tap`, unlike apps/web/src/components/finance/ui.tsx:732) | Add `rk-tap` to the vendor link at Finance.tsx:999. |
| J3-03 | P3 | visual | Observed. Inbox Cleanup on a phone shows the hamburger and a back arrow side by side before the title, so there are two leading navigation controls. | /tmp/uxloop14/J3/in3.png | Cleanup page header in apps/web/src/pages (Inbox cleanup view) | Show only the back arrow on this sub-page, or fold it into the hamburger slot. |
| J3-04 | P2 | visual | Observed. The Data room toolbar stays fixed while scrolling and takes about 180 px (22 percent of 812) with the filters closed and about 260 px (32 percent) with Type, Party, Document date and Sort open, so only 3 or 4 file rows show. Also the "N files failed" sidebar badge opens the plain list: the failed row is 9th of 50 and there is no Failed filter. | /tmp/uxloop14/J3/d02.png, /tmp/uxloop14/J3/dfl.png, /tmp/uxloop14/J3/d03.png | apps/web/src/pages/DataRoom* toolbar (sticky container) | On phones scroll the toolbar away with the list (sticky only the search), and let the failed badge open the list filtered to failed files. |
| J3-05 | P3 | perf | Observed on the mock model only. "Draft a reply" in the email agent took 59 s ("Done - 1 tool - 59s") with "Bots are working" and a stop button as the only feedback. Probably the demo model, not representative. | /tmp/uxloop14/J3/i07-draft.png, a02-sent.png | not traced | Re-measure against a real model before acting. |

Not reported (owner decisions or checked and fine): the tour card at its fixed spot hides rows near the highlighted item on a phone; Settings fixed height; five Needs reply rows with Show N more; consent already given on this demo user so no consent card was seen at phone width (not walked).

Not covered: the "Reply with draft" Mail-card chip with an External bot, secret request card, held Share cards, voice, native iOS. No real accounts were touched. Note: the shared demo user's Inbox agent thread and a to-do were changed by my stray DOM click and one sent reply (to a .test address).
