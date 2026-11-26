import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../lib/__mocks__/rpc";
import { PermissionLevelSelect } from "./PermissionLevelSelect";

const meta = {
  title: "Settings/PermissionLevelSelect",
  component: PermissionLevelSelect,
  decorators: [
    (Story) => (
      <div className="w-[480px]">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PermissionLevelSelect>;
export default meta;
type Story = StoryObj<typeof meta>;

const saves = (effectiveDefault: string) => (input: unknown) => ({
  level: (input as { level: string | null }).level,
  effectiveDefault,
});

/** The space follows the deployment default, here Open: the first option names it and the one sentence shows. */
export const SpaceOpen: Story = {
  beforeEach: () =>
    mockRpc({
      "permissions.get": { level: null, effectiveDefault: "open" },
      "permissions.set": saves("open"),
    }),
};

/** The deployment default is Ask for everything and the space follows it. */
export const SpaceDeploymentDefault: Story = {
  beforeEach: () =>
    mockRpc({
      "permissions.get": { level: null, effectiveDefault: "ask_everything" },
      "permissions.set": saves("ask_everything"),
    }),
};

/** The space chose Open explicitly, which stays distinct from following an Open default. */
export const SpaceExplicitOpen: Story = {
  beforeEach: () =>
    mockRpc({
      "permissions.get": { level: "open", effectiveDefault: "open" },
      "permissions.set": saves("open"),
    }),
};

export const SpaceAskForChanges: Story = {
  beforeEach: () =>
    mockRpc({
      "permissions.get": { level: "ask_changes", effectiveDefault: "open" },
      "permissions.set": saves("open"),
    }),
};

export const LoadError: Story = {
  beforeEach: () =>
    mockRpc({
      "permissions.get": () => {
        throw new Error("The server did not answer.");
      },
    }),
};

export const SaveError: Story = {
  beforeEach: () =>
    mockRpc({
      "permissions.get": { level: "ask_changes", effectiveDefault: "open" },
      "permissions.set": () => {
        throw new Error("The server did not answer.");
      },
    }),
};

/** An agent following the space. */
export const AgentSameAsSpace: Story = {
  args: { agent: { level: null, clamped: false, onChange: () => undefined } },
  beforeEach: () => mockRpc({}),
};

/** A Firewalled or external agent while the space is Open: shown at Ask for changes, not editable. */
export const AgentClamped: Story = {
  args: { agent: { level: null, clamped: true, onChange: () => undefined } },
  beforeEach: () => mockRpc({ "permissions.get": { level: null, effectiveDefault: "open" } }),
};
