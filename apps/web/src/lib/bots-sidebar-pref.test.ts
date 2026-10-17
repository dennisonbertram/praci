import { describe, expect, it, vi } from "vitest";
import {
  botsSidebarCollapsedStorageKey,
  readBotsSidebarCollapsed,
  readCartaAgentCollapsed,
  readInboxAgentCollapsed,
  writeBotsSidebarCollapsed,
  writeCartaAgentCollapsed,
  writeInboxAgentCollapsed,
} from "./bots-sidebar-pref";

describe("bots sidebar collapse preference", () => {
  it("builds a per-user storage key", () => {
    expect(botsSidebarCollapsedStorageKey(null)).toBeNull();
    expect(botsSidebarCollapsedStorageKey("user-1")).toBe("rakazo:bots-sidebar-collapsed:user-1");
  });

  it("reads and writes collapsed state", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
    expect(readBotsSidebarCollapsed("user-1")).toBe(false);
    writeBotsSidebarCollapsed("user-1", true);
    expect(readBotsSidebarCollapsed("user-1")).toBe(true);
    writeBotsSidebarCollapsed("user-1", false);
    expect(readBotsSidebarCollapsed("user-1")).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe("Inbox agent panel collapse preference", () => {
  it("is stored per user, apart from the bots sidebar", () => {
    const store = new Map<string, string>();
    vi.stubGlobal("window", {
      localStorage: {
        getItem: (key: string) => store.get(key) ?? null,
        setItem: (key: string, value: string) => {
          store.set(key, value);
        },
        removeItem: (key: string) => {
          store.delete(key);
        },
      },
    });
    // Closed until the person opens it, like the other pages' agents.
    expect(readInboxAgentCollapsed("user-1")).toBe(true);
    writeInboxAgentCollapsed("user-1", false);
    expect(store.get("rakazo:inbox-agent-open:user-1")).toBe("1");
    expect(readInboxAgentCollapsed("user-1")).toBe(false);
    expect(readInboxAgentCollapsed("user-2")).toBe(true);
    expect(readBotsSidebarCollapsed("user-1")).toBe(false);
    writeInboxAgentCollapsed("user-1", true);
    expect(store.size).toBe(0);
    // The Carta agent panel has its own preference.
    writeCartaAgentCollapsed("user-1", true);
    expect(readCartaAgentCollapsed("user-1")).toBe(true);
    expect(readInboxAgentCollapsed("user-1")).toBe(false);
    writeCartaAgentCollapsed("user-1", false);
    expect(store.size).toBe(0);
    vi.unstubAllGlobals();
  });
});
