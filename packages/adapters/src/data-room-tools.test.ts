import { describe, expect, it, vi } from "vitest";
import {
  DATA_ROOM_TOOL_NAMES,
  dataRoomToolFromTool,
  dataRoomToolsAllowed,
} from "./data-room-tools.js";
import { selectBuiltinToolsForRun } from "./executor.js";

const scope = { spaceId: "s", userId: "u" };
const deck = {
  id: "item-1",
  name: "Q3 Board Deck.pdf",
  docType: "Board deck",
  docDate: new Date("2026-10-01T00:00:00Z"),
  parties: [],
  summary: null,
};

describe("data room tools", () => {
  const base = {
    runUserId: "u",
    botUserId: "u",
    groupId: null,
    groupUserId: undefined,
    messagingChannelRun: false,
  };

  it("are for the owner's bot in their chat or their own group", () => {
    expect(dataRoomToolsAllowed(base)).toBe(true);
    expect(dataRoomToolsAllowed({ ...base, groupId: "g", groupUserId: "u" })).toBe(true);
    expect(dataRoomToolsAllowed({ ...base, groupId: "g", groupUserId: "other" })).toBe(false);
    expect(dataRoomToolsAllowed({ ...base, runUserId: "other" })).toBe(false);
    expect(dataRoomToolsAllowed({ ...base, messagingChannelRun: true })).toBe(false);
  });

  it("are offered only when enabled", () => {
    const offered = (dataRoomEnabled: boolean) =>
      selectBuiltinToolsForRun({
        graphicalToolsAllowed: false,
        pageBrowserAllowed: false,
        groupId: null,
        trigger: "message",
        semanticMemoryEnabled: false,
        messagingChannelRun: false,
        dataRoomEnabled,
      })
        .map((tool) => tool.name)
        .filter((name) => DATA_ROOM_TOOL_NAMES.has(name))
        .sort();
    expect(offered(true)).toEqual(["data_room_read", "data_room_search"]);
    expect(offered(false)).toEqual([]);
  });

  it("data_room_read returns the owner's document text, scoped to the run", async () => {
    const findFirst = vi.fn(async () => deck);
    const textFind = vi.fn(async () => ({ text: "Cash 412000 dollars." }));
    const prisma = {
      dataRoomItem: { findFirst },
      dataRoomItemText: { findFirst: textFind },
    } as never;
    const read = await dataRoomToolFromTool("data_room_read", { prisma, scope }, { id: "item-1" });
    expect(read).toMatchObject({
      name: "Q3 Board Deck.pdf",
      type: "Board deck",
      date: "2026-10-01",
      text: "Cash 412000 dollars.",
      truncated: false,
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({ id: "item-1", spaceId: "s", userId: "u" }),
    });
    expect(textFind).toHaveBeenCalledWith(
      expect.objectContaining({ where: { itemId: "item-1", spaceId: "s", userId: "u" } }),
    );
  });

  it("data_room_read says when the document is not the owner's", async () => {
    const prisma = { dataRoomItem: { findFirst: vi.fn(async () => null) } } as never;
    expect(
      await dataRoomToolFromTool("data_room_read", { prisma, scope }, { id: "elsewhere" }),
    ).toEqual({ error: "No Data room document with this id. Use data_room_search." });
  });

  it("data_room_search with no query lists the owner's documents", async () => {
    const findMany = vi.fn(async () => [deck]);
    const prisma = { dataRoomItem: { findMany } } as never;
    const result = await dataRoomToolFromTool("data_room_search", { prisma, scope }, {});
    expect(result).toEqual({
      documents: [
        {
          id: "item-1",
          name: "Q3 Board Deck.pdf",
          type: "Board deck",
          date: "2026-10-01",
          parties: [],
          summary: null,
        },
      ],
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining(scope) }),
    );
  });
});
