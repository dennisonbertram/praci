import type { Bot, BotPins, BotSection } from "@rakazo/contracts";

/** Invented data shared by stories. Never put real names, emails or amounts here. */
const STAMP = "2026-01-01T00:00:00.000Z";

/** The one bot builder. Pass only the fields a story needs to differ. */
export function makeBot(overrides: Partial<Bot> = {}): Bot {
  return {
    id: "bot_demo",
    spaceId: "space_demo",
    name: "Demo bot",
    title: "Assistant",
    description: "",
    instructions: "",
    color: "#6366f1",
    notifyOnFinish: false,
    pinned: false,
    sectionId: null,
    archivedAt: null,
    unread: false,
    parentBotId: null,
    memoryScope: null,
    threadId: "thread_demo",
    preview: "",
    status: "idle",
    runErrorId: null,
    computerMode: "team",
    updatedAt: STAMP,
    createdAt: STAMP,
    voiceId: null,
    autoSpeak: false,
    modelProvider: null,
    modelId: null,
    thinkingLevel: null,
    teamChatAmbientEnabled: false,
    teamChatRules: "",
    disabledBuiltinTools: [],
    webhookConfigured: false,
    spawnKey: null,
    runPhase: null,
    ...overrides,
  };
}

/** A default bot. */
export const mockBot = makeBot();

/** A bot with team-chat settings filled in, for the bot panel and external conversation stories. */
export const scoutBot = makeBot({
  name: "Scout",
  title: "Research helper",
  description: "Looks things up and keeps notes.",
  instructions: "Look things up and keep notes.",
  color: "#6A6BF5",
  notifyOnFinish: true,
  teamChatAmbientEnabled: true,
  teamChatRules: "Engage when asked a question.",
});

/** Three plain bots. */
export const mockBots: Bot[] = [
  makeBot({ id: "bot_ada", name: "Ada", title: "Helper", color: "#6366f1" }),
  makeBot({ id: "bot_ben", name: "Ben", title: "Helper", color: "#10b981" }),
  makeBot({ id: "bot_cy", name: "Cy", title: "Helper", color: "#f59e0b" }),
];

/** Bots with descriptions, a running status and a name too long for its row. */
export const detailedBots: Bot[] = [
  makeBot({
    id: "bot_ada",
    name: "Ada",
    title: "Bookkeeper",
    description: "Reconciles the sample ledger every week.",
    color: "#2f7d6d",
    threadId: "thread_bot_ada",
  }),
  makeBot({
    id: "bot_ben",
    name: "Ben",
    title: "Researcher",
    color: "#6d5bd0",
    preview: "Found three sample sources.",
    status: "running",
    threadId: "thread_bot_ben",
  }),
  makeBot({
    id: "bot_cy",
    name: "A bot with a very long name that has to truncate in the row",
    color: "#b4532a",
    description:
      "A long description that also has to be cut off when the row is narrower than the text.",
    threadId: "thread_bot_cy",
  }),
];

/** Four bots for the picker and group stories. */
export const teamBots: Bot[] = [
  makeBot({ id: "bot_ada", name: "Ada", title: "Ada helper", color: "#3b82f6" }),
  makeBot({ id: "bot_bram", name: "Bram", title: "Bram helper", color: "#10b981" }),
  makeBot({
    id: "bot_cleo",
    name: "Cleo",
    title: "Cleo helper",
    color: "#f59e0b",
    status: "running",
  }),
  makeBot({ id: "bot_dara", name: "Dara", title: "Dara helper", color: "#ef4444" }),
];

export const mockSections: BotSection[] = [
  { id: "sec_one", name: "Work", position: 0, createdAt: STAMP, updatedAt: STAMP },
  { id: "sec_two", name: "Home", position: 1, createdAt: STAMP, updatedAt: STAMP },
];

export const mockPins: BotPins = {
  botId: "bot_demo",
  stats: [
    { id: "runway", label: "Runway", value: "14 months", detail: "at current spend" },
    { id: "open", label: "Open invoices", value: "3" },
  ],
  list: {
    title: "This week",
    items: [
      { id: "a", text: "Send the demo invoice", done: false },
      { id: "b", text: "Review the sample budget", done: true },
    ],
  },
  revision: 1,
  updatedBy: "bot",
  updatedAt: STAMP,
  refreshedAt: STAMP,
};
