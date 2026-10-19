import type { Bot } from "@rakazo/contracts";
import { expect, it, vi } from "vitest";
import { agentsFor, withoutOtherIntegrationAgents } from "./useIntegrations";

vi.mock("@lingui/react/macro", () => ({ useLingui: () => ({ t: String }) }));
vi.mock("../../lib/rpc", () => ({ rpc: {} }));

const bot = (id: string, spawnKey: string | null) => ({ id, spawnKey }) as Bot;
const bots = [
  bot("chief", null),
  bot("mine", "integration-agent:s1"),
  bot("other", "integration-agent:s2"),
  bot("carta", "carta-agent:u1"),
];

it("leaves another connection's integration agent out of the list", () => {
  expect(withoutOtherIntegrationAgents(bots, "mine").map((b) => b.id)).toEqual(["chief", "mine"]);
  expect(withoutOtherIntegrationAgents(bots).map((b) => b.id)).toEqual(["chief"]);
});

it("does not show a foreign integration agent as using an account shared with all agents", () => {
  const shared = { allAgents: true, botIds: [] };
  expect(agentsFor(bots, shared, "mine").map((b) => b.id)).toEqual(["chief", "mine"]);
});
