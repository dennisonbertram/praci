# Walk R3 (iteration 22): verify pass-21 clusters C21-C26

Target: mock-data demo stack (web 5381), 1440x900, signed in as the seeded mock founder. Screenshots are kept outside the repo; file names are quoted below. Note: `clusters.json` for iteration 21 holds 26 clusters, so C27-C31 do not exist and were not walked.

## Verdicts

| Cluster | Verdict | Steps (actual/ideal) | Notes |
|---|---|---|---|
| C21 approval toast covers controls / not clearly clickable | PARTIAL (Storybook only) | n/a | The demo could not produce a pending approval: Chief-style payment writes are off ("Allow changes" not on, the bot says so honestly) and the New Bot to Inbox agent email request never returned (see R3-01). In Storybook, `OverPage` and `ApprovalsGrouped` show the chevron on the toast and the grouped "3 need approval" toast (sb-ui-notificationtoaster--over-page.png, sb-ui-notificationtoaster--approvals-grouped.png). The page-padding acceptance (Legal last row, settings panel on phone) was NOT observed live. |
| C22 focus after Cmd+K; chat chip focus ring | PASS (one nit) | 3/3 | Cmd+K, type Investors, Enter: `document.activeElement` is `main#main-content`, not a page button. The "Messaged Finance agent" chip now shows a visible light ring on keyboard focus (ring-chip.png). See R3-03 for the remaining difference from the link ring. |
| C23 routines: run title, elapsed time, schedule submenu | PASS | 9/8 | Created a routine, test-ran it. Run history row is titled with the routine name ("R3 cash check"), shows "Waiting on Finance agent" at 4.2s, then "Done" with 11s total, so elapsed now includes the delegated work (rt7.png, rt8.png). "Choose when it runs" opens its options directly under the button inside the panel (rt3.png). |
| C24 Finance Rent chart current month; Accounts range control | PASS (one nit) | 3/3 | Rent chart now spans Apr-Oct with Oct drawn as a dimmer partial bar at $7,500 (rent.png). Accounts defaults to Month and uses the same Week/Month/Quarter/Year tabs (acc.png). See R3-02, R3-04. |
| C25 signed SAFE next step in the Investors agent | BLOCKED | n/a | Needs a Data room SAFE preview plus an agent reply that depends on the model's reading of the instructions; not exercised in this pass. |
| C26 Equity raised shows a dash | PASS | 2/2 | Observed with a DOM observer across an in-app revisit: tile goes skeleton at 2.0 s, then "$350,000 / $50,000 committed" 17 ms later. No dash state at any point. Initial load also showed no dash in 0.7 s polling. |
| Storybook smoke | PASS | n/a | Built Storybook from the main checkout and ran `node .storybook/smoke.mjs storybook-static`: 1806 of 1806 stories rendered cleanly. No failing stories. |

Pass-21 owner decisions spot-checked on the way: /app/settings opens Settings (five sections are General, Privacy and approvals, Models, Advanced; Settings keeps a fixed height); the empty Cmd+K palette lists pages only (Inbox ... Integrations, Settings) with no page agents; the Create menu shows New space because this demo account has five spaces (correct under the pass-20 rule). Browser console showed only Vite debug lines and the React DevTools notice, no errors.

Praise: the routine run history is now a clear record (name, status, honest total time, View chat). The Equity raised tile never shows a misleading dash. Cmd+K to a page now lands keyboard focus on the page itself.

## Findings

| id | page / story | sev | cat | What happened vs expected | Evidence | Suspected location | Proposed fix |
|---|---|---|---|---|---|---|---|
| R3-01 | Chat delegation (New Bot to Inbox agent) | P2 | flow | OBSERVED: asking a fresh bot to send an email produced a "Messaged Inbox agent" chip, then nothing. About 7 minutes later the Inbox agent thread still holds only the request ("This chat is view-only") and New Bot never reports an outcome or a waiting state. Expected a reply, an approval card, or a visible "waiting/failed" status as the Finance delegation gave (that one finished in 11 s). Cause not determined; may be demo-specific. | ia.png, ia2.png, nb3.png | Delegated-run status path in apps/api (not located) | Show a waiting or failed state on the delegating chat when the target agent has not produced output within a short time. |
| R3-02 | Finance Accounts | P3 | visual | OBSERVED: the "Total cash" card is still 168 px wide in the top-left with empty space to its right, unlike the full-width card rows around it (the second half of the original C24 note). | acc.png (measured 168 px) | apps/web/src/pages/finance accounts page | Put Total cash in the chart card header or let it span the row. |
| R3-03 | Chat chip focus ring | P3 | a11y | OBSERVED: the chip ring is a box-shadow that hugs the chip border, the link ring is a 2 px outline with 2 px offset. Same colour and weight, different placement. Much better than before; remaining difference is minor. | ring-chip.png, computed styles | Chat message chip component | Use the shared focus-visible outline class on the chip. |
| R3-04 | Finance category page | P3 | visual | OBSERVED: the Rent chart dims the current month's bar but does not mark it as "so far"; the Burn chart on the overview labels it "Oct*" and "* So far". | rent.png vs fin.png | apps/web/src/pages/finance/FinanceSpend.tsx | Reuse the "*" label and footnote used on the overview chart. |
| R3-05 | Sidebar Inbox badge | P3 | bug | OBSERVED, UNEXPLAINED: the Inbox unread badge read 14, 13, 14, 13, 12 across successive navigations although I opened no mail. May be demo sync or mail marking read; not confirmed. | sidebar in fin.png, acc.png, legal2.png | Unread count query in the sidebar (not located) | Check whether the count is recomputed from a changing source; if sync-driven, none. |
| R3-06 | C21 live check | P3 | flow | NOT VERIFIED live: no pending approval could be created on the demo, so the toast padding and chevron were checked in Storybook only. | see C21 verdict | n/a | Seed one pending approval in the demo so this can be walked. |

Cleanup note: this walk left a "New Bot" thread and an "R3 cash check" routine in the demo space.

## Summary counts
PASS 4 (C22, C23, C24, C26) plus Storybook smoke; PARTIAL 1 (C21); BLOCKED 1 (C25). Findings: P2 1, P3 5.
