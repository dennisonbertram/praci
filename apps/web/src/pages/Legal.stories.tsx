import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { LegalPage } from "./Legal";
import {
  consentFixture as consent,
  emptyOverview,
  graph,
  needsKeyOverview,
  overview,
} from "./legal/fixtures";

const never = () => new Promise(() => {});
const fails = () => Promise.reject(new Error("Could not load Legal"));

const meta = {
  title: "Legal/Page",
  component: LegalPage,
  args: { onAskAgent: () => {}, onOpenSettings: () => {} },
} satisfies Meta<typeof LegalPage>;
export default meta;

type Story = StoryObj<typeof meta>;

export const Default: Story = {
  beforeEach: () =>
    mockRpc({ "legal.overview": overview, "legal.consent": consent, "legal.graph": graph }),
};

export const Empty: Story = {
  beforeEach: () => mockRpc({ "legal.overview": emptyOverview, "legal.consent": consent }),
};

export const NeedsConsent: Story = {
  beforeEach: () =>
    mockRpc({
      "legal.overview": emptyOverview,
      "legal.consent": { ...consent, allowed: false },
    }),
};

/** No OpenRouter key of the user's own: the notice names the fix and Scan now says why it is off. */
export const NeedsOwnKey: Story = {
  beforeEach: () => mockRpc({ "legal.overview": needsKeyOverview, "legal.consent": consent }),
};

export const ModelChanged: Story = {
  beforeEach: () =>
    mockRpc({
      "legal.overview": { ...needsKeyOverview, modelBlocker: "model_changed" },
      "legal.consent": consent,
    }),
};

export const LastScanFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "legal.overview": {
        ...overview,
        agent: {
          ...overview.agent,
          lastScanRun: {
            id: overview.agent.lastScanRun!.id,
            status: "failed",
            error: "The model timed out.",
          },
        },
      },
      "legal.consent": consent,
      "legal.graph": graph,
    }),
};

/** The first read worked; a later one failed. The page stays and says so. */
export const RefreshFailed: Story = {
  beforeEach: () => {
    let reads = 0;
    mockRpc({
      "legal.overview": () =>
        reads++ === 0
          ? Promise.resolve(overview)
          : Promise.reject(new Error("Could not reach the server")),
      "legal.consent": consent,
      "legal.graph": graph,
    });
  },
  play: async () => {
    window.dispatchEvent(new Event("focus"));
  },
};

export const Loading: Story = { beforeEach: () => mockRpc({ "legal.overview": never }) };

export const LoadError: Story = { beforeEach: () => mockRpc({ "legal.overview": fails }) };
