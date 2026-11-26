import type { McpServer } from "@rakazo/contracts";
import { BREX_CARDS_MCP_ENDPOINT, ZERNIO_MCP_ENDPOINT } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Navigate, Route, Routes } from "react-router-dom";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { makeBot, mockAssignments, mockIntegrations, mockServer } from "../../stories/fixtures";
import { McpDetail } from "./McpDetail";

const meta = {
  title: "Integrations/McpDetail",
  component: McpDetail,
  parameters: { layout: "fullscreen" },
  // McpDetail reads :serverId from the route, so mount it at its real path.
  render: (args, { parameters }) => (
    <Routes>
      <Route path="/app/integrations/mcp/:serverId" element={<McpDetail {...args} />} />
      <Route path="*" element={<Navigate to={parameters.entry ?? "/"} replace />} />
    </Routes>
  ),
} satisfies Meta<typeof McpDetail>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Connected: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [mockServer("srv_1", "Demo files")],
      mcpAssignments: mockAssignments,
    }),
  },
};

export const ZernioReadOnly: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [
        mockServer("srv_1", "Zernio", {
          endpoint: "https://mcp.zernio.com/mcp",
          agentBotId: "gtm_demo",
          agentExclusive: true,
          writesEnabled: false,
        }),
      ],
      bots: [makeBot({ id: "gtm_demo", name: "GTM agent", spawnKey: "gtm-agent:user_demo" })],
    }),
  },
};

export const ZernioNeedsReconnect: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [
        mockServer("srv_1", "Zernio", {
          endpoint: ZERNIO_MCP_ENDPOINT,
          hasSecret: false,
          oauthStatus: "none",
          oauthAttempted: false,
          agentBotId: "gtm_demo",
          agentExclusive: true,
          writesEnabled: false,
        }),
      ],
      bots: [makeBot({ id: "gtm_demo", name: "GTM agent", spawnKey: "gtm-agent:user_demo" })],
    }),
  },
};

const cartaServer = (writesEnabled: boolean) =>
  mockServer("srv_1", "Carta", {
    endpoint: "https://mcp.app.carta.com/mcp",
    writesEnabled,
    agentBotId: "bot_carta",
    agentExclusive: true,
  });

const cartaBot = makeBot({
  id: "bot_carta",
  name: "Carta agent",
  spawnKey: "carta-agent:user_demo",
});

export const CartaCanCreateAgent: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [{ ...cartaServer(false), agentBotId: null, agentExclusive: false }],
    }),
  },
};

export const CartaWritesOff: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: { data: mockIntegrations({ servers: [cartaServer(false)], bots: [cartaBot] }) },
};

export const CartaWritesOn: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: { data: mockIntegrations({ servers: [cartaServer(true)], bots: [cartaBot] }) },
};

const mercury = (extra: Partial<McpServer> = {}) =>
  mockServer("srv_1", "Mercury", { endpoint: "https://mcp.mercury.com/mcp", ...extra });

/** A bank with no agent yet: the Allow changes switch is the one setup control. */
export const BankNoAgent: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: { data: mockIntegrations({ servers: [mercury()] }) },
};

/** Signed in, but the bank refused the token during a sync: the page matches the tile. */
export const BankNeedsReconnect: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [mercury({ oauthStatus: "connected" })],
      financeSources: [
        { provider: "mercury", serverId: "srv_1", status: "needs_reconnect", lastSyncedAt: null },
      ],
    }),
  },
};

export const CanCreateAgent: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [mockServer("srv_1", "Files", { endpoint: "https://mcp.example.com/sse" })],
    }),
  },
};

/** While the agent is being created every header button is disabled. */
export const CreatingAgent: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  beforeEach: () => mockRpc({ "integrationAgents.create": () => new Promise(() => undefined) }),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Create agent" }),
    );
  },
  args: {
    data: mockIntegrations({
      servers: [mockServer("srv_1", "Files", { endpoint: "https://mcp.example.com/sse" })],
    }),
  },
};

export const WithAgent: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [mercury({ agentBotId: "bot_ada", agentExclusive: true })],
      mcpAssignments: mockAssignments,
    }),
  },
};

export const WithAgentShared: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [mercury({ agentBotId: "bot_ada", agentExclusive: false, writesEnabled: true })],
      mcpAssignments: mockAssignments,
    }),
  },
};

const brexData = mockIntegrations({
  servers: [
    mockServer("srv_1", "Brex cards", {
      slug: "brex-cards",
      transport: "streamable_http",
      endpoint: BREX_CARDS_MCP_ENDPOINT,
      oauthStatus: "none",
      agentBotId: "brex_demo",
      agentExclusive: true,
      writesEnabled: true,
    }),
  ],
  bots: [makeBot({ id: "brex_demo", name: "Brex agent" })],
});

/** The space owner: cards with row buttons, the controls form and Replace token; no sharing control. */
export const BrexCardsOwner: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: { data: brexData },
  beforeEach: () =>
    mockRpc({
      "brexCards.cards": {
        serverId: "srv_1",
        agentBotId: "brex_demo",
        writesEnabled: true,
        cards: [
          {
            cardId: "card_demo_1",
            name: "Design tools",
            lastFour: "4242",
            ownerUserId: "user_demo_1",
            status: "ACTIVE",
            limitCents: 20_000,
            currency: "USD",
            duration: "MONTHLY",
          },
        ],
      },
      "brexCards.getControls": {
        maxNewCardLimitCents: 100_000,
        maxCardLimitCents: 500_000,
        maxSpendLimitBaseCents: 1_000_000,
        maxCardsPerDay: 5,
        allowedDurations: ["MONTHLY", "ONE_TIME"],
        oneTimeMaxDays: 90,
      },
    }),
};

/** Anyone but the current space owner is refused the read and sees none of the owner's sections. */
export const BrexCardsMember: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: { data: brexData },
  beforeEach: () =>
    mockRpc({
      "brexCards.cards": () => {
        throw Object.assign(new Error("Only the space owner can do this."), { code: "FORBIDDEN" });
      },
    }),
};

export const NeedsReconnect: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [mockServer("srv_1", "Demo files", { oauthStatus: "reconnect" })],
    }),
  },
};

export const LocalCommand: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [
        mockServer("srv_1", "Demo local tool", {
          transport: "stdio",
          endpoint: null,
          command: "demo-mcp-server",
          oauthStatus: "none",
        }),
      ],
    }),
  },
};

export const MalformedStoredEndpoint: Story = {
  parameters: { entry: "/app/integrations/mcp/srv_1" },
  args: {
    data: mockIntegrations({
      servers: [
        mockServer("srv_1", "Legacy connection", {
          endpoint: "not-a-url?token=redacted-example",
          oauthStatus: "none",
        }),
      ],
    }),
  },
};

export const NotFound: Story = {
  parameters: { entry: "/app/integrations/mcp/missing" },
  args: { data: mockIntegrations() },
};
