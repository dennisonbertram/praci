import { mailThreadAgentSpawnKey } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { mockBots } from "../../stories/fixtures";
import { AgentStack, AgentToggleList, IntegrationTile, OPEN_LINK, StatusBadge } from "./parts";

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

/** All and None set every agent at once; None leaves the owning agent on. */
export const ToggleListAllNone: StoryObj = {
  render: () => {
    const owner = mockBots[0]!.id;
    const [on, setOn] = useState(new Set([owner]));
    return (
      <div className="w-80">
        <AgentToggleList
          bots={mockBots}
          appName="Sample app"
          ownerBotId={owner}
          isOn={(id) => on.has(id)}
          onToggle={(id, next) =>
            setOn((cur) => {
              const out = new Set(cur);
              if (next) out.add(id);
              else out.delete(id);
              return out;
            })
          }
          onSetAll={(next) => setOn(new Set(next ? mockBots.map((b) => b.id) : [owner]))}
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
        <IntegrationTile key={label}>
          <div className="min-w-0 truncate font-semibold">Sample app</div>
          <div className="flex items-center gap-2">
            <a href="#open" className={OPEN_LINK}>
              {label}
            </a>
          </div>
        </IntegrationTile>
      ))}
    </div>
  ),
};

/** Above 8 agents the list gets search and an On/Off filter; agents that are on come first. */
export const ToggleListLong: StoryObj = {
  render: () => {
    const bots = Array.from({ length: 12 }, (_, i) => ({
      ...mockBots[i % mockBots.length]!,
      id: `bot_${i}`,
      name: `Agent ${String.fromCharCode(65 + i)}`,
    }));
    const [on, setOn] = useState(new Set(["bot_3", "bot_7"]));
    return (
      <div className="w-96">
        <AgentToggleList
          bots={bots}
          appName="Sample app"
          isOn={(id) => on.has(id)}
          onSetAll={() => undefined}
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

/** Under each agent that is on, "Allow changes" starts off; the owning agent shows the connection's own switch. */
export const ToggleListWithChanges: StoryObj = {
  render: () => {
    const owner = mockBots[0]!.id;
    const [on, setOn] = useState(new Set([owner, mockBots[1]!.id]));
    const [writing, setWriting] = useState(new Set<string>());
    return (
      <div className="w-96">
        <AgentToggleList
          bots={mockBots}
          appName="Sample app"
          ownerBotId={owner}
          isOn={(id) => on.has(id)}
          writes={{
            enabled: true,
            isWriting: (id) => writing.has(id),
            onToggle: (id, next) =>
              setWriting((prev) => {
                const copy = new Set(prev);
                if (next) copy.add(id);
                else copy.delete(id);
                return copy;
              }),
          }}
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
