import type { Bot } from "@rakazo/contracts";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (s: TemplateStringsArray) => s[0] }),
}));
vi.mock("../../lib/rpc", () => ({ rpc: {} }));

import { agentsFor } from "./useIntegrations";

const bots = [{ id: "a" }, { id: "b" }, { id: "c" }] as Bot[];

it("lists exactly the agents the server says can use the connection", () => {
  // Stored grant says everyone; the server says only b (e.g. a is another connection's agent).
  const access = {
    allAgents: true,
    botIds: [],
    effectiveAccess: { shared: "some" as const, botIds: ["b"] },
  };
  expect(agentsFor(bots, access).map((bot) => bot.id)).toEqual(["b"]);
});

it("lists nobody without access data or when the server says none", () => {
  expect(agentsFor(bots, undefined)).toEqual([]);
  const none = {
    allAgents: false,
    botIds: [],
    effectiveAccess: { shared: "none" as const, botIds: [] },
  };
  expect(agentsFor(bots, none)).toEqual([]);
});
