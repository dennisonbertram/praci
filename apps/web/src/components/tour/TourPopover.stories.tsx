import type { Meta, StoryObj } from "@storybook/react-vite";
import type { TourStep } from "./TourPopover";
import { TourPopover } from "./TourPopover";

/** A stand-in sidebar with the same data-tour ids the real one carries. */
function FakeSidebar({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-[560px] w-full bg-background">
      <aside className="flex h-full w-[316px] flex-col gap-1 border-e border-sidebar-border bg-sidebar p-3">
        <div className="mb-2 flex items-center gap-1">
          <div data-tour="sidebar-search" className="flex-1 rounded-xl bg-card p-2 text-sm">
            Search
          </div>
          <button type="button" data-tour="create-menu" className="rounded-xl bg-card px-3 py-2">
            +
          </button>
        </div>
        <div data-sidebar-group="main" className="mb-2 rounded-xl bg-card p-2 text-sm">
          Chief
        </div>
        {["sidebar-inbox", "sidebar-finance", "sidebar-legal", "sidebar-data-room"].map((id) => (
          <button
            key={id}
            type="button"
            data-tour={id}
            className="rounded-xl px-2.5 py-2 text-start text-sm hover:bg-sidebar-accent"
          >
            {id.replace("sidebar-", "")}
          </button>
        ))}
        <button type="button" data-tour="user-menu" className="mt-auto py-2 text-start text-sm">
          Demo User
        </button>
      </aside>
      {children}
    </div>
  );
}

const steps: TourStep[] = [
  { id: "search", anchor: '[data-tour="sidebar-search"]', text: "Type here to find anything." },
  { id: "create", anchor: '[data-tour="create-menu"]', text: "Press + to create a bot." },
  { id: "chat", anchor: "[data-sidebar-group]", text: "Chat with Chief here." },
  { id: "inbox", anchor: '[data-tour="sidebar-inbox"]', text: "Inbox sorts your mail." },
  { id: "gone", anchor: '[data-tour="sidebar-missing"]', text: "Never shown." },
  { id: "finance", anchor: '[data-tour="sidebar-finance"]', text: "Finance shows runway." },
  { id: "account", anchor: '[data-tour="user-menu"]', text: "Settings are here." },
];

const meta = {
  title: "Tour/TourPopover",
  component: TourPopover,
  args: { steps, onFinish: () => undefined },
  render: (args) => (
    <FakeSidebar>
      <TourPopover {...args} />
    </FakeSidebar>
  ),
} satisfies Meta<typeof TourPopover>;
export default meta;

/** The step whose element is missing is dropped, so the count reads 1/4. */
export const FirstStep: StoryObj<typeof meta> = {};

export const SingleStep: StoryObj<typeof meta> = { args: { steps: steps.slice(1, 2) } };

/** Under 1024px wide the steps show as a card at the bottom. */
export const Phone: StoryObj<typeof meta> = {
  globals: { viewport: { value: "mobile1" } },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};

/** The last stop at the bottom of a phone: the card sits just above the account button. */
export const PhoneLastStop: StoryObj<typeof meta> = {
  args: { steps: steps.slice(-1) },
  globals: { viewport: { value: "mobile1" } },
  parameters: { viewport: { defaultViewport: "mobile1" } },
};

/** Desktop: the card sits beside the sidebar at one x, never over another row. */
export const DesktopCreateStop: StoryObj<typeof meta> = { args: { steps: steps.slice(1, 2) } };
