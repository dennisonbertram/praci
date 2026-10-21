# Email agent panel (prototype)

A working prototype in the real app, not a merge candidate. Screenshots are from the demo stack (`pnpm demo:up`) in the default dark theme, with invented Northwind data.

## Problem

Replying to an investor often needs facts from Carta, the data room and past mail. The founder searches each one by hand before answering.

## What the prototype does

1. Open an email in the Inbox. The dialog is as it is today (`email-closed-d.png`, phone `email-closed-m.png`).
2. Ask agent opens that email's own agent in a panel inside the dialog, which widens to hold it (`panel-ready-d.png`). It is the same per-thread agent `inbox.askAgent` finds or creates today. The close button collapses the panel. On a phone the panel fills the screen, as the Shell's side panel does (`panel-ready-m.png`).
3. The panel is the Shell's docked page-agent chat: the same header, `Transcript` and `Composer`. The seeded chat shows the thread card, the lookups as the usual collapsed tool activity (`panel-lookups-d.png`), and an answer that flags a calculated figure and a gap, followed by a draft reply.
4. `compare-inbox-agent-d.png` is the Inbox page's own agent chat in the same session, for comparison.

The agent starts only when Ask agent is clicked. The demo's chat is pre-written, so no model runs.

## What is new code

- `apps/web/src/components/inbox/EmailAgentPanel.tsx`: loads the thread with `threads.get`, polls while a run is active, sends with `threads.send`, and renders the Shell's header, `Transcript` and `Composer`. The Shell does this with an event subscription inside a 6,800-line component, so the panel repeats the minimum.
- `InboxMessageDialog`: a new `onAskAgentPanel` prop and the panel slot beside the message. `Inbox.tsx` passes it in place of `onAskAgent` (which still opens the full chat for other callers).
- Demo seed: the Sam Ortiz thread and its pre-written agent chat (`packages/testkit/src/cli/demo`).

## Not done

- "Reply with draft". The draft is text in the agent's answer. Dropping it into the composer would need `inbox.compose.prefill` to accept the agent's draft body.
- Live updates: the panel polls instead of using the Shell's thread subscription.
- Tool steps always show in this panel, whatever the chat's tool-activity setting says.
- Very long tool-step summaries make a bubble wider than a narrow panel (a `Transcript` behaviour); the seed keeps them short.

## What each lookup uses

- Email thread: `mail_get`.
- Holdings: Carta read tools (`fetch`) or the saved Cap Table snapshot (holder, security, shares, as-of date). Current holdings only.
- Documents: `search_data_room`, `read_data_room_item`.
- Past mail: `mail_search`, `mail_grep`, `mail_get`.
- The post-recap share count is calculated from the recap document, not read from Carta, and the answer says so.

## Open questions

- Should Ask agent offer the panel on every email, or only when the email asks a question?
- Can Carta return holdings before and after a recap? Unverified until sign-in.
- Should the panel replace the full-chat route from the dialog, or sit beside it?
