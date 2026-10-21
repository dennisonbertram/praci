# Walk R1: verify pass-4 clusters C1-C10

Target: mock-data demo stack (web :5381), 1440x900 unless stated, logged in as the mock founder. Screenshots are in /tmp/uxloop5/R1/. The demo is shared with other walkers, so some stray chat messages in Chief ("hello there", "Pay Acme Servo Supply") are theirs.

## Verdicts

| Cluster | Verdict | Steps actual/ideal | Notes |
|---|---|---|---|
| C1 Finance figures | PASS | 4/3 | Globex Cloud is $2,016 on the list and on the vendor page ("Per month", sub "Usual charge"). Week view (Oct 19-21, 3 days) shows $612 with no percentage. At 375 px "35%" sits under the vendor name. Finance.test.tsx covers Globex. |
| C2 Chief banner and sidebar | PARTLY | 3/3 | No red banner after the Chief to Finance hand-off (met). Sidebar preview shows the user's question, not the Finance reply (not met, R1-01). Rows cleared "Waiting for ..." after Done (met). Failure path (Retry button, 24 px dismiss) exists in code (composer-error.tsx, size-6, Retry) but I could not trigger a run that ends without a reply on the demo: unobserved. |
| C3 Keyboard tab order | PASS | 3/3 | From Search: Tab goes Activity, Hide sidebar, Create, Collapse Pages (Create on the 3rd press). Shift+Tab reverses the same set. One "Hide sidebar" control; resize edge is "Resize sidebar" with tabindex -1. Escape from Settings returns focus to the user-menu button. |
| C4 Weekly routine day | PASS | 6/5 | "Every week" shows a Day of week select (default Monday); Friday saved and the list reads "Every Friday at 9:00 AM"; reopening shows Friday. I did not see a pre-existing Monday routine; the cron round-trip test was not run. Test routine deleted afterwards. |
| C5 Approval card names | PASS | 5/4 | Card reads "Send $1,200.00 to Acme (Mock) from MOCK Checking ..1111?" with Details. Lookup-failure and tainted-thread cases are unit-test cases, not tried live. Denied the card. |
| C6 Mercury Allow changes | PARTLY | 4/3 | Switch is visible with no Mercury agent. Switch reads on at first paint after confirm, and the page then creates a Mercury agent and re-lays out (R1-07). Chief payment refusal with changes off has no next step or Mercury link (R1-02, not met). |
| C7 Data room search | PASS | 3/3 | "Bolt" and "Signed NDA" both return "MOCK Signed NDA - Bolt Freight.pdf" (status Failed). Its text, "This file isn't a readable PDF.", is six words. |
| C8 Devin hidden until connected | FAIL | 3/3 | No sidebar row (met), not in Cmd+K (met), Integrations offers a Devin card (met). Page options still lists "Devin" (checked): R1-03. "Row appears after connecting without reload" is BLOCKED: needs a real Devin key. |
| C9 Inbox thread header etc. | PARTLY | 8/6 | Header has filled Reply, Archive, More at 1440 and 375 (met). Cleanup empty state has "Open Newsletters" (met). "Archive all 8" shows an "Archived 8 / Undo" toast, and Undo restores (met). Undo disappears about 1.7 s before the status changes from "Sending..." to Sent (not met, R1-04). |
| C10 Settings dialog | PARTLY | 4/3 | Models nav stays at y=164.6 and the dialog stays 760 px high in General, Privacy, Models, Voice, Memory (met). #root is inert while open (met). Attachment switch is in Data room > Add files > Email "Add new email attachments automatically" and not in Settings (met). General scrolls by 42 px (725 vs 683) so it does not fit one pane (R1-05). Password form is closed by default (met). |

Geometry audit (Finance): no page overflow, no spills. Unequal card heights noted as R1-06.

## Praise
- Finance list and vendor page now agree, and the week view no longer shows a scary percentage.
- The Settings dialog no longer jumps between sections.
- Approval card now names the recipient and account.
- Tab order through the sidebar header is now short and reversible.

## Findings

| id | page / cluster | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R1-01 | C2 Chief sidebar | P2 | flow | Observed. After Chief delegated to Finance and Finance answered "Current monthly burn is $67,621.16...", the Chief row preview kept the user's question ("Ask Finance what our monthly burn is."). Expected: the Finance reply. | c2-chief.png, c2-rows.png | packages/db/src/repos.ts:359 (`includeDelegatedReplyText: false` for the preview) | Let the preview include the delegated reply text when the run's final answer came from a delegate. |
| R1-02 | C6 Chief payment, changes off | P1 | flow | Observed twice. With "Allow changes in Mercury" off, asking Chief to pay returned "Finance could not complete the $300 payment ... The payment has not been confirmed as made." No reason, no link to the Mercury page. Expected a reply with a link to enable changes. | c6-chiefpay.png | Chief/Finance delegation reply text (packages/adapters finance agent prompts or executor result mapping; not located) | When a write is blocked because changes are off, return a fixed reply with an "Open Mercury" link. |
| R1-03 | C8 Page options | P2 | bug | Observed. Not connected to Devin, yet the Page options menu lists "Devin" (checked). Expected no Devin entry. | c8-pageopts.png | apps/web/src/pages/Shell.tsx:4223 (static list `{ key: "devin" ... }`, not gated on `glance.devinConnected`) | Filter the Devin item out of Page options until `glance.devinConnected`. |
| R1-04 | C9 Inbox send | P2 | flow | Observed 3 times (50 ms polling: Undo gone at ~4.95 s, "Sending..." until ~6.6 s). Undo vanishes while the toast still says "Sending...". Expected Undo until Sent. | c9-undo1.png, c9-undo2.png | Inbox send toast in apps/web/src/pages/Inbox.tsx (undo window timer; not located) | Keep Undo visible until the toast reads Sent, or drop "Sending..." and show Sent when Undo expires. |
| R1-05 | C10 Settings General | P3 | visual | Observed. General pane scrolls 725 vs 683 px at 1440x900; "Delete account" sits on the bottom edge. Expected one pane height. | c10-general.png, measurement | apps/web/src/pages/SettingsOverlay.tsx (General section) | Trim about 45 px (for example put Usage beside Account) so General fits without scrolling. |
| R1-06 | Finance | P3 | visual | Observed. Breakdown card (312 px) and Upcoming card (338 px) sit side by side with bottoms about 26 px apart. | c1-finance-full.png, geometry audit | apps/web/src/pages/Finance.tsx (grid `items-start`) | Use `items-stretch` or cap both lists at the same row count. |
| R1-07 | C6 Mercury page | P3 | visual | Observed. Confirming "Allow changes" re-renders the page: switch moves from y=212 to y=270, an AGENT card and a new "Let other agents use Mercury directly" switch (on) appear, and the first switch element is replaced (aria-checked briefly read false in 60 ms polling). Result is correct but jumpy. | c6-on.png | apps/web/src/pages/integrations (MCP connection page; not located) | Reserve the agent card space or animate it in; keep the switch element stable. |
| R1-08 | C6 / Finance agent | P2 | flow | Observed once, about 1 minute after enabling changes: Finance agent told Chief "I can't verify whether Allow changes in Mercury is enabled", though the switch was on. Suspected: a just-created Mercury agent was not yet reachable, or the capability check does not see the new state. Not reproduced. | Finance agent thread text | unknown | Re-read the setting at call time and report enabled state to the Finance agent. |
| R1-09 | Page load | P2 | perf | Observed once. A hard load of /app/finance stayed on the skeleton with "Still opening... Try again" until Try again was clicked (API healthy, other walkers active). Not reproduced on later loads. | c1-week.png (first capture) | unknown | Retry bootstrap automatically once before showing "Still opening...". |

Not findings: `/finance` (without /app) returns "Page not found" as expected for an unknown route. "Finance helper (mock)" shows "Working..." since seed time; it is seeded data.

## Not covered
- C2 failure path (run ends with no reply): could not be triggered on the demo.
- C8 "row appears after connecting": needs a real Devin key (BLOCKED).
- C5 failed-lookup and tainted-thread cases, C4 round-trip tests: unit-test level only, not run.
