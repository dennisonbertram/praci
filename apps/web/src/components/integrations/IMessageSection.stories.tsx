import type { MessagingSetupState } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { screen, userEvent } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { withPageBehind } from "../../stories/decorators";
import { IMessageSection } from "./IMessageSection";

const meta = {
  title: "Integrations/IMessageSection",
  component: IMessageSection,
  args: { onOpenMessaging: () => undefined },
  decorators: [
    (Story) => (
      <div className="w-[860px] max-w-full">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof IMessageSection>;
export default meta;
type Story = StoryObj<typeof meta>;

type Providers = MessagingSetupState["providers"];
const photonUrl = "https://rakazo.example/api/v1/messaging/webhook/photon";
const bluebubblesUrl =
  "https://rakazo.example/api/v1/messaging/webhook/bluebubbles?token=demo-token";

const empty: Providers = [
  { id: "photon", fields: {}, configured: false, active: false, webhookUrl: photonUrl },
  { id: "bluebubbles", fields: {}, configured: false, active: false, webhookUrl: null },
];
const saved: Providers = [
  {
    id: "photon",
    fields: {
      projectId: { source: "saved", value: "demo-project" },
      projectSecret: { source: "saved" },
      webhookSecret: { source: "saved" },
    },
    configured: true,
    active: true,
    webhookUrl: photonUrl,
  },
  {
    id: "bluebubbles",
    fields: {
      serverUrl: { source: "saved", value: "http://192.168.1.20:1234/" },
      password: { source: "saved" },
      webhookToken: { source: "saved" },
    },
    configured: true,
    active: false,
    webhookUrl: bluebubblesUrl,
  },
];

const serve = (providers: Providers) =>
  mockRpc({ "messagingSetup.get": { canConfigure: true, providers } });

/** Nothing configured yet. */
export const Empty: Story = { beforeEach: () => serve(empty) };

/** Photon is running; BlueBubbles is saved and waits for a restart. */
export const ConfiguredAndRestartRequired: Story = { beforeEach: () => serve(saved) };

/** Photon is filled in from the server's environment. */
export const SetByServer: Story = {
  beforeEach: () =>
    serve([
      {
        ...saved[0]!,
        fields: {
          projectId: { source: "server", value: "demo-project" },
          projectSecret: { source: "server" },
          webhookSecret: { source: "server" },
        },
      },
      saved[1]!,
    ]),
};

/** The setup dialog for a BlueBubbles server on the public internet shows the exposure warning. */
export const PublicServerWarning: Story = {
  decorators: [withPageBehind()],
  beforeEach: () =>
    serve([
      empty[0]!,
      {
        ...empty[1]!,
        fields: { serverUrl: { source: "saved", value: "https://bluebubbles.example.com" } },
      },
    ]),
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: /iMessage \(BlueBubbles\)/ }));
  },
};

/** The setup dialog with a saved password and a webhook URL to register. */
export const SetupDialog: Story = {
  decorators: [withPageBehind()],
  beforeEach: () => serve(saved),
  play: async () => {
    await userEvent.click(await screen.findByRole("button", { name: /iMessage \(BlueBubbles\)/ }));
  },
};
