import type { ServerUpdateCheck, ServerUpdateStatus } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, within } from "storybook/test";
import { mockRpc } from "../lib/__mocks__/rpc";
import { withVisibleRoot } from "../stories/decorators";
import { SoftwareUpdatePanel, SoftwareUpdateSection } from "./SoftwareUpdateSection";

const status: ServerUpdateStatus = {
  supported: true,
  unsupportedReason: null,
  installKind: "sidecar",
  manualCommands: [],
  mode: "sidecar",
  strategy: null,
  strategyNote: null,
  version: "1.0.0",
  revision: null,
  commit: null,
  branch: null,
  remoteUrl: null,
  dirty: false,
  dirtyPaths: [],
  image: null,
  imageTag: "1.0.0",
  previousImageTag: null,
  canRollback: false,
  source: { repoUrl: "https://git.example.test/sample/repo", branch: "main", official: true },
  officialRepoUrl: "https://git.example.test/sample/repo",
  restartSupervisor: "none",
  restartAdvice: "",
  running: false,
  lastRun: null,
};

const check = (patch: Partial<ServerUpdateCheck>): ServerUpdateCheck => ({
  status: "up-to-date",
  reason: null,
  changed: [],
  commit: null,
  targetCommit: null,
  targetTag: null,
  behindBy: 0,
  ...patch,
});

const noop = () => undefined;
const meta = {
  title: "Settings/Software update",
  component: SoftwareUpdatePanel,
  args: { check: null, busy: null, error: null, done: null, onCheck: noop, onApply: noop },
  parameters: { docs: { description: { component: "Also shows: CheckSummary" } } },
} satisfies Meta<typeof SoftwareUpdatePanel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Idle: Story = {};
export const Checking: Story = { args: { busy: "check" } };
export const UpToDate: Story = { args: { check: check({ status: "up-to-date" }) } };
export const UpdateAvailable: Story = {
  args: { check: check({ status: "available", behindBy: 3 }) },
};
export const Updating: Story = {
  args: { check: check({ status: "available", behindBy: 3 }), busy: "apply" },
};
export const LocalChanges: Story = { args: { check: check({ status: "dirty" }) } };
export const Unavailable: Story = {
  args: { check: check({ status: "unavailable", reason: "The update server did not answer." }) },
};
export const UnavailableNoReason: Story = { args: { check: check({ status: "unavailable" }) } };
export const Failed: Story = { args: { error: "Check failed" } };
export const Done: Story = { args: { done: "Updated" } };

/** The full section loads its status from the API and only shows for the sidecar install. */
export const Section: StoryObj = {
  beforeEach: () =>
    mockRpc({
      "updater.status": status,
      "updater.check": check({ status: "available", behindBy: 2 }),
    }),
  render: () => <SoftwareUpdateSection isDeploymentOwner />,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Check for updates" }),
    );
    await expect(await within(canvasElement).findByText("Update available")).toBeTruthy();
  },
};

export const SectionStatusFailed: StoryObj = {
  beforeEach: () =>
    mockRpc({ "updater.status": () => Promise.reject(new Error("Could not load update status")) }),
  render: () => <SoftwareUpdateSection isDeploymentOwner />,
};

export const SectionCheckFailed: StoryObj = {
  beforeEach: () =>
    mockRpc({
      "updater.status": status,
      "updater.check": () => Promise.reject(new Error("Check failed")),
    }),
  render: () => <SoftwareUpdateSection isDeploymentOwner />,
  play: async ({ canvasElement }) => {
    await userEvent.click(
      await within(canvasElement).findByRole("button", { name: "Check for updates" }),
    );
    await expect(await within(canvasElement).findByRole("alert")).toBeTruthy();
  },
};

/** Not the deployment owner: the section renders nothing. The text below stands in for the page. */
export const SectionHiddenForMembers: StoryObj = {
  render: () => <SoftwareUpdateSection isDeploymentOwner={false} />,
  decorators: [withVisibleRoot("The section is hidden for non-owners.")],
};
