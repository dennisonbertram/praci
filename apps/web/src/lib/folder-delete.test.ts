import { i18n } from "@lingui/core";
import type { BotSection } from "@rakazo/contracts";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteFolderWithUndo } from "./folder-delete";

i18n.loadAndActivate({ locale: "en", messages: {} });

const folder = { id: "f1", name: "Money", collapsed: true } as BotSection;
const items = [
  { kind: "bot" as const, id: "ledger" },
  { kind: "group" as const, id: "counsel" },
];

const setup = (overrides: { remove?: () => Promise<unknown> } = {}) => {
  const api = {
    remove: vi.fn(overrides.remove ?? (async () => ({ ok: true }))),
    add: vi.fn(async () => ({ ...folder, id: "f2" })),
    setCollapsed: vi.fn(async () => ({ ...folder, id: "f2" })),
    move: vi.fn(async (_input: unknown) => ({ ok: true })),
  };
  const calls = {
    hide: vi.fn(),
    refresh: vi.fn(async () => undefined),
    notify: vi.fn<(title: string, action?: { label: string; onClick: () => void }) => void>(),
    fail: vi.fn(),
  };
  const run = () => deleteFolderWithUndo({ folder, items, api, ...calls });
  return { api, calls, run };
};

describe("deleteFolderWithUndo", () => {
  beforeEach(() => vi.clearAllMocks());

  it("deletes at once and offers Undo, with no confirmation", async () => {
    const { api, calls, run } = setup();
    await run();
    expect(calls.hide).toHaveBeenCalled();
    expect(api.remove).toHaveBeenCalledWith({ sectionId: "f1" });
    expect(calls.notify).toHaveBeenCalledWith(
      "Deleted Money",
      expect.objectContaining({ label: "Undo" }),
    );
  });

  it("Undo recreates the folder and files its chats back in order", async () => {
    const { api, calls, run } = setup();
    await run();
    await calls.notify.mock.calls[0]![1]!.onClick();
    expect(api.add).toHaveBeenCalledWith({ name: "Money" });
    expect(api.setCollapsed).toHaveBeenCalledWith({ sectionId: "f2", collapsed: true });
    expect(api.move.mock.calls.map(([input]) => input)).toEqual([
      { item: items[0], folderId: "f2", beforeItem: null },
      { item: items[1], folderId: "f2", beforeItem: null },
    ]);
    expect(calls.refresh).toHaveBeenCalled();
  });

  it("a failed delete shows the existing error and reloads the folder", async () => {
    const { calls, run } = setup({
      remove: async () => {
        throw new Error("nope");
      },
    });
    await run();
    expect(calls.fail).toHaveBeenCalledWith(expect.any(Error));
    expect(calls.notify).not.toHaveBeenCalled();
    expect(calls.refresh).toHaveBeenCalled();
  });
});
