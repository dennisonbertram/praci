import type { Meta, StoryObj } from "@storybook/react-vite";
import { useEffect } from "react";
import {
  enqueueNotificationToast,
  NotificationToaster,
  notificationToastManager,
} from "./notification-toaster";

const samples: Item[] = [
  { id: "n1", title: "Weekly digest is ready", body: "Three new items need a look." },
  { id: "n2", title: "Contract renewal due", body: "The vendor agreement ends on the 30th." },
  { id: "n3", title: "Build failed on main" },
  { id: "n4", title: "Runway changed", body: "Below the usual range." },
  { id: "n5", title: "New file in the data room", body: "Board deck v2" },
];

type Item = { id: string; title: string; body?: string; withBot?: boolean };

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const formatTime = (iso: string) => `${Math.round((Date.now() - Date.parse(iso)) / 60_000)}m ago`;
const botAvatar = (
  <span className="flex size-8 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
    A
  </span>
);

function Demo({ items }: { items: Item[] }) {
  useEffect(() => {
    for (const { withBot, ...item } of items)
      enqueueNotificationToast({
        ...item,
        href: "/demo",
        avatar: withBot ? botAvatar : undefined,
        createdAt: withBot ? ago(2) : undefined,
      });
    return () => notificationToastManager.close();
  }, [items]);
  return <NotificationToaster onOpen={() => {}} formatTime={formatTime} />;
}

const meta = {
  title: "UI/NotificationToaster",
  component: NotificationToaster,
  parameters: { layout: "fullscreen" },
  decorators: [(Story) => <div className="h-96 bg-background">{Story()}</div>],
} satisfies Meta<typeof NotificationToaster>;
export default meta;
type Story = StoryObj<typeof meta>;

const render = (items: Item[]) => () => <Demo items={items} />;

export const One: Story = { args: { onOpen: () => {} }, render: render(samples.slice(0, 1)) };
export const Finished: Story = {
  args: { onOpen: () => {} },
  render: render([
    {
      id: "fin",
      title: "Ledger agent finished",
      body: "I matched 42 of 45 transactions to invoices. Three need a receipt, listed in the reconciliation sheet. Nothing was changed in the books.",
      withBot: true,
    },
  ]),
};
export const HelpNeeded: Story = {
  args: { onOpen: () => {} },
  render: render([
    {
      id: "help",
      title: "Ledger agent needs you",
      body: "Which account should the refund go to?",
      withBot: true,
    },
  ]),
};
export const WithBotStacked: Story = {
  args: { onOpen: () => {} },
  render: render(samples.map((s) => ({ ...s, withBot: true }))),
};
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
