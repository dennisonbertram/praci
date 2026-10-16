import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import { Route, Routes, useNavigate } from "react-router-dom";
import { expect, userEvent, within } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { demoConnection, demoIntegrations } from "../../stories/fixtures-4";
import { AppDetail } from "./AppDetail";

const tools = [
  { name: "SAMPLE-MAIL_LIST_MESSAGES", description: "List messages in a folder." },
  { name: "SAMPLE-MAIL_SEND_MESSAGE", description: "Send a message." },
  { name: "SAMPLE-MAIL_DELETE_MESSAGE", description: "Delete a message." },
];

/** The preview already provides a router; this moves it to the app's route and mounts the page. */
function Page({ data }: { data: ReturnType<typeof demoIntegrations> }) {
  const navigate = useNavigate();
  useEffect(() => {
    void navigate("/app/demo/sample-mail");
  }, [navigate]);
  return (
    <Routes>
      <Route
        path="app/:connectorId/:slug"
        element={<AppDetail data={data} activeBotId="bot_ada" />}
      />
      <Route path="*" element={<p className="p-6">Elsewhere</p>} />
    </Routes>
  );
}

const meta = {
  title: "Integrations/AppDetail",
  parameters: {
    layout: "fullscreen",
    docs: { description: { component: "Also shows: AccountRow, Heading, ConfirmDialog" } },
  },
  beforeEach: () => mockRpc({ "connections.tools": tools }),
  render: () => <Page data={demoIntegrations()} />,
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Connected: Story = {};

export const ManyAccountsOneFailed: Story = {
  render: () => (
    <Page
      data={demoIntegrations({
        connections: [
          demoConnection(),
          demoConnection({
            id: "conn_2",
            displayName: "Sample Mail 2",
            status: "error",
            error: "Sign-in expired",
          }),
          demoConnection({ id: "conn_3", displayName: "Sample Mail 3", status: "pending" }),
        ],
      })}
    />
  ),
};

export const ToolsLoading: Story = {
  beforeEach: () => mockRpc({ "connections.tools": () => new Promise(() => undefined) }),
};

export const NoTools: Story = { beforeEach: () => mockRpc({ "connections.tools": [] }) };

export const NotConnected: Story = {
  render: () => <Page data={demoIntegrations({ connections: [] })} />,
};

export const NotConnectedUnknownApp: Story = {
  render: () => <Page data={demoIntegrations({ connections: [], catalog: [] })} />,
};

export const NotLoaded: Story = {
  render: () => <Page data={demoIntegrations({ loaded: false })} />,
};

export const RenamingAccount: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: "Rename" }));
    await expect(within(canvasElement).getByLabelText("Account name")).toBeTruthy();
  },
};

export const RemoveAccountConfirm: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement).findByRole("button", { name: /^Remove/ }));
    await expect(await within(document.body).findByText(/^Remove Sample Mail\?/)).toBeTruthy();
  },
};

export const DisconnectConfirm: Story = {
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Disconnect Sample Mail" }),
    );
    await expect(await within(document.body).findByText("Disconnect Sample Mail?")).toBeTruthy();
  },
};

export const DisconnectFailed: Story = {
  beforeEach: () =>
    mockRpc({
      "connections.tools": tools,
      "connections.revoke": () => Promise.reject(new Error("Could not disconnect")),
    }),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Disconnect Sample Mail" }),
    );
    const dialog = await within(document.body).findByRole("alertdialog");
    await userEvent.click(within(dialog).getByRole("button", { name: "Disconnect Sample Mail" }));
    await expect(await within(canvasElement).findByRole("alert")).toBeTruthy();
  },
};

export const AddAnotherAccount: Story = {
  beforeEach: () =>
    mockRpc({
      "connections.tools": tools,
      "connections.begin": () => new Promise(() => undefined),
    }),
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Add another account" }),
    );
  },
};
