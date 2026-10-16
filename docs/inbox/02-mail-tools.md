# Inbox item 2: built-in mail tools

Line anchors refer to `main` at `c9375d42`.

## Goal

Give any bot whose owner has connected mail three built-in tools, so it can answer
history questions ("when did Jana first email me?", "everything from the school this
year") without pulling hundreds of messages into the conversation:

1. `mail_search` pages through the owner's mail through the `MailProvider` (item 1),
   saves every match as rows in Postgres, sorted oldest-first, and returns only a
   summary and a `searchId`.
2. `mail_grep` searches those saved rows and returns bounded matching rows.
3. `mail_get` opens one message body.

Later additions: `mail_draft`, `mail_modify` and `mail_send` change the user's mail. The agent can
send with `mail_send` (a draft id from `mail_draft`, or a new message), but only with the user's
approval of each send. A send with an unclear outcome is reported, never retried, and
`MAIL_WRITES_DISABLED=true` blocks all three.

This ports the "big search, save the results, grep" approach from the reference
implementation. The reference kept results in a local file; Rakazo keeps them in
Postgres, because the search and the grep can run on different API or worker
processes. Everything provider-specific stays in item 1's adapters.

### What is ported, simplified, or dropped

| Reference behavior | Decision |
| --- | --- |
| Dump-to-file search, oldest-first rows, header lines, summary with `byYear` and first/last 3 rows | Port the rows, order and summary. The file becomes Postgres rows (see "Saved results"); the header lines become the stored summary. |
| Search mechanics: `messages.list` (500 ids per page), metadata `get` per id at 4 concurrent per account, backoff on 429/403, 60-second deadline | Port exactly. The hydration and retry live in item 1's `GmailMailProvider`; the deadline lives here. Item 1 also skips the `get` for ids already in item 4's metadata cache. |
| Coverage `complete`/`capped`, `coveredBackTo` | Port. The Gmail-syntax `continuationSuffix` (a date bound) is replaced by a resume cursor stored with the search, because a date-only bound skips the rest of a day that was cut off halfway. `mail_search` accepts `continueFrom: <searchId>`. |
| Grep: up to 20 patterns of 200 characters or fewer, case-insensitive, ReDoS literal guard, `dateFrom`/`dateTo` ISO-prefix filter, `maxResults`, `contextLines`, output budget | Port verbatim, except the budget is a fixed 16,000 characters instead of 5% of the model context window. The executor does not know the context window at that point. `ponytail:` comment: switch to the model's window if small-context models truncate too often. |
| Read a line range (`scratchpad_read`) and list files (`scratchpad_list`) | Dropped as separate tools. `mail_grep` with no patterns returns every row in the date range, and `afterLine` pages through the rows. The `searchId` comes back from `mail_search`; if it is lost from context, the bot runs the search again. |
| One-message read: 12k body characters by default, 40k maximum, quoted replies stripped | Port. The email-content privacy modes and the `includeBody` flag are dropped because Rakazo has no such setting. |
| Separate search tools for small and medium result sets (`gmail_search`, `gmail_collect_search`) | Dropped. `mail_search` with a small `maxMessages` covers them. |
| Natural-date rewriting ("last 2 weeks" becomes `newer_than:14d`) and from/to query mirroring | Not ported. One prompt sentence covers both, and each would need about 130 lines of regex plus tests. |
| `intent`, `pageSize`, `deadlineMs`, `includeSpamTrash` inputs | Dropped. Fixed internal values; Gmail `in:trash` / `in:spam` still work inside a query. |
| messages.get concurrency of 4 per account | Item 1's `GmailMailProvider` owns it. It is per process in v1 (item 1 explains why that is acceptable). |

## What this uses from item 1

Item 1's `MailProvider` (`@rakazo/adapter-kit`), with item 1's names:
`listAccounts({ spaceId, userId }, ctx)`, `listMessages(account, { query, pageSize,
pageToken, ids }, ctx)` returning `{ messages, nextPageToken, unhydratedIds }`, and
`getMessage(account, id, ctx)` returning `MailMessage` whose body is `text`.
`MailAccount` carries `id`, `address`, `label`, `spaceId` and `userId`. Tests use item
1's `createMailEmulator()`.

## Where the code lives

| File | Contents |
| --- | --- |
| `packages/core/src/mail-results.ts` (new) | Pure logic with no I/O and no vendor SDK: `resultRow`, `summarizeResults`, `coverage`, `grepRows` (batch-friendly; including `isSafeRegexPattern`, `isLiteralOnly` and `budgetJson`), `stripQuotedReply`, `clampInt`. It is exported from `packages/core/src/index.ts`. It uses a local structural row type, so core does not need to depend on adapter-kit. |
| `packages/adapters/src/mail-tools.ts` (new) | `mailSearchFromTool`, `mailGrepFromTool`, `mailGetFromTool` (same shape as `web-tools.ts`), the saved-results reads and writes through Prisma, `deleteMailSearches`, and `MAIL_TOOL_NAMES` with `selectMailTools` (same shape as `cloud-agent-tools-select.ts:3-18`). |
| `packages/db/prisma/schema.prisma` + migration `<timestamp>_mail_searches` | `MailSearch` and `MailSearchRow` (see "Saved results"). |
| `packages/adapter-kit/src/background-jobs.ts`, worker handlers | `mail.search.expire` job (payload `{ searchId }`), `replaceKey: mail.search.expire:<searchId>`. |
| `packages/contracts/src/builtin-tools.ts:4` | Add `"mail_search", "mail_grep", "mail_get"` to `BUILTIN_TOOL_NAMES`. This alone makes them disable-able in the bot panel; no UI change is needed (see below). The names and the three definitions land in the same PR, because `index.test.ts:176` requires the contract names to equal the definitions. |
| `packages/adapters/src/builtin-tools.ts` | Three `ConnectorTool` entries next to `web_search`/`web_fetch` (`:527-559`), each with `readOnly: true`. |
| `packages/adapters/src/executor.ts` | Wiring (next section). |

## Tool definitions

All three tools return JSON objects. Errors use `{ error: string }`, matching `web-tools.ts`.

### `mail_search`

Description: "Search the user's connected mail and save every match, sorted
oldest-first. Returns a summary and a searchId, not the messages. Then use mail_grep
on the searchId and mail_get for a few bodies."

```json
{
  "type": "object",
  "properties": {
    "queries": { "type": "array", "items": { "type": "string" }, "maxItems": 20,
                 "description": "Mail search queries (Gmail syntax), run exactly. Date-less queries cover all history." },
    "account": { "type": "string", "description": "Optional address of one connected account. Default: all." },
    "continueFrom": { "type": "string", "description": "searchId of a capped search. Fetches the older matches it did not reach; queries and account are taken from that search." },
    "maxMessages": { "type": "number", "description": "Default 1000, max 5000." }
  }
}
```

Behavior:

- Resolve the accounts with `deps.mail.listAccounts({ spaceId: run.spaceId, userId: bot.userId })`
  (the per-run memo below).
  If `account` is given and does not match one of them, return
  `{ error: "No connected mail account <x>" }`.
- Exactly one of `queries` and `continueFrom` is required; otherwise return
  `{ error: "Pass queries or continueFrom" }`.
- For each account and each query, page with `pageSize` 500 until the query is
  exhausted, the account's share of `maxMessages` (`ceil(max / accounts)`) is reached,
  or the 60-second deadline passes. The deadline is an `AbortSignal` combined with the
  run's signal and passed in the context, so item 1's retry backoff stops with it.
  Partial results with a continuation are the fallback when the deadline or a quota
  error stops a query, not the normal path. Deduplicate by `account.id + message id`. Sort by
  `(date, account, id)`.
- **Resume cursor.** Gmail lists newest first, so whatever a capped query did not reach
  is older than what it saved. For each (account, query) that stopped early, the search
  stores `{ accountId, query, unhydratedIds, pageToken }` in `MailSearch.resume`:
  `unhydratedIds` are item 1's ids listed but not hydrated on the interrupted page, and
  `pageToken` is the next page. Nothing is skipped, including messages from the same
  day. `continueFrom` loads that search with the run's scope (same rule as grep step
  1), hydrates each entry's `unhydratedIds` first (`listMessages` with `ids`), then
  continues from its `pageToken`. The new search saves only the newly found rows and
  its own `resume`. Queries that had finished are not run again.
- If Gmail rejects a stored `pageToken` (a 400 or 404 on the list call), that query is
  recorded with `stoppedReason: "error"` and coverage stays `capped`; the bot then runs
  a fresh search. Gmail does not document how long a page token stays valid.
- A failure in one account or one query is recorded in that query's summary
  (`stoppedReason: "error"`) and makes coverage `capped`. It does not fail the call.
- Save the rows (see "Saved results"), then return:

```json
{
  "searchId": "clx…",
  "records": 812,
  "dateRange": { "oldest": "2015-01-01T…Z", "newest": "2026-10-11T…Z" },
  "byYear": { "2015": 3, "…": 0 },
  "accounts": ["me@example.com", "work@example.com"],
  "perQuery": [{ "account": "me@example.com", "q": "from:jana", "complete": true, "hasMore": false }],
  "coverage": "complete | capped",
  "coveredBackTo": "2019-03-02T…Z",
  "firstRecords": ["0001 | …"], "lastRecords": ["0810 | …"]
}
```

`coveredBackTo` appears only when coverage is `capped`; it is the oldest saved date
among the queries that stopped early. A capped result is continued with
`continueFrom: <this searchId>`.
`failedAccounts` appears only when an account failed. The first and last row previews
are cut to 700 characters, as in the reference.

### `mail_grep`

Description: "Search the rows saved by mail_search. Patterns are case-insensitive regex;
patterns with quantifiers or backreferences match literally. Omit patterns to list rows."

```json
{
  "type": "object",
  "properties": {
    "searchId": { "type": "string", "description": "From mail_search." },
    "patterns": { "type": "array", "items": { "type": "string", "maxLength": 200 }, "maxItems": 20 },
    "dateFrom": { "type": "string", "description": "ISO date prefix, e.g. 2018 or 2018-06." },
    "dateTo":   { "type": "string" },
    "maxResults": { "type": "number", "description": "Default 50, max 200." },
    "contextLines": { "type": "number", "description": "0-5." },
    "afterLine": { "type": "number", "description": "Skip rows up to this line; for paging." }
  },
  "required": ["searchId"]
}
```

Returns `{ searchId, totalMatches, shown, matches: [{ line, text }], note? }`. Rows are
clipped to 500 characters. Matches are ORed together, and the date filter is applied
first. A match with context is clipped to 500 characters. The whole result is shrunk,
one match at a time, until it fits 16,000 characters. `note: "truncated - refine
patterns, dates, or maxResults"` appears whenever matches were dropped.

How grep reads rows, bounded in memory:

1. Load the `MailSearch` row by `id = searchId AND spaceId AND userId AND botId` (all
   three from the run). Missing gives `{ error: "No such search results" }`;
   `expiresAt <= now()` gives `{ error: "Results expired; run mail_search again." }`.
2. Postgres pre-filters: `line > afterLine`, and the ISO-prefix date filter as a
   string comparison on the stored ISO `date` (`date >= dateFrom` and
   `left(date, length(dateTo)) <= dateTo`). When every pattern will be matched as a
   literal (see ReDoS below), Postgres also narrows with `text ILIKE ANY($patterns)`
   (with `%`, `_` and `\` escaped). This only narrows; the exact match runs in JS.
3. Rows are read ordered by `line` in batches of 500. Each batch is matched in-process
   with the `iu` regexes; the first `maxResults` matching rows are kept, and the rest
   are counted for `totalMatches`. At most one batch plus the kept matches is in
   memory at a time.
4. Context rows are fetched afterwards, because the pre-filter in step 2 has removed
   non-matching neighbours: when `contextLines > 0`, one more query reads
   `line BETWEEN m - contextLines AND m + contextLines` for each kept match `m`, with
   the same search and scope filter but without the date or pattern filters. The
   pure `grepRows` takes those context rows as a separate input, so the in-memory and
   SQL paths give the same output.

### `mail_get`

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string" },
    "account": { "type": "string", "description": "Address from the row's acct: field. Required with more than one account." },
    "maxChars": { "type": "number", "description": "Body characters. Default 12000, max 40000." }
  },
  "required": ["id"]
}
```

Returns the text block from the reference, as a string field:
`{ text: "Message ID: …\nThread ID: …\nFrom: …\nTo: …\nSubject: …\nDate: …\nBody:\n…" }`.
Quoted replies are stripped first, using the reference's four markers ("On … wrote:",
"Forwarded message", "From:/Sent:", "From:/Date:"). If stripping leaves nothing, the
original body is kept. Trailing whitespace is trimmed, then the body is cut to
`maxChars`. Attachments are out of scope for this item.

## Row format

Each saved row's `text` is the reference's row line. The `|` characters inside
fields are not escaped; the date is also stored in its own column, so the date filter
never parses the text. Each field has its whitespace collapsed (which also removes
newlines) and is capped at 500 characters, so mail content cannot fake another row.

```
0001 | 2019-03-02T08:00:00.000Z | acct:me@example.com | id:18c… | thread:18c… | from:Jana <jana@example.com> | to:Me <me@example.com> | subject:First hello | snip:…
```

The row index is padded to 4 digits; the 5,000-row cap fits. The reference's `#`
header lines (createdAt, coverage, records, accounts, queries, coveredBackTo) are the
stored `summary` instead.

## Saved results (Postgres)

Results are not stored in `AgentHomeStore` or on local disk:

- Local disk is per process. The API and worker processes behind the load balancer do
  not share it, so a grep could land on a process that never saw the search.
- The home store is keyed by the computer's `homeKey`, so bots without a computer have
  no home. It is copied into the sandbox, listed in the Files UI
  (`apps/api/src/router.ts:2942`), included in the bot export (`:5967`), visible to
  other users' bots on a Team Computer (`executor.ts` near `:3898`), and has no TTL.

Two tables, one row per search and one row per result record. One row per record
keeps paging (`afterLine`), the date filter and the oldest-first read as indexed SQL,
and lets grep stream in batches instead of loading a 5,000-row blob.

```prisma
model MailSearch {
  id        String          @id @default(cuid())
  spaceId   String
  space     Space           @relation(fields: [spaceId], references: [id], onDelete: Cascade)
  userId    String
  user      User            @relation(fields: [userId], references: [id], onDelete: Cascade)
  botId     String
  bot       Bot             @relation(fields: [botId], references: [id], onDelete: Cascade)
  summary   Json            // the object mail_search returned, minus searchId
  resume    Json?           // [{ accountId, query, unhydratedIds, pageToken? }] for queries that stopped early; null when complete
  createdAt DateTime        @default(now())
  expiresAt DateTime
  rows      MailSearchRow[]

  @@index([spaceId, userId, botId])
  @@index([expiresAt])
  @@map("mail_searches")
}

model MailSearchRow {
  searchId String
  search   MailSearch @relation(fields: [searchId], references: [id], onDelete: Cascade)
  line     Int        // 1-based, oldest first
  date     String     // ISO 8601, so the ISO-prefix filter is a string comparison
  text     String     // the row line, at most about 4,500 characters

  @@id([searchId, line])
  @@map("mail_search_rows")
}
```

- **Scope.** `spaceId`, `userId` and `botId` come from the run (`run.spaceId`,
  `bot.userId`, `bot.id`), never from model input. Every read filters on all three
  plus the id. Another bot of the same user, another user in the same space, or the
  same user in another space gets "No such search results".
- **Write.** One transaction inserts the `MailSearch` row and `createMany` of its rows
  (at most 5,000). Then `deps.jobs.enqueue` schedules `mail.search.expire` at
  `expiresAt`.
- **Expiry: 24 hours.** `expiresAt = createdAt + 24h`. Reads refuse expired rows
  (step 1 of grep). The delayed `mail.search.expire` job deletes that search (rows
  cascade), using the existing graphile-worker publisher the same way as
  `skill.teaching-expire`, so deletion runs on whichever worker picks it up. As a
  backstop for a lost job, each `mail_search` also runs `DELETE FROM mail_searches
  WHERE expiresAt < now() - interval '1 hour'` (indexed, a no-op when the jobs are
  keeping up).
- **Disconnect.** `deleteMailSearches(prisma, { spaceId, userId })` deletes all of
  that user's searches in the space. The `connections.revoke` handler
  (`router.ts:5163`) calls it for any mail connection, whatever the connector, next to
  item 4's `deleteMailConnectionData`. Revoke only sets `status = "revoked"` and keeps
  the `Connection` row, so this explicit call is the only cleanup. A search can span
  several accounts, so it deletes them all rather than guessing which rows came from
  the revoked account. A resumed search (`continueFrom`) re-resolves accounts with
  `listAccounts`, which returns connected accounts only, so a revoked account is never
  queried again. Deleting the bot, user or space cascades.
- **Size.** 5,000 rows of at most about 4,500 characters is a worst case of about
  22 MB per search, typically far less, and it lives for 24 hours.

## Executor wiring

| Step | Anchor | Change |
| --- | --- | --- |
| Dependency | `ExecutorDeps` `executor.ts:2637`, next to `web?` (`:2664`) and `cloudAgent?` (`:2671`) | `mail?: MailProvider \| null;` If it is absent, the tools are never offered. |
| Composition | `apps/worker/src/index.ts:187` (`createRunExecutor`) and `apps/api/src/app.ts:455` | Worker: `mail: createMailProvider(...)`. API: pass the instance item 4 PR 1 already created for `RouterDeps.mail`. |
| Offering | `selectBuiltinToolsForRun` `executor.ts:7457`; call site `:3820` | Add an option `mailEnabled: boolean` and wrap with `selectMailTools(tools, mailEnabled)`, matching `selectCloudAgentTools`. At the call site, `mailEnabled = Boolean(deps.mail) && !thread.groupId && run.userId === bot.userId && !messagingChannelRun && (await mailAccounts()).length > 0`. `mailAccounts` is a memo of `listAccounts` that lives only for this run (request-scoped, never shared across runs or users), and the handlers reuse it. The disabled list is already applied by the trailing `.filter` at `:7489`. |
| Disabled guard | `executor.ts:4061` | No change; it already rejects disabled names. |
| Read-only | `READ_ONLY_AGENT_TOOLS` `executor.ts:388` | Add the three names, so they skip `recordEffect` (`:4330`) and no approval card is created. Saving search rows is Rakazo's own state, not an external effect. |
| Dispatch | next to `web_search` `executor.ts:5187` | `if (name.startsWith("mail_")) return finish(await mailToolFromTool(name, { mail: deps.mail!, prisma: deps.prisma, jobs: deps.jobs, accounts: mailAccounts, scope: { spaceId: run.spaceId, userId: bot.userId, botId: bot.id } }, context, args));` |
| Prompt | — | None in this item. The search recipe is item 3's `inbox-search` skill, which the executor loads whenever `mail_search` is offered. Keeping one copy avoids two prompts drifting apart. Item 3 PR 1 merges before this item's PR 2. |

## UI

- **Disable list:** the bot panel already accepts any name in `BUILTIN_TOOL_NAMES`
  (`apps/web/src/pages/shell/bot-panel.tsx:430-443`). Adding the names to the contract
  is the whole change.
- **Tool activity:** steps show only the humanized tool name (`packages/core/src/events.ts:348`),
  so they read "Mail search", "Mail grep", and "Mail get". No queries or mail content
  reach the card, and no rendering change is needed (see `docs/tool-activity.md`).
- **Mobile:** nothing changes. The tools run on the server, and mobile already hides
  tool activity.

## Limits

| Limit | Value |
| --- | --- |
| Queries per search | 20 (extra queries are dropped; duplicates removed) |
| Messages per search | default 1000, hard cap 5000, split evenly across accounts |
| Provider page size | 500 (item 1's maximum) |
| Search deadline | 60 s (the run's abort signal still applies) |
| Field length in a row | 500 characters |
| Grep patterns | 20, each 200 characters or fewer |
| Grep results | default 50, max 200; `contextLines` 0-5 |
| Tool output budget | 16,000 characters (grep) |
| Body | default 12,000, max 40,000 characters |
| Saved-results lifetime | 24 h |
| Grep read batch | 500 rows |

## Security

- **Owner only.** The tools are offered only when the run's requester owns the bot
  (`run.userId === bot.userId`), in a direct thread (not a group), and not on a
  messaging-channel run. Accounts always resolve from the bot owner's
  `(spaceId, userId)`. The model can narrow to one of those accounts but cannot name
  someone else's.
- **Saved-results isolation.** Results live in `mail_searches`, outside every synced,
  exported, or shared store. Every read filters on `spaceId`, `userId` and `botId`
  from the run plus the `searchId`; the model supplies only the id. An id that exists
  for another scope returns the same error as one that does not exist, so ids reveal
  nothing.
- **ReDoS.** A pattern containing `* + ? { }` outside a character class, or a
  backreference, is matched as a literal substring. Invalid regex also falls back to a
  literal match. Patterns compile with the `iu` flags.
- **Prompt injection.** Results and bodies are untrusted data; the existing system
  sentence already names emails (`executor.ts`, in the `userTurnInstructions` list).
  Collapsing whitespace stops mail text from faking extra rows.
- **Transcript.** Tool results (summaries, grep rows, bodies) are stored in the run
  transcript like any connector result. The 24-hour TTL covers only the saved
  results, not the conversation. This is the same exposure as the Gmail connector tools today.
- **Logging.** Never log queries, rows, bodies, addresses or search ids together with
  content; log only counts, durations, the connector id, and sanitized error messages.

## Tests

All tests are offline and use item 1's `createMailEmulator()`. Tests that touch
Postgres are `*.postgres.test.ts` files gated by `VERIFY_DATABASE`, following
`board-app.postgres.test.ts`.

`packages/core/src/mail-results.test.ts` (pure)
- A row is pipe-delimited, 1-based, 4-digit padded; newlines in subject or snippet are
  collapsed; fields are capped at 500 characters.
- The summary lists queries and accounts; `capped` coverage adds `coveredBackTo`; an empty result has `dateRange` values of null; `byYear`, first/last
  3 rows, and `failedAccounts` only when nonzero.
- Grep over an in-memory row array: ORs patterns; the date prefix filter
  (`dateFrom: "2018"` includes `2018-06-01…`); `(a+)+$`, `\1`, and `a{1,99}` match
  literally; invalid `[` falls back to literal; a 201-character pattern is cut and a
  21st is ignored; no patterns returns every row; `afterLine` pages; output fits 16,000
  characters with `note` while `totalMatches` stays exact; batches of 500 give the same
  answer as one pass; `contextLines` returns the neighbouring rows even when they do not
  match.
- `isLiteralOnly(patterns)` is true exactly when the ILIKE pre-filter may be used.
- `stripQuotedReply` handles each of the four markers, and a body that is entirely
  quoted is kept.

`packages/adapters/src/mail-tools.postgres.test.ts`
- `mail_search` over two emulator accounts saves rows sorted oldest-first across
  accounts, deduplicated, and the summary matches the rows.
- `maxMessages` splits across accounts; the emulator's extra pages produce `capped`
  and a stored `resume`. `continueFrom` returns exactly the remaining older rows: the
  union of both searches equals one uncapped search, including messages that share a
  date with the cut-off point.
- A deadline abort in the middle of hydrating a page keeps the hydrated rows and puts
  the rest in `resume.unhydratedIds`; `continueFrom` fetches them.
- An emulator error on one account gives partial rows, `failedAccounts`, and `capped`
  coverage, not a thrown error.
- `continueFrom` with another scope's searchId returns "No such search results".
- An unknown `account` returns an error and saves nothing.
- Scoping: a search saved for (space S, user A, bot 1) is not readable as (S, user B,
  bot 1), (S, A, bot 2) or (other space, A, bot 1); each returns "No such search
  results".
- An expired search is refused by grep; the `mail.search.expire` handler deletes it
  and its rows; `deleteMailSearches` deletes only that user's searches in that space.
- The ILIKE pre-filter and the batched scan return the same matches and the same
  context rows as the pure grep.
- `mail_get` strips quoted text, applies `maxChars` clamps (120 and 40,000), and
  requires `account` when two accounts exist.

`packages/adapters/src/executor.test.ts` (next to the disabled-builtin test at `:379`)
- `selectBuiltinToolsForRun` offers the `mail_*` tools only with `mailEnabled`, and a
  disabled `mail_grep` is omitted.
- `READ_ONLY_AGENT_TOOLS` contains the three names.

`packages/adapters/src/index.test.ts:176` already checks that the contract names match
the definitions, so it covers the new entries without changes.

`packages/adapters/src/skill-tools.test.ts` (moved here from item 3 PR 1): every
`mail_*` tool name in the `inbox-search` skill body is in `BUILTIN_TOOL_NAMES`. It
lives in this PR because the names do not exist before it.

One scripted-runtime executor test (Postgres-gated, using the emulator) runs a turn
with `mail_search` and then `mail_grep` and asserts that the grep result contains the
seeded row. This checks the dispatch wiring and the scope that comes from the run.

## Dependencies

- **Item 1** PR 1 (`MailProvider`, `createMailEmulator`, `createMailProvider`). The
  core module in PR 1 does not depend on it.
- **Item 3** PR 1 (the `inbox-search` skill), which carries the model guidance.
- There are no new npm dependencies.

## Risks

- **Query syntax is Gmail's.** Every adapter is Gmail today, so queries pass through
  unchanged. A non-Gmail provider would need its own syntax note in the prompt; that
  is item 1's decision, and nothing here changes.
- **Search speed is unmeasured in Rakazo.** Google's published quota implies about 300
  metadata `get`s per minute per account; the reference implementation's identical
  approach is fast in practice. Measure in item 1's manual smoke tests. Composio and
  Pipedream add a proxy hop per call. The 60-second deadline turns a slow pull into
  `capped` coverage with a continuation instead of a hung run.
- **Per-process concurrency cap.** Item 1's 4-per-account limit is per process, so
  several processes searching the same account at once can draw more 429s. The retry
  backoff absorbs that; acceptable for v1.
- **Saved-results volume.** A busy deployment holds up to a day of searches in
  Postgres. Expiry jobs keep it bounded; watch table size after launch.
- **Transcript retention** of mail content is governed by thread retention, not by this
  TTL (see Security).
- **Fixed output budget.** It can be tight for small-context models; see the `ponytail:`
  note in the port table.

## PR breakdown

1. **`feat(core): mail results format and grep`** adds `packages/core/src/mail-results.ts`
   and its test. It is pure, can land before item 1, and lets the item 1 and item 2
   work proceed in parallel.
2. **`feat(adapters): mail_search, mail_grep, mail_get built-in tools`** (needs item 1
   PR 1 and item 3 PR 1) adds the `MailSearch`/`MailSearchRow` migration,
   `mail-tools.ts` and its tests, the `mail.search.expire` job, `deleteMailSearches`
   and its call in `connections.revoke`; the contract names; the three definitions; the
   executor changes (deps, offering, read-only set, dispatch); the composition roots;
   the skill-to-contract tool-name test; and the executor tests. It merges after item 4
   PR 1 (both edit `schema.prisma`, `router.ts` and `apps/api/src/app.ts`) and rebases
   onto it, regenerating its migration so the folder timestamp sorts after item 4's. It adds no user-facing copy apart from the model
   guidance and the tool descriptions.
