import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockBots, mockRpc } from "../../stories/fixtures-6";
import { CustomConnectionDialog } from "./CustomConnectionDialog";
import type { IntegrationsData } from "./useIntegrations";

const data = {
  loaded: true,
  error: null,
  catalog: [],
  connections: [],
  servers: [],
  bots: mockBots,
  mcpAssignments: [],
  access: {},
  sources: [],
  financeSources: [],
  setup: null,
  catalogFailed: false,
  feedEnabled: true,
  refresh: async () => {},
} satisfies IntegrationsData;

const meta = {
  title: "Integrations/CustomConnectionDialog",
  component: CustomConnectionDialog,
  parameters: { layout: "fullscreen" },
  args: { data, onClose: () => {} },
  decorators: [
    (Story) => (
      <>
        <div className="p-4 text-sm text-muted-foreground">Integrations page behind the dialog</div>
        <Story />
      </>
    ),
  ],
} satisfies Meta<typeof CustomConnectionDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

// Dialog content renders in a portal, so the play functions query the whole document.
const screen = () => within(document.body);

export const Default: Story = {};

export const WithUrl: Story = { args: { initialUrl: "https://example.com/mcp" } };

export const AdvancedOpen: Story = {
  play: async () => {
    await userEvent.click(await screen().findByText("Advanced"));
  },
};

export const InvalidUrl: Story = {
  args: { initialUrl: "not a url" },
  play: async () => {
    await userEvent.click(await screen().findByRole("button", { name: "Connect" }));
  },
};

export const OpenApiSource: Story = {
  play: async () => {
    await userEvent.click(await screen().findByText("Advanced"));
    await userEvent.click(await screen().findByRole("button", { name: "OpenAPI" }));
  },
};

export const LocalCommand: Story = {
  play: async () => {
    await userEvent.click(await screen().findByText("Advanced"));
    await userEvent.click(await screen().findByRole("button", { name: "Local command" }));
  },
};

export const DirectorySearch: Story = {
  beforeEach: () =>
    mockRpc({
      "capabilities.catalogSearch": {
        results: [
          {
            domain: "example.com",
            name: "Sample app",
            description: "An invented app",
            pageUrl: null,
            surfaces: [
              { kind: "mcp", slug: "mcp", source: "https://example.com/mcp", auth: null },
              { kind: "graphql", slug: "gql", source: null, auth: null },
            ],
          },
        ],
      },
    }),
  play: async () => {
    await userEvent.click(await screen().findByText("Advanced"));
    await userEvent.click(await screen().findByRole("button", { name: "Search directory" }));
    await userEvent.type(await screen().findByLabelText("Search"), "sample");
    await userEvent.click(screen().getByRole("button", { name: "Search" }));
  },
};

export const AgentsStep: Story = {
  beforeEach: () =>
    mockRpc({
      "mcp.servers.create": {
        id: "srv_demo",
        name: "Sample server",
        endpoint: "https://example.com/mcp",
      },
    }),
  args: { initialUrl: "https://example.com/mcp" },
  play: async () => {
    await userEvent.click(await screen().findByText("Advanced"));
    await userEvent.type(await screen().findByLabelText("Token"), "sample-token");
    await userEvent.click(screen().getByRole("button", { name: "Connect" }));
  },
};
