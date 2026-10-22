# Walk J3: phone width (375x812, touch emulation)

Target: mock-data demo stack (web :5381). Session uxl16-J3. Touch emulation was set through CDP (Emulation.setDeviceMetricsOverride mobile + touch); `matchMedia('(pointer: coarse)')` was true for all measurements. Screenshots: /tmp/uxloop16/J3/ (01 to 40).
No catalog story IDs were walked literally: the assignment was a phone sweep of the core journeys. Journey ideal steps are my estimate.

## Journey verdicts

| Journey | Verdict | Steps actual / ideal |
|---|---|---|
| Sign-in (landing, Sign in, form, submit) | PASS | 4 / 4 |
| Sidebar drawer (open, page rows, chats, account menu) | PASS with P2 | 2 / 2 |
| Inbox triage (list, open mail, Archive, Undo toast, row menu) | PASS | 3 / 3 |
| Finance overview (cards, chart, breakdown, upcoming, subscriptions) | PASS (P3 polish) | 2 / 2 |
| Data room browse and preview (list, open row, preview, full screen) | PASS (P3 polish) | 3 / 3 |
| Agent chat with approval (New bot, ask to send mail, find card, Send) | FAIL | 9 / 5 |
| Settings (account menu, General, Privacy, Models, Memory) | PASS | 3 / 3 |

Not covered: Legal, GTM, Investors/Fundraising, Contacts, integrations connect, the Cleanup screen, the first-run tour beyond step 2.

## Measurements (coarse pointer)

- Horizontal page overflow: 0 px on every screen checked (sign-in, drawer, Inbox, mail dialog, Finance, Data room, chat, Settings).
- Touch targets under 44 px: drawer page rows (Inbox, Finance, Legal, Investors, Fundraising, Contacts, Data room, Artifacts) are 295x40. Finance chart bar buttons are 33 px wide. Inline chat links are 21 px high. Everything else measured (inbox rows and More buttons, mail dialog buttons, tabs, preview toolbar, Stop / Try again, Send / Discard, menu items, Settings switches via their row) is 44 px or more.
- Geometry audit "wrappedControls" hits on Inbox tabs, Finance range tabs and Settings buttons were false positives (single line in the screenshots). "unevenRows" hits were deliberate title/time rows.

## Praise

- Landing and sign-in are short and clear; no overflow.
- Phone Inbox: pile tabs, "Needs reply" with "Show N more", full-width mail dialog with labelled Reply / Archive / Ask agent, Undo toast after Archive. Row More menu items are 44 px and name the "All mail from" effect.
- Finance cards, breakdown and upcoming list read well on one column.
- Preview dialog actions are all 44 px with accessible names; the stuck "Thinking 4m 38s" run offers Stop and Try again.
- New bot flow is one field.

## Findings

| ID | Sev | Cat | What happened vs expected | Evidence | Suspected code | Proposed fix |
|---|---|---|---|---|---|---|
| J3-01 | P1 | flow / copy | Observed. Asked a new bot to send a mail; the Inbox agent's approval card (Send / Discard) worked, but Send failed. The card shows "Not sent" with raw tool text "Pass account (the address from the row's acct: field) when more than one mail account is connected", and the agent says the draft "can be opened in the composer", but no Open in composer button exists on the card. Expected: plain wording, and either an account choice or a working recovery button. | 32-sent.png, 40-ask.png | packages/adapters/src/mail-tools.ts:703 (message); apps/web/src/pages/shell/transcript.tsx:1768 (onOpenComposer only passed when the card has connectionId or accountFromThread); apps/web/src/components/MailApprovalCard.tsx:476-486 | Resolve the account on the server (or ask which one) before sending, show a plain sentence instead of the tool error, and always offer Open in composer on a failed card. |
| J3-02 | P2 | a11y | Observed (coarse pointer). The eight page rows in the drawer are 295x40 px, under the 44 px target the rest of the drawer meets (Actions buttons, Create, Activity are 44). | 07-drawer.png; measured via getBoundingClientRect | apps/web/src/pages/Shell.tsx (page row around line 4674) | Make page rows min-h-11 on coarse pointers. |
| J3-03 | P2 | flow | Observed. In the originating chat the composer says "Waiting for approval", but the approval card is only in the Inbox agent's thread; the chat shows an inline "Open Inbox agent" link and a toast about a different agent ("Legal agent needs an answer"). Maya has to guess where to approve. Also the link is two 21 px lines on a phone. | 29-approval.png, 31-inbox-agent-thread.png | apps/web/src/pages/shell/transcript.tsx (rk-chat-app-link) | Show the pending Mail card (or a button "Review email") inside the delegating chat, or make the composer placeholder name where approval is needed. |
| J3-04 | P3 | visual | Observed. On the failed Data room row the Delete button floats inline beside the folder tag, above the red "isn't a readable PDF" line. It looks like a tag, not an action. | 18-dataroom.png | Data room row component (apps/web/src/components/dataroom) | Put Delete on its own line under the error, or inside the row More menu. |
| J3-05 | P3 | visual | Observed. In the Finance burn chart the partial October point is two stacked small circles that read as an "8", and the "Financing, Oct, $250,000" label sits flush against the right edge. | 17-chart.png | Finance burn chart component | Draw October as a single dashed segment or labelled dot; inset the label by 8 px. |
| J3-06 | P3 | a11y | Observed. Finance chart bar buttons are 33 px wide (134 to 154 px high). | touch audit on 13-finance.png | Finance burn chart | Widen hit areas to 44 px or rely on the Month list. |
| J3-07 | P3 | flow | Observed, cause suspected. While reading the Inbox, the Needs reply group changed from "5 unread, Show 1 more" to "7 unread, Show 12 more" and Earlier dropped from 5 to 3 unread, with no action from me (likely background AI sorting). Rows move under the finger. | 11-rowmenu.png, 12-inbox-after.png | Inbox list grouping | Hold group changes while a menu or dialog is open, or announce "N sorted" once. |
| J3-08 | P3 | flow | Observed once. After the first-run tour reached 2/9 (card covers the composer, steps point at drawer controls while the drawer is closed after a resize), a reload removed the tour with no skip. | 04-drawer-tour.png, 05-tour2.png, 06-reload.png | tour state in Shell.tsx | Keep the tour step across reloads or restart it from the account menu (Take the tour exists). |

Counts: P0 0, P1 1, P2 2, P3 5.
