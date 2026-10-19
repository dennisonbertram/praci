# Agent chat: visual and interaction findings

Stack: mock demo (invented data), dark theme, viewports 1440x900, 768x1024, 375x812. Screenshots are in `shots/` (`{viewport}-{state}.png` and `-full.png`; some states also have a thinking or hover variant at 1440 only). Measurements are in `audit.json` (layout-audit and geometry-audit per viewport and state). Second opinions: `second-opinion.json` (meta/muse-wonder and google/gemini-4-argon). Brief: `brief.md`.

Created during this audit: a Mercury agent (Integrations, Mercury, Create agent) and "Allow changes in Mercury" switched on. Fake emulator only. Three payment requests were made: $1,200 (Allowed once) and $300 (Denied). The Mercury agent now exists in the demo account.

## Coverage and what could not be done

The demo API stopped answering database requests partway through (sign-in returned HTTP 500, then timed out; Docker did not respond; the browser session cookie was rejected). I could not sign back in. Not reached, therefore not audited:

- Surface 4: Chief messaging the Mercury agent (answer and approval card placement). Not seen.
- Surface 3: Elio entry points, the call control and the no-voice-provider dialog. Not seen. Known from the walker only: the entry is the composer mic button named "Call Elio"; `docs/ux-walker/stories/STORY-EL-5/findings.json` records 32x32px size, no visible tooltip, and the mic reading as "dictate". Issue #153 covers the unexplained first call. I did not re-verify these.
- Surface 2: Carta read answer. The first send showed "Internal Server Error" (CHAT-15) and later the server went down, so no answer was produced. Carta first-open was captured.
- Streaming states: captured at 1440 only (Mercury thinking, tool step, thinking after Allow and after Deny). Not re-captured at 768 and 375.

## Verdict per viewport and state

| Viewport | State | Verdict | Shots |
|---|---|---|---|
| 1440 | Mercury first open | Fails: empty black thread, no content at all (overlaps #158). 65% dead space measured. | `1440x900-mercury-first-open.png` |
| 768 | Mercury first open | Same; sidebar takes 316px of 768 (41%). | `768x1024-mercury-first-open.png` |
| 375 | Mercury first open | Same; clean header and composer, nothing to read. 82% dead space measured. | `375x812-mercury-first-open.png` |
| 1440 | Thinking, tool step | Works but the tool label is raw ("Using Getaccounts") and the timer is misleading. | `1440x900-mercury-thinking-a.png`, `-thinking-b.png`, `-thinking-after-confirm.png`, `-thinking-after-allow.png`, `-thinking-after-deny.png` |
| 1440 / 768 / 375 | Mercury read answer | Good. Clear sentence, bold amount, as-of date. | `{vp}-mercury-read-answer.png` |
| 1440 / 768 / 375 | First confirm card (Confirm payment request / Cancel) | Readable; the two buttons have equal weight. | `{vp}-mercury-write-confirm-ask.png` |
| 1440 / 768 / 375 | Approval card pending | Below excellent: raw tool name and JSON, unformatted amount. Allow once / Deny work and are reachable at all viewports. | `{vp}-mercury-approval-pending.png` |
| 1440 / 768 / 375 | Approval allowed | Outcome stated, but JSON stays and the outcome is small coloured text. | `{vp}-mercury-approval-allowed.png` |
| 1440 / 768 / 375 | Approval denied | Same card treatment; the follow-up answer is clear ("not submitted"). | `{vp}-mercury-approval-denied.png` |
| 375 / 768 | Composer with long text and emoji | Good. Grows, wraps, emoji render. | `{vp}-mercury-composer-long.png`, 1440 `1440x900-mercury-composer-long.png` |
| 1440 | Header Computer panel | Works; large blank area. | `1440x900-mercury-header-computer.png` |
| 768 | Header Computer panel | Broken: chat column about 130px wide, one word per line, header "M.", composer clipped. | `768x1024-mercury-header-computer.png` |
| 375 | Header Computer panel | Panel replaces the whole chat; no way to tell where the chat went except the close X. | `375x812-mercury-header-computer.png` |
| 1440 / 768 / 375 | Carta first open | Empty thread; a "Back to Cap table" link is the only content. | `{vp}-carta-first-open.png` |
| 1440 | Carta first send | Raw "Internal Server Error" banner (see CHAT-15). | `1440x900-carta-read-answer.png` |

No horizontal page overflow at any viewport (`pageOverflowX` 0, `pageScrollX` 0, `pageScrollY` 0 everywhere).

## Findings

Level: component, group, page, layout. Verified: measured (audit or DOM measure), observed (seen in screenshots or interaction), suspected (not confirmed).

| id | level | element | problem | norm | evidence | sev | found by | verified |
|---|---|---|---|---|---|---|---|---|
| CHAT-1 | component | Working label for a tool call | The status reads "Using Getaccounts" / "Using Getrecipients": a raw MCP tool name with only the first letter capitalised and a seconds counter. A founder cannot tell what is happening. | C1 plain labels, C3 status legible | `1440x900-mercury-thinking-b.png`, `1440x900-mercury-thinking-after-confirm.png` | P1 | own, [argon] flagged the sibling raw name on the card | observed |
| CHAT-2 | component | Sidebar row preview for the Mercury agent | While an approval is pending the preview text is "Review before mcp__finance-mercury__..." (also after Deny it shows the answer text, so it is only the pending state). The raw tool name leaks into navigation. | C1, C4 | `1440x900-mercury-approval-pending.png`, `768x1024-mercury-approval-pending.png` (sidebar row) | P2 | own, [muse], [argon] | observed |
| CHAT-3 | layout | Computer panel opened at 768px | The sidebar (316px) and the panel (about 318px) leave the chat about 130px: message text breaks one word per line ("sub / mitt / ed"), the header title becomes "M.", the composer shows "Please se". Geometry audit: `main#main-content` spills 39px, and message blocks spill 12-39px. The user cannot read the chat while the panel is open and nothing tells them to close it. | L6 reflow, L7 predictable regions, I8 states complete | `768x1024-mercury-header-computer.png`, `audit.json` key `768x1024/mercury-header-computer` | P1 | own, [muse] P0, [argon] P0 | measured |
| CHAT-4 | group | Computer panel content for an integration agent | The panel shows "Computer is on", a blank "Team Computer" box about 200px tall, then the caption "Mercury agent's computer screen" over nothing, and an empty Routines block. A Mercury agent that only calls a bank tool has no computer screen, so the panel is mostly dead space and a status ("on") that means nothing. | D2 whitespace, C2, C3 | `1440x900-mercury-header-computer.png`, `375x812-mercury-header-computer.png` | P2 | own, [muse], [argon] | observed |
| CHAT-5 | component | "Thinking" timer | The timer counts the time the person took to answer the approval card: "Thinking 34.8s" right after tapping Confirm, "Thinking 1m 12.7s" right after Allow once. It says the agent has been slow when it was waiting for the person. | C3 status legible, I2 feedback | `1440x900-mercury-thinking-after-confirm.png`, `1440x900-mercury-thinking-after-allow.png` | P2 | own | observed |
| CHAT-6 | component | Answered approval card | After a decision the full raw JSON stays and is the main content; the outcome ("Allowed once", "Denied", "Answered: Confirm payment request") is a 13.5px line of coloured text with no icon or restated amount. The first card's "Answered: Confirm payment request" is green, as if the payment succeeded. | H2 weight matches importance, C3 words plus colour, H4 colour with purpose | `1440x900-mercury-approval-allowed.png`, `1440x900-mercury-approval-denied.png`; `AskCard.tsx` uses `text-success` for every non-deny answer | P2 | own, [muse], [argon] | observed |
| CHAT-7 | component | Allow once / Deny weighting | Allow once is the only filled button (near-white, first); Deny is a dark outline. For an irreversible payment the permissive choice is the strongest and the safe choice recedes. Neither button states the amount or payee. I rate this P2, not P0: the choice is clearly labelled and the card above names the action. | H2, I3 error prevention | `1440x900-mercury-approval-pending.png` | P2 | [muse] P0, [argon] P1, own | observed |
| CHAT-8 | component | First confirm card buttons | "Confirm payment request" and "Cancel" are two identical full-width outline rows with left-aligned text and no primary action. They look like quiz answers. Overlaps the double-approval issue #150. | H1 one primary action, P2 familiar controls | `1440x900-mercury-write-confirm-ask.png`, `375x812-mercury-write-confirm-ask.png` | P2 | own, [muse], [argon] | observed |
| CHAT-9 | group | Approval card widths | The first card is about 940px wide, the second about 524px, with the same left edge; the thread has no common card width. Text lines in the wide card run about 110 characters. | L4 one grid, D1 measure 45-80ch | `1440x900-mercury-approval-pending.png` | P3 | own | observed |
| CHAT-10 | group | Touch targets on phone | Header menu 32x32, Computer button 34x30, attach 32x32, send 32x32, React/Reply/More 28x28 at 375px. All below 44px. | I4 Fitts (44px touch) | DOM measure at 375x812 | P2 | own | measured |
| CHAT-11 | layout | Sidebar at 768px | The sidebar stays open at 316px of 768px (41%) and the chat gets 452px; with any right panel it collapses (CHAT-3). The phone layout (hamburger) only begins below 768. | L7, L6 | `768x1024-mercury-first-open.png` | P2 | own | measured |
| CHAT-12 | component | Sidebar scroll position and footer | The sidebar opens scrolled to the active chat, so the top navigation (Inbox, Finance, Legal, Cap table) is hidden under the search field at 1440 and 768. At 768 the last workspace header ("MAIL NEEDS...") is cut off under the "Connect apps" bar. | L5 stable layout, D2 | `1440x900-mercury-approval-pending.png`, `768x1024-mercury-approval-pending.png` | P3 | own, [argon] (clipped header) | observed |
| CHAT-13 | component | "Back to Cap table" on the Carta chat | A text link sits inside the thread area under the header, not in the header, and is the only content on first open. | H5 consistency, L7 | `1440x900-carta-first-open.png`, source `apps/web/src/pages/Shell.tsx` (the `Back to Cap table` text) | P3 | own | observed |
| CHAT-14 | page | After "Allowed once" the answer ends in a dead end | The agent says the request "is pending approval. The funds may not move until Mercury approves it." There is no link, no status and no next step in the app; Maya has just approved and is told someone else must. The wording depends on the model; the lack of any pending-request status is the product gap. | I6 recognition, C3 | `1440x900-mercury-approval-allowed.png` | P2 | own, [muse] | observed |
| CHAT-15 | page | Send failure on the Carta agent | First send showed a red banner "Internal Server Error" above the composer: no cause, no action, no Retry. The message was not in the thread but the text stayed in the composer (good). The second send cleared the composer and showed nothing at all: no message, no banner, and after reload nothing was in the thread. The API was failing at the time (sign-in later returned 500), so the cause is probably the demo outage, not Carta; the missing feedback is the finding. | I3 error recovery, I2 feedback, C1 | `1440x900-carta-read-answer.png` | P1 | own | observed (cause suspected) |
| CHAT-16 | page | Same payment request, different flow | The $1,200 request went through a "Confirm payment request" card and then the "Review before" card. The $300 request skipped the first card and went straight to the second. The number of confirmations changes between identical requests. Overlaps #150 (two approvals) and #152. | H5 consistency, I3 | `1440x900-mercury-write-confirm-ask.png`, `1440x900-mercury-approval-denied.png` | P2 | own | observed |

Overlaps with filed issues (not re-reported): #150 (two approvals, different wording), #151 (raw tool name and JSON on the approval card, `1200` without `$`), #152 (re-ask after Deny), #153 (Elio first call unexplained), #158 (empty first open, no intro), #154 (Connect apps letters, argon flagged it).

### Second-opinion claims I did not accept

- "Header monitor button is about 16px" [muse]: measured 34x30; it has the accessible name "Computer and routines". Rejected as stated, but see CHAT-10 for the 44px touch size.
- "Approval cards have no timestamp or action row" [muse]: the React/Reply/More row and time appear on hover for those cards too (`1440x900-mercury-approval-allowed.png`). Rejected.
- "Mic disappears when text is typed" [muse], [argon]: intended (the mic is "Call Elio", shown only when the draft is empty). Not a finding.
- "Allow vs Deny is P0" [muse]: downgraded to P2 (CHAT-7).
- "Computer panel is P0 at 768" [muse], [argon]: it is opt-in and closable; P1 (CHAT-3).

## Excellent as is

- Mercury read answer: one sentence, bold amount, and the as-of date ("as of October 14, 2026") that tells Maya how fresh the figure is. `1440x900-mercury-read-answer.png`.
- After Deny, the agent says plainly "was not submitted; the action was denied" and asks what to do next. `1440x900-mercury-approval-denied.png`.
- A pending approval card survives a page reload and the agent run resumes after the answer. Observed after the browser was relaunched.
- The first card's text names the amount, payee and account mask ("send $1,200 to Acme (Mock) from MOCK Checking ••1111") before the second card.
- On a phone the pending card is scrolled into view with Allow once and Deny above the composer (`375x812-mercury-approval-pending.png`).
- Composer: grows with long text, wraps correctly, emoji render, send replaces mic. No horizontal overflow at any viewport (audit `pageOverflowX` 0).
- Loading states: skeleton with "Opening your Space..." and, when the server is unreachable, "Reconnecting" with a counter and "Retry now" (observed during the outage). The Thinking row uses the shared shimmer style.
- Status colours are semantic (green allowed, red denied) with no extra identity colour; the bot avatar carries the only colour.

## Likely source files (checked with `git ls-files`)

| finding | file |
|---|---|
| CHAT-1 | `apps/web/src/pages/Shell.tsx` (working label, `Using ${activity.label}`) |
| CHAT-2 | `packages/adapters/src/executor.ts`, `packages/adapters/src/approval-ask.ts` (the `Review before ...` title is the message text that the sidebar previews) |
| CHAT-3, CHAT-4, CHAT-11, CHAT-13 | `apps/web/src/pages/Shell.tsx` (computer panel, `computer screen` caption, layout, `Back to Cap table`) |
| CHAT-5 | `apps/web/src/pages/Shell.tsx` (working row and timer) |
| CHAT-6, CHAT-7, CHAT-8, CHAT-9 | `apps/web/src/components/AskCard.tsx` |
| CHAT-10 | `apps/web/src/pages/Shell.tsx` (header, composer buttons), `packages/ui-web` button sizes |
| CHAT-12 | `apps/web/src/pages/Shell.tsx` (sidebar) |
| CHAT-14, CHAT-16 | agent prompt and flow in `apps/api/src/integration-agent.ts`, `packages/adapters/src/approval-ask.ts` |
| CHAT-15 | `apps/web/src/pages/shell/composer-error.tsx` |

## Counts

By severity: P0 0, P1 3 (CHAT-1, CHAT-3, CHAT-15), P2 10 (CHAT-2, 4, 5, 6, 7, 8, 10, 11, 14, 16), P3 3 (CHAT-9, 12, 13).
By level: component 8 (CHAT-1, 2, 5, 6, 7, 8, 12, 13), group 3 (CHAT-4, 9, 10), page 3 (CHAT-14, 15, 16), layout 2 (CHAT-3, 11).
Total 16.
