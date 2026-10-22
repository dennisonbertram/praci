# Walk J3: phone width (375x812) sweep

Target: mock-data demo stack (web :5381). Session uxl11-J3. Screenshots: /tmp/uxloop11/J3/.
Logged in as the seeded mock founder. Chief and other chats are shared with other walkers on the same account, so some chat content I did not write appeared while I walked.

Method note: agent-browser has no touch emulation at 375 px. I emulated `pointer: coarse` through a CDP script (`Emulation.setTouchEmulationEnabled`) held open only while measuring and screenshotting, then released it, because real clicks under that emulation did not open the drawer. All touch-target numbers below were measured under `(pointer: coarse)` = true. Geometry audit run on drawer, Inbox, Finance and Data room; `pageOverflowX` was 0 on every screen.

## Stories

| Story | Verdict | Steps actual / ideal |
|---|---|---|
| Sign-in (phone) | PASS | 4 / 4 (Sign in, email, password, submit). Form fits, all targets >= 44 px, no overflow. |
| Sidebar drawer (phone) | PASS | 2 / 2 (menu, page). Every row is 44 px or taller under coarse pointer. The drawer shows only about 2.5 chats before scrolling because Pages takes eight 44 px rows (P3 note, not filed). |
| Inbox triage (open, archive, undo) | PASS | 3 / 3 (open row, Archive, Undo). Full-screen message view, back to list with an Undo toast, the unread count in the sidebar matched. |
| Finance overview | PASS | 2 / 2. Cards, chart, Breakdown, Upcoming and Subscriptions all fit without overflow; all targets >= 44 px. Space name truncates to "Northwind Rob..." (J3-03). |
| Data room browse and preview | PASS | 3 / 3 (page, row, preview). PDF preview and metadata fit; one small inline link (J3-02). A failed file shows its reason and a Delete button. |
| Agent chat with an approval | PASS with finding | 5 / 4 (open chat, type, send, wait, Allow once). Approval card works and the agent confirms; the instruction text is clipped (J3-01). |
| Settings (General, Privacy and approvals, Models) | PASS | 4 / 4. Section picker, switches (58x44 hit area via `::after`), Advanced (44 px) all usable. Consent switches match the owner decisions (one Allow AI models switch plus Documents under Advanced). |

Not walked: Legal, Investors, Contacts, Artifacts at phone width (outside my stories); real keyboard-open behavior of the composer; a real touch swipe on the drawer (no touch dispatch available).

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected code | proposed fix | status |
|---|---|---|---|---|---|---|---|---|
| J3-01 | Agent chat approval (Investor Notes, routine approval card) | P2 | a11y / flow | The instruction text on the "Review before creating the repeating schedule" card sits in a nested scroll box (`max-h-72 overflow-auto`, content 344 px in a 288 px box). On a phone it is cut mid-sentence ("...post that there are no open investor") with no ellipsis, fade or scrollbar, so Maya can approve without reading the whole prompt. The text stays clipped after she approves. Expected: show all of it, or a visible "Show all" control. | /tmp/uxloop11/J3/16-approval.png, 17b-coarse-chat.png; scrollHeight 344 vs clientHeight 288 | apps/web/src/components/AskCard.tsx:209 | Remove the max height on phones, or add a bottom fade plus "Show all". | observed |
| J3-02 | Data room preview | P3 | a11y | "From email" source link is 71x20 px under coarse pointer, below the 44 px target, in a row with no padding. | /tmp/uxloop11/J3/12-preview.png; measured 71x20 | apps/web/src/components/data-room/Preview.tsx:299-301 | Give the link `pointer-coarse:py-3` (or `min-h-11`) like the other preview actions. | observed |
| J3-03 | Finance header | P3 | visual | The space switcher label truncates to "Northwind Rob..." beside the sync chip. The name is cut though nothing else needs the room. | /tmp/uxloop11/J3/09-finance.png | Finance page header (apps/web/src/pages/Finance.tsx header row) | Let the space name take the full row on phones, or put the sync chip on its own line. | observed |
| J3-04 | Chat messages (phone) | P3 | visual | The collapsed "..." message-actions button is a faint glyph about 12 px wide inside a 44 px target; it is easy to miss as the only way to react, reply or bookmark. Target size itself is fine. | /tmp/uxloop11/J3/17b-coarse-chat.png | message actions row in apps/web/src/components/ (chat thread) | Raise the glyph contrast to the muted-foreground token used for time stamps. | observed |

Counts: P0 0, P1 0, P2 1, P3 3.

## Praise

- Drawer, Inbox dialog, Finance, Data room preview, approval card and Settings all pass the 44 px target check under coarse pointer, with no page overflow at 375 px.
- Large invisible hit areas on small checkboxes and switches (`::after` inset) are done correctly: visual size 18-20 px, tap area 44 px or more.
- Archive returns to the list with an Undo toast and the sidebar unread count stays correct.
- The approval card shows Allow once as a full-width 44 px primary button, with Deny next to it, and the agent's confirmation after approving says exactly what was created and that nothing is sent to investors.
- Sign-in on a phone is clean: no small targets at all.

## Tooling note (not an app finding)

A plain agent-browser click on "Open navigation" did not open the drawer while `pointer: coarse` emulation was active, but works without it and by DOM click. I treat this as an emulation artifact (mouse events with touch media), not an app defect, and did not file it.
