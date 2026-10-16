import type { IntegrationSetupState } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../../stories/fixtures-8";
import { IntegrationSetup } from "./IntegrationSetup";

const state: IntegrationSetupState = {
  canConfigure: true,
  needsSetup: true,
  webUrl: "https://rakazo.example.com",
  providers: [
    { id: "composio", configured: false },
    { id: "pipedream", configured: false },
    { id: "google", configured: false },
  ],
};

const catalog = {
  results: [
    {
      domain: "demo-notes.example.com",
      name: "Demo Notes",
      description: "Take notes",
      pageUrl: null,
      surfaces: [
        {
          kind: "mcp",
          slug: "demo-notes",
          source: "https://demo-notes.example.com/mcp",
          auth: null,
        },
      ],
    },
  ],
};

const pick =
  (label: string) =>
  async ({ canvasElement }: { canvasElement: HTMLElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: label }));
  };

const meta = {
  title: "Integrations/IntegrationSetup",
  component: IntegrationSetup,
  args: { initialState: state },
} satisfies Meta<typeof IntegrationSetup>;
export default meta;
type Story = StoryObj<typeof meta>;

export const AddMcpServer: Story = {};

export const SearchResults: Story = {
  beforeEach: () => mockRpc({ "capabilities.catalogSearch": catalog }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Search apps"), "notes{enter}");
    await canvas.findByText("Demo Notes");
  },
};

export const SearchNoResults: Story = {
  beforeEach: () => mockRpc({ "capabilities.catalogSearch": { results: [] } }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Search apps"), "nothing{enter}");
    await canvas.findByText("No remote MCP servers found");
  },
};

export const SearchError: Story = {
  beforeEach: () =>
    mockRpc({ "capabilities.catalogSearch": () => Promise.reject(new Error("Catalog is down")) }),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.type(canvas.getByLabelText("Search apps"), "notes{enter}");
    await canvas.findByRole("alert");
  },
};

export const WithContinueAndSkip: Story = { args: { onDone: () => undefined } };

export const ServerSetupComposio: Story = {
  args: { serverSetup: true, managedOnly: true },
  parameters: { docs: { description: { component: "Managed-only provider list." } } },
};

export const ServerSetupConnected: Story = {
  args: {
    serverSetup: true,
    initialState: {
      ...state,
      needsSetup: false,
      providers: [{ id: "composio", configured: true }],
    },
    managedOnly: true,
  },
};

export const ServerSetupPipedream: Story = {
  args: { serverSetup: true },
  play: pick("Pipedream"),
};

export const ServerSetupGoogle: Story = {
  args: { serverSetup: true },
  play: pick("Google"),
};

export const ServerSetupExecutor: Story = {
  args: { serverSetup: true },
  play: pick("Executor"),
};

export const ServerSetupComposioForm: Story = {
  args: { serverSetup: true },
  play: pick("Composio"),
};
