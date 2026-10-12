# Inbox item 4: web Inbox page and server-side mail cache

## Goal

Add an Inbox entry to the web sidebar that opens `/app/inbox`. The page lists the
signed-in user's recent mail from every connected mail account, laid out as in
`approved-mockup.html`: header with account tabs (All plus one per account), an
optional To do card, then the groups Needs reply, Today and Earlier. Opening a
row shows the message. A server-side cache in Postgres keeps the list fast and
gives the sidebar an unread count without calling the mail provider on every render.

Electron hosts the same page, so it needs no extra work. Mobile reuses the
same RPC procedures later (a separate item); this item adds no mobile UI.

Non-goals for this item: sending or replying, archiving, marking read, labels,
search (the Inbox agent covers search), and the right-hand Inbox agent panel.

## Dependencies

- **Item 1 PR 1 (mail provider).** This item uses item 1's names: `listAccounts`,
  `listMessages(account, { query, after, pageSize, pageToken, useCache })`,
  `getMessage(account, id)` (returns `text` and optional `html`), and
  `createMailEmulator()` for tests. There is no `changesSince`; sync re-lists the
  window. Do not add a second interface.
- **Item 6 PR 1 (Shell inbox mode).** The `/app/inbox` route, the `inboxMode` flag
  and its guards in `Shell.tsx` land first, with an empty main pane in inbox mode.
  This item's PR 2 renders the page in that pane.
- **Item 5 (triage and to-dos)** fills `needsReply` and supplies to-dos. This
  item renders both only when data exists, so it ships and works before item 5.

## Routing and layout decision

`/app/inbox` renders `ShellPage`, not a standalone page like `/app/artifacts`,
because the mockup keeps the bots sidebar visible and item 6 puts the Inbox
agent panel on the right. Item 6 PR 1 has already added
`<Route path="/app/inbox" element={<ShellPage />} />` before `/app/:botId` in
`App.tsx`, and in `Shell.tsx` `const inboxMode = useMatch("/app/inbox") != null;`
with the guards that keep the route from redirecting to a bot. When it is true, `<main>` renders `<InboxPage />`
in place of the bot header, transcript and composer, and the sidebar Inbox row
shows as active. Item 6 PR 2 then puts the Inbox agent's thread in the right panel.

**Opening a message: inline expand.** Clicking a row expands the message
under it, and clicking again collapses it. The open message id lives in the URL
as `?mail=<id>`, so Back closes it and item 6 can read which message is selected.
It must not be `?m=`: `ShellPage` already reads `?m=` as a jump to a chat message
in the active bot's thread, and in inbox mode the active bot is the Inbox agent.
A detail pane would compete with the agent panel for width. A separate route
would hide the list. Inline expand needs no new layout.

## Component tree and files

```
ShellPage (Shell.tsx)
├─ sidebar: InboxNavRow            "Inbox" + unread count, above the roster
└─ main (when /app/inbox): InboxPage (pages/Inbox.tsx)
   ├─ header: <h1>Inbox</h1> + account Tabs (ui-web tabs, pill style)
   ├─ To do card slot             rendered by item 5 only when it has to-dos
   ├─ InboxGroup × 3              Needs reply / Today / Earlier, empty groups hidden
   │  └─ InboxRow                 dot · from · subject — snippet · time
   │     └─ InboxMessageView      expanded body: SandboxedHtmlViewer or plain text
   └─ empty / loading / error states
```

New files:
- `apps/web/src/pages/Inbox.tsx`: the page, rows, and expanded message (one file, as with `Board.tsx`).
- `packages/core/src/inbox-groups.ts` and `.test.ts`: a pure function `groupInbox(rows, now)` that returns `{ needsReply, today, earlier }`. It lives in core because mobile (item 7) groups the same way.
- `packages/contracts/src/inbox.ts`: zod schemas and `inboxAgentSpawnKey(userId)` (returns `` `inbox-agent:${userId}` ``; item 3 owns the bot, but this PR needs the key for `inbox.list`), exported from the package index.
- `packages/adapters/src/mail-sync.ts` and `.postgres.test.ts`: `syncMailbox(deps, account, ctx)`. This lives in a package so a later worker job can reuse it.
- `packages/adapters/src/gmail-mail-provider.ts` (edit): the metadata-cache step item 1 describes, because this PR owns the table.
- `apps/api/src/inbox.ts`: handlers, wired into `router.ts` (the same pattern as `artifacts.ts`). `apps/api/src/app.ts` creates item 1's `createMailProvider(...)` and passes it as `RouterDeps.mail`; item 2 PR 2 later reuses that instance for the executor.
- `packages/db/prisma/migrations/<timestamp>_inbox_cache/migration.sql`.
- `apps/web/e2e/inbox.spec.ts`.

Edited files: `Shell.tsx` (nav row and the inbox-mode main pane),
`packages/contracts/src/rpc.ts` (the `inbox` namespace), `schema.prisma`, the
web locale catalogs (from `intl:extract`), and `PluginsOverlay.tsx`, which gets an
optional `initialQuery` prop so the empty state can open it filtered to mail.

Data fetching follows `Board.tsx`: `rpc.inbox.*` inside `useEffect` with local
state. The web app does not use react-query.

## Prisma schema

```prisma
model CachedMailMessage {
  id                String     @id @default(cuid())
  spaceId           String
  space             Space      @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  userId            String
  user              User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  connectionId      String
  connection        Connection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  providerMessageId String
  threadId          String
  fromName          String?
  fromAddress       String
  toAddresses       String[]
  ccAddresses       String[]
  subject           String
  snippet           String
  receivedAt        DateTime
  unread            Boolean
  inInbox           Boolean    @default(false) // set by sync from the in:inbox list
  fromSelf          Boolean    @default(false) // set by sync from the in:sent list
  needsReply        Boolean?   // null until item 5 triages it
  seenAt            DateTime   // last time a sync or a search wrote this row

  @@unique([connectionId, providerMessageId])
  @@index([spaceId, userId, inInbox, receivedAt])
  @@map("mail_messages")
}

model MailSyncState {
  connectionId  String     @id
  connection    Connection @relation(fields: [connectionId], references: [id], onDelete: Cascade)
  lastSyncedAt  DateTime?  // last successful sync
  syncStartedAt DateTime?  // claim held by the process that is syncing; stale after 2 minutes
  lastErrorAt   DateTime?  // set when the last sync failed, cleared on success
  claimToken    String?    // random id of the sync holding the claim; every write checks it

  @@map("mail_sync_states")
}
```

- The Prisma model is `CachedMailMessage` so it does not clash with item 1's
  `MailMessage` type in files that import both. Item 5 adds its triage columns to it.
- One table serves two readers. The Inbox list reads rows with `inInbox = true`.
  Item 1's `listMessages` also uses it as a metadata cache for item 2's searches: it
  looks up ids it is about to hydrate and inserts what it hydrated
  (`createMany` with `skipDuplicates`, `inInbox = false`), so a search never
  overwrites sync state.
- `spaceId` and `userId` are copied from the connection so that every query
  filters on the actor directly.
- **Revoke.** `connections.revoke` (`router.ts:5163`) only sets the connection's
  `status` to `"revoked"`; the row stays, so the `onDelete: Cascade` relations above do
  not fire. This PR adds `deleteMailConnectionData(tx, { spaceId, userId,
  connectionId })` in `mail-sync.ts` and calls it from the revoke handler in the same
  transaction as the status update. It deletes the connection's `mail_messages` and
  `mail_sync_states` rows; item 5 PR 1 adds its `inbox_todos` to the same function.
  As a second guard, every read in `inbox.*`, `syncMailbox` and item 5's triage
  joins `Connection` and requires `status = "connected"`, so rows of a revoked
  account are never listed, counted, synced or sent to a model. The cascades stay for
  the cases where a `Connection` row really is deleted.
- Only metadata is stored. Bodies are fetched on demand and never persisted.
- `snippet` and `subject` are capped at 500 characters when written.
- The migration is hand-checked SQL produced by `prisma migrate dev`, in the
  existing `YYYYMMDDHHMMSS_name` folder format.

## RPC contracts (`packages/contracts/src/inbox.ts` and `rpc.ts`)

```ts
export const inboxAgentSpawnKey = (userId: string) => `inbox-agent:${userId}`;

const MailAccountSchema = z.object({ connectionId: Id, label: z.string() }); // label = Connection.displayName
const MailRowSchema = z.object({
  id: Id, connectionId: Id, threadId: z.string(),
  from: z.string(), subject: z.string(), snippet: z.string(),
  receivedAt: z.string(), unread: z.boolean(), needsReply: z.boolean().nullable(),
});

inbox: {
  list: oc.input(z.object({ connectionId: Id.optional() }))   // omitted = All
    .output(z.object({
      accounts: z.array(MailAccountSchema),    // empty = no mail account connected
      agent: z.object({ botId: Id, name: z.string() }).nullable(), // the unarchived Inbox agent, if any
      rows: z.array(MailRowSchema),            // newest first, one row per thread
      syncedAt: z.string().nullable(),         // newest lastSyncedAt; null = never synced
      failedAccounts: z.array(Id),             // accounts with lastErrorAt set
    })),
  refresh: oc.input(z.object({ connectionId: Id.optional() })).output(z.object({ ok: z.literal(true) })),
  get: oc.input(z.object({ messageId: Id }))
    .output(z.object({ from: z.string(), to: z.string(), date: z.string(),
                       subject: z.string(), html: z.string().nullable(), text: z.string().nullable() })),
  unreadCount: oc.output(z.object({ count: z.number().int() })),
}
```

- `list` reads only Postgres. Rows are `inInbox = true`, belong to a connection with
  `status = "connected"`, and were received in the last 14 days; it returns at most 200 rows and keeps the newest message per `threadId`
  (a JavaScript dedupe over the sorted rows). Sent rows (`fromSelf` only) are never
  listed. `agent` is the bot with `spawnKey = inboxAgentSpawnKey(actor.userId)` in
  the actor's space, owned by the actor and not archived; it is `null` otherwise.
  One call therefore drives the empty state, the account tabs and the agent entry
  on web and mobile.
- `unreadCount` counts unread inbox threads of connected accounts in the cache, so
  the sidebar costs one indexed query.

**Authorization.** All procedures use the existing `authed` middleware. Every
query filters on `spaceId = actor.spaceId AND userId = actor.userId`. When a
procedure receives a `connectionId` or `messageId`, it first loads that row with
the same filter and throws `NOT_FOUND` if the row is missing, so the response
does not reveal another user's ids. Other members of the same space never see
your mail. `get` loads the cached row with the actor filter, then picks the
account whose `id` equals the row's `connectionId` from
`mail.listAccounts({ spaceId: actor.spaceId, userId: actor.userId })`, and calls
`getMessage(account, row.providerMessageId)`. The account never comes from client
input.

**Logging.** Log counts, durations, connection ids and sanitized error messages.
Never log subjects, snippets, addresses or bodies.

## Sync strategy

The sync runs on demand inside whichever API process receives `refresh`. There is
no scheduled job in this item. All coordination state is in Postgres, so any
number of API processes can serve refreshes for the same user at once.

1. When `InboxPage` mounts, it calls `list`, renders the cache immediately, and
   then calls `refresh`. When `refresh` resolves, the page calls `list` again.
   The sidebar calls `unreadCount` when it mounts and again after any refresh.
   Triage finishes after `refresh` returns; item 5 PR 3 adds the follow-up fetch
   (`triagePending`, see item 5).
2. `refresh` runs `syncMailbox` for each of the actor's mail accounts (from
   `listAccounts` with the actor's scope), at most 4 accounts in parallel within
   the request.
3. **Claim (throttle and lock in one statement).** `syncMailbox` first makes sure
   the state row exists (`INSERT … ON CONFLICT DO NOTHING`), then claims it with a
   fresh random `token` (`randomUUID()`):

   ```sql
   UPDATE mail_sync_states SET "syncStartedAt" = now(), "claimToken" = $2
   WHERE "connectionId" = $1
     AND ("lastSyncedAt" IS NULL OR "lastSyncedAt" < now() - interval '60 seconds')
     AND ("syncStartedAt" IS NULL OR "syncStartedAt" < now() - interval '2 minutes')
   RETURNING "connectionId";
   ```

   No row returned means the account synced in the last 60 seconds or another
   request (on any process) is syncing it, so this call skips it. Times come from
   Postgres `now()`, so clock differences between processes do not matter. A
   process that dies mid-sync leaves a claim that expires after 2 minutes.
   **Deadline.** The provider calls run under an `AbortSignal.timeout(90s)`, shorter
   than the 2-minute stale window, so a live sync normally finishes or gives up before
   another process may take over.
4. **Sync.** With the claim held, it lists two queries for the last 14 days,
   `in:inbox` and `in:sent`, with `useCache: false` (so `unread` is fresh and
   `listMessages` writes nothing), page size 100, at most 200 messages each, and keeps
   the results in memory. All database writes then happen in **one transaction that
   first checks ownership**:
   `SELECT 1 FROM mail_sync_states WHERE "connectionId" = $1 AND "claimToken" = $2 FOR UPDATE`.
   If no row comes back, another process has taken the claim, so this sync writes
   nothing and returns. The row lock also makes a competing claim wait until this
   transaction commits, after which that claim sees the fresh `lastSyncedAt` and
   skips. Inside the transaction it upserts the rows keyed on
   `(connectionId, providerMessageId)`, updating only metadata columns and
   `seenAt` (never item 5's triage columns): inbox rows get `inInbox = true`, sent
   rows get `fromSelf = true`. Then, for that connection only, it sets
   `inInbox = false` on rows that were in the inbox but are missing from a complete
   inbox list or older than the window (when the list hit the 200 cap, only rows
   newer than the oldest listed message are cleared), and deletes rows with
   `inInbox = false` whose `seenAt` is more than 14 days old. That last delete
   also expires metadata that item 2's searches cached.
5. **Release.** Success sets `lastSyncedAt = now()`, `lastErrorAt = null`,
   `syncStartedAt = null`, `claimToken = null` in the same transaction. A provider
   error (or the deadline) sets `lastErrorAt = now()`, `syncStartedAt = null` and
   `claimToken = null` with `WHERE "claimToken" = $2`, so a sync that lost its claim
   cannot clear its replacement's, and leaves `lastSyncedAt` alone, so "Try again" is
   not throttled. A failure for one account does not stop the others; `list` returns
   accounts with `lastErrorAt` set in `failedAccounts`, and the page shows their
   cached rows together with a retry action.
6. After every successful sync, it enqueues item 5's `inbox.triage` job for the
   user through the API's existing `JobPublisher` (item 5 PR 2 adds this call). The
   job key merges repeated enqueues into one job, and the job itself finds what needs
   work: new mail, threads with new sent replies, a backlog left by the per-run cap,
   or messages that became eligible because a model or consent was set up later.

```ts
// ponytail: synchronous refresh in the API request. Move it to a
// graphile-worker job (replaceKey per connection) when refreshes take too long
// or triage needs syncing without the page open. The claim above stays as is.
```

Grouping runs on the client (`groupInbox` from `packages/core`, shared with
mobile) so that "today" uses the viewer's time zone. A thread with
`needsReply === true` goes in Needs reply; item 5 makes the server return
`needsReply` already false for handled threads, and sorts that group by priority. Other threads received
since local midnight go in Today, and the rest go in Earlier. When no row has
`needsReply` set (item 5 has not run), Needs reply is hidden. All empty groups
are hidden.

## Message view

`get` fetches the body from the provider each time a message is opened. HTML
bodies render in the existing `SandboxedHtmlViewer` at a fixed height of
`min(70vh, 640px)`. Its CSP already blocks remote images (`img-src data:`),
which also blocks tracking pixels, and blocks network access (`default-src 'none'`).
A "show images" control is not part of this item. Plain-text bodies render as
`whitespace-pre-wrap` text. Opening a message does not mark it read, because
the inbox is read-only in v1 (see the end of this doc).

## States

- **No mail account connected:** the page shows one button, "Connect mail". It
  opens the Integrations overlay with `initialQuery="gmail"`. If item 1 ships its
  own connect flow, the button opens that flow instead.
- **Loading on first visit, with an empty cache:** `Skeleton` rows from ui-web, with no text.
- **Cache empty after sync:** "No mail".
- **`list` error:** `errorText(cause)` and "Try again", as on other pages.
- **Some accounts failed:** the same `errorText` line and "Try again", shown above the groups.
- **Refreshing over existing data:** no indicator. The rows update when the refresh finishes.

## User-facing copy

AGENTS.md requires every new string to be quoted and justified.

| Copy | Where | Why it must exist |
|---|---|---|
| "Inbox" | sidebar row, page `<h1>` | Navigation label that the user asked for. The msgid already exists in the catalog. |
| "All" | first account tab | Required by the approved design. Existing msgid. |
| "To do" | card heading (item 5) | Shown only when to-dos exist. Approved design. |
| "Needs reply", "Today", "Earlier" | group headings | Approved design. Each is hidden when its group is empty. "Today" already exists; the other two are new. |
| "Connect mail" | empty state button | The page has nothing else to show, so the single action replaces any explanation. Without it the page would be blank. |
| "No mail" | empty list | Distinguishes "nothing arrived in the window" from loading or failure. Shown only when the list is empty. |
| "Try again" | error states | Existing msgid. |
| `{count, plural, one {# unread} other {# unread}}` | `aria-label` on the sidebar count | The visible count is only a number, so screen readers need its meaning. Not shown visually. |

Account tab labels come from `Connection.displayName`, which the user can
rename in Integrations. There is no explainer text, sync status, or "last
updated" line. Run `pnpm --filter @rakazo/web intl:extract` and commit the
updated catalogs. CI fails if the catalogs are stale. As in earlier feature PRs,
new non-English entries can be left empty and fall back to English.

## Tests

- **Unit (core):** `packages/core/src/inbox-groups.test.ts` checks the Needs reply, Today and
  Earlier split around local midnight, that Needs reply is hidden when every
  `needsReply` is null, and that empty groups are hidden.
- **Adapters (Postgres-gated):** `mail-sync.postgres.test.ts` runs against item 1's
  emulator and the real Prisma client, gated by `VERIFY_DATABASE` like
  `board-app.postgres.test.ts`. It covers:
  - the first full sync of inbox and sent mail (`inInbox`, `fromSelf` set);
  - a second sync after the throttle clears a message that left the inbox and
    keeps triage columns intact;
  - the 60-second skip, and two concurrent `syncMailbox` calls for one account
    (two Prisma clients, standing in for two processes) calling the provider once;
  - a stale claim older than 2 minutes being taken over, after which the original
    sync's write transaction finds a different `claimToken`, writes nothing, and
    does not clear the new claim;
  - a failure on one account setting `lastErrorAt` and leaving the others intact;
  - search-cached rows (`inInbox = false`) never listed, and deleted after 14 days
    unseen;
  - the metadata-cache step: a second `listMessages` for the same ids makes no
    `messages.get` calls, and `useCache: false` always hydrates.
- **API:** `inbox.postgres.test.ts` covers:
  - user A cannot `list`, `get`, or `refresh` with user B's `connectionId` or
    `messageId` in the same space (`NOT_FOUND`), and user A's rows never appear in
    user B's `list` or `unreadCount`, in the same space or another;
  - `agent` is user A's own unarchived Inbox agent, never user B's;
  - `unreadCount` counts threads, not messages;
  - revoking a connection deletes its cached rows and sync state, and a revoked
    connection's rows are excluded from `list`, `unreadCount` and `refresh` even if
    they were still present.
- **E2E:** `apps/web/e2e/inbox.spec.ts` stubs `**/rpc/inbox/*` with
  `page.route`, as `integration-setup.spec.ts` stubs its RPC calls, so it needs no
  mail provider. It signs up, clicks the sidebar "Inbox" row, checks the URL and
  the groups, switches an account tab, and opens a message with an HTML body.
  It captures `inbox-list`, `inbox-message-open` and `inbox-empty` with
  `captureScreenshot`; the UI PRs link the `inbox-list` screenshot.

## PR breakdown

1. **Cache and contracts.** Prisma models and migration, `contracts/inbox.ts`
   (with `inboxAgentSpawnKey`), `syncMailbox` and `deleteMailConnectionData` with
   their tests, the revoke-handler call, the metadata-cache step in
   `gmail-mail-provider.ts`, the `inbox.*` handlers and the API authorization tests.
   Depends on item 1 PR 1. No UI.
2. **Inbox page.** `Shell.tsx` main-pane content (`<InboxPage />` in the inbox-mode
   pane that item 6 PR 1 added) and nav row with unread count, `Inbox.tsx`, `packages/core` `inbox-groups`, the `PluginsOverlay`
   `initialQuery` prop, catalogs, and the E2E spec with screenshots. Depends on
   PR 1 and item 6 PR 1. The PR description quotes the copy table above. Item 5
   then adds the To do card and fills `needsReply` without changing this page's
   layout.

## Decided: read-only in v1

Opening a message does not mark it read. Marking read needs `gmail.modify` and a
`markRead` method on item 1's interface; both are listed under item 1's "Later".
The unread dot keeps matching the mailbox until the user reads the message
elsewhere and the next sync picks that up.
