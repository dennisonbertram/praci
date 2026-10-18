import type { CallToolResult, ListToolsResult, Tool } from "@modelcontextprotocol/sdk/types.js";
import type {
  AdapterContext,
  ConnectorCall,
  ConnectorEvent,
  ConnectorProvider,
  ConnectorTool,
  SecretStore,
} from "@rakazo/adapter-kit";
import { SecretStoreUnavailableError } from "@rakazo/adapter-kit";
import {
  FINANCE_READ_TOOLS,
  financeProviderForEndpoint,
  integrationPresetForEndpoint,
  isCartaAgentSpawnKey,
  isFinanceAgentSpawnKey,
  isIntegrationAgentForServer,
  isIntegrationAgentSpawnKey,
  isLocalMcpHost,
  isReadTool,
} from "@rakazo/contracts";
import type { McpServer, PrismaClient, ThreadEvents } from "@rakazo/db";
import { getLogger } from "@rakazo/logging";
import { catalogToolPrefix } from "./approval-effect.js";
import { redactConnectorPayload, sanitizeConnectorError } from "./connector-safety.js";
import { credentialDigest } from "./credential-digest.js";
import { appendToolCompletionAudit } from "./executor.js";
import {
  CATALOG_EXECUTE,
  catalogEntries,
  DIRECT_TOOL_LIMIT,
  executeLazyCatalogControl,
  isLazyCatalogControlRoute,
  lazyCatalogTools,
  resolveCatalogCall,
} from "./lazy-tool-catalog.js";
import type { McpOAuthBroker, OAuthMaterial } from "./mcp-oauth.js";
import { oauthMaterialSecrets } from "./mcp-oauth.js";
import { McpSession } from "./mcp-transport.js";
import { actorMayUsePrivateEndpoint } from "./private-endpoint.js";
import type { RemoteTransportDependencies } from "./remote-mcp.js";
import { secretRefMatches } from "./secret-changes.js";

type SessionEntry = {
  session: McpSession;
  revision: number;
  material: OAuthMaterial;
  digest?: string;
  ref?: string;
  recordId?: string;
};
type PendingSession = {
  revision: number;
  promise: Promise<McpSession>;
  invalidated?: boolean;
  ref?: string;
};

const TOOL_LIST_TTL_MS = 30_000;
type ToolListEntry = {
  result?: ListToolsResult;
  expiresAt: number;
  pending?: Promise<ListToolsResult>;
};

/** Runtime MCP connector. Authorization is re-checked against the bot assignment on every call. */
/**
 * Stale allowlist entries are filtered out below with no error. Discovery already has the
 * live tool list, so compare once and warn when string allowlist names are missing from the
 * server. Non-string JSON values are ignored for both the missing list and the ratio.
 */
export function allowlistDrift(
  allowedTools: unknown,
  offered: Array<{ name: string }>,
): { missing: string[]; offered: number; stringAllowedCount: number } {
  const names = new Set(offered.map((tool) => tool.name));
  const allowed = Array.isArray(allowedTools) ? allowedTools : [];
  const stringAllowed = allowed.filter((name): name is string => typeof name === "string");
  return {
    missing: stringAllowed.filter((name) => !names.has(name)),
    offered: names.size,
    stringAllowedCount: stringAllowed.length,
  };
}

type ToolAnnotations = { readOnlyHint?: boolean } | null | undefined;

type GateAssignment = {
  botId?: string;
  allowAllTools: boolean;
  allowedTools: unknown;
  server: {
    id: string;
    name?: string;
    spaceId: string;
    userId: string;
    endpoint?: string | null;
    writesEnabled?: boolean;
    agentBotId?: string | null;
    agentExclusive?: boolean;
    agentBot?: {
      id: string;
      spaceId: string;
      userId: string;
      spawnKey: string | null;
      archivedAt: Date | null;
    } | null;
  };
  bot?: {
    id: string;
    spawnKey: string | null;
    spaceId: string;
    userId: string;
    archivedAt: Date | null;
  } | null;
};

/** Whether the assignment's bot is the server's integration agent. Never trusts agentBotId alone. */
export function isServerAgent(assignment: GateAssignment): boolean {
  return isIntegrationAgentForServer(assignment.server, assignment.bot);
}

/**
 * The integration-agent gate. Returns why a tool is denied, or null. While a server has an agent, only
 * the agent may use its write tools, and only while the server's switch is on; other bots get reads
 * (none when the server is exclusive). An integration agent bot never works outside its own server.
 * `writesEnabled` and the flags come from the row loaded for this call, so changes apply at once.
 */
export function integrationAgentDenial(
  assignment: GateAssignment,
  tool: { name: string; annotations?: ToolAnnotations },
): "belongs-to-agent" | "writes-off" | null {
  const { server, bot } = assignment;
  const preset = integrationPresetForEndpoint(server.endpoint);
  const botIsIntegrationAgent =
    isIntegrationAgentSpawnKey(bot?.spawnKey) ||
    isCartaAgentSpawnKey(bot?.spawnKey) ||
    isServerAgent(assignment);
  if (preset?.requiresAgent && !isIntegrationAgentForServer(server, server.agentBot))
    return "belongs-to-agent";
  if (!server.agentBotId && !botIsIntegrationAgent) return null;
  if (isServerAgent(assignment)) {
    return isReadTool(tool, preset) || server.writesEnabled === true ? null : "writes-off";
  }
  // exclusive without an agent is off; a stranded agent bot (released or forged) gets reads only.
  if (server.agentBotId && server.agentExclusive) return "belongs-to-agent";
  if (botIsIntegrationAgent && !isIntegrationAgentForServer(server, bot)) return "belongs-to-agent";
  return isReadTool(tool, preset) ? null : "belongs-to-agent";
}

const denialMessage = (
  denial: "belongs-to-agent" | "writes-off",
  server: { name?: string },
): string =>
  denial === "writes-off"
    ? `Changes are off for ${server.name ?? "this integration"}. The user can turn on "Allow changes".`
    : `This tool belongs to the ${server.name ?? "integration"} agent. Ask it with message_bot.`;

/**
 * Whether the assignment exposes a tool. The Finance agent is read-only whatever its assignment row
 * says: on a Mercury or Brex server only that provider's read tools pass, even with allowAllTools.
 */
export function assignmentAllowsTool(
  assignment: GateAssignment,
  toolName: string,
  annotations?: ToolAnnotations,
): boolean {
  if (integrationAgentDenial(assignment, { name: toolName, annotations })) return false;
  const preset = integrationPresetForEndpoint(assignment.server.endpoint);
  if (preset?.allowedTools && !preset.allowedTools.includes(toolName)) return false;
  if (isFinanceAgentSpawnKey(assignment.bot?.spawnKey)) {
    const provider = financeProviderForEndpoint(assignment.server.endpoint);
    if (provider && !(FINANCE_READ_TOOLS[provider] as readonly string[]).includes(toolName))
      return false;
  }
  return assignment.allowAllTools || (assignment.allowedTools as unknown[]).includes(toolName);
}

function reportAllowlistDrift(
  assignment: { allowAllTools: boolean; allowedTools: unknown; server: { slug: string } },
  offered: Array<{ name: string }>,
  context: { spaceId: string; botId?: string },
): void {
  if (assignment.allowAllTools) return;
  const drift = allowlistDrift(assignment.allowedTools, offered);
  if (drift.missing.length === 0) return;
  getLogger().warn(
    `mcp allowlist drift on ${assignment.server.slug}: ${drift.missing.length}/${drift.stringAllowedCount} allowed tools are not offered (server offers ${drift.offered})`,
    {
      spaceId: context.spaceId,
      botId: context.botId,
      // Cap the list: the point is to name the drift, not to print an allowlist.
      missing: drift.missing.slice(0, 10),
    },
  );
}

export class McpConnector implements ConnectorProvider {
  private readonly sessions = new Map<string, SessionEntry>();
  private readonly connecting = new Map<string, PendingSession>();
  private readonly toolLists = new WeakMap<McpSession, ToolListEntry>();
  // Discovery runs more than once per run: once up front, then again on every lazy
  // catalog access. Each attempt needs its own executionId.
  private discoverySeq = 0;
  private readonly unsubscribe: () => void;
  constructor(
    private readonly prisma: PrismaClient,
    private readonly secrets: SecretStore,
    private readonly options: {
      stdioEnabled?: boolean;
      allowedCommands?: string[];
      network?: RemoteTransportDependencies;
      /** Audit sink for failed discovery. Without it the log line stays the only trace. */
      events?: Pick<ThreadEvents, "append">;
      allowPrivateEndpoint?: boolean;
    } = {},
    private readonly oauth?: McpOAuthBroker,
  ) {
    this.unsubscribe =
      this.secrets.onChange?.((ref) => {
        for (const [key, entry] of this.sessions)
          if (entry.ref && secretRefMatches(entry.ref, ref))
            void this.evict(key).catch(() => undefined);
        for (const entry of this.connecting.values())
          if (entry.ref && secretRefMatches(entry.ref, ref)) entry.invalidated = true;
      }) ?? (() => {});
  }

  describe() {
    return {
      id: "mcp",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { discover: true, oauth: true, secretsBrokered: true },
    };
  }

  async discoverTools(context: AdapterContext): Promise<ConnectorTool[]> {
    const tools = await this.authorizedTools(context);
    if (tools.length <= DIRECT_TOOL_LIMIT) return tools;
    // The catalog wrappers must not be named `mcp_*`: Anthropic rejects Claude Code OAuth
    // requests that carry a tool whose name starts with "mcp_" (single underscore) with a
    // misleading "You're out of extra usage" 400, on every model. Direct MCP tools are
    // `mcp__server__tool` (double underscore) and are accepted; keep the wrappers off "mcp_".
    return lazyCatalogTools(catalogToolPrefix("mcp"), "mcp", "MCP", catalogEntries(tools));
  }

  async resolveCall(
    call: ConnectorCall,
    context: AdapterContext,
  ): Promise<{ call: ConnectorCall; tool: ConnectorTool } | undefined> {
    // Wrappers have no resourceId; real tools always do.
    if (call.route?.resourceId || call.route?.toolName !== CATALOG_EXECUTE) return undefined;
    return resolveCatalogCall(call, catalogEntries(await this.authorizedTools(context)));
  }

  private async authorizedTools(context: AdapterContext): Promise<ConnectorTool[]> {
    if (!context.botId) return [];
    const assignments = await this.prisma.botMcpServer.findMany({
      where: {
        botId: context.botId,
        spaceId: context.spaceId,
        userId: context.userId,
        server: { enabled: true },
      },
      include: {
        server: {
          include: {
            agentBot: {
              select: { id: true, spawnKey: true, spaceId: true, userId: true, archivedAt: true },
            },
          },
        },
        bot: {
          select: { id: true, spawnKey: true, spaceId: true, userId: true, archivedAt: true },
        },
      },
    });
    const groups = await Promise.all(
      assignments.map(async (assignment): Promise<ConnectorTool[]> => {
        const startedAt = Date.now();
        try {
          const session = await this.sessionFor(assignment.server, context);
          const listed = await this.cachedTools(session, context.signal);
          reportAllowlistDrift(assignment, listed.tools, context);
          return listed.tools
            .filter((tool) => assignmentAllowsTool(assignment, tool.name, tool.annotations))
            .map((tool) => ({
              name: `mcp__${assignment.server.slug}__${tool.name}`,
              description: tool.description ?? tool.name,
              inputSchema: tool.inputSchema as Record<string, unknown>,
              // Only for the server's agent: false makes the executor ask before each write.
              ...(isServerAgent(assignment)
                ? {
                    readOnly: isReadTool(
                      tool,
                      integrationPresetForEndpoint(assignment.server.endpoint),
                    ),
                  }
                : {}),
              route: {
                connectorId: "mcp",
                ...(isServerAgent(assignment)
                  ? {
                      discoveredReadOnly: isReadTool(
                        tool,
                        integrationPresetForEndpoint(assignment.server.endpoint),
                      ),
                    }
                  : {}),
                resourceId: assignment.serverId,
                resourceRevision: assignment.server.revision,
                toolName: tool.name,
                catalogGroup: assignment.server.slug,
                ...(assignment.server.endpoint ? { endpoint: assignment.server.endpoint } : {}),
              },
            }));
        } catch (error) {
          // A single unavailable server must not hide tools from other connectors.
          getLogger().error(
            `mcp discovery failed for server ${assignment.server.slug}:`,
            sanitizeConnectorError(error),
          );
          // Capture material before eviction so the audited reason stays redacted, the
          // same reason execute() captures it before callTool.
          const key = this.sessionKey(assignment.server, context);
          const material = this.sessions.get(key)?.material;
          await this.evict(key);
          await this.recordDiscoveryFailure(
            assignment.server.slug,
            error,
            context,
            startedAt,
            material ? oauthMaterialSecrets(material) : [],
          );
          return [];
        }
      }),
    );
    return groups.flat();
  }

  /**
   * Leave a failed discovery where every other tool outcome is already visible, as an
   * `agent.tool.completed` event with `outcome: "error"`. Losing a server's tools is
   * otherwise invisible: the run still ends `completed` and the model simply never sees
   * them. Discovery outside a run (settings, tool pickers) has no thread to attach to, so
   * there the log line stays the only trace.
   */
  private async recordDiscoveryFailure(
    slug: string,
    error: unknown,
    context: AdapterContext,
    startedAt: number,
    secrets: string[],
  ): Promise<void> {
    const events = this.options.events;
    if (!events || !context.runId || !context.botId) return;
    const run = await this.prisma.run
      .findUnique({ where: { id: context.runId }, select: { threadId: true } })
      .catch(() => null);
    if (!run) return;
    await appendToolCompletionAudit(
      { events },
      {
        spaceId: context.spaceId,
        threadId: run.threadId,
        botId: context.botId,
        runId: context.runId,
      },
      {
        name: `mcp__${slug}__discovery`,
        executionId: `mcp-discovery-${slug}-${context.runId}-${this.discoverySeq++}`,
        durationMs: Date.now() - startedAt,
        error,
      },
      secrets,
    );
  }

  async *execute(call: ConnectorCall, context: AdapterContext): AsyncIterable<ConnectorEvent> {
    if (call.route?.connectorId !== "mcp") {
      yield { type: "error", message: `MCP route required for ${call.tool}` };
      return;
    }
    if (isLazyCatalogControlRoute(call.route)) {
      try {
        yield* executeLazyCatalogControl(
          call,
          catalogEntries(await this.authorizedTools(context)),
          (resolved) => this.execute(resolved, context),
        );
      } catch (error) {
        yield { type: "error", message: sanitizeConnectorError(error) };
      }
      return;
    }
    if (!call.route.resourceId) {
      yield { type: "error", message: `MCP route required for ${call.tool}` };
      return;
    }
    if (!context.botId) {
      yield { type: "error", message: "MCP tools require a bot context" };
      return;
    }
    const route = call.route;
    const loadAssignment = () =>
      this.prisma.botMcpServer.findFirst({
        where: {
          botId: context.botId,
          serverId: route.resourceId,
          spaceId: context.spaceId,
          userId: context.userId,
          server: { enabled: true },
        },
        include: {
          server: {
            include: {
              agentBot: {
                select: { id: true, spawnKey: true, spaceId: true, userId: true, archivedAt: true },
              },
            },
          },
          bot: {
            select: { id: true, spawnKey: true, spaceId: true, userId: true, archivedAt: true },
          },
        },
      });
    let assignment = await loadAssignment();
    if (!assignment) {
      yield { type: "error", message: "MCP tool is not assigned to this bot" };
      return;
    }
    // Preset classifications cannot change with annotations. Other tools still need a live list:
    // cached read hints must never authorize a tool that has become a write since discovery.
    let annotations: ToolAnnotations;
    if (assignment.server.agentBotId) {
      try {
        const session = await this.sessionFor(assignment.server, context);
        const preset = integrationPresetForEndpoint(assignment.server.endpoint);
        const fixedClassification =
          preset?.reads.includes(route.toolName) || preset?.forcedWrites.includes(route.toolName);
        const listed = fixedClassification
          ? await this.cachedTools(session, context.signal)
          : await session.listTools({ signal: context.signal });
        annotations = listed.tools.find((tool) => tool.name === route.toolName)?.annotations;
      } catch (error) {
        yield { type: "error", message: sanitizeConnectorError(error) };
        return;
      }
      // The listing took time: authorize on the row as it is now, not as it was before the call.
      assignment = await loadAssignment();
      if (!assignment) {
        yield { type: "error", message: "MCP tool is not assigned to this bot" };
        return;
      }
    }
    // Synchronous, so the same decision runs on the row read just before the call.
    const gate = (row: NonNullable<typeof assignment>): string | null => {
      const denial = integrationAgentDenial(row, { name: route.toolName, annotations });
      if (denial) return denialMessage(denial, row.server);
      // The executor asked for approval according to the classification at discovery. A tool that
      // was a read then and is a write now was not asked about, so it must not run.
      if (
        route.discoveredReadOnly === true &&
        isServerAgent(row) &&
        !isReadTool(
          { name: route.toolName, annotations },
          integrationPresetForEndpoint(row.server.endpoint),
        )
      )
        return `${route.toolName} changed from a read to a change since it was listed, so it was not run. Try again in a new message.`;
      if (!assignmentAllowsTool(row, route.toolName, annotations))
        return "MCP tool is not assigned to this bot";
      return null;
    };
    const early = gate(assignment);
    if (early) {
      yield { type: "error", message: early };
      return;
    }
    // Capture material before callTool so a concurrent eviction/replace cannot
    // drop this call's OAuth secrets from model-visible redaction. Recompute via
    // oauthMaterialSecrets(material) so in-place token refresh stays covered.
    let material: OAuthMaterial | undefined;
    const sessionKey = this.sessionKey(assignment.server, context);
    try {
      // Connect first (it can wait on secrets), then read the row and decide, then call: nothing
      // awaits between the decision and callTool.
      const opened = assignment.server;
      const openedFor = {
        endpoint: opened.endpoint,
        secretId: opened.secretId,
        revision: opened.revision,
      };
      const session = await this.sessionFor(opened, context);
      material = this.sessions.get(sessionKey)?.material;
      const fresh = await loadAssignment();
      // An edit while the session was being set up (new endpoint or credentials) leaves this session
      // pointed at the old account: it must not carry the call.
      const moved =
        fresh !== null &&
        (fresh.server.endpoint !== openedFor.endpoint ||
          fresh.server.secretId !== openedFor.secretId ||
          fresh.server.revision !== openedFor.revision);
      const denied = moved
        ? "The integration changed while the call was starting, so it was not run. Try again in a new message."
        : fresh
          ? gate(fresh)
          : "MCP tool is not assigned to this bot";
      if (denied) {
        yield { type: "error", message: denied };
        return;
      }
      const result = await session.callTool(route.toolName, call.args, {
        signal: context.signal,
      });
      const secrets = material ? oauthMaterialSecrets(material) : [];
      yield { type: "result", data: redactConnectorPayload(result, secrets) };
    } catch (error) {
      // A thrown call means the transport or auth broke; drop the session so the next call reconnects.
      const secrets = material ? oauthMaterialSecrets(material) : [];
      await this.evict(sessionKey);
      yield { type: "error", message: sanitizeConnectorError(error, secrets) };
    }
  }

  /**
   * Calls one tool on a stored server without a bot or an assignment, for server-side jobs that
   * use a user's own connection (Finance sync). The caller decides which tools are allowed. It
   * reuses the live session, OAuth refresh and secret handling of bot runs.
   */
  async callServerTool(
    server: McpServer,
    context: AdapterContext,
    toolName: string,
    args: Record<string, unknown>,
  ): Promise<CallToolResult> {
    const sessionKey = this.sessionKey(server, context);
    let material: OAuthMaterial | undefined;
    try {
      const session = await this.sessionFor(server, context);
      material = this.sessions.get(sessionKey)?.material;
      return await session.callTool(toolName, args, { signal: context.signal });
    } catch (error) {
      const secrets = material ? oauthMaterialSecrets(material) : [];
      await this.evict(sessionKey);
      throw new Error(sanitizeConnectorError(error, secrets));
    }
  }

  /** Lists a stored server's tools, with their annotations, outside a bot run. */
  async listServerTools(server: McpServer, context: AdapterContext): Promise<Tool[]> {
    const sessionKey = this.sessionKey(server, context);
    try {
      const session = await this.sessionFor(server, context);
      return structuredClone((await this.cachedTools(session, context.signal)).tools);
    } catch (error) {
      await this.evict(sessionKey);
      throw new Error(sanitizeConnectorError(error));
    }
  }

  async close(): Promise<void> {
    this.unsubscribe();
    await Promise.allSettled([...this.connecting.values()].map(({ promise }) => promise));
    await Promise.all(
      [...this.sessions.values()].map(({ session }) => {
        this.toolLists.delete(session);
        return session.close();
      }),
    );
    this.sessions.clear();
    this.connecting.clear();
  }

  private sessionKey(server: McpServer, context: AdapterContext): string {
    // Identity headers are applied once, at connect time, so a session is only
    // valid for the identity it connected as. The key has to carry that identity.
    return `${server.id} ${context.spaceId} ${context.userId}`;
  }

  private async evict(sessionKey: string): Promise<void> {
    const entry = this.sessions.get(sessionKey);
    if (!entry) return;
    this.sessions.delete(sessionKey);
    this.toolLists.delete(entry.session);
    await entry.session.close();
  }

  private async cachedTools(session: McpSession, signal?: AbortSignal): Promise<ListToolsResult> {
    signal?.throwIfAborted();
    let entry = this.toolLists.get(session);
    if (!entry) {
      entry = { expiresAt: 0 };
      this.toolLists.set(session, entry);
    }
    if (entry.result && Date.now() < entry.expiresAt) return entry.result;
    let pending = entry.pending;
    if (!pending) {
      const current = entry;
      pending = session.listTools({ signal }).then(
        (result) => {
          current.result = result;
          current.expiresAt = Date.now() + TOOL_LIST_TTL_MS;
          current.pending = undefined;
          return result;
        },
        (error) => {
          current.result = undefined;
          current.pending = undefined;
          throw error;
        },
      );
      entry.pending = pending;
    }
    const result = await pending;
    signal?.throwIfAborted();
    return result;
  }

  private async sessionFor(server: McpServer, context: AdapterContext): Promise<McpSession> {
    const sessionKey = this.sessionKey(server, context);
    const existing = this.sessions.get(sessionKey);
    if (existing && existing.revision === server.revision) {
      if (existing.ref && server.secretId) {
        try {
          const plaintext = await this.secrets.load(existing.ref, {
            recordId: existing.recordId ?? server.secretId,
            signal: context.signal,
          });
          if (credentialDigest(plaintext) !== existing.digest) await this.evict(sessionKey);
        } catch (error) {
          context.signal.throwIfAborted();
          if (!(error instanceof SecretStoreUnavailableError)) {
            await this.evict(sessionKey);
            throw error;
          }
          // Keep live sessions usable during a store outage. Never log the error:
          // provider errors can contain credential values or private response data.
          getLogger().warn("MCP secret revalidation failed; retaining the live session");
        }
      }
      // A fresh read can detect rotation and synchronously evict this entry.
      if (this.sessions.get(sessionKey) === existing) return existing.session;
      return this.sessionFor(server, context);
    }
    const pending = this.connecting.get(sessionKey);
    if (pending?.revision === server.revision) return pending.promise;
    if (pending) {
      await pending.promise.catch(() => undefined);
      await this.evict(sessionKey);
      return this.sessionFor(server, context);
    }
    if (existing) await this.evict(sessionKey);

    let connected: SessionEntry | undefined;
    const promise = this.connectSession(server, context, (ref, recordId, digest) => {
      const entry = this.connecting.get(sessionKey);
      if (entry?.promise === promise) entry.ref = ref;
      const live = this.sessions.get(sessionKey);
      if (live && live === connected) {
        live.ref = ref;
        live.recordId = recordId;
        live.digest = digest;
      }
    }).then(async ({ session, material, ref, digest, recordId }) => {
      if (this.connecting.get(sessionKey)?.invalidated) {
        await session.close();
        throw new Error("Secret changed during MCP connection; retry");
      }
      connected = {
        session,
        revision: server.revision,
        material,
        ref,
        digest,
        recordId,
      };
      this.sessions.set(sessionKey, connected);
      return session;
    });
    this.connecting.set(sessionKey, { revision: server.revision, promise });
    try {
      return await promise;
    } finally {
      if (this.connecting.get(sessionKey)?.promise === promise) this.connecting.delete(sessionKey);
    }
  }

  private async connectSession(
    server: McpServer,
    context: AdapterContext,
    onRef: (ref: string, recordId: string, digest?: string) => void,
  ): Promise<{
    session: McpSession;
    material: OAuthMaterial;
    ref?: string;
    digest?: string;
    recordId?: string;
  }> {
    const session = new McpSession({ name: `rakazo-${server.slug}` });
    // Hoisted so a throw after the secret is decoded can still hand the material out.
    let material: OAuthMaterial | undefined;
    try {
      const secret = server.secretId
        ? await this.prisma.secret.findFirst({
            where: {
              id: server.secretId,
              spaceId: context.spaceId,
              userId: context.userId,
            },
          })
        : null;
      let ref = secret?.ciphertext;
      let recordId = secret?.id;
      if (secret) onRef(secret.ciphertext, secret.id);
      const plaintext = secret
        ? await this.secrets.load(secret.ciphertext, {
            recordId: secret.id,
            signal: context.signal,
          })
        : undefined;
      let digest = plaintext === undefined ? undefined : credentialDigest(plaintext);
      material = plaintext === undefined ? {} : (JSON.parse(plaintext) as OAuthMaterial);
      const loaded = { material, ...(secret ? { secretId: secret.id } : {}) };
      const args = Array.isArray(server.args) ? server.args.map(String) : [];
      const env = { ...(material.env ?? {}) };
      if (server.transport === "stdio") {
        if (!this.options.stdioEnabled) throw new Error("MCP stdio is disabled");
        await session.connectStdio({
          command: String(server.command ?? ""),
          args,
          env,
          allowedCommands: this.options.allowedCommands ?? [],
          signal: context.signal,
        });
      } else {
        if (!server.endpoint) throw new Error("MCP endpoint is required");
        const endpoint = new URL(server.endpoint);
        const localHttp = endpoint.protocol === "http:" && isLocalMcpHost(endpoint.hostname);
        const allowPrivateEndpoint = await actorMayUsePrivateEndpoint(
          this.prisma,
          context.userId,
          this.options.allowPrivateEndpoint === true,
        );
        const authProvider =
          !localHttp && this.oauth
            ? await this.oauth.providerFor(server, context, loaded, (record) => {
                ref = record.ref;
                recordId = record.id;
                digest = credentialDigest(JSON.stringify(record.material));
                onRef(ref, recordId, digest);
              })
            : undefined;
        const staticToken = material.secret
          ? material.secret.startsWith("Bearer ")
            ? material.secret
            : `Bearer ${material.secret}`
          : undefined;
        const headers = {
          ...(material.headers ?? {}),
          ...(staticToken ? { Authorization: staticToken } : {}),
        };
        await session.connectRemote({
          url: server.endpoint,
          urlPolicy: {
            allowHttpLocalhost: localHttp,
            allowLocalHttpCredentials: localHttp,
            allowPrivateEndpoint,
          },
          transport: server.transport === "sse" ? "sse" : "streamable-http",
          allowLegacySse: server.transport === "sse",
          headerPolicy: { headers },
          fallbackToSse: false,
          authProvider,
          network: this.options.network,
          signal: context.signal,
        });
      }
      return { session, material, ref, digest, recordId };
    } catch (error) {
      await session.close().catch(() => undefined);
      // Redact here, while the material is still in hand. This one rejection is handed
      // to every caller waiting on the same pending connect, and none of them can see
      // the secrets: the session never reached `sessions`. Sanitizing per caller would
      // cover only whoever looked first.
      if (!material) throw error;
      throw new Error(sanitizeConnectorError(error, oauthMaterialSecrets(material)));
    }
  }
}
