import { BotAvatar } from "@rakazo/ui-web";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartColumn, Mail, Scale } from "lucide-react";
import { scoutBot } from "../stories/fixtures";
import { RailTip, SidebarPageLink } from "./SidebarPageLink";

const meta = {
  title: "Shell/Sidebar page link",
  component: SidebarPageLink,
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="flex w-72 flex-col">
        <Story />
      </div>
    ),
  ],
  args: {
    testId: "sidebar-page",
    current: false,
    icon: <Mail size={15} strokeWidth={1.8} aria-hidden="true" />,
    label: "Inbox",
    onOpen: () => {},
  },
} satisfies Meta<typeof SidebarPageLink>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Current: Story = { args: { current: true } };

export const WithBadge: Story = {
  args: {
    badge: <span className="ms-auto text-[11.5px] text-muted-foreground tabular-nums">3</span>,
  },
};

/** The badge is its own button beside the row: the row opens everything, the badge opens the failed files. */
export const WithBadgeAction: Story = {
  args: {
    label: "Data room",
    badgeLabel: "2 files failed",
    onBadgeClick: () => {},
    badge: (
      <span className="ms-auto font-medium text-[11.5px] text-destructive tabular-nums">2</span>
    ),
  },
};

/** The icon rail: labels are tooltips and the badge becomes a dot on the icon. */
function RailColumn() {
  return (
    <div className="flex w-14 flex-col border-e border-sidebar-border bg-sidebar px-2.5 py-2.5">
      <SidebarPageLink
        rail
        testId="rail-inbox"
        current
        icon={<Mail size={15} strokeWidth={1.8} aria-hidden="true" />}
        label="Inbox"
        badge={<span>3 unread</span>}
        onOpen={() => {}}
      />
      <SidebarPageLink
        rail
        testId="rail-finance"
        current={false}
        icon={<ChartColumn size={15} strokeWidth={1.8} aria-hidden="true" />}
        label="Finance"
        badge={<span>New</span>}
        onOpen={() => {}}
      />
      <SidebarPageLink
        rail
        testId="rail-legal"
        current={false}
        icon={<Scale size={15} strokeWidth={1.8} aria-hidden="true" />}
        label="Legal"
        onOpen={() => {}}
      />
      <RailTip rail label={scoutBot.name}>
        <button
          type="button"
          aria-label={scoutBot.name}
          className="mt-2 flex justify-center rounded-xl py-1 hover:bg-sidebar-accent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring"
        >
          <BotAvatar color={scoutBot.color} identity={scoutBot.id} size={36} status="idle" />
        </button>
      </RailTip>
    </div>
  );
}

export const Rail: Story = { render: () => <RailColumn /> };
export const RailDark: Story = { render: () => <RailColumn />, globals: { theme: "dark" } };
