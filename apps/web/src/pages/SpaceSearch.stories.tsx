import type { SearchHit } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { SpaceSearchResults } from "./SpaceSearch";

const hits: SearchHit[] = [
  {
    kind: "message",
    botId: "bot_demo",
    botName: "Demo bot",
    title: "Quarterly planning notes",
    snippet: "We agreed to review the sample budget next week.",
    messageId: "msg_1",
  },
  {
    kind: "conversation",
    groupId: "group_demo",
    groupName: "Demo group",
    title: "Launch checklist",
    snippet: "Draft the announcement and confirm the date.",
  },
  {
    kind: "file",
    botId: "bot_demo",
    botName: "Demo bot",
    title: "A very long file name that should be cut off before it reaches the end of the row.pdf",
    snippet:
      "A long snippet that also needs to be truncated because it does not fit on a single line of the list.",
    artifactId: "artifact_1",
  },
  {
    kind: "routine",
    botId: "bot_demo",
    botName: "Demo bot",
    title: "Weekly summary",
    snippet: "Runs every Monday",
    routineId: "routine_1",
  },
];

const meta = {
  title: "Shell/Space search results",
  component: SpaceSearchResults,
  args: { hits, loading: false, onSelect: () => undefined },
  decorators: [
    (Story) => (
      <div className="w-96">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SpaceSearchResults>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Loading: Story = { args: { loading: true } };
export const Empty: Story = { args: { hits: [] } };
