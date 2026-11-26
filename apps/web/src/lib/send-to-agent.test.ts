import type { Bot, DataRoomApiItem } from "@rakazo/contracts";
import { ATTACHMENT_MAX_COUNT } from "@rakazo/contracts";
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
const items = (count: number) => Array.from({ length: count }, (_, i) => file(`d${i + 1}`));
const ids = (list: DataRoomApiItem[]) => list.map((item) => item.id);

it("sends every picked file by reference to an agent that can open the Data room", () => {
  const picked = [file("a"), file("b"), file("c")];
  expect(planSendToAgent(bot({}), picked, [])).toEqual({ refs: picked, copies: [], skipped: [] });
  expect(planSendToAgent(bot({ spawnKey: "data-room-agent:u" }), picked, []).refs).toEqual(picked);
});

it("copies the files as attachments for agents without Data room tools", () => {
  const picked = [file("a"), file("b")];
  for (const over of [
    { spawnKey: "integration-agent:srv" },
    { spawnKey: "carta-agent:u" },
    { disabledBuiltinTools: ["read_data_room_item"] },
  ]) {
    expect(planSendToAgent(bot(over), picked, [])).toEqual({
      refs: [],
      copies: picked,
      skipped: [],
    });
  }
});

it("keeps the first four refs, in order, and reports the rest as skipped", () => {
  const plan = planSendToAgent(bot({}), items(6), []);
  expect(ids(plan.refs)).toEqual(["d1", "d2", "d3", "d4"]);
  expect(ids(plan.skipped)).toEqual(["d5", "d6"]);
  expect(plan.copies).toEqual([]);
  expect(plan.refs).toHaveLength(ATTACHMENT_MAX_COUNT);
});

it("counts what the composer already holds, so the cap is never exceeded", () => {
  const plan = planSendToAgent(bot({}), items(6).slice(3), ["d1", "d2", "d3"]);
  expect(ids(plan.refs)).toEqual(["d4"]);
  expect(ids(plan.skipped)).toEqual(["d5", "d6"]);
});

it("re-sending a held ref uses no slot", () => {
  const plan = planSendToAgent(bot({}), [file("d3")], ["d1", "d2", "d3", "d4"]);
  expect(ids(plan.refs)).toEqual(["d3"]);
  expect(plan.skipped).toEqual([]);
});

it("skips nothing on the copies path", () => {
  const plan = planSendToAgent(bot({ disabledBuiltinTools: ["read_data_room_item"] }), items(6), [
    "d1",
  ]);
  expect(ids(plan.copies)).toEqual(items(6).map((item) => item.id));
  expect(plan.skipped).toEqual([]);
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
