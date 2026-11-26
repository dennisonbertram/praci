import { expect, it, vi } from "vitest";
import { listWaitingOnYouItems } from "./scratchpad-waiting.js";

const now = new Date("2026-01-10T12:00:00Z");

it("scopes by space and user and limits to open or parked, past due or waiting on the user", async () => {
  const findMany = vi.fn().mockResolvedValue([
    {
      id: "i1",
      botId: "b1",
      title: "Sign the sample form",
      status: "open",
      waitingOn: "you",
      dueAt: null,
      bot: { name: "Ada" },
    },
  ]);
  const items = await listWaitingOnYouItems(
    { scratchpadItem: { findMany } } as never,
    { spaceId: "s1", userId: "u1" },
    now,
  );
  const args = findMany.mock.calls[0]?.[0];
  expect(args.where).toMatchObject({
    spaceId: "s1",
    userId: "u1",
    status: { in: ["open", "parked"] },
    bot: { archivedAt: null },
  });
  expect(args.where.OR).toContainEqual({ dueAt: { lt: now } });
  expect(args.where.OR).toContainEqual({ waitingOn: { equals: "you", mode: "insensitive" } });
  expect(args.where.OR).toContainEqual({
    waitingOn: { startsWith: "you ", mode: "insensitive" },
  });
  expect(items).toEqual([
    {
      id: "i1",
      botId: "b1",
      botName: "Ada",
      title: "Sign the sample form",
      status: "open",
      waitingOn: "you",
      dueAt: null,
    },
  ]);
});
