# Inbox plan

## Goal

Give each user an Inbox in Rakazo: one list of recent mail across every Gmail account
they connected (through Composio, Pipedream, or Rakazo's own Google OAuth client), a
Needs reply group and a short To do list filled by background triage, and an Inbox
agent beside the list that can search the user's whole mail history with built-in
tools. It ships on web and desktop (Electron hosts the web UI) and on mobile. It is
built for a multi-tenant deployment: every record is scoped to a space and user, and
all shared state lives in Postgres so any API or worker process can serve any request.

Approved design: [approved-mockup.html](approved-mockup.html).

| Doc | Item |
| --- | --- |
| [01-mail-provider.md](01-mail-provider.md) | Provider-neutral `MailProvider` and the three adapters |
| [02-mail-tools.md](02-mail-tools.md) | `mail_search`, `mail_grep`, `mail_get` built-in tools |
| [03-inbox-search-skill.md](03-inbox-search-skill.md) | `inbox-search` skill and the Inbox agent |
| [04-inbox-page.md](04-inbox-page.md) | Postgres mail cache, `inbox.*` RPCs, web Inbox page |
| [05-triage-todos.md](05-triage-todos.md) | Background triage and to-dos |
| [06-agent-panel.md](06-agent-panel.md) | Inbox agent panel in `ShellPage` |
| [07-mobile.md](07-mobile.md) | Expo Inbox screens |

## Decisions

1. **Saved mail searches are in Postgres** (`MailSearch` + one `MailSearchRow` per
   record), scoped by space, user and bot, expiring after 24 hours through a delayed
   graphile job. Owner-only access is unchanged (bot owner, direct thread, not a group,
   not a messaging channel). Grep runs in-process over rows read in batches of 500,
   after Postgres pre-filters by line, date and (for literal patterns) `ILIKE`; context
   lines are then fetched by line range, because the pre-filter removed them. ReDoS
   guard and the 16,000-character output budget are kept.
2. **Big search ports the reference**: list ids, hydrate metadata at 4 concurrent per
   account, back off on 429/403 honoring `Retry-After`, 60-second deadline. One page-size
   contract, 1..500, in the provider and the emulator. A page interrupted during
   hydration returns what it hydrated plus `unhydratedIds`. A capped search stores a
   resume cursor (unhydrated ids and the Gmail page token per account and query) and is
   continued with `mail_search({ continueFrom: searchId })`; there is no date-only
   `before` bound, which would skip the rest of a cut-off day. Ids already in item 4's
   metadata cache are not fetched again.
3. **Inbox sync is on demand.** The 60-second throttle and the in-flight claim are one
   conditional `UPDATE` on `MailSyncState` that stores a random `claimToken`. The sync
   collects provider results under a 90-second deadline (shorter than the 2-minute
   stale window), then writes everything in one transaction that first locks the state
   row and checks the token, so a sync that lost its claim writes nothing. The cache
   also stores the user's sent mail for the same 14-day window. `inbox.list` returns
   the Inbox agent (or null) and the accounts (empty means none connected).
4. **Inbox agent identity** is `spawnKey = "inbox-agent:<userId>"`, built only by
   `inboxAgentSpawnKey()`. The only creation path is item 3's `ensureInboxAgent`
   behind `inbox.agent`. Its name is "Inbox agent", as in the mockup.
5. **Tool argument names** are item 2's schemas; the skill text in item 3 matches
   them. The skill is the only copy of the model guidance. The test that ties skill
   tool names to the contract lands with the tools (item 2 PR 2).
6. **Google OAuth**: `state` is stored in Postgres on the pending `Connection`, and
   the PKCE verifier is recomputed from it with the deployment secret, so the
   callback works on any process. `connections.complete` is extended to accept
   `{ state, code }` alongside the existing `{ connectionId }` polling. Scope
   `gmail.readonly`. Native Google is offered only in a web browser in v1: mobile has
   no session in its auth browser, and desktop opens connect URLs in an embedded
   Electron window, which Google forbids. Both keep the managed connector. When native
   Google is configured, a web browser shows one Gmail entry that uses it.
7. **Triage** runs in one job per user (graphile `jobKey`), enqueued after every
   successful sync. One shared function, `triageReadiness`, resolves the model (Inbox
   agent override, then default) and checks AI-data consent for that exact recipient;
   the job and the page's `enabled` flag both call it. Each run recomputes
   `alreadyHandled` for the 14-day window, classifies at most 100 messages, syncs
   to-dos under a per-user advisory lock, and re-enqueues itself while backlog remains.
   The page refetches a bounded number of times while `inbox.list` reports
   `triagePending`. Triage never leaves more than 5 open to-dos.
8. **Disconnect deletes mail data explicitly.** `connections.revoke` only marks the
   `Connection` revoked, so no cascade fires. The revoke handler calls item 4's
   `deleteMailConnectionData` (cached messages, sync state, to-dos) and item 2's
   `deleteMailSearches`, and every inbox, triage and search read requires
   `status = "connected"`.
9. **Per-account concurrency cap is per process** in v1; Gmail's own quota and the
   retry backoff are what keep it correct.
10. **Reading, plus drafts and sending.** Reversed from "read-only" for sending only: a user can
    reply, reply to all, forward and compose, and the Inbox saves Gmail drafts as they type.
    The user's Send click is the approval; there is no extra confirmation step. The Inbox can
    archive and mark a message read or unread (`gmail.modify`, same reconnect rule as sending). The
    agent has `mail_draft` (save or replace a draft), `mail_modify` (read state, archive,
    labels) and `mail_send` (send a saved draft or a new message), each behind the normal tool
    approval and the "Ask before email actions" rule. `mail_send` uses the same `ComposeSend`
    record, keyed on the tool call, so a replayed call never sends twice.
    Native Google asks for `gmail.compose` and `gmail.modify` next to `gmail.readonly`; accounts connected before
    that only read, and a send from one shows the existing reconnect notice. A send is keyed by
    a client-generated id in `ComposeSend` (`draft`, `pending`, `sent`, `failed`, `unknown`) so a
    retry or double click never sends twice, and a send whose outcome is unclear is never
    repeated: the user is told to check Sent. `MAIL_WRITES_DISABLED=true` turns off drafts and
    sending for the whole deployment. See phase 2, item 2 of
    [08-port-reference-inbox.md](08-port-reference-inbox.md).

## Implementation order

"After" lists hard dependencies. PRs in the same wave can be built in parallel.
Rows marked **\*** edit shared files (`packages/db/prisma/schema.prisma`,
`packages/contracts/src/rpc.ts`, `apps/api/src/router.ts`, `apps/api/src/app.ts`,
`packages/adapter-kit/src/background-jobs.ts`); they merge one at a time in row
order (see Notes).

| # | Wave | PR | After |
| --- | --- | --- | --- |
| 1 | A | 01 PR 1: `MailProvider` interface, `GmailMailProvider`, emulator (incl. `in:sent`), conformance | — |
| 2 | A | 02 PR 1: pure mail-results format and grep in `packages/core` | — |
| 3 | A | 03 PR 1: `inbox-search` skill and executor loading | — |
| 4 | A | 06 PR 1: `/app/inbox` route and `Shell.tsx` inbox mode (empty main pane, guard E2E) | — |
| 5 | B | 01 PR 2a: Composio `proxy()` | 1 |
| 6 | B | 01 PR 2b: Pipedream `proxy()` | 1 |
| 7 | B\* | 04 PR 1: mail cache, sync claim, `inbox.*` contracts and handlers, `RouterDeps.mail`, revoke cleanup, metadata-cache step | 1 |
| 8 | B\* | 02 PR 2: mail tools, `MailSearch` tables, resume cursor, expiry job, disconnect cleanup | 1, 2, 3 |
| 9 | B\* | 01 PR 2c: native Google connector, extended `connections.complete` | 1 |
| 10 | C | 01 PR 2d: Google setup screen, callback page, one-Gmail-entry rule (hidden on desktop and mobile) | 9 |
| 11 | C\* | 03 PR 2: `ensureInboxAgent` and `inbox.agent` | 7 |
| 12 | C | 04 PR 2: web Inbox page and sidebar row | 4, 7 |
| 13 | C\* | 05 PR 1: triage columns, `InboxTodo`, to-do revoke cleanup, pure triage logic | 7 |
| 14 | D | 06 PR 2: Inbox agent panel | 4, 11, 12 |
| 15 | D\* | 05 PR 2: `inbox.triage` job, `triageReadiness`, enqueue after every sync | 13 |
| 16 | E\* | 05 PR 3: to-do RPCs, `triagePending` refetch, To do card and Needs reply on web | 12, 15 |
| 17 | F | 07 PR 1: mobile Inbox list | 11, 16 |
| 18 | G | 07 PR 2: mobile message detail (tap-only links) | 17 |

Notes:

- Waves A and B start as soon as their dependencies merge; 5, 6 and 9 are one
  subagent each. Wave C items are independent of each other except for the merge
  order below.
- **Shared files.** Starred rows may be built in parallel but merge in row order:
  7, 8, 9, 11, 13, 15, 16. Each rebases on `main` immediately before merging and reruns
  its tests. A PR that changes `schema.prisma` regenerates its migration after the
  rebase so its folder timestamp sorts after the ones already merged.
- 5 and 6 edit disjoint files, and neither edits a file that 7, 8 or 9 edits. 7 edits
  `gmail-mail-provider.ts` after 1 has merged. 13 and 15 edit item 4's `mail-sync.ts`
  after 7 has merged.
- Locale catalogs (10, 12, 14, 16) are regenerated with lingui extract after each
  rebase, never hand-merged.
- 17 and 18 both touch `apps/mobile/app/_layout.tsx` and the mobile locales, so they
  run one after the other.

## Open risks

- **Search speed is unmeasured.** Google's quota page implies about 300 metadata
  `get`s per minute per account; the reference implementation's identical approach is
  fast in practice, which is unexplained. Measure in each adapter's manual smoke test.
- **Managed-OAuth limits are invisible.** Composio and Pipedream proxy calls add a hop,
  and their shared Google projects have per-project limits Rakazo cannot see.
- **Composio query strings** with repeated parameters in an absolute endpoint are
  unconfirmed until the 2a smoke test.
- **Pipedream account refs** (`providerRef = "gmail"` on existing rows) were found by
  reading code, not reproduced; PR 1's wrapper test confirms the fix.
- **Google restricted scope.** Self-hosters in Google's "Testing" mode reconnect every
  7 days; public deployments need Google's restricted-scope verification.
- **Gmail page-token lifetime is undocumented.** A `continueFrom` long after the first
  search may get its token rejected; that query reports an error and the bot searches
  again.
- **Synchronous sync in the API request.** Slow providers make `inbox.refresh` slow
  (bounded by the 90-second deadline). Move it to a worker job when that shows up; the
  Postgres claim stays.
- **Rare duplicate triage calls** when two triage jobs for one user overlap. Data stays
  correct; the cost is one extra model call.
- **Triage results can lag.** The page refetches for at most 30 seconds while triage is
  pending; slower triage shows on the next visit or refresh.
- **Saved-search volume.** Up to a day of searches (worst case about 22 MB each) sits
  in Postgres. Watch table size after launch.
- **Google-only deployments** cannot connect Gmail from mobile or desktop in v1; users
  connect in a web browser. A desktop follow-up can reuse the existing system-browser
  loopback flow (`desktop.oauth.open`).
- **Managed Gmail connects on desktop are unverified** against Google's embedded-browser
  block. That is today's behavior; check it in the 2a/2b smoke tests.
- **Email links do not open on Android** in v1, because react-native-webview cannot tell
  a tap from an automatic navigation there. iOS opens tapped links only.
- **Prompt injection** through mail content reaches the agent and the triage model.
  Both treat mail as untrusted data, triage has no tools, and its output is enum
  fields and short plain text.
