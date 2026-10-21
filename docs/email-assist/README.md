# Email agent panel

Ask agent on an open email opens that email's own agent in a panel inside the message dialog. Screenshots are from the demo stack (`pnpm demo:up`) with invented Northwind data, in dark and light themes.

## Problem

Replying to an investor often needs facts from Carta, the data room and past mail. The founder searches each one by hand before answering.

## Flow

1. Open an email in the Inbox (`email-closed-d.png`, phone `email-closed-m.png`).
2. Ask agent opens the email's agent in a panel that widens the dialog (`panel-ready-d.png`, light `panel-ready-light-d.png`). It is the per-thread agent `inbox.askAgent` finds or creates. On a phone the panel fills the screen (`panel-ready-m.png`, `panel-ready-light-m.png`). The close button collapses it, and the agent's name opens the full chat. Nothing runs until Ask agent is clicked.
3. The panel is the Shell's page-agent chat: header, `Transcript`, `Composer`. It opens with the start of the newest answer in view, and does the same when a run finishes. The lookups sit in the usual collapsed tool activity (`panel-lookups-d.png`). `compare-inbox-agent-d.png` is the Inbox page's own agent chat, for comparison.
4. The agent writes a reply with `mail_send`, which shows as the usual mail card for the owner to approve. When such a card is waiting, "Reply with draft" appears above the composer and opens the normal Reply composer with the card's body above the quoted original (`reply-with-draft-d.png`, `reply-with-draft-light-d.png`). The owner edits and sends through the normal send flow; nothing is sent by the panel.

## Permissions

The email agent has the Inbox agent's mail permissions, through one predicate, `isMailAgentSpawnKey` (Inbox agent or email agent): no connector tools, access to every Gmail account, and `mail_send` always asks for approval whatever the saved rules say. It has no Carta, Finance or Data room tools. Its instructions tell it to ask those agents with `message_bot`.

Not shared with the Inbox agent, on purpose: being the owner other agents ask for mail, the Inbox page's notifications, the sidebar folder, and the one-Inbox-agent-per-user rules.

## Decisions

- The draft is the agent's pending `mail_send` card, not parsed text and not a Gmail draft. The agent already writes replies that way, and the card carries recipients, subject and body.
- The panel polls the thread every 2.5 seconds while a run is active, and stops when the run ends or the panel closes. The Shell's event subscription is part of its 6,800-line state and cannot be reused without a large refactor.
- Tool steps show in this panel whatever the chat's tool-activity setting says.

## Not done

- The demo's agent chat is pre-written, and its mail card shows "No longer active" because no run is waiting on it. A live run was not tested (the demo has no model key).
- A reply already started for the same email wins over the draft: the composer reopens the unsent reply.
- After the owner sends from the composer, the agent's card stays pending until it is discarded.
- Agents created before this change keep their old instructions, so they are not told to use `message_bot` for Carta and Data room facts.

## Open questions

- Should Ask agent offer the panel on every email, or only when the email asks a question?
- Can Carta return holdings before and after a recap? Unverified until sign-in.
- Should Inbox agent also lose its Data room tools? It has them today; the email agent does not.
