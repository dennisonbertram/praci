import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { GtmPage } from "./Gtm";
import { emptyOverview, item, overview, page } from "./gtm/fixtures";

const meta = {
  title: "GTM/Page",
  component: GtmPage,
  args: { botId: "bot_gtm", remote: null, onAskAgent: () => {} },
  parameters: { layout: "fullscreen" },
} satisfies Meta<typeof GtmPage>;
export default meta;
type Story = StoryObj<typeof meta>;
export const Default: Story = {
  beforeEach: () => mockRpc({ "gtm.overview": overview, "pages.get": page }),
};
export const Empty: Story = {
  beforeEach: () =>
    mockRpc({ "gtm.overview": emptyOverview, "pages.get": { ...page, content: "" } }),
};
export const OAuthOnly: Story = {
  beforeEach: () =>
    mockRpc({
      "gtm.overview": { ...overview, postingCapability: "api_key_required" },
      "pages.get": page,
    }),
};
export const Uncertain: Story = {
  beforeEach: () =>
    mockRpc({
      "gtm.overview": {
        ...overview,
        groups: {
          ...overview.groups,
          needs_you: [{ ...item, proof: `post:demo:${"a".repeat(64)}` }],
        },
      },
      "pages.get": page,
      "gtm.queue": { status: "ready", complete: true, posts: [] },
    }),
};
export const Loading: Story = {
  beforeEach: () => mockRpc({ "gtm.overview": () => new Promise(() => {}) }),
};
export const ErrorState: Story = {
  beforeEach: () =>
    mockRpc({ "gtm.overview": () => Promise.reject(new Error("Could not load the GTM plan.")) }),
};
