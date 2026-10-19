import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import {
  enqueueNotificationToast,
  NotificationToaster,
  notificationToastManager,
} from "./notification-toaster";

const samples = [
  { id: "n1", title: "Weekly digest is ready", body: "Three new items need a look." },
  { id: "n2", title: "Contract renewal due", body: "The vendor agreement ends on the 30th." },
  { id: "n3", title: "Build failed on main" },
  { id: "n4", title: "Runway changed", body: "Below the usual range." },
  { id: "n5", title: "New file in the data room", body: "Board deck v2" },
];

function Demo({ items }: { items: Array<{ id: string; title: string; body?: string }> }) {
  useEffect(() => {
    for (const item of items) enqueueNotificationToast({ ...item, href: "/demo" });
    return () => notificationToastManager.close();
  }, [items]);
  return <NotificationToaster onOpen={() => {}} />;
}

const meta = {
  title: "UI/NotificationToaster",
  component: NotificationToaster,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="h-96 bg-background">{Story()}</div>],
} satisfies Meta<typeof NotificationToaster>;
export default meta;
type Story = StoryObj<typeof meta>;

const render = (items: typeof samples) => () => <Demo items={items} />;

export const One: Story = { args: { onOpen: () => {} }, render: render(samples.slice(0, 1)) };
export const Three: Story = { args: { onOpen: () => {} }, render: render(samples.slice(0, 3)) };
/** The two oldest collapse into "+2". */
export const Five: Story = { args: { onOpen: () => {} }, render: render(samples) };
export const LongText: Story = {
  args: { onOpen: () => {} },
  render: render([
    {
      id: "long",
      title: "A very long notification title that keeps going well past one line of the toast card",
      body: "A long body with an unbrokenstringthatcouldoverflowthecardifwrappingwerenothandledproperly and then some more words to fill several lines of text in the card.",
    },
  ]),
};
