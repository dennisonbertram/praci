import type { Bot, Connection, ConnectionCatalogItem } from "@rakazo/contracts";
import type { IntegrationsData } from "../components/integrations/useIntegrations";

/** Invented data shared by the batch 4 integration stories. */
const bot = (id: string, name: string): Bot => ({
  id,
  spaceId: "space_demo",
  name,
  title: "",
  description: "",
  instructions: "",
  color: "#6d5bd0",
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
  updatedAt: "2026-01-01T00:00:00.000Z",
  createdAt: "2026-01-01T00:00:00.000Z",
  voiceId: null,
  autoSpeak: false,
  modelProvider: null,
  modelId: null,
  thinkingLevel: null,
  teamChatAmbientEnabled: false,
  teamChatRules: "",
  disabledBuiltinTools: [],
  webhookConfigured: false,
  spawnKey: null,
});

export const demoBots: Bot[] = [bot("bot_ada", "Ada"), bot("bot_ben", "Ben")];

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
  createdAt: "2026-01-01T00:00:00.000Z",
  ...patch,
});

export const demoIntegrations = (patch: Partial<IntegrationsData> = {}): IntegrationsData => ({
  loaded: true,
  error: null,
  catalog: [demoApp],
  connections: [demoConnection()],
  servers: [],
  bots: demoBots,
  mcpAssignments: [],
  access: {},
  sources: [],
  financeSources: [],
  setup: null,
  catalogFailed: false,
  feedEnabled: false,
  refresh: async () => undefined,
  ...patch,
});

/** A 4x4 gray PNG, as base64 and as a data URL, for image fixtures that must not touch the network. */
export const grayPngBase64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAQAAAAEAQMAAACTPww9AAAAA1BMVEWAgIC8Z6mhAAAACklEQVQI12NgAAAAAgAB4iG8MwAAAABJRU5ErkJggg==";
export const grayPngUrl = `data:image/png;base64,${grayPngBase64}`;
