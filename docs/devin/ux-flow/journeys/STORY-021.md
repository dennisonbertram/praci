# STORY-021: Devin asks a question while the founder is working in Rakazo

Verdict: **acceptable**. The planned flow is 5 actions against an ideal of 2. The extra steps come from one decision: the notification links to the Rakazo page, and the page is a middle stop that Maya does not need for this job.

Evidence used: `docs/devin/ux-paths/catalog.md` (STORY-021, GAP-01, 02, 05, 06, 11, 19, 25, 39), `docs/devin/mockup.html` (read, not rendered: the catalog and the mockup source were enough), `apps/web/src/lib/notification-delivery.ts`, `apps/web/src/components/AppToaster.tsx`, `apps/web/src/lib/use-sidebar-glance.ts`, and the screenshot `sidebar_link_badge.png`. Nothing here was run; the Devin page does not exist yet.

## Friction Scorecard

| Measure | Planned | Ideal |
|---|---|---|
| Actions from "Devin is blocked" to "typing the answer in Devin" | 5: see toast, click toast, page loads and she scans, find the row, click the title or "Open in Devin" | 2: click the toast, answer in Devin |
| Catalog's own "ideal" | 3 (toast, page, "Open in Devin") | 2 |
| Screens passed through | Toast, Rakazo `/app/devin`, Devin | Toast, Devin |
| Decisions | 2 needless: which signal to trust (toast or dot), which row (only when several are blocked) | 0 for one blocked session |
| Re-entry | None needed in Rakazo; after answering, the row still says "Needs you" until the next poll (GAP-13) | Same, but she never sees the stale row if she never visits the page |
| Confirmations | 0 | 0 |
| Dead ends | 1: the page row. If the question text is unavailable (GAP-01) the row only says "Needs you" and she must open Devin to learn what it asks | none |
| Hesitations | "Did the dot clear because I answered?" (step 5 of the catalog; GAP-05). Toast, dot, tile and row say the same fact four times | |

Measured vs suspected: the step counts and the toast-to-router behavior are read from code and catalog (measured by reading). The statement that Maya hesitates is a prediction, not an observation.

How the toast opens a link today: `AppToaster.tsx` passes `onOpen={navigate}`, the router's navigate. So a toast `link` today can only be an in-app path. An external Devin URL would not work through it without a small change.

## Take-away Pass

- **Toast**: keep. It is the one signal that reaches a present user. Title plus the question is enough to decide.
- **Sidebar dot**: keep, but only as the passive "something is blocked" signal for a user who missed the toast. Do not also use it as the way to be told. Two findings: the existing sidebar badge for Inbox is a number (`sidebar_link_badge.png` shows "3"), while the mockup draws a plain dot with a tooltip "2 need you"; a dot loses the count that the existing pattern shows, and the tooltip is hover-only. GAP-05 (dot clears on page open) stays a real defect: drive it from the live needs-you count.
- **Tile "Needs you"**: removable for this journey. The two Needs-you rows are sorted first and already show the count by their number. This is a page design question, not a notification one; flagged for the redundancy critic.
- **Row badge "Needs you"**: keep, it is the page's main information.
- **Row question subtitle**: keep, but it is the same text as the toast body. Fine, since it is the persistent copy.
- **Page itself**: needless for one blocked session; valuable for several (see below).

## The Simpler Version

Question asked: is the Rakazo page a needless middle stop? For one blocked session, yes. For two or more, no, because the page is the only place that lists all blocked sessions with their questions.

The notification is created per session (GAP-06 recommends a key of session id plus latest message id), so each notification is about one session. That makes a direct link natural.

1. Toast reads "Devin has a question" with the session title and the question. Click it.
2. The session opens in Devin (system browser; Electron uses the existing app opener). She answers there.

Concrete changes, smallest first:

1. **Point the notification `link` at the Devin session URL**, not `/app/devin`. Cost: the toast's `onOpen` must open external URLs through the opener instead of `navigate`; and GAP-19 must be closed first, because the session URL is unverified (it must be built from the session id after checking the URL shape). If that check fails, keep `/app/devin`.
2. **Keep the page as the "all of them" view**: reached from the sidebar link, not from the notification. If more than one session is blocked at once, the second and later notifications can still link to their own sessions; no summary notification is needed.
3. **Mark the notification seen when the toast is clicked**, which the toast already does (`onSeen`). Because Rakazo no longer lands on the page, the dot cannot clear by "attended page" any more. It then must clear from the live needs-you count (GAP-05 fix), which also covers answering in Devin without ever opening Rakazo.
4. **Suppress the toast when she is already on `/app/devin`** (GAP-39): she can see the row. This is one condition, no new UI.
5. **Drop the tile or keep it, but do not add more signals.** No change to the toast count, no extra badge on the drawer button. Under 1024 px the dot is hidden behind the hamburger; the toast covers that case, so do not add a dot on the menu button.

Cost to be honest about: with a direct link, Rakazo cannot know she acted. Phone push suppression depends on the notification being shown or seen, which the toast click covers (it calls `onSeen`). The row will show "Needs you" until the next poll after she answers. That is acceptable only if the page refetches on focus (GAP-13).

Not recommended: a summary notification ("3 sessions need you") linking to the page. It adds a second notification type for a case the per-session notifications already handle.

## Clarity Issues

- Title "Devin needs you" is ambiguous in two ways: it does not say what is needed, and on an OS banner the sender shows as Rakazo. Suggested: title `Devin has a question`, body `<session title>: <question>`. The catalog's example body ("Fix flaky checkout test: which branch should I rebase onto?") is good as written.
- When the question text cannot be read (GAP-01), do not leave the body empty. Suggested fallback body: `<session title> is waiting for your answer`. The session title is available without the gated call; the question is not.
- Row link label: the catalog says the row has "Open in Devin", but the mockup table shows only the session title as a link, and "Open in Devin" appears only in the agent panel. If the notification no longer goes to the page, the row link matters more. Use `Answer in Devin` (GAP-20) so no one looks for a reply box in Rakazo.
- The dot's tooltip "2 need you" is hover-only. Use the number badge style of the existing sidebar if the count matters, otherwise keep the dot and accept that the count is on the page.
- A long question is cut to one line on the row with no way to read the rest (GAP-45). Fine if the toast carries it and Devin is one click away.
