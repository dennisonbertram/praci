import type { Bot } from "@rakazo/contracts";
import { expect, it } from "vitest";
import { resolveRouteBot } from "./route-bot";

const bot = (id: string) => ({ id }) as Bot;
const chief = bot("chief");
const input = { bots: [chief], botId: "new", loaded: true, seen: null, applied: 5 };

it("waits and asks for a refresh when the route bot is unknown", () => {
  expect(resolveRouteBot(input)).toEqual({ bot: undefined, waiting: true, needsRefresh: true });
});

it("shows the bot once a refresh brings it in", () => {
  const added = { ...input, bots: [chief, bot("new")], seen: { id: "new", epoch: 5 }, applied: 6 };
  expect(resolveRouteBot(added)).toMatchObject({ bot: { id: "new" }, waiting: false });
});

it("falls back to the first bot when a refresh that started after the id was seen still lacks it", () => {
  const seen = { id: "new", epoch: 5 };
  expect(resolveRouteBot({ ...input, seen, applied: 6 })).toEqual({
    bot: chief,
    waiting: false,
    needsRefresh: false,
  });
});

it("keeps waiting, without refreshing again, when only a refresh that started earlier applied", () => {
  const seen = { id: "new", epoch: 5 };
  expect(resolveRouteBot({ ...input, seen, applied: 5 })).toEqual({
    bot: undefined,
    waiting: true,
    needsRefresh: false,
  });
});
