import type { Meta, StoryObj } from "@storybook/react-vite";
import { ScrollArea, ScrollBar } from "./scroll-area";

const meta = { title: "UI/Scroll area", component: ScrollArea } satisfies Meta<typeof ScrollArea>;
export default meta;

const items = Array.from({ length: 30 }, (_, index) => `Sample item ${index + 1}`);

export const Vertical: StoryObj<typeof meta> = {
  render: () => (
    <ScrollArea className="h-56 w-64 rounded-lg border border-border">
      <ul className="p-3 text-sm">
        {items.map((item) => (
          <li key={item} className="border-b border-border py-1.5 last:border-0">
            {item}
          </li>
        ))}
      </ul>
    </ScrollArea>
  ),
};

export const Horizontal: StoryObj<typeof meta> = {
  render: () => (
    <ScrollArea className="w-72 rounded-lg border border-border">
      <div className="flex w-max gap-2 p-3">
        {items.slice(0, 12).map((item) => (
          <span key={item} className="rounded-md bg-muted px-3 py-2 text-sm whitespace-nowrap">
            {item}
          </span>
        ))}
      </div>
      <ScrollBar orientation="horizontal" />
    </ScrollArea>
  ),
};
