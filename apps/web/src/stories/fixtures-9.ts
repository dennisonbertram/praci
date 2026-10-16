import type {
  Bot,
  BotMcpServer,
  CapabilityInstall,
  Connection,
  ConnectionCatalogItem,
  McpServer,
} from "@rakazo/contracts";
import type { IntegrationsData } from "../components/integrations/useIntegrations";

/** Invented data for batch 9 stories (Integrations and Group pickers). */
const STAMP = "2026-01-01T00:00:00.000Z";

export function mockBot(id: string, name: string, color: string, extra: Partial<Bot> = {}): Bot {
  return {
    id,
    spaceId: "space_demo",
    name,
    title: `${name} helper`,
    description: "",
    instructions: "",
    color,
    notifyOnFinish: false,
    pinned: false,
    sectionId: null,
    archivedAt: null,
    unread: false,
    parentBotId: null,
    memoryScope: null,
    threadId: `thread_${id}`,
    preview: "",
    status: "idle",
    runErrorId: null,
    computerMode: "team",
    updatedAt: STAMP,
    createdAt: STAMP,
    voiceId: null,
    autoSpeak: false,
    modelProvider: null,
    modelId: null,
    thinkingLevel: null,
    teamChatAmbientEnabled: false,
    teamChatRules: "",
    path: "",
    content: "",
    disabledBuiltinTools: [],
    webhookConfigured: false,
    spawnKey: null,
    ...extra,
  } as Bot;
}

export const mockBots: Bot[] = [
  mockBot("bot_ada", "Ada", "#3b82f6"),
  mockBot("bot_bram", "Bram", "#10b981"),
  mockBot("bot_cleo", "Cleo", "#f59e0b", { status: "running" }),
  mockBot("bot_dara", "Dara", "#ef4444"),
];

export const mockCatalog: ConnectionCatalogItem[] = [
  {
    connectorId: "composio",
    slug: "slack",
    name: "Slack",
    logo: null,
    connected: false,
    noAuth: false,
    description: "Read channels and post messages.",
    category: "chat",
  },
  {
    connectorId: "composio",
    slug: "notion",
    name: "Notion",
    logo: null,
    connected: false,
    noAuth: false,
    description: "Search pages and update databases.",
    category: "docs_files",
  },
  {
    connectorId: "composio",
    slug: "github",
    name: "GitHub",
    logo: null,
    connected: false,
    noAuth: false,
    description: "Review pull requests and file issues.",
    category: "developer",
  },
  {
    connectorId: "composio",
    slug: "hubspot",
    name: "Demo CRM",
    logo: null,
    connected: false,
    noAuth: false,
    description: null,
    category: "sales_crm",
  },
];

function conn(
  id: string,
  provider: string,
  displayName: string,
  status: Connection["status"],
  error: string | null = null,
): Connection {
  return {
    id,
    connectorId: "composio",
    provider,
    displayName,
    status,
    error,
    capabilities: [],
    createdAt: STAMP,
  };
}

export const mockConnections: Connection[] = [
  conn("conn_1", "slack", "demo-workspace", "connected"),
  conn("conn_2", "notion", "demo@example.com", "error", "Sign-in was refused."),
  conn("conn_3", "github", "demo-user", "pending"),
];

export function mockServer(id: string, name: string, extra: Partial<McpServer> = {}): McpServer {
  return {
    id,
    spaceId: "space_demo",
    slug: id,
    name,
    description: "",
    transport: "http",
    endpoint: "https://mcp.example.com/sse",
    command: null,
    args: [],
    envKeys: [],
    headerKeys: [],
    hasSecret: false,
    oauthStatus: "connected",
    oauthAttempted: false,
    enabled: true,
    revision: 1,
    createdAt: STAMP,
    updatedAt: STAMP,
    ...extra,
  } as McpServer;
}

export const mockSource: CapabilityInstall = {
  id: "cap_1",
  kind: "mcp",
  name: "Demo tools",
  source: "https://tools.example.com/mcp",
  version: null,
  digest: null,
  secretConfigured: false,
  config: {},
  createdAt: STAMP,
};

export const mockAssignments: BotMcpServer[] = [
  {
    id: "asg_1",
    botId: "bot_ada",
    serverId: "srv_1",
    allowAllTools: true,
    allowedTools: [],
    createdAt: STAMP,
    updatedAt: STAMP,
  },
];

export function mockIntegrations(extra: Partial<IntegrationsData> = {}): IntegrationsData {
  return {
    loaded: true,
    error: null,
    catalog: mockCatalog,
    connections: [],
    servers: [],
    bots: mockBots,
    mcpAssignments: [],
    access: {},
    sources: [],
    financeSources: [],
    setup: null,
    catalogFailed: false,
    feedEnabled: false,
    refresh: async () => undefined,
    ...extra,
  };
}

// The app code gets src/lib/rpc through sb.mock, which Vite bundles as a second copy of
// __mocks__/rpc.ts. Registering responses on that copy (not on a direct import of the mock file)
// is what the app's rpc calls see.
import * as appRpc from "../lib/rpc";

type RpcResponse = unknown | ((input: unknown) => unknown);
export const mockRpc = (map: Record<string, RpcResponse>): void =>
  (appRpc as unknown as { mockRpc: (map: Record<string, RpcResponse>) => void }).mockRpc(map);
