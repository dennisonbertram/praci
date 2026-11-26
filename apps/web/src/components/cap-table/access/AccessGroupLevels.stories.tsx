import type { EquityAccessGroup } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../../lib/__mocks__/rpc";
import { AccessGroupLevels } from "./AccessGroupLevels";

const groups: EquityAccessGroup[] = [
  { key: "founders", level: "full_detail", memberCount: 2, updatedAt: null },
  { key: "investors", level: "advanced", memberCount: 6, updatedAt: null },
  { key: "employees", level: "restricted", memberCount: 14, updatedAt: "2026-09-01T10:00:00.000Z" },
  { key: "former_employees", level: "basic", memberCount: 3, updatedAt: null },
  { key: "other", level: "basic", memberCount: 1, updatedAt: null },
];

const meta = {
  title: "Cap table/Access group levels",
  component: AccessGroupLevels,
  decorators: [
    (Story) => (
      <div className="w-full max-w-3xl text-foreground">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof AccessGroupLevels>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Recommended levels except employees, set lower. */
export const Groups: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.accessGroups.list": groups,
      "equity.accessGroups.set": (input: { key: string; level: string }) => ({
        ...groups.find((group) => group.key === input.key),
        level: input.level,
        updatedAt: "2026-10-01T10:00:00.000Z",
      }),
    }),
};

/** The response is still on its way. */
export const Loading: Story = {
  beforeEach: () =>
    mockRpc({ "equity.accessGroups.list": () => new Promise<never>(() => undefined) }),
};

/** The server could not answer. */
export const Failed: Story = {
  beforeEach: () =>
    mockRpc({
      "equity.accessGroups.list": () => {
        throw new Error("Access levels are unavailable.");
      },
    }),
};
