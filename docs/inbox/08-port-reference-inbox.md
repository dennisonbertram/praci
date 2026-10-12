# 08 — Port the reference inbox experience

Status: proposal. Builds on items 01–07, which are implemented on the local `feat/inbox` branch together with the follow-ups (account tabs, Gmail-powered filters and search, images in opened mail, faster Inbox agent).

The reference implementation is a single-user, local-first app (SQLite files, the user's own Google client, `gmail.modify` and `gmail.compose` scopes). Nothing ports as code. Each feature below is re-specified for Rakazo's rules: provider-neutral adapters, optional vendors, multi-tenant Postgres state, minimal copy.

## What already matches

- Dump-then-grep agent search (`mail_search`, `mail_grep`, `mail_get`).
- One row per thread, multi-account, per-account tabs, server-side Gmail search and filters, load more.
- Needs reply group and a capped AI to-do list. To-dos are keyed by message id, which avoids the reference's reworded-duplicate bug.
- Rate-limited hydration with `Retry-After` backoff (Rakazo now runs 12 in flight per account).

## Phase 1 — read-only, current scopes

1. **Classifier interface and taxonomy.** Add `InboxClassifierProvider` to `packages/adapter-kit` next to `AutoReviewProvider`. The current LLM triage becomes the default adapter; an optional TypeSafe adapter asks the reference's seven typed questions (category, needs response, newsletter, phishing, junk, brand mismatch, priority) with its thresholds and mapping order. Low confidence or any error falls back to the LLM path. The LLM still writes `reason`, `todo` and `due`, but only for messages that need a reply or action. Widen categories toward the reference's set where the UI uses them (bills/billing, receipts, scheduling, newsletters, security, notifications, personal, suspicious, spam/scam). Offline conformance tests run both adapters through the same cases. TypeSafe has its own AI-data consent recipient and is off unless configured through shared connection settings.
2. **Important view.** An All / Important toggle on the list, where Important means critical or important priority, or needs a reply.
3. **Category views.** Category entries (from item 1's taxonomy) open a filtered list. Read-only in this phase.
4. **Suspicious badge.** Show a badge on rows classified suspicious, phishing or brand mismatch. Never auto-hide them.
5. **Attachments in the read view.** List attachments with name and size, and download through the API scoped to the user and connection. Sending attachment bytes to a model needs a separate consent card (phase 2).
6. **Inbox overview tool.** One tool that returns a ready summary of recent inbox state from the Postgres cache (needs reply, priorities, to-dos) in a single call, replacing the 13–15 small tool rounds the Inbox agent takes today. Model it on the reference's attention digest.
7. **Email result cards in chat.** When the agent cites messages, render them as cards grouped by urgency (Today, Within 3 days, This week, Later), with Later as a compact row list. Clicking a card opens the message.
8. **Relevance feedback.** "Mark important" / "Mark noise" on a row, stored per user and space in Postgres and used by ranking and triage. No Gmail write.

## Phase 2 — Gmail writes

Sending was approved first (decision 10 in the README now allows drafts and sending, not the other writes). Item 2 below is built; items 1, 3 and 4 still need `gmail.modify`, restricted-scope verification for public deployments, and their own sign-off. The proxy paths (Composio, Pipedream, native Google) now carry POST, PUT and DELETE with a JSON body, and `MAIL_WRITES_DISABLED=true` is the deployment-wide kill switch.

1. Archive, spam, label, mark read from the read view; bulk archive on category views behind a confirmation dialog.
2. **Built.** Reply, reply all, forward and compose. The user's Send click is the approval (no extra modal). The composer saves a Gmail draft as the user types, and a send is keyed by a client-generated id in Postgres (`ComposeSend`), so a retry or double click never sends twice and a send with an unclear outcome is never repeated (the user is told to check Sent). Plain-text body; the HTML part is generated from it and escaped. Left out for now: attachments (a forward quotes the text only), rich text, and re-opening a saved draft in Rakazo (it stays in Gmail Drafts).
3. Agent write tools (`create_draft`, `modify_labels`, `archive`) gated by Rakazo's existing action-approval flow. No direct send tool; the agent proposes a send card. Not built: the agent still has no draft or send tool.
4. Cards: send confirmation (editable fields), quick reply (several drafts, send one), bulk action, attachment-read consent. Each has Dismiss, persisted with the message, taking no Gmail action.

## Phase 3 — larger features

1. **Triage loop.** One important thread at a time with keyboard actions (reply, snooze, to-do, done, undo). Snooze is Rakazo-side state in Postgres that resurfaces on new inbound mail; done needs phase 2's archive.
2. **Focus items.** Durable multi-thread work streams with status, AI review and to-dos. Large; specify separately.
3. **Inbox brief.** A periodic summary (open loops, timely, recently resolved) produced by a worker job per user.
4. **Calendar invitations.** Render invites in the read view and chat, with RSVP. Needs calendar scopes and a calendar provider interface.

## Not ported

Local SQLite stores, the loopback OAuth server, file locks, the single-user learning reranker (redesign later in Postgres if feedback data shows it pays off), the hidden morning show, and copy-heavy explainer text.

## Decisions needed

1. Reverse decision 10 and allow Gmail writes (phase 2)? Answered for sending: yes, drafts and send only. Archive, label and mark-read still need a decision.
2. Add TypeSafe as an optional classifier, and is a separate consent for it acceptable? Key as a deployment setting or per user?
3. Adopt the wider category set?
4. Are Focus items, the triage loop, the brief and calendar in scope, and in what order?

## Build order

Phase 1 items 1 and 6 first (classifier interface; overview tool fixes agent speed), then 2–5 and 7–8 in parallel. Phase 2 only after decision 1. Phase 3 items are specified individually when reached.
