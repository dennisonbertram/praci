import type { Meta, StoryObj } from "@storybook/react-vite";
import { ChartColumn, Mail, Scale } from "lucide-react";
import { useState } from "react";
import { SidebarPageLink } from "./SidebarPageLink";
import { SidebarPagesGroup } from "./SidebarPagesGroup";
import { glanceBadge } from "./sidebar-glance";

function Pages({
  start = false,
  rail = false,
  notified = false,
}: {
  start?: boolean;
  rail?: boolean;
  notified?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(start);
  return (
    <div className={`flex flex-col bg-sidebar px-2.5 py-2.5 ${rail ? "w-14" : "w-72"}`}>
      <SidebarPagesGroup
        title="Pages"
        collapsed={collapsed}
        rail={rail}
        onToggle={() => setCollapsed(!collapsed)}
      >
        <SidebarPageLink
          testId="inbox"
          current
          icon={<Mail size={15} strokeWidth={1.8} aria-hidden="true" />}
          label="Inbox"
          rail={rail}
          onOpen={() => {}}
          {...glanceBadge({ unseen: 0, value: "12", rail })}
        />
        <SidebarPageLink
          testId="finance"
          current={false}
          icon={<ChartColumn size={15} strokeWidth={1.8} aria-hidden="true" />}
          label="Finance"
          rail={rail}
          onOpen={() => {}}
          {...glanceBadge({ unseen: 0, value: "9 mo", rail })}
        />
        <SidebarPageLink
          testId="legal"
          current={false}
          icon={<Scale size={15} strokeWidth={1.8} aria-hidden="true" />}
          label="Legal"
          rail={rail}
          onOpen={() => {}}
          {...glanceBadge({ unseen: notified ? 1 : 0, rail })}
        />
      </SidebarPagesGroup>
    </div>
  );
}

const meta = {
  title: "Shell/Sidebar pages group",
  component: SidebarPagesGroup,
  parameters: { layout: "padded" },
} satisfies Meta<typeof SidebarPagesGroup>;
export default meta;
type Story = StoryObj<typeof meta>;
const noop = { title: "Pages", collapsed: false, onToggle: () => {}, children: null };

export const Expanded: Story = { args: noop, render: () => <Pages /> };
/** Only the current page stays; the others are hidden. */
export const Collapsed: Story = { args: noop, render: () => <Pages start /> };
/** A page with an unseen notification stays visible. */
export const CollapsedWithNotifiedPage: Story = {
  args: noop,
  render: () => <Pages start notified />,
};
/** The icon rail ignores the collapsed preference. */
export const Rail: Story = { args: noop, render: () => <Pages start rail notified /> };
