import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  adoptDeletedSpaceFallback,
  type MobileBot,
  rpc,
  selectedSpaceId,
  selectSpace,
} from "./api";
import {
  canDeleteInboxSpace,
  canRenameInboxSpace,
  type InboxSpace,
  inboxNeedsCreateHint,
  removeInboxSpace,
  renameInboxSpace,
  retryInboxSpaceFallback,
  selectInboxSpace,
  spaceInboxItems,
} from "./inbox-spaces";

vi.mock("./api", () => ({
  adoptDeletedSpaceFallback: vi.fn(),
  rpc: vi.fn(),
  selectedSpaceId: vi.fn(),
  selectSpace: vi.fn(),
}));

function space(overrides: Partial<InboxSpace> = {}): InboxSpace {
  return {
    id: "space-work",
    name: "Work",
    isDefault: false,
    hasContent: false,
    canDelete: true,
    bots: [],
    groups: [],
    botSections: [],
    ...overrides,
  };
}

const bot: MobileBot = {
  id: "bot-1",
  name: "Helper",
  preview: "",
  title: "",
  color: "gray",
  computerMode: "team",
  notifyOnFinish: true,
  threadId: "thread-1",
  pinned: false,
  status: "idle",
  sectionId: null,
  archivedAt: null,
  unread: false,
  updatedAt: "2026-01-01T00:00:00.000Z",
  modelProvider: null,
  modelId: null,
  thinkingLevel: null,
  autoSpeak: false,
};

describe("spaceInboxItems", () => {
  it("keeps an empty space visible and selectable by its own id", () => {
    const empty = space();
    expect(spaceInboxItems([empty])).toEqual([
      { type: "heading", key: empty.id, title: empty.name, space: empty },
    ]);
  });

  it("keeps the only empty default space visible without offering deletion", () => {
    const personal = space({ isDefault: true, canDelete: true });
    const items = spaceInboxItems([personal]);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ type: "heading", space: personal });
    expect(canDeleteInboxSpace(personal)).toBe(false);
    expect(inboxNeedsCreateHint(items)).toBe(true);
  });

  it("does not ask for a create hint once a space has a bot", () => {
    expect(inboxNeedsCreateHint(spaceInboxItems([space({ isDefault: true, bots: [bot] })]))).toBe(
      false,
    );
    expect(inboxNeedsCreateHint([])).toBe(false);
  });

  it("renders space actions once, separate from pinned and named bot sections", () => {
    const work = space({
      bots: [
        { ...bot, pinned: true },
        { ...bot, id: "bot-2", sectionId: "section-1" },
      ],
      botSections: [
        {
          id: "section-1",
          name: "Research",
          position: 0,
          collapsed: false,
          createdAt: "2026-01-01T00:00:00.000Z",
          updatedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const headings = spaceInboxItems([work]).filter((item) => item.type === "heading");
    expect(headings.map((item) => item.title)).toEqual(["Work", "Pinned", "Research"]);
    expect(headings.filter((item) => item.space)).toEqual([
      { type: "heading", key: work.id, title: work.name, space: work },
    ]);
  });

  it("lists folders in the web sidebar's order, with bots and groups ordered together", () => {
    const stamp = "2026-01-01T00:00:00.000Z";
    const group = {
      id: "group-1",
      name: "Planning",
      preview: "",
      pinned: false,
      sectionId: "folder-b",
      position: 0,
      archivedAt: null,
      unread: false,
      updatedAt: stamp,
      members: [],
    };
    const work = space({
      isDefault: true,
      bots: [
        { ...bot, id: "loose", position: 0 },
        { ...bot, id: "b2", sectionId: "folder-b", position: 1 },
        { ...bot, id: "a1", sectionId: "folder-a", position: 0 },
      ],
      groups: [group],
      botSections: [
        {
          id: "folder-b",
          name: "Beta",
          position: 0,
          collapsed: false,
          createdAt: stamp,
          updatedAt: stamp,
        },
        {
          id: "folder-a",
          name: "Alpha",
          position: 1,
          collapsed: true,
          createdAt: stamp,
          updatedAt: stamp,
        },
        {
          id: "folder-empty",
          name: "Empty",
          position: 2,
          collapsed: false,
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
    });
    const rows = spaceInboxItems([work]).map((item) =>
      item.type === "heading" ? item.title : item.type === "bot" ? item.bot.id : item.group.id,
    );
    // Beta holds the group first (position 0) and then bot b2; empty folders have no heading.
    // Alpha was collapsed (on web), so its chats stay hidden until toggled locally.
    expect(rows).toEqual(["Beta", "group-1", "b2", "Alpha", "Unassigned", "loose"]);
    const expanded = spaceInboxItems([work], new Set(["space-work:section:folder-a"])).map(
      (item) =>
        item.type === "heading" ? item.title : item.type === "bot" ? item.bot.id : item.group.id,
    );
    expect(expanded).toEqual(["Beta", "group-1", "b2", "Alpha", "a1", "Unassigned", "loose"]);
    // The same toggle collapses a folder that was expanded.
    const beta = spaceInboxItems([work], new Set(["space-work:section:folder-b"]));
    expect(beta.some((item) => item.type === "group")).toBe(false);
  });

  it("tags headings with a kind so fixed ones can be translated at render", () => {
    const stamp = "2026-01-01T00:00:00.000Z";
    const work = space({
      isDefault: true,
      bots: [
        { ...bot, id: "p", pinned: true },
        { ...bot, id: "f", sectionId: "s1" },
        { ...bot, id: "u" },
      ],
      botSections: [
        {
          id: "s1",
          name: "Research",
          position: 0,
          collapsed: false,
          createdAt: stamp,
          updatedAt: stamp,
        },
      ],
    });
    const kinds = spaceInboxItems([work])
      .filter((item) => item.type === "heading")
      .map((item) => item.kind);
    expect(kinds).toEqual(["pinned", "folder", "unassigned"]);
  });

  it("keeps populated default-space chrome minimal and retains group rows", () => {
    const group = {
      id: "group-1",
      name: "Planning",
      preview: "",
      pinned: false,
      sectionId: null,
      archivedAt: null,
      unread: false,
      updatedAt: "2026-01-01T00:00:00.000Z",
      members: [],
    };
    const items = spaceInboxItems([space({ isDefault: true, bots: [bot], groups: [group] })]);
    expect(items.map((item) => item.type)).toEqual(["bot", "group"]);
    expect(items[0]).toMatchObject({ type: "bot", depth: 0, hasChildren: false });
  });

  it("nests child bots under their parent and can collapse them", () => {
    const parent = { ...bot, id: "parent", parentBotId: null };
    const child = { ...bot, id: "child", parentBotId: "parent" };
    const expanded = spaceInboxItems([space({ isDefault: true, bots: [parent, child] })]);
    expect(expanded.map((item) => ("bot" in item ? [item.bot.id, item.depth] : item.type))).toEqual(
      [
        ["parent", 0],
        ["child", 1],
      ],
    );
    expect(expanded[0]).toMatchObject({ hasChildren: true });
    const collapsed = spaceInboxItems(
      [space({ isDefault: true, bots: [parent, child] })],
      new Set(["parent"]),
    );
    expect(collapsed.map((item) => ("bot" in item ? item.bot.id : item.type))).toEqual(["parent"]);
  });

  it("keeps empty spaces beside a populated space", () => {
    const personal = space({ id: "personal", isDefault: true, bots: [bot] });
    expect(spaceInboxItems([personal, space()]).map((item) => item.type)).toEqual([
      "heading",
      "bot",
      "heading",
    ]);
  });

  it.each([undefined, false])("hides deletion unless ownership is explicit (%s)", (canDelete) => {
    expect(canDeleteInboxSpace(space({ canDelete }))).toBe(false);
  });

  it("offers deletion for an explicitly authorized empty non-default space", () => {
    expect(canDeleteInboxSpace(space())).toBe(true);
  });

  it.each([undefined, false])("hides renaming unless explicit (%s)", (canRename) => {
    expect(canRenameInboxSpace(space({ canRename }))).toBe(false);
  });

  it("offers renaming when the server allows it, even for the default space", () => {
    expect(canRenameInboxSpace(space({ canRename: true, isDefault: true }))).toBe(true);
  });

  it("hides deletion while a space still has content", () => {
    expect(canDeleteInboxSpace(space({ hasContent: true }))).toBe(false);
  });
});

describe("renameInboxSpace", () => {
  beforeEach(() => vi.resetAllMocks());

  it("renames through the server and refreshes", async () => {
    vi.mocked(rpc).mockResolvedValue({ id: "space-work", name: "Ops" });
    const refresh = vi.fn(async () => undefined);
    await renameInboxSpace("space-work", "  Ops ", refresh);
    expect(rpc).toHaveBeenCalledWith("spaces/rename", { spaceId: "space-work", name: "Ops" });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("ignores an empty name and does not refresh when the server rejects", async () => {
    const refresh = vi.fn(async () => undefined);
    await renameInboxSpace("space-work", "   ", refresh);
    expect(rpc).not.toHaveBeenCalled();
    vi.mocked(rpc).mockRejectedValue(new Error("Forbidden"));
    await expect(renameInboxSpace("space-work", "Ops", refresh)).rejects.toThrow("Forbidden");
    expect(refresh).not.toHaveBeenCalled();
  });
});

describe("removeInboxSpace", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(selectedSpaceId).mockReturnValue("space-work");
    vi.mocked(rpc).mockResolvedValue({ ok: true, activeSpaceId: "personal" });
    vi.mocked(selectSpace).mockResolvedValue(true);
    vi.mocked(adoptDeletedSpaceFallback).mockResolvedValue(true);
  });

  it("awaits saving the server fallback before refreshing a deleted current space", async () => {
    let finishSelection!: (saved: boolean) => void;
    vi.mocked(selectSpace).mockImplementation(
      () =>
        new Promise((resolve) => {
          finishSelection = resolve;
        }),
    );
    const refresh = vi.fn(async () => undefined);
    const removing = removeInboxSpace("space-work", refresh);
    await vi.waitFor(() => expect(selectSpace).toHaveBeenCalledWith("personal"));
    expect(refresh).not.toHaveBeenCalled();
    finishSelection(true);
    await expect(removing).resolves.toBeNull();
    expect(rpc).toHaveBeenCalledWith("spaces/remove", { spaceId: "space-work" });
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("keeps the selection when deleting another space", async () => {
    vi.mocked(selectedSpaceId).mockReturnValue("personal");
    const refresh = vi.fn(async () => undefined);
    await expect(removeInboxSpace("space-work", refresh)).resolves.toBeNull();
    expect(selectSpace).not.toHaveBeenCalled();
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("adopts and refreshes the server fallback when direct persistence fails", async () => {
    vi.mocked(selectSpace).mockResolvedValue(false);
    const refresh = vi.fn(async () => undefined);
    await expect(removeInboxSpace("space-work", refresh)).resolves.toBeNull();
    expect(adoptDeletedSpaceFallback).toHaveBeenCalledWith("personal");
    expect(refresh).toHaveBeenCalledOnce();
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("retains a retry when neither fallback recovery write is durable", async () => {
    vi.mocked(selectSpace).mockResolvedValue(false);
    vi.mocked(adoptDeletedSpaceFallback).mockResolvedValue(false);
    const refresh = vi.fn(async () => undefined);
    const recoveryId = await removeInboxSpace("space-work", refresh);
    expect(recoveryId).toBe("personal");
    expect(refresh).toHaveBeenCalledOnce();
    vi.mocked(adoptDeletedSpaceFallback).mockResolvedValue(true);
    await expect(retryInboxSpaceFallback(recoveryId!, refresh)).resolves.toBe(true);
    expect(adoptDeletedSpaceFallback).toHaveBeenCalledTimes(2);
    expect(adoptDeletedSpaceFallback).toHaveBeenLastCalledWith("personal");
    expect(selectSpace).toHaveBeenCalledOnce();
    expect(refresh).toHaveBeenCalledTimes(2);
    expect(rpc).toHaveBeenCalledOnce();
  });

  it("keeps the retry visible when fallback persistence still fails", async () => {
    vi.mocked(adoptDeletedSpaceFallback).mockResolvedValue(false);
    const refresh = vi.fn(async () => undefined);
    await expect(retryInboxSpaceFallback("personal", refresh)).resolves.toBe(false);
    expect(refresh).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("selects an empty inbox without creating a bot or starting onboarding", async () => {
    const refresh = vi.fn(async () => undefined);
    await expect(selectInboxSpace("space-work", refresh)).resolves.toBe(true);
    expect(selectSpace).toHaveBeenCalledWith("space-work");
    expect(refresh).toHaveBeenCalledOnce();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("does not refresh when selecting an empty space fails", async () => {
    vi.mocked(selectSpace).mockResolvedValue(false);
    const refresh = vi.fn(async () => undefined);
    await expect(selectInboxSpace("space-work", refresh)).resolves.toBe(false);
    expect(refresh).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("also adopts the fallback when native selection throws", async () => {
    vi.mocked(selectSpace).mockRejectedValue(new Error("storage unavailable"));
    const refresh = vi.fn(async () => undefined);
    await expect(removeInboxSpace("space-work", refresh)).resolves.toBeNull();
    expect(adoptDeletedSpaceFallback).toHaveBeenCalledWith("personal");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("leaves selection and inbox unchanged when deletion is rejected", async () => {
    vi.mocked(rpc).mockRejectedValue(new Error("Space is not empty"));
    const refresh = vi.fn(async () => undefined);
    await expect(removeInboxSpace("space-work", refresh)).rejects.toThrow("Space is not empty");
    expect(selectSpace).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
