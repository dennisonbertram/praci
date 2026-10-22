# Walk J3: phone width (375x812) sweep

Target: mock-data demo stack (web port 5381). Persona: Maya, first-time founder, Northwind Robotics.
Method: viewport 375x812, plus a one-shot touch emulation (pointer: coarse, 5 touch points) for each measurement, because the browser tool has no persistent touch mode. Screenshots in /tmp/uxloop17/J3/. Console was clean (only Vite debug lines).
Tooling note: the browser tool's `click` command hung on the phone layout (the page itself responded to scripted and raw mouse clicks), so interactions used raw mouse events and DOM clicks. Not an app finding.

## Story verdicts

| Journey | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| Sign-in | PASS | 4/3 | Landing then Sign in then two fields then submit. Form fits, no overflow. Touch targets on the sign-in form were not measured (already signed in before measuring). |
| Sidebar drawer | PASS | 1/1 | Opens from the hamburger, 316 px wide, all rows 44 px high under touch, no overflow. |
| Inbox triage | PASS with 1 FAIL detail | 2/2 | Open mail then Archive works and advances. The Undo toast is hidden (J3-01). |
| Finance overview | PASS | 2/2 | Tiles, chart, breakdown, upcoming, subscriptions all fit; no horizontal overflow. |
| Data room browse and preview | PASS | 3/3 | List readable. On a touch device the PDF preview shows Open and Download buttons; fine. |
| Agent chat with approval | PASS | 7/4 | New bot, message, hand-off to Inbox agent, Open Inbox agent, Send; card went Sending then Sent. |
| Settings | PASS with P2 | 3/3 | Native select switches sections (General, Privacy and approvals, Models, Memory). Switch targets too small (J3-02). |

Overflow: `pageOverflowX` was 0 on every screen audited (Chief, drawer, Inbox, Finance, Data room, Settings).
Touch targets: all buttons, tabs, menu rows and the header icons measure 44 px or more under touch, except the Settings switches (J3-02).

## Observed as excellent
- Message actions collapse to one "..." button (44x44) under touch, as decided.
- Sign-in, drawer and Finance are clean and readable at 375 px.
- The mail approval card (From, To, body, Send, Discard) fits without clipping and its state moves Sending to Sent.
- Settings uses a native select on phones, which is the right control.

## Findings

| id | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|
| J3-01 | P1 | bug | Observed. On the phone Inbox, a persistent "Legal agent needs an answer" toast sits over the "Archived ... Undo" notice. The Undo notice (fixed, bottom-4, z-100, y 760-796) is covered, so the only chance to undo an archive is invisible. Expected: Undo visible, or stacked above the approval toast. | /tmp/uxloop17/J3/s8c.png (only a card edge shows); DOM shows the notice at y=760 | apps/web/src/pages/Inbox.tsx:2038 (notice), apps/web/src/components/AppToaster.tsx and packages/ui-web NotificationToaster (approval stack) | Render Inbox undo notices inside the shared toast stack, or raise them above the approval toasts. |
| J3-02 | P2 | a11y | Measured with touch emulation. Settings switches are 32x18 and their labels are 20 px high; the 44 px row (min-h-11) is not itself tappable. Affected: Privacy and approvals (Allow AI models, per-model, Documents, Ask before sending external email, Ask before purchases), Chat display switches, Browser notifications. Expected: 44x44 tap area. | touch audit output; DOM: label 20 px high inside a 44 px row | apps/web/src/components/ApprovalRulesSettings.tsx:115, apps/web/src/pages/AccountSettingsOverlay.tsx:255-291, apps/web/src/components/NotificationSettings.tsx:64 | Make the whole row the label (or add padding to the label) so the row is the tap target. |
| J3-03 | P3 | visual | Observed. Models and Memory content starts at x=33 and x=32, while General and Privacy cards start at x=22. | /tmp/uxloop17/J3/s24-models-touch.png vs s24-privacy-touch.png | apps/web/src/pages/SettingsOverlay.tsx (section containers) | Use the same horizontal padding for every section. |
| J3-04 | P3 | visual | Observed under touch. In the Data room preview, "Source" label sits about 12 px above its value "From email", while other label/value rows align. | /tmp/uxloop17/J3/s11-touch.png | Data room preview metadata grid (apps/web/src/pages, DataRoom preview) | Align the Source row to the same baseline as the others. |
| J3-05 | P3 | visual | Observed. Finance subscriptions: the "Similar to Cursor Seats (Mock)" sub-line is indented about 12 px more than the vendor name above it. | /tmp/uxloop17/J3/s9c-fin.png | apps/web Finance subscriptions table row | Remove the extra left padding on the sub-line. |
| J3-06 | P3 | flow | Observed. After hand-off, J3 helper shows two "Open Inbox agent" controls at once (inline link and a pinned button). | /tmp/uxloop17/J3/s16-appr.png | apps/web chat hand-off card and composer area | Keep the pinned button only. |
| J3-07 | P3 | flow | Observed under touch. Inbox rows replace the unread dot with a selection checkbox, so unread shows only as bold text. | /tmp/uxloop17/J3/s6-inbox-touch.png | apps/web/src/pages/Inbox.tsx (row leading cell) | Keep a small unread dot beside the checkbox. |

Counts: P0 0, P1 1, P2 1, P3 5. Not tried: sign-in touch targets, Cleanup screen, Cmd+K on phone, Legal and Investors on phone.
