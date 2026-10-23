# Iteration 23 walk R3: verify pass-22 clusters C21 to C27, Storybook smoke

Walker session uxl23-R3. Target: mock-data demo stack (web 5381), signed in as the seeded founder, 1440x900 unless noted (375x812 for phone checks). Only clusters C21 to C27 exist in the iteration-22 file (it has 27 clusters), so C28 to C31 do not apply.

Method note: the machine was under heavy load during this walk (load average 50 to 60, Storybook build and smoke running at the same time as many walkers). Several pages showed skeletons for 10 to 25 s and one Finance category request ended in "Could not reach the server" with a working Try again; that run is treated as load, not a finding. Rent loaded normally on the next open. The demo account is shared with other walkers (other New Bot chats, a pending Mercury approval and an Inbox agent approval toast appeared that I did not create).

## Verdicts

| Cluster | Item | Verdict | Steps (actual / ideal) |
|---|---|---|---|
| C21 | Finance header at 375 px at most 72 px, "syncing..." not clipped | PASS (header block 72 px, status reads "syncing...", no horizontal scroll) | 2 / 2 |
| C21 | Accounts: Total cash card spans the row, no tick closer than 40 px | PASS (full-width card; closest ticks 68 px) | 1 / 1 |
| C21 | Accounts uses the same framed range control as the overview | FAIL (Week/Month/Quarter/Year sit unframed in the chart card header; R3-23-01) | 1 / 1 |
| C21 | Rent chart current month carries "Oct*" and "* So far" | PASS | 3 / 3 |
| C21 | Subscriptions table width capped | FAIL (vendor to amount gap still about 880 px at 1440; R3-23-02) | 1 / 1 |
| C22 | Carta tile white, same tiles in Add account | PASS (Carta has a mark on a white tile; all four Add account tiles are white, Mercury/Brex/Coinbase look gray only because Connected rows are at 70 percent opacity) | 3 / 3 |
| C22 | Connected and Popular cards put the action in the same place | FAIL (three layouts; R3-23-03) | 1 / 1 |
| C23 | Blocked payment link goes to the bank's own page | PASS in code, not run live (executor.ts bank facts link `/app/integrations/mcp/{id}`; the page opens Mercury's detail view with the Allow changes switch, one click from the link). Owner decision: stop at the detail view. | n/a |
| C23 | Legal draft offers "Send to Inbox" as a button | PASS in code, not run live (legal-agent.ts calls ask_user with options "Send to Inbox" and "Not now"; no model on the demo to draft a notice) | n/a |
| C24 | Assign to contact: placeholder and contact on the row | PASS (select opens on "Choose a contact"; after Assign the row reads "from Mercury . Sora Angel (Mock)"; Unassign restored the row) | 4 / 4 |
| C25 | Opening Legal in an empty space leaves it empty; "No bots yet" visible | PASS for the active space (Legal showed its own empty state, `/app` showed "No bots yet" with New bot). FAIL for the sidebar when the space is inactive (R3-23-04). | 3 / 3 |
| C26 | Landing Sign up and Sign in centred within 2 px | PASS (pair centre 720.0 at 1440, 187.5 at 375) | 1 / 1 |
| C26 | Landing Sign up opens the sign-up form directly | PASS (one click, form shown) | 1 / 1 |
| C26 | Reset and sign-up share spacing | PASS with note (input bottom to button top 52 px on reset, 62 px on sign-up where a helper line sits between; headline still wraps to two lines at 375) | 2 / 2 |
| C27 | Chip focus ring matches links | NOT VERIFIED live (no empty chat with chips available; the only Mercury agent thread belongs to another walker's pending payment). Commit message says it was changed. | n/a |
| C27 | Empty-chat suggestions align with composer column | NOT VERIFIED live, same reason | n/a |
| C27 | Activity Finished rows muted, Failed red, Needs your answer amber | PASS | 2 / 2 |
| C27 | Second new bot named "New Bot 2" | PASS (heading, sidebar row and settings name field) | 2 / 2 |
| C27 | Composer close with only an attachment asks "Discard draft?" | PASS (title "Discard draft?", text "Attachments are not kept.", buttons Keep editing and Close and remove) | 4 / 3 |
| C27 | Auto-sort dialog shows count in title, all ticked | BLOCKED (demo ends with "Already tidy." after a long "Looking for changes" wait, so no change list appears) | n/a |
| Storybook smoke | 1812 of 1813 stories render cleanly | FAIL, 1 story (see below) | n/a |

Storybook smoke: built `storybook-static` in the main checkout and ran `node .storybook/smoke.mjs storybook-static`. Result: 1812 of 1813 rendered cleanly. Failing story: `shell-delegate-wait-notice--first-minute` (file `apps/web/src/pages/shell/DelegateWaitNotice.stories.tsx`): empty render, no errors. The component correctly returns null in the first minute, so the story needs a visible-root decorator (`withVisibleRoot` in `apps/web/src/stories/decorators.tsx`).

## Excellent

- Landing and sign-up: one click from the landing page to the form, the button pair is centred to the pixel at both widths.
- Rent bar chart now marks the current month the same way as the burn chart ("Oct*", "* So far").
- Finance header at 375 px is two rows (72 px); the non-USD note moved above the figures, the syncing state is readable.
- Assign to contact is clear: placeholder, disabled Assign until a choice, contact name on the row, Unassign in the row menu.
- Activity panel colours carry meaning now: only Failed is red, only Needs your answer is amber.
- Discard draft dialog has the right title and text for an attachment-only message.

## Findings

| id | page or story | severity | category | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| R3-23-01 | C21, Finance Accounts | P3 | visual | OBSERVED. The range control on Accounts is bare text tabs inside the chart card header; the overview shows it in its own framed bar. Acceptance said the same framed control. | 13-accounts-1440.png vs 10-finance-1440.png | `apps/web/src/pages/finance/FinanceAccounts.tsx:327` (`PeriodTabs` in the card action) | Reuse the overview's framed range bar, or state that the in-card tabs are the intended variant. |
| R3-23-02 | C21, Finance Subscriptions | P3 | visual | OBSERVED. Rows span the full 1040 px card: vendor at the left edge and "Per month" and "Last charge" at the right edge, about 880 px apart. Acceptance asked for a capped width. | 15-subs.png | `apps/web/src/pages/Finance.tsx` and `apps/web/src/pages/finance/FinanceSpend.tsx` subscription table | Cap the table (for example max-w-3xl) or put the amount next to the vendor name. |
| R3-23-03 | C22, Integrations | P3 | visual | OBSERVED. Connected cards use two layouts: Gmail and Carta put "Used by" above the action button; Mercury, Brex and Blockscout put the action directly under the description with "Used by" below; Coinbase has no "Used by". Popular cards put the action at the bottom. Action top offsets measured 15 px and 65 px (connected) and 81 px (popular). | 20-integrations.png | `apps/web/src/components/integrations/IntegrationsHome.tsx` (card, "Used by" at line 108) | Render one card body order: title, description, then a footer row with "Used by" left and the action right, for both groups. |
| R3-23-04 | C25, sidebar of an inactive empty space | P3 | flow | OBSERVED. After opening Legal and Investors while "Empty space" was active, the sidebar lists "Legal agent" and "Investors agent" as ordinary chats under an "EMPTY SPACE" heading when another space is active, instead of hiding the space until switched to (while active the same agents are folded under "Page agents 1"). The Pass-22 decision says a space with only auto-created page agents counts as empty. | 50-activity.png, 51-emptyspace-sidebar.png | `apps/web/src/pages/shell/space-sidebar.ts` (`root` bots of an inactive space include page agents before the empty-space check near line 190) | Exclude page agents from `root` when deciding whether an inactive space is empty, so it stays in the switcher only. |
| R3-23-05 | Storybook smoke | P3 | bug | OBSERVED. Story `shell-delegate-wait-notice--first-minute` renders nothing, so the smoke test fails (1812 of 1813). | sb-smoke log | `apps/web/src/pages/shell/DelegateWaitNotice.stories.tsx:25` | Add `decorators: [withVisibleRoot("No notice in the first minute")]` to `FirstMinute`. |
| R3-23-06 | C25, empty space home | P3 | visual | OBSERVED. "No bots yet" is a small heading at the top left while the New bot button sits alone near the vertical middle (y 478), 450 px away; they read as two unrelated things. | 33-empty-home.png | empty-space pane in `apps/web/src/pages/Shell.tsx` | Put the heading and the New bot button together in the centred empty state. |

## Not findings, recorded for the next pass

- Mercury detail page (observed once): "Allow changes in Mercury" showed off while "Open Mercury agent" was present and the agent had a pending $1,200 approval. Another walker may have created that agent, and my click on the switch may have turned it off, so the cause is unknown. If it reproduces from a clean demo, the page shows an agent with changes off but an approval still pending.
- Auto-sort on the demo reports "Already tidy." and takes a long time (more than 8 s with the "Looking for changes" timer; the machine was loaded). The change-list acceptance for C27 needs seeded misplaced files.
- Not run live because they need a model or a fresh agent chat: C23 blocked-payment reply link and Legal "Send to Inbox" button, C27 chip focus ring and suggestion alignment.

## Summary

PASS 14 checks, FAIL 4 (C21 range control, C21 subscriptions, C22 card layout, Storybook), PARTIAL 1 (C25: active space fine, inactive sidebar not), BLOCKED 1 (Auto-sort), NOT VERIFIED live 4. Findings: P0 0, P1 0, P2 0, P3 6.
