import type { Bot } from "@rakazo/contracts";

/** Invented bot shared by the stories in batch 2. */
export const mockBot: Bot = {
  id: "bot_demo",
  spaceId: "space_demo",
  name: "Demo bot",
  title: "Assistant",
  description: "",
  instructions: "",
  color: "#888888",
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
};

/**
 * Reaches the rpc stand-in that components actually import. `sb.mock` builds that module as a
 * separate instance from a direct import of `lib/__mocks__/rpc`, so `mockRpc` imported from
 * there fills a different response table and components still get null. The stand-in also exports
 * `mockRpc` and `resetRpcMocks`, so go through `lib/rpc`, which Storybook redirects to it.
 */
import * as standIn from "../lib/rpc";

type RpcTable = Record<string, unknown | ((input: unknown) => unknown)>;
const table = standIn as unknown as { mockRpc(map: RpcTable): void; resetRpcMocks(): void };

export const mockRpc = (map: RpcTable): void => table.mockRpc(map);
export const resetRpc = (): void => table.resetRpcMocks();
