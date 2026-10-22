# Walk J1: long journeys (first run, Monday inbox, runway check)

Session uxl14-J1, demo stack web 127.0.0.1:5381, 1440x900. Account: fresh sign-up with an invented user (the seeded login and its password were not used). Screenshots in /tmp/uxloop14/J1/. Demo mailbox is shared, so the new user saw the seeded mock mail (the "to" line shows the mock founder address; demo artifact, not reported).

## Story verdicts

| Story | Verdict | Steps actual / ideal | Notes |
|---|---|---|---|
| STORY-APP-309 (sign-up to first answer) | PARTIAL (model step BLOCKED) | 7 / 6 | Demo has a default model, so "Connect a model" and its pop-up/false-start steps never appeared (STORY-APP-307 path). "Connect your apps" did not appear either; Chief's card offered Gmail/Calendar Connect instead. Sign-up (3 fields + Create) to Chief, answer card, ask, Allow consent, answer: clear, no dead end. |
| STORY-APP-209 (first day to "when do we run out?") | PASS | 14 / 14 | Run my company -> Connect Gmail (instant on emulator) -> ask (consent card, Allow) -> Chief says no bank, "Open Finance" link -> Finance empty -> Add account -> Mercury -> dashboard in under 5 s -> ask again -> Chief delegates to Finance agent, ~40 s -> "24.6 months, November 10, 2028", identical to Finance Runway 24.6 mo / November 2028 (the old 8 vs 7.9 mismatch is gone). Carta step is now Investors "Connect Carta / Google Sheet / Type it in". |
| First-run tour (STORY-APP-317/319) | PASS | 9 / 9 | Tour opened only after the first Chief exchange, on the next page (Finance), not on landing. Fixed card position, each card names its item, ring on target, Back/Next, last stop "Done" with "Ask Chief" chip. |
| STORY-INB-022 (first morning) | PASS with friction | ~12 / 18 | First sync about 70 s of skeleton, then "Sorting your mail..." about 30 s, then To do + Needs reply (5 rows, "Show 15 more"). Reply to Morgan: Reply, type, Send, "Sending... Undo", thread shows "Later in this conversation", row moves to "Other mail today", the related To do item disappears. Suspicious-mail, rate-limit parts not seeded. |
| STORY-INB-109 (Monday reset) | PARTIAL | 8 / 24 | Walked Needs reply, open/reply, Newsletters, Digest (5 senders, "Archive all 8 messages"), Cleanup. Spam tab, 340 unread and 6 preselected Cleanup senders are not seeded: Cleanup said "Nothing to clean up". Rest SKIPPED (no data). |
| STORY-APP-024 (Monday across the app) | PASS with notes | 10 / 10 | Inbox, mail, Data room Import > From email (auto-add toggle off), Finance, Investors, Chief, Cmd+K, Activity, Legal, Artifacts all reachable. Story text says Artifacts is in the user menu; it is now a sidebar row (catalog stale). |
| STORY-APP-211 (board prep) | PARTIAL | 9 / 12 | Done: reply, Finance runway, Data room, Legal, Hide amounts (Finance, Chief thread, Inbox rows all masked; "Amounts hidden - Show" shown), Cmd+K. Not done: Carta agent (no cap table), Legal deadline Done (no Legal data), live new-mail notice. |
| Phone-width, real OAuth, model sign-in pop-up | BLOCKED/SKIPPED | n/a | Out of group scope or needs real providers. |

## Findings

| ID | Sev | Cat | Story/page | What happened vs expected | Evidence | Suspected code | Proposed fix |
|---|---|---|---|---|---|---|---|
| J1-01 | P1 | bug | APP-211, APP-145 (Hide amounts + Cmd+K) | OBSERVED: with Hide amounts on, Cmd+K search for "runway" shows the Chief result snippet "...monthly burn of $65,858. Cash totals $1,62..." in clear. Chat, Finance and Inbox are masked; the palette is the leak, which matters on a board call. Expected: masked like everywhere else. | /tmp/uxloop14/J1/39-cmdk.png vs 37-chief-hidden.png | apps/web/src/pages/Shell.tsx:583 (`detail: plainSnippet(hit.snippet)`) | Pass the snippet through `maskCurrencyWhenHidden` (lib/hide-amounts-preference.ts:68) when Hide amounts is on. |
| J1-02 | P2 | flow | INB-022 step 13 | OBSERVED: after sending a reply to Morgan, the row sits in "Other mail today" still tagged "Needs attention". She already answered it. Expected: tag cleared or changed once her reply is sent. | 38-inbox-hidden.png | apps/web/src/components/inbox/InboxRow.tsx:231 (badge from stale triage state) | Drop the attention badge when the newest message in the thread is the user's own sent reply. |
| J1-03 | P2 | flow | Legal (new user, no contracts) | OBSERVED: empty Legal shows a table header (Contract, Parties, Term, Renewal, Value, Next deadline) over a blank area, tabs "Contracts 0 / Deadlines 0 / Graph", and one underlined link "1 Data room document not yet checked by Legal" with no empty-state sentence. Expected one line saying what Legal fills with and a clear action. The link looks like body text, not a button. | 30-legal.png | apps/web/src/pages/Legal.tsx:375 | Replace the empty table with a short empty state and make the unchecked-documents notice a button ("Check now"). |
| J1-04 | P2 | perf | INB-022 first morning | OBSERVED: first Inbox load shows grey skeleton rows for about 70 s ("First sync can take a minute"), then rows appear with "Sorting your mail..." for another 30 s. No progress or count. Honest copy, but Maya's first impression of the Inbox is a minute of nothing. Demo emulator may be slower than Gmail (SUSPECTED). | 13-inbox.png, 15-inbox3.png, 16-inbox-sorted.png | apps/web/src/pages/Inbox.tsx:1662 | Show rows as soon as the first page of headers arrives, and keep "Syncing" as a status line instead of full skeleton. |
| J1-05 | P2 | flow | First-run tour (APP-317/319) | OBSERVED: the tour did not open on landing in Chief. It opened on the next page (Finance, after "Open Finance") and covered no Chief screen. Maya answered the first-question card (not dismissed it), so this may follow the decision "tour offered when the card is dismissed", but answering the card then never offers it on Chief. Expected: tour offered once at a predictable moment. | 08-finance-empty.png | tour trigger in apps/web/src/pages/Shell.tsx (search `tourSeen`) | Also offer the tour after the first card is answered, or state the trigger in the catalog. |
| J1-06 | P3 | visual | Investors (new user) | OBSERVED: static grey placeholder bars for Fully diluted, Equity raised, Holder rows and Contacts rows never resolve; they read as stuck loading. By design (`Skeleton static`, components/investors/Placeholders.tsx) and Investors is owned elsewhere, so low severity. | 33-investors2.png, 34-investors3.png | apps/web/src/components/investors/Placeholders.tsx | Dim the placeholders further or add one sentence under the three connect buttons. |
| J1-07 | P3 | visual | Finance, Subscriptions table | OBSERVED: header "Last charge" wraps to two lines ("Last / charge") while "Per month" does not; geometry audit flagged it. | 10-mercury.png | Finance subscriptions table header cell | `whitespace-nowrap` on the header or widen the column. |
| J1-08 | P3 | a11y | Data room sidebar row | OBSERVED: a small white dot appeared on the Data room row after the import (while on Legal) with no accessible name found; it cleared on visiting. Meaning is not stated (SUSPECTED: unseen change). | seen on Legal page screenshot 30-legal.png | sidebar badge code in Shell.tsx | Give the dot an accessible label and tooltip ("New files"). |
| J1-09 | P3 | perf | Chief thread revisit | OBSERVED: returning to Chief shows three grey bubble skeletons for about 3 s even though the thread was just open. | 37-chief-hidden.png (first capture) | thread loader in Shell.tsx | Keep the cached thread rendered while revalidating. |

## Praise (observed)

- Run my company card leads straight to Gmail/Calendar Connect cards; Gmail connected in under 4 s with a clear "Connected" state.
- Chief's no-bank answer ends with an "Open Finance" link, and the later answer matches the Finance page exactly (24.6 mo, November 2028).
- Hide amounts masks Chief replies, Finance, Inbox rows and shows "Amounts hidden - Show"; runway in months stays readable.
- Data room "Import > From email" is a short path to file an attachment, with the auto-add switch off by default.
- Inbox Needs reply shows five rows with "Show 15 more"; To do updates when the reply is sent.
- No horizontal overflow on any screen; no console errors; no 4xx/5xx during the walk.

## Summary

Stories: 2 PASS (APP-209, tour), 2 PASS with notes (INB-022, APP-024), 3 PARTIAL (APP-309, INB-109, APP-211), 1 BLOCKED/SKIPPED group (phone, real OAuth, model pop-up). Findings: 9 total (0 P0, 1 P1, 4 P2, 4 P3).
