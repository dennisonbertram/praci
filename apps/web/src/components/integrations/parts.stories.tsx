import { mailThreadAgentSpawnKey } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { mockBots } from "../../stories/fixtures";
import {
  AgentStack,
  AgentToggleList,
  IntegrationTile,
  MenuSlot,
  OPEN_LINK,
  PHONE_ROW,
  StatusBadge,
} from "./parts";

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

/** Every email's own chat shares one "Email chats" row, as in the sidebar. */
export const ToggleListEmailChats: StoryObj = {
  render: () => {
    const [on, setOn] = useState(new Set(["bot_ada"]));
    const bots = [
      ...mockBots.slice(0, 1),
      ...mockBots.slice(1, 3).map((bot, index) => ({
        ...bot,
        spawnKey: mailThreadAgentSpawnKey("conn_1", `thread_${index}`),
      })),
    ];
    return (
      <div className="w-80">
        <AgentToggleList
          bots={bots}
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

/** Connected cards on a phone: the main link has one width, so the buttons share a left edge. */
export const OpenLinks: StoryObj = {
  render: () => (
    <div className="flex w-[343px] flex-col gap-2.5">
      {["Open Inbox", "Open Investors", "Open Finance"].map((label) => (
        <IntegrationTile key={label} className={PHONE_ROW}>
          <div className="min-w-0 truncate font-semibold">Sample app</div>
          <div className="flex items-center gap-2">
            <a href="#open" className={OPEN_LINK}>
              {label}
            </a>
            <MenuSlot />
          </div>
        </IntegrationTile>
      ))}
    </div>
  ),
};
