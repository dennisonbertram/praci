import { describe, expect, it } from "vitest";
import { toggleAgentAccess } from "./router.js";

const bot = (id: string, extra: Partial<{ audience: string; firewall: boolean }> = {}) => ({
  id,
  audience: "internal",
  firewall: false,
  ...extra,
});
const conn = (allAgents: boolean, ids: string[] = [], agentBotId: string | null = null) => ({
  allAgents,
  agentBotId,
  botAccess: ids.map((botId) => ({ botId })),
});

describe("toggleAgentAccess", () => {
  const bots = [bot("a"), bot("b"), bot("c")];

  it("turning one off under all agents lists exactly the others", () => {
    const next = toggleAgentAccess(conn(true), bots, "b", false);
    expect(next.allAgents).toBe(false);
    expect([...next.botIds].sort()).toEqual(["a", "c"]);
  });

  it("does not grant a firewalled or external agent when leaving all agents", () => {
    const withRestricted = [
      ...bots,
      bot("fw", { firewall: true }),
      bot("ext", { audience: "external" }),
    ];
    const next = toggleAgentAccess(conn(true), withRestricted, "b", false);
    expect(next.allAgents).toBe(false);
    expect([...next.botIds].sort()).toEqual(["a", "c"]);
  });

  it("turning a firewalled agent on adds an explicit grant even under all agents", () => {
    const withFw = [...bots, bot("fw", { firewall: true })];
    const next = toggleAgentAccess(conn(true), withFw, "fw", true);
    expect(next).toMatchObject({ allAgents: true, botIds: ["fw"] });
  });

  it("turning a firewalled agent off removes only its grant", () => {
    const withFw = [...bots, bot("fw", { firewall: true })];
    const next = toggleAgentAccess(conn(true, ["fw"]), withFw, "fw", false);
    expect(next).toMatchObject({ allAgents: true, botIds: [] });
  });

  it("the connection's own agent cannot be turned off", () => {
    const next = toggleAgentAccess(conn(false, ["a", "b"], "a"), bots, "a", false);
    expect([...next.botIds].sort()).toEqual(["a", "b"]);
  });

  it("an unknown agent is refused", () => {
    expect(() => toggleAgentAccess(conn(false), bots, "zzz", true)).toThrow();
  });

  describe("allow changes", () => {
    const owned = (ids: { botId: string; canWrite?: boolean }[], allAgents = false) => ({
      allAgents,
      agentBotId: "o",
      botAccess: [{ botId: "o" }, ...ids],
    });
    const all = [bot("o"), ...bots];

    it("a newly turned on agent starts read-only", () => {
      expect(toggleAgentAccess(owned([]), all, "a", true).canWrite).toEqual({ a: false });
    });
    it("turning it on with canWrite sets it, and turning it on again keeps it", () => {
      expect(toggleAgentAccess(owned([]), all, "a", true, true).canWrite).toEqual({ a: true });
      expect(
        toggleAgentAccess(owned([{ botId: "a", canWrite: true }]), all, "a", true).canWrite,
      ).toEqual({ a: true });
    });
    it("turning an agent off clears it", () => {
      expect(
        toggleAgentAccess(owned([{ botId: "a", canWrite: true }]), all, "a", false).canWrite,
      ).toEqual({ a: false });
    });
    it("the owner has no setting of its own", () => {
      expect(toggleAgentAccess(owned([]), all, "o", true, true).canWrite).toBeUndefined();
    });
    it("refuses changes for an external agent or a connection without an agent", () => {
      const ext = [...all, bot("ext", { audience: "external" })];
      expect(() => toggleAgentAccess(owned([]), ext, "ext", true, true)).toThrow();
      expect(() =>
        toggleAgentAccess(
          { allAgents: false, agentBotId: null, botAccess: [] },
          all,
          "a",
          true,
          true,
        ),
      ).toThrow();
    });
  });
});
