import type { Meta, StoryObj } from "@storybook/react-vite";
import { BotAvatar, GrokShapePreview, Wordmark } from "./bot-avatar";

// A plain inline SVG stands in for an uploaded picture; it is not a real photo.
const pictureAvatar = `data:image/svg+xml,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><rect width="24" height="24" fill="#6b7280"/><circle cx="12" cy="10" r="4" fill="#e5e7eb"/></svg>',
)}`;

const meta = {
  title: "UI/BotAvatar",
  component: BotAvatar,
  args: { color: "#F97316", identity: "bot_demo", size: 48 },
  parameters: {
    docs: {
      description: {
        component:
          "Also shows: WorkingRing (any working status), ShapeAvatar (Shape), RobotAvatar (Robot), OrganicAvatar (Organic).",
      },
    },
  },
} satisfies Meta<typeof BotAvatar>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Organic: Story = { args: { variant: "organic" } };

export const Robot: Story = { args: { variant: "robot" } };

export const Shape: Story = { args: { color: "#F97316::shape_2" } };

export const Picture: Story = { args: { color: pictureAvatar } };

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-end gap-4">
      {[16, 24, 36, 48, 72].map((size) => (
        <BotAvatar key={size} {...args} size={size} />
      ))}
    </div>
  ),
};

export const Working: Story = {
  render: (args) => (
    <div className="flex items-center gap-6 p-2">
      <BotAvatar {...args} variant="organic" status="running" />
      <BotAvatar {...args} variant="robot" status="running" />
      <BotAvatar {...args} color="#F97316::shape_2" status="running" />
      <BotAvatar {...args} color={pictureAvatar} status="running" />
    </div>
  ),
};

export const Moods: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-4">
      {(
        [
          "idle",
          "listening",
          "thinking",
          "working",
          "happy",
          "sad",
          "surprised",
          "sleepy",
          "confused",
          "error",
        ] as const
      ).map((mood) => (
        <BotAvatar key={mood} {...args} variant="organic" mood={mood} />
      ))}
    </div>
  ),
};

export const Colors: Story = {
  render: (args) => (
    <div className="flex flex-wrap items-center gap-4">
      {["#F97316", "#3B82F6", "#10B981", "#A855F7", "#EF4444"].map((color) => (
        <BotAvatar key={color} {...args} color={color} identity={color} />
      ))}
    </div>
  ),
};

export const LookingAway: Story = {
  args: { lookAt: { x: 1, y: -1 } },
};

export const ShapePreview: Story = {
  render: () => (
    <div className="flex gap-2">
      {[0, 1, 2, 3].map((shapeIndex) => (
        <GrokShapePreview
          key={shapeIndex}
          shapeIndex={shapeIndex}
          color="#F97316"
          selected={shapeIndex === 1}
          onClick={() => undefined}
        />
      ))}
    </div>
  ),
};

export const WordmarkLogo: Story = { render: () => <Wordmark /> };
