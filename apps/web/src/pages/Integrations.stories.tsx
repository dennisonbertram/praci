import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { mockBots, mockRpc, stubExternalImages } from "../stories/fixtures-0";
import { IntegrationsPage } from "./Integrations";

const catalog = [
  {
    connectorId: "demo",
    slug: "sample-mail",
    name: "Sample Mail",
    logo: null,
    connected: true,
    noAuth: false,
    description: "Read and draft sample email.",
    category: "email_calendar",
  },
  {
    connectorId: "demo",
    slug: "sample-chat",
    name: "Sample Chat",
    logo: null,
    connected: false,
    noAuth: false,
    description: "Post to sample channels.",
    category: "chat",
  },
  {
    connectorId: "demo",
    slug: "sample-docs",
    name: "Sample Docs",
    logo: null,
    connected: false,
    noAuth: true,
    description: null,
    category: "docs_files",
  },
];

const connection = {
  id: "conn_1",
  connectorId: "demo",
  provider: "sample-mail",
  displayName: "Sample Mail",
  status: "connected",
  error: null,
  capabilities: [],
  createdAt: "2026-01-01T00:00:00.000Z",
};

const server = {
  id: "srv_1",
  spaceId: "space_demo",
  slug: "sample-tools",
  name: "Sample tools",
  description: "A sample tool server.",
  transport: "http",
  endpoint: "https://tools.example.test/mcp",
  command: null,
  args: [],
  envKeys: [],
  headerKeys: [],
  hasSecret: false,
  oauthStatus: "none",
  oauthAttempted: false,
  enabled: true,
  revision: 1,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

const loaded = (extra: Record<string, unknown> = {}) =>
  mockRpc({
    "connections.catalog": catalog,
    "connections.list": [connection],
    "connections.access": { allAgents: true, botIds: [] },
    "mcp.servers.list": [server],
    "bots.list": mockBots,
    "mcp.assignments.all": [],
    "capabilities.list": [],
    "integrationSetup.get": null,
    "capabilities.catalogSearch": { enabled: false },
    "finance.overview": { sources: [] },
    ...extra,
  });

/** The preview already provides a router; this moves it to the route a story asks for. */
function GoTo({ route, children }: { route?: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  useEffect(() => {
    if (route) navigate(route);
  }, [route, navigate]);
  return <>{children}</>;
}

const meta = {
  title: "Integrations/Page",
  component: IntegrationsPage,
  parameters: { layout: "fullscreen" },
  args: { activeBotId: "bot_ada" },
  decorators: [
    (Story, { parameters }) => (
      <GoTo route={parameters.route}>
        <Story />
      </GoTo>
    ),
  ],
  beforeEach: () => {
    loaded();
    return stubExternalImages();
  },
} satisfies Meta<typeof IntegrationsPage>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Home: Story = {};

export const HomeEmpty: Story = {
  beforeEach: () =>
    loaded({
      "connections.catalog": [],
      "connections.list": [],
      "mcp.servers.list": [],
    }),
};

export const HomeLoadFailed: Story = {
  beforeEach: () =>
    loaded({ "mcp.servers.list": () => Promise.reject(new Error("Could not load integrations")) }),
};

export const McpServerDetail: Story = {
  parameters: { route: "/mcp/srv_1" },
};

export const AppDetail: Story = {
  parameters: { route: "/app/demo/sample-mail" },
};
