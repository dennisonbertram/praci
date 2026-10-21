# Email agent panel (mockup)

Open `mockup.html` in a browser. All names and figures are invented.

## Problem

Replying to an investor often needs facts from several places: Carta, the data room and past mail. The founder searches each one by hand before answering.

## Proposed flow

1. In the open email dialog, Ask agent opens a panel on the right. On a phone it is a sheet.
2. The agent lists what the email asks, then looks up what it needs and shows each lookup as a tool step.
3. Per question it gives a short answer with source chips that open the source, and flags anything it could not confirm.
4. "Reply with draft" opens the normal reply composer with the draft text. The user edits and sends through the usual send flow. Nothing is sent automatically.

Entry point: the existing Ask agent button. Today it calls `inbox.askAgent` and opens the full chat of a per-conversation agent. The panel uses the same agent; "Open in chat" goes to that chat.

## What each lookup uses

- Email thread: `mail_get`.
- Holdings: Carta read tools (`fetch`) or the saved Cap Table snapshot (holder, security, shares, as-of date). Current holdings only.
- Documents: `search_data_room`, `read_data_room_item`.
- Past mail: `mail_search`, `mail_grep`, `mail_get`.
- Post-recap share count is calculated from the recap document, not read from Carta, and is labelled as calculated.

## Open questions

- Should the agent start on open, or after a click on a "Look up" button (cost and privacy)?
- Are answers saved on the thread agent's chat, so reopening is instant?
- Can Carta return holdings before and after a recap? Unverified until sign-in.
- Should the panel be offered on every email, or only when the email contains a question?
