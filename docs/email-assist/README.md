# Email agent panel (mockup)

Mockup: the Storybook stories in `apps/web/src/components/inbox/InboxEmailAgent.stories.tsx`, under "Inbox / Email agent panel" (`pnpm --filter @rakazo/web storybook`). Screenshots are in this folder: `closed`, `working`, `ready`, `draft-in-composer` and `phone`, each at 1440x900 (`-d`) and 375x812 (`-m`). All names and figures are invented.

## Problem

Replying to an investor often needs facts from Carta, the data room and past mail. The founder searches each one by hand before answering.

## Proposed flow

1. In the open email dialog, the founder clicks Ask agent. Nothing runs before that.
2. The existing page-agent side panel opens beside the dialog (an overlay on a phone) with the chat the button already creates: the thread card, then the agent's lookups as the usual tool steps.
3. The agent answers each question with links to its sources, says what it could not find, and writes a draft reply. A figure the agent computed is labelled "calculated" with where it came from.
4. Reply opens the existing composer with the draft as the body. The founder edits and sends through the normal send flow. Nothing is sent automatically.

Today Ask agent calls `inbox.askAgent` and leaves the dialog for the full chat. Here it opens that same per-conversation agent in the panel.

## Existing components used

`InboxMessageDialog`, `ResizableSidePanel`, `Transcript` (with `MailThreadCard`, `ToolActivityDisclosure`, `ToolCallLabel`, markdown links), `Composer`, `BotAvatar`, `ComposeEmail`. Details are in the story file.

## Gaps the mockup shows (not built)

- `InboxMessageDialog` has no slot for a side panel. The story lays the panel over the page beside the dialog. The real change is a slot that widens the dialog.
- The draft reaches the composer through `inbox.compose.prefill`, which would need to accept the agent's draft body. The story mocks that response.
- The agent's answer message holds the draft. Opening Reply from the dialog is a story simplification.

## What each lookup uses

- Email thread: `mail_get`.
- Holdings: Carta read tools (`fetch`) or the saved Cap Table snapshot (holder, security, shares, as-of date). Current holdings only.
- Documents: `search_data_room`, `read_data_room_item`.
- Past mail: `mail_search`, `mail_grep`, `mail_get`.
- Post-recap share count is calculated from the recap document, not read from Carta.

## Open questions

- Should the panel be offered on every email, or only on emails that ask a question?
- Can Carta return holdings before and after a recap? Unverified until sign-in.
- At 320px the tool rows truncate their summaries. Should the dialog and panel share one width so the panel can be 384px?
