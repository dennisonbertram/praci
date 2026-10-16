import type { ComposerMention } from "@rakazo/core";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { MentionIcon } from "./mention-icon";

const mentions: ComposerMention[] = [
  { kind: "bot", id: "bot_demo", name: "Demo bot", color: "#4f46e5" },
  { kind: "bot", id: "bot_plain", name: "Plain bot" },
  { kind: "routine", id: "routine_demo", name: "Weekly summary" },
  { kind: "connector", id: "connector_demo", name: "Sample connector" },
  { kind: "group", id: "group_demo", name: "Demo group" },
  { kind: "everyone", id: "everyone", name: "everyone" },
];

const meta = { title: "Shell/Mention icon" } satisfies Meta;
export default meta;

function Grid({ variant }: { variant: "option" | "chip" }) {
  return (
    <div className="flex flex-col gap-2">
      {mentions.map((mention) => (
        <div key={mention.id} className="flex items-start gap-2 text-sm">
          <MentionIcon mention={mention} variant={variant} />
          <span>{mention.kind}</span>
        </div>
      ))}
    </div>
  );
}

export const Option: StoryObj = { render: () => <Grid variant="option" /> };
export const Chip: StoryObj = { render: () => <Grid variant="chip" /> };
