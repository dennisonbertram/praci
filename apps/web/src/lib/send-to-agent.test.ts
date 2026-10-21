import type { Bot, DataRoomApiItem } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { planSendToAgent, sendTargets } from "./send-to-agent";

const file = (id: string) =>
  ({ id, name: `${id}.pdf`, mimeType: "application/pdf" }) as DataRoomApiItem;
const bot = (over: Partial<Bot>) =>
  ({
    id: "b",
    name: "B",
    color: "#000",
    updatedAt: "2026-01-01T00:00:00.000Z",
    archivedAt: null,
    spawnKey: null,
    disabledBuiltinTools: [],
    ...over,
  }) as Bot;

it("sends every picked file by reference to an agent that can open the Data room", () => {
  const items = [file("a"), file("b"), file("c")];
  expect(planSendToAgent(bot({}), items)).toEqual({ refs: items, copies: [] });
  expect(planSendToAgent(bot({ spawnKey: "data-room-agent:u" }), items).refs).toEqual(items);
});

it("copies the files as attachments for agents without Data room tools", () => {
  const items = [file("a"), file("b")];
  for (const over of [
    { spawnKey: "integration-agent:srv" },
    { spawnKey: "carta-agent:u" },
    { disabledBuiltinTools: ["read_data_room_item"] },
  ]) {
    expect(planSendToAgent(bot(over), items)).toEqual({ refs: [], copies: items });
  }
});

it("lists unarchived agents, most recently active first", () => {
  const targets = sendTargets([
    bot({ id: "old", updatedAt: "2026-01-01T00:00:00.000Z" }),
    bot({ id: "gone", archivedAt: "2026-02-01T00:00:00.000Z" }),
    bot({ id: "new", updatedAt: "2026-03-01T00:00:00.000Z" }),
  ]);
  expect(targets.map((target) => target.id)).toEqual(["new", "old"]);
});

it("lists the page agents first and leaves out email thread agents", () => {
  const targets = sendTargets([
    bot({ id: "recent", updatedAt: "2026-05-01T00:00:00.000Z" }),
    bot({ id: "thread", spawnKey: "mail-thread:c1:t1", updatedAt: "2026-06-01T00:00:00.000Z" }),
    bot({ id: "chief", spawnKey: "onboarding:first", updatedAt: "2026-01-01T00:00:00.000Z" }),
    bot({ id: "finance", spawnKey: "finance-agent:u", updatedAt: "2026-01-01T00:00:00.000Z" }),
    bot({ id: "legal", spawnKey: "legal-agent:u", updatedAt: "2026-01-01T00:00:00.000Z" }),
    bot({ id: "dataroom", spawnKey: "data-room-agent:u", updatedAt: "2026-01-01T00:00:00.000Z" }),
  ]);
  expect(targets.map((target) => target.id)).toEqual([
    "dataroom",
    "legal",
    "finance",
    "chief",
    "recent",
  ]);
});
