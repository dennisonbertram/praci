import { createHmac } from "node:crypto";
import type {
  AdapterContext,
  ConnectorCall,
  ConnectorCatalogItem,
  ConnectorEvent,
  ConnectorProxyRequest,
  ConnectorProxyResponse,
  ConnectorTool,
  ManagedConnectorProvider,
} from "@rakazo/adapter-kit";
import { getLogger } from "@rakazo/logging";
import { catalogToolPrefix } from "./approval-effect.js";
import { collectPages, filterCatalog } from "./composio-connector.js";
import {
  combineSignals,
  redactConnectorPayload,
  sanitizeConnectorError,
} from "./connector-safety.js";
import {
  CATALOG_EXECUTE,
  catalogEntries,
  DIRECT_TOOL_LIMIT,
  executeLazyCatalogControl,
  isLazyCatalogControlRoute,
  lazyCatalogTools,
  resolveCatalogCall,
} from "./lazy-tool-catalog.js";
import {
  callRemoteMcpTool,
  listRemoteMcpTools,
  type RemoteTransportDependencies,
} from "./remote-mcp.js";
import { isVitestRuntime } from "./test-runtime.js";
import { readBodyCapped, withAbort } from "./web-ssrf.js";

const API_BASE = "https://api.pipedream.com";
const MCP_ENDPOINT = "https://remote.mcp.pipedream.net/v3";
const DIRECTORY_TTL_MS = 10 * 60_000;
const REQUEST_TIMEOUT_MS = 30_000;
export const MAX_PIPEDREAM_RESPONSE_BYTES = 2 * 1024 * 1024;

export interface PipedreamConnectorConfig {
  clientId: string;
  clientSecret: string;
  projectId: string;
  environment: "development" | "production";
  identitySecret: string;
}

export interface PipedreamEnvironmentValues {
  pipedreamClientId?: string;
  pipedreamClientSecret?: string;
  pipedreamProjectId?: string;
  pipedreamEnvironment?: string;
  encryptionKey: string;
}

export function pipedreamConfigFromEnv(
  values: PipedreamEnvironmentValues,
): PipedreamConnectorConfig {
  return {
    clientId: values.pipedreamClientId ?? "",
    clientSecret: values.pipedreamClientSecret ?? "",
    projectId: values.pipedreamProjectId ?? "",
    environment: values.pipedreamEnvironment === "production" ? "production" : "development",
    identitySecret: values.encryptionKey,
  };
}

export type PipedreamConnectorDependencies = RemoteTransportDependencies;

type PipedreamApp = {
  id: string;
  name_slug: string;
  name: string;
  img_src?: string;
};

type PipedreamAccount = {
  id: string;
  healthy?: boolean;
  dead?: boolean;
  app?: PipedreamApp;
};

export function isPipedreamEnabled(config: Partial<PipedreamConnectorConfig>): boolean {
  return Boolean(
    config.clientId &&
      config.clientSecret &&
      config.projectId &&
      config.environment &&
      config.identitySecret &&
      !isVitestRuntime(),
  );
}

function securePipedreamConnectUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Pipedream did not return a secure HTTPS connect URL");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Pipedream did not return a secure HTTPS connect URL");
  }
  return url;
}

export class PipedreamConnector implements ManagedConnectorProvider {
  private accessToken?: { value: string; expiresAt: number };
  private accessTokenRequest?: Promise<string>;
  private directory?: { value: PipedreamApp[]; expiresAt: number };
  private directoryRequest?: Promise<PipedreamApp[]>;

  constructor(
    private readonly config: PipedreamConnectorConfig,
    private readonly dependencies: PipedreamConnectorDependencies = {},
  ) {}

  describe() {
    return {
      id: "pipedream",
      contractVersion: "1",
      adapterVersion: "0.1.0",
      capabilities: { discover: true, oauth: true, secretsBrokered: true },
    };
  }

  async catalog(context: AdapterContext, query?: string): Promise<ConnectorCatalogItem[]> {
    const [directory, connected] = await Promise.all([
      this.catalogDirectory(),
      this.listConnectedExternalIds(context),
    ]);
    const connectedSet = new Set(connected);
    return filterCatalog(
      directory.map((item) => ({ ...item, connected: connectedSet.has(item.slug) })),
      query ?? "",
    );
  }

  async catalogDirectory(): Promise<Omit<ConnectorCatalogItem, "connected">[]> {
    const apps = await this.apps();
    return apps.map((app) => ({
      connectorId: "pipedream",
      slug: app.name_slug,
      name: app.name,
      logo: app.img_src ?? null,
      noAuth: false,
    }));
  }

  async warmDirectory(): Promise<void> {
    await this.apps();
  }

  async listConnectedExternalIds(context: AdapterContext): Promise<string[]> {
    const accounts = await this.accounts(context);
    return [
      ...new Set(
        accounts
          .filter((account) => account.healthy !== false && account.dead !== true)
          .map((account) => account.app?.name_slug)
          .filter((slug): slug is string => Boolean(slug)),
      ),
    ];
  }

  private async allTools(context: AdapterContext): Promise<ConnectorTool[]> {
    const connections =
      context.connectedConnections?.filter(
        (connection) => connection.connectorId === "pipedream",
      ) ?? [];
    const apps = connections.map((connection) => connection.externalId);
    if (apps.length === 0) return [];
    const token = await this.token();
    const groups = await Promise.all(
      [...new Set(apps)].map(async (app) => {
        try {
          const connection = context.connectedAppAgentConnectionId
            ? connections.find(
                (candidate) =>
                  candidate.id === context.connectedAppAgentConnectionId &&
                  candidate.externalId === app,
              )
            : undefined;
          const accountId = connection?.providerRef?.trim();
          if (
            context.connectedAppAgentConnectionId &&
            (!connection || !accountId || accountId === connection.externalId)
          ) {
            return [];
          }
          const tools = await listRemoteMcpTools({
            endpoint: MCP_ENDPOINT,
            headers: this.mcpHeaders(context, app, token, accountId),
            signal: context.signal,
            fetch: this.dependencies.fetch,
            resolveHostname: this.dependencies.resolveHostname,
          });
          return tools.map((tool) => ({
            ...tool,
            route: {
              connectorId: "pipedream",
              resourceId: app,
              toolName: tool.name,
              catalogGroup: app,
            },
          }));
        } catch (error) {
          // A single unavailable app must not hide tools from other connections.
          getLogger().error(
            `pipedream discovery failed for app ${app}:`,
            sanitizeConnectorError(error),
          );
          return [];
        }
      }),
    );
    return groups.flat();
  }

  async discoverTools(context: AdapterContext): Promise<ConnectorTool[]> {
    const tools = await this.allTools(context);
    if (context.connectedAppAgentConnectionId) return tools;
    const exposed =
      tools.length <= DIRECT_TOOL_LIMIT
        ? tools
        : lazyCatalogTools(
            catalogToolPrefix("pipedream"),
            "pipedream",
            "app",
            catalogEntries(tools),
          );
    return exposed;
  }

  async resolveCall(
    call: ConnectorCall,
    context: AdapterContext,
  ): Promise<{ call: ConnectorCall; tool: ConnectorTool } | undefined> {
    // Wrappers have no resourceId; real tools always do.
    if (call.route?.resourceId || call.route?.toolName !== CATALOG_EXECUTE) return undefined;
    const resolved = resolveCatalogCall(call, catalogEntries(await this.allTools(context)));
    if (!resolved) return undefined;
    const connections =
      context.connectedConnections?.filter(
        (connection) => connection.connectorId === "pipedream",
      ) ?? [];
    if (context.connectedAppAgentConnectionId) {
      if (
        call.route.connectionId !== context.connectedAppAgentConnectionId ||
        connections.length !== 1 ||
        connections[0]!.id !== context.connectedAppAgentConnectionId ||
        resolved.tool.route?.resourceId !== connections[0]!.externalId
      ) {
        return undefined;
      }
      const connectionId = connections[0]!.id;
      return {
        call: { ...resolved.call, route: { ...resolved.call.route!, connectionId } },
        tool: { ...resolved.tool, route: { ...resolved.tool.route!, connectionId } },
      };
    }
    if (
      !call.route.connectionId ||
      connections.length !== 1 ||
      resolved.tool.route?.resourceId !== connections[0]!.externalId
    ) {
      return resolved;
    }
    const connectionId = connections[0]!.id;
    return {
      call: { ...resolved.call, route: { ...resolved.call.route!, connectionId } },
      tool: { ...resolved.tool, route: { ...resolved.tool.route!, connectionId } },
    };
  }

  async *execute(call: ConnectorCall, context: AdapterContext): AsyncIterable<ConnectorEvent> {
    if (isLazyCatalogControlRoute(call.route)) {
      try {
        yield* executeLazyCatalogControl(
          call,
          catalogEntries(await this.allTools(context)),
          (resolved) => this.execute(resolved, context),
        );
      } catch (error) {
        yield { type: "error", message: sanitizeConnectorError(error) };
      }
      return;
    }
    const app = call.route?.resourceId;
    if (!app) {
      yield { type: "error", message: "Pipedream app route is missing" };
      return;
    }
    let accountId: string | undefined;
    if (call.route?.connectionId) {
      const connection = context.connectedConnections?.find(
        (candidate) =>
          candidate.id === call.route?.connectionId &&
          candidate.connectorId === "pipedream" &&
          candidate.externalId === app,
      );
      accountId = connection?.providerRef?.trim();
      if (
        !connection ||
        (context.connectedAppAgentConnectionId &&
          (connection.id !== context.connectedAppAgentConnectionId ||
            !accountId ||
            accountId === connection.externalId))
      ) {
        yield { type: "error", message: "Connected app route is unavailable" };
        return;
      }
    } else if (context.connectedAppAgentConnectionId) {
      yield { type: "error", message: "Connected app route is unavailable" };
      return;
    }
    let token: string | undefined;
    try {
      token = await this.token();
      const remote = {
        endpoint: MCP_ENDPOINT,
        headers: this.mcpHeaders(context, app, token, accountId),
        signal: context.signal,
        fetch: this.dependencies.fetch,
        resolveHostname: this.dependencies.resolveHostname,
      };
      if (call.route?.discoveredReadOnly === true) {
        // Classified now, not at discovery: a read that became a write must not run unasked.
        const live = (await listRemoteMcpTools(remote)).find(
          (tool) => tool.name === (call.route?.toolName ?? call.tool),
        );
        if (live?.readOnly !== true) {
          yield {
            type: "error",
            message:
              "This tool changed from a read to a change since it was listed, so it was not run. Try again in a new message.",
          };
          return;
        }
      }
      // Last await before the provider call: re-read the connection after all setup above.
      const denied = await call.beforeDispatch?.();
      if (denied) {
        yield { type: "error", message: denied };
        return;
      }
      const result = await callRemoteMcpTool(remote, call.route?.toolName ?? call.tool, call.args);
      yield {
        type: "result",
        data: redactConnectorPayload(result, [token, this.config.clientSecret]),
      };
    } catch (error) {
      yield {
        type: "error",
        message: sanitizeConnectorError(
          error,
          [token, this.config.clientSecret].filter((value): value is string => Boolean(value)),
        ),
      };
    }
  }

  async begin(
    request: { provider: string; redirectUrl: string },
    context: AdapterContext,
  ): Promise<{ authorizationUrl: string | null; state: string }> {
    const response = await this.request<{ connect_link_url: string }>(
      `/v1/connect/${encodeURIComponent(this.config.projectId)}/tokens`,
      {
        method: "POST",
        body: JSON.stringify({
          external_user_id: this.externalUserId(context),
          success_redirect_uri: request.redirectUrl,
          error_redirect_uri: request.redirectUrl,
          scope: "connect:accounts:read connect:accounts:write",
        }),
      },
      context.signal,
    );
    const url = securePipedreamConnectUrl(response.connect_link_url);
    url.searchParams.set("app", request.provider);
    return { authorizationUrl: url.toString(), state: request.provider };
  }

  async complete(request: { state: string }): Promise<{ connectionRef: string }> {
    return { connectionRef: request.state };
  }

  /**
   * Prefer a concrete Pipedream account id over the app slug so multi-account
   * revoke can target one authorization. spaceId is required for the hashed
   * external user id Pipedream uses to scope accounts.
   */
  async resolveConnectedAccountId(
    userId: string,
    slug: string,
    currentRef: string | null | undefined,
    excludeIds: string[] = [],
    spaceId?: string,
  ): Promise<string | undefined> {
    const excluded = new Set(excludeIds.filter(Boolean));
    const current = currentRef?.trim() || undefined;
    if (!spaceId) {
      return current && current !== slug && !excluded.has(current) ? current : undefined;
    }
    // Concrete account ids are already authoritative; do not reassign them.
    if (current && current !== slug) {
      return excluded.has(current) ? undefined : current;
    }
    const context = {
      userId,
      spaceId,
      signal: AbortSignal.timeout(30_000),
    } as AdapterContext;
    const accounts = await this.accounts(context, slug);
    const ids = accounts
      .filter((account) => account.healthy !== false && account.dead !== true)
      .map((account) => account.id)
      .filter(Boolean);
    return ids.find((id) => !excluded.has(id));
  }

  async connectionReady(context: AdapterContext, externalId: string): Promise<boolean> {
    const accounts = await this.accounts(context, externalId);
    return accounts.some(
      (account) =>
        account.app?.name_slug === externalId && account.healthy !== false && account.dead !== true,
    );
  }

  async revoke(externalId: string, context: AdapterContext): Promise<void> {
    let accounts: PipedreamAccount[];
    try {
      accounts = await this.accounts(context);
    } catch (error) {
      // Listing failed before any DELETE — mark so callers can restore local retry state.
      if (error && typeof error === "object") {
        (error as { remoteRevokePreDelete?: boolean }).remoteRevokePreDelete = true;
      }
      throw error;
    }
    const targets = accounts.filter(
      (account) => account.id === externalId || account.app?.name_slug === externalId,
    );
    await Promise.all(
      targets.map((account) =>
        this.request(
          `/v1/connect/${encodeURIComponent(this.config.projectId)}/accounts/${encodeURIComponent(account.id)}`,
          { method: "DELETE" },
          context.signal,
        ),
      ),
    );
  }

  /**
   * Delete remote accounts for `slug` that no local row still references. Used when a
   * begin loses a race to revoke and only the app slug is available — never revoke by
   * slug alone, or every sibling authorization would be deleted.
   */
  async revokeUnreferencedAccounts(
    slug: string,
    keepAccountIds: string[],
    context: AdapterContext,
  ): Promise<void> {
    const keep = new Set(keepAccountIds.filter(Boolean));
    const accounts = await this.accounts(context, slug);
    const orphans = accounts.filter(
      (account) =>
        account.app?.name_slug === slug &&
        account.healthy !== false &&
        account.dead !== true &&
        !keep.has(account.id),
    );
    await Promise.all(
      orphans.map((account) =>
        this.request(
          `/v1/connect/${encodeURIComponent(this.config.projectId)}/accounts/${encodeURIComponent(account.id)}`,
          { method: "DELETE" },
          context.signal,
        ),
      ),
    );
  }

  /**
   * Call an app API URL as one connected account through the Connect proxy, which forwards the
   * method and the JSON body and sends a request once. Upstream statuses
   * are returned, not thrown. A ref that is not an `apn_` account id is the legacy app slug:
   * it works only when the user has exactly one healthy account for the app.
   */
  async proxy(
    request: ConnectorProxyRequest,
    context: AdapterContext,
  ): Promise<ConnectorProxyResponse> {
    let accountId = request.accountRef;
    if (!accountId.startsWith("apn_")) {
      const ids = (await this.accounts(context, request.app))
        .filter(
          (account) =>
            account.app?.name_slug === request.app &&
            account.healthy !== false &&
            account.dead !== true,
        )
        .map((account) => account.id);
      // Ambiguous or missing: report an auth failure so the user reconnects.
      if (ids.length !== 1)
        return { status: 401, data: "No single Pipedream account for this app" };
      accountId = ids[0] as string;
    }
    const query = new URLSearchParams({
      external_user_id: this.externalUserId(context),
      account_id: accountId,
    });
    const { response, body, token } = await this.send(
      `/v1/connect/${encodeURIComponent(this.config.projectId)}/proxy/${Buffer.from(request.url).toString("base64url")}?${query}`,
      {
        method: request.method,
        ...(request.body === undefined ? {} : { body: JSON.stringify(request.body) }),
      },
      context.signal,
    );
    const retryAfter = response.headers.get("retry-after");
    const seconds = retryAfter === null ? Number.NaN : Number(retryAfter);
    return {
      status: response.status,
      data: parseBody(body, [token, this.config.clientSecret]),
      ...(Number.isFinite(seconds) && seconds >= 0 ? { retryAfterMs: seconds * 1000 } : {}),
    };
  }

  private externalUserId(context: AdapterContext): string {
    return `rkz_${createHmac("sha256", this.config.identitySecret)
      .update(`${context.spaceId}:${context.userId}`)
      .digest("hex")}`;
  }

  private mcpHeaders(
    context: AdapterContext,
    app: string,
    accessToken: string,
    accountId?: string,
  ): Record<string, string> {
    return {
      authorization: `Bearer ${accessToken}`,
      "x-pd-project-id": this.config.projectId,
      "x-pd-environment": this.config.environment,
      "x-pd-external-user-id": this.externalUserId(context),
      "x-pd-app-slug": app,
      ...(accountId ? { "x-pd-account-id": accountId } : {}),
    };
  }

  private async apps(): Promise<PipedreamApp[]> {
    if (this.directory && this.directory.expiresAt > Date.now()) return this.directory.value;
    if (this.directoryRequest) return this.directoryRequest;
    this.directoryRequest = this.loadApps();
    try {
      return await this.directoryRequest;
    } finally {
      this.directoryRequest = undefined;
    }
  }

  private async loadApps(): Promise<PipedreamApp[]> {
    const apps: PipedreamApp[] = [];
    let after: string | undefined;
    for (let page = 0; page < 100; page += 1) {
      const query = new URLSearchParams({ limit: "100", has_actions: "true" });
      if (after) query.set("after", after);
      const response = await this.request<{
        data?: PipedreamApp[];
        page_info?: { end_cursor?: string };
      }>(`/v1/connect/apps?${query}`);
      apps.push(...(response.data ?? []));
      after = response.page_info?.end_cursor;
      if (!after || apps.length >= 5_000) break;
    }
    this.directory = { value: apps, expiresAt: Date.now() + DIRECTORY_TTL_MS };
    return apps;
  }

  private async accounts(context: AdapterContext, app?: string): Promise<PipedreamAccount[]> {
    return collectPages(async (after) => {
      const query = new URLSearchParams({
        external_user_id: this.externalUserId(context),
        limit: "100",
      });
      if (app) query.set("app", app);
      if (after) query.set("after", after);
      const response = await this.request<{
        data?: PipedreamAccount[];
        page_info?: { end_cursor?: string };
      }>(
        `/v1/connect/${encodeURIComponent(this.config.projectId)}/accounts?${query}`,
        {},
        context.signal,
      );
      return { items: response.data ?? [], cursor: response.page_info?.end_cursor };
    }, 20);
  }

  private async request<T = unknown>(
    path: string,
    init: RequestInit = {},
    signal?: AbortSignal,
  ): Promise<T> {
    const { response, body, token } = await this.send(path, init, signal);
    if (!response.ok) {
      throw new Error(
        sanitizeConnectorError(`Pipedream returned HTTP ${response.status}: ${body}`, [token]),
      );
    }
    return (body ? JSON.parse(body) : {}) as T;
  }

  /** One authenticated Pipedream API call that returns the response whatever its status. */
  private async send(path: string, init: RequestInit, signal?: AbortSignal) {
    const token = await this.token();
    const requestAbort = combineSignals(signal, AbortSignal.timeout(REQUEST_TIMEOUT_MS));
    const response = await (this.dependencies.fetch ?? globalThis.fetch)(`${API_BASE}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "x-pd-environment": this.config.environment,
        ...init.headers,
      },
      signal: requestAbort,
    });
    if (response.status === 401) this.accessToken = undefined;
    return { response, body: await readPipedreamBody(response, requestAbort), token };
  }

  private async token(): Promise<string> {
    if (this.accessToken && this.accessToken.expiresAt > Date.now() + 60_000) {
      return this.accessToken.value;
    }
    if (this.accessTokenRequest) return this.accessTokenRequest;
    this.accessTokenRequest = this.fetchToken();
    try {
      return await this.accessTokenRequest;
    } finally {
      this.accessTokenRequest = undefined;
    }
  }

  private async fetchToken(): Promise<string> {
    const requestAbort = AbortSignal.timeout(REQUEST_TIMEOUT_MS);
    const response = await (this.dependencies.fetch ?? globalThis.fetch)(
      `${API_BASE}/v1/oauth/token`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          scope: "connect:*",
        }),
        signal: requestAbort,
      },
    );
    const text = await readPipedreamBody(response, requestAbort);
    const body = (response.ok && text ? JSON.parse(text) : {}) as {
      access_token?: string;
      expires_in?: number;
      error?: string;
    };
    if (!response.ok || !body.access_token) {
      throw new Error(`Pipedream authentication failed: ${body.error ?? response.status}`);
    }
    this.accessToken = {
      value: body.access_token,
      expiresAt: Date.now() + (body.expires_in ?? 3_600) * 1_000,
    };
    return body.access_token;
  }
}

async function readPipedreamBody(response: Response, signal: AbortSignal): Promise<string> {
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_PIPEDREAM_RESPONSE_BYTES) {
    const cancel = response.body?.cancel() ?? Promise.resolve();
    // A hanging cancel must not outlive the shared deadline.
    await withAbort(
      cancel.catch(() => undefined),
      signal,
    ).catch(() => undefined);
    throw new Error("Pipedream response is too large.");
  }
  try {
    const bytes = await readBodyCapped(response, MAX_PIPEDREAM_RESPONSE_BYTES, signal);
    return new TextDecoder().decode(bytes);
  } catch (error) {
    if (error instanceof Error && error.message === "Response is too large") {
      throw new Error("Pipedream response is too large.");
    }
    throw error;
  }
}

function parseBody(body: string, secrets: string[]): unknown {
  if (!body) return null;
  try {
    return JSON.parse(body);
  } catch {
    return sanitizeConnectorError(body, secrets);
  }
}
