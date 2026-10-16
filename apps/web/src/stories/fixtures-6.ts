import type { Bot, BotSection } from "@rakazo/contracts";
import * as direct from "../lib/__mocks__/rpc";
import * as aliased from "../lib/rpc";

/** Invented bots for the batch-6 stories. */
export function mockBot(overrides: Partial<Bot> = {}): Bot {
  return {
    id: "bot_demo",
    spaceId: "space_demo",
    name: "Demo bot",
    title: "Helper",
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
    updatedAt: "2026-01-01T00:00:00.000Z",
    createdAt: "2026-01-01T00:00:00.000Z",
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
    ...overrides,
  } as Bot;
}

export const mockBots: Bot[] = [
  mockBot({ id: "bot_ada", name: "Ada", color: "#6366f1" }),
  mockBot({ id: "bot_ben", name: "Ben", color: "#10b981" }),
  mockBot({ id: "bot_cy", name: "Cy", color: "#f59e0b" }),
];

export const mockSections: BotSection[] = [
  {
    id: "sec_one",
    name: "Work",
    position: 0,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "sec_two",
    name: "Home",
    position: 1,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
];

type RpcResponses = Record<string, unknown>;
type MockModule = { mockRpc: (map: RpcResponses) => void; resetRpcMocks: () => void };

/**
 * Registers rpc responses for a story. The built Storybook bundles the rpc mock twice (once under
 * `lib/rpc`, which components call, and once as `lib/__mocks__/rpc`), each with its own response
 * table, so the table that components read is filled through the `lib/rpc` alias as well.
 */
export function mockRpc(map: RpcResponses): void {
  const instances = [direct, aliased as unknown as Partial<MockModule>].filter(
    (m): m is MockModule => typeof m.mockRpc === "function",
  );
  for (const instance of instances) {
    instance.resetRpcMocks();
    instance.mockRpc(map);
  }
}

const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/** Keeps remote app logos from loading, so stories need no network. */
export function blockRemoteLogos(): () => void {
  const original = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, "src");
  if (!original?.set) return () => {};
  Object.defineProperty(HTMLImageElement.prototype, "src", {
    ...original,
    set(value: string) {
      original.set?.call(this, /^https?:/.test(value) ? PIXEL : value);
    },
  });
  return () => Object.defineProperty(HTMLImageElement.prototype, "src", original);
}
