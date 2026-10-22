import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { LegalPage } from "./Legal";
import {
  consentFixture as consent,
  deadlines,
  emptyOverview,
  graph,
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
    mockRpc({
      "legal.overview": overview,
      "legal.consent": consent,
      "legal.graph": graph,
      "legal.doneDeadlines": deadlines.slice(0, 2).map((d) => ({ ...d, status: "done" })),
    }),
};

const withFiles = {
  ...emptyOverview,
  counts: { ...emptyOverview.counts, unreviewedDocuments: 3 },
};

/** Nothing in the Data room yet: one sentence and Add files, no consent card. */
export const Empty: Story = {
  beforeEach: () => mockRpc({ "legal.overview": emptyOverview, "legal.consent": consent }),
};

/** Files wait for Legal: the card asks once, under the tabs it will fill. */
export const NeedsConsent: Story = {
  beforeEach: () =>
    mockRpc({
      "legal.overview": withFiles,
      "legal.consent": { ...consent, allowed: false },
    }),
};

/** The agent runs on the space default model: no key or model banner. */
export const SpaceDefaultModel: Story = {
  beforeEach: () =>
    mockRpc({
      "legal.overview": {
        ...overview,
        model: { provider: "openrouter", id: "openai/gpt-6-luna", isPreferred: false },
      },
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

/** OpenRouter rejected the user's key: the header names it and opens the key field. */
export const ScanKeyRejected: Story = {
  beforeEach: () =>
    mockRpc({
      "legal.overview": {
        ...overview,
        agent: {
          ...overview.agent,
          lastScanRun: {
            id: overview.agent.lastScanRun!.id,
            status: "failed",
            error: '401: {"message":"User not found.","code":401}',
          },
        },
      },
      "legal.consent": consent,
      "legal.graph": graph,
    }),
};

/** Earlier results exist, but access is not allowed now: the daily scan waits for it. */
export const ResultsAwaitingConsent: Story = {
  beforeEach: () =>
    mockRpc({
      "legal.overview": overview,
      "legal.consent": { ...consent, allowed: false },
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
