# Devin page

Status: plan, round 2 after review; no code yet. Line numbers refer to branch `docs/devin-handoff` at 6c8755539 when written (read with `git show`). Slices start from `origin/main` once this branch merges; each child names its base. Approved design: `docs/devin/mockup.html` v4 (b4bcdf4f3), amended by the "Target" column of "Mockup reconciliation" below; the mockup is updated to match. Built on the Legal page pattern, the integration-agent gate, `createNotification`, the remote MCP client and graphile-worker that already exist; the plan adds two small tables, one RPC namespace, one recurring job and one dialog. No new dependency, no new provider interface, no new shared-secret model.

## Summary

Devin is a sidebar page at `/app/devin`, like Legal, with the Devin agent docked beside it for the person who connected Devin. The page is read-only: the connected Devin organization's sessions in three sections, "Needs you", "Working" and "Earlier", with two tiles above, "Needs you" and "Working". A row is one link to its session in Devin; a row that waits on a person shows Devin's question in full. Rakazo never launches, replies to or stops a session; Devin's write tools and the "Allow changes in Devin" switch go away for Devin. One connection serves the space: a space owner pastes the organization service-user key once, every member sees the page, the member who connected it (the connector) gets the docked agent and the alerts, and any space owner can replace the key or disconnect.

Detection is one server-side refresh operation shared by a two-minute worker job and page reads, with a fenced lease so several processes never write over each other. It keeps the last-seen state of each session in Postgres; when a session newly waits on a person, the connector gets one normal Rakazo notification ("Devin needs input") whose link opens that session in Devin on web, desktop and phone. The sidebar shows the live count of sessions that need someone, read from that stored state. The page re-reads the shared state every minute while visible and on focus; there is no refresh button; the header shows "Updated 4m ago" only when the data is stale. A refused key pauses alerts and shows one notice with Reconnect for owners; a rate limit backs the refresh off and the page keeps the last good rows.

Not built: launching, replying or stopping sessions; a native mobile screen (a push opens the session in the phone's browser); repo-docs tools on the page; ACU or cost views; a second Devin organization per space; a shared agent chat for members other than the connector; a general read-only policy for other integrations. Reasons under "Not in this epic".

## User story

From the framing (2026-10-20, after the scope change):

- **Simpler.** No switching to Devin to check whether Devin is done or stuck; the page says it in one glance, and the sidebar count says it from anywhere in Rakazo.
- **Faster.** When Devin is blocked on a question, the connector is told within a few minutes, with a link that lands on the session where the answer goes.
- **Trustworthy.** Rakazo only reads. There is no control in Rakazo that spends Devin credits or changes a session, so nothing on this page can be done by accident, and other agents cannot be talked into it.

Shipped experience: a space owner opens Integrations or the Devin page, pastes the organization service-user key, and lands on `/app/devin`; the page shows every session with its status, PR and source; a teammate opens the same page and sees the same list; when Devin asks a question, the connector gets a toast, an OS banner or a phone push whose click opens that session in Devin; after they answer there, the row leaves "Needs you" on the next refresh; the connector asks the docked Devin agent "Anything merged today?"; a refused key shows "Devin rejected the key. Alerts are paused." with Reconnect for owners and "Needs reconnect" on the Integrations card.

Each slice below names the story point it serves.

## Evidence and which mockup each report describes

| Document | Mockup revision it describes |
|---|---|
| `docs/devin/ux-paths/discovery.md`; `docs/devin/ux-paths/catalog.md` sections 1 to 7 and the stories | v2 (f42428aea) |
| `docs/devin/ux-paths/catalog.md` section 8 "Round 2" and "Round 3" columns, GAP-48 to GAP-54 | v3 (6db06cc11) and v4 (b4bcdf4f3) |
| `docs/devin/ux-flow/report.md`, `docs/devin/ux-flow/redundancy.md` | v2 |
| `docs/devin/ux-walker/docs/devin/ux-walker/latest-report.md` | v2; `docs/devin/ux-walker/round-2/report.md` describes v3 |
| `docs/devin/ux-visual/` (problems and the round 2 brief) | v3, producing v4 |

Where a report and v4 disagree, v4 and the "Target" column below win.

## Current state (verified)

Every claim here was checked by opening the file at 6c8755539.

| Area | Fact |
|---|---|
| Devin contract | `packages/contracts/src/devin.ts`: `DEVIN_MCP_ENDPOINT`, `isDevinEndpoint` (`:5-13`), `DEVIN_READ_TOOLS` (`:16-26`), `DEVIN_WRITE_TOOLS` (`:31-38`: `devin_session_create`, `devin_session_interact`, three `*_manage` tools). `INTEGRATION_PRESETS.devin` (`packages/contracts/src/integration-agent.ts:241-250`): `reads`, `forcedWrites`, `allowedTools` = reads plus writes, `requiresAgent: true`; its instructions tell the model to start and message sessions. `integrationPresetForEndpoint` (`:285-294`). |
| MCP gate | `integrationAgentDenial` (`packages/adapters/src/mcp-connector.ts:129-149`); `assignmentAllowsTool` (`:163-176`) applies the preset's closed `allowedTools` at discovery (`:289`) and immediately before the call (`:494`). `callServerTool` (`:564-598`) returns the `CallToolResult` as is, including `isError: true` results; the Finance wrapper `unwrapToolResult` throws on `isError` (`packages/adapters/src/finance-call-tool.ts:8-20`). The session loads the `Secret` with `where: { id, spaceId: context.spaceId, userId: context.userId }` (`:763-769`), so a stored server can be called only in its owner's scope; `createFinanceCallToolFor` (`finance-call-tool.ts:27-47`) builds that context from the row and refuses tools outside a fixed list. Errors are rethrown as `new Error(sanitizeConnectorError(error))` (`:589-597`); no status code field. |
| Connection rows | `McpServer` (`packages/db/prisma/schema.prisma:1447-1488`): `spaceId`, `userId`, `endpoint`, `secretId`, `enabled`, `writesEnabled`, `agentBotId`, `agentExclusive`, `revision`; unique `(spaceId, userId, slug)`. No health column. `mcpServerDto` (`apps/api/src/router.ts:652-676`) returns the typed `McpServer` DTO; `mcpStatus` (`apps/web/src/lib/integrations.ts:54-58`) says "connected" for an API-key server whatever the key does. `mcp.servers.list` (`router.ts:4779`), `update` (`:4932`; a full config or `{ id, secret }`, bumps `revision`, clears the agent link when the endpoint changes, `:5059-5064`) and `remove` (`:5121`) all filter by the actor's `userId`. `mcp.servers.create` (`:4814-4930`) runs the connect-time `listServerTools` check for a `requiresAgent` preset (`:4863-4883`), then `ensureIntegrationAgent` and marks the server exclusive (`:4888-4916`). `setIntegrationAgentWrites` (`apps/api/src/integration-agent.ts:440`). |
| Integration agent | `ensureIntegrationAgent` (`apps/api/src/integration-agent.ts:306-420`), spawn key `integration-agent:<serverId>`, idempotent through the unique `(spaceId, spawnKey)` index; `isIntegrationAgentForServer` requires the bot's `spaceId` and `userId` to equal the server's (`packages/contracts/src/integration-agent.ts:70-79`). Bots are listed per space and user (`packages/db/src/repos.ts:291-297`); a `Thread` has one `botId` (`schema.prisma:582`). The agent's colour is `APP_COLOR.devin` (`packages/contracts/src/agent-colors.ts:17`). |
| Space roles | `SpaceMember.role` (`schema.prisma:302`). `requireSpaceOwner`, `isSpaceOwnerRole` (`apps/api/src/space-owner.ts:5-16`). `Actor` has `spaceId`, `userId`, `email`, `isDeploymentOwner` (`packages/contracts/src/ids.ts:12`). |
| Notifications | `createNotification` (`packages/db/src/notifications.ts:91-161`): 24 h dedupe per `(space, user, bot, dedupeKey)` under an advisory lock; agent rate limits (`:19`) skipped with `skipRateLimits`; `attention` queues external deliveries; `info` never leaves the app and never toasts (`:85-88`; `apps/web/src/lib/notification-delivery.ts:29`). **`validate` rejects any `link` that is not an in-app path** (`isInAppPath`, `:53-55`, `:79-81`). Platform events use `notifyThreadEvent` (`packages/adapters/src/run-notification.ts:30-67`): checks `NotificationPreference` (`finish`, `help`, `takeover`; `schema.prisma:1318-1331`), `importance: "attention"`, `kind` from the event, `skipRateLimits: true`, a hashed `dedupeKey`, then `events.notify`. The realtime topic is per user and space (`packages/db/src/notification-live.ts:8-10`). `notifications.glance` (`router.ts:7822-7836`, `rpc.ts:1289-1297`); the web `EMPTY` literal mirrors it (`apps/web/src/lib/use-sidebar-glance.ts:34-39`) and refreshes on mount, page change and `rakazo:notifications-changed` (`:63-67`). `surfaceOfPath` is a closed list (`:8-13`). Expo push data carries `surface`, `link`, `botId` (`packages/adapters/src/expo-push.ts:75-77`). |
| Notification clicks | Web OS banner: `shown.onclick = () => window.focus()` (`notification-delivery.ts:62-65`). Toast: `onOpen={navigate}` (`apps/web/src/components/AppToaster.tsx:110`; the toaster marks the notification seen itself, `packages/ui-web/src/components/ui/notification-toaster.tsx:104-106`). Electron sends any foreign `window.open` or navigation to `shell.openExternal` (`apps/desktop/src/main.ts:268-285`). Mobile: `notificationOpenTarget` (`apps/mobile/lib/notification-open.ts:37-64`) treats `link: "/app/<x>"` as a bot id (so `/app/devin` would open a bot named "devin"); `openNotificationResponse` (`apps/mobile/lib/open-notification.ts:36-79`) only `router.push`es; tests exist for both (`notification-open.test.ts`, `open-notification.test.ts:43`). `Linking.openURL` is used elsewhere (`apps/mobile/app/thread.tsx:3587`). |
| Jobs | Job names and payload types live in `packages/adapter-kit/src/types.ts` (`BackgroundJobPayloads` `:679`; `BackgroundJobHandlers` makes every name's handler mandatory `:820`); payload schemas in `packages/adapter-kit/src/background-jobs.ts:25-60`; handlers in `createBackgroundJobHandlers` (`packages/adapters/src/background-job-handlers.ts:57-330`); cron in `RECURRING_JOBS` (`packages/adapters/src/wakeup.ts:94-102`). The worker has an `McpConnector` (`apps/worker/src/index.ts:126`) and `notificationEvents` (`:105`). Fenced lease precedent: `pollCloudAgent` claims with a random token and `version` (`packages/adapters/src/cloud-agent-poll.ts:28-37`) and releases only its own lease (`:185-190`). |
| Page pattern (web) | Route `apps/web/src/App.tsx:216`; `legalMode` (`apps/web/src/pages/Shell.tsx:914`), `findLegalAgent` (`:955-956`), `createLegalAgent`/`askLegalAgent` (`:2945-2961`), `agentPanel` Legal entry (`:3066-3077`), `pageAgentNeedsModel` (`:3099`), `appPages` (`:1945-1962`), `hiddenPages` (`:1906`), `SidebarPageLink` Legal (`:4004-4021`; `glanceBadge`, `apps/web/src/components/sidebar-glance.tsx:10-45`: `unseen > 0` draws the dot, else `value` draws a number), page render (`:5123-5133`). The docked panel renders `threadView` (`:5245`), which wraps the thread in `data-bot-accent` (`:3511-3512`); `[data-bot-accent]` maps `--chat-user` to the bot accent (`packages/ui-web/src/styles.css:53-56`), so the user's bubbles take the agent's colour in the panel, as the mockup draws. `LegalPage` (`apps/web/src/pages/Legal.tsx:36-60`): `FinanceChromeProvider`, `@container`, refetch on focus and visibility (`:109-121`), `ErrorNotice` with rows kept (`:155-158`, `:244-246`), `Kpi` tiles (`:264-272`), `LegalSkeleton` (`:428-440`). `LegalContracts` (`apps/web/src/pages/legal/LegalContracts.tsx:86-130`): stacked `<ul>` below `@4xl`, `<Table>` with fixed `colgroup` from `@4xl`. `ErrorNotice({ message, onRetry })` hardcodes "Try again" (`apps/web/src/components/finance/ui.tsx:403-412`; stories in `ui.stories.tsx`). Lucide 1.44 ships `code-xml` (the `</>` glyph the mockup draws) and `code`. |
| Integrations (web) | Devin tile `apps/web/src/lib/integrations.ts:143-150`; hint "An org-scoped Devin service-user key (starts with cog_)." (`IntegrationsHome.tsx:443`); `?connect=<id>` opens the first-party dialog (`:436-462`), `returnTo` is followed on close (`:838-843`); Carta card "Open Cap table" (`:124-125`); Reconnect runs OAuth (`useMcpReconnect.ts:17-22`), wrong for an API-key server. `CustomConnectionDialog.createServer` returns the existing server when the endpoint matches (`CustomConnectionDialog.tsx:255-258`), so a new key is silently ignored today. The generic `ConnectionDialog` has a per-field `help: { href, label }` link ("Where to find your key" in its story; `ConnectionDialog.tsx:21`, `:83-90`). `McpDetail` shows `IntegrationAgentSection` with the writes switch for every server with an agent (`McpDetail.tsx:246-256`). |
| Skill | `devin-sessions` (`packages/adapters/src/builtin-skills.ts:177-211`) tells the agent to start sessions, set ACU limits, send follow-ups and to suggest "Allow changes in Devin". `apps/web/src/demo/fixture.json:95` embeds skill descriptions. |
| Devin MCP (research, field check 2026-10-20; no tool called) | Every tool returns one text string; fields omitted when empty. `devin_session_search`: `id`, `title`, `status` (`status_detail`), `created_at`/`updated_at` (unix s), `tags`, opaque `user_id`, `origin`, PRs as `url[state]`, `acus_consumed`, `playbook_id`; no status filter; paging `first` ≤ 100 with `after`. `devin_session_interact` `get` adds `url`, `summary`; `get_messages` returns `source`, `created_at`, `event_id`, `body`. Devin's documentation (cited by the review, not fetched here) says a personal token and an enterprise service-user key also start with `cog_` and need an organization header, so only an **organization** service-user key works through the bearer token alone, and a 403 means insufficient permission, distinct from a 401. Exact line format, ordering, cursor behaviour, `status`/`status_detail` values and the session URL are unverified. |

## Design

### 1. One Devin connection per space, managed by owners

The active connection of a space is its one `DevinConnectionState` row (`spaceId @unique`); it points at an `McpServer` row (the connection) whose `userId` is the connector. The connection keeps its per-user storage: space-wide reads run in the connector's scope, as Finance sync runs in the row owner's scope (`finance-call-tool.ts:35-45`). No new sharing or secret model.

**A narrow management path, not broader MCP APIs.** The generic `mcp.servers.*` handlers keep filtering by the actor's `userId`; a second owner cannot see or edit the connector's row through them, and must not. The Devin page uses its own RPCs in `apps/api/src/devin.ts`; every write starts with `requireSpaceOwner` (`space-owner.ts:10`):

- `devin.sessions` (any member): the page read, Design 2.
- `devin.agent` (any member): `{ bot }` for the connector (`ensureIntegrationAgent`, idempotent), `null` for anyone else.
- `devin.connect({ secret })` (owner): under `pg_advisory_xact_lock('devin-connect:<spaceId>')`, refuses when a state row exists (`CONFLICT`, "Devin is already connected in this space"); creates an `McpServer` row **in the acting owner's scope** with the Devin endpoint and the key (the create path of `mcp.servers.create` extracted into a function and reused); runs the connect-time check (`listServerTools` fresh plus one `devin_session_search`, so a key without session access is refused now, GAP-22); on failure deletes row and secret and returns `BAD_REQUEST` "The key was refused."; on success provisions the agent as today, creates the state row and enqueues one immediate `devin.refresh` job. The acting owner becomes the connector.
- `devin.replaceKey({ secret })` (owner): verifies the candidate key on a **new** row in the acting owner's scope exactly as `connect` does; on failure deletes the candidate and leaves the active connection, its state and its rejected flag untouched ("The key was refused."); on success, in one transaction, points the state row at the new server, clears `rejectedAt`, `backoffUntil` and `lastError`, deletes every `DevinSession` row of the old server and bumps `version`, then removes the old `McpServer` row (archiving its agent, as `mcp.servers.remove` does) and enqueues a refresh. Deleting the cached sessions on every replacement is deliberate: Rakazo cannot read the organization's identity, so a key for another organization must never mix with the old rows or alert state; the cost is one silent re-baseline. The acting owner becomes the connector and the alert recipient (GAP-53).
- `devin.adopt({ serverId })` (owner): the actor's own enabled private Devin row becomes the space's connection (state row created, refresh enqueued); another user's row is `FORBIDDEN`.
- `devin.disconnect()` (owner): deletes the active connection's `McpServer` row (the cascade removes both Devin tables; the agent is archived as today). Every member's page returns to Not connected.
- `connection.manage: boolean` in `devin.sessions` is `isSpaceOwnerRole(membership.role)`; `canConnect` is `manage && status === "none"`. The UI shows Connect, "Use it", Reconnect and Disconnect only with `manage`.

**Existing and duplicate connections.** Today's storage allows several private Devin servers per space. None becomes space-wide by itself: a space with Devin servers but no state row is Not connected on the page. An owner who is the connector of such a private row and presses Connect Devin gets the dialog with the line "Use the Devin connection you already added." and the button "Use it" (`devin.adopt`); pasting a key instead creates a new connection. Another user's private row is never adopted or read. Private rows that are not adopted keep working for their own agent as before.

**Uniqueness on every route.** `mcp.servers.create`, `mcp.servers.update` (a full config can turn a server into a Devin endpoint, `router.ts:4982-5000`) and an enable transition: when the resulting row is an enabled Devin endpoint and the space has a state row pointing at another server, the handler returns `CONFLICT` "Devin is already connected in this space". A private Devin row without a state row is still allowed (it is not the space's connection).

**Connector leaves or loses access (GAP-53).** The refresh operation checks that the connector still has a `SpaceMember` row before every run; when not, it sets `lastError: "connector_gone"`, stops refreshing and alerting, and the page shows "The member who connected Devin left this space. Alerts are paused." with Reconnect for owners (`replaceKey` re-homes the connection to the acting owner). Nothing is sent to an ineligible recipient.

**One agent, the connector's.** Bots and secrets are per user (`repos.ts:291-297`, `mcp-connector.ts:763-769`), so only the connector's runs can use the connection. The docked panel and Ask appear for the connector; other members get the page without Ask. A shared chat for every member is under "Not in this epic".

### 2. One refresh operation, one durable cache

`refreshDevinConnection(deps, serverId, { reason })` in `packages/adapters/src/devin-refresh.ts` is the only code that reads Devin for the page; the worker job and page reads both call it.

1. **Lease.** `updateMany` on `DevinConnectionState where { serverId, version, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] } set { leaseToken: randomUUID(), leaseUntil: now + 90 s, version: { increment: 1 } }`; zero rows means another process holds it and the caller reads the cache instead. Every later write is fenced on `leaseToken` and `version`, and the lease is released only by its own token (the `cloud-agent-poll.ts:28-37`, `:185-190` pattern). No transaction is open across HTTP.
2. **Revision check.** The `McpServer.revision` read before the calls is compared before committing; a mismatch (a key replaced or the row edited meanwhile) discards the results without writing, so an old request can never mark a fresh key rejected or overwrite rows of a replaced connection.
3. **Listing.** `devin_session_search` through `createDevinCallTool` (Design 3) with a 15 s `AbortSignal`, following `after` for up to `DEVIN_MAX_PAGES` (10; Open questions); an `isError` result throws before parsing (the `unwrapToolResult` rule). `complete` is true only when the last page had no cursor and no page failed. Rows are upserted on `(serverId, sessionId)` with `lastSeenAt = now`; rows are **never deleted because a listing omitted them**: a row is deleted only when it has not been seen for 7 days (Open questions: Devin's archive semantics). The parser's `skipped` count is stored; `partial = !complete || skipped > 0`.
4. **Per-row baseline and change detection.** For each row that is `needs_you`: a row seen for the first time is recorded silently with its question and real message identity (`get_messages`, Design 3) and `notifiedMessageId = lastMessageId`; no alert. A row that **changed** (kind became `needs_you`, or `devinUpdatedAt` advanced while `needs_you`, or `question` is null from an earlier failed read) is re-read with `get_messages`; messages are fetched only on such a change, never for every waiting row on every run. Alerting is Design 4 and lands in S5; until then the operation records state only.
5. **Commit.** Fenced writes of rows and state (`lastSucceededAt`, `lastError: null`, `skipped`, `complete`), release the lease.
6. **Failure.** `devinFailureOf(error)` (Design 7) sets `lastError` and `backoffUntil` under the fence; a 401, or a 403 from the listing, sets `rejectedAt` so the connection stops refreshing until a key replacement clears it.

Because the baseline is per row, a listing capped at `DEVIN_MAX_PAGES` never suppresses alerts: a session that changes appears in the first pages (Devin lists newest first; Open questions), and rows beyond the cap stay cached from earlier runs.

`devin.sessions` reads the cache and decides whether to refresh:

```ts
DevinSessionsOutput = {
  connection: {
    status: "none" | "ok" | "rejected" | "connector_gone" | "unreachable" | "rate_limited",
    manage: boolean, canConnect: boolean, isConnector: boolean,
    agentBotId: string | null,
    adoptable: { serverId: string } | null,   // the actor's own private Devin row; owners only
  },
  fetchedAt: string | null, stale: boolean, partial: boolean,
  sessions: DevinSession[],   // needs_you, error, working, then the rest; newest first inside a group
}
DevinSession = {
  id, title, kind: "needs_you" | "working" | "finished" | "error" | "suspended" | "unknown",
  status, statusDetail: string | null, question: string | null,
  prs: { url: string; state: string }[], origin: string, updatedAt: string,
}
```

When `lastSucceededAt` is older than `DEVIN_CACHE_TTL_MS` (60 s) and no backoff or rejection applies, the handler calls the refresh operation itself and returns its result; if the lease is held, it returns the cache with `stale: false`. On a rejected or backed-off connection it returns the cache with `stale: true` and the status. Session URLs are not stored or returned: the client builds them with `devinSessionUrl(id)` (Design 5). Tiles and the sidebar count come from the same rows: "Needs you" = `needs_you` plus `error` rows (a failed session also needs a person), "Working" = `working` rows.

**Parser.** `packages/adapters/src/devin-sessions.ts`, pure: `parseDevinSessionSearch(text)` → `{ sessions, skipped, nextCursor }`, `parseDevinMessages(text)` → `{ messages }`, `devinKindOf(status, statusDetail)`. Written in S1 against **redacted real responses** captured with an organization key; invented fixtures are not accepted for this parser.

**Tables.** Two additive models, one migration, no change to `McpServer`:

```prisma
model DevinConnectionState {
  serverId        String    @id
  server          McpServer @relation(fields: [serverId], references: [id], onDelete: Cascade)
  spaceId         String    @unique      // one active connection per space
  version         Int       @default(0)  // fence; bumped on every claim and every management write
  leaseToken      String?
  leaseUntil      DateTime?
  lastRefreshAt   DateTime?
  lastSucceededAt DateTime?
  complete        Boolean   @default(false)
  skipped         Int       @default(0)
  backoffUntil    DateTime?
  backoffStep     Int       @default(0)
  rejectedAt      DateTime?               // 401, or 403 on the listing
  lastError       String?                 // rejected | connector_gone | unreachable | rate_limited
}

model DevinSession {
  id                String    @id @default(cuid())
  serverId          String
  server            McpServer @relation(fields: [serverId], references: [id], onDelete: Cascade)
  spaceId           String
  sessionId         String
  title             String
  status            String
  statusDetail      String?
  kind              String
  question          String?   // ≤ 500 chars
  questionReadAt    DateTime?
  prs               Json      @default("[]")
  origin            String
  devinUpdatedAt    DateTime
  lastMessageId     String?   // Devin's latest message event_id, when read
  notifiedMessageId String?   // identity the last alert was sent for (Design 4)
  firstSeenAt       DateTime
  lastSeenAt        DateTime
  @@unique([serverId, sessionId])
  @@index([spaceId, kind])
}
```

The Integrations card derives "Needs reconnect" from this state (Design 7), so no column is added to `McpServer`. `CloudAgent` is not reused: it tracks launches Rakazo made.

### 3. Question text is read server-side only; the agent keeps search

`createDevinCallTool(prisma, mcp)` in `packages/adapters/src/devin-call-tool.ts`, modelled on `createFinanceCallToolFor`: loads the row by id, builds the context from the row's own `spaceId` and `userId`, allows exactly `devin_session_search` and `devin_session_interact` with `action` `get` or `get_messages` (checked before `callServerTool`), and throws on an `isError` result. Identity of "the question": the latest message with `source` Devin in `get_messages`, its `event_id` as `lastMessageId`, its `body` as `question`; ordering is confirmed in S1.

The agent's preset `allowedTools` becomes `DEVIN_READ_TOOLS`; `devin_session_interact` is never offered, so no approval card can appear. The agent answers history questions from `devin_session_search` and `devin_session_events`; asked what a session is waiting on, it says it cannot read that and links the session (the mockup's "I can't read that question." frame). `forcedWrites` keeps `DEVIN_WRITE_TOOLS` so the gate still classifies them as writes if a row ever lists them. An argument-aware read classification in the gate is under "Not in this epic".

### 4. Needs-input alerts

Lands in S5, inside the refresh operation's commit step, with the platform-event policy of `notifyThreadEvent` (`run-notification.ts:30-67`): a sibling function `notifyDevinNeedsInput`.

- **When.** A row whose `kind` turned `needs_you` from another kind, or whose `lastMessageId` changed while `needs_you`, and whose new identity differs from `notifiedMessageId`. A row first seen as `needs_you` never alerts (per-row baseline). A row that stays `needs_you` with the same identity through any number of runs never alerts again.
- **Identity.** `lastMessageId` when `get_messages` succeeded; otherwise the surrogate `t:<devinUpdatedAt ISO>`. When the read failed at the transition, the alert goes out with the title alone as body and `notifiedMessageId = t:<updatedAt>`; when a later read succeeds and no newer `devinUpdatedAt` has appeared, `lastMessageId` and `notifiedMessageId` are both set to the real id with no second alert.
- **Recipient and policy.** The connector (`server.spaceId`, `server.userId`), `botId: server.agentBotId`, `surface: "devin"`, `importance: "attention"`, `kind: "needs_input"`, `skipRateLimits: true`; `NotificationPreference.help === false` creates nothing (the category `notifyThreadEvent` uses for help); channel switches apply through `externalChannels` as for every notification. No `info` fallback, no retry machinery.
- **Text.** Title "Devin needs input"; body `"{session title}: {question}"` cut to 200 characters, the title alone when the question is unknown.
- **Link.** `externalLink: devinSessionUrl(sessionId)` (Design 5).
- **Dedupe and crash safety.** `dedupeKey = sha256("devin\n<serverId>\n<sessionId>\n<identity>")`; `notifiedMessageId` is written after `createNotification` returns, and both `created` and `deduped` count as recorded, so a crash between the two steps yields one notification. After `created`, `notificationEvents.notify(owner, signal)`.
- **Expectation.** Two-minute refresh plus the outbox's 30 s delivery delay: an alert within about three minutes of Devin asking, not "at once".

### 5. External session links: one canonical form, validated everywhere

Devin's session URL is built, never stored: `devinSessionUrl(id)` and `isDevinSessionUrl(url)` in `packages/contracts/src/devin.ts` (origin `https://app.devin.ai`, path `/sessions/<id>` with the id's character class; the shape is confirmed in S1 against the `url` field `get` returns). Persistence keeps only `sessionId`; the page, the agent's skill text and the notification all build the URL from it.

`createNotification` gains `externalLink?: { url: string; allow: (url: string) => boolean }`, stored in the same `link` column only when `allow(url)` passes; the caller passes `isDevinSessionUrl`, so `packages/db` does not import Devin. `notify_user` cannot set it. Openers apply the same predicate:

- **Toast** (`AppToaster.tsx:110`): `onOpen={openNotificationLink(navigate)}`; the helper in `notification-delivery.ts` opens `isDevinSessionUrl(href)` with `window.open(href, "_blank", "noopener,noreferrer")` and navigates otherwise. The toaster's own mark-seen stays.
- **OS banner** (`notification-delivery.ts:62-65`): `show(title, { body, tag, data: { href } })`, `onclick` focuses the window and calls the same helper. In-app banner links now also navigate; that is a side effect of the shared handler, not a deliverable, covered by one test.
- **Electron**: no change (`main.ts:268-278`).
- **Mobile** (`notification-open.ts`): `notificationOpenTarget` returns `{ kind: "external", url }` when `isDevinSessionUrl(link)`, checked before the `botId` and `/app/<id>` branches; `openNotificationResponse` calls `Linking.openURL(url)` and marks the surface seen; a failed `openURL` returns false and releases the claim.

PR URLs render as text (`owner/repo#n` plus state), never as anchors.

### 6. Sidebar, page refresh and the panel

- `SidebarPageLink` "Devin" between Data room and Artifacts, icon lucide `CodeXml` (the `</>` glyph the mockup draws; `Code` is the slash-less variant), `testId="sidebar-devin"`, always shown, hideable with `hiddenPages` key `devin`.
- Glance: `notifications.glance` gains `devinNeedsYou`, counted from the active connection only: `devinSession.count({ where: { serverId: state.serverId, kind: { in: ["needs_you", "error"] } } })`, zero when there is no state row or the connection is rejected or connector-gone (alerts paused; the mockup's "Key rejected" frame hides the indicator). Badge: `glanceBadge({ unseen: 0, rail, value: n > 0 ? String(n) : undefined, valueLabel })`: the count as the glance value, no dot.
- **Refresh.** Shared data cannot be invalidated through a personal notification topic. The page re-reads `devin.sessions` every 60 s while visible and on `focus`/`visibilitychange`; the read triggers the refresh operation when the cache is older than 60 s. After each page read it dispatches `rakazo:notifications-changed` so `useSidebarGlance` re-reads the count; on other pages the count refreshes on navigation as every glance value does.
- `appPages` gains `{ id: "devin", label: "Devin", keywords: "sessions, coding, pull requests, Cognition" }`.
- `devinMode = useMatch("/app/devin")`; on entering, the Shell calls `rpc.devin.agent()` once; `active = bots.find((b) => b.id === devinAgent?.id)`. `agentPanel` entry `devin-agent` (closed until Ask; "Collapse Devin agent", "Create Devin agent"); Ask is passed to the page only for the connector with the panel closed, and never while the connection is rejected or connector-gone (GAP-54). First Ask shows the intro "Answers questions about what Devin is working on." with the suggestions "Anything merged today?" and "What did Devin do this week?" (the existing suggestions pattern). `pageAgentNeedsModel` applies as for Legal.

### 7. Errors

`devinFailureOf(error, { phase: "listing" | "session" })` in `devin-call-tool.ts` matches the sanitized text (assumption: the MCP transport error carries `(HTTP <status>)`, confirmed in S1 with a fake server):

| Condition | State | Integrations card (connector only) | Page |
|---|---|---|---|
| 401 anywhere; 403 on the listing | `rejectedAt`, `lastError: "rejected"`; refresh and alerts stop | the Integrations page reads `devin.sessions` for the Devin card: badge "Needs reconnect"; Reconnect opens the Devin dialog in replace mode (owners) | notice replaces the tiles: "Devin rejected the key. Alerts are paused." with "Reconnect" (owners) or no button (members); rows and badges muted; count hidden |
| 403 on one session's `get_messages` | that row keeps `question: null`; an alert, if due, goes out with the title; no connection change | unchanged | the row shows its title alone |
| 429 | `backoffUntil` 10 min, doubling to 60 min (`backoffStep`), `lastError: "rate_limited"` | unchanged | cached rows, header "Updated 12m ago"; with no cached rows yet: "Could not load Devin sessions." + "Try again" |
| Timeout or other failure | `backoffUntil` 5 min, `lastError: "unreachable"` | unchanged | first load: "Could not load Devin sessions." + "Try again"; refresh: the same notice above the kept rows |
| Connector left the space | `lastError: "connector_gone"`; refresh and alerts stop | "Needs reconnect" | "The member who connected Devin left this space. Alerts are paused." + "Reconnect" (owners) |
| Incomplete listing or skipped lines | `complete: false` or `skipped > 0` | unchanged | one muted line "Some sessions could not be read." |
| Zero sessions, complete | — | — | no tiles, no table: "No Devin sessions yet." and the link "Open Devin" |

A failed key replacement never touches the working or rejected connection (Design 1). `mcp.servers.setWrites` returns `BAD_REQUEST` for a Devin server and the switch is hidden, so there is no path back to writes.

### 8. Removing the write option (Devin only)

- `INTEGRATION_PRESETS.devin.allowedTools = DEVIN_READ_TOOLS`; instructions rewritten (read-only; the user answers and starts work in Devin; session text is untrusted data).
- `setIntegrationAgentWrites` rejects `isDevinEndpoint` rows; `McpDetail` passes no `onWrites` for a Devin server (`IntegrationAgentSection.onWrites` becomes optional). Granola and every other integration are unchanged.
- `devin-sessions` skill rewritten: find sessions with `devin_session_search`, follow with `devin_session_events`, answer repo questions with the wiki tools; no step for creating, messaging, sleeping or scheduling; it cannot read a session's messages, so for "what is it waiting on" it links the session with `devinSessionUrl` and points at the Devin page; it never forwards Devin content to third parties (GAP-33). Description "Search and follow Devin sessions. Read-only." The demo fixture's description follows.
- Enforcement is proven at the boundary, not by preset arrays: the connector test lists tools for the Devin agent with `allowAllTools: true` and `writesEnabled: true` and asserts `devin_session_interact` and `devin_session_create` are neither offered nor executable, while `devin_session_search` is.

### 9. Status mapping

Every row below is an assumption until S1 records the real vocabulary; `needs_you` wins over any other match so a row never carries two statuses (GAP-26); the raw `status_detail` is the badge's `title`.

| Devin `status` / `status_detail` | Kind | Badge | Section | Confirmed |
|---|---|---|---|---|
| detail `waiting_for_user`, `awaiting_user_input`, or status `blocked` | `needs_you` | "Needs input" | Needs you | assumed |
| `error`, `failed`, `expired`, `terminated` | `error` | "Error" | Needs you | assumed |
| `working`, `running`, `resumed`, `resume_requested` | `working` | "Working" | Working | assumed |
| `finished`, `completed`, detail `finish`; `sleeping`, detail `sleep` | `finished` | "Finished" | Earlier | partly (research: summary "only after sleep/finish") |
| `suspended`, `suspend_requested`, `suspend_requested_frontend` | `suspended` | "Suspended" | Earlier | assumed |
| anything else or empty | `unknown` | raw text, "Unknown" when empty | Earlier | by design (GAP-03) |

### 10. The page

Mockup v4 with the "Target" amendments. `DevinPage` in `apps/web/src/pages/Devin.tsx` inside `FinanceChromeProvider` (`agentName: "Devin agent"`) and an `@container`; `DevinSessions` in `apps/web/src/pages/devin/DevinSessions.tsx`; fixtures in `apps/web/src/pages/devin/fixtures.ts` (organization "acme", repos acme/web, acme/api, acme/mobile).

- **Header.** `PageHeader` title "Devin"; meta only "Updated {relative time}" when `stale`; no space or organization name (no source exists for the latter). Actions: `AskAgentButton` for the connector with the panel closed and the connection healthy.
- **Not connected.** Centred: owner "Connect Devin to see its sessions here." with the button "Connect Devin"; member "Ask a space owner to connect Devin." with no button. With `adoptable` set, the dialog offers "Use it".
- **Tiles.** `Kpi` "Needs you" (emphasised; `needs_you` + `error` rows) and "Working", two across at every width.
- **Table.** Section rows "Needs you", "Working", "Earlier"; a section with no rows is omitted. Columns Session, Status, Pull request, Source, Updated with fixed `colgroup` widths 36/15/21/12/16 %. The whole row is one link: the title is an `<a>` to `devinSessionUrl(id)` (`target="_blank"`, `rel="noreferrer"`, the external-link glyph kept with the last word, accessible name "{title} (opens in Devin)") whose `::after` covers the row (the mockup's `.ti::after{inset:0}`); nothing else in the row is interactive. Under a `needs_you` title the question in full, wrapping, no clamp. Status badge per Design 9. Pull request as text: `owner/repo#n` with the state under it for a GitHub URL, the host otherwise, the first PR plus "+{n}" when several, "—" when none. Source: webapp "Web", slack "Slack", teams "Teams", api "API", linear "Linear", jira "Jira", automation "Automation", cli "CLI", desktop "Desktop", code_scan "Code scan", else "Other". Updated: `formatRelativeTime(updatedAt)`. Empty title: "Untitled session".
- **Narrow.** Below the page container's `@2xl` (672 px) the table becomes the mockup's compact list: title (same stretched link), badge top right, the question, then one muted line "acme/api#212 open · 1h ago" (PR and state, then time; Source omitted). Why `@2xl` and not Legal's `@4xl`: five columns with a 36 % title column keep their words whole down to about 650 px, Legal's seven columns with amounts do not below 896 px; the mockup switches at 639 px and `@2xl` is the nearest Tailwind container step above it, so the table never reaches the width where "Pull request" wraps mid-word.
- **States.** Skeleton on first load only (header, two tiles, six row bars, as the mockup); rows kept during a refresh; error, rejected, connector-gone, partial and empty per Design 7, with the rejected and connector-gone frames muting rows and badges and hiding the count.
- **Refresh.** Design 6.

### Security and tenancy

Every query filters on `spaceId`; the active connection is selected by the actor's space, never by a client-supplied id, except `devin.adopt`, which also requires the row to be the actor's own. Calls to Devin run in the connection row owner's scope through `callServerTool`; the key never reaches the model (the agent has no `get`). The caller allows two tool names and two `action` values and throws on `isError`. The agent's preset is a closed read allowlist checked before every call. Only space owners connect, adopt, replace or disconnect, through Devin-specific RPCs; the generic MCP APIs keep their per-user scope. A key replacement is verified on a separate row before anything existing changes, and clears the cache so organizations never mix. Alerts go only to the connector and stop when the connector leaves the space. Notification links are built from Devin ids into one canonical URL, validated by the same predicate in the database layer and in every opener; `notify_user` cannot set one. Titles, questions and PR references render as text. The refresh holds no transaction across HTTP; leases are fenced by token and version, and every commit re-checks the connection's `revision`.

## Mockup reconciliation

What v4 draws, and the agreed target (the mockup is updated to the Target column).

| Area | Mockup v4 | Target |
|---|---|---|
| Sidebar indicator | Dot with hidden "new" text | The live count as the glance value, no dot (Design 6) |
| Sidebar icon | Code brackets `</>` | Lucide `CodeXml` |
| Header meta | Organization name | Title only; "Updated Nm ago" only when stale |
| Sections | "Needs you", "Working", "Earlier" | Same; Needs you includes Error rows and the tile counts them |
| Session action | Title link with external glyph, screen-reader "(opens in Devin)", stretched row target | Same; the row is the single link; no "Answer in Devin" |
| Question | Full text, no clamp | Same |
| PR | Text spans | Same, text only, "+{n}" for several |
| Narrow rows | Compact "PR state · time" line, Source omitted | Same, switching at `@2xl` (672 px) |
| Empty | "No Devin sessions yet." + "Open Devin" | Same |
| Key rejected | Notice replaces tiles, rows muted, dot hidden, "Alerts are paused." | Same; Reconnect only for owners |
| Not connected | Owner copy + button; member "Ask a space owner to connect Devin." | Same |
| Connect dialog | "Connects Devin for everyone in this space. Read-only.", password field, "Where to find your key", "The key was refused", Connect disabled when empty, connecting state | Same, field labelled "Organization service-user key" |
| Toast | "Devin needs input", body, "Opens Devin" | Same |
| Agent | Tool step "Session get messages" in two frames | The agent has search only; those steps become search steps; the "I can't read that question." reply stays |
| First Ask | Intro and two suggestions | Same |
| Chat styling | User bubbles in the bot accent | Correct for the real panel (`styles.css:53-56`, `Shell.tsx:3511`, `:5245`) |
| Missing from v4 | — | Unknown-status badge (raw text), partial-results line, several PRs, connector-gone notice, adoption line in the dialog |

## Copy

Each visible string, where it appears, and why it exists.

| String | Where | Why |
|---|---|---|
| "Devin" | sidebar, page title, search | The page's name; matches the tile. |
| "Needs you" / "Working" | tiles and section rows | The two counts the page exists for; "Needs you" matches the Activity list. |
| "Earlier" | section row | Names the finished, suspended and unknown rows without a status word of its own. |
| "Session", "Status", "Pull request", "Source", "Updated" | table head | Column names; "Source" because the value is an origin, not a person. |
| "Needs input", "Error", "Working", "Finished", "Suspended", "Unknown" | status badge | One word per state; "Needs input" is the Activity list's row word; "Unknown" names a status the mapping has not seen. |
| "(opens in Devin)" | row link, screen-reader only | The row leaves the app; sighted users get the glyph. |
| "Untitled session" | Session cell | A session without a title still needs a row. |
| "Web", "Slack", "Teams", "API", "Linear", "Jira", "Automation", "CLI", "Desktop", "Code scan", "Other" | Source cell | Devin's origin values in plain words; "Other" covers unknown ones. |
| "+{n}" | Pull request cell | Several PRs in one slot. |
| "—" | empty cells | Existing dash convention. |
| "Updated {time}" | header meta, only when stale | Says the rows are old; hidden when fresh. |
| "No Devin sessions yet." / "Open Devin" | empty state | Distinguishes an empty organization from a failed load; the link is the only way to start work. |
| "Could not load Devin sessions." + "Try again" | `ErrorNotice` | One message for every non-auth failure; the component's existing button. |
| "Devin rejected the key. Alerts are paused." + "Reconnect" | notice replacing the tiles | The one failure an owner fixes; the second sentence says why no alert will come (GAP-49). |
| "The member who connected Devin left this space. Alerts are paused." + "Reconnect" | notice | Without it the page looks healthy while nobody is alerted (GAP-53). |
| "Some sessions could not be read." | under the table | Tiles may undercount; silence would hide it (GAP-27). |
| "Connect Devin to see its sessions here." / "Connect Devin" | not connected, owner | One sentence of purpose and the one action. |
| "Ask a space owner to connect Devin." | not connected, member | Says who can act; without it the page is a dead end (STORY-031). |
| "Connect Devin" | dialog title | Existing title. |
| "Connects Devin for everyone in this space. Read-only." | dialog description | The sharing fact a member would otherwise learn by surprise (GAP-50) and the promise the page keeps. |
| "Organization service-user key" | field label | The only key kind that works through the bearer token; a personal `cog_` token is refused. |
| "Where to find your key" | dialog help link | The existing `ConnectionDialog` help pattern (walker F-001-02). |
| "The key was refused." | dialog error | One sentence, from the mockup; covers a wrong key and a personal token. |
| "Use the Devin connection you already added." / "Use it" | dialog, owner with a private Devin row | Explicit adoption instead of silently promoting a private connection. |
| "Connect", "Cancel" | dialog buttons | Existing. |
| "Ask", "Collapse Devin agent", "Create Devin agent" | header and panel | Existing page-agent labels. |
| "Answers questions about what Devin is working on." | panel intro | Says what the agent is for; from the mockup. |
| "Anything merged today?", "What did Devin do this week?" | panel suggestions | Questions the table cannot answer. |
| "Devin needs input" / "{title}: {question}" / "Opens Devin" | notification title, body, destination hint | Short title; the fact before clicking; the hint because the click leaves the app. |
| "Devin is already connected in this space" | API error | Explains a refused second connection. |
| "Open Devin" | Integrations card link | Mirrors Carta's "Open Cap table" (GAP-21). |
| "Devin sessions are not affected." | disconnect confirmation | So disconnecting is not mistaken for stopping work (GAP-43). |
| "Search and follow Devin sessions. Read-only." | skill description | Replaces a description that promised writes. |
| "{n} need you" | sidebar `valueLabel` | Accessible name of the count. |

Removed for Devin: "Allow changes in Devin", "ACUs this week", "PRs open", the header organization name and external-link icon, "Answer in Devin", the hint "org-scoped".

## Slices

Each is one PR, about a day or less, mergeable on a base that contains its prerequisites, and each ends with its own verification (there is no separate docs or walk slice). Lingui catalogs (`apps/web/src/locales/*/messages.po`) are owned by one slice at a time. Postgres tests run with `VERIFY_DATABASE=1` and `DATABASE_URL`, like `apps/api/src/glance.postgres.test.ts`. Every new component ships with its `*.stories.tsx`, and `pnpm design-system` regenerates `docs/design-system/components.md` in the slice that adds it. CI is off on the fork, so screenshots come from a local Playwright run.

### S1. Verify the Devin read contract

Story: Trustworthy (a parser for the real API). Needs an organization service-user key on a dev stack; without one this slice, and everything after it, is blocked, and the plan says so.

- Owns: `packages/adapters/src/__fixtures__/devin/` (redacted real `devin_session_search` pages including a second page via `after`, `get` and `get_messages` for one waiting and one finished session, an `isError` result, and the sanitized error text for a 401, a 403 and a 429 where they can be provoked); `packages/adapters/src/devin-sessions.ts` and `devin-sessions.test.ts`; `packages/adapters/src/devin-call-tool.ts` (`createDevinCallTool`, `devinFailureOf`) and `devin-call-tool.test.ts`; `packages/contracts/src/devin.ts` (`devinSessionUrl`, `isDevinSessionUrl`, `DevinSessionKind`, the Design 9 constants, `DEVIN_INTERACT_READ_ACTIONS`) and `devin.test.ts`; this document's Design 9 table, Assumptions and Open questions updated with what was observed; `packages/adapters/src/index.ts` and `packages/contracts/src/index.ts` exports; one case in `packages/adapters/src/mcp-connector.test.ts` (error text for a 401 from a fake HTTP server).
- Behaviour: the fixtures parse into the expected rows; a malformed line is skipped and counted; missing fields are null, never thrown; `nextCursor` is read from a full page and absent on the last; `parseDevinMessages` identifies the latest Devin message and its `event_id` in the order the real output uses; `devinKindOf` follows the observed vocabulary with `needs_you` precedence and the raw fallback; `isDevinSessionUrl` accepts the `url` the real `get` returned and rejects other hosts, paths, `http:` and credentials; the caller refuses `devin_session_create`, `devin_session_interact` with `action: "message"` and an unknown tool before `callServerTool`, allows `get` and `get_messages`, builds the context from the row's owner, and throws on `isError`; `devinFailureOf` classifies 401 and listing-403 as `rejected`, session-403 as `session_forbidden`, 429 as `rate_limited`, a timeout as `unreachable`, against the text the connector produces for a fake server.
- TDD, written first: `devin-sessions.test.ts`, `devin-call-tool.test.ts`, `devin.test.ts`.
- Regression test: `devin-call-tool.test.ts` "the Devin caller allows search, get and get_messages, refuses every other tool or action before the call, and throws on an isError result".
- Verify: `pnpm --filter @rakazo/adapters test -- devin mcp-connector && pnpm --filter @rakazo/contracts test && pnpm check`. The PR states which fixtures are real and when they were captured.

### S2. Make the existing Devin integration read-only

Story: Trustworthy. Prerequisite: S1 (`devinSessionUrl` for the skill). Can run beside S3a (no shared file).

- Owns: `packages/contracts/src/integration-agent.ts` (Devin `allowedTools = DEVIN_READ_TOOLS`, instructions) and `integration-agent.test.ts`; `apps/api/src/integration-agent.ts` (`setIntegrationAgentWrites` rejects Devin) and `apps/api/src/integration-agent.postgres.test.ts`; `packages/adapters/src/mcp-connector.test.ts` (gate cases, beside the S1 case); `apps/web/src/components/integrations/McpDetail.tsx`, `McpDetail.test.tsx`, `McpDetail.stories.tsx`, `IntegrationAgentSection.tsx` and its story (`onWrites` optional); `packages/adapters/src/builtin-skills.ts` (skill) and `apps/web/src/demo/fixture.json`; Lingui catalogs.
- Behaviour: for the Devin agent with `allowAllTools: true` and `writesEnabled: true`, discovery offers `devin_session_search` and the wiki tools and never `devin_session_interact`, `devin_session_create` or a `*_manage` tool, and `execute` of `devin_session_interact` is refused before any call; `setWrites` on a Devin server is `BAD_REQUEST`, on a Mercury server unchanged; `McpDetail` for a Devin server shows the agent section without the switch, for Mercury with it; the skill text has no create, interact, manage or "Allow changes" step and links sessions with `devinSessionUrl`; Carta and Granola behaviour unchanged.
- TDD, written first: `mcp-connector.test.ts` ("no Devin write tool is offered or executable for the Devin agent, even with writes on and allowAllTools"), `integration-agent.postgres.test.ts`, `McpDetail.test.tsx`.
- Regression test: the `mcp-connector.test.ts` case above.
- Verify: `pnpm --filter @rakazo/contracts test && pnpm --filter @rakazo/adapters test -- mcp-connector builtin-skills && VERIFY_DATABASE=1 pnpm --filter @rakazo/api test -- integration-agent && pnpm --filter @rakazo/web test -- McpDetail && pnpm design-system && pnpm design-system:check && pnpm check`.

### S3a. Shared connection: schema, job and the refresh operation

Story: Faster (one durable refresh path). Prerequisite: S1.

- Owns: `packages/db/prisma/schema.prisma` (`DevinConnectionState`, `DevinSession`, back-relations) and one migration; `packages/adapter-kit/src/types.ts` (`"devin.refresh": { serverId?: string }`) and `packages/adapter-kit/src/background-jobs.ts` with `background-jobs.test.ts`; `packages/adapters/src/devin-refresh.ts` (lease, revision check, listing, per-row baseline and change detection, incomplete semantics, failure classes, backoff, connector-membership check; no notification yet) with `devin-refresh.test.ts` (decision table, `vi.fn` prisma) and `devin-refresh.postgres.test.ts`; `packages/adapters/src/background-job-handlers.ts` (`"devin.refresh"` handler; deps gain `devinCallTool?`); `packages/adapters/src/wakeup.ts` (`{ task: "devin.refresh", match: "*/2 * * * *" }`) and `wakeup-cron.test.ts`; `apps/worker/src/index.ts` (passes `createDevinCallTool(prisma, mcp)`).
- Behaviour: two concurrent refreshes of one server run one listing (the loser reads nothing and writes nothing); an expired lease is taken over and the old holder's late commit is discarded by the token and version fence; a `revision` change between claim and commit discards results; a waiting session first seen is stored with its real `lastMessageId` and `notifiedMessageId` equal to it; an unchanged waiting session through two further runs calls `get_messages` zero times; a session turning `needs_you` calls it once; a listing whose second page fails commits the first page's rows with `complete: false` and deletes nothing; skipped lines delete nothing; a row unseen for 7 days is deleted, one unseen for 1 day kept; a 401 and a listing-403 set `rejectedAt` and the next run skips the server; a session-403 leaves the connection healthy and the row's question null; 429 sets `backoffUntil` 10 then 20 then 40 min; a timeout sets 5 min; a connector with no `SpaceMember` row sets `connector_gone` and performs no listing; `isError` from the fake caller is a failure, not an empty list; no transaction is open while the fake caller awaits; cron runs the task with no payload across every candidate server, a payload names one.
- TDD, written first: `devin-refresh.test.ts`, `devin-refresh.postgres.test.ts` (mirrors `job-reconciler.postgres.test.ts` and `notify-user.postgres.test.ts`), `background-jobs.test.ts`, `wakeup-cron.test.ts`.
- Regression test: `devin-refresh.postgres.test.ts` "overlapping refreshes run one listing, a late holder cannot commit, and an unchanged waiting session fetches no messages".
- Verify: `pnpm --filter @rakazo/db generate && pnpm db:migrate && pnpm --filter @rakazo/adapter-kit test && pnpm --filter @rakazo/adapters test -- devin-refresh wakeup && VERIFY_DATABASE=1 pnpm --filter @rakazo/adapters test -- devin-refresh && pnpm check`.

### S3b. Shared connection: API, contracts and the sidebar count

Story: Simpler, Trustworthy. Prerequisite: S3a.

- Owns: `packages/contracts/src/rpc.ts` (`devin.sessions`, `devin.agent`, `devin.connect`, `devin.adopt`, `devin.replaceKey`, `devin.disconnect`; glance `devinNeedsYou`); `packages/contracts/src/devin.ts` (output schemas; sequential after S1); `apps/api/src/devin.ts` (new) and `apps/api/src/router.ts` (handlers beside `legal`, `devinDeps`, glance, the uniqueness check in `mcp.servers.create` and `update`); `apps/api/src/app.ts` (deps); `apps/web/src/lib/use-sidebar-glance.ts` (`EMPTY.devinNeedsYou`, `surfaceOfPath` `devin`) and `use-sidebar-glance.test.tsx`; `apps/api/src/devin.postgres.test.ts` (new), `apps/api/src/glance.postgres.test.ts`.
- Behaviour, with a fake Devin caller: an owner's `connect` verifies the key (tools list and one search), creates the row in the owner's scope, the state row and one `devin.refresh` job; a refused key leaves no row, no secret and no state; a non-owner's `connect`, `adopt`, `replaceKey` and `disconnect` are `FORBIDDEN`; a second owner's `connect` while connected is `CONFLICT`, and two concurrent connects leave one state row; a member who did not connect reads the same rows with `isConnector: false`, `manage: false`; a second owner reads `manage: true`, `canConnect: false`; an actor in another space reads `status: "none"`; a space with a private Devin row and no state row reads `status: "none"` and, for that row's owner, `adoptable`; `adopt` of another user's row is `FORBIDDEN`; `mcp.servers.update` turning a server into a Devin endpoint while a state row points elsewhere is `CONFLICT`; a read within 60 s of `lastSucceededAt` calls Devin zero times; a read after 60 s runs the refresh operation; a read while the lease is held returns the cache; a rejected connection returns `status: "rejected"` and stored rows; a second owner's `replaceKey` with a refused key leaves the rejected connection and its rows untouched; with a good key it swaps the state row to the new server, deletes the old rows and server, archives the old agent, and the acting owner becomes the connector; `disconnect` removes everything and every member reads `none`; glance `devinNeedsYou` counts `needs_you` and `error` rows of the active connection only, zero when rejected; a former member of the space gets `FORBIDDEN` from every Devin RPC (the existing membership check); `devin.agent` creates the connector's agent once for two concurrent calls and returns null for another member.
- TDD, written first: `devin.postgres.test.ts` (mirrors `glance.postgres.test.ts`: `createRouterClient(createRouter(...))`, two owners, one member, one former member, two spaces), `glance.postgres.test.ts`, `use-sidebar-glance.test.tsx`.
- Regression test: `devin.postgres.test.ts` "every member reads the space's sessions, only an owner may connect, adopt, replace or disconnect, and a refused replacement key changes nothing".
- Copy: the PR quotes "Devin is already connected in this space" and "The key was refused.".
- Verify: `VERIFY_DATABASE=1 pnpm --filter @rakazo/api test -- devin glance && pnpm --filter @rakazo/contracts test && pnpm --filter @rakazo/web test -- use-sidebar-glance && pnpm check`.

### S4a. Web: the page components, Storybook first

Story: Simpler. Prerequisite: S3b (RPC types; stories use `mockRpc`).

- Owns: `apps/web/src/pages/Devin.tsx`, `Devin.stories.tsx`, `Devin.test.tsx`; `apps/web/src/pages/devin/DevinSessions.tsx` and `DevinSessions.stories.tsx`; `apps/web/src/pages/devin/fixtures.ts`; `apps/web/src/lib/devin-format.ts` (`prLabel`, `sourceLabel`, `statusLabel`, `kindSection`) and `devin-format.test.ts`; `apps/web/src/components/finance/ui.tsx` (`ErrorNotice` gains an optional `action?: { label, onClick }` replacing "Try again") and `ui.stories.tsx`; Lingui catalogs; `docs/design-system/components.md`.
- Behaviour (jsdom and stories): sections appear in order and empty sections are omitted; the "Needs you" tile equals `needs_you` plus `error` rows; the row's only interactive element is the title link to `devinSessionUrl(id)` with `rel="noreferrer"`, accessible name ending "(opens in Devin)", and the stretched-target class; the question renders in full with no clamp class; the PR cell has no anchor and shows `acme/api#212` with "open" under it, "+1" for two PRs, "—" for none; `origin: "code_scan"` shows "Code scan", unknown "Other"; an unknown status shows its raw text; "Updated 12m ago" only when `stale`; "Some sessions could not be read." only when `partial`; the empty state has no tiles or table and links "Open Devin" to `https://app.devin.ai`; rejected shows the notice in place of the tiles with Reconnect only when `manage`, rows and badges muted; connector-gone likewise; not-connected owner and member copy; Ask only for the connector; the page re-reads every 60 s while visible, on focus and visibility, and dispatches `rakazo:notifications-changed` after each read; the `ErrorNotice` story shows both the default and the action variant.
- TDD, written first: `Devin.test.tsx` (`vi.mock("../lib/rpc")` as `Legal.test.tsx`), `devin-format.test.ts`.
- Regression test: `Devin.test.tsx` "the row is one link to the session, the question is not clamped, the PR is text, and Error rows count under Needs you".
- Verify: `pnpm --filter @rakazo/web test -- Devin devin-format && pnpm design-system && pnpm design-system:check && pnpm --filter @rakazo/web build-storybook && (cd apps/web && node .storybook/smoke.mjs storybook-static)`. The PR links Storybook screenshots of the wide and the 600 px container stories.

### S4b. Web: Shell wiring, connect dialog, Integrations card, browser checks

Story: Simpler. Prerequisite: S4a (sequential; owns the catalogs after S4a).

- Owns: `apps/web/src/App.tsx`; `apps/web/src/pages/Shell.tsx` (`devinMode`, `devin.agent` call, `active`, `createDevinAgent`/`askDevinAgent`, `agentPanel` entry with intro and suggestions, `SidebarPageLink` with `CodeXml` and the count value, `appPages`, `hiddenPages`, page render, space-switch reload); `apps/web/src/pages/Shell.test.tsx`; `apps/web/src/components/integrations/DevinConnectDialog.tsx` (new, built on the `ConnectionDialog` field-and-help pattern: description, "Organization service-user key" field, help link, connect/adopt/replace modes, connecting state, "The key was refused.") with `DevinConnectDialog.stories.tsx` and `DevinConnectDialog.test.tsx`; `apps/web/src/lib/integrations.ts` (Devin tile Connect opens `DevinConnectDialog`; hint and `apiKey` flag removed) and `integrations.test.ts`; `apps/web/src/components/integrations/IntegrationsHome.tsx` (Devin tile and card: "Open Devin", "Needs reconnect" from `devin.sessions`, Reconnect opens the dialog in replace mode for owners, disconnect confirmation clause) and `IntegrationsHome.test.tsx`; `apps/web/e2e/devin.spec.ts` (new, mirrors `legal.spec.ts`: routes `**/rpc/devin/**` and glance with fixtures; sidebar count "3", heading, row link `href`, panel hidden until Ask, screenshots at 1500 and 390 px; a second test asserts in the browser that a 120-character question renders on more than one line with no `text-overflow`, and that at 390 px the compact list is shown and the table is not); Lingui catalogs.
- Behaviour: the sidebar shows "Devin" with the count and no dot; hiding it works and search still finds the page first; `/app/devin` renders `DevinPage`; the panel opens on Ask with the intro and two suggestions and creates the agent when missing; a non-connector sees no Ask; Connect from the tile or the page opens the dialog, Connect is disabled while the field is empty, shows the connecting state, lands on `/app/devin` on success and shows "The key was refused." on failure; an owner with a private Devin row sees "Use it"; a rejected connection shows "Needs reconnect" on the card and Reconnect opens replace mode; `CustomConnectionDialog` is no longer used for Devin.
- TDD, written first: `Shell.test.tsx`, `DevinConnectDialog.test.tsx`, `IntegrationsHome.test.tsx`, `devin.spec.ts`.
- Regression test: `DevinConnectDialog.test.tsx` "a refused key shows The key was refused and keeps the dialog open; a good key closes it and lands on the Devin page".
- Copy: the PR quotes every new string of the dialog, card and panel.
- Verify: `pnpm --filter @rakazo/web test -- Shell DevinConnectDialog IntegrationsHome integrations && pnpm design-system && pnpm design-system:check && pnpm check && pnpm lint`, then `pnpm --filter @rakazo/web e2e -- devin.spec.ts` against a dev stack; the PR links the screenshots.

### S5. Needs-input notifications and external opening

Story: Faster. Prerequisite: S3a (refresh operation); S4b for the integrated check.

- Owns: `packages/db/src/notifications.ts` (`externalLink` with the caller's predicate) and `notifications.postgres.test.ts`; `packages/adapters/src/devin-refresh.ts` (the alert step, `notifyDevinNeedsInput`) and its two tests; `packages/adapters/src/background-job-handlers.ts` and `apps/worker/src/index.ts` (pass `notificationEvents`); `apps/web/src/lib/notification-delivery.ts` and `notification-delivery.test.ts`; `apps/web/src/components/AppToaster.tsx`; `apps/mobile/lib/notification-open.ts`, `notification-open.test.ts`, `apps/mobile/lib/open-notification.ts`, `open-notification.test.ts`; `apps/api/src/devin-journey.postgres.test.ts` (new: the integrated fake-MCP journey); `docs/integration-agents/README.md` (one line: Devin is read-only; its page and alerts).
- Behaviour: `createNotification` rejects `link: "https://..."` as today; an `externalLink` whose predicate passes is stored in `link`; one that fails throws; `notify_user` has no path to it. Refresh: a waiting session unchanged through two runs then a genuinely new Devin message alerts exactly once, with title "Devin needs input", body "{title}: {question}", `link` = `devinSessionUrl(id)`, `kind: "needs_input"`, `skipRateLimits`, and one realtime signal; `help: false` in the user's preferences creates nothing; a crash simulated between `createNotification` and the state write followed by a rerun yields one notification (`deduped` counts as recorded); a failed message read at the transition alerts with the title alone and the later successful read records the real id without a second alert; a session that returns to Working then asks again alerts again; a `connector_gone` connection alerts nobody. Web: a banner click with a Devin URL focuses and opens a new window with `noopener,noreferrer`; with an in-app href it navigates; the toast does the same and still marks seen. Mobile: a payload with `botId` and a Devin link opens the link, not the thread; a payload with a Devin link in another space switches space first; a failed `openURL` returns false and releases the claim; `/app/<botId>` payloads behave as before. Journey: fake MCP server, real API, the handler run by hand, notification row, outbox delivery row, `devin.sessions` showing the row under Needs you, key rejected by the fake, `replaceKey` by a second owner, the alert recipient now the second owner.
- TDD, written first: `devin-refresh.postgres.test.ts` additions, `notifications.postgres.test.ts`, `notification-delivery.test.ts`, `notification-open.test.ts`, `open-notification.test.ts`, `devin-journey.postgres.test.ts`.
- Regression test: `devin-refresh.postgres.test.ts` "an unchanged waiting session never alerts, a new question alerts once with the session link, and a crash before recording does not alert twice".
- Copy: the PR quotes "Devin needs input" and the body format.
- Verify: `VERIFY_DATABASE=1 pnpm --filter @rakazo/db test -- notifications && pnpm --filter @rakazo/adapters test -- devin-refresh && VERIFY_DATABASE=1 pnpm --filter @rakazo/adapters test -- devin-refresh && VERIFY_DATABASE=1 pnpm --filter @rakazo/api test -- devin-journey && pnpm --filter @rakazo/web test -- notification-delivery && pnpm --filter @rakazo/mobile test -- notification-open open-notification && pnpm check`. The PR records a manual click of a toast and an OS banner on web and in Electron on the dev stack, and states that a phone push on a device and a real Devin account were not tried unless they were.

Waves: S1 → (S2 ∥ S3a) → S3b → S4a → S4b → S5. S2 and S3a share no file. S5's database, web and mobile files could start after S3a, but its refresh and journey tests need S3b and S4b, so it is listed last.

## Gap register coverage

| Gap | Where |
|---|---|
| GAP-01 | Design 3 (server-side `get_messages`; S1, S3a); the agent keeps search only (S2) |
| GAP-02 | Designs 2 and 4; S3a, S5 |
| GAP-03 | S1 real vocabulary; Design 9 raw fallback |
| GAP-04 | Design 7; S3b, S4b |
| GAP-05 | Design 6 count from the table; S3b, S4b |
| GAP-06 | Design 4 identity-based dedupe, platform-event policy; S5 |
| GAP-07, GAP-48 | Decision: the push opens the session in the browser; S5 |
| GAP-08 | Design 2 one RPC; S3b |
| GAP-09 | Decision: every member sees the organization's sessions; no organization name (no source) |
| GAP-10, GAP-32, GAP-33 | S2 |
| GAP-11 | S5 (side effect of the shared handler) |
| GAP-12 | Decision: the connector; S5 |
| GAP-13 | Design 6; S4a |
| GAP-14 | S4a skeleton and kept rows; 15 s timeout |
| GAP-15 | S4a empty state |
| GAP-16 | Design 2 paging and per-row baseline |
| GAP-17 | Sections and one order; no filters |
| GAP-18 | Tiles cut |
| GAP-19, GAP-52 | `devinSessionUrl` from the id, verified in S1 |
| GAP-20, GAP-45 | Whole-row link, question in full (v4) |
| GAP-21 | S4b lands on the page; "Open Devin" card link |
| GAP-22 | `devin.connect` runs one search (S3b) |
| GAP-23 | S4b panel branch |
| GAP-24, GAP-50 | Design 1: one per space, owners manage, dialog disclosure |
| GAP-25 | S4a compact list at `@2xl` |
| GAP-26 | Badge `title`; needs-you precedence |
| GAP-27 | S1 parser; partial line (S4a) |
| GAP-28 | Design 7 backoff and stale rows |
| GAP-29, GAP-51 | Panel closed until Ask; intro drawn (S4b) |
| GAP-30 | Page and refresh share one operation and table |
| GAP-31 | S2 skill line |
| GAP-34 | Stale-only header |
| GAP-35 | "+{n}" (S4a) |
| GAP-36 | Origin map, "Untitled session" (S4a) |
| GAP-37 | Link always shown (S4b) |
| GAP-38 | Field label and help link (S4b); the error split is Not in this epic |
| GAP-39, GAP-40, GAP-41, GAP-42 | Not in this epic |
| GAP-43 | Disconnect clause (S4b) |
| GAP-44 | Two page messages and the card's "Needs reconnect" from the same state |
| GAP-46 | Keywords, page first (S4b) |
| GAP-47 | Existing patterns; stretched link with an accessible name |
| GAP-49, GAP-54 | Rejected frame mutes rows, hides the count, Ask hidden; Reconnect for owners only (S4a, S4b) |
| GAP-53 | `connector_gone` and re-homing on replace (Design 1; S3a, S3b, S5) |

## Assumptions

- Devin lists sessions newest-updated first, so a changed session appears within the first pages (confirmed in S1).
- Two-minute refresh per connected space, one listing per run, is within Devin's limits; 429 backoff covers the case it is not.
- The MCP transport error text contains `(HTTP <status>)` (S1 confirms with a fake server).
- A session absent from complete listings for 7 days is archived or deleted and can be dropped from the table.
- The organization key returns the organization's sessions to every member who opens the page; the requester accepted this.
- Re-baselining after a key replacement (no alerts for sessions already waiting at that moment) is acceptable.

## Open questions

- Exact `devin_session_search` and `get_messages` text, ordering and cursor behaviour, and the `status`/`status_detail` vocabulary: answered by S1's captures.
- Whether `devin_session_events` returns message bodies; if so the refresh could use it and the agent could read questions without a gate change.
- Devin's rate limits, and so the refresh interval and `DEVIN_MAX_PAGES`.
- Devin's archive semantics (does an archived session leave the search listing?), and so the 7-day rule.
- The URL of Devin's key-creation page for "Where to find your key".
- Whether the testkit's connector emulator can serve the two Devin tools for the journey test, or S5 adds a small fake.

## Not in this epic

- Launching, replying to, stopping, sleeping or tagging Devin sessions from Rakazo.
- A native mobile Devin screen; a push opens the session in the phone's browser.
- Repo-docs and wiki tools on the page (the agent keeps them; the tile subtitle stays).
- ACU, cost or credit-balance tiles and columns.
- Several Devin connections or organizations per space; an organization name in the header (no source).
- A shared Devin agent chat for members other than the connector (bots, threads and secrets are per user).
- A general read-only preset policy for other integrations (Granola and the rest are unchanged).
- Argument-aware read classification of `devin_session_interact` in the MCP gate.
- Alerts for Error or Suspended sessions or for a refused key (GAP-42); the page shows them.
- A notification history (GAP-41); suppressing the toast while on the page (GAP-39); both devices buzzing (GAP-40).
- Naming who started a session (Devin exposes an opaque `user_id` only).
- Filters, sort controls, a refresh button, a waiting-time cue.
- Splitting the refused-key message into "refused" and "could not reach" (GAP-38).
- The letter-only Devin tile logo; the two connect-dialog shells for other integrations; the warning and success text contrast of the shared tokens.
- Reusing the `CloudAgent` tables, poller or card.

## Review changes

Round 2 (Astra review of round 1, lead decisions applied):

- **Kept against the review:** the docked Devin agent (the requester asked for it; it is the connector's existing integration agent, members without it see no Ask) and the mockup's accent-coloured user bubbles (the real docked panel renders `threadView` under `data-bot-accent`, `Shell.tsx:3511`, `:5245`, mapped in `styles.css:53-56`).
- **Cuts accepted:** `presetIsReadOnly` and the Granola change (Devin-only enforcement); connect-and-land for every `requiresAgent` preset (Devin only, through its own dialog); `McpServer.credentialRejectedAt` (state derived from `DevinConnectionState`); the page's own fetch/upsert/delete (one refresh operation with a fenced lease, shared by worker and page); the attention → info → retry fallback (platform-event policy with `skipRateLimits` and the `help` preference, as `notifyThreadEvent`); `orgName` (the header has no meta but the stale clock); "Answer in Devin" (the row is the one link); "fix every banner destination" as a deliverable (the shared handler change remains a side effect); S0 and S9 as slices (verification is in every slice).
- **Corrections applied:** real redacted Devin responses are a prerequisite of the parser (S1 first) and `isError` results throw; the key is an organization service-user key; a narrow owner-authorized management path (`devin.connect/adopt/replaceKey/disconnect`) with a `manage` flag instead of broadened MCP APIs; connector-gone handling (GAP-53); explicit adoption of existing private rows, state-row initialization, uniqueness on create, update and enable; per-row baseline with real message identity and no alert, recovery from a failed read without a second alert, crash-safe recording with `deduped` counted; fenced lease with token and version and a `revision` check before commit; messages fetched only on change; incomplete listings never delete rows or suppress alerts, and "Some sessions could not be read." is distinct from empty; page and count refresh by periodic shared reads while visible plus focus, count scoped to the active connection, "within about three minutes" instead of "at once"; `devinSessionUrl`/`isDevinSessionUrl` used in persistence and every opener; 401 vs listing-403 vs session-403; a refused replacement changes nothing and a successful one clears the cache; slice dependencies repaired (contracts land with their implementations in S3b; job type, schema and handler together in S3a; catalogs owned per slice; no phantom S2b; the `ErrorNotice` action variant owned with its story in S4a); GAP-48 to GAP-54 and the mockup revision per report added to the evidence.
- **Mockup disagreements resolved** to the lead's target (table above); the Playwright spec asserts the unclamped question and the compact list in a real browser.
- **Own claim corrected:** round 1 said `/app/devin` would "still return null" in the mobile parser; it is parsed as a bot id (`notification-open.ts:56-61`). Devin pushes carry the session URL, checked before that branch, so the fallback is unchanged and irrelevant to them.
- **Rejected from the review:** nothing else. The two Devin documentation claims (organization header for other `cog_` keys; 403 as insufficient permission) were not fetched here and are recorded as the review's citations.

## Research claims corrected

- Neither research note recorded that `createNotification` rejects every link that is not an in-app path (`packages/db/src/notifications.ts:53-55`, `:79-81`). Design 5 adds `externalLink`.
- Discovery item 3 says `PAGE_AGENT_COLOR` and `sidebar-folders.ts` need a Devin entry. They do not: the Devin agent is an integration agent coloured by `APP_COLOR.devin` (`agent-colors.ts:17`), and `sidebar-folders.ts` already handles `isIntegrationAgentSpawnKey`.
- The catalog says the Integrations "Reconnect" is unreachable for Devin. It is also wrong when reached: `useMcpReconnect` runs OAuth (`useMcpReconnect.ts:17-22`), and `CustomConnectionDialog.createServer` returns the existing server when the endpoint matches (`:255-258`), so pasting a new key today keeps the old one. The Devin dialog uses the Devin RPCs instead.
- The catalog's GAP-07 fix (bot id in the push) is superseded by the requester's decision; the code claim behind it is confirmed (`notification-open.ts:56-61`).
- The codebase research locates the Devin forced writes at `devin.ts:32-34`; the list is `:31-38`. No design impact.
