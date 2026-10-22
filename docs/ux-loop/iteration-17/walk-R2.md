# Walk R2 (uxl17-R2): verify pass-16 fixes C11-C20

Demo stack, 1440x900 (C13 at iPhone 14 emulation). Seeded user mock-founder; a fresh invented user (walker-r2) was used for the first-sort test. Screenshots: /tmp/uxloop17/R2/.

## Verdicts (clusters are not story ids; each cluster's acceptance criteria were checked)

- C11 Settings Escape / open while loading: PASS (steps 4/3). Settings opened in under 0.4 s while Finance helper was still "Thinking"; Escape closed the Memory section in one press.
- C12 First sort and Needs reply share: FAIL (partial). Steps 3/3 (Connect mail, Done, Allow). First sort took 56 s after Allow (target 30 s), but the "First sync can take a minute" note shows by 15 s, which meets the alternative. Needs reply holds 19 of about 28 mails (about 68%, target under 40%) for both the seeded and the fresh user. "Rows do not move under an open menu": not tested.
- C13 Data room PDF preview on phone: PASS. At 390 px the preview shows a document icon with Open and Download, no empty frame.
- C14 Delegate approval button: SKIPPED. Payment writes are off by default and payment flows must not run on shared threads. Not exercised.
- C15 Settings and bot-panel hierarchy: PASS. Models uses the same card as General; expanded Advanced is indented about 25 px with a left rule; an 83-character bot name keeps a one-line truncated panel header. General's two selects now match.
- C16 Sidebar and Activity polish: PASS (desktop). The Working state does not change row height; Activity panel is about 125 px of a 385 px list. Phone items not checked.
- C17 Payment copy: SKIPPED/BLOCKED. A payment request on Finance agent answers "I haven't paid it... Turn on Allow changes ... under Integrations", which is a writes-off message where the Integrations link fits. The no-recipient path needs writes on and was not run.
- C18 Space name and SAFE note: FAIL (partial). Contacts, Artifacts and Investors now show the space name. Fundraising does not (shows only "Mercury - just now"). The empty-SAFE note could not be tested because the demo now has Mercury SAFEs.
- C19 Cold load: FAIL. One cold load of /app/inbox made 6 bots/list, 14 routines/list and 3 bootstrap calls (target 2/2). Search titles tested only with short titles (not truncated). Skeleton wait words: Integrations showed bare skeleton cards for over 10 s.
- C20 Integrations first frame: PASS for search and chips (present in the first frame, with the cards skeleton). Carta still uses a letter tile.

## Findings

| id | severity | category | observed/suspected | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R2-01 | P2 | flow | observed | First sort took 56 s after Allow for a fresh user; expected under 30 s | c12-wait15.png, c12-sorted.png | apps/api inbox triage job start | Start triage on the Allow click and log time to first result |
| R2-02 | P2 | flow | observed | 19 of about 28 mails sit under Needs reply (about 68%), target under 40% | c12-inbox.png, c12-sorted.png | triage prompt/threshold in apps/api | Mark Needs reply only for mail that asks a question |
| R2-03 | P3 | perf | observed (dev server, StrictMode may double) | Cold load makes 6 bots/list, 14 routines/list, 3 bootstrap | network log of /app/inbox | apps/web/src/pages/Shell.tsx and sidebar hooks | One shared query per key |
| R2-04 | P3 | visual | observed | Fundraising header has no space name; Contacts table ends at 1240 px while header spans 1412 | c18-fundraising.png, c18-contacts.png | apps/web/src/components/PageHeader.tsx, Fundraising page | Add the space name to Fundraising; let the Contacts table fill the width |
| R2-05 | P3 | visual | observed | Carta tile is a gray letter "C" among logo tiles | c20-full.png | Integrations tile component | Add a Carta logo |
| R2-06 | P3 | flow | observed | "Show 14 more" in Inbox shrinks the To do card from 2 items plus "2 more" to 1 item, shifting the list up | c12-inbox.png vs c12-expand.png | apps/web/src/pages/Inbox.tsx To do dedupe | Keep the card stable or explain; hide only todos already shown as row chips without a layout jump |
| R2-07 | P3 | flow | observed | Finance helper stayed at "Thinking" past 1m45s with no stall words (demo server was loaded) | c15-panel.png, c16-act.png | chat transcript thinking indicator | After about 30 s show "Taking longer than usual" |
| R2-08 | P3 | visual | observed | Long bot name wraps the sidebar row title to two lines plus status (row grows) | c15-long.png | Shell.tsx sidebar chat row | Clamp title to one line |
| R2-09 | P3 | perf | observed | Integrations grid stays skeleton for over 10 s with no words | c20-first.png, c20-full.png | Integrations page | Show "Loading integrations..." after 2 s |

Praise: Settings Memory/Escape, Models card and Advanced indent are clean; Investors header and Equity raised ($250,000 with $50,000 committed) read well; the 15 s sync note is helpful.

Not covered: C14, C17 no-recipient path, row movement under an open menu, phone items of C16.
