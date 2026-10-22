# Walk J1: long journeys (first run, Monday inbox, runway before a board meeting)

Walker session uxl11-J1, mock-data demo stack (web 5381), 1440x900. First-run path used a fresh invented user (walker-j1-N@northwind.example.test); Legal, Investors and the Gmail contents came from the shared mock founder (read only). Screenshots: /tmp/uxloop11/J1/.

## Story verdicts

| Story | Verdict | Steps actual / ideal | Notes |
|---|---|---|---|
| STORY-APP-309 (sign-up to first answer, model sign-in) | BLOCKED (model step) / PASS (rest) | 4 form steps + 1 focus card + 1 Ask Chief + 1 Allow, about 7 / 6 | The demo has a default model, so "Connect a model" never shows and /onboarding redirects to Chief. Real provider sign-in is UNVERIFIED. |
| STORY-APP-319 (first-day: connect, tour, first question) | PARTIAL PASS | about 17 with the full 9-stop tour, 9 with Skip / 12 | "Connect your apps" step is BLOCKED (not shown on the demo). Gmail connected inline from Chief's card in one click (emulator). Tour opens only after the focus card is answered; 9 stops; "Ask Chief" sends a canned question. |
| STORY-APP-209 (sign-up to "when do we run out?") | PASS | about 16 / 14 | Mercury connects in one click, Finance renders at once, Chief's runway answer (24.6 mo, 10 Nov 2028, cash $1,622,420.55) matches the page. |
| STORY-INB-022 (first morning: connect, allow, sort, reply, clear) | PASS with friction | about 14 of 18 walked (no attachment filing, no keyboard help) | One Allow (given on Chief's first message) covered Inbox, no second consent. Sort took about 3.5 min on the demo. After replying, Morgan left Needs reply and the matching to-do vanished by itself (excellent). |
| STORY-APP-211 (board prep) | PARTIAL PASS | Legal, Investors, Finance runway, Hide amounts walked | Carta agent prompt, Data room search, Forward, Chief talking points not walked. Hide amounts masks money everywhere including Chief's sidebar preview. |
| STORY-APP-203 (Chief runway then Finance) | PASS | 3 / 3 | Chief and page agree. |
| STORY-INB-023, STORY-INB-109 (piles, Digest, Cleanup, Spam) | SKIPPED | - | Out of time; Updates/Newsletters/Cleanup not walked. |
| STORY-INB-040, STORY-APP-213, STORY-APP-144 (phone) | SKIPPED | - | Scope said 1440x900. |
| STORY-APP-024, STORY-APP-210, STORY-APP-212, STORY-APP-214 | SKIPPED | - | Not reached. |

Measurements: geometry audit on Inbox, Integrations and Runway shows no horizontal overflow, no wrapped controls, no spills beyond expected sibling width differences. Console: no errors during the walk.

## Excellent (kept as is)

- Sign-up goes straight to Chief in under a second, with one focus question and Gmail/Calendar cards inline in the chat.
- Connecting Gmail and Mercury is one click each and the result appears at once.
- Sorting state is honest: "Sorting your mail...", then "Sorting is taking longer than usual. Your mail is below." with a retry, then it finishes by itself.
- Replying removes the mail from Needs reply and ticks off its to-do automatically.
- Hide amounts leaves nothing visible: tiles, chart axes, rows, sidebar chat preview; "Amounts hidden - Show" in the header.
- Legal deadline buttons have specific accessible names ("Mark X done").

## Findings

| id | page / story | sev | cat | what happened vs expected | evidence | suspected code | proposed fix |
|---|---|---|---|---|---|---|---|
| J1-01 | Inbox, STORY-INB-022 step 13 | P2 | flow | Observed. After replying in the message dialog and pressing Esc, the list scrolled about 600 px down to the row's new group ("Other mail today"), hiding the To do card and the next Needs reply mail. Expected the list to stay at the top or land on the next mail. | b12-list-after.png vs b13-top.png | apps/web/src/pages/Inbox.tsx:1098-1108 (focus() on the row without preventScroll, row has moved to another group) | Call focus({ preventScroll: true }), or focus the next row when the selected row left its group. |
| J1-02 | Chief first answer, STORY-APP-319 step 14 | P1 | flow/copy | Observed. The first question ("What should I do first this week?") was answered while the mailbox was still sorting: Chief said no emails need a reply and there are no open to-dos (bold). Two minutes later the Inbox shows 9 needing reply and 5 to-dos. The first impression is a confident wrong answer. | a11-reply2.png vs b06-retry.png | Inbox agent / Chief delegation prompt (not located) | When sorting has not finished, say "I am still sorting your mail" and do not state counts; or wait for the sort. |
| J1-03 | Chief first answer | P3 | copy | Observed. Two stacked bubbles say the same thing ("I don't see any saved tasks..." then "This week: ..."). | a11-reply2.png | Chief reply composition | Merge into one reply. |
| J1-04 | Inbox first sort, STORY-INB-022 step 3 | P2 | perf | Observed on demo (model latency, may differ with a real model). First sort took about 3.5 min; the "taking longer" notice appeared at about 2 min. Rows were readable the whole time. | b02..b06 | Inbox.tsx:295-300 (stall threshold) | Keep; consider showing sort progress or an estimate after 15 s. UNVERIFIED with a production model. |
| J1-05 | Legal Contracts tab | P2 | visual | Observed. Contract names truncate ("MOCK Insurance Policy - Shield...") while the Status column is empty on 9 of 11 rows and the Parties column is wide. Similar names (Master Services Agreem..., Reseller Agreement - Ca...) lose the part that tells them apart. | f01-legal.png | Legal contracts table column widths (apps/web/src/pages/Legal*.tsx, not located) | Give the Contract column the spare width; show Status as a badge beside the name. |
| J1-06 | Finance, Hide amounts | P3 | bug | Observed. Turning Hide amounts on adds a "3-mo change" column with "...%" to Subscriptions, and the layout shifts; with amounts visible the column is absent. Cause from code: trendText() treats the masked string as non-"0%", so a 0% change counts as present. | c03 vs g01-hidden.png | apps/web/src/lib/finance-format.ts:144-150 | Decide null/zero before masking in trendText. |
| J1-07 | Chief runway answer | P3 | copy | Observed. "Based on the saved bank-only runway scope" is internal wording; the page shows "3-mo avg, after revenue". | c04-chief-runway.png | Finance agent prompt | Say "Based on your bank balances and the last 3 months of spending". |
| J1-08 | Finance / Runway | P3 | visual | Observed. The four tiles on Runway are 170 px wide and left-clustered above a full-width chart; Finance's four tiles span the full width. | c05-runway.png vs c03-mercury.png | apps/web/src/pages/Finance*.tsx runway header | Use the same 4-up grid as Finance. |
| J1-09 | Mail reply send | P3 | flow | Observed. After Send, "Sending... Undo" shows, the Undo pill goes after about 5 s, but "Sending..." lasts about 14 s in total and the thread shows no confirmation until it appears as Sent. | b09/b10/b11 | Inbox compose send queue | Show "Sent" toast when done, or shorten the undo window. |
| J1-10 | Tour stop 9/9 | P3 | visual | Observed. The last popover ("Change settings, export your data...") sits on top of the composer, so Maya cannot see the input she is told to use next. | a07-tour-9.png | apps/web/src/components/tour/FirstRunTour.tsx | Place this stop above the user row or to its right. |
| J1-11 | Legal Deadlines | P3 | flow | Observed. Each auto-renewing contract produces two rows (a "Send non-renewal notice" row and a "Renews automatically" row), so 10 deadlines come from 5 contracts, each with three buttons. | f02-deadlines.png | Legal deadline generator | Fold the renewal date into the notice row's subtitle. |
| J1-12 | First run, STORY-APP-309/319 | - | blocked | Model step and "Connect your apps" step cannot be walked on the demo (server has a default model; integrations need no setup). Real ChatGPT/OpenRouter/Google sign-in UNVERIFIED. | /onboarding redirects to /app/{bot} | - | Walk on a stack with no default model. |

Counts: P0 0, P1 1, P2 3, P3 7, blocked 1.
