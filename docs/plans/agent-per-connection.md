# Agent per connection

Status: plan, approved direction; no code yet. Line numbers refer to `main` when written.

## Decision

1. Every new connection gets its own agent automatically, and the connection is private to that agent. Other agents ask it with `message_bot`.
2. This covers native Google (Gmail, Calendar and Drive are separate connections), MCP servers, and connected apps (Composio, Pipedream).
3. Sharing is the opt-in: any connection, Google included, can be shared with all agents or chosen agents.
4. Existing connections are untouched: no backfill, migration or prompt.

Owner answers to the open questions:

| Question | Answer |
|---|---|
| Gmail and the Inbox agent | The Inbox agent is the Gmail agent. It owns the Gmail connection, so Inbox reply cards keep working; Chief and others ask the Inbox agent. |
| Agents per Google account | One per service: the Inbox agent for Gmail, plus a Calendar agent and a Drive agent per account. |
| Routines and `message_bot` | Background runs may message owner (integration) agents only, within the hop cap. Other agent-to-agent messaging from background runs stays blocked. |
| Agent deleted or archived | The connection stays private with no agent. Nobody can use it until the user recreates the agent or shares the connection. |

## What exists

- **Connected-app agents**: `ensureConnectedAppAgent` (`apps/api/src/integration-agent.ts:45-125`), one per connection (spawn key `integration-agent:<connectionId>`), idempotent via the unique `(spaceId, spawnKey)` index and a locked link transaction. Exclusivity: `setConnectedAppExclusive` (`:166-200`) and `connections.setAccess` (`apps/api/src/router.ts:5774-5850`).
- **MCP agents**: `ensureIntegrationAgent`; exclusivity is `McpServer.agentExclusive`, enforced by `integrationAgentDenial` (`packages/adapters/src/mcp-connector.ts:129-156`). The Carta agent (`apps/api/src/carta-agent.ts`) is the existing exclusive example. `mcp.servers.create` (`router.ts:4532`) creates no agent; `mcp.servers.remove` (`:4771`) strands the agent.
- **Defaults to flip**: `connections.begin` creates rows with `allAgents: inherited?.allAgents ?? true` (`router.ts:5249`); `releaseAgentServers` (`packages/adapters/src/child-bots.ts:~285-295`) reverts a released connection to shared; the web connect dialog sets access after connect (`ConnectAppDialog.tsx:208-210`).
- **Where a connection becomes connected**: `completeNativeOAuth` (`apps/api/src/connection-oauth.ts:90`) and `connections.complete` (`router.ts:~5740`). `persistLivePluginConnections` (`executor.ts:2942`) is a recovery path, not a user connect.
- **Executor**: connected-app agents get only their own connection's tools and plain built-ins (`executor.ts:3633-3790`); `selectBuiltinTools` zeroes mail, calendar and drive for them (`:8601-8610`). Google writes are allowed only for the owning agent with writes on (`accountAllowedIn`, `:4265-4275`). `deniedConnectionIds` (`:9850-9870`) denies app-wide.
- **Native Google refuses Create agent today** (`connectorSupportsIntegrationAgent`, `packages/contracts/src/integration-agent.ts`): Google connections expose built-in tools, which the agent filter removes, so the agent could do nothing.
- **Inbox**: the Inbox page, mail sync (`packages/adapters/src/mail-sync.ts`) and triage (`packages/adapters/src/inbox-triage.ts`) read the mail cache scoped by space and user and never check agent access, so they keep working when Gmail is private. The Inbox agent (`apps/api/src/inbox-agent.ts`) is `mailOnly` and gated on AI-data consent (`executor.ts:4207`).
- **Peers**: `message_bot` (`packages/adapters/src/builtin-tools.ts:1831`), hop cap 6 (`packages/core/src/bot-messages.ts:12`), stripped from background runs (`executor.ts:~4640`). Directory text: `renderBotDirectory` plus `directoryDescription` (`executor.ts:8928-8944`).
- **Mobile**: `apps/mobile/app/(settings)/integrations.tsx` has connect and remove but no agent or access controls; it uses the same connect RPCs, so server-side creation reaches mobile.

## Design

### Provisioning

- One helper, `provisionConnectionAgent(actor, connectionId)`, in `apps/api/src/integration-agent.ts`: ensure the agent, make the connection private to it, writes off. Idempotent. Best-effort: a failure is logged and never fails the connection; Create agent stays as the repair path when no agent exists.
- Call it on the transition to connected only: `completeNativeOAuth` and `connections.complete`, plus `mcp.servers.create` for non-Carta servers (`agentExclusive: true`). Never at `begin` (abandoned pending rows must not get agents) and never in recovery paths.
- `connections.begin`: new rows start `allAgents: false` and no longer inherit a sibling's access.
- **Gmail**: provisioning links the connection to the user's Inbox agent (spawn key `inbox-agent:<userId>`) instead of creating a new agent. A second Gmail account links to the same Inbox agent. Calendar and Drive get their own agents (`${service} agent`, with the account label when there's more than one account).

### Races and reconnects

- Different connections have different spawn keys and can't collide. Completing the same connection twice is a no-op (already tested in `apps/api/src/connected-app-agent.postgres.test.ts`).
- Composio reconnect reuses the row, so the agent is kept.
- Google reconnect with `replacesConnectionId` deletes the old row (`connection-oauth.ts:~62-86`). In the same transaction, re-key the agent to the new id and carry over `agentBotId`, `writesEnabled`, `allAgents` and access rows, as cached mail already is.

### Removal

| Event | Result |
|---|---|
| Agent archived or deleted | Connection stays private with no agent (owner answer). `releaseAgentServers` changes for new rows; old shared rows keep today's behaviour. |
| Connection revoked or removed | Archive its auto-created agent (chat history kept). The Inbox agent is never archived; it just loses that account. |
| Reconnect after revoke | Row reused; a fresh agent is provisioned. |
| MCP server removed | Archive its agent (today it is stranded). |

### Access computed by the server (#167)

Move `botMayUseConnection` and `deniedConnectionIds` into a shared package, and make denial per connection for agent-linked rows (today account A's exclusivity denies sibling account B to everyone). Add `effectiveAccess` to the connection access response; the web "Used by" lists and the executor use the same function, so the UI never guesses.

### Google agents in the executor

- A Google agent identity gets only its own service's built-ins (mail tools for the Inbox agent on its linked Gmail accounts, calendar tools for a Calendar agent, drive tools for a Drive agent), scoped to its own connections. Data room, finance and contacts stay off.
- Remove `connectorSupportsIntegrationAgent` and the web guard.
- AI-data consent gates any agent reading mail, not only the Inbox spawn key.
- Writes: off by default; `mail_send` still needs an approval card either way.

### Background runs

Allow `message_bot` in background runs when the target is an integration or owner agent of the same space and user; keep it stripped otherwise. The hop cap still applies. Integration agents themselves lose delegation tools (as Carta already does) so owner agents can't chain to each other.

### Agent text

- Name: `${service} agent`, with the account label when an app has several accounts. Avatar: the app logo for integration agents (client rule, no schema change).
- Bot description gains one line: "Owns: {service} ({account}). Ask it for anything in {service}."
- Directory footer, only when an integration agent exists: "Each integration agent owns one account; ask the one that owns the system you need."
- Inbox agent instructions: it owns Gmail; other agents will ask it for mail.

### UI

- Connect dialog: remove the "which bots can use it" step and its copy ("Then you choose which bots can use it.", "All bots can use {name}.", "The bots you chose can use {name}.", "No bot uses {name} yet. Choose bots on its page."). The dialog ends at "{app} connected"; the app page shows the agent.
- Replace the "Only this agent" switch with one switch, off by default: "Share with all agents". When on, the existing Used by list appears for per-agent choice. No hint text. This is the only way to opt in, so it can't be hidden further.
- Used by reads `effectiveAccess`; the owning agent is listed first.
- Mobile: add the agent link and the share switch to the integrations screen, or ship a read-only agent link and say so in the PR.

## Risks

- **Latency and cost**: each cross-system question adds an agent hop. Owner agents keep small contexts. Measure the added seconds during the manual walk.
- **Two-system tasks** (mail plus calendar) fan out from the caller. The user can share a connection when that hurts.
- **Loops**: bounded by the hop cap and by removing delegation tools from integration agents.
- **Approval location**: Calendar and Drive write cards appear in their owner agent's thread. Mail stays in the Inbox because the Inbox agent owns Gmail.
- **Silent narrowing** from the `deniedConnectionIds` change: only agent-linked rows change; tested explicitly.

## Tests (offline)

- API Postgres: new connection gets an agent and private access; twice-complete and parallel connects yield one agent each; Composio reconnect keeps the agent; Google replace re-keys it; existing shared rows unchanged through begin, complete and setAccess; abandoned pending row has no agent; revoke archives the agent; Gmail links to the Inbox agent; agent deletion leaves the connection private; MCP create provisions an exclusive agent and Carta is unchanged; cross-tenant isolation.
- Adapters: per-connection denial for agent-linked rows; Google agents get only their service's tools for their own connections; other bots get none unless shared; writes only for the owner with writes on; consent gate; background `message_bot` allowed only to owner agents; mail sync and triage unaffected; directory lines present.
- Web: no agents step after connect; share switch off by default and reveals Used by; Create agent offered only when no agent exists.
- Mobile: agent link and share switch render from the API.

## PRs, in order

1. Server-computed effective access and per-connection denial (#167). No behaviour change for existing data.
2. Google agents in the executor, consent gate, Gmail linked to the Inbox agent; Create agent still manual.
3. Provisioning on connect, `begin` default, reconnect carry-over, revoke and agent-deletion rules.
4. MCP servers provision exclusive agents; archive on remove.
5. Agent names, avatars, directory lines, background `message_bot` to owner agents, no delegation for integration agents.
6. Web: connect dialog, share switch, Used by from the server.
7. Mobile parity.
8. Manual walk (Gmail, Calendar, Notion, Mercury on the demo stack) and docs.
