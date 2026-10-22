import type { NotificationKind } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { FolderOpen, Mail, Scale } from "lucide-react";
import { SidebarPageLink } from "./SidebarPageLink";
import { glanceBadge, StatusMark } from "./sidebar-glance";

const meta = {
  title: "Shell/Sidebar glance",
  parameters: { layout: "padded" },
  decorators: [
    (Story) => (
      <div className="flex w-72 flex-col">
        <Story />
      </div>
    ),
  ],
} satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

const row = (
  label: string,
  icon: React.ReactNode,
  badge: ReturnType<typeof glanceBadge>,
  rail = false,
) => (
  <SidebarPageLink
    testId={`glance-${label}`}
    current={false}
    icon={icon}
    label={label}
    rail={rail}
    onOpen={() => {}}
    {...badge}
  />
);

/** A value while nothing is unseen, a dot (named "new") when there is something new. */
export const ValuesAndDot: Story = {
  render: () => (
    <>
      {row(
        "Inbox",
        <Mail size={15} aria-hidden="true" />,
        glanceBadge({ unseen: 0, value: "3", valueLabel: "3 unread", rail: false }),
      )}
      {row(
        "Data room",
        <FolderOpen size={15} aria-hidden="true" />,
        glanceBadge({
          unseen: 0,
          value: "1",
          valueLabel: "1 file failed",
          failure: true,
          rail: false,
        }),
      )}
      {row(
        "Legal",
        <Scale size={15} aria-hidden="true" />,
        glanceBadge({ unseen: 1, value: "2", rail: false }),
      )}
    </>
  ),
};

const agents: [string, string, NotificationKind][] = [
  ["Carta agent", "2m", "urgent"],
  ["Legal agent", "9m", "needs_input"],
  ["Finance agent", "14m", "failed"],
  ["Research agent", "1h", "done"],
  ["Inbox agent", "3h", "new"],
];

/** Beside an agent's timestamp: the highest-priority unseen kind. Each row animates out of step. */
export const AgentStatusKinds: Story = {
  render: () => (
    <ul className="flex flex-col gap-1.5 text-[14.5px] text-foreground">
      {agents.map(([name, time, kind]) => (
        <li key={name} className="flex items-center gap-1.5">
          <span className="min-w-0 flex-1 truncate">{name}</span>
          <StatusMark kind={kind} botId={name} />
          <span className="text-[12px] text-muted-foreground tabular-nums">{time}</span>
        </li>
      ))}
    </ul>
  ),
};
