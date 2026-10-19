import {
  CARTA_MCP_ENDPOINT,
  CARTA_READ_TOOLS,
  CARTA_WRITE_TOOLS,
  cartaAgentSpawnKey,
  DEVIN_READ_TOOLS,
  DEVIN_WRITE_TOOLS,
} from "@rakazo/contracts";
import { createLogger, createTestSink, getLogger, installLogger } from "@rakazo/logging";
import { afterEach, describe, expect, it, vi } from "vitest";
import { isIntegrationAgentWrite } from "./approval-ask.js";
import { InfisicalSecretStore } from "./infisical-secret-store.js";
import { allowlistDrift, McpConnector } from "./mcp-connector.js";
import { type McpOAuthBroker, StoredMcpOAuthProvider } from "./mcp-oauth.js";
import { InMemoryRealtimeFanout } from "./realtime.js";
import { migrateSecrets } from "./secret-migration.js";
import { ComposedSecretStore } from "./secret-store-factory.js";
import { infisicalFake } from "./secret-store-fake.js";
import { EncryptedSecretStore } from "./secrets.js";

afterEach(() => vi.unstubAllGlobals());

const SERVER = {
  id: "server-1",
  slug: "demo",
  transport: "streamable_http",
  endpoint: "https://mcp.example.test/mcp",
  secretId: null,
  args: [],
  revision: 1,
};

const ASSIGNMENT = {
  botId: "bot-1",
  serverId: "server-1",
  spaceId: "w1",
  userId: "u1",
  allowAllTools: true,
  allowedTools: [],
  server: SERVER,
};

const TEST_NETWORK = {
  // Read the global per call so a fetch stubbed after construction still wins.
  fetch: (input: string | URL | Request, init?: RequestInit) => globalThis.fetch(input, init),
  resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }],
};

function logicalHref(input: string | URL | Request, init?: RequestInit): string {
  const url = new URL(
    typeof input === "string" || input instanceof URL ? String(input) : input.url,
  );
  const host = new Headers(input instanceof Request ? input.headers : init?.headers).get("host");
  if (host) url.host = host;
  return url.href;
}

function mcpFetch(
  state: {
    failNext: boolean;
    initializations: number;
    headers?: Record<string, string>[];
    tools?: Array<{
      name: string;
      description?: string;
      inputSchema: Record<string, unknown>;
      annotations?: { readOnlyHint?: boolean };
    }>;
    calls?: string[];
    listings?: number;
  },
  expectedUrl = "https://mcp.example.test/mcp",
) {
  return vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    state.headers?.push(Object.fromEntries(request.headers.entries()));
    if (logicalHref(input, init) !== expectedUrl)
      throw new Error(`Unexpected request: ${logicalHref(input, init)}`);
    if (request.method !== "POST") return new Response(null, { status: 405 });
    if (state.failNext) return new Response("boom", { status: 500 });
    const message = JSON.parse(await request.text()) as {
      id?: number;
      method?: string;
      params?: { name?: string };
    };
    if (message.method === "initialize") {
      state.initializations += 1;
      return Response.json({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: "2025-11-25",
          capabilities: { tools: {} },
          serverInfo: { name: "test", version: "1" },
        },
      });
    }
    if (message.method === "tools/list") {
      state.listings = (state.listings ?? 0) + 1;
      return Response.json({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          tools: state.tools ?? [{ name: "echo", inputSchema: { type: "object" } }],
        },
      });
    }
    if (message.method === "tools/call") {
      if (message.params?.name) state.calls?.push(message.params.name);
      return Response.json({
        jsonrpc: "2.0",
        id: message.id,
        result: { content: [{ type: "text", text: "ok" }] },
      });
    }
    return new Response(null, { status: 202 });
  });
}

describe("MCP connector session cache", () => {
  it("keeps sessions across unchanged TTL reads and reconnects on observed rotation", async () => {
    vi.useFakeTimers();
    const fake = infisicalFake();
    const store = new InfisicalSecretStore({ ...fake.options, cacheTtlMs: 100 });
    const context = {
      operationId: "test",
      traceId: "test",
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
    };
    await store.start();
    const record = await store.put(
      JSON.stringify({ headers: { Authorization: "Bearer initial" } }),
      context,
    );
    const assignment = { ...ASSIGNMENT, server: { ...SERVER, secretId: record.id } };
    const prisma = {
      botMcpServer: {
        findMany: vi.fn(async () => [assignment]),
        findFirst: vi.fn(async () => assignment),
      },
      secret: { findFirst: vi.fn(async () => ({ id: record.id, ciphertext: record.ref })) },
    };
    const state = { failNext: false, initializations: 0, headers: [] as Record<string, string>[] };
    vi.stubGlobal("fetch", mcpFetch(state));
    const connector = new McpConnector(prisma as never, store, { network: TEST_NETWORK });
    try {
      await connector.discoverTools(context);
      expect(state.initializations).toBe(1);
      const reads = fake.fetcher.mock.calls.length;
      await connector.discoverTools(context);
      expect(fake.fetcher).toHaveBeenCalledTimes(reads);
      expect(state.initializations).toBe(1);
      const changed = vi.fn();
      store.onChange(changed);
      await vi.advanceTimersByTimeAsync(100);
      await connector.discoverTools(context);
      expect(state.initializations).toBe(1);
      expect(changed).not.toHaveBeenCalled();
      fake.values.set(
        record.ref.split(":").at(-1)!,
        JSON.stringify({ headers: { Authorization: "Bearer rotated" } }),
      );
      await vi.advanceTimersByTimeAsync(100);
      await connector.discoverTools(context);
      expect(changed).toHaveBeenCalledExactlyOnceWith(record.ref);
      expect(state.initializations).toBe(2);
      expect(state.headers.some((headers) => headers.authorization === "Bearer rotated")).toBe(
        true,
      );
    } finally {
      await connector.close();
      await store.close();
      vi.useRealTimers();
    }
  });

  it("detects rotation after digest eviction and evicts deleted credentials", async () => {
    vi.useFakeTimers();
    const fake = infisicalFake();
    const store = new InfisicalSecretStore({
      ...fake.options,
      cacheTtlMs: 100,
      cacheMaxEntries: 1,
    });
    const context = {
      operationId: "test",
      traceId: "test",
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
    };
    await store.start();
    const record = await store.put(
      JSON.stringify({ headers: { Authorization: "Bearer initial" } }),
      context,
    );
    const assignment = { ...ASSIGNMENT, server: { ...SERVER, secretId: record.id } };
    const prisma = {
      botMcpServer: {
        findMany: vi.fn(async () => [assignment]),
        findFirst: vi.fn(async () => assignment),
      },
      secret: { findFirst: vi.fn(async () => ({ id: record.id, ciphertext: record.ref })) },
    };
    const state = { failNext: false, initializations: 0, headers: [] as Record<string, string>[] };
    vi.stubGlobal("fetch", mcpFetch(state));
    const connector = new McpConnector(prisma as never, store, { network: TEST_NETWORK });
    try {
      await connector.discoverTools(context);
      expect(state.initializations).toBe(1);
      const changed = vi.fn();
      store.onChange(changed);
      await store.put("unrelated", context);
      fake.values.set(
        record.ref.split(":").at(-1)!,
        JSON.stringify({ headers: { Authorization: "Bearer rotated" } }),
      );
      await vi.advanceTimersByTimeAsync(100);
      await connector.discoverTools(context);
      expect(changed).not.toHaveBeenCalledWith(record.ref);
      expect(state.initializations).toBe(2);
      expect(state.headers.some((headers) => headers.authorization === "Bearer rotated")).toBe(
        true,
      );
      fake.values.delete(record.ref.split(":").at(-1)!);
      await vi.advanceTimersByTimeAsync(100);
      // Discovery suppresses per-server errors; no tools from the deleted credential survive.
      await expect(connector.discoverTools(context)).resolves.toEqual([]);
      expect((connector as unknown as { sessions: Map<string, unknown> }).sessions.size).toBe(0);
    } finally {
      await connector.close();
      await store.close();
      vi.useRealTimers();
    }
  });

  it("rebuilds a session in this process when another process replaces its large OAuth credential", async () => {
    // Two stores over one fanout stand in for the API and worker processes. The fanout
    // rejects payloads over the PostgreSQL NOTIFY limit, as PostgresRealtimeFanout does.
    class NotifyLimitedFanout extends InMemoryRealtimeFanout {
      override async publish(topic: string, payload: string): Promise<void> {
        if (Buffer.byteLength(JSON.stringify({ topic, payload }), "utf8") > 7_900)
          throw new Error("Realtime signal exceeds the PostgreSQL NOTIFY payload limit");
        return super.publish(topic, payload);
      }
    }
    const fanout = new NotifyLimitedFanout();
    const api = new ComposedSecretStore(new EncryptedSecretStore("key"), undefined, fanout);
    const worker = new ComposedSecretStore(new EncryptedSecretStore("key"), undefined, fanout);
    await api.start();
    await worker.start();
    const context = {
      operationId: "test",
      traceId: "test",
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
    };
    const record = await api.put(
      JSON.stringify({ headers: { Authorization: `Bearer ${"a".repeat(9_000)}` } }),
      context,
    );
    const assignment = { ...ASSIGNMENT, server: { ...SERVER, secretId: record.id } };
    const prisma = {
      botMcpServer: {
        findMany: vi.fn(async () => [assignment]),
        findFirst: vi.fn(async () => assignment),
      },
      secret: { findFirst: vi.fn(async () => ({ id: record.id, ciphertext: record.ref })) },
    };
    const state = { failNext: false, initializations: 0 };
    vi.stubGlobal("fetch", mcpFetch(state));
    const connector = new McpConnector(prisma as never, worker, { network: TEST_NETWORK });
    try {
      await connector.discoverTools(context);
      await connector.discoverTools(context);
      expect(state.initializations).toBe(1);
      await api.delete(record.ref, record.id);
      await connector.discoverTools(context);
      expect(state.initializations).toBe(2);
    } finally {
      await connector.close();
      await api.close();
      await worker.close();
      await fanout.close();
    }
  });

  it("keeps a live session working during a secret-store outage after TTL", async () => {
    vi.useFakeTimers();
    const sink = createTestSink();
    const previousLogger = getLogger();
    installLogger(createLogger({ service: "test", sinks: [sink] }));
    const fake = infisicalFake();
    const store = new InfisicalSecretStore({ ...fake.options, cacheTtlMs: 100 });
    const context = {
      operationId: "test",
      traceId: "test",
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
    };
    await store.start();
    const record = await store.put(
      JSON.stringify({ headers: { Authorization: "Bearer initial" } }),
      context,
    );
    const assignment = { ...ASSIGNMENT, server: { ...SERVER, secretId: record.id } };
    const prisma = {
      botMcpServer: {
        findMany: vi.fn(async () => [assignment]),
        findFirst: vi.fn(async () => assignment),
      },
      secret: { findFirst: vi.fn(async () => ({ id: record.id, ciphertext: record.ref })) },
    };
    const state = { failNext: false, initializations: 0, headers: [] as Record<string, string>[] };
    vi.stubGlobal("fetch", mcpFetch(state));
    const connector = new McpConnector(prisma as never, store, { network: TEST_NETWORK });
    try {
      await connector.discoverTools(context);
      expect(state.initializations).toBe(1);
      const reads = fake.fetcher.mock.calls.length;
      fake.offline = true;
      await vi.advanceTimersByTimeAsync(100);
      const tools = await connector.discoverTools(context);
      expect(tools).toHaveLength(1);
      expect(fake.fetcher.mock.calls.length).toBeGreaterThan(reads);
      expect(state.initializations).toBe(1);
      expect(state.headers.at(-1)?.authorization).toBe("Bearer initial");
      const events = [];
      for (const tool of tools) {
        const call = { tool: tool.name, args: {}, executionId: "test", route: tool.route };
        for await (const event of connector.execute(call, context)) events.push(event);
      }
      expect(events).toMatchObject([{ type: "result" }]);
      expect(state.initializations).toBe(1);
      expect(sink.events).toHaveLength(2);
      const log = JSON.stringify(sink.events);
      expect(log).toContain("MCP secret revalidation failed");
      expect(log).not.toContain("private response value");
      expect(log).not.toContain(record.ref);
      expect(log).not.toContain(record.id);
      expect(log).not.toContain("Bearer initial");
      // Recovery still revalidates and observes a rotation without a manual read.
      fake.offline = false;
      fake.values.set(
        record.ref.split(":").at(-1)!,
        JSON.stringify({ headers: { Authorization: "Bearer rotated" } }),
      );
      expect(await connector.discoverTools(context)).toHaveLength(1);
      expect(state.initializations).toBe(2);
      expect(state.headers.at(-1)?.authorization).toBe("Bearer rotated");
    } finally {
      await connector.close();
      await store.close();
      installLogger(previousLogger);
      vi.useRealTimers();
    }
  });

  it("reconnects a legacy session when migration publishes the old ref through realtime", async () => {
    const fake = infisicalFake();
    const fanout = new InMemoryRealtimeFanout();
    const source = new ComposedSecretStore(new EncryptedSecretStore("fake-key"), undefined, fanout);
    const target = new ComposedSecretStore(
      new EncryptedSecretStore("fake-key"),
      new InfisicalSecretStore(fake.options),
      fanout,
    );
    const worker = new ComposedSecretStore(
      new EncryptedSecretStore("fake-key"),
      new InfisicalSecretStore(fake.options),
      fanout,
    );
    await source.start();
    await target.start();
    await worker.start();
    const context = {
      operationId: "test",
      traceId: "test",
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
    };
    const record = await source.put(
      JSON.stringify({ headers: { Authorization: "Bearer fake" } }),
      context,
    );
    const row = { id: record.id, ciphertext: record.ref };
    const assignment = { ...ASSIGNMENT, server: { ...SERVER, secretId: record.id } };
    const prisma = {
      botMcpServer: {
        findMany: vi.fn(async () => [assignment]),
        findFirst: vi.fn(async () => assignment),
      },
      secret: { findFirst: vi.fn(async () => row) },
    };
    const state = { failNext: false, initializations: 0 };
    vi.stubGlobal("fetch", mcpFetch(state));
    const connector = new McpConnector(prisma as never, worker, { network: TEST_NETWORK });
    try {
      await connector.discoverTools(context);
      expect(state.initializations).toBe(1);
      const result = await migrateSecrets(
        {
          async *rows() {
            yield { id: row.id, recordId: row.id, ref: row.ciphertext, label: "secret" };
          },
          async replace(original, ref) {
            if (original.ref !== row.ciphertext) return false;
            row.ciphertext = ref;
            return true;
          },
          async referenced(ref) {
            return row.ciphertext === ref;
          },
        },
        source,
        target,
        context,
        { direction: "forward" },
      );
      expect(result.migrated).toBe(1);
      await connector.discoverTools(context);
      expect(state.initializations).toBe(2);
    } finally {
      await connector.close();
      await source.close();
      await target.close();
      await worker.close();
      await fanout.close();
    }
  });

  it("keeps large MCP schemas out of the initial runtime tool catalog", async () => {
    const state = {
      failNext: false,
      initializations: 0,
      tools: Array.from({ length: 30 }, (_, index) => ({
        name: `tool_${String(index).padStart(2, "0")}`,
        description: `Tool ${index}`,
        inputSchema: {
          type: "object",
          properties: { value: { type: "string", description: `schema-marker-${index}` } },
          required: ["value"],
        },
      })),
    };
    vi.stubGlobal("fetch", mcpFetch(state));
    const prisma = {
      botMcpServer: {
        findMany: vi.fn().mockResolvedValue([ASSIGNMENT]),
        findFirst: vi.fn().mockResolvedValue(ASSIGNMENT),
      },
    };
    const connector = new McpConnector(prisma as never, {} as never, {
      network: TEST_NETWORK,
    });
    const context = {
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
    } as never;

    const tools = await connector.discoverTools(context);

    expect(tools).toHaveLength(3);
    expect(tools.map((tool) => tool.name)).toEqual([
      "connectors_search_tools",
      "connectors_load_tool",
      "connectors_execute_tool",
    ]);
    // Anthropic rejects Claude Code OAuth requests carrying any `mcp_`-prefixed tool name.
    expect(tools.every((tool) => !tool.name.startsWith("mcp_"))).toBe(true);
    expect(JSON.stringify(tools)).not.toContain("schema-marker");
    await connector.close();
  });

  it("exposes 20 MCP tools directly and switches at 21", async () => {
    const context = {
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
    } as never;
    for (const count of [20, 21]) {
      const state = {
        failNext: false,
        initializations: 0,
        tools: Array.from({ length: count }, (_, index) => ({
          name: `tool_${index}`,
          inputSchema: { type: "object" },
        })),
      };
      vi.stubGlobal("fetch", mcpFetch(state));
      const connector = new McpConnector(
        {
          botMcpServer: {
            findMany: vi.fn().mockResolvedValue([ASSIGNMENT]),
            findFirst: vi.fn().mockResolvedValue(ASSIGNMENT),
          },
        } as never,
        {} as never,
        { network: TEST_NETWORK },
      );
      const tools = await connector.discoverTools(context);
      if (count === 20) {
        expect(tools).toHaveLength(20);
        expect(tools[0]?.name).toMatch(/^mcp__demo__/);
      } else {
        expect(tools.map((tool) => tool.name)).toEqual([
          "connectors_search_tools",
          "connectors_load_tool",
          "connectors_execute_tool",
        ]);
      }
      await connector.close();
    }
  });

  it("records a discovery failure as a failed tool completion", async () => {
    vi.stubGlobal("fetch", mcpFetch({ failNext: true, initializations: 0 }));
    const append = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      botMcpServer: { findMany: vi.fn().mockResolvedValue([ASSIGNMENT]) },
      run: { findUnique: vi.fn().mockResolvedValue({ threadId: "thread-1" }) },
    };
    const connector = new McpConnector(prisma as never, {} as never, {
      network: TEST_NETWORK,
      events: { append },
    });

    await expect(
      connector.discoverTools({
        spaceId: "w1",
        userId: "u1",
        botId: "bot-1",
        runId: "run-1",
        signal: new AbortController().signal,
      } as never),
    ).resolves.toEqual([]);

    expect(append).toHaveBeenCalledTimes(1);
    expect(append.mock.calls[0]?.[0]).toMatchObject({
      spaceId: "w1",
      threadId: "thread-1",
      botId: "bot-1",
      runId: "run-1",
      type: "agent.tool.completed",
      payload: {
        name: "mcp__demo__discovery",
        executionId: "mcp-discovery-demo-run-1-0",
        outcome: "error",
      },
    });
    expect(append.mock.calls[0]?.[0].payload.error).toEqual(expect.any(String));
    await connector.close();
  });

  it("redacts credentials of a connect that failed before the session was cached", async () => {
    const localAssignment = {
      ...ASSIGNMENT,
      server: { ...SERVER, endpoint: "http://localhost:8123/api/mcp", secretId: "secret-1" },
    };
    // The connect itself fails, so the session never reaches the cache. The upstream
    // body quotes back the header it was sent, the way a strict server rejects one.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rejected credential local-key", { status: 500 })),
    );
    const append = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      botMcpServer: { findMany: vi.fn().mockResolvedValue([localAssignment]) },
      secret: { findFirst: vi.fn().mockResolvedValue({ id: "secret-1", ciphertext: "encrypted" }) },
      run: { findUnique: vi.fn().mockResolvedValue({ threadId: "thread-1" }) },
      deploymentSettings: { findUnique: vi.fn(async () => ({ ownerUserId: "u1" })) },
    };
    const connector = new McpConnector(
      prisma as never,
      {
        load: vi.fn().mockReturnValue(JSON.stringify({ headers: { "X-Api-Key": "local-key" } })),
      } as never,
      { network: TEST_NETWORK, events: { append } },
    );

    await expect(
      connector.discoverTools({
        spaceId: "w1",
        userId: "u1",
        botId: "bot-1",
        runId: "run-1",
        signal: new AbortController().signal,
      } as never),
    ).resolves.toEqual([]);

    expect(append).toHaveBeenCalledTimes(1);
    const reason = String(append.mock.calls[0]?.[0].payload.error);
    expect(reason).not.toContain("local-key");
    expect(reason).toContain("[redacted]");
    await connector.close();
  });

  it("redacts the same failed connect for every concurrent waiter", async () => {
    const localAssignment = {
      ...ASSIGNMENT,
      server: { ...SERVER, endpoint: "http://localhost:8123/api/mcp", secretId: "secret-1" },
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("rejected credential local-key", { status: 500 })),
    );
    const append = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      botMcpServer: {
        findMany: vi.fn().mockResolvedValue([localAssignment]),
        findFirst: vi.fn().mockResolvedValue(localAssignment),
      },
      secret: { findFirst: vi.fn().mockResolvedValue({ id: "secret-1", ciphertext: "encrypted" }) },
      run: { findUnique: vi.fn().mockResolvedValue({ threadId: "thread-1" }) },
      deploymentSettings: { findUnique: vi.fn(async () => ({ ownerUserId: "u1" })) },
    };
    const connector = new McpConnector(
      prisma as never,
      {
        load: vi.fn().mockReturnValue(JSON.stringify({ headers: { "X-Api-Key": "local-key" } })),
      } as never,
      { network: TEST_NETWORK, events: { append } },
    );
    const context = {
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      runId: "run-1",
      signal: new AbortController().signal,
    };

    // Both callers land on the same pending connect, so both receive the one
    // rejection it produces. Neither may see the credential it reflected.
    const [first, second] = await Promise.all([
      connector.discoverTools(context as never),
      connector.discoverTools(context as never),
    ]);

    expect(first).toEqual([]);
    expect(second).toEqual([]);
    expect(append).toHaveBeenCalledTimes(2);
    for (const call of append.mock.calls) {
      const message = String(call[0].payload.error);
      expect(message).not.toContain("local-key");
      expect(message).toContain("[redacted]");
    }
    await connector.close();
  });

  it("gives every discovery failure of one run its own executionId", async () => {
    vi.stubGlobal("fetch", mcpFetch({ failNext: true, initializations: 0 }));
    const append = vi.fn().mockResolvedValue(undefined);
    const prisma = {
      botMcpServer: { findMany: vi.fn().mockResolvedValue([ASSIGNMENT]) },
      run: { findUnique: vi.fn().mockResolvedValue({ threadId: "thread-1" }) },
    };
    const connector = new McpConnector(prisma as never, {} as never, {
      network: TEST_NETWORK,
      events: { append },
    });
    const context = {
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      runId: "run-1",
      signal: new AbortController().signal,
    };

    // Discovery is reached again on every lazy catalog access inside the same run.
    await connector.discoverTools(context as never);
    await connector.discoverTools(context as never);

    expect(append).toHaveBeenCalledTimes(2);
    const ids = append.mock.calls.map((call) => call[0].payload.executionId);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(id).toMatch(/^mcp-discovery-demo-run-1-\d+$/);
    await connector.close();
  });

  it("leaves no discovery event when the failure happens outside a run", async () => {
    vi.stubGlobal("fetch", mcpFetch({ failNext: true, initializations: 0 }));
    const append = vi.fn().mockResolvedValue(undefined);
    const connector = new McpConnector(
      { botMcpServer: { findMany: vi.fn().mockResolvedValue([ASSIGNMENT]) } } as never,
      {} as never,
      { network: TEST_NETWORK, events: { append } },
    );

    await expect(
      connector.discoverTools({
        spaceId: "w1",
        userId: "u1",
        botId: "bot-1",
        signal: new AbortController().signal,
      } as never),
    ).resolves.toEqual([]);

    expect(append).not.toHaveBeenCalled();
    await connector.close();
  });

  it("returns no tools when the MCP catalog is empty", async () => {
    const connector = new McpConnector(
      { botMcpServer: { findMany: vi.fn().mockResolvedValue([]) } } as never,
      {} as never,
    );
    await expect(
      connector.discoverTools({
        spaceId: "w1",
        userId: "u1",
        botId: "bot-1",
        signal: new AbortController().signal,
      } as never),
    ).resolves.toEqual([]);
    await connector.close();
  });

  it("searches, loads, validates, authorizes, and executes one large-catalog tool", async () => {
    const state = {
      failNext: false,
      initializations: 0,
      calls: [] as string[],
      tools: Array.from({ length: 30 }, (_, index) => ({
        name: `tool_${String(index).padStart(2, "0")}`,
        description: index === 29 ? "Find the final report" : `Utility ${index}`,
        inputSchema: {
          type: "object",
          properties: { value: { type: "string" } },
          required: ["value"],
          additionalProperties: false,
        },
      })),
    };
    vi.stubGlobal("fetch", mcpFetch(state));
    const prisma = {
      botMcpServer: {
        findMany: vi.fn().mockResolvedValue([ASSIGNMENT]),
        findFirst: vi.fn().mockResolvedValue(ASSIGNMENT),
      },
    };
    const connector = new McpConnector(prisma as never, {} as never, {
      network: TEST_NETWORK,
    });
    const context = {
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
    } as never;
    const [search, load, execute] = await connector.discoverTools(context);
    const collect = async (call: Parameters<McpConnector["execute"]>[0]) => {
      const events: unknown[] = [];
      for await (const event of connector.execute(call as never, context)) events.push(event);
      return events;
    };

    const searched = await collect({
      tool: search!.name,
      args: { query: "final report", limit: 2 },
      executionId: "search",
      route: search!.route,
    });
    expect(searched).toEqual([
      {
        type: "result",
        data: {
          tools: [
            {
              id: "server-1:tool_29",
              name: "mcp__demo__tool_29",
              description: "Find the final report",
              readOnly: false,
            },
          ],
        },
      },
    ]);
    expect(JSON.stringify(searched)).not.toContain("inputSchema");

    const indexed = await collect({
      tool: search!.name,
      args: {},
      executionId: "index",
      route: search!.route,
    });
    expect(indexed).toEqual([
      {
        type: "result",
        data: {
          index: [
            {
              group: "demo",
              names: Array.from(
                { length: 30 },
                (_, index) => `tool_${String(index).padStart(2, "0")}`,
              ),
            },
          ],
        },
      },
    ]);
    expect(JSON.stringify(indexed)).not.toContain("inputSchema");
    expect(search!.description).toContain("demo:");
    expect(search!.description).toContain("tool_00");

    const expanded = await collect({
      tool: search!.name,
      args: { group: "demo" },
      executionId: "group",
      route: search!.route,
    });
    expect(expanded).toEqual([
      {
        type: "result",
        data: {
          group: "demo",
          names: Array.from({ length: 30 }, (_, index) => `tool_${String(index).padStart(2, "0")}`),
        },
      },
    ]);

    const loaded = await collect({
      tool: load!.name,
      args: { id: "server-1:tool_29" },
      executionId: "load",
      route: load!.route,
    });
    expect(loaded).toEqual([
      expect.objectContaining({
        type: "result",
        data: expect.objectContaining({
          id: "server-1:tool_29",
          inputSchema: expect.objectContaining({ required: ["value"] }),
        }),
      }),
    ]);

    await expect(
      connector.resolveCall(
        {
          tool: execute!.name,
          args: { id: "mcp__demo__missing", arguments: { value: "x" } },
          executionId: "unknown",
          route: execute!.route,
        },
        context,
      ),
    ).rejects.toThrow("unknown or not authorized");
    await expect(
      connector.resolveCall(
        {
          tool: execute!.name,
          args: { id: "server-1:tool_29", arguments: {} },
          executionId: "invalid",
          route: execute!.route,
        },
        context,
      ),
    ).rejects.toThrow("arguments are invalid");

    const resolved = await connector.resolveCall(
      {
        tool: execute!.name,
        args: { id: "server-1:tool_29", arguments: { value: "ok" } },
        executionId: "execute",
        route: execute!.route,
      },
      context,
    );
    expect(resolved).toMatchObject({
      tool: { name: "mcp__demo__tool_29" },
      call: {
        tool: "mcp__demo__tool_29",
        args: { value: "ok" },
        route: { connectorId: "mcp", resourceId: "server-1", toolName: "tool_29" },
      },
    });
    expect(await collect(resolved!.call)).toMatchObject([{ type: "result" }]);
    expect(state.calls).toEqual(["tool_29"]);
    await connector.close();
  });

  it("executes authoritative MCP tools whose names match catalog controls", async () => {
    const state = {
      failNext: false,
      initializations: 0,
      calls: [] as string[],
      tools: ["__catalog_search", "__catalog_load", "__catalog_execute"].map((name) => ({
        name,
        inputSchema: { type: "object" },
      })),
    };
    vi.stubGlobal("fetch", mcpFetch(state));
    const prisma = {
      botMcpServer: {
        findMany: vi.fn().mockResolvedValue([ASSIGNMENT]),
        findFirst: vi.fn().mockResolvedValue(ASSIGNMENT),
      },
    };
    const connector = new McpConnector(prisma as never, {} as never, {
      network: TEST_NETWORK,
    });
    const context = {
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
    } as never;

    for (const tool of await connector.discoverTools(context)) {
      const call = { tool: tool.name, args: {}, executionId: tool.name, route: tool.route };
      await expect(connector.resolveCall(call, context)).resolves.toBeUndefined();
      const events = [];
      for await (const event of connector.execute(call, context)) events.push(event);
      expect(events).toMatchObject([{ type: "result" }]);
    }
    expect(state.calls).toEqual(["__catalog_search", "__catalog_load", "__catalog_execute"]);
    await connector.close();
  });

  it.each(["localhost", "127.0.0.1", "[::1]"])(
    "blocks OAuth rediscovery to HTTP %s after invalid_client from a public server",
    async (host) => {
      const requests: Array<{ method: string; url: string }> = [];
      const metadataUrl = `http://${host}:8123/private-probe`;
      const provider = new StoredMcpOAuthProvider(
        "server-1",
        {
          oauth: {
            redirectUri: "https://app.example.test/mcp/oauth/callback",
            tokens: {
              access_token: "fake-stale-access",
              refresh_token: "fake-refresh",
              token_type: "bearer",
            },
            clientInformation: { client_id: "fake-client" },
            discoveryState: {
              authorizationServerUrl: "https://auth.example.test",
              resourceMetadata: {
                resource: SERVER.endpoint,
                authorization_servers: ["https://auth.example.test"],
              },
              authorizationServerMetadata: {
                issuer: "https://auth.example.test",
                authorization_endpoint: "https://auth.example.test/authorize",
                token_endpoint: "https://auth.example.test/token",
                response_types_supported: ["code"],
              },
            },
          },
        },
        async () => undefined,
      );
      const invalidate = vi.spyOn(provider, "invalidateCredentials");
      const connector = new McpConnector(
        { botMcpServer: { findMany: vi.fn().mockResolvedValue([ASSIGNMENT]) } } as never,
        {} as never,
        {
          network: {
            resolveHostname: async () => [{ address: "203.0.113.10", family: 4 }],
            fetch: vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
              const request = new Request(input, init);
              const url = logicalHref(input, init);
              requests.push({ method: request.method, url });
              if (url === SERVER.endpoint) {
                return new Response(null, {
                  status: 401,
                  headers: { "WWW-Authenticate": `Bearer resource_metadata="${metadataUrl}"` },
                });
              }
              if (url === "https://auth.example.test/token") {
                return Response.json({ error: "invalid_client" }, { status: 400 });
              }
              return new Response(null, { status: 404 });
            }),
          },
        },
        { providerFor: vi.fn().mockResolvedValue(provider) } as unknown as McpOAuthBroker,
      );

      try {
        await expect(
          connector.discoverTools({
            spaceId: "w1",
            userId: "u1",
            botId: "bot-1",
            signal: new AbortController().signal,
          } as never),
        ).resolves.toEqual([]);

        expect(requests.slice(0, 2).map((request) => `${request.method} ${request.url}`)).toEqual([
          `POST ${SERVER.endpoint}`,
          "POST https://auth.example.test/token",
        ]);
        expect(invalidate).toHaveBeenCalledWith("all");
        expect(requests.some((request) => request.url === metadataUrl)).toBe(false);
        // The endpoint-origin compatibility retry remains allowed, through remote policy.
        expect(
          requests.some((request) => request.url === "https://mcp.example.test/private-probe"),
        ).toBe(true);
        expect(requests.every((request) => new URL(request.url).protocol === "https:")).toBe(true);
      } finally {
        await connector.close();
      }
    },
  );

  it("connects to an explicitly configured localhost HTTP server", async () => {
    const state = { failNext: false, initializations: 0 };
    const localAssignment = {
      ...ASSIGNMENT,
      server: { ...SERVER, endpoint: "http://localhost:8123/api/mcp" },
    };
    vi.stubGlobal("fetch", mcpFetch(state, "http://localhost:8123/api/mcp"));
    const prisma = {
      botMcpServer: { findMany: vi.fn().mockResolvedValue([localAssignment]) },
      deploymentSettings: { findUnique: vi.fn(async () => ({ ownerUserId: "u1" })) },
    };
    const connector = new McpConnector(prisma as never, {} as never);

    const tools = await connector.discoverTools({
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
    } as never);

    expect(tools.map((tool) => tool.name)).toEqual(["mcp__demo__echo"]);
    await connector.close();
  });

  it("sends stored credentials to an explicitly configured localhost HTTP server", async () => {
    const state = { failNext: false, initializations: 0, headers: [] as Record<string, string>[] };
    const localAssignment = {
      ...ASSIGNMENT,
      server: { ...SERVER, endpoint: "http://localhost:8123/api/mcp", secretId: "secret-1" },
    };
    vi.stubGlobal("fetch", mcpFetch(state, "http://localhost:8123/api/mcp"));
    const prisma = {
      botMcpServer: { findMany: vi.fn().mockResolvedValue([localAssignment]) },
      secret: { findFirst: vi.fn().mockResolvedValue({ id: "secret-1", ciphertext: "encrypted" }) },
      deploymentSettings: { findUnique: vi.fn(async () => ({ ownerUserId: "u1" })) },
    };
    const connector = new McpConnector(
      prisma as never,
      {
        load: vi
          .fn()
          .mockReturnValue(
            JSON.stringify({ secret: "local-token", headers: { "X-Api-Key": "local-key" } }),
          ),
      } as never,
    );

    await connector.discoverTools({
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
    } as never);

    expect(state.headers[0]?.authorization).toBe("Bearer local-token");
    expect(state.headers[0]?.["x-api-key"]).toBe("local-key");
    await connector.close();
  });

  it("evicts a session after a failed call so the next call reconnects instead of reusing a dead session", async () => {
    const state = { failNext: false, initializations: 0 };
    vi.stubGlobal("fetch", mcpFetch(state));
    const prisma = {
      botMcpServer: {
        findMany: vi.fn().mockResolvedValue([ASSIGNMENT]),
        findFirst: vi.fn().mockResolvedValue(ASSIGNMENT),
      },
    };
    const connector = new McpConnector(prisma as never, {} as never, {
      network: TEST_NETWORK,
    });
    const context = {
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
    } as never;
    const call = {
      tool: "mcp__demo__echo",
      args: {},
      route: { connectorId: "mcp", resourceId: "server-1", toolName: "echo" },
    } as never;

    const tools = await connector.discoverTools(context);
    expect(tools.map((tool) => tool.name)).toEqual(["mcp__demo__echo"]);
    expect(state.initializations).toBe(1);

    state.failNext = true;
    const failed: unknown[] = [];
    for await (const event of connector.execute(call, context)) failed.push(event);
    expect(failed).toMatchObject([{ type: "error" }]);

    state.failNext = false;
    const events: unknown[] = [];
    for await (const event of connector.execute(call, context)) events.push(event);
    expect(events).toMatchObject([{ type: "result" }]);
    expect(state.initializations).toBe(2);

    await connector.close();
  });

  it("does not reuse one session across workspaces", async () => {
    const state = { failNext: false, initializations: 0 };
    vi.stubGlobal("fetch", mcpFetch(state));
    const prisma = {
      botMcpServer: {
        findMany: vi.fn().mockResolvedValue([ASSIGNMENT]),
        findFirst: vi.fn().mockResolvedValue(ASSIGNMENT),
      },
    };
    const connector = new McpConnector(prisma as never, {} as never, {
      network: TEST_NETWORK,
    });
    const contextFor = (spaceId: string, userId: string) =>
      ({ spaceId, userId, botId: "bot-1", signal: new AbortController().signal }) as never;

    await connector.discoverTools(contextFor("w1", "u1"));
    expect(state.initializations).toBe(1);

    await connector.discoverTools(contextFor("w1", "u2"));
    expect(state.initializations).toBe(2);

    await connector.discoverTools(contextFor("w2", "u1"));
    expect(state.initializations).toBe(3);

    await connector.discoverTools(contextFor("w1", "u1"));
    expect(state.initializations).toBe(3);

    await connector.close();
  });
});

describe("MCP connector private endpoints", () => {
  const privateAssignment = {
    ...ASSIGNMENT,
    server: { ...SERVER, endpoint: "http://10.0.0.8:3927/mcp" },
  };
  const lanDnsAssignment = {
    ...ASSIGNMENT,
    server: { ...SERVER, endpoint: "https://mcp.lan.test/mcp" },
  };

  it("does not connect a private IP for a non-owner when the instance escape is off", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const connector = new McpConnector(
      {
        botMcpServer: { findMany: vi.fn().mockResolvedValue([privateAssignment]) },
        deploymentSettings: { findUnique: vi.fn(async () => ({ ownerUserId: "owner" })) },
      } as never,
      {} as never,
      { network: { fetch, resolveHostname: async () => [{ address: "10.0.0.8", family: 4 }] } },
    );
    const tools = await connector.discoverTools({
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
    } as never);
    expect(tools).toEqual([]);
    expect(fetch).not.toHaveBeenCalled();
    await connector.close();
  });

  it.each(["http://localhost:3100/api/auth/get-session", "https://127.0.0.1:3100/mcp"])(
    "does not connect loopback %s for a non-owner",
    async (endpoint) => {
      const fetch = vi.fn();
      vi.stubGlobal("fetch", fetch);
      const connector = new McpConnector(
        {
          botMcpServer: {
            findMany: vi
              .fn()
              .mockResolvedValue([{ ...ASSIGNMENT, server: { ...SERVER, endpoint } }]),
          },
          deploymentSettings: { findUnique: vi.fn(async () => ({ ownerUserId: "owner" })) },
        } as never,
        {} as never,
        { network: { fetch, resolveHostname: async () => [{ address: "127.0.0.1", family: 4 }] } },
      );
      const tools = await connector.discoverTools({
        spaceId: "w1",
        userId: "u1",
        botId: "bot-1",
        signal: new AbortController().signal,
      } as never);
      expect(tools).toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
      await connector.close();
    },
  );

  it("connects a private IP when the current user is the deployment owner", async () => {
    const state = { failNext: false, initializations: 0 };
    vi.stubGlobal("fetch", mcpFetch(state, "http://10.0.0.8:3927/mcp"));
    const connector = new McpConnector(
      {
        botMcpServer: { findMany: vi.fn().mockResolvedValue([privateAssignment]) },
        deploymentSettings: { findUnique: vi.fn(async () => ({ ownerUserId: "u1" })) },
      } as never,
      {} as never,
      {
        network: {
          fetch: (input, init) => globalThis.fetch(input, init),
          resolveHostname: async () => [{ address: "10.0.0.8", family: 4 }],
        },
      },
    );
    const tools = await connector.discoverTools({
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
    } as never);
    expect(tools.map((tool) => tool.name)).toEqual(["mcp__demo__echo"]);
    await connector.close();
  });

  it("connects a private-resolving DNS name when the current user is the deployment owner", async () => {
    const state = { failNext: false, initializations: 0 };
    vi.stubGlobal("fetch", mcpFetch(state, "https://mcp.lan.test/mcp"));
    const connector = new McpConnector(
      {
        botMcpServer: { findMany: vi.fn().mockResolvedValue([lanDnsAssignment]) },
        deploymentSettings: { findUnique: vi.fn(async () => ({ ownerUserId: "u1" })) },
      } as never,
      {} as never,
      {
        network: {
          fetch: (input, init) => globalThis.fetch(input, init),
          resolveHostname: async () => [{ address: "10.0.0.8", family: 4 }],
        },
      },
    );
    const tools = await connector.discoverTools({
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
    } as never);
    expect(tools.map((tool) => tool.name)).toEqual(["mcp__demo__echo"]);
    await connector.close();
  });
});

describe("allowlistDrift", () => {
  it("names the allowed tools the server no longer offers", () => {
    const offered = [{ name: "echo" }, { name: "upper" }];
    expect(allowlistDrift(["echo", "vanished_tool"], offered)).toEqual({
      missing: ["vanished_tool"],
      offered: 2,
      stringAllowedCount: 2,
    });
    expect(allowlistDrift(["echo"], offered).missing).toEqual([]);
    // allowedTools is a Json column, so it can hold anything: it must not throw.
    expect(allowlistDrift(null, offered)).toEqual({
      missing: [],
      offered: 2,
      stringAllowedCount: 0,
    });
    // Non-string JSON values are ignored for both missing and the warning ratio.
    expect(allowlistDrift([42, "vanished_tool"], offered)).toEqual({
      missing: ["vanished_tool"],
      offered: 2,
      stringAllowedCount: 1,
    });
  });
});

describe("MCP connector Finance agent", () => {
  it("exposes and runs only read tools for the Finance agent even with allowAllTools", async () => {
    const endpoint = "https://api.brex.com/mcp";
    const assignment = {
      ...ASSIGNMENT,
      bot: { spawnKey: "finance-agent:u1" },
      server: { ...SERVER, endpoint },
    };
    const state = {
      failNext: false,
      initializations: 0,
      calls: [] as string[],
      tools: ["list_expenses", "lock_card"].map((name) => ({
        name,
        inputSchema: { type: "object" },
      })),
    };
    vi.stubGlobal("fetch", mcpFetch(state, endpoint));
    const connector = new McpConnector(
      {
        botMcpServer: {
          findMany: vi.fn().mockResolvedValue([assignment]),
          findFirst: vi.fn().mockResolvedValue(assignment),
        },
      } as never,
      {} as never,
      { network: TEST_NETWORK },
    );
    const context = {
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
    } as never;
    const tools = await connector.discoverTools(context);
    expect(tools.map((tool) => tool.name)).toEqual(["mcp__demo__list_expenses"]);
    const events: unknown[] = [];
    for await (const event of connector.execute(
      {
        tool: "mcp__demo__lock_card",
        args: {},
        route: { connectorId: "mcp", resourceId: "server-1", toolName: "lock_card" },
      } as never,
      context,
    ))
      events.push(event);
    expect(events).toMatchObject([{ type: "error" }]);
    expect(state.calls).toEqual([]);
    await connector.close();
  });
});

describe("MCP connector integration agents", () => {
  const endpoint = "https://mcp.mercury.com/mcp";
  const agentServer = {
    ...SERVER,
    endpoint,
    name: "Mercury",
    spaceId: "w1",
    userId: "u1",
    writesEnabled: false,
    agentBotId: "agent-1",
    agentExclusive: false,
  };
  const agentBot = {
    id: "agent-1",
    spawnKey: "integration-agent:server-1",
    spaceId: "w1",
    userId: "u1",
    archivedAt: null,
  };
  const TOOLS = [
    { name: "getAccounts", inputSchema: { type: "object" } },
    { name: "requestSendMoney", inputSchema: { type: "object" } },
    { name: "mystery", inputSchema: { type: "object" } },
    { name: "annotatedRead", inputSchema: { type: "object" }, annotations: { readOnlyHint: true } },
  ];

  async function setup(
    botId: string,
    bot: {
      id?: string;
      spawnKey: string | null;
      spaceId?: string;
      userId?: string;
      archivedAt?: Date | null;
    },
    server: Record<string, unknown>,
  ) {
    const assignment = {
      ...ASSIGNMENT,
      botId,
      bot: { id: botId, archivedAt: null, ...bot },
      server: { ...agentServer, ...server },
    };
    const state = {
      failNext: false,
      initializations: 0,
      listings: 0,
      calls: [] as string[],
      tools: TOOLS,
    };
    vi.stubGlobal("fetch", mcpFetch(state, endpoint));
    const findFirst = vi.fn().mockImplementation(async () => assignment);
    const connector = new McpConnector(
      {
        botMcpServer: {
          findMany: vi.fn().mockImplementation(async () => [assignment]),
          findFirst,
        },
      } as never,
      {} as never,
      { network: TEST_NETWORK },
    );
    const context = {
      spaceId: "w1",
      userId: "u1",
      botId,
      signal: new AbortController().signal,
    } as never;
    const call = async (toolName: string, discoveredReadOnly?: boolean) => {
      const events: Array<{ type: string; message?: string }> = [];
      for await (const event of connector.execute(
        {
          tool: `mcp__demo__${toolName}`,
          args: {},
          route: {
            connectorId: "mcp",
            resourceId: "server-1",
            toolName,
            endpoint,
            discoveredReadOnly,
          },
        } as never,
        context,
      ))
        events.push(event as never);
      return events;
    };
    const names = async () => (await connector.discoverTools(context)).map((t) => t.name.slice(11));
    return { connector, state, call, names, assignment, findFirst };
  }

  it("coalesces discovery and uses one tool list per session within the TTL for preset calls", async () => {
    const { connector, state, call, names } = await setup("agent-1", agentBot, {
      writesEnabled: true,
    });
    try {
      const discovered = await Promise.all([names(), names(), names()]);
      expect(discovered[0]).toContain("getAccounts");
      expect(discovered[1]).toEqual(discovered[0]);
      expect(discovered[2]).toEqual(discovered[0]);
      expect(await call("getAccounts", true)).toMatchObject([{ type: "result" }]);
      expect(await call("requestSendMoney", false)).toMatchObject([{ type: "result" }]);
      await names();
      expect(state.initializations).toBe(1);
      expect(state.listings).toBe(1);
    } finally {
      await connector.close();
    }
  });

  it("refreshes expired metadata and coalesces the refresh", async () => {
    const { connector, state, names } = await setup("agent-1", agentBot, {});
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000);
    try {
      expect(await names()).toContain("annotatedRead");
      state.tools = TOOLS.filter((tool) => tool.name !== "annotatedRead");
      clock.mockReturnValue(30_999);
      expect(await names()).toContain("annotatedRead");
      expect(state.listings).toBe(1);
      clock.mockReturnValue(31_000);
      const refreshed = await Promise.all([names(), names()]);
      expect(refreshed).toEqual([["getAccounts"], ["getAccounts"]]);
      expect(state.listings).toBe(2);
    } finally {
      clock.mockRestore();
      await connector.close();
    }
  });

  it("does not reuse metadata after a session revision changes", async () => {
    const { connector, state, names, assignment } = await setup("agent-1", agentBot, {});
    try {
      expect(await names()).toContain("annotatedRead");
      state.tools = TOOLS.filter((tool) => tool.name !== "annotatedRead");
      assignment.server.revision += 1;
      expect(await names()).toEqual(["getAccounts"]);
      expect(state.initializations).toBe(2);
      expect(state.listings).toBe(2);
    } finally {
      await connector.close();
    }
  });

  it("never falls back to expired metadata when a refresh fails", async () => {
    const { connector, state, names } = await setup("agent-1", agentBot, {});
    const clock = vi.spyOn(Date, "now").mockReturnValue(1_000);
    try {
      await names();
      clock.mockReturnValue(31_000);
      state.failNext = true;
      expect(await names()).toEqual([]);
      state.failNext = false;
      state.tools = TOOLS.filter((tool) => tool.name !== "annotatedRead");
      expect(await names()).toEqual(["getAccounts"]);
      expect(state.initializations).toBe(2);
      expect(state.listings).toBe(2);
    } finally {
      clock.mockRestore();
      await connector.close();
    }
  });

  it("revalidates annotation-dependent dispatch even while discovery metadata is cached", async () => {
    for (const [botId, bot] of [
      ["agent-1", agentBot],
      ["other", { spawnKey: null }],
    ] as const) {
      const { connector, state, names, call } = await setup(botId, bot, { writesEnabled: true });
      try {
        expect(await names()).toContain("annotatedRead");
        state.tools = TOOLS.map((tool) =>
          tool.name === "annotatedRead" ? { ...tool, annotations: { readOnlyHint: false } } : tool,
        );
        expect(await call("annotatedRead", true)).toMatchObject([{ type: "error" }]);
        expect(state.calls).toEqual([]);
        expect(state.listings).toBe(2);
      } finally {
        await connector.close();
      }
    }
  });

  it("lists fresh metadata on request while the cached listing is still valid", async () => {
    const { connector, state, assignment } = await setup("agent-1", agentBot, {});
    const context = {
      spaceId: "w1",
      userId: "u1",
      botId: "agent-1",
      signal: new AbortController().signal,
    } as never;
    try {
      const names = async (fresh?: boolean) =>
        (await connector.listServerTools(assignment.server as never, context, { fresh })).map(
          (tool) => tool.name,
        );
      expect(await names()).toContain("annotatedRead");
      state.tools = TOOLS.filter((tool) => tool.name !== "annotatedRead");
      expect(await names()).toContain("annotatedRead");
      expect(await names(true)).not.toContain("annotatedRead");
    } finally {
      await connector.close();
    }
  });

  it("denies a non-agent bot everything on an exclusive server, with the ask-the-agent message", async () => {
    const { connector, state, call, names } = await setup(
      "other",
      { spawnKey: null },
      { agentExclusive: true },
    );
    expect(await names()).toEqual([]);
    const events = await call("getAccounts");
    expect(events).toEqual([
      {
        type: "error",
        message: "This tool belongs to the Mercury agent. Ask it with message_bot.",
      },
    ]);
    expect(state.calls).toEqual([]);
    await connector.close();
  });

  it("limits a non-agent bot to read tools on a shared server", async () => {
    const { connector, state, call, names } = await setup("other", { spawnKey: null }, {});
    expect(await names()).toEqual(["getAccounts", "annotatedRead"]);
    expect(await call("requestSendMoney")).toMatchObject([{ type: "error" }]);
    expect(await call("mystery")).toMatchObject([{ type: "error" }]);
    expect(await call("getAccounts")).toMatchObject([{ type: "result" }]);
    expect(state.calls).toEqual(["getAccounts"]);
    await connector.close();
  });

  it("gives the agent reads, and writes only while writesEnabled is on", async () => {
    const { connector, state, call, names, assignment } = await setup("agent-1", agentBot, {});
    expect(await names()).toEqual(["getAccounts", "annotatedRead"]);
    expect(await call("requestSendMoney")).toMatchObject([{ type: "error" }]);
    expect(state.calls).toEqual([]);
    assignment.server.writesEnabled = true; // read fresh on every call
    expect(await names()).toEqual(["getAccounts", "requestSendMoney", "mystery", "annotatedRead"]);
    expect(await call("requestSendMoney")).toMatchObject([{ type: "result" }]);
    assignment.server.writesEnabled = false;
    expect(await call("requestSendMoney")).toMatchObject([{ type: "error" }]);
    expect(state.calls).toEqual(["requestSendMoney"]);
    await connector.close();
  });

  it("marks the agent's tools read or write so the executor can require approval", async () => {
    const { connector, assignment } = await setup("agent-1", agentBot, { writesEnabled: true });
    const context = {
      spaceId: "w1",
      userId: "u1",
      botId: "agent-1",
      signal: new AbortController().signal,
    } as never;
    const tools = await connector.discoverTools(context);
    expect(Object.fromEntries(tools.map((t) => [t.route?.toolName, t.readOnly]))).toEqual({
      getAccounts: true,
      requestSendMoney: false,
      mystery: false,
      annotatedRead: true,
    });
    expect(assignment).toBeDefined();
    await connector.close();
  });

  it("does not trust agentBotId alone: the bot must match the server's space and user", async () => {
    for (const bot of [
      { ...agentBot, spaceId: "w2" },
      { ...agentBot, userId: "u2" },
      { ...agentBot, spawnKey: "integration-agent:server-2" },
      { spawnKey: null },
    ]) {
      const { connector, call, names } = await setup("agent-1", bot, { writesEnabled: true });
      expect(await names()).not.toContain("requestSendMoney");
      expect(await call("requestSendMoney")).toMatchObject([{ type: "error" }]);
      await connector.close();
    }
  });

  it("keeps an integration agent off every server but its own", async () => {
    const { connector, names } = await setup(
      "agent-9",
      { spawnKey: "integration-agent:server-9", spaceId: "w1", userId: "u1" },
      { agentBotId: null },
    );
    expect(await names()).toEqual([]);
    await connector.close();
  });

  it("leaves a server without an agent unchanged, and ignores exclusive without an agent", async () => {
    const { connector, call, names } = await setup(
      "other",
      { spawnKey: null },
      { agentBotId: null, agentExclusive: true },
    );
    expect(await names()).toEqual(["getAccounts", "requestSendMoney", "mystery", "annotatedRead"]);
    expect(await call("requestSendMoney")).toMatchObject([{ type: "result" }]);
    await connector.close();
  });

  it("refuses a tool that was a read at discovery and is a write at dispatch", async () => {
    const { connector, state, call } = await setup("agent-1", agentBot, { writesEnabled: true });
    // requestSendMoney is a forced write now; discovery recorded it as a read.
    expect(await call("requestSendMoney", true)).toMatchObject([
      { type: "error", message: expect.stringContaining("changed from a read") },
    ]);
    expect(state.calls).toEqual([]);
    // Classified as a write at discovery, the executor asked, so it runs.
    expect(await call("requestSendMoney", false)).toMatchObject([{ type: "result" }]);
    // A true read stays a read.
    expect(await call("getAccounts", true)).toMatchObject([{ type: "result" }]);
    await connector.close();
  });

  it("authorizes on the server row read after listTools, not before", async () => {
    const { connector, state, call, assignment, findFirst } = await setup("agent-1", agentBot, {
      writesEnabled: true,
    });
    let reads = 0;
    findFirst.mockImplementation(async () => ({
      ...assignment,
      server: { ...assignment.server, writesEnabled: ++reads === 1 },
    }));
    expect(await call("requestSendMoney", false)).toMatchObject([{ type: "error" }]);
    expect(reads).toBe(2);
    expect(state.calls).toEqual([]);
    await connector.close();
  });

  it("authorizes on the row read after the session is ready, not before", async () => {
    const { connector, state, call, assignment } = await setup("agent-1", agentBot, {
      writesEnabled: true,
    });
    const inner = connector as never as { sessionFor: (...a: unknown[]) => Promise<unknown> };
    const real = inner.sessionFor.bind(connector);
    let sessions = 0;
    // The switch flips while the second session setup (secret revalidation) waits.
    inner.sessionFor = async (...args) => {
      const session = await real(...args);
      if (++sessions === 2) assignment.server.writesEnabled = false;
      return session;
    };
    expect(await call("requestSendMoney", false)).toMatchObject([{ type: "error" }]);
    expect(state.calls).toEqual([]);
    await connector.close();
  });

  it("refuses the call when the server was edited while the session was being set up", async () => {
    for (const edit of [
      (server: Record<string, unknown>) => (server.revision = 2),
      (server: Record<string, unknown>) => (server.secretId = "secret-2"),
      (server: Record<string, unknown>) => (server.endpoint = "https://mcp.brex.com/mcp"),
    ]) {
      const { connector, state, call, assignment } = await setup("agent-1", agentBot, {
        writesEnabled: true,
      });
      const inner = connector as never as { sessionFor: (...a: unknown[]) => Promise<unknown> };
      const real = inner.sessionFor.bind(connector);
      let sessions = 0;
      inner.sessionFor = async (...args) => {
        const session = await real(...args);
        if (++sessions === 2) edit(assignment.server);
        return session;
      };
      expect(await call("requestSendMoney", false)).toMatchObject([
        { type: "error", message: expect.stringContaining("changed while") },
      ]);
      expect(state.calls).toEqual([]);
      await connector.close();
    }
  });

  it("refuses the call when the server changed during the live tool listing", async () => {
    for (const edit of [
      (server: Record<string, unknown>) => (server.revision = 2),
      (server: Record<string, unknown>) => (server.secretId = "secret-2"),
      (server: Record<string, unknown>) => (server.endpoint = "https://mcp.brex.com/mcp"),
    ]) {
      const { connector, state, call, assignment } = await setup("agent-1", agentBot, {
        writesEnabled: true,
      });
      const inner = connector as never as { sessionFor: (...a: unknown[]) => Promise<unknown> };
      const real = inner.sessionFor.bind(connector);
      let sessions = 0;
      // The annotations come from the first session; the edit lands while it is listing.
      inner.sessionFor = async (...args) => {
        const session = await real(...args);
        if (++sessions === 1) edit(assignment.server);
        return session;
      };
      expect(await call("annotatedRead", true)).toMatchObject([
        { type: "error", message: expect.stringContaining("changed while") },
      ]);
      expect(state.calls).toEqual([]);
      await connector.close();
    }
  });

  it("refuses the call when the session was replaced after the tools were listed", async () => {
    const { connector, state, call } = await setup("agent-1", agentBot, { writesEnabled: true });
    const inner = connector as never as {
      sessionFor: (...a: unknown[]) => Promise<unknown>;
      sessions: Map<string, unknown>;
    };
    const real = inner.sessionFor.bind(connector);
    let sessions = 0;
    // A rotated secret under the same id evicts the session; the next one is a different session,
    // and on it the tool is a write.
    inner.sessionFor = async (...args) => {
      if (++sessions === 2) {
        inner.sessions.clear();
        state.tools = state.tools.map((tool) => ({ ...tool, annotations: undefined }));
      }
      return real(...args);
    };
    expect(await call("annotatedRead", true)).toMatchObject([
      { type: "error", message: expect.stringContaining("changed while") },
    ]);
    expect(state.calls).toEqual([]);
    await connector.close();
  });

  it("denies an integration agent every tool of an unrelated server without an agent", async () => {
    const { connector, state, call, names } = await setup(
      "agent-9",
      { spawnKey: "integration-agent:server-9", spaceId: "w1", userId: "u1" },
      { agentBotId: null, agentExclusive: false, writesEnabled: true },
    );
    expect(await names()).toEqual([]);
    for (const tool of ["getAccounts", "annotatedRead", "requestSendMoney"])
      expect(await call(tool)).toMatchObject([{ type: "error" }]);
    expect(state.calls).toEqual([]);
    await connector.close();
  });
});

describe("MCP connector scoped to chosen servers", () => {
  const endpoint = "https://mcp.example.test/mcp";
  const tools = Array.from({ length: 25 }, (_, index) => ({
    name: `tool${index}`,
    inputSchema: { type: "object" },
    annotations: { readOnlyHint: true },
  }));
  const assignmentFor = (id: string) => ({
    ...ASSIGNMENT,
    serverId: id,
    server: { ...SERVER, id, slug: id, endpoint },
  });

  async function setup() {
    const state = { failNext: false, initializations: 0, calls: [] as string[], tools };
    vi.stubGlobal("fetch", mcpFetch(state, endpoint));
    const assignments = [assignmentFor("linked"), assignmentFor("unlinked")];
    const connector = new McpConnector(
      {
        botMcpServer: {
          findMany: vi.fn().mockImplementation(async ({ where }) =>
            assignments.filter((row) => {
              const ids = where.serverId?.in as string[] | undefined;
              return !ids || ids.includes(row.serverId);
            }),
          ),
          findFirst: vi.fn(),
        },
      } as never,
      {} as never,
      { network: TEST_NETWORK },
    );
    return { connector, state };
  }
  const context = (mcpServerIds?: string[]) =>
    ({
      spaceId: "w1",
      userId: "u1",
      botId: "bot-1",
      signal: new AbortController().signal,
      ...(mcpServerIds ? { mcpServerIds } : {}),
    }) as never;

  it("lists and resolves only the chosen servers' tools, even above the lazy-catalog limit", async () => {
    const { connector } = await setup();
    const call = (id: string) => ({
      tool: "mcp_catalog_execute",
      args: { id, arguments: {} },
      executionId: "e1",
      route: { connectorId: "mcp", toolName: "__catalog_execute" },
    });
    // Both servers together are above the limit, so the model sees search and execute wrappers.
    const all = await connector.discoverTools(context());
    expect(all.every((tool) => !tool.route?.resourceId)).toBe(true);
    const unscoped = await connector.resolveCall(call("mcp__unlinked__tool0"), context());
    expect(unscoped?.tool.route?.resourceId).toBe("unlinked");
    // Scoped to the linked server: its tools are reachable, the other server's are not.
    const scoped = context(["linked"]);
    const linked = await connector.resolveCall(call("mcp__linked__tool0"), scoped);
    expect(linked?.tool.route?.resourceId).toBe("linked");
    await expect(connector.resolveCall(call("mcp__unlinked__tool0"), scoped)).rejects.toThrow();
    await connector.close();
  });
});

describe("MCP connector Carta integration-agent policy", () => {
  const tools = [
    ...CARTA_READ_TOOLS.map((name) => ({ name, inputSchema: { type: "object" } })),
    ...CARTA_WRITE_TOOLS.map((name) => ({
      name,
      inputSchema: { type: "object" },
      annotations: { readOnlyHint: true },
    })),
    {
      name: "unexpectedAnnotatedRead",
      inputSchema: { type: "object" },
      annotations: { readOnlyHint: true },
    },
    {
      name: "unexpectedWrite",
      inputSchema: { type: "object" },
      annotations: { readOnlyHint: false },
    },
  ];

  async function setup(
    options: {
      botId?: string;
      bot?: Record<string, unknown>;
      server?: Record<string, unknown>;
    } = {},
  ) {
    const botId = options.botId ?? "bot-carta";
    const assignment = {
      ...ASSIGNMENT,
      botId,
      allowAllTools: true,
      allowedTools: [],
      bot: {
        id: botId,
        spawnKey: cartaAgentSpawnKey("u1"),
        spaceId: "w1",
        userId: "u1",
        archivedAt: null,
        ...options.bot,
      },
      server: {
        ...SERVER,
        slug: "carta",
        name: "Carta",
        endpoint: CARTA_MCP_ENDPOINT,
        spaceId: "w1",
        userId: "u1",
        agentBotId: botId,
        agentExclusive: true,
        writesEnabled: false,
        agentBot: {
          id: "bot-carta",
          spawnKey: cartaAgentSpawnKey("u1"),
          spaceId: "w1",
          userId: "u1",
          archivedAt: null,
        },
        ...options.server,
      },
    };
    const state = {
      failNext: false,
      initializations: 0,
      listings: 0,
      calls: [] as string[],
      tools,
    };
    vi.stubGlobal("fetch", mcpFetch(state, CARTA_MCP_ENDPOINT));
    const connector = new McpConnector(
      {
        botMcpServer: {
          findMany: vi.fn().mockResolvedValue([assignment]),
          findFirst: vi.fn().mockResolvedValue(assignment),
        },
      } as never,
      {} as never,
      { network: TEST_NETWORK },
    );
    const context = {
      spaceId: "w1",
      userId: "u1",
      botId,
      signal: new AbortController().signal,
    } as never;
    const names = async () =>
      (await connector.discoverTools(context)).map((tool) => tool.route?.toolName);
    const call = async (toolName: string) => {
      const events: Array<{ type: string; message?: string }> = [];
      for await (const event of connector.execute(
        {
          tool: `mcp__carta__${toolName}`,
          args: {},
          route: {
            connectorId: "mcp",
            resourceId: "server-1",
            toolName,
            endpoint: CARTA_MCP_ENDPOINT,
          },
        } as never,
        context,
      ))
        events.push(event as never);
      return events;
    };
    return { assignment, connector, state, names, call };
  }

  it("offers only exact Carta reads with writes off and allows only the exact write set when on", async () => {
    const { assignment, connector, names, call, state } = await setup();
    try {
      expect(await names()).toEqual([...CARTA_READ_TOOLS]);
      expect(await call(CARTA_WRITE_TOOLS[0])).toMatchObject([{ type: "error" }]);
      assignment.server.writesEnabled = true;
      expect(await names()).toEqual([...CARTA_READ_TOOLS, ...CARTA_WRITE_TOOLS]);
      for (const unexpected of ["unexpectedAnnotatedRead", "unexpectedWrite"]) {
        expect(await call(unexpected)).toMatchObject([{ type: "error" }]);
      }
      expect(state.calls).toEqual([]);
    } finally {
      await connector.close();
    }
  });

  it("allows ordinary bots only reads when shared and no Carta tools when exclusive", async () => {
    const shared = await setup({
      botId: "ordinary-bot",
      bot: { id: "ordinary-bot", spawnKey: null },
      server: { agentBotId: "bot-carta", agentExclusive: false, writesEnabled: true },
    });
    try {
      expect(await shared.names()).toEqual([...CARTA_READ_TOOLS]);
      expect(await shared.call(CARTA_WRITE_TOOLS[0])).toMatchObject([{ type: "error" }]);
      expect(shared.state.calls).toEqual([]);
    } finally {
      await shared.connector.close();
    }

    const exclusive = await setup({
      botId: "ordinary-bot",
      bot: { id: "ordinary-bot", spawnKey: null },
      server: { agentBotId: "bot-carta", agentExclusive: true, writesEnabled: true },
    });
    try {
      expect(await exclusive.names()).toEqual([]);
      expect(await exclusive.call(CARTA_READ_TOOLS[0])).toMatchObject([{ type: "error" }]);
      expect(exclusive.state.calls).toEqual([]);
    } finally {
      await exclusive.connector.close();
    }
  });

  it("fails closed for wrong, archived, stranded, or unlinked Carta agent identities", async () => {
    const invalid = [
      {
        botId: "bot-carta",
        bot: { userId: "u2" },
        server: { agentBot: { id: "bot-carta", userId: "u2" } },
      },
      {
        botId: "bot-carta",
        bot: { spaceId: "w2" },
        server: { agentBot: { id: "bot-carta", spaceId: "w2" } },
      },
      {
        botId: "bot-carta",
        bot: { archivedAt: new Date() },
        server: { agentBot: { id: "bot-carta", archivedAt: new Date() } },
      },
      {
        botId: "bot-carta",
        bot: { spawnKey: "carta-agent:u2" },
        server: { agentBot: { id: "bot-carta", spawnKey: "carta-agent:u2" } },
      },
      {
        botId: "stranded-bot",
        bot: { id: "stranded-bot" },
        server: { agentBotId: "stranded-bot" },
      },
      {
        botId: "bot-carta",
        server: { agentBotId: null, agentBot: null },
      },
    ];
    for (const options of invalid) {
      const { connector, names, call, state } = await setup(options);
      try {
        expect(await names()).toEqual([]);
        expect(await call(CARTA_READ_TOOLS[0])).toMatchObject([{ type: "error" }]);
        expect(state.calls).toEqual([]);
      } finally {
        await connector.close();
      }
    }
  });
});

describe("MCP connector Devin agent", () => {
  const endpoint = "https://mcp.devin.ai/mcp";
  const server = {
    ...SERVER,
    endpoint,
    name: "Devin",
    slug: "devin",
    spaceId: "w1",
    userId: "u1",
    writesEnabled: false,
    agentBotId: "agent-1",
    agentExclusive: false,
  };
  const agentBot = {
    id: "agent-1",
    spawnKey: "integration-agent:server-1",
    spaceId: "w1",
    userId: "u1",
    archivedAt: null,
  };
  const tool = (name: string) => ({ name, inputSchema: { type: "object" } });
  const TOOLS = [...DEVIN_READ_TOOLS, ...DEVIN_WRITE_TOOLS, "devin_added_later"].map(tool);

  async function setup(writesEnabled: boolean) {
    const assignment = {
      ...ASSIGNMENT,
      botId: "agent-1",
      bot: agentBot,
      server: { ...server, writesEnabled },
    };
    const state = { failNext: false, initializations: 0, calls: [] as string[], tools: TOOLS };
    vi.stubGlobal("fetch", mcpFetch(state, endpoint));
    const connector = new McpConnector(
      {
        botMcpServer: {
          findMany: vi.fn().mockImplementation(async () => [assignment]),
          findFirst: vi.fn().mockImplementation(async () => assignment),
        },
      } as never,
      {} as never,
      { network: TEST_NETWORK },
    );
    const context = {
      spaceId: "w1",
      userId: "u1",
      botId: "agent-1",
      signal: new AbortController().signal,
    } as never;
    const call = async (toolName: string, discoveredReadOnly: boolean) => {
      const events: Array<{ type: string }> = [];
      for await (const event of connector.execute(
        {
          tool: `mcp__devin__${toolName}`,
          args: {},
          route: {
            connectorId: "mcp",
            resourceId: "server-1",
            toolName,
            endpoint,
            discoveredReadOnly,
          },
        } as never,
        context,
      ))
        events.push(event as never);
      return events;
    };
    return { connector, state, context, call };
  }

  it("marks reads as reads and writes as writes, and hides tools it has not classified", async () => {
    const { connector, context } = await setup(true);
    const tools = await connector.discoverTools(context);
    const byName = Object.fromEntries(tools.map((t) => [t.route?.toolName, t.readOnly]));
    for (const name of DEVIN_READ_TOOLS) expect(byName[name]).toBe(true);
    for (const name of DEVIN_WRITE_TOOLS) expect(byName[name]).toBe(false);
    expect(byName).not.toHaveProperty("devin_added_later");
    await connector.close();
  });

  it("offers no writes until changes are allowed, and refuses them if called", async () => {
    const { connector, context, state, call } = await setup(false);
    const names = (await connector.discoverTools(context)).map((t) => t.route?.toolName);
    expect(names).toEqual([...DEVIN_READ_TOOLS]);
    expect(await call("devin_session_create", false)).toMatchObject([{ type: "error" }]);
    expect(await call("devin_added_later", false)).toMatchObject([{ type: "error" }]);
    expect(await call("devin_session_search", true)).toMatchObject([{ type: "result" }]);
    expect(state.calls).toEqual(["devin_session_search"]);
    await connector.close();
  });

  it("asks the executor to approve each write with the same classification", () => {
    for (const name of DEVIN_WRITE_TOOLS)
      expect(
        isIntegrationAgentWrite(
          "integration-agent:server-1",
          { connectorId: "mcp", endpoint, toolName: name },
          false,
        ),
      ).toBe(true);
    for (const name of DEVIN_READ_TOOLS)
      expect(
        isIntegrationAgentWrite(
          "integration-agent:server-1",
          { connectorId: "mcp", endpoint, toolName: name },
          true,
        ),
      ).toBe(false);
  });
});
