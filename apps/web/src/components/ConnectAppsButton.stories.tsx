import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { ConnectAppsButton } from "./ConnectAppsButton";

// Inline SVGs keep the logos offline; they are not real brand marks.
const logo = (fill: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="${fill}"/></svg>`,
  )}`;

const app = (slug: string, logoUrl: string | null) => ({
  connectorId: "composio",
  slug,
  name: slug,
  logo: logoUrl,
  connected: false,
  noAuth: false,
  description: null,
  category: "other",
});

const meta = {
  title: "Shell/ConnectAppsButton",
  component: ConnectAppsButton,
  args: { active: false, onClick: () => {} },
  decorators: [
    (Story) => (
      <div className="w-64 bg-sidebar py-3">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConnectAppsButton>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Featured apps are unconnected: the row becomes the pill. */
export const Unconnected: Story = {
  beforeEach: () =>
    mockRpc({
      "connections.catalog": [
        app("slack", logo("#888")),
        app("notion", logo("#666")),
        app("gmail", logo("#aaa")),
      ],
      "connections.list": [],
    }),
};

/** Every featured app is connected: the plain Integrations row. */
export const AllConnected: Story = {
  beforeEach: () =>
    mockRpc({
      "connections.catalog": [app("slack", null)],
      "connections.list": [{ connectorId: "composio", provider: "slack", status: "connected" }],
    }),
};

/** A logo that fails to load falls back to the app's first letter. */
export const LogoFallback: Story = {
  beforeEach: () =>
    mockRpc({
      "connections.catalog": [
        app("slack", "data:image/png;base64,broken"),
        app("notion", null),
        app("gmail", "data:image/png;base64,broken"),
      ],
      "connections.list": [],
    }),
};
