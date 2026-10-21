import type { MessageBlock } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { withVisibleRoot } from "../../stories/decorators";
import { grayPngUrl, samplePngBase64 } from "../../stories/fixtures";
import {
  AppConnectCard,
  ArtifactImage,
  ArtifactImageGrid,
  ChartBlockView,
  ChartCanvas,
  ChoiceCard,
  McpApprovalCard,
} from "./message-cards";

type Block<K extends MessageBlock["kind"]> = Extract<MessageBlock, { kind: K }>;

const choice: Block<"choice"> = {
  kind: "choice",
  question: "Which sample report do you want first?",
  subtitle: "You can change this later.",
  options: [
    { id: "a", letter: "A", label: "Weekly summary" },
    { id: "b", letter: "B", label: "Monthly totals" },
    {
      id: "c",
      letter: "C",
      label: "A sample report with a long name that wraps onto a second line",
    },
  ],
};

const focus: Block<"choice"> = {
  kind: "choice",
  question: "What do you want me on first?",
  options: [
    { id: "day", letter: "A", label: "Day-to-day work" },
    { id: "inbox", letter: "B", label: "Inbox & email" },
    { id: "research", letter: "C", label: "Research & writing" },
    { id: "everything", letter: "D", label: "A bit of everything" },
  ],
};

const appConnect: Block<"app_connect"> = {
  kind: "app_connect",
  connectorId: "demo",
  provider: "sample-mail",
  name: "Sample Mail",
  description: "Read and draft sample email.",
  logo: null,
  status: "pending",
};

const mcp: Block<"mcp_approval"> = {
  kind: "mcp_approval",
  name: "Sample tools",
  serverId: "srv_1",
  transport: "streamable_http",
  endpoint: "https://tools.example.test/mcp",
  needsOAuth: false,
  status: "pending",
};

const chartSpec = {
  title: "Sample revenue",
  marks: [{ type: "barY", options: { x: "month", y: "revenue", fill: "month" } }],
};
const chartData = [
  { month: "Jan", revenue: 12 },
  { month: "Feb", revenue: 18 },
  { month: "Mar", revenue: 9 },
  { month: "Apr", revenue: 21 },
];

const noop = async () => undefined;
const meta = {
  title: "Shell/Message cards",
  parameters: {
    docs: {
      description: {
        component:
          "Also shows: OnboardingFocusQuestion, OnboardingFocusOptionLabel (FocusQuestion story), ChartCanvas (Chart stories), ArtifactImage (Artifact image stories)",
      },
    },
  },
} satisfies Meta;
export default meta;
type Story = StoryObj;

export const Choice: Story = {
  render: () => <ChoiceCard botId="bot_ada" block={choice} onBotChanged={noop} />,
};

export const ChoiceAnswered: Story = {
  render: () => (
    <ChoiceCard botId="bot_ada" block={{ ...choice, answerId: "b" }} onBotChanged={noop} />
  ),
};

export const FocusQuestion: Story = {
  render: () => <ChoiceCard botId="bot_ada" block={focus} onBotChanged={noop} />,
};

export const ChoiceSaveFailed: Story = {
  beforeEach: () =>
    mockRpc({ "onboarding.choose": () => Promise.reject(new Error("Could not save this choice")) }),
  render: () => <ChoiceCard botId="bot_ada" block={choice} onBotChanged={noop} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByText("Weekly summary"));
    await expect(await within(canvasElement).findByText("Could not save this choice")).toBeTruthy();
  },
};

/** A dismissed card renders nothing; the line below stands in for the thread. */
export const ChoiceDismissed: Story = {
  render: () => (
    <ChoiceCard botId="bot_ada" block={{ ...choice, answerId: "_dismissed" }} onBotChanged={noop} />
  ),
  decorators: [withVisibleRoot("The card is gone from the thread.")],
};

export const AppConnect: Story = {
  render: () => <AppConnectCard botId="bot_ada" block={appConnect} />,
};

export const AppConnectWithLogo: Story = {
  render: () => <AppConnectCard botId="bot_ada" block={{ ...appConnect, logo: grayPngUrl }} />,
};

export const AppConnectConnected: Story = {
  render: () => <AppConnectCard botId="bot_ada" block={{ ...appConnect, status: "connected" }} />,
};

export const AppConnectWaiting: Story = {
  beforeEach: () => mockRpc({ "connections.begin": () => new Promise(() => undefined) }),
  render: () => <AppConnectCard botId="bot_ada" block={appConnect} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /^Connect$/ }));
  },
};

export const AppConnectFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "connections.begin": () => Promise.reject(new Error("Could not authorize this app")),
    }),
  render: () => <AppConnectCard botId="bot_ada" block={appConnect} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: /^Connect$/ }));
    await expect(
      await within(canvasElement).findByText("Could not authorize this app"),
    ).toBeTruthy();
  },
};

export const McpApproval: Story = {
  render: () => <McpApprovalCard botId="bot_ada" threadId="thread_1" block={mcp} />,
};

export const McpApprovalNeedsOAuth: Story = {
  render: () => (
    <McpApprovalCard botId="bot_ada" threadId="thread_1" block={{ ...mcp, needsOAuth: true }} />
  ),
};

export const McpApprovalStdio: Story = {
  render: () => (
    <McpApprovalCard
      botId="bot_ada"
      threadId="thread_1"
      block={{ ...mcp, endpoint: null, transport: "stdio" }}
    />
  ),
};

export const McpApprovalConnected: Story = {
  render: () => (
    <McpApprovalCard botId="bot_ada" threadId="thread_1" block={{ ...mcp, status: "connected" }} />
  ),
};

export const McpApprovalDismissed: Story = {
  render: () => (
    <McpApprovalCard botId="bot_ada" threadId="thread_1" block={{ ...mcp, status: "dismissed" }} />
  ),
};

export const McpApprovalWithoutBot: Story = {
  render: () => <McpApprovalCard botId={undefined} threadId={undefined} block={mcp} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Approve" }));
    await expect(
      await within(canvasElement).findByText("This server cannot be assigned without a bot."),
    ).toBeTruthy();
  },
};

export const McpApprovalFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "mcp.assignments.approve": () => Promise.reject(new Error("Could not approve this server")),
    }),
  render: () => <McpApprovalCard botId="bot_ada" threadId="thread_1" block={mcp} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Approve" }));
    await expect(
      await within(canvasElement).findByText("Could not approve this server"),
    ).toBeTruthy();
  },
};

export const McpApprovalApproved: Story = {
  render: () => <McpApprovalCard botId="bot_ada" threadId="thread_1" block={mcp} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Approve" }));
    await waitFor(() => expect(within(canvasElement).getByText(/Connected\./)).toBeTruthy());
  },
};

export const Chart: Story = {
  render: () => <ChartCanvas spec={chartSpec} data={chartData} width={480} />,
  play: async ({ canvasElement }) => {
    await waitFor(() => expect(canvasElement.querySelector("svg")).toBeTruthy());
  },
};

export const ChartFailed: Story = {
  render: () => (
    <ChartCanvas spec={{ marks: [{ type: "notAMark" }] }} data={chartData} width={480} />
  ),
};

export const ChartBlock: Story = {
  render: () => <ChartBlockView name="Sample revenue" spec={chartSpec} data={chartData} />,
};

export const ChartBlockExpanded: Story = {
  render: () => <ChartBlockView name="Sample revenue" spec={chartSpec} data={chartData} />,
  play: async ({ canvasElement }) => {
    await userEvent.click(within(canvasElement).getByRole("button", { name: "Expand" }));
    await expect(await within(document.body).findByLabelText("Close chart")).toBeTruthy();
  },
};

export const ArtifactImageLoaded: Story = {
  beforeEach: () =>
    mockRpc({ "artifacts.get": { contentBase64: samplePngBase64, mimeType: "image/png" } }),
  render: () => (
    <ArtifactImage target={{ botId: "bot_ada" }} artifactId="art_1" name="Sample picture" />
  ),
};

export const ArtifactImagePreview: Story = {
  beforeEach: () =>
    mockRpc({ "artifacts.get": { contentBase64: samplePngBase64, mimeType: "image/png" } }),
  render: () => (
    <ArtifactImage target={{ botId: "bot_ada" }} artifactId="art_2" name="Sample picture" />
  ),
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button"));
    await expect(await within(document.body).findByLabelText("Close image preview")).toBeTruthy();
  },
};

/** Until the image arrives, a skeleton stands in for it. */
export const ArtifactImagePending: Story = {
  beforeEach: () => mockRpc({ "artifacts.get": () => new Promise(() => undefined) }),
  render: () => (
    <ArtifactImage target={{ botId: "bot_ada" }} artifactId="art_3" name="Sample picture" />
  ),
};

export const ArtifactImageCaptioned: Story = {
  beforeEach: () =>
    mockRpc({ "artifacts.get": { contentBase64: samplePngBase64, mimeType: "image/png" } }),
  render: () => (
    <ArtifactImage
      target={{ botId: "bot_ada" }}
      artifactId="art_4"
      name="Sample picture"
      alt="A plain gray square"
      caption="Sample caption"
    />
  ),
};

/** Several images from one show_image call. */
export const ArtifactImageGroup: Story = {
  beforeEach: () =>
    mockRpc({ "artifacts.get": { contentBase64: samplePngBase64, mimeType: "image/png" } }),
  render: () => (
    <ArtifactImageGrid
      target={{ botId: "bot_ada" }}
      images={["a", "b", "c"].map((id) => ({
        kind: "image" as const,
        artifactId: `art_${id}`,
        mimeType: "image/png",
        name: `sample-${id}.png`,
        caption: id === "a" ? "Sample caption" : undefined,
      }))}
    />
  ),
};

export const ArtifactImageFailed: Story = {
  beforeEach: () => mockRpc({ "artifacts.get": () => Promise.reject(new Error("gone")) }),
  render: () => (
    <ArtifactImage target={{ botId: "bot_ada" }} artifactId="art_5" name="sample-missing.png" />
  ),
};
