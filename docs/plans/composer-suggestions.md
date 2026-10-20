# Live suggestions in the composer

Status: plan and mockup (`docs/composer-suggestions/mockup.html`); no product code yet. Owner answers are TBD. Line numbers are deliberately omitted; paths are repo-relative.

## Goal

While the owner types a message, the composer may offer one quiet chip that turns the text into a structured action: "Create event · Fri 7:00 PM", "Add task", "Ask Finance agent", "Ask Legal agent". Accepting the chip sends the message with a structured hint, and the backend runs the normal agent tool with the normal approval. Ignoring the chip changes nothing: the message sends as plain chat.

## Non-goals

- No model call while typing in v1. Nothing the owner types leaves the device until they press send.
- The client never creates events, tasks or messages to other agents itself.
- No suggestion list, ghost preview or card that replaces the composer (Shapeshift does this; we do not).
- No new tools, no new agents, no suggestion history, no learning from accept rates in v1.
- No suggestions in slash commands, in group chats, or while editing an earlier message.

## Inspiration, and what we do not copy

The research note (Shapeshift, an MIT-licensed demo) shows two ideas worth keeping: a local classifier plus deterministic parsers ("the classifier picks the kind, code computes the values"), and an anti-flicker rule so the suggestion does not jump on every keystroke. We write our own implementation in our own package. We do not take its code, its card set, its hosted-model client or its UI.

## What exists today

| Area | Fact |
|---|---|
| Web composer | `Composer` in `apps/web/src/pages/Shell.tsx`. It already tracks a slash query (a draft that matches `/^\/…$/`) and a skill chip, and renders the `@` mention picker. |
| Mobile composer | `apps/mobile/components/thread-composer.tsx`, used from `apps/mobile/app/thread.tsx`. |
| Shared composer logic | `packages/core/src/composer-slash.ts` (`serializeComposerPrompt`), `composer-mentions.ts`, `composer-mention-picker.ts`, each with tests. Web and mobile both import them. |
| Send | `threads.send` (`packages/contracts/src/rpc.ts`, input `threadSendInput`): text, attachments, mentions, reply, `clientNonce`. |
| Calendar | `calendar_create_event` (`packages/adapters/src/calendar-tools.ts`); listed as approval-required in `packages/core/src/action-approval.ts`. |
| Tasks and reminders | `scratchpad_add` (an open-work item on the bot, no approval) and `schedule_create` (a reminder or recurring job). Both in `packages/adapters/src/builtin-tools.ts`. |
| Contacts | `contacts_list`, `contacts_add`, `contacts_save`. Used for resolving "Sam" later, not in v1. |
| Page agents | Found by spawn key: `isFinanceAgentSpawnKey` (`packages/contracts/src/finance.ts`), `isLegalAgentSpawnKey` (`legal.ts`), and the Inbox, Data room, Carta and integration equivalents (see `packages/core/src/connection-access.ts`). Bots carry `spawnKey`. |
| Agent-to-agent | `message_bot` (`packages/adapters/src/builtin-tools.ts`), with `bot_id` or `confirm_name`, async. Mentions in `threads.send` already route a message to a chosen bot. |
| Approvals | Cards such as `apps/web/src/components/MailApprovalCard.tsx`; the executor pauses a consequential tool and resumes after the owner approves (`packages/adapters/src/executor.ts`). |
| AI consent | `packages/core/src/ai-consent.ts` and `AiConsentStatus` in `packages/contracts`: a foreground disclosure before AI processing. |

## UX

One chip at most, never a row of them.

- **Where.** Directly above the text field, left-aligned, inside the composer's card on web and Electron. On mobile it sits in a bar attached to the top edge of the keyboard (above the input). The chip is a small pill: an icon, the label, and a faint `Tab` hint on desktop only.
- **Keyboard (web, Electron).** `Tab` accepts when the caret is at the end of the text and no picker is open. `Esc` dismisses the chip for the current draft. `Enter` always sends as plain chat; it never accepts the chip. Screen readers get the chip as a button inside a polite live region, named by its label.
- **Touch.** Tap the chip to accept. The chip has a small close control; swiping is not needed. The keyboard's return key still sends plain chat.
- **Accepting** sends the message at once with the structured hint. There is no second confirmation from the chip; the approval card is the confirmation for anything that changes the outside world.
- **Dismiss memory.** A dismissed kind stays hidden for that draft until the text is cleared or sent. It is not stored.
- **Appears** only after the draft has at least 12 characters and 3 words, the caret is at the end, and typing has paused for 350 ms.
- **Never shows when:** the draft is a slash command or has a skill chip; the user is editing a past message; a mention picker is open; the thread is a group (v1); the agent is running a turn that the composer is steering (follow-up mode); the draft has an attachment only; the owner has turned suggestions off.
- **Off switch.** A single setting, "Composer suggestions", default on. It is hidden under Settings, General; no onboarding card.

## Suggestion kinds for v1 (four)

Each uses a tool or route that already exists.

| Kind | Trigger signals (examples) | Runs | Approval |
|---|---|---|---|
| `create_event` | A date or time parsed from the text plus an event word (dinner, meeting, call, lunch, flight) | `calendar_create_event` through the active bot | Yes, the existing calendar approval card |
| `add_task` | "remind me to", "don't forget to", "todo", "I need to" followed by a verb | `scratchpad_add` for a plain task; `schedule_create` when a time is parsed ("remind me tomorrow at 9") | None for scratchpad (the bot's own list); `schedule_create` follows today's rule |
| `ask_finance` | invoice, payment, runway, burn, bill, expense, refund, a currency amount, with a question or request shape | Send the text to the Finance agent's thread | The Finance agent's own tool approvals |
| `ask_legal` | contract, NDA, clause, term sheet, redline, indemnity, signature | Send the text to the Legal agent's thread | The Legal agent's own tool approvals |

`ask_finance` and `ask_legal` appear only if the matching page agent exists for this user (found by spawn key, from the bot list the composer already loads). A chip for an agent that is not set up is never shown.

Deliberately not in v1: email drafting, contacts, data room, Carta, projects, "did you mean" with two chips.

## Classifier and parsers

A new shared, pure TypeScript package, `packages/composer-intent` (or a folder in `packages/core` if the owner prefers fewer packages; TBD). No DOM, no network, no clock except an injected `now` and `timeZone`.

```
suggest({ text, now, timeZone, availableKinds }) -> Candidate[]   // sorted by score
type Candidate = { kind, score, label, parsed? }                  // parsed: { start?: ISO, allDay?: boolean }
```

- **Signals** are small named functions returning 0 to 1, each unit-tested: `hasEventWord`, `hasTimeExpression`, `hasReminderLead`, `hasMoneyWord`, `hasCurrencyAmount`, `hasLegalWord`, `isQuestionOrRequest`. A kind's score is a fixed weighted sum of its signals. Weights and the 0.7 show threshold are constants in one file.
- **Dates** are parsed by a date parser library in the chrono-node family (a new dependency; owner to approve, see questions), with the owner's time zone and week start. The parsed value is only used for the label. The label is formatted by the platform's `Intl.DateTimeFormat` ("Fri 7:00 PM").
- **Ambiguity.** If a date parses with low certainty ("Friday" with no time, past dates, or two plausible dates), `create_event` drops below the threshold and no chip shows. We would rather stay quiet than show a wrong time.
- **Ties.** Two kinds within 0.1 of each other: show nothing in v1.
- **Language.** English signals only in v1; other languages show no chip.
- **Optional model step (off by default).** The same `suggest` signature can be implemented by a provider-neutral `IntentClassifier` interface in `packages/adapter-kit`, with any vendor only in an adapter. Not built in v1. See Privacy.

## Anti-flicker rule

The visible chip is state, separate from the raw top candidate.

1. Evaluate on each pause (350 ms debounce), not each keystroke.
2. A chip appears when the top candidate is at or above 0.7 on two evaluations in a row.
3. A shown chip is replaced by a different kind only when the new kind is the top candidate on two evaluations in a row. A single evaluation that disagrees changes nothing.
4. A shown chip disappears only when its kind is below 0.5 on two evaluations in a row (a lower threshold than the show threshold, so it does not blink at the edge).
5. The label (for example the time) may update in place without counting as a change of kind.
6. Dismissal wins over everything until the draft is cleared or sent.

This is a pure function `nextChipState(previous, candidates)` with a table-driven test.

## Privacy

- In v1, typing never leaves the device. The classifier is local code; nothing is sent while typing, nothing is logged, nothing is cached on a server.
- The accepted text is sent only because the owner pressed send or accepted the chip, through the same `threads.send` path as any message, so the same AI consent applies.
- An optional model step would send draft text while typing, which is a new kind of data use. It would be off by default, behind a separate setting, gated by the existing AI consent flow with its own disclosure line, and never active for BYO-key spaces without that consent. Not built in v1.
- The off setting stores one boolean per user. No draft text is stored anywhere new.

## What accepting does

1. The client calls `threads.send` as usual, with the full text and one new optional field: `suggestion: { kind: "create_event" | "add_task" | "ask_finance" | "ask_legal" }`. It carries no times, ids or arguments.
2. The backend validates the kind, checks the user is allowed to use it, and re-runs the same shared parser on the text with the user's time zone. It does not trust parsed values from the client.
3. For `create_event` and `add_task`, the backend adds a short instruction to the run prompt ("the owner chose: create a calendar event; use `calendar_create_event` and ask if anything is unclear"), then the model calls the normal tool. The executor applies the normal approval: the calendar approval card appears, and nothing is created until the owner approves.
4. For `ask_finance` and `ask_legal`, the backend resolves the page agent by spawn key within the caller's space and user (never from a client-supplied bot id) and delivers the message to that agent's thread using the same path as an `@` mention. If the agent is gone, the message goes to the current bot unchanged.
5. If the hint is invalid or stale, the backend ignores it and treats the message as plain chat. The hint can narrow what the model is told to do; it never grants a tool or skips an approval.

The client shows the usual sent message; for routed kinds the thread shows the usual mention routing.

## Data and contracts

- One additive optional field on `threadSendInput` in `packages/contracts/src/rpc.ts`. No migration.
- One user preference (suggestions on or off). Prefer an existing per-user settings record over a new table; if none fits, this needs one boolean column. TBD in PR 4.
- No suggestion log in v1. Accept and dismiss counts can come later from existing product events if the owner wants them.
- Multi-tenant: nothing is stored per draft; every lookup of a page agent is scoped to space and user on the server.

## Mobile parity

Same shared package and same state function. The chip is a native accessory above the keyboard (SwiftUI via Expo UI where the project already uses it; otherwise a plain `StyleSheet` pill using tokens from `apps/mobile/lib/appearance`). Tap accepts; a small close control dismisses. VoiceOver reads the label as a button. Electron uses the web UI unchanged.

## Copy

| String | Where | Why it is needed |
|---|---|---|
| `Create event · {Fri 7:00 PM}` | event chip | Names the action and shows the parsed time so the owner can see what would be created before accepting. |
| `Add task` | task chip | The action is self-explanatory; adding more would repeat the interface. |
| `Remind me · {Tue 9:00 AM}` | task chip when a time was parsed | Same reason as the event chip: the time is the thing to verify. |
| `Ask Finance agent` | finance chip | Names who will receive the message. |
| `Ask Legal agent` | legal chip | Same. |
| `Tab` | key hint on desktop, inside the chip | Only way to discover the shortcut without help text. Hidden on touch and after first use in a session. |
| `Dismiss suggestion` | accessible name of the close control (not visible text) | Required for screen readers; adds no visible words. |
| `Composer suggestions` | settings row label | One label for the one switch; no description. |

No helper text, tooltip or onboarding. If a PR adds any of these strings, its description must quote them and justify them as AGENTS.md requires.

## Risks

- **Wrong chip.** A wrong chip is mildly annoying; a wrong action is not possible because the model and the approval card still sit between the chip and any write. The threshold, the two-in-a-row rule and "quiet when unsure" keep the false rate low. We should measure the false-chip rate on a hand-written corpus before shipping.
- **Time zones.** The parsed time is shown in the owner's zone, and the backend re-parses in the same zone. A mismatch between a device zone and a saved zone is the main way the label could disagree with the created event; the approval card shows the real time.
- **Interrupting typing.** The chip lives outside the text field and never moves the caret. `Tab` is taken only at the end of the text, so it does not break focus order for people who tab out of the composer.
- **Hint prompt injection.** The hint is a closed enum and the text is already user text; no new untrusted content reaches the prompt.
- **Dependency.** A date parser is a new dependency. If the owner declines, a small own parser handles "today, tomorrow, weekday names, 7pm, 19:00" only.
- **Dead agents.** Chips for Finance and Legal depend on those agents existing; they are hidden otherwise.

## Open questions for the owner (TBD)

| Question | Recommendation | Answer |
|---|---|---|
| Is the date-parser dependency (chrono-node family) acceptable? | Yes, it is widely used and runs offline. | TBD |
| Are the four v1 kinds right? Anything to swap in (email draft, contact)? | Keep these four. | TBD |
| Should `add_task` write to the bot's scratchpad (no approval), or to the Projects/board tickets once those exist? | Scratchpad now. | TBD |
| `Tab` to accept: is it acceptable on web given it also moves focus? | Yes, only at end of text; `Enter` never accepts. | TBD |
| Default on or off? | On. | TBD |
| Group chats: none in v1? | None. | TBD |
| New package or a folder in `packages/core`? | New small package, so mobile and the API import it without core's weight. | TBD |
| Is an optional model step wanted at all, later? | Not until the local version proves its value. | TBD |
| Any other languages beyond English? | Not in v1. | TBD |

## Tests (offline)

- Signals: one unit test file per signal group, with positive, negative and borderline lines. A shared fixture file lists about 80 lines with the expected kind or "none". Both web and mobile test suites import it.
- Parser: fixed `now` and `timeZone` inputs; covers weekday names, "tomorrow", 12h and 24h times, past dates, and DST edges.
- `nextChipState`: table-driven tests for appear, hold, replace, disappear, label update and dismiss.
- Backend: `threads.send` with each hint kind and with an invalid hint (ignored), page agent resolution scoped to the right space and user, calendar approval still required. Uses the scripted runtime in `packages/adapters`.
- Web: a Storybook story with states (empty, typing, event, finance, accepted), and a component test for Tab, Esc, Enter and the "never shows" cases. Include a web test that opens the composer screen so CI captures the screenshot.
- Mobile: a unit test for the accessory's accept and dismiss handlers; the native look is checked by hand and noted in the PR.
- `pnpm design-system` regenerates the component catalog for the new chip.

## PR sequence

1. **Shared engine.** New package with signals, parsers, scoring, `nextChipState`, fixtures and tests. No UI.
2. **Contract and backend.** Optional `suggestion` on `threads.send`, server-side re-parse, prompt hint, spawn-key routing for the two agent kinds. Backend tests.
3. **Web chip.** Composer chip, keyboard behaviour, story and component tests, screenshot test. Behind the user setting, default off until the owner decides.
4. **Setting.** The one "Composer suggestions" preference and its storage.
5. **Mobile chip.** Accessory above the keyboard, same engine, parity checks.
6. **Corpus pass.** Measure false chips on a hand-written corpus and tune weights; flip the default if the owner agrees.
