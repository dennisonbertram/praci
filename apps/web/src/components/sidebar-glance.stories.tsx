import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartColumn, Mail, Scale } from "lucide-react";
import { SidebarPageLink } from "./SidebarPageLink";
import { glanceBadge, runwayGlance, UrgentMark } from "./sidebar-glance";

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
        "Finance",
        <ChartColumn size={15} aria-hidden="true" />,
        glanceBadge({ unseen: 0, value: runwayGlance(24.4, false), rail: false }),
      )}
      {row(
        "Legal",
        <Scale size={15} aria-hidden="true" />,
        glanceBadge({ unseen: 1, value: "2", rail: false }),
      )}
    </>
  ),
};

/** Hide money is on: the runway value is gone. */
export const RunwayHidden: Story = {
  render: () =>
    row(
      "Finance",
      <ChartColumn size={15} aria-hidden="true" />,
      glanceBadge({ unseen: 0, value: runwayGlance(24.4, true), rail: false }),
    ),
};

/** Beside an agent's timestamp while it has an unseen attention notification. */
export const Urgent: Story = {
  render: () => (
    <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
      <UrgentMark />
      <span>2m</span>
    </div>
  ),
};
