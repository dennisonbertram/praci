import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { demoApp, demoBots, demoConnection, demoIntegrations } from "../../stories/fixtures-4";
import { ConnectAppDialog } from "./ConnectAppDialog";

/** The dialog renders in a portal, so a page behind it keeps the story from looking empty. */
const meta = {
  title: "Integrations/ConnectAppDialog",
  component: ConnectAppDialog,
  args: { item: demoApp, data: demoIntegrations({ connections: [] }), onClose: () => undefined },
  decorators: [
    (Story) => (
      <>
        <p className="p-6">Sample Mail is not connected.</p>
        <Story />
      </>
    ),
  ],
} satisfies Meta<typeof ConnectAppDialog>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Waiting for sign-in. The sign-in window never opens because the authorization URL is empty. */
export const WaitingForSignIn: Story = {
  beforeEach: () =>
    mockRpc({
      "connections.begin": { connectionId: "conn_new", authorizationUrl: null },
      "connections.complete": { ...demoConnection({ id: "conn_new" }), status: "pending" },
    }),
};

export const SignInFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "connections.begin": { connectionId: "conn_new", authorizationUrl: null },
      "connections.complete": demoConnection({
        id: "conn_new",
        status: "error",
        error: "Sign-in was refused.",
      }),
    }),
};

export const BeginFailed: Story = {
  beforeEach: () =>
    mockRpc({ "connections.begin": () => Promise.reject(new Error("Could not connect")) }),
};

/** Signed in, now choosing which agents get the app. */
export const ChoosingAgents: Story = {
  beforeEach: () =>
    mockRpc({
      "connections.begin": { connectionId: "conn_new", authorizationUrl: null },
      "connections.complete": demoConnection({ id: "conn_new" }),
    }),
};

/** Signed in with no agents to choose from, so the dialog ends on the confirmation. */
export const ConnectedNoAgents: Story = {
  args: { data: demoIntegrations({ connections: [], bots: [] }) },
  beforeEach: () =>
    mockRpc({
      "connections.begin": { connectionId: "conn_new", authorizationUrl: null },
      "connections.complete": demoConnection({ id: "conn_new" }),
    }),
};

export const SecondAccount: Story = {
  args: { data: demoIntegrations({ bots: demoBots }) },
  beforeEach: () =>
    mockRpc({
      "connections.begin": { connectionId: "conn_new", authorizationUrl: null },
      "connections.complete": { ...demoConnection({ id: "conn_new" }), status: "pending" },
    }),
};
