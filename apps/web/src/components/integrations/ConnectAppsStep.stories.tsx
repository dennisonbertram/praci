import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockCatalog, mockIntegrations } from "../../stories/fixtures";
import { ConnectAppsStep } from "./ConnectAppsStep";

const providers = (configured: boolean) => [
  { id: "composio" as const, configured },
  { id: "pipedream" as const, configured: false },
  { id: "google" as const, configured: false },
];
const setup = (configured = false) => ({
  canConfigure: true,
  needsSetup: !configured,
  webUrl: "https://rakazo.example.com",
  providers: providers(configured),
});
const google = ["Gmail", "Google Calendar", "Google Drive"].map((name) => ({
  ...mockCatalog[0]!,
  connectorId: "google",
  slug: name.toLowerCase().replace(/ /g, ""),
  name,
  description: null,
}));

const meta = {
  title: "Integrations/ConnectAppsStep",
  component: ConnectAppsStep,
  args: {
    data: mockIntegrations({ catalog: [...google, ...mockCatalog] }),
    setup: setup(true),
    onDone: () => undefined,
  },
} satisfies Meta<typeof ConnectAppsStep>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Nothing connected yet: only Skip. */
export const Empty: Story = {};

export const SomeConnected: Story = {
  args: {
    data: mockIntegrations({
      catalog: [...google, ...mockCatalog],
      connections: [
        {
          id: "c1",
          connectorId: "google",
          provider: "gmail",
          displayName: "demo@example.com",
          status: "connected",
          error: null,
          capabilities: [],
          createdAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    }),
  },
};

/** No provider is configured, so every app offers "Set up" and opens the other ways to connect. */
export const ProviderNotConfigured: Story = {
  args: { data: mockIntegrations({ catalog: [] }), setup: setup(false) },
};
