import type { Me, RakazoDesktop } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { withPageBehind } from "../stories/decorators";
import { HostComputerPrompt } from "./HostComputerPrompt";

const me: Me = {
  ticketBoardEnabled: false,
  userId: "user_demo",
  timezone: null,
  email: "sam@example.com",
  name: "Sam Example",
  spaceId: "space_demo",
  isDeploymentOwner: true,
  needsModel: false,
  defaultProvider: null,
  defaultModel: null,
  hostCredentialProvider: null,
  hostCredentialSource: null,
  computerHost: null,
  canChooseHostComputer: true,
  sandboxProvider: "docker",
  avatarStyle: "organic",
  billingEnabled: false,
};

/** The prompt only appears inside the desktop app, so fake the bridge for the story. */
const desktop = (platform: string) => () => {
  window.rakazoDesktop = { platform } as unknown as RakazoDesktop;
  return () => {
    window.rakazoDesktop = undefined;
  };
};

const meta = {
  title: "Shell/HostComputerPrompt",
  component: HostComputerPrompt,
  args: { initialMe: me },
  decorators: [withPageBehind()],
} satisfies Meta<typeof HostComputerPrompt>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Mac: Story = { beforeEach: desktop("darwin") };

export const OtherComputer: Story = { beforeEach: desktop("linux") };

export const SaveFailed: Story = {
  beforeEach: () => {
    mockRpc({ "deployment.update": () => Promise.reject(new Error("Could not save that choice")) });
    return desktop("darwin")();
  },
  play: async ({ canvasElement }) => {
    await userEvent.click(await within(canvasElement.ownerDocument.body).findByText("Docker"));
  },
};
