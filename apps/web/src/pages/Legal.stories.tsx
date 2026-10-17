import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { LegalPage } from "./Legal";
import { consentFixture as consent, emptyOverview, graph, overview } from "./legal/fixtures";

const never = () => new Promise(() => {});
const fails = () => Promise.reject(new Error("Could not load Legal"));

const meta = {
  title: "Legal/Page",
  component: LegalPage,
  args: { onAskAgent: () => {} },
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

export const Loading: Story = { beforeEach: () => mockRpc({ "legal.overview": never }) };

export const LoadError: Story = { beforeEach: () => mockRpc({ "legal.overview": fails }) };
