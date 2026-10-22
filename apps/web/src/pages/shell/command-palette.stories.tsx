import type { Meta, StoryObj } from "@storybook/react-vite";
import { BookUser, FileText, MessageSquare, Search } from "lucide-react";
import { screen, userEvent } from "storybook/test";
import { withPageBehind } from "../../stories/decorators";
import { detailedBots } from "../../stories/fixtures";
import { CommandPalette } from "./command-palette";

const meta = {
  title: "Shell/Command palette",
  component: CommandPalette,
  args: {
    open: true,
    onOpenChange: () => undefined,
    bots: detailedBots,
    onSelectBot: () => undefined,
    pages: [
      { id: "inbox", label: "Inbox" },
      { id: "finance", label: "Finance" },
      { id: "data-room", label: "Data room" },
    ],
    groups: [{ id: "group_1", label: "Sample group" }],
  },
  decorators: [withPageBehind("Page behind the palette")],
} satisfies Meta<typeof CommandPalette>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NoBots: Story = { args: { bots: [] } };

export const ManyBots: Story = {
  name: "More than nine bots (shortcuts stop at 9)",
  args: {
    bots: Array.from({ length: 11 }, (_, i) => ({
      ...(detailedBots[0] ?? ({} as never)),
      id: `bot_${i}`,
      name: `Sample bot ${i + 1}`,
    })),
  },
};

export const NoSearchMatch: Story = {
  name: "No match keeps Search mail for",
  args: {
    searchLinks: async () => [
      {
        heading: "Mail",
        fallback: true,
        icon: <Search size={16} strokeWidth={1.75} />,
        entries: [{ id: "/app/inbox?q=zzzz", label: "Search mail for “zzzz”" }],
      },
    ],
  },
  play: async () => {
    await userEvent.type(await screen.findByTestId("command-palette-search"), "zzzz");
  },
};

/** The search is still running: the list stays empty, with no "No results". */
export const SearchPending: Story = {
  args: { searchLinks: () => new Promise(() => undefined) },
  play: async () => {
    await userEvent.type(await screen.findByTestId("command-palette-search"), "zzzz");
  },
};

export const Closed: Story = { args: { open: false } };

export const SearchFindsPage: Story = {
  name: "Search lists a matching page first",
  play: async () => {
    await userEvent.type(await screen.findByTestId("command-palette-search"), "fin");
  },
};

export const SearchFindsContactsAndChats: Story = {
  name: "Search shows why a contact and a chat matched",
  args: {
    searchLinks: async () => [
      {
        heading: "Mail",
        fallback: true,
        icon: <Search size={16} strokeWidth={1.75} />,
        entries: [{ id: "/app/inbox?q=halcyon", label: "Search mail for “halcyon”" }],
      },
      {
        heading: "Contacts",
        icon: <BookUser size={16} strokeWidth={1.75} />,
        entries: [
          {
            id: "/app/contacts?q=Ada%20Example",
            label: "Ada Example",
            detail: "Halcyon Logistics",
          },
          {
            id: "/app/contacts?q=Ben%20Sample",
            label: "Ben Sample",
            detail: "ben@halcyon.example",
          },
        ],
      },
      {
        heading: "Documents",
        icon: <FileText size={16} strokeWidth={1.75} />,
        entries: [
          {
            id: "/app/data-room?item=d1",
            label: "Board materials and diligence index for the Halcyon Logistics investment",
          },
        ],
      },
      {
        heading: "Chats",
        icon: <MessageSquare size={16} strokeWidth={1.75} />,
        entries: [
          {
            id: "/app/g/g1?m=m1",
            label: "Leadership sync",
            detail: "Halcyon security questionnaire is due Friday",
            date: "Oct 3",
          },
        ],
      },
    ],
  },
  play: async () => {
    await userEvent.type(await screen.findByTestId("command-palette-search"), "halcyon");
  },
};

export const SearchTitleBeforeBody: Story = {
  name: "A title match comes before body-only hits",
  args: {
    searchLinks: async () => [
      {
        heading: "Documents",
        icon: <FileText size={16} strokeWidth={1.75} />,
        entries: [
          {
            id: "/app/data-room?item=d1",
            label: "Monthly Update",
            detail: "Runway is $1,620,000; hiring plan on track",
          },
          { id: "/app/data-room?item=d2", label: "Board Update", detail: "Hiring plan approved" },
        ],
      },
      {
        heading: "Artifacts",
        icon: <FileText size={16} strokeWidth={1.75} />,
        entries: [{ id: "/app/artifacts/a1", label: "Hiring Plan - Q4" }],
      },
    ],
  },
  play: async () => {
    await userEvent.type(await screen.findByTestId("command-palette-search"), "Hiring Plan");
  },
};
