# Walk J3: phone width (375x812) sweep

Session uxl10-J3, demo stack (web 5381), seeded mock founder (signed in with the password read from the local credentials file, never printed). Screenshots: /tmp/uxloop10/J3/.

Method: agent-browser at 375x812 with an iPhone user agent, plus CDP touch emulation held open by a helper process (`matchMedia('(pointer: coarse)')` true, maxTouchPoints 5). Touch targets were measured under that emulation, and tiny visible controls were hit-tested with `elementFromPoint`. The geometry audit and a target-size script ran on every screen. pageOverflowX was 0 everywhere.

Tool limits: `click` and `mouse` commands hang under touch emulation, so I used `tap` (works) and Enter to submit sign-in. Agent-browser wheel scroll and a CDP touch swipe did not move the Finance page, so I scrolled it by setting scrollTop; real finger scrolling on Finance is UNVERIFIED. The demo user is shared, so approvals and counts changed while I walked (other walkers).

## Story verdicts

| Story / journey | Verdict | Steps actual/ideal |
|---|---|---|
| Sign-in (landing, form, submit) | PASS | 4/3 (Sign in link, email, password, Enter). Clean form, targets 44+ |
| Sidebar drawer (STORY-APP-009, 121) | PASS with findings | 1/1 to open; every row 44+; aside is inert when closed. See J3-05, J3-06 |
| Inbox triage (STORY-INB-031) | PASS | open, row More menu (Archive, Mark read, Spam, Trash, Mark important, Mark noise), open mail full screen with Reply, Archive, Ask agent. Checkbox visual 16-20px but hit area is 44+ |
| Email agent panel, held Mail card (STORY-INB-134 area) | FAIL (minor) | Ask agent opens a full-screen panel; Send went through ("Sent", agent confirms). The Draft a reply chip is hidden behind the approval toast: J3-02 |
| Finance overview | PASS | 2/2; all controls 44+, no overflow; scrolling by finger UNVERIFIED |
| Data room browse and preview (STORY-DRM-030) | PASS with findings | list, tap row, preview sheet, Full screen now shows the PDF viewer (the iteration 9 J3-02 problem is gone). See J3-07 |
| Agent chat with approval (Mercury "Send $1,200") | PASS | toast "N need approval" opens the chat, card has stacked full-width Send / Deny, Approved state shows, toast count drops |
| Settings (General, Privacy and approvals, Models, Memory) | PASS | switches 32x18 visually, hit area 44+ (hit test); one toast overlap, J3-01 |
| Command palette from drawer Search | PASS | iteration 9 J3-01 is fixed: palette input has focus |

Praise: the touch pass is clean. Under pointer: coarse, no control I measured on any screen is under 44px or has a hit area under 44px. The approval toast leads straight to the card in one tap, and the Mail card Send gives a clear Sending, Sent, agent confirmation sequence.

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| J3-01 | Drawer account menu, Settings, Data room preview (phone) | P2 | bug | OBSERVED: the persistent approval toast (z-110, bottom-24 on phones) sits above menus and dialogs. In the open account menu it covers "Log out" (elementFromPoint at its centre returns the toast), and it covers the lower part of Settings, the Data room preview, and the command palette. Expected: Log out and dialog content always reachable. | 27-acct.png, 28-settings.png, 23-preview.png, 31-palette.png | packages/ui-web/src/components/ui/notification-toaster.tsx:301 (viewport `z-[110]`, `max-sm:bottom-[calc(env(safe-area-inset-bottom)+5.5rem)]`) | Hide or lower the approval toast while a menu, dialog or the drawer is open, or give the account menu bottom padding for it. |
| J3-02 | Email agent panel (phone) | P1 | bug | OBSERVED: with a pending approval, the "Draft a reply" suggestion chip (bottom-left of the panel) is partly behind the toast; agent-browser refused the tap ("covered by span"). The only one-tap action in the panel is unreachable until the toast is dismissed or answered. | 38.png, 40.png | same toast viewport; email agent panel suggestion row above the composer | Reserve space above the composer for the toast stack (push content up), or place the chip row above the toast. |
| J3-03 | Email agent panel, held Mail card (phone) | P2 | flow | OBSERVED: right after Draft a reply, a toast "[MOCK] Quick question on the hiring plan needs approval" appeared while that chat was open and showing the same card. Owner decision says toasts clear when their chat is open. It also overlaps the card's bottom edge. SUSPECTED: the open-chat check compares the email chat to the toast's chat id and misses per-email chats. | 35-draft2.png | approval toast open-chat suppression (search web notification toast hook for the "chat open" check) | Treat an open per-email chat as the open chat when suppressing its approval toast. |
| J3-04 | Email agent panel (phone) | P3 | flow | OBSERVED once: after one tap on Draft a reply the panel showed two identical "Draft a reply" user bubbles. Could not reproduce (chip was covered by the toast afterwards). SUSPECTED double send on touch. | 34-draft.png | email agent suggestion chip onClick | Retest on a clean state; if it repeats, disable the chip once sent. |
| J3-05 | Drawer, chat list (phone) | P3 | visual | OBSERVED: under touch the drawer shows the three-dot action on every chat row, so "Investor Relations (mock)" wraps to two lines and the Needs your answer line is pushed down. Only about two and a half chat rows are visible with 14 pages and sections above. Expected: one line per row, more chats visible. | 05-inbox.png (drawer under coarse), geometry audit heights [36,18] | Sidebar chat row component (always-visible actions on coarse pointers) | Truncate the row title to one line, or show the action only on long press. |
| J3-06 | Inbox (phone) | P3 | flow | OBSERVED: the To do card plus search and pile tabs fill the first 500px of 812; the first mail row starts at y=508 and about five rows show on the first screen. | 06-inbox.png | Inbox page To do card | Collapse the To do card to one line when it has more than two items on phones. |
| J3-07 | Data room (phone) | P3 | visual | OBSERVED: the toolbar uses three rows (search + Filters, folder + new folder + sort, view toggles on a right-aligned row of their own) before the first file at y=250. | 22-dataroom.png | Data room toolbar | Put the list/grid/chart toggle on the folder row. |
| J3-08 | Notification toast (all phone screens) | P3 | a11y | SUSPECTED, from DOM only (no screen reader run): the toast element (role alertdialog, data-slot notification-toast) has aria-hidden="true" and does not appear in the accessibility snapshot, including its Dismiss button. A polite live region exists, but a screen reader user may not be able to reach Dismiss or the group button. | DOM inspection of `[data-slot=notification-toast]` | notification toast component in packages/ui-web (Base UI Toast, aria-hidden set when stacked) | Verify with VoiceOver; make the front toast non-aria-hidden. |

Not reproduced: a "This agent could not finish. Try again. [Retry]" banner appeared once on the first Chief screen after sign-in (03-home.png); it did not return after reload. Likely left over from another walker's run on the shared demo user, not logged as a finding.

Stories skipped: none in scope. Fund-raising/Investors pages not touched (owned elsewhere).
