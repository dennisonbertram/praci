import type { Bot } from "@rakazo/contracts";
import { mailThreadAgentSpawnKey } from "@rakazo/contracts";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { mockRpc } from "../../lib/__mocks__/rpc";
import { mockBots } from "../../stories/fixtures";
import { BotAccessSection } from "./BotAccessSection";

const bot = mockBots[0] as Bot;
const connection = (
  id: string,
  name: string,
  account: string,
  agentBotId: string | null = null,
) => ({
  id,
  provider: name.toLowerCase(),
  displayName: name,
  account,
  status: "connected",
  agentBotId,
});

const few = [
  connection("c1", "Gmail", "ann@example.com"),
  connection("c2", "Gmail", "ops@example.com"),
  connection("c3", "Mercury", "", bot.id),
];
const many = Array.from({ length: 10 }, (_, i) =>
  connection(`m${i}`, `App ${String.fromCharCode(65 + i)}`, `user${i}@example.com`),
);

const loaded = (rows: ReturnType<typeof connection>[]) => ({
  "connections.list": rows,
  "connections.effectiveAccess": Object.fromEntries(
    rows.map((row, i) => [row.id, { shared: "some", botIds: i % 2 === 0 ? [bot.id] : [] }]),
  ),
  "connections.accessAll": Object.fromEntries(
    rows.map((row) => [
      row.id,
      { allAgents: true, botIds: [], agentShared: true, writeBotIds: [] },
    ]),
  ),
  "connections.setAgentAccess": null,
  "capabilities.list": [],
  "mcp.servers.list": [],
  "mcp.assignments.list": [],
});

const meta = {
  title: "Shell/BotAccessSection",
  component: BotAccessSection,
  args: { bot },
  decorators: [
    (Story) => (
      <div className="w-full max-w-96 px-4">
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BotAccessSection>;
export default meta;

/** The agent's own connection (Mercury) is on and cannot be turned off. */
export const Few: StoryObj<typeof meta> = { beforeEach: () => mockRpc(loaded(few)) };

/** Above 8 rows a search box appears. */
export const WithSearch: StoryObj<typeof meta> = { beforeEach: () => mockRpc(loaded(many)) };

/** A directly connected source: this agent can be added, and given Allow changes. */
export const WithSource: StoryObj<typeof meta> = {
  beforeEach: () =>
    mockRpc({
      ...loaded(few),
      "capabilities.list": [
        {
          id: "src1",
          kind: "api",
          name: "Contacts API",
          source: "https://api.example.test/v1",
          version: "1.0.0",
          digest: null,
          secretConfigured: false,
          config: {},
          createdAt: "2026-01-01T00:00:00.000Z",
          agentBotId: "bot_other",
          allAgents: false,
          agentShared: true,
          writesEnabled: true,
          usableBotIds: ["bot_other", bot.id],
          writeBotIds: [],
        },
      ],
      "capabilities.setAgentAccess": null,
    }),
};

/** A Firewall agent the owner gave Always on a request-access card: each use still asks, and the switch removes it. */
export const WithFirewallGrants: StoryObj<typeof meta> = {
  args: { bot: { ...bot, firewall: true, firewallAskCapabilities: ["contacts", "calendar_read"] } },
  beforeEach: () => mockRpc({ ...loaded([]), "bots.update": null }),
};

/** A firewalled agent reads only mail carrying its label; clearing the field widens it to the whole account. */
export const FirewallAgentWithLabel: StoryObj<typeof meta> = {
  args: { bot: { ...bot, firewall: true } },
  beforeEach: () =>
    mockRpc({
      ...loaded([]),
      "connections.list": [connection("c1", "Gmail", "support@example.com", null)],
      "connections.effectiveAccess": { c1: { shared: "some", botIds: [bot.id] } },
      "connections.accessAll": {
        c1: {
          allAgents: false,
          botIds: [bot.id],
          agentShared: true,
          writeBotIds: [],
          supportLabels: { [bot.id]: "Support" },
        },
      },
    }),
};

/** Locked switches say why: the agent's own account, another agent's private connection, and an exclusive server. */
export const LockedReasons: StoryObj<typeof meta> = {
  beforeEach: () =>
    mockRpc({
      ...loaded([
        connection("c1", "Mercury", "", bot.id),
        connection("c2", "Brex", "", "bot_other"),
      ]),
      "connections.accessAll": {
        c1: { allAgents: true, botIds: [], agentShared: true, writeBotIds: [] },
        c2: { allAgents: true, botIds: [], agentShared: false, writeBotIds: [] },
      },
      "mcp.servers.list": [
        {
          id: "s1",
          name: "Docs",
          enabled: true,
          agentBotId: "bot_other",
          agentExclusive: true,
        },
      ],
    }),
};

/** A firewalled or external agent can never reach a source, so its switch stays off. */
export const FirewallSourceLocked: StoryObj<typeof meta> = {
  args: { bot: { ...bot, firewall: true } },
  beforeEach: () =>
    mockRpc({
      ...loaded([]),
      "capabilities.list": [
        {
          id: "src1",
          kind: "api",
          name: "Contacts API",
          source: "https://api.example.test/v1",
          version: "1.0.0",
          digest: null,
          secretConfigured: false,
          config: {},
          createdAt: "2026-01-01T00:00:00.000Z",
          agentBotId: "bot_other",
          allAgents: false,
          agentShared: true,
          writesEnabled: true,
          usableBotIds: ["bot_other"],
          writeBotIds: [],
        },
      ],
    }),
};

/** An email's own agent follows the Inbox agent on every account; one line under the heading says so. */
export const MailChatAgent: StoryObj<typeof meta> = {
  args: { bot: { ...bot, name: "Re: pricing", spawnKey: mailThreadAgentSpawnKey("c1", "t1") } },
  beforeEach: () =>
    mockRpc(
      loaded([
        connection("c1", "Gmail", "ann@example.com", "bot_inbox"),
        connection("c2", "Slack", "", null),
      ]),
    ),
};
