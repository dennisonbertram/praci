import type {
  BotMcpServer,
  CapabilityInstall,
  Connection,
  ConnectionCatalogItem,
  McpServer,
} from "@rakazo/contracts";
import type { IntegrationsData } from "../../components/integrations/useIntegrations";
import { mockBots, teamBots } from "./bots";

const STAMP = "2026-01-01T00:00:00.000Z";

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
    writesEnabled: false,
    agentBotId: null,
    agentExclusive: false,
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
    bots: teamBots,
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

/** One connected sample app, for the connect and detail stories. */
export const demoApp: ConnectionCatalogItem = {
  connectorId: "demo",
  slug: "sample-mail",
  name: "Sample Mail",
  logo: null,
  connected: true,
  noAuth: false,
  description: "Read and draft sample email.",
  category: "email_calendar",
};

export const demoConnection = (patch: Partial<Connection> = {}): Connection => ({
  id: "conn_1",
  connectorId: "demo",
  provider: "sample-mail",
  displayName: "Sample Mail",
  status: "connected",
  error: null,
  capabilities: [],
  createdAt: STAMP,
  ...patch,
});

export const demoIntegrations = (patch: Partial<IntegrationsData> = {}): IntegrationsData =>
  mockIntegrations({
    catalog: [demoApp],
    connections: [demoConnection()],
    bots: mockBots.slice(0, 2),
    ...patch,
  });
