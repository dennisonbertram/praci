import type { Meta, StoryObj } from "@storybook/react-vite";
import { FireIcon, FireTruckIcon, PixelIcon, StatusIcon } from "./pixel-icon";
import { PIXEL_ICONS } from "./sprites";

const meta = {
  title: "UI/Pixel icon",
  component: PixelIcon,
  args: { sprite: PIXEL_ICONS.fireTruck },
  parameters: {
    docs: {
      description: {
        component:
          "Also shows: FireTruckIcon, FireIcon, StatusIcon. Sprites are defined in sprites.ts.",
      },
    },
  },
} satisfies Meta<typeof PixelIcon>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex items-end gap-8 text-foreground">
      {[16, 32].map((size) => (
        <div key={size} className="flex items-end gap-4">
          <FireTruckIcon size={size} label="Fire truck" />
          <FireIcon size={size} label="Fire" />
          <span className="text-xs text-muted-foreground">{size / 16}x</span>
        </div>
      ))}
    </div>
  ),
};

export const Still: Story = {
  render: () => (
    <div className="flex items-end gap-4 text-foreground">
      <FireTruckIcon size={32} animate={false} />
      <FireIcon size={32} animate={false} />
    </div>
  ),
};

const kinds = ["urgent", "needs_input", "failed", "done", "new"] as const;

/** One icon per notification kind, in priority order. Seeds give each its own phase. */
export const StatusKinds: Story = {
  render: () => (
    <div className="flex flex-col gap-4 text-foreground">
      {[16, 32].map((size) => (
        <div key={size} className="flex items-end gap-6">
          {kinds.map((kind) => (
            <div key={kind} className="flex flex-col items-center gap-1">
              <StatusIcon kind={kind} size={size} seed={kind} label={kind} />
              <span className="text-xs text-muted-foreground">{kind}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  ),
};

const rows = [
  ["Overnight build is failing", "2m"],
  ["Weekly summary is ready", "1h"],
];

export const InSidebarRow: Story = {
  render: () => (
    <ul className="w-72 divide-y divide-border rounded-lg border border-border bg-card text-sm text-foreground">
      {rows.map(([title, time], i) => (
        <li key={title} className="flex items-center gap-2 px-3 py-2">
          <span className="min-w-0 flex-1 truncate">{title}</span>
          {i === 0 ? <FireTruckIcon label="Urgent" /> : null}
          <span className="text-xs text-muted-foreground">{time}</span>
        </li>
      ))}
    </ul>
  ),
};
