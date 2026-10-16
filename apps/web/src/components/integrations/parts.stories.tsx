import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { mockBots } from "../../stories/fixtures-6";
import { AgentStack, AgentToggleList, IntegrationTile, StatusBadge } from "./parts";

const meta = {
  title: "Integrations/Parts",
  parameters: { layout: "padded" },
} satisfies Meta;
export default meta;

export const Tile: StoryObj = {
  render: () => (
    <IntegrationTile className="w-64">
      <span className="text-sm font-medium">Sample app</span>
      <StatusBadge status="connected" />
    </IntegrationTile>
  ),
};

export const Statuses: StoryObj = {
  render: () => (
    <div className="flex flex-wrap gap-3">
      <StatusBadge status="connected" />
      <StatusBadge status="reconnect" />
      <StatusBadge status="failed" />
      <StatusBadge status="connecting" />
    </div>
  ),
};

export const Stack: StoryObj = { render: () => <AgentStack bots={mockBots} /> };

export const StackOverflow: StoryObj = {
  render: () => <AgentStack bots={mockBots} max={2} />,
};

export const ToggleList: StoryObj = {
  render: () => {
    const [on, setOn] = useState(new Set(["bot_ada"]));
    return (
      <div className="w-80">
        <AgentToggleList
          bots={mockBots}
          appName="Sample app"
          isOn={(id) => on.has(id)}
          onToggle={(id, next) =>
            setOn((prev) => {
              const copy = new Set(prev);
              if (next) copy.add(id);
              else copy.delete(id);
              return copy;
            })
          }
        />
      </div>
    );
  },
};

export const ToggleListDisabled: StoryObj = {
  render: () => (
    <div className="w-80">
      <AgentToggleList
        bots={mockBots}
        appName="Sample app"
        isOn={(id) => id === "bot_ben"}
        disabled
        onToggle={() => undefined}
      />
    </div>
  ),
};
