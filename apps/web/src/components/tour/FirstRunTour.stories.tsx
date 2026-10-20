import type { Me } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { fn } from "storybook/test";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { mockMe } from "../../stories/fixtures";
import { FirstRunTour } from "./FirstRunTour";

const ids = [
  "sidebar-inbox",
  "sidebar-finance",
  "sidebar-legal",
  "sidebar-data-room",
  "sidebar-integrations",
];

/** A stand-in sidebar carrying the same anchors as the real one. */
function Sidebar({ without = [] }: { without?: string[] }) {
  const has = (id: string) => !without.includes(id);
  return (
    <aside className="flex h-[640px] w-[316px] flex-col gap-1 border-e border-sidebar-border bg-sidebar p-3">
      <div className="flex gap-2">
        <div data-tour="sidebar-search" className="flex-1 rounded-xl border p-1.5 text-sm">
          Search
        </div>
        <button type="button" data-tour="create-menu" className="px-2 text-xl">
          +
        </button>
      </div>
      <div data-sidebar-group="main" className="my-2 rounded-xl bg-card p-2 text-sm">
        Chief
      </div>
      {ids.filter(has).map((id) => (
        <button
          key={id}
          type="button"
          data-tour={id}
          className="rounded-xl px-2.5 py-2 text-start text-sm"
        >
          {id.replace("sidebar-", "")}
        </button>
      ))}
      <button type="button" data-tour="user-menu" className="mt-auto py-2 text-start text-sm">
        Demo User
      </button>
    </aside>
  );
}

const meta = {
  title: "Tour/First-run tour",
  component: FirstRunTour,
  args: { open: true, onClose: fn() },
  beforeEach: () => mockRpc({ "preferences.update": (): Me => ({ ...mockMe, tourSeen: true }) }),
  render: (args) => (
    <>
      <Sidebar />
      <FirstRunTour {...args} />
    </>
  ),
} satisfies Meta<typeof FirstRunTour>;
export default meta;

/** Nine steps, from Chief to the account menu. */
export const Open: StoryObj<typeof meta> = {};

/** A page that is hidden has no anchor, so its steps are dropped. */
export const HiddenPages: StoryObj<typeof meta> = {
  render: (args) => (
    <>
      <Sidebar without={["sidebar-legal", "sidebar-integrations"]} />
      <FirstRunTour {...args} />
    </>
  ),
};

/** Once finished or skipped, nothing renders. */
export const Closed: StoryObj<typeof meta> = { args: { open: false } };
