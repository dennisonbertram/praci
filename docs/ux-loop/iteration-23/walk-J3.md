# Iteration 23, walker J3: phone width (375 x 812) sweep

Target: mock-data demo stack, signed in as the invented founder (Maya, Northwind Robotics). Screenshots are kept outside the repo.

Method notes:
- Walking used `agent-browser` at 375 x 812. It cannot emulate touch (`pointer: coarse` stayed false even with Blink launch flags and `set device`).
- Every touch-target and touch-layout claim below was therefore measured in a separate Playwright Chromium context (375 x 812, `hasTouch`, `isMobile`, `pointer: coarse` confirmed true) using the same login. Findings marked "touch-only" appear only in that context.
- geometry-audit.js was run on the Chief, Inbox, message, Finance, Data room, preview, approval and Settings screens. `pageOverflowX` was 0 on every screen, including Legal and the Inbox Ask panel in the touch context. The audit's "wrappedControls" hits ("+N more", stat-card links) were multi-line by design, not defects.
- Console: no errors in either browser (only Vite debug lines).

## Story verdicts

| Story / journey | Verdict | Steps actual / ideal | Note |
|---|---|---|---|
| Sign-in (landing, Sign in, email, password, submit) | PASS | 4 / 4 | Clear, inputs 16 px, no overflow |
| Sidebar drawer (STORY-APP-121, APP-009 phone part) | FAIL | 3 / 2 | Pages group starts collapsed on a phone; Inbox is not visible (J3-01) |
| Inbox triage (STORY-INB-031): list, To do, More, Archive and Undo, open message, Reply composer | PASS | 7 / 7 | Send not pressed on this thread; opened composer only, then Discard |
| Cleanup on the phone (STORY-INB-108) | PASS | 2 / 2 | One-line reason for empty state is clear |
| Inbox agent panel (STORY-APP-134) | PASS | 2 / 3 | Opens over the page; collapse button works |
| Finance overview (part of APP-213 steps 6-7) | PASS | 2 / 2 | Cards, chart, breakdown, upcoming, subscriptions all fit |
| Data room browse and preview | PASS | 3 / 3 | List, row tap opens preview sheet, Open launches PDF in a new tab |
| Agent chat with an approval (New Bot asks Inbox agent to email) | PASS | 5 / 5 | Toast above composer, card asks for sending account, Send then shows "Sent" |
| Bot settings on a phone (STORY-APP-135) | PASS | 2 / 3 | Settings panel covers chat, X returns |
| Settings (General, Privacy and approvals) | PASS | 2 / 2 | Section select works, panel scrolls inside its sheet |
| Search palette from drawer (part of APP-213 step 10) | PASS | 2 / 2 | Searching "lease" returns Documents, Chats, Mail |
| Monday catch-up (STORY-INB-040), full Send | SKIPPED | n/a | Did not send a reply or mark noise |
| Day from phone (STORY-APP-213) remainder: Hide amounts, bell/Activity, Cap table agent, notifications | SKIPPED | n/a | Out of time budget |
| APP-009 laptop hide/show sidebar at 1440 | SKIPPED | n/a | Phone sweep only |

Left on the demo by this walk: one "New Bot" chat, one email sent from the Inbox agent card to an invented address (emulated Gmail), one archived message that was undone.

## Findings

| ID | Sev | Cat | Page / story | What happened vs expected | Evidence | Suspected location | Proposed fix | Status |
|---|---|---|---|---|---|---|---|---|
| J3-01 | P1 | flow | Drawer, APP-121, APP-213 step 1 | A fresh phone user opens the drawer and sees only chats. The Pages group is collapsed by default, so Inbox (14 unread), Legal (1 overdue) and Data room (1 failed file, red badge) are hidden. Collapsed rows stay visible only when "notified", which means unseen new items; unread counts, overdue deadlines and failed files do not qualify. Expected: Inbox one tap from the drawer, and warnings never hidden. Takes 3 taps instead of 2. | 05-drawer.png, 07-drawer-fresh.png, t-drawer.png vs 06-pages.png | `apps/web/src/pages/Shell.tsx` `readCollapsedSidebarSections` (about 480-495); `apps/web/src/components/SidebarPageLink.tsx:58`; `components/sidebar-glance.tsx` (`notified` only set when `unseen > 0`) | Treat a failure count or overdue count as `notified` so those rows survive collapse, or drop the phone default-collapse. | Observed |
| J3-02 | P1 | visual | Legal on touch, tab strip | With `pointer: coarse` the three view tabs get a roughly 108 px minimum width each, so the strip needs about 331 px plus padding in a 337 px box. "Contracts 15" runs into "Deadlines 19", and the Deadlines tab's content (131 px) overflows its 111 px tab. Selected pill is clipped at the left edge. Fine at the same width with a mouse pointer. | w-legal.png (touch) vs 31-legal.png (mouse); tab rects measured in touch context | `apps/web/src/pages/Legal.tsx:497-517`; coarse-pointer minimum width on `TabsTrigger` in `packages/ui-web` | Drop the coarse minimum width for text tabs (keep 44 px height) or let the strip scroll with snap and a visible edge. | Observed (touch-only) |
| J3-03 | P2 | visual | Legal contracts list on touch | Long contract titles ("SaaS Subscription - Cobalt Cloud Hos", "Consulting Agreement - Fictional Law (") are cut mid-letter with no ellipsis, so the reader cannot tell the title is cut. With a mouse pointer the same rows show an ellipsis. | w-legal.png vs 31-legal.png | `apps/web/src/pages/legal/LegalContracts.tsx:69` (`rk-tap min-w-0 truncate`; likely `rk-tap` makes it inline-flex, which disables `text-overflow`) | Put the truncating text in an inner block span, or let titles wrap to two lines on phones. | Observed; cause suspected |
| J3-04 | P2 | a11y | Chief / any chat composer, Settings section select | Composer text is 15.5 px and the phone Settings section select is 14 px. iOS Safari zooms the page when focusing a field under 16 px. Not tried on a real iPhone. | Computed font sizes in the touch context: "Message Chief" 15.5 px, "Settings" combobox 14 px; other inputs are 16 px or more | `apps/web/src/pages/shell/composer.tsx:1128`; `apps/web/src/pages/SettingsOverlay.tsx:260,282` | Use 16 px for the textarea and the select on coarse pointers. | Suspected (unverified on iOS) |
| J3-05 | P3 | visual | Inbox rows on touch | The unread dot is offset up and right so it hangs off the checkbox corner above the sender name, looking misplaced next to the name. With a mouse it sits to the left of the name. | t-inbox.png (crop shows dot above checkbox) | `apps/web/src/components/inbox/InboxRow.tsx:320` (`pointer-coarse:translate-x-2.5 pointer-coarse:-translate-y-3`) | Either show the dot inline before the sender name on touch or hide the checkbox until multi-select starts. | Observed |
| J3-06 | P3 | visual | Mail approval card at 375 px | After Send and Discard and the hint "Choose an account to send from.", the "..." button wraps alone onto a third line, leaving an orphan control under the buttons. | 26-approval.png | mail approval card actions row (`apps/web/src/components/MailApprovalCard.tsx`, button row near "Discard") | Keep "..." on the Send/Discard line and let the hint wrap below. | Observed |

## What was excellent

- Every interactive target in the touch context measured at least 44 px (only hidden checkbox inputs and 32 x 18 switch thumbs, whose rows are tappable, were smaller), and no screen had horizontal page overflow.
- Inbox: pile tabs, To do card that collapses to one line, row More menu with Archive and an Undo toast above the safe area, and a clear Reply composer.
- Cleanup states why it is empty in one sentence and offers one next action.
- Finance fits in one column with cards, burn chart, breakdown, upcoming payments and subscriptions; no clipped numbers.
- Approval flow: toast above the composer ("Waiting for approval" in the composer), card asks which account to send from and keeps Send disabled until chosen, then collapses to "Sent".
- Data room: failed file shows its reason and a Replace file button inline; preview sheet is readable.
