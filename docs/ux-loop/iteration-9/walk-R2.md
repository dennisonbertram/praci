# Walk R2: verify pass-8 fixes, clusters C11-C20

Target: mock-data demo (web :5381). Maya (mock-founder) at 1440x900, plus 375x812 where a cluster needs it. A fresh invented user (Walker R2) was signed up for the empty Investors and Fundraising states and the pending-ask check. Screenshots: /tmp/uxloop9/R2/. Console: no errors, only vite and React DevTools notices. The geometry audit on Legal found no page overflow and no overflow spills.

## Verdicts (steps actual/ideal)

- C11 FAIL (6/5). Passed: a run older than 2 minutes shows "Thinking 3m 41s", "Taking longer than usual", Stop and Try again. No raw tool name was seen in the transcripts I opened (Chief, Investor Relations). Composer caps at about 5 rows. Failed: free text typed to a pending ask is still sent as a normal user bubble and the ask card stays unanswered (R2-01).
- C12 FAIL (8/6). Passed: upload toast sits at the bottom of the list, not over the header, and clears about 8 s after it finishes. Approval toast persists until dismissed and tapping it opens the Mail approval card. Archive-all Undo lasted about 11 s. Failed: the approval toast still covers working controls (R2-02, R2-03). The upload failure reason was not tested (could not force a failure).
- C13 PASS (3/3). Contract names wrap fully at 1440, every truncated cell has a title, 10 contracts fit in about 2.3 screens at 375.
- C14 PASS (5/5, partly checked). At 375 the sync status is readable (158 px), Finance has a labelled "Ask" button, Burn header is one 40 px row. The dashed Burn segment is labelled by the footnote "* Month to date"; the "Projected" label is only on the Runway chart (FinanceBurn.tsx:356), which I did not open. Subscriptions change column not checked.
- C15 PASS (4/4). At 375x812 the drawer has one scroller, all 8 Pages rows are visible, the footer (Integrations and account) stays fixed. Sidebar keeps the Integrations row per owner decision.
- C16 SKIPPED. Storybook smoke is a maintainer script, not a browser walk of the app.
- C17 PASS (4/3). Digest button reads "Archive all 8 messages from 5 senders", cards show per-sender counts, sender and subject share a left edge. P3 remains (R2-04).
- C18 FAIL (4/2). Fresh Investors still shows Add contact, Ask, three source buttons, ghost stats and table, Updates with New update, and a Contacts tab strip. Fresh Fundraising shows three ghost cards plus Add prospect and Start a round. Draft reply is disabled with no "Drafting..." label. Header and cards share one width at 1920 (passed). API-down case not tested.
- C19 PASS (4/3, partly checked). One "Advanced" in Settings, General disclosure is now "Chat display", Memory uses a chevron row. Not checked: body height when Notifications mounts, 375 hint wrap.
- C20 FAIL (3/2). Search box reads and is labelled "Search integrations" (passed). Chips (All, Email & calendar, Chat, Docs & files, Finance, Developer) still differ from section headings (Connected, Popular, Finance, Social, Tools, Anything else). At 375 the page is 1,690 px tall against the 1,610 target (the demo has 6 connected apps, so the comparison is approximate). No description is cut.

## Findings

| id | page/story | sev | cat | what happened vs expected | evidence | suspected code | fix |
|---|---|---|---|---|---|---|---|
| R2-01 | C11 pending ask | P2 | bug | Observed once: on a new user's Chief, typing free text while the "What do you want me on first?" card is open sends a normal user bubble and leaves the card unanswered after Chief replies. Expected one answered card and no extra bubble. | f1.png, f2.png | apps/web/src/pages/shell/thread-target.ts | Route composer text to the pending ask answer and mark the card answered. |
| R2-02 | C12 approval toast | P2 | visual | Observed: the approval toast (top right, persistent) covers the Data room Sort and filter controls at 1440, the Settings dialog's top-right corner (close button), and the page header controls at 375 (Finance Burn). Expected no toast over header controls. | c12b.png, c19a.png, c14c.png | apps/web/src/components/AppToaster.tsx | Anchor approval toasts to the bottom (above the composer on phones) or push them below the page header. |
| R2-03 | C12 approval toast | P3 | visual | Observed: each approval toast stays until dismissed and sits over chat text in the same position; several can queue (Legal notice, Great meeting, Mercury $1,200, Mercury $300 in one session). | c11b.png | AppToaster.tsx | Collapse multiple approvals into one "N need approval" toast. |
| R2-04 | C17 Digest | P3 | copy | Observed: Newsletters tab lists 10 messages (2 per sender), Digest says 8 (SaaS Metrics and Robotics Roundup show 1). The Digest uses a 7-day window and does not say so. | c17a.png, c17b.png | apps/web/src/components/inbox/InboxDigest.tsx | Add "last 7 days" to the Digest button or heading. |
| R2-05 | C18 Investors | P2 | flow | Observed: empty Investors still offers Add contact, Ask, three sources, ghost cap table, Updates with New update, Contacts tabs. Expected one prompt. (Another session owns Investors; reported as it stands.) | f3.png | apps/web/src/pages/Investors.tsx | Show one "Where is your cap table?" prompt until a source exists. |
| R2-06 | C18 Fundraising | P2 | visual | Observed: static grey ghost bars in Round, Pipeline and SAFEs (also with real SAFEs present) look like a loading state that never finishes. | f4.png, c18d.png | apps/web/src/pages/Fundraising.tsx, components/fundraising/RoundCard.tsx | Replace ghost bars with one Start a round empty state. |
| R2-07 | C18 Draft reply | P2 | bug | Observed: after clicking Draft reply the button is disabled but still reads "Draft reply" (still so 5+ s later). Expected "Drafting..." with a spinner. Code confirms. | c18b.png | apps/web/src/components/investors/ActionItems.tsx:73-76 | Swap the label to "Drafting..." with a spinner when audit.drafting. |
| R2-08 | C20 chips | P3 | copy | Observed: filter chips and section headings are different lists. | c20a.png | apps/web/src/components/integrations/IntegrationsHome.tsx | Derive chips from the section headings. |
| R2-09 | C20 height | P3 | visual | Observed: Integrations at 375 is 1,690 px tall (target 1,610). | eval measurement | IntegrationsHome.tsx | Tighten the connected card layout on phones. |
| R2-10 | C15 drawer | P3 | visual | Observed: a small green flag icon sits beside the time on the Investor Relations row; its meaning is unclear. Suspected: a pinned or flagged marker. | c15.png | apps/web/src/pages/Shell.tsx sidebar row | Give it an accessible name and tooltip, or remove it. |

## Praise
- C11: the "Taking longer than usual" row with Stop and Try again is clear and well placed.
- C13: Legal at 375 reads as compact cards, and the 1440 table wraps contract names without clipping.
- C15: the drawer is a single scroll with a fixed footer.
- C17: "Archive all 8 messages from 5 senders" is precise, and Undo lasts long enough.
- C12: upload toast placement is fixed and it clears on its own.
