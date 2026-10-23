# Walk J3: phone width (375x812) sweep

Target: demo stack web :5381, user mock-founder. Screenshots: /tmp/uxloop20/J3/.

Limits of this walk:
- agent-browser could not emulate `pointer: coarse` (the `--args` flags and the iPhone 16 preset both left `matchMedia('(pointer: coarse)')` false, `maxTouchPoints` 0). Every touch-target size below was measured without coarse emulation, so by the Pass-7 rule it is not a finding. The app's global `@media (pointer: coarse)` rule (styles.css:88) sets 44 px min-height on buttons, tabs, selects and inputs, and was not exercised. The Pass-17 "Finance chart scrolls sideways on touch with 44 px month targets" was also not verifiable.
- The demo stack went down for about 12 minutes mid-walk (connection refused on :5381 and :3308). It came back reseeded and I signed in again. Not an app defect.
- Page overflow X was 0 on every screen checked (sign-in, Inbox, mail, Finance, Data room, chat, Settings).

## Stories

| Story | Verdict | Steps actual/ideal |
|---|---|---|
| Phone sign-in | PASS | 4 / 4 (open, Sign in, fill, submit). Lands in Chief chat. |
| Sidebar drawer navigation | PASS | 2 / 2 (Open navigation, tap page). Drawer lists pages, bots, Integrations, account. |
| Inbox triage (open mail, archive, undo toast) | PASS | 4 / 4 (drawer, Inbox, row, Archive). Undo toast shown. |
| Finance overview | PASS with P2 | 3 / 3. Header meta line is cramped (J3-01). |
| Data room browse and preview | PASS | 4 / 4 (drawer, Data room, row, preview dialog). Mock file has no real preview, only Open/Download. |
| Agent chat with approval | PASS | 4 / 4: send message, toast Open, pick From account, Send. Result "Mail Sent". |
| Settings | PASS | 3 / 3 (account menu, Settings, section select). |

## Findings

| id | page | sev | category | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| J3-01 | Finance | P2 | visual | Observed. Under the title, company name truncates to "Northwind ...", "synced j..." truncates, and "1 non-USD transaction not counted" wraps to three lines beside a 24 px refresh icon. Expected one clean line. | /tmp/uxloop20/J3/13-finance.png | apps/web/src/pages/Finance.tsx:404 (header meta) | On phone, drop the company picker and wrap meta as one line "Synced 3:57 PM" with the non-USD note on its own row. |
| J3-02 | Chat, ask card | P3 | copy | Observed. After tapping "Name Bolt Freight" the card collapses to "Answered" and no longer shows which option was chosen. | /tmp/uxloop20/J3/19-after-send.png | apps/web/src/components/AskCard.tsx (answered state) | Show the chosen answer under "Answered". |
| J3-03 | Mail approval card | P3 | flow | Observed. "Send" is disabled until an account is picked, and the only cue is the "Choose an account" select. Header text "Mail Needs approval - priya@quill-..." truncates. | /tmp/uxloop20/J3/21-approval.png | apps/web/src/components/MailApprovalCard.tsx:357 | Show "Choose an account to send" when Send is disabled; drop the recipient from the truncated header since To is shown below. |
| J3-04 | Settings, General | P3 | visual | Observed. The "Blocked. Allow notifications..." description under Browser notifications starts at the switch's left edge, not under the label text. | /tmp/uxloop20/J3/25-settings.png | apps/web/src/components/NotificationSettings.tsx:64-80 | Indent the description to the label column. |
| J3-05 | Sidebar Create menu | P3 | copy | Suspected conflict with Pass-8 decision. The + menu offers "New space" for a user with one space and one member. The decision hides "Personal" and "New space" until a second space or member exists (may apply only to the sidebar list). | /tmp/uxloop20/J3/17-create.png | apps/web/src/components/SidebarPages.tsx (Create menu) | Hide "New space" in the Create menu under the same condition, or confirm the decision covers only the list. |
| J3-06 | Inbox, first load after sign-in | P3 | visual | Observed once, not reproduced. A wide white focus ring wrapped the hamburger, title and Cleanup button while the "Next" tour button was the active element. | /tmp/uxloop20/J3/04-inbox.png | unknown | Check that no header wrapper takes focus when the tour is open. |

## Praise
- Phone sign-in, Chief landing chat, drawer and settings sheet are clean, with no overflow and no wrapped controls.
- The approval flow is short: toast sits above the composer, composer says "Waiting for approval", "Open Inbox agent" goes straight to the card, and the sent card reads "Mail Sent".
- Inbox rows, the To do card and the "Show N more" control read well at 375 px.
