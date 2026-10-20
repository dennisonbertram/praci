# Devin page

Status: plan, first round; no code yet. Line numbers refer to branch `docs/devin-handoff` at 6db06cc11 when written (read with `git show`). Slices start from `origin/main` once this branch merges; each child names its base. Approved design: `docs/devin/mockup.html` (v3, the frames after the requester's scope change). UX evidence: `docs/devin/ux-paths/catalog.md` (gap register GAP-01 to GAP-47), `docs/devin/ux-flow/report.md`, `docs/devin/ux-flow/redundancy.md`, `docs/devin/ux-walker/docs/devin/ux-walker/latest-report.md`. Built on the Legal page pattern, the integration-agent gate, `createNotification`, the remote MCP client and graphile-worker that already exist; the plan adds two small tables, one nullable column, one RPC namespace and one recurring job. No new dependency, no new provider interface.

## Summary

Devin is a sidebar page at `/app/devin`, like Legal, with the Devin agent docked beside it. The page is read-only: it lists the Devin org's sessions in one table (Session, Status, Pull request, Source, Updated) with two tiles above it, "Needs you" and "Working". Rows that wait on a person show Devin's question on up to two lines and an "Answer in Devin" link that opens the session in Devin. Rakazo never launches, replies to or stops a session; the "Allow changes in Devin" option and every Devin write tool go away. One Devin connection serves the whole space: a space owner pastes the service-user key once, every member sees the page, and the member who connected is the one whose Devin agent answers in the panel and who is notified.

Nothing happens on Devin's side without the user: a server-side poll reads the session list every two minutes per connected space, keeps the last-seen state of each session in Postgres, and when a session turns "waiting for the user" it creates one normal Rakazo notification for the connector whose link is the Devin session itself. The sidebar shows the live count of sessions that need someone, computed from that stored state, not from unseen notifications. The page refetches when the window regains focus; there is no refresh button, and the header shows "Updated 4m ago" only when the data is stale. A revoked key marks the connection rejected so the Integrations card says "Needs reconnect" and the page offers Reconnect; a rate limit backs the poll off and the page keeps the last good rows.

Not built: launching, replying or stopping sessions; a native mobile screen (a push opens the Devin session in the phone's browser); repo-docs and wiki tools on the page; ACU or cost views; a second Devin org per space; a shared agent chat for members who did not connect. Reasons under "Not in this epic".

## User story

From the framing (2026-10-20, after the scope change):

- **Simpler.** No switching to Devin to check whether Devin is done or stuck; the page says it in one glance, and the sidebar count says it from anywhere in Rakazo.
- **Faster.** When Devin is blocked on a question, the founder is told at once, with a link that lands on the session where the answer goes, instead of discovering hours later that Devin sat idle.
- **Trustworthy.** Rakazo only reads. There is no control in Rakazo that spends Devin credits or changes a session, so nothing on this page can be done by accident, and other agents cannot be talked into it.

Shipped experience: a space owner opens Integrations, pastes the Devin key, and lands on the Devin page; the page shows every session with its status, PR and source; a teammate opens the same page and sees the same list; when Devin asks a question, the connector gets a toast, an OS banner or a phone push whose click opens that session in Devin; after they answer there, the row leaves "Needs you" on the next focus or poll; the connector can ask the docked Devin agent for history ("what did Devin merge in acme/api this week?"); a revoked key shows one notice with Reconnect on the page and "Needs reconnect" on the card.

Each slice below names the story point it serves.

## Current state (verified)

Every claim here was checked by opening the file at 6db06cc11.

| Area | Fact |
|---|---|
| Devin contract | `packages/contracts/src/devin.ts`: `DEVIN_MCP_ENDPOINT`, `isDevinEndpoint` (`:5-13`), `DEVIN_READ_TOOLS` (`:16-26`: wiki tools, `ask_question`, `list_available_repos`, `devin_session_search`, `devin_session_events`, `devin_session_gather`, `devin_list_integrations`), `DEVIN_WRITE_TOOLS` (`:32-38`: `devin_session_create`, `devin_session_interact`, three `*_manage` tools). `INTEGRATION_PRESETS.devin` (`packages/contracts/src/integration-agent.ts:241-250`): `reads`, `forcedWrites`, `allowedTools` = reads plus writes, `requiresAgent: true`; instructions tell the model to start and message sessions. `integrationPresetForEndpoint` (`:285-294`). |
| MCP gate | `integrationAgentDenial` (`packages/adapters/src/mcp-connector.ts:129-149`): with `requiresAgent` and no valid linked agent everything is denied; the agent gets reads always and writes only while `writesEnabled`. `assignmentAllowsTool` (`:163-176`) then applies the preset's closed `allowedTools`; it runs at discovery (`:289`) and immediately before the call (`:494`). `callServerTool` (`:564-598`) calls one tool on a stored server outside a bot run; the MCP session loads the server's `Secret` with `where: { id: server.secretId, spaceId: context.spaceId, userId: context.userId }` (`:763-769`), so a call only works in the row owner's scope. `listServerTools` (`:603-620`). `createFinanceCallToolFor` (`packages/adapters/src/finance-call-tool.ts:27-47`) is the precedent for a server-side caller: it loads the row by id, builds the context from the row's own `spaceId` and `userId`, and refuses any tool outside a fixed list. Errors reach callers as `new Error(sanitizeConnectorError(error))` (`mcp-connector.ts:589-597`), text only; no status code field. |
| Connection rows | `McpServer` (`packages/db/prisma/schema.prisma:1447-1488`): `spaceId`, `userId`, `endpoint`, `secretId`, `enabled`, `writesEnabled`, `agentBotId`, `agentExclusive`, `agentProvisionedAt`; unique `(spaceId, userId, slug)`. No health or status column. `mcpServerDto` (`apps/api/src/router.ts:652-676`) exposes `oauthStatus` from the OAuth material only, so `mcpStatus` (`apps/web/src/lib/integrations.ts:54-58`) says "connected" for an API-key server whatever the key does. `mcp.servers.list` (`router.ts:4779`) is scoped to `spaceId` and `userId`. `mcp.servers.create` (`:4814-4930`): for a `requiresAgent` preset it lists the server's tools fresh and deletes the row and secret on failure with "Could not connect to {Service}. Check the API key and try again." (`:4863-4883`), then `ensureIntegrationAgent` (`:4888-4896`) and marks the server exclusive, provisioned, writes off (`:4901-4916`). `mcp.servers.update` accepts `{ id, secret }` to replace a stored credential (`packages/contracts/src/rpc.ts:960-967`). `mcp.servers.setWrites` (`router.ts:5109`) calls `setIntegrationAgentWrites`. `mcp.servers.remove` (`:5121-5169`) archives the agent with the server. |
| Integration agent | `ensureIntegrationAgent` (`apps/api/src/integration-agent.ts:306-420`): idempotent through the unique `(spaceId, spawnKey)` index, spawn key `integration-agent:<serverId>`, bot name `"{Service} agent"`, description `"Your {Service} account"`, colour `appAgentColor` (`APP_COLOR.devin` = 3, `packages/contracts/src/agent-colors.ts:14-17`), link transaction locks the bot row. `isIntegrationAgentForServer` (`packages/contracts/src/integration-agent.ts:52-79`) requires the bot's `spaceId` and `userId` to equal the server's. Bots are listed per space and user (`repos.listBots`, `packages/db/src/repos.ts:291-297`); a `Thread` has one `botId` (`schema.prisma:582`). |
| Space roles | `SpaceMember.role` (`schema.prisma:302`, default `"member"`). `requireSpaceOwner` and `isSpaceOwnerRole` (`apps/api/src/space-owner.ts:5-16`) are the existing owner check, used by agent secrets and memory-provider settings. `Actor` carries `spaceId`, `userId`, `email`, `isDeploymentOwner` (`packages/contracts/src/ids.ts:12`). |
| Notifications | `createNotification` (`packages/db/src/notifications.ts:91-161`): dedupe 24 h on `(space, user, bot, dedupeKey)` under an advisory lock; limits per agent and user `perHour: 5, perDay: 20, attentionPerHour: 2` (`:19`), skipped with `skipRateLimits`; `attention` queues one delivery per external channel 30 s out. **`validate` rejects any `link` that is not an in-app path** (`isInAppPath`, `:53-55`, `:79-81`). `Notification` (`schema.prisma:1347-1375`) has `surface`, `link`, `kind`, `dedupeKey`. `defaultNotificationSurface` (`packages/adapters/src/notify-user.ts:12-19`) has no `devin` entry. `notifications.glance` (`router.ts:7822-7836`) returns `financeRunwayMonths`, `legalDueSoon`, `dataRoomWaiting`, `botKinds` (`rpc.ts:1289-1297`); the web `EMPTY` literal mirrors it (`apps/web/src/lib/use-sidebar-glance.ts:34-39`). `surfaceOfPath` is a closed list (`:8-13`). Expo push data carries `surface`, `link`, `botId` (`packages/adapters/src/expo-push.ts:75-77`). `notificationEvents.notify` publishes a realtime signal (`packages/db/src/notification-live.ts:18-22`); the worker builds one (`apps/worker/src/index.ts:105`). |
| Notification clicks | Web OS banner: `shown.onclick = () => window.focus()` (`apps/web/src/lib/notification-delivery.ts:62-65`), the link is never opened. Toast: `NotificationToaster onOpen={navigate}` (`apps/web/src/components/AppToaster.tsx:110`; `onOpen(href)` in `packages/ui-web/src/components/ui/notification-toaster.tsx:104-106`), so an `https:` link would be handed to the router. Electron: `setWindowOpenHandler` and `will-navigate` send any foreign URL to `shell.openExternal` (`apps/desktop/src/main.ts:268-285`), so a `window.open` of an `https:` link from the web UI already opens the system browser. Mobile: `notificationOpenTarget` (`apps/mobile/lib/notification-open.ts:37-64`) parses `link` as `/app/<botId>`, so `/app/devin` would open a bot named "devin"; `openNotificationResponse` (`apps/mobile/lib/open-notification.ts:36-79`) only `router.push`es; `Linking.openURL` is already used elsewhere in the app (`apps/mobile/app/thread.tsx:3587`). |
| Jobs | `RECURRING_JOBS` (`packages/adapters/src/wakeup.ts:94-102`) is the graphile-worker cron list; handlers are the map in `createBackgroundJobHandlers` (`packages/adapters/src/background-job-handlers.ts:57-330`), payloads are typed in `packages/adapter-kit/src/background-jobs.ts` (`"cloud_agent.poll"` `:35`, `"finance.sync"` `:50`). The worker has an `McpConnector` (`apps/worker/src/index.ts:126`) and passes `createFinanceCallToolFor(prisma, mcp)` to the handlers (`:268`). Lease pattern: `pollCloudAgent` claims with `updateMany` on `version` and `leaseExpiresAt` (`packages/adapters/src/cloud-agent-poll.ts:28-37`). `mail-sync-job.ts` throttles and backs off with timestamps in Postgres. |
| Page pattern (web) | Route `apps/web/src/App.tsx:216` (`/app/legal`); `legalMode` (`apps/web/src/pages/Shell.tsx:914`), bot lookup `findLegalAgent` (`:955-956`), `createLegalAgent`/`askLegalAgent` (`:2945-2961`), `agentPanel` Legal entry (`:3066-3077`), `pageAgentNeedsModel` (`:3099`), `appPages` (`:1945-1962`, Cap table has `keywords`), `hiddenPages` (`:1906`), `SidebarPageLink` Legal (`:4004-4021`, `glanceBadge` from `apps/web/src/components/sidebar-glance.tsx:10-45`: `unseen > 0` draws the dot, else `value` draws a number), page render (`:5123-5133`). `LegalPage` (`apps/web/src/pages/Legal.tsx:36-60`) wraps `FinanceChromeProvider` and an `@container`; `Legal` refetches on focus and visibility (`:109-121`), shows `ErrorNotice` on a failed first load and "Could not refresh" with rows kept (`:155-158`, `:244-246`), `Kpi` tiles in `grid-cols-2 @3xl:grid-cols-4` (`:264-272`), `LegalSkeleton` (`:428-440`). `LegalContracts` (`apps/web/src/pages/legal/LegalContracts.tsx:86-130`) renders a stacked `<ul>` below `@4xl` and a `<Table>` with fixed `colgroup` widths from `@4xl`. `ErrorNotice({ message, onRetry })` renders "Try again" (`apps/web/src/components/finance/ui.tsx:403-412`). Tests: `Legal.test.tsx` mocks `../lib/rpc`; `Legal.stories.tsx` uses `mockRpc`; `apps/web/e2e/legal.spec.ts` routes `**/rpc/legal/**` with fixtures and `captureScreenshot`. |
| Integrations (web) | Devin tile `apps/web/src/lib/integrations.ts:143-150` (`apiKey: true`, letter logo). Subtitle "Coding sessions and repo docs" (`IntegrationsHome.tsx:377`), key hint "An org-scoped Devin service-user key (starts with cog_)." (`:443`), `?connect=<id>` opens the first-party dialog (`:436-462`), `returnTo` is followed when the dialog closes (`:838-843`). Carta's card has an "Open Cap table" link (`:124-125`); Reconnect runs `useMcpReconnect` → `connectMcpOauth` (`apps/web/src/components/integrations/useMcpReconnect.ts:17-22`), which fails for an API-key server with "This server did not ask for a sign-in.". `CustomConnectionDialog.createServer` returns the existing server when the endpoint matches (`CustomConnectionDialog.tsx:255-258`), so pasting a new key for a connected Devin keeps the old key; the done view says "{serverName} connected" and "Done" (`:865-876`). `McpDetail` shows `IntegrationAgentSection` with the "Allow changes in {service}" switch for every server with an agent (`McpDetail.tsx:246-256`; `IntegrationAgentSection.tsx:33`). |
| Skill | `devin-sessions` (`packages/adapters/src/builtin-skills.ts:177-211`) tells the agent to start sessions, set ACU limits, send follow-ups with `devin_session_interact` and to suggest "Allow changes in Devin". The web demo fixture (`apps/web/src/demo/fixture.json:95`) embeds skill descriptions. |
| Devin MCP (research, `scratchpad` field check 2026-10-20, no tool called) | Every tool returns one text string; fields are omitted when empty. `devin_session_search`: `id`, `title`, `status` (`status_detail`), `created_at`/`updated_at` (unix seconds), `tags`, opaque `user_id`, `origin` (webapp, slack, teams, api, linear, jira, automation, cli, desktop, code_scan, other), PRs as `url[state]` list, `acus_consumed`, `playbook_id`; filters but no status filter; paging `first` ≤ 100 with `after`. `devin_session_interact` `get` adds `url`, `structured_output`, `summary`; `get_messages` returns `source`, `created_at`, `event_id`, `body` (truncated). No repo field, no user name, the question is not a field. `devin_session_gather` blocks up to 590 s. Exact line format, `get_messages` output and `status`/`status_detail` values are unverified. |

## Design

### 1. One Devin connection per space

The space's Devin connection is the one enabled `McpServer` in the space whose endpoint `isDevinEndpoint`, whoever created it. No new sharing model: the row keeps its `userId` (the connector), and every space-wide read runs in the connector's scope, the way Finance sync runs in the row owner's scope (`createFinanceCallToolFor`, `finance-call-tool.ts:35-45`). The lookup is `findDevinServer(prisma, spaceId)`: `mcpServer.findMany({ where: { spaceId, enabled: true, endpoint: { contains: "mcp.devin.ai" } } })` filtered with `isDevinEndpoint`, oldest first.

Rules, all enforced in `apps/api`:

- **One per space.** `mcp.servers.create` with a Devin endpoint rejects a second one with `ORPCError("CONFLICT", "Devin is already connected in this space")`, checked inside the create transaction after an advisory lock on `devin-connect:<spaceId>` so two owners cannot race.
- **Owners add and remove.** `mcp.servers.create`, `update` and `remove` call `requireSpaceOwner` (`apps/api/src/space-owner.ts:10`) when the endpoint is Devin's. Members who are not owners get `FORBIDDEN`; the page hides Connect Devin for them (`canConnect: false`). This reuses the only space-role check the codebase has.
- **Everyone reads.** `devin.sessions` needs only an authenticated member of the space; it never reveals the key, and the Integrations card and detail page stay visible to the connector only (they are listed by `mcp.servers.list`, scoped to the user).
- **One agent, the connector's.** The Devin agent is the server's integration agent (`ensureIntegrationAgent`), owned by the connector. Bots are per user and an MCP session can only load the secret in its owner's scope (`mcp-connector.ts:763-769`), so a teammate's run cannot use the connection. Decision: the docked panel and the Ask button appear for the connector only; other members get the page without Ask. A shared chat for every member is under "Not in this epic".
- **Removal.** `mcp.servers.remove` already archives the agent; it now also deletes the Devin state rows by cascade (`DevinSession.serverId` and `DevinConnectionState.serverId` reference `McpServer` with `onDelete: Cascade`). Every member's page returns to Not connected.

Why not alternatives: a new `SpaceConnection` or a shared `Secret` would be a second connection model for one integration; the existing `Connection`/`BotConnectionAccess` are for connected apps and still per user.

### 2. Read path: one RPC, one table

`devin.sessions` (`packages/contracts/src/rpc.ts`, handler in `apps/api/src/devin.ts`, following `legal.ts` with `legalDeps`) returns everything the page, the tiles and the sidebar need from one result (GAP-08):

```ts
DevinSessionsOutput = {
  connection: {
    status: "none" | "ok" | "rejected" | "unreachable" | "rate_limited",
    canConnect: boolean,          // space owner and not connected
    isConnector: boolean,         // the actor owns the connection row
    agentBotId: string | null,
    orgName: string | null,       // see Open questions
  },
  fetchedAt: string | null,       // last successful read from Devin
  stale: boolean,                 // rows come from the table, not from this call
  skipped: number,                // lines the parser could not read
  sessions: DevinSession[],       // Needs you first, then newest Devin update first
}
DevinSession = {
  id, title, kind: "needs_you" | "working" | "finished" | "error" | "suspended" | "unknown",
  status, statusDetail: string | null, question: string | null, url: string,
  prs: { url: string; state: string }[], origin: string, updatedAt: string,
}
```

Flow of `devinSessions(deps, actor)`:

1. `findDevinServer`. None → `connection.status: "none"`, `sessions: []`.
2. Read `DevinConnectionState` for the server. If `credentialRejectedAt` is set on the server → `"rejected"` with stored rows. If `backoffUntil` is in the future (429) → `"rate_limited"` with stored rows, `stale: true`. If `lastSucceededAt` is within 30 s → stored rows, `stale: false` (a focus refetch right after a poll costs nothing).
3. Otherwise call `devin_session_search` through `createDevinCallTool` (Design 3) with a 15 s `AbortSignal`, paging with `after` until no cursor (safety cap 10 pages, see Open questions); parse with `parseDevinSessionSearch`; upsert `DevinSession` rows; delete rows of this server not seen in this listing (only when the listing completed); set `lastSucceededAt`; return `stale: false`.
4. On error: classify with `devinFailureOf(error)` (Design 7); record it; return stored rows with `stale: true` and the status. A failed first read with no rows is an error state on the page; a failed refresh keeps the rows.

Only `devin_session_search` is called from the page path. Question text and session URL come from the table (filled by the poll, Design 4); a needs-you row without a question yet shows its title alone. The client computes the tiles from `sessions` (`needs_you` count, `working` count) so the tile, the badges and the sidebar never disagree (GAP-05, GAP-08).

**Parser.** `packages/adapters/src/devin-sessions.ts`, pure: `parseDevinSessionSearch(text)` → `{ sessions, skipped, nextCursor }`, `parseDevinMessages(text)` → `{ messages: { source, createdAt, eventId, body }[] }`, `devinKindOf(status, statusDetail)`. Every field is optional; a line without an `id` is skipped and counted (GAP-27); an unknown status maps to `unknown` with its raw text (GAP-03). The exact text format is unverified, so the parser is written against invented fixtures that follow the field list in the research note and S2 replaces them with lines captured from a real key (secrets and real titles redacted) when one is available.

**Table.** Two additive models in `packages/db/prisma/schema.prisma`, one migration:

```prisma
model DevinConnectionState {
  serverId        String    @id
  server          McpServer @relation(fields: [serverId], references: [id], onDelete: Cascade)
  spaceId         String
  baselinedAt     DateTime?   // first complete poll; before it, nothing notifies
  lastPolledAt    DateTime?
  lastSucceededAt DateTime?
  backoffUntil    DateTime?   // 429 or unreachable
  lastError       String?     // "rejected" | "unreachable" | "rate_limited"
  leaseUntil      DateTime?   // poll claim across worker processes
  skipped         Int       @default(0)
  @@index([spaceId])
}

model DevinSession {
  id                String    @id @default(cuid())
  serverId          String
  server            McpServer @relation(fields: [serverId], references: [id], onDelete: Cascade)
  spaceId           String
  sessionId         String    // Devin's id
  title             String
  status            String
  statusDetail      String?
  kind              String    // needs_you | working | finished | error | suspended | unknown
  question          String?   // ≤ 500 chars, Devin's last message while waiting
  url               String?   // from devin_session_interact get, when read
  prs               Json      @default("[]")
  origin            String
  devinUpdatedAt    DateTime
  lastMessageId     String?   // event_id of Devin's latest message, when read
  notifiedMessageId String?   // the message a notification was sent for
  lastSeenAt        DateTime
  @@unique([serverId, sessionId])
  @@index([spaceId, kind])
}
```

Plus one nullable column `McpServer.credentialRejectedAt DateTime?` (generic: any API-key server can use it) and `credentialRejected: z.boolean()` on `McpServerSchema` (`packages/contracts/src/domain.ts:849`). Why a table and not a cache: the poll needs the last-seen state per session for the silent baseline and for dedupe, the sidebar count must not call Devin on every page change, and several API and worker processes must agree; Postgres is the only shared store the repo allows for that. Not reused: `CloudAgent` tracks launches Rakazo made and carries lease, followup and launch columns the page never uses.

### 3. Question text is read server-side only; the agent loses `devin_session_interact`

Decision (GAP-01, decision 6 in the catalog): the page and the poll read `devin_session_interact` with `action: "get"` and `action: "get_messages"` through a server-side caller; the agent does not get the tool at all.

- `createDevinCallTool(prisma, mcp)` in `packages/adapters/src/devin-call-tool.ts`, modelled on `createFinanceCallToolFor`: loads the row by id, builds the `AdapterContext` from the row's own `spaceId` and `userId`, and allows exactly `devin_session_search` and `devin_session_interact` whose `action` argument is `get` or `get_messages`; any other name or action throws before `callServerTool`. The argument check lives in the caller, so no change to `isReadTool` or the connector is needed.
- The Devin preset's `allowedTools` becomes `DEVIN_READ_TOOLS` only. `assignmentAllowsTool` refuses every write at discovery and before the call (`mcp-connector.ts:171`), whatever the row's `allowAllTools` says, so the agent is never offered `devin_session_interact` and never sees an approval card for it. `forcedWrites` keeps `DEVIN_WRITE_TOOLS` so the gate still classifies them as writes if a row ever lists them.
- The agent therefore cannot read a session's messages. Its skill says so in one line and points at the Devin page, which shows the question (GAP-31). The alternative, an argument-aware read classification in the gate so the agent could call `get_messages` without a card, is under "Not in this epic".
- `devin_session_events` stays a read for the agent. Whether it returns message bodies is unverified; if it does, S2 may use it instead of `get_messages` (Open questions).

### 4. Needs-you detection and the notification

Devin has no webhooks. One recurring job, `devin.poll` (`RECURRING_JOBS`, `*/2 * * * *`), runs `pollDevinConnections(deps)` in `packages/adapters/src/devin-poll.ts`:

1. List candidate servers: enabled, `isDevinEndpoint`, `credentialRejectedAt: null`, state `backoffUntil` null or past.
2. Per server, claim with `updateMany where { serverId, OR: [{ leaseUntil: null }, { leaseUntil: { lt: now } }] } set leaseUntil = now + 90 s` (the `pollCloudAgent` pattern); zero rows means another worker has it. No transaction is held across HTTP.
3. `devin_session_search`, all pages; parse; upsert `DevinSession`; delete unseen rows when the listing completed; `skipped` recorded.
4. For every row with `kind = needs_you`: if `baselinedAt` is null, set `notifiedMessageId = lastMessageId ?? "baseline"` and continue (silent baseline, GAP-02). Else call `get_messages` (and `get` once when `url` is null) through the restricted caller; store `question` (Devin's latest message body, ≤ 500 chars), `lastMessageId` (its `event_id`) and `url`. When `lastMessageId !== notifiedMessageId`, create the notification (below) and set `notifiedMessageId`. If `get_messages` fails, use `devinUpdatedAt` as the surrogate message id so one transition still notifies once.
5. Set `baselinedAt` after the first complete poll; `lastPolledAt`, `lastSucceededAt`; clear the lease.
6. On error, classify (Design 7): `rejected` sets `McpServer.credentialRejectedAt` and the server drops out of the candidate list until a new key clears it; `rate_limited` sets `backoffUntil` to now + 10 min, doubling per consecutive 429 up to 1 h; `unreachable` sets `backoffUntil` to now + 5 min.

The first poll runs right after `mcp.servers.create` (the handler enqueues one `devin.poll` job for that server with `runAt: now`), so the baseline exists before the user sees the page and the needs-you rows get their question text within seconds, not minutes.

**Notification** (`createNotification`, `packages/db/src/notifications.ts:91`):

- Recipient: the connector (`server.spaceId`, `server.userId`), `botId: server.agentBotId`, `surface: "devin"`, `importance: "attention"`, `kind: "needs_input"`.
- Title "Devin has a question"; body `"{session title}: {question}"` cut to 200 characters; when the question is unknown, body is the title alone.
- `externalLink`: the session's `url` from `get`; when `get` failed, `devinSessionUrl(id)` (Assumptions). Never an in-app path: the Rakazo page is where everything is seen, the alert points at where the answer goes (decision).
- `dedupeKey: "devin:<sessionId>:<messageId>"`, so a second question in the same session notifies again and two sessions never merge (GAP-06).
- Overflow: `attentionPerHour` is 2 per agent and user. When `createNotification` returns `rateLimited`, the poll calls it again with `importance: "info"` (dot only, same key); if that is rate-limited too (`perHour` 5), `notifiedMessageId` stays unset and the next poll retries. Nothing is dropped for good; the page is the record either way.
- After `created`, `notificationEvents.notify(owner, { id, surface, importance })` so the open tab toasts and the sidebar count refreshes at once.

Cadence: 2 minutes per connected space is an assumption; Devin's rate limits are unconfirmed (Open questions). One search call per poll per space, plus one or two interact calls per newly blocked session.

### 5. Notification links can be external, and clicks open them

`createNotification` validates `link` as an in-app path (`isInAppPath`, `notifications.ts:53-55`), and must keep doing so for `notify_user`, where the link comes from the model (`notify-user.ts:60`). Change: `CreateNotificationInput` gains `externalLink?: string`, accepted only when it parses as a URL with protocol `https:` and no credentials; it is stored in the same `link` column. `notify_user` never sets it, so a model cannot produce an external link; only server code can. Clients:

- **Toast** (`AppToaster.tsx:110`): `onOpen={openNotificationLink(navigate)}`, a helper in `apps/web/src/lib/notification-delivery.ts`: `isExternalLink(href)` → `window.open(href, "_blank", "noopener,noreferrer")`, else `navigate(href)`.
- **OS banner** (`notification-delivery.ts:62-65`): `show(title, { body, tag, data: { href } })` and `onclick = () => { window.focus(); if (href) open(href); }` with `open` a new `DeliveryDeps` member defaulting to `openNotificationLink`. This also makes every existing in-app notification's banner click land on its page (GAP-11).
- **Electron**: nothing to change; a foreign `window.open` is sent to `shell.openExternal` by the existing handler (`main.ts:268-278`).
- **Mobile** (`apps/mobile/lib/notification-open.ts`): `notificationOpenTarget` returns `{ kind: "external", url }` when `link` starts with `https://`; `openNotificationResponse` (`open-notification.ts`) calls `Linking.openURL(url)` for it, then `markSurfaceSeen(surface)`. The push payload already carries `link` and `surface` (`expo-push.ts:75-76`). The `/app/<botId>` fallback no longer matches `/app/devin` because Devin notifications carry an external link; the fallback itself is unchanged.
- Registries: `defaultNotificationSurface` gains `devin` for the Devin agent's spawn key (the agent is an integration agent, so the mapping checks `isDevinEndpoint` on its server; done in `apps/api` where the server is known, see S4), `surfaceOfPath` gains `devin`.

### 6. Sidebar, search, panel

- `SidebarPageLink` "Devin" between Data room and Artifacts (mockup), `testId="sidebar-devin"`, `current={devinMode}`, icon `Bot` from lucide, always shown (like Cap table; GAP-37) and hideable through `hiddenPages` with key `devin`.
- Glance: `notifications.glance` gains `devinNeedsYou: z.number().int()` = `prisma.devinSession.count({ where: { spaceId, kind: "needs_you" } })`, space-wide and from Postgres only. The badge is `glanceBadge({ unseen: 0, rail, value: n > 0 ? String(n) : undefined, valueLabel })`: the live count drives the row, like Legal's due-soon count; the unseen-notification dot is deliberately not used for Devin (GAP-05, GAP-16). The page still marks the `devin` surface seen on open as every page does.
- `appPages` gains `{ id: "devin", label: "Devin", keywords: "sessions, coding, pull requests, Cognition" }`; the page result sorts before the "Devin agent" bot because pages are listed first (GAP-46).
- `devinMode = useMatch("/app/devin")`; route in `App.tsx`. On entering the page the Shell calls `rpc.devin.agent()` once (the Cap table's auto-create pattern), which returns `{ bot: Bot | null }`: the connector's agent (created idempotently through `ensureIntegrationAgent`) or null for a non-connector or when not connected. `active = bots.find((b) => b.id === devinAgent?.id)`. `agentPanel` entry `{ name: "devin-agent", testId: "devin-agent-panel", open: devinAgentOpen, collapseLabel: "Collapse Devin agent", create: createDevinAgent, createLabel: "Create Devin agent", creating, error }`. Closed until Ask (GAP-29); Ask is passed to the page only when `isConnector` and the panel is closed (Legal's rule). `pageAgentNeedsModel` covers it through `agentPanel !== null`.
- No `PAGE_AGENT_COLOR` entry: the Devin agent is an integration agent and already gets `APP_COLOR.devin`.

### 7. Errors

One helper, `devinFailureOf(error): "rejected" | "rate_limited" | "unreachable"` in `packages/adapters/src/devin-call-tool.ts`, matches `HTTP 401` or `HTTP 403` → `rejected`, `HTTP 429` → `rate_limited`, anything else → `unreachable`, on the sanitized error text (the connector exposes no status field; the MCP SDK's transport error text carries `(HTTP <status>)`, an assumption S2 confirms with a fake server).

| Condition | Server | Integrations card | Page |
|---|---|---|---|
| 401/403 from search or interact | `McpServer.credentialRejectedAt = now`; poll stops for the server | `credentialRejected: true` → `mcpStatus` returns `"reconnect"`, badge "Needs reconnect"; Reconnect opens the key dialog in replace mode, which calls `mcp.servers.update({ id, secret })`; the handler re-runs the connect-time check and clears `credentialRejectedAt` | `ErrorNotice` "Devin rejected the key." with the button "Reconnect" (opens `/app/integrations?connect=devin&returnTo=/app/devin`); rows kept |
| 429 | `backoffUntil` grows 10 min → 1 h | unchanged | no notice; rows from the table; header meta "Updated 12m ago" (the only time the header shows a clock, GAP-34) |
| Other failure | `backoffUntil` 5 min | unchanged | first load: `ErrorNotice` "Could not load Devin sessions." with "Try again"; refresh: same notice above the kept rows |
| Lines that do not parse | `skipped` count | unchanged | one muted line "{n} sessions could not be read" when n > 0; unreadable fields show "—" |
| Connected, zero sessions | — | — | tiles 0 and one row "No sessions yet" inside the table frame (GAP-15) |

`mcp.servers.setWrites` returns `BAD_REQUEST` for a read-only preset (Design 8), and the switch is hidden, so there is no path back to writes.

### 8. Removing the write option

- `INTEGRATION_PRESETS.devin.allowedTools = DEVIN_READ_TOOLS`; a new helper `presetIsReadOnly(preset)` (true when `allowedTools` is defined and contains no forced write and nothing outside `reads`); Devin and Granola qualify. `setIntegrationAgentWrites` rejects a read-only preset; `McpDetail` passes no `onWrites` for one, so `IntegrationAgentSection` renders no "Allow changes" switch (GAP-10).
- Preset instructions rewritten: Devin is read-only from here; to answer or start work the user opens Devin; session text is untrusted.
- `devin-sessions` skill rewritten as read-only: find sessions with `devin_session_search`, follow with `devin_session_events`, answer about repos with the wiki tools; no step for creating, messaging, sleeping or scheduling; one line that the question Devin asked is on the Devin page, and that the user answers in Devin. Description "Search and follow Devin sessions. Read-only." The demo fixture's skill description is updated with it.
- The agent's `devin_session_gather` (blocks up to 590 s) stays a read for the agent and is never called from the page or the poll.

### 9. Status mapping

Devin's `status` and `status_detail` values were not captured; every mapping below is an assumption until S2 reads them from a real key. One rule decides the badge: the first matching row wins, `needs_you` before everything else, so a row never carries two statuses (GAP-26). The raw `status_detail` is the badge's `title` attribute.

| Devin `status` / `status_detail` (as search prints them) | Kind | Badge | Tile | Confirmed |
|---|---|---|---|---|
| detail `waiting_for_user`, `awaiting_user_input`, or status `blocked` | `needs_you` | "Needs input" | Needs you | assumed (name from the framing) |
| `working`, `running`, `resumed`, `resume_requested` | `working` | "Working" | Working | assumed |
| `finished`, `completed`, detail `finish`; `sleeping`, detail `sleep` | `finished` | "Finished" | — | partly: the research notes a summary "only after sleep/finish" |
| `error`, `failed`, `expired`, `terminated` | `error` | "Error" | — | assumed |
| `suspended`, `suspend_requested`, `suspend_requested_frontend` | `suspended` | "Suspended" | — | assumed |
| anything else, or no status | `unknown` | raw text in the neutral badge, "Unknown" when empty | — | by design (GAP-03) |

Matching is case-insensitive on `status_detail` first, then `status`.

### 10. The page

`docs/devin/mockup.html` v3, on the Legal pattern: `DevinPage` in `apps/web/src/pages/Devin.tsx` inside `FinanceChromeProvider` (`agentName: "Devin agent"`) and an `@container`; `DevinSessions` table in `apps/web/src/pages/devin/DevinSessions.tsx`; fixtures in `apps/web/src/pages/devin/fixtures.ts` (org "acme", repos acme/web, acme/api, acme/mobile, invented titles).

- **Header.** `PageHeader` title "Devin"; meta `SpaceName` (as Legal), the Devin org name when known (Open questions), and "Updated {relative time}" only when `stale` (GAP-34). Actions: `AskAgentButton` only when `isConnector` and the panel is closed. No "Open Devin" icon (decision: the row links and PR links cover it).
- **Not connected.** Header plus one card: for an owner, the button "Connect Devin" (to `/app/integrations?connect=devin&returnTo=/app/devin`); for a member, the line "A space owner can connect Devin in Integrations." No tiles, no table.
- **Tiles.** `Kpi` "Needs you" and "Working" in `grid-cols-2`, counted from `sessions`.
- **Table.** Columns Session, Status, Pull request, Source, Updated. Session: title (empty → "Untitled session", GAP-36) linked to `url` (`rel="noreferrer"`, `target="_blank"`); on a `needs_you` row the question under it, `line-clamp-2` (GAP-45), then the link "Answer in Devin" (GAP-20). Status: badge per Design 9. Pull request: `owner/repo#n state` for a GitHub URL, the host otherwise, first PR plus "+{n}" when several (GAP-35), "—" when none. Source: origin map webapp→"Web", slack→"Slack", teams→"Teams", api→"API", linear→"Linear", jira→"Jira", automation→"Automation", cli→"CLI", desktop→"Desktop", code_scan→"Code scan", else "Other". Updated: `formatRelativeTime(devinUpdatedAt)`. Sort: `needs_you` first, then newest (GAP-17); no filter, no sort control.
- **Narrow widths.** Exactly `LegalContracts`: a stacked `<ul>` below `@4xl` with the badge top right and label/value pairs, the `<Table>` with fixed `colgroup` widths from `@4xl`; tiles stay two across; the panel overlays below 1280 px as it does today (GAP-25; walker F-033-01, -02).
- **States.** Skeleton on first load only (`LegalSkeleton` shape: header, two tiles, table); rows kept during a refresh; empty, error and rejected per Design 7.
- **Refetch.** On `focus` and `visibilitychange` (Legal's hook), and on `rakazo:notifications-changed` so a needs-you notification refreshes the rows; no interval, no button (GAP-13).
- **Copy.** Every visible string is quoted under "Copy" below.

### API

`apps/api/src/devin.ts`, `DevinDeps = { prisma, jobs, repos, callDevin: ReturnType<typeof createDevinCallTool>, archiveBot }`:

- `devin.sessions` (Design 2).
- `devin.agent`: `{ bot: Bot | null }`; `ensureIntegrationAgent` for the connector, null otherwise.
- `devinNeedsYouCount` for `notifications.glance`.
- `mcp.servers.create`: the Devin branch adds the one-per-space check, `requireSpaceOwner`, one `devin_session_search` in the connect-time check beside `listServerTools` so a key without session access is refused at once (GAP-22), the `DevinConnectionState` row and the first `devin.poll` job.
- `mcp.servers.update({ id, secret })` for a Devin row: owner check, the same connect-time check, clear `credentialRejectedAt`, reset `backoffUntil`.
- `mcp.servers.remove`: owner check for Devin; cascade removes the state rows.
- `mcp.servers.setWrites`: `BAD_REQUEST` for a read-only preset.
- `mcpServerDto`: `credentialRejected: row.credentialRejectedAt !== null`.

### Security and tenancy

Every query filters on `spaceId`; `DevinSession` and `DevinConnectionState` carry `spaceId` and the page selects by the actor's space, never by a client-supplied server id. Calls to Devin run in the connection row owner's scope through `callServerTool`, exactly as Finance sync does; the key never leaves the secret store and never reaches the model (the agent has no `get`). The caller allows two tool names and two `action` values; everything else throws before the call. The agent's preset is a closed read allowlist, checked before every call, so no bot can create, message, sleep, terminate or tag a session through Rakazo, with or without "Always allow". Only space owners connect, replace or remove the connection. Notification external links are produced by server code from Devin's `url` or the id, validated `https:`; the `notify_user` tool cannot set one. Session titles, questions and tool text are rendered as text; only `https` URLs become links, with `noreferrer`. The poll holds no transaction across HTTP; leases, baselines and backoff live in Postgres.

## Copy

Each visible string, where it appears, and why it exists. Strings already in the app are marked existing.

| String | Where | Why |
|---|---|---|
| "Devin" | sidebar link, page title, search | The page's name; matches the tile. Existing word. |
| "Needs you" / "Working" | tiles | The two counts the page exists for; both from the mockup, "Needs you" matches the Activity list. |
| "Session", "Status", "Pull request", "Source", "Updated" | table head | Column names; "Source" instead of the mockup's earlier "From" because the value is an origin, not a person (redundancy H5). |
| "Needs input", "Working", "Finished", "Error", "Suspended", "Unknown" | status badge | One word per state; "Needs input" is the Activity list's row word for the same state (H3); "Unknown" names a status the mapping has not seen. |
| "Answer in Devin" | needs-you rows | Says where the answer goes; without it users look for a reply box (GAP-20). |
| "Untitled session" | Session cell | A session without a title still needs a row. |
| "Web", "Slack", "Teams", "API", "Linear", "Jira", "Automation", "CLI", "Desktop", "Code scan", "Other" | Source cell | Devin's origin values in plain words; "Other" covers unknown ones (GAP-36). |
| "+{n}" | Pull request cell | Several PRs in one slot (GAP-35). |
| "—" | empty cells | Existing dash convention (`LegalContracts`). |
| "Updated {time}" | header meta, only when stale | Says the rows are old; hidden when fresh (GAP-34). |
| "No sessions yet" | empty table row | Distinguishes an empty org from a failed load (GAP-15). |
| "Could not load Devin sessions." + "Try again" | `ErrorNotice` | One message for every non-auth failure; "Try again" is the component's existing button. |
| "Devin rejected the key." + "Reconnect" | `ErrorNotice` variant | The one failure the user can fix; the button goes to the key dialog (GAP-04, GAP-44). |
| "{n} sessions could not be read" | under the table | Tiles may undercount; silence would hide it (GAP-27). |
| "Connect Devin" | not-connected card (owner) | The one action; existing dialog title. |
| "A space owner can connect Devin in Integrations." | not-connected card (member) | Without it a member sees a bare page and asks around (STORY-031). |
| "Ask" | header | Existing `AskAgentButton`. |
| "Collapse Devin agent", "Create Devin agent" | panel | The panel pattern's two labels, as Legal has them. |
| "Devin has a question" | notification title | Short, names the sender; the body carries the session and question. |
| "{title}: {question}" | notification body | The one fact the user needs before clicking; ≤ 200 chars. |
| "Devin is already connected in this space" | API error | Explains a refused second connection. |
| "Open Devin" | Integrations card link | Mirrors Carta's "Open Cap table" so the connected card leads to the page (GAP-21). |
| "A Devin service-user key (starts with cog_). Create one in Devin under Settings." | key dialog hint | Replaces the existing hint; says where the key comes from (GAP-38; walker F-001-02). The "Settings" word links to Devin's key page (Open questions). |
| "Devin sessions are not affected." | remove dialog | One clause so removal is not mistaken for stopping work (GAP-43). |
| "Search and follow Devin sessions. Read-only." | skill description | Replaces "Start, brief and follow Devin sessions. Every session asks first.", which promised writes. |
| "{n} need you" | sidebar `valueLabel` | Accessible name of the glance count. |

Removed: "Allow changes in Devin" for Devin (switch hidden), "ACUs this week", "PRs open", the header external-link icon, the Integrations hint "org-scoped".

## Slices

Each is one PR from the branch that contains its prerequisites, about a day or less. Slices in the same wave share no file; sequential slices may touch `packages/contracts/src/devin.ts`, `packages/contracts/src/rpc.ts`, `apps/api/src/router.ts`, `apps/web/src/pages/Shell.tsx` and `apps/web/src/pages/Devin.tsx`, listed per slice. Postgres tests run with `VERIFY_DATABASE=1` and `DATABASE_URL`, like `apps/api/src/glance.postgres.test.ts`. Every new component ships with its `*.stories.tsx` and `pnpm design-system` regenerates `docs/design-system/components.md` in the slice that adds the component. CI is off on the fork, so the screenshot the PR links comes from a local Playwright run of the slice's e2e spec.

### S0. Commit the plan, the mockup and the UX docs

Docs only, already on `docs/devin-handoff`. Owns `docs/plans/devin.md` (this document), `docs/devin/mockup.html`, `docs/devin/ux-paths/`, `docs/devin/ux-flow/`, `docs/devin/ux-walker/`. Verify: no local paths or private data (a grep for home-directory paths over `docs/devin` and `docs/plans/devin.md` is empty).

### Wave 1 (parallel)

#### S1. Contracts: read-only preset, RPC shapes, skill

Story: Trustworthy.

- Owns: `packages/contracts/src/devin.ts` (`DevinSessionKind`, `DevinSessionSchema`, `DevinConnectionStatus`, `DevinSessionsOutputSchema`, `DevinAgentOutputSchema`, `DEVIN_PAGE_TOOLS`, `DEVIN_INTERACT_READ_ACTIONS = ["get", "get_messages"]`, `devinSessionUrl(id)`), new `packages/contracts/src/devin.test.ts`; `packages/contracts/src/integration-agent.ts` (Devin `allowedTools = DEVIN_READ_TOOLS`, rewritten instructions, `presetIsReadOnly`) and `integration-agent.test.ts`; `packages/contracts/src/rpc.ts` (`devin.sessions`, `devin.agent`, glance `devinNeedsYou`); `packages/contracts/src/domain.ts` (`McpServerSchema.credentialRejected`); `packages/contracts/src/index.ts` exports; `apps/web/src/lib/use-sidebar-glance.ts` (`EMPTY` gains `devinNeedsYou: 0`, `surfaceOfPath` gains `devin`) and `use-sidebar-glance.test.tsx` (the `quiet` literal and the path test); `packages/adapters/src/notify-user.ts` (`defaultNotificationSurface` is unchanged; the Devin mapping is done by the API where the server is known, see S4) is not touched; `packages/adapters/src/builtin-skills.ts` (the `devin-sessions` skill) and `apps/web/src/demo/fixture.json` (its description).
- Behaviour: `assignmentAllowsTool` (existing test file is S2b's) is not exercised here; the preset data is: `presetIsReadOnly(INTEGRATION_PRESETS.devin)` and `.granola` true, `.carta` and `.mercury` false; `isReadTool` still classifies `devin_session_interact` as a write; `devinSessionUrl("abc")` is `https://app.devin.ai/sessions/abc` (Assumptions); the skill body has no `devin_session_create`, `devin_session_interact`, `*_manage` or "Allow changes" text and keeps the search, events and wiki tools; `pnpm check` passes in `apps/web` with the new glance field.
- TDD, written first: `devin.test.ts`, `integration-agent.test.ts` (preset cases), `use-sidebar-glance.test.tsx` (`surfaceOfPath("/app/devin") === "devin"`).
- Regression test: `integration-agent.test.ts` "the Devin preset allows no write tool and is read-only".
- Verify: `pnpm --filter @rakazo/contracts test && pnpm --filter @rakazo/web test -- use-sidebar-glance && pnpm --filter @rakazo/adapters test -- builtin-skills && pnpm check`.

#### S3. Schema: Devin state tables and the rejected-credential column

Story: Faster (detection needs state), Trustworthy (multi-process).

- Owns: `packages/db/prisma/schema.prisma` (`DevinConnectionState`, `DevinSession`, `McpServer.credentialRejectedAt`, back-relations) and one new migration directory; `packages/db/src/index.ts` only if a type export is needed.
- Behaviour: `pnpm db:migrate` applies cleanly on an existing database; existing `McpServer` rows get `NULL`; deleting an `McpServer` cascades both tables (asserted in S4's Postgres test, since no `apps/db` Postgres test exists for schema alone).
- TDD: none beyond `pnpm --filter @rakazo/db generate`; the behaviour tests live in S4 and S6.
- Verify: `pnpm --filter @rakazo/db generate && pnpm db:migrate && pnpm check`.

#### S5. Notification links: external `https` links and clicks that open them

Story: Faster (the alert lands on the session). Independent of Devin; fixes banner clicks for every notification.

- Owns: `packages/db/src/notifications.ts` (`externalLink`, `isHttpsUrl`) and `packages/db/src/notifications.postgres.test.ts` (the existing suite; the validation cases need no database but live beside the create cases); `apps/web/src/lib/notification-delivery.ts` (`isExternalLink`, `openNotificationLink`, `DeliveryDeps.open`, banner `onclick`) and `notification-delivery.test.ts`; `apps/web/src/components/AppToaster.tsx` (`onOpen`); `apps/mobile/lib/notification-open.ts` (`{ kind: "external", url }`) and `notification-open.test.ts`; `apps/mobile/lib/open-notification.ts` (`Linking.openURL`).
- Behaviour: `createNotification` with `link: "https://example.test"` still throws; with `externalLink: "https://example.test/s/1"` it stores that value in `link`; `externalLink: "http://..."` or `"https://user:pw@host"` throws; `notify_user` has no way to pass `externalLink`. Web: a banner click with an in-app href focuses the window and navigates; with an `https` href it focuses and calls `window.open(href, "_blank", "noopener,noreferrer")`; the toast does the same through `openNotificationLink`. Mobile: `notificationOpenTarget({ link: "https://app.devin.ai/sessions/1", surface: "devin" })` returns the external target, `/app/devin` with no bot still returns null, existing bot and group cases unchanged; `openNotificationResponse` opens the URL and marks the `devin` surface seen.
- TDD, written first: `notification-delivery.test.ts` ("a banner click opens the notification link", "an https link opens a new window, an in-app link navigates"), `notification-open.test.ts` ("an https link opens outside the app"), `notifications.postgres.test.ts` (validation matrix).
- Regression test: `notification-delivery.test.ts` "a banner click opens the notification link instead of only focusing the window".
- Verify: `VERIFY_DATABASE=1 pnpm --filter @rakazo/db test -- notifications && pnpm --filter @rakazo/web test -- notification-delivery && pnpm --filter @rakazo/mobile test -- notification-open && pnpm check`.

### Wave 2 (parallel, after wave 1)

#### S2. Parser, restricted caller, failure classes, job payload

Story: Simpler (rows that read right), Trustworthy (two tools, two actions).

- Step 0: with a real Devin key on a dev stack, call `devin_session_search` (one page) and `devin_session_interact` `get` and `get_messages` once for one session through `callServerTool`, and save the redacted text as fixtures (`packages/adapters/src/__fixtures__/devin-search.txt`, `devin-messages.txt`). If no key is available, write the fixtures from the research field list and record it under Open questions; S9 then replaces them.
- Owns: `packages/adapters/src/devin-sessions.ts` (parser, `devinKindOf`, paging cursor) and `devin-sessions.test.ts`; `packages/adapters/src/devin-call-tool.ts` (`createDevinCallTool`, `devinFailureOf`) and `devin-call-tool.test.ts`; `packages/adapter-kit/src/background-jobs.ts` (`"devin.poll": z.object({ serverId: z.string().min(1).optional() })`, cron runs it with no payload) and `background-jobs.test.ts`; `packages/adapters/src/index.ts` exports.
- Prerequisites: S1 (types).
- Behaviour: the fixture parses into the expected sessions; a line without an id is skipped and counted; missing fields are null or empty, never thrown; `devinKindOf` follows Design 9 including the raw fallback and needs-you precedence; the caller refuses `devin_session_create`, `devin_session_interact` with `action: "message"` and an unknown tool before calling `callServerTool` (a `vi.fn` records no call) and allows `get` and `get_messages`; the caller builds the context from the row's `spaceId` and `userId`, not the actor's; `devinFailureOf(new Error("... (HTTP 401) ..."))` is `rejected`, 403 `rejected`, 429 `rate_limited`, a timeout `unreachable`; the connector produces such text for a 401 from a fake HTTP server (the existing `mcp-connector.test.ts` harness, one added case, or a documented adjustment to the matcher).
- TDD, written first: `devin-sessions.test.ts`, `devin-call-tool.test.ts`, `background-jobs.test.ts` (payload parse).
- Regression test: `devin-call-tool.test.ts` "the Devin caller allows search, get and get_messages and refuses every other tool or action before the call".
- Verify: `pnpm --filter @rakazo/adapters test -- devin && pnpm --filter @rakazo/adapter-kit test && pnpm check`.

#### S7. Web: the Devin page components (Storybook first)

Story: Simpler.

- Owns: `apps/web/src/pages/Devin.tsx` (`DevinPage`, header, tiles, states, refetch hooks), `apps/web/src/pages/Devin.stories.tsx`, `apps/web/src/pages/Devin.test.tsx`; `apps/web/src/pages/devin/DevinSessions.tsx` (table and stacked list, status badge, PR cell, source map, question clamp, "Answer in Devin"), `DevinSessions.stories.tsx`; `apps/web/src/pages/devin/fixtures.ts`; `apps/web/src/lib/devin-format.ts` (`prLabel`, `sourceLabel`, `statusLabel`) and `devin-format.test.ts`; Lingui catalogs; `docs/design-system/components.md` (regenerated). Not `Shell.tsx`, not `App.tsx` (S8a).
- Prerequisites: S1 (RPC types). Uses `mockRpc` for `devin.sessions`; no API needed.
- Behaviour: stories for connected with rows, needs-you rows with and without a question, empty, loading, first-load error, refresh error with rows kept, rejected key, stale (429), not connected as owner, not connected as member, narrow (`@container` at 700 px); the test renders each state from fixtures and asserts: tiles equal the counts of `needs_you` and `working` rows; needs-you rows sort first; a needs-you row shows the question with `line-clamp-2` and an "Answer in Devin" link to the session `url` with `rel="noreferrer"`; a session with no title shows "Untitled session"; the PR cell shows `acme/api#212 open` and "+1" for two PRs, "—" for none; `origin: "code_scan"` shows "Code scan" and an unknown origin "Other"; an unknown status shows its raw text; "Updated 12m ago" appears only when `stale`; "{n} sessions could not be read" only when `skipped > 0`; `ErrorNotice` texts per Design 7; Ask appears only for `isConnector`; refetch runs on `focus`, `visibilitychange` and `rakazo:notifications-changed`; no horizontal scroll at 375 px in the story.
- TDD, written first: `Devin.test.tsx` (jsdom, `vi.mock("../lib/rpc")` as `Legal.test.tsx`), `devin-format.test.ts`.
- Regression test: `Devin.test.tsx` "needs-you rows sort first, show the question on two lines and link Answer in Devin to the session".
- Verify: `pnpm --filter @rakazo/web test -- Devin && pnpm design-system && pnpm design-system:check && pnpm --filter @rakazo/web build-storybook && (cd apps/web && node .storybook/smoke.mjs storybook-static)`.

### Wave 3 (parallel, after wave 2)

#### S4. API: `devin.sessions`, `devin.agent`, glance, space rules, reconnect

Story: Simpler, Trustworthy.

- Owns: `apps/api/src/devin.ts` (new: `findDevinServer`, `devinSessions`, `devinAgent`, `devinNeedsYouCount`, `devinConnectCheck`, `scheduleDevinPoll`); `apps/api/src/router.ts` (`devin.*` handlers beside `legal`, `devinDeps`, glance `devinNeedsYou`, the Devin branches in `mcp.servers.create`/`update`/`remove`/`setWrites`, `mcpServerDto.credentialRejected`); `apps/api/src/integration-agent.ts` (`setIntegrationAgentWrites` read-only guard); `apps/api/src/app.ts` (build `createDevinCallTool(prisma, mcp)` into deps); `apps/api/src/devin.postgres.test.ts` (new), `apps/api/src/glance.postgres.test.ts` (whole-object `toEqual` gains `devinNeedsYou`), `apps/api/src/integration-agent.postgres.test.ts` (setWrites guard), `apps/api/src/mcp-approval.test.ts` only if `mcpServerDto` shape is asserted there.
- Prerequisites: S1, S2, S3.
- Behaviour, each with a fake Devin caller (`vi.fn` returning fixture text): a member of the space who did not connect gets the same `sessions` as the connector, `isConnector: false`, `agentBotId` set, `canConnect: false`; an actor in another space gets `status: "none"`; the second Devin create in a space returns `CONFLICT` and two concurrent creates leave one row; a non-owner's create, update and remove return `FORBIDDEN`, an owner's succeed; create runs `listServerTools` and one `devin_session_search` and deletes the row and secret when either fails; create writes a `DevinConnectionState` row and enqueues one `devin.poll` job for the server; a read within 30 s of `lastSucceededAt` calls Devin zero times and returns `stale: false`; a 401 from the fake marks `credentialRejectedAt`, returns `status: "rejected"` with stored rows, and `mcp.servers.list` then reports `credentialRejected: true`; `update({ id, secret })` on that row re-checks, clears the mark and resets `backoffUntil`; `backoffUntil` in the future returns `rate_limited` with stored rows and zero calls; a parse with one bad line returns `skipped: 1`; glance `devinNeedsYou` counts only `kind: "needs_you"` rows of the actor's space; `setWrites` on the Devin server is `BAD_REQUEST` and on a Mercury server still works; removing the server deletes its `DevinSession` and `DevinConnectionState` rows; `devin.agent` creates the connector's agent once for two concurrent calls and returns null for another member.
- TDD, written first: `devin.postgres.test.ts` (mirrors `glance.postgres.test.ts`: `createRouterClient(createRouter(...))` with two actors and two spaces), `glance.postgres.test.ts`, `integration-agent.postgres.test.ts`.
- Regression test: `devin.postgres.test.ts` "every member reads the space's sessions through the connector's row, only an owner may connect, and a second Devin connection is refused".
- Copy: the PR quotes "Devin is already connected in this space".
- Verify: `VERIFY_DATABASE=1 pnpm --filter @rakazo/api test -- devin glance integration-agent && pnpm check`.

#### S6. Worker: the `devin.poll` job and the needs-you notification

Story: Faster.

- Owns: `packages/adapters/src/devin-poll.ts` (new: `pollDevinConnections`, `pollDevinServer`, baseline, lease, backoff, notification) and `devin-poll.postgres.test.ts` (new, mirrors `notify-user.postgres.test.ts` and `job-reconciler.postgres.test.ts`), `devin-poll.test.ts` (pure decision cases with `vi.fn` prisma); `packages/adapters/src/wakeup.ts` (`RECURRING_JOBS` gains `{ task: "devin.poll", match: "*/2 * * * *" }`) and `wakeup-cron.test.ts`; `packages/adapters/src/background-job-handlers.ts` (`"devin.poll"` handler; deps gain `devinCallTool?` and `notificationEvents?`); `apps/worker/src/index.ts` (passes `createDevinCallTool(prisma, mcp)` and `notificationEvents`).
- Prerequisites: S2, S3, S5.
- Behaviour: first poll of a server with two needs-you sessions creates zero notifications and sets `baselinedAt` and `notifiedMessageId` on both; the next poll with a third session now needs-you calls `get_messages` and `get` once each, stores the question and `url`, and creates exactly one notification for the connector with `surface: "devin"`, `importance: "attention"`, `kind: "needs_input"`, title "Devin has a question", body "{title}: {question}", `link` equal to Devin's `url`, `dedupeKey: "devin:<id>:<eventId>"`, and publishes one realtime signal; the same state on the following poll creates nothing; a new `event_id` on the same session notifies again; when `createNotification` returns `rateLimited` for attention, an `info` notification with the same key is created; when both are rate-limited `notifiedMessageId` stays unset; a session that leaves needs-you updates `kind` so the glance count drops; a session missing from a complete listing is deleted, from a capped listing kept; two workers claiming the same server leave one poll (lease); a 401 sets `credentialRejectedAt` and the next run skips the server; a 429 sets `backoffUntil` 10 min then 20 min; an unreachable error sets 5 min; a session whose `get_messages` fails still notifies once using `devinUpdatedAt` as the surrogate id; no transaction is open while the fake caller awaits.
- TDD, written first: `devin-poll.test.ts` (decision table), `devin-poll.postgres.test.ts` (baseline, dedupe, overflow, lease, cascade), `wakeup-cron.test.ts` (task list).
- Regression test: `devin-poll.postgres.test.ts` "the first poll is silent, the first new question notifies the connector once with the session link, and a repeat does not".
- Copy: the PR quotes "Devin has a question" and the body format.
- Verify: `pnpm --filter @rakazo/adapters test -- devin-poll wakeup && VERIFY_DATABASE=1 pnpm --filter @rakazo/adapters test -- devin-poll && pnpm check`.

### Wave 4 (parallel, after wave 3)

#### S8a. Web: Shell wiring, sidebar, search, panel, e2e

Story: Simpler.

- Owns: `apps/web/src/App.tsx` (route `/app/devin`); `apps/web/src/pages/Shell.tsx` (`devinMode`, `devin.agent` auto-call and `active`, `createDevinAgent`/`askDevinAgent`, `agentPanel` entry, `SidebarPageLink` with `glanceBadge` value, `appPages` entry, `hiddenPages` key, page render with `onAskAgent` only for the connector, space switch reload to `/app/devin`); `apps/web/src/lib/devin-agent.ts` (`findDevinAgent(bots, agentBotId)`); `apps/web/src/pages/Shell.test.tsx` (link, search entry, panel entry); `apps/web/e2e/devin.spec.ts` (new, mirrors `legal.spec.ts`: routes `**/rpc/devin/**` and `**/rpc/notifications/glance` with fixtures, opens `sidebar-devin`, asserts the heading, a needs-you row's "Answer in Devin" link, the "2" glance value, the panel hidden until Ask, `captureScreenshot` at 1500 and 390 px); Lingui catalogs.
- Prerequisites: S4, S7.
- Behaviour: the sidebar shows "Devin" between Data room and Artifacts with the live count as its value and no dot; hiding it through the group menu removes it and search still finds the page; the palette lists the Devin page before the "Devin agent" bot; `/app/devin` renders `DevinPage`; Ask opens the panel and creates the agent when missing (connector); a non-connector sees no Ask; the panel is closed on arrival; a space switch reloads on the other space's Devin page.
- TDD, written first: `Shell.test.tsx` cases, `devin.spec.ts`.
- Regression test: `Shell.test.tsx` "the Devin sidebar link shows the live needs-you count and not the unseen dot".
- Verify: `pnpm --filter @rakazo/web test -- Shell && pnpm check && pnpm lint`, then a local `pnpm --filter @rakazo/web e2e -- devin.spec.ts` against a dev stack; the PR links the two screenshots.

#### S8b. Web: Integrations, connect lands on the page, reconnect with a new key, no writes switch

Story: Simpler, Trustworthy.

- Owns: `apps/web/src/lib/integrations.ts` (`mcpStatus` returns `"reconnect"` when `credentialRejected`) and `integrations.test.ts`; `apps/web/src/components/integrations/IntegrationsHome.tsx` (Devin card "Open Devin" link to `/app/devin`; `?connect=devin` with an existing Devin server opens the dialog with `existingServer`; Reconnect on an API-key first-party server opens that dialog instead of OAuth; the key hint with the link; remove dialog clause for Devin) and `IntegrationsHome.test.tsx`; `apps/web/src/components/integrations/CustomConnectionDialog.tsx` (API-key replace mode: with `existingServer` and `apiKey`, Connect calls `mcp.servers.update({ id, secret })`; for a `requiresAgent` preset the done view is skipped and the dialog closes so `returnTo` navigates) and `CustomConnectionDialog.test.tsx`, `CustomConnectionDialog.stories.tsx`; `apps/web/src/components/integrations/McpDetail.tsx` (no `onWrites` for `presetIsReadOnly`) and `McpDetail.test.tsx`, `McpDetail.stories.tsx`; `IntegrationAgentSection.tsx` only if `onWrites` must become optional, with its story; Lingui catalogs; `docs/design-system/components.md` (regenerated).
- Prerequisites: S4 (`credentialRejected` in the DTO, `update` behaviour).
- Behaviour: connecting Devin from the tile with a `returnTo` ends on `/app/devin` without a "Done" step; a Devin card with `credentialRejected` shows "Needs reconnect" and its Reconnect opens the key dialog, which calls `mcp.servers.update` with the new key and never `create`; a Mercury OAuth card's Reconnect is unchanged; the Devin detail page shows the agent section without the "Allow changes in Devin" switch while Mercury's keeps it; Granola's switch disappears too (stated in the PR); the remove dialog for Devin adds "Devin sessions are not affected."; the hint reads as quoted under "Copy" and its link opens in a new tab.
- TDD, written first: `CustomConnectionDialog.test.tsx` ("a new key for a connected Devin updates the server instead of creating one", "Devin's done view closes straight away"), `IntegrationsHome.test.tsx` ("a rejected Devin key shows Needs reconnect and opens the key dialog"), `McpDetail.test.tsx` ("a read-only preset shows no Allow changes switch"), `integrations.test.ts` (`mcpStatus`).
- Regression test: `CustomConnectionDialog.test.tsx` "a new key for a connected Devin updates the server instead of creating one".
- Copy: the PR quotes "Open Devin", the hint, and "Devin sessions are not affected.".
- Verify: `pnpm --filter @rakazo/web test -- integrations CustomConnectionDialog McpDetail IntegrationsHome && pnpm design-system && pnpm design-system:check && pnpm --filter @rakazo/web build-storybook && (cd apps/web && node .storybook/smoke.mjs storybook-static)`.

### Wave 5

#### S9. Manual walk and docs

- Owns: this document's "Walk results" and "Open questions" (resolved items moved to the current-state table); `docs/integration-agents/README.md` (one line: Devin is read-only, its page is `/app/devin`, question text is read server-side); the S2 fixtures if a real key becomes available.
- Prerequisites: S8a, S8b.
- Walk on the demo stack with invented data and a fake Devin MCP server (the `third-party-connector-emulator` with a `devin_session_search` and `devin_session_interact` that answer fixture text): connect as an owner and land on the page; open the page as a second member and see the same rows and no Ask; try to connect as a non-owner (refused) and a second time as the owner (refused); fire the poll by hand twice and confirm the first is silent and the second notifies on a flipped session; click the toast, the OS banner and (in Electron) confirm the system browser opens the session URL; answer in the fake (flip the status back), refocus the window and see the row leave Needs you and the sidebar count drop; make the fake answer 401 and see "Needs reconnect" on the card and "Devin rejected the key." on the page, replace the key, see both clear; make it answer 429 and see stale rows with "Updated Nm ago"; feed an unparsable line and see the count; open the Devin agent and confirm its tool list has no `devin_session_interact` and no card appears; check the detail page has no writes switch; 1440, 1280, 1100, 900 and 390 px. Record what passed, what failed, and what was not tried. Stated unverified items: a real Devin account (exact search text, `status`/`status_detail` values, the `url` shape, rate limits, the org name source, the key-creation page URL), a phone push on a device, and a real OS banner click on Windows.

## Gap register coverage

Every blocker and major gap from `docs/devin/ux-paths/catalog.md` section 8, and where it lands.

| Gap | Where |
|---|---|
| GAP-01 question text | Design 3: server-side `get_messages` (S2, S6); the agent loses the tool (S1) |
| GAP-02 detection | Design 4, S6 |
| GAP-03 status mapping | Design 9, S2; raw fallback; real values in S9 |
| GAP-04 revoked key | Design 7, S4, S8b |
| GAP-05 dot meaning | Design 6, S4 glance, S8a |
| GAP-06 dedupe and limits | Design 4, S6 |
| GAP-07 mobile | Decision: push opens the session in the browser, S5 |
| GAP-08 read path | Design 2, S4 |
| GAP-09 org-wide visibility | Decision: every member sees the org's sessions; org name in the header when a source exists (Open questions) |
| GAP-10 write option | Design 8, S1, S4, S8b |
| GAP-11 banner click | S5 |
| GAP-12 who is notified | Decision: the connector, S6 |
| GAP-13 refresh model | Design 10, S7; poll S6 |
| GAP-14 loading states | S7 skeleton and kept rows; S4 15 s timeout |
| GAP-15 empty state | S7 |
| GAP-16 over 100 sessions | Design 2 paging, S4 and S6 |
| GAP-17 sort and filters | S7: one sort, no filters |
| GAP-18 tile definitions | Decision: tiles cut to Needs you and Working |
| GAP-19 link target | `url` from `get` (S6) with `devinSessionUrl` fallback (Assumptions); header icon dropped |
| GAP-20 "Answer in Devin" | S7 |
| GAP-21 after Connect | S8b lands on `/app/devin`, "Open Devin" on the card |
| GAP-22 connect-time check | S4 adds one search |
| GAP-23 panel states | S8a reuses the Legal branch |
| GAP-24 shared connection | Decision: one per space, owners connect; S4 |
| GAP-25 narrow layouts | S7 |
| GAP-26 reasons for Error and Suspended | S7 `title` from `statusDetail`; needs-you precedence |
| GAP-27 unparsable output | S2, S7 count |
| GAP-28 429 | Design 7, S4, S6, S7 |
| GAP-29 panel default | S8a closed until Ask |
| GAP-30 live vs cached | Page and poll share the parser and the table (S4, S6); accepted |
| GAP-31 agent limits | S1 skill line |
| GAP-32, GAP-33 | Moot with writes removed (S1) |
| GAP-34 three clocks | S7 stale-only header |
| GAP-35 several PRs | S7 |
| GAP-36 origins and titles | S7 |
| GAP-37 link before connecting | S8a always shown |
| GAP-38 key hint | S8b link; the connect error stays one message (Not in this epic) |
| GAP-39 toast on the page | Not in this epic |
| GAP-40 phone and laptop both buzz | Not in this epic (existing behaviour) |
| GAP-41 history | Not in this epic |
| GAP-42 alerts beyond needs-you | Not in this epic |
| GAP-43 remove dialog | S8b clause |
| GAP-44 shared wording | Two messages on page and card (S7, S8b) |
| GAP-45 long question | S7 two-line clamp |
| GAP-46 search results | S8a keywords, page first |
| GAP-47 accessibility | S7, S8a follow the existing patterns; badge `title`, link names |

## Assumptions

- Session URL shape `https://app.devin.ai/sessions/<id>` (`devinSessionUrl`), used only when `get` did not return `url`; S9 confirms it.
- Devin's `status`/`status_detail` vocabulary is as in Design 9; unknown values fall back to the raw text.
- Two-minute polling per connected space, one search per poll, is within Devin's limits; 429 backoff covers the case it is not.
- The MCP transport error text contains `(HTTP <status>)`, so 401, 403 and 429 can be told apart from the message; S2 checks this with a fake server.
- Devin's org key returns the org's sessions to every member of the space who opens the page; the requester accepted this (decision 1 in the catalog).
- A session that stops appearing in the search listing is gone (archived or deleted) and can be removed from the table.
- The connect-time search check needs no filter and returns quickly on an empty org.
- The `rakazo:notifications-changed` event already fires on every notification signal, so the page refetch on it needs no new plumbing.

## Open questions

- Exact text format of `devin_session_search` and `get_messages` (line layout, how PRs `url[state]` and `status (status_detail)` print, timestamps). S2 step 0 needs a real key; until then the parser runs on fixtures written from the research field list.
- `status` and `status_detail` values; whether `blocked` or a detail such as `waiting_for_user` marks a session that waits on a person.
- Whether `devin_session_events` returns Devin's message bodies; if so the poll could use it instead of `get_messages`, and the agent could read questions without any gate change.
- Devin MCP rate limits, and therefore the poll interval and the paging cap (10 pages).
- Source of the Devin org name for the header meta: no searched field carries it; `devin_list_integrations` may. If nothing does, the header shows only the space name and the stale clock.
- The URL of Devin's key-creation page for the hint link.
- Whether the demo stack's connector emulator can serve the two Devin tools for the walk without a new fake, or S9 adds one.

## Not in this epic

- Launching, replying to, stopping, sleeping or tagging Devin sessions from Rakazo, in chat or on the page.
- A native mobile Devin screen; a push opens the session in the phone's browser.
- Devin wiki and repo-docs tools on the page (the agent keeps them; the tile subtitle stays as it is).
- ACU, cost or credit-balance tiles and columns.
- Several Devin connections or orgs per space.
- A shared Devin agent chat for members who did not connect (bots and secrets are per user; the page is shared, the chat is the connector's).
- Argument-aware read classification of `devin_session_interact` in the MCP gate so the agent could read messages without a card.
- Notifications for Error or Suspended sessions or for a revoked key (GAP-42); the page shows them.
- A notification history or bell (GAP-41); suppressing the toast while on the page (GAP-39).
- Naming who started a session (Devin exposes an opaque `user_id` only).
- Table filters, sort controls or a refresh button; a per-row "how long waiting" cue.
- Splitting the connect-time error into "rejected" and "unreachable" (GAP-38).
- The letter-only Devin tile logo and the two connect-dialog shells (walker F-001-01, F-001-03); the warning and success text contrast of the shared tokens (F-008-03), which is a design-system issue.
- Reusing the `CloudAgent` tables, poller or card: they exist to launch and follow Rakazo-made sessions, and nothing here launches.

## Research claims corrected

- The notification link decision needs a validation change: `createNotification` rejects every link that is not an in-app path (`isInAppPath`, `packages/db/src/notifications.ts:53-55`, `:79-81`), which neither the codebase research nor the catalog recorded. Design 5 adds `externalLink`.
- Discovery item 3 says `PAGE_AGENT_COLOR` and `sidebar-folders.ts` need a Devin entry. They do not: the Devin agent is an integration agent, coloured by `APP_COLOR.devin` (`agent-colors.ts:17`), and `sidebar-folders.ts` already handles `isIntegrationAgentSpawnKey`.
- The catalog says the Integrations "Reconnect" is unreachable for Devin. It is also wrong when reached: `useMcpReconnect` runs OAuth and reports "This server did not ask for a sign-in." for an API-key server (`useMcpReconnect.ts:17-22`), and `CustomConnectionDialog.createServer` returns the existing server when the endpoint matches (`:255-258`), so pasting a new key today keeps the old one. `mcp.servers.update({ id, secret })` exists in the API and S8b uses it.
- The catalog's GAP-07 fix (put the agent's bot id in the push so a tap opens its thread) is superseded by the requester's decision; the code claim behind it is confirmed (`/app/devin` would be read as a bot id, `notification-open.ts:56-61`).
- The codebase research locates the Devin forced write at `devin.ts:32-34`; the list is `:31-38`. No design impact.
