// @vitest-environment jsdom

import type { Bot } from "@rakazo/contracts";
import { mailThreadAgentSpawnKey } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { beforeEach, expect, it, vi } from "vitest";

const rpc = vi.hoisted(() => ({
  connections: {
    list: vi.fn(),
    effectiveAccess: vi.fn(),
    accessAll: vi.fn(),
    setAgentAccess: vi.fn(),
  },
  capabilities: { list: vi.fn(), setAgentAccess: vi.fn() },
  bots: { update: vi.fn() },
  mcp: {
    servers: { list: vi.fn(), setAgentAssignment: vi.fn() },
    assignments: { list: vi.fn() },
  },
}));
vi.mock("../../lib/rpc", () => ({ rpc }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { BotAccessSection } from "./BotAccessSection";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia ??= () =>
  ({
    matches: false,
    addEventListener() {},
    removeEventListener() {},
  }) as unknown as MediaQueryList;

const bot = (id: string, name: string, spawnKey: string | null = null) =>
  ({ id, name, color: "#000", spawnKey, archivedAt: null }) as unknown as Bot;
const conn = (id: string, name: string, account: string, agentBotId: string | null = null) => ({
  id,
  provider: name.toLowerCase(),
  displayName: name,
  account,
  status: "connected",
  agentBotId,
});

const ada = bot("ada", "Ada");

beforeEach(() => {
  vi.clearAllMocks();
  rpc.capabilities.list.mockResolvedValue([]);
  rpc.capabilities.setAgentAccess.mockResolvedValue({});
  rpc.mcp.servers.list.mockResolvedValue([]);
  rpc.mcp.assignments.list.mockResolvedValue([]);
  rpc.connections.accessAll.mockImplementation(async () =>
    Object.fromEntries(
      (await rpc.connections.list()).map((row: { id: string }) => [
        row.id,
        { allAgents: false, botIds: ["bea"], agentShared: true },
      ]),
    ),
  );
  rpc.connections.setAgentAccess.mockResolvedValue({});
  rpc.mcp.servers.setAgentAssignment.mockResolvedValue({ ok: true });
});

async function mount(agent: Bot) {
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () => createRoot(container).render(<BotAccessSection bot={agent} />));
  await act(async () => undefined);
  const sw = (label: string) =>
    container.querySelector<HTMLElement>(`[aria-label^="${label}"]`) as HTMLElement;
  return { container, sw };
}

it("lists the accounts the agent can reach with address and the real state", async () => {
  rpc.connections.list.mockResolvedValue([
    conn("c1", "Gmail", "ann@example.com"),
    conn("c2", "Gmail", "bob@example.com"),
  ]);
  rpc.connections.effectiveAccess.mockResolvedValue({
    c1: { shared: "some", botIds: ["ada"] },
    c2: { shared: "some", botIds: ["bea"] },
  });
  rpc.connections.accessAll.mockResolvedValue({
    c1: { allAgents: false, botIds: ["ada"], agentShared: true, writeBotIds: [] },
    c2: { allAgents: false, botIds: ["bea"], agentShared: true, writeBotIds: [] },
  });
  const { container, sw } = await mount(ada);
  expect(container.textContent).toContain("ann@example.com");
  expect(container.textContent).toContain("bob@example.com");
  expect(sw("Ada can use Gmail ann@example.com").getAttribute("aria-checked")).toBe("true");
  expect(sw("Ada can use Gmail bob@example.com").getAttribute("aria-checked")).toBe("false");
});

it("a toggle changes only this agent through the single-agent endpoint", async () => {
  rpc.connections.list.mockResolvedValue([conn("c2", "Gmail", "bob@example.com")]);
  rpc.connections.effectiveAccess.mockResolvedValue({ c2: { shared: "some", botIds: ["bea"] } });
  const { sw } = await mount(ada);
  await act(async () => sw("Ada can use Gmail bob@example.com").click());
  expect(rpc.connections.setAgentAccess).toHaveBeenCalledWith({
    connectionId: "c2",
    botId: "ada",
    on: true,
  });
});

it("an agent's own connection is on and locked; a private one cannot be turned on", async () => {
  rpc.connections.list.mockResolvedValue([
    conn("c1", "Mercury", "", "ada"),
    conn("c2", "Brex", "", "bea"),
  ]);
  rpc.connections.effectiveAccess.mockResolvedValue({
    c1: { shared: "some", botIds: ["ada"] },
    c2: { shared: "some", botIds: ["bea"] },
  });
  rpc.connections.accessAll.mockResolvedValue({
    c1: { allAgents: true, botIds: [], agentShared: false },
    c2: { allAgents: true, botIds: [], agentShared: false },
  });
  const { sw } = await mount(ada);
  const own = sw("Ada can use Mercury");
  expect(own.getAttribute("aria-checked")).toBe("true");
  expect(own.hasAttribute("data-disabled") || own.getAttribute("aria-disabled") === "true").toBe(
    true,
  );
  const other = sw("Ada can use Brex");
  expect(
    other.hasAttribute("data-disabled") || other.getAttribute("aria-disabled") === "true",
  ).toBe(true);
});

it("an email chat shows the Inbox agent's mail account on and locked", async () => {
  const chat = bot("chat", "Re: hi", mailThreadAgentSpawnKey("c1", "t1"));
  rpc.connections.list.mockResolvedValue([conn("c1", "Gmail", "ann@example.com", "inbox")]);
  rpc.connections.effectiveAccess.mockResolvedValue({ c1: { shared: "some", botIds: ["chat"] } });
  const { sw } = await mount(chat);
  const row = sw("Re: hi can use Gmail");
  expect(row.getAttribute("aria-checked")).toBe("true");
  expect(row.hasAttribute("data-disabled") || row.getAttribute("aria-disabled") === "true").toBe(
    true,
  );
});

it("a server toggle assigns it to this agent only", async () => {
  rpc.connections.list.mockResolvedValue([]);
  rpc.connections.effectiveAccess.mockResolvedValue({});
  rpc.mcp.servers.list.mockResolvedValue([
    { id: "s1", name: "Docs", enabled: true, agentBotId: null, agentExclusive: false },
  ]);
  const { sw } = await mount(ada);
  await act(async () => sw("Ada can use Docs").click());
  expect(rpc.mcp.servers.setAgentAssignment).toHaveBeenCalledWith({
    serverId: "s1",
    botId: "ada",
    on: true,
  });
});

it("links the agent's own server to its page, where sharing is decided", async () => {
  rpc.connections.list.mockResolvedValue([]);
  rpc.connections.effectiveAccess.mockResolvedValue({});
  rpc.mcp.servers.list.mockResolvedValue([
    { id: "s1", name: "Docs", enabled: true, agentBotId: "ada", agentExclusive: true },
    { id: "s2", name: "Other", enabled: true, agentBotId: null, agentExclusive: false },
  ]);
  await mount(ada);
  const links = [...document.querySelectorAll("[data-testid=bot-access] a")];
  expect(links.map((a) => a.getAttribute("href"))).toEqual(["/app/integrations/mcp/s1"]);
});

it("an exclusive server shows other agents as off and locked even with a saved assignment", async () => {
  rpc.connections.list.mockResolvedValue([]);
  rpc.connections.effectiveAccess.mockResolvedValue({});
  rpc.mcp.servers.list.mockResolvedValue([
    { id: "s1", name: "Docs", enabled: true, agentBotId: "bea", agentExclusive: true },
  ]);
  rpc.mcp.assignments.list.mockResolvedValue([{ serverId: "s1" }]);
  const { sw } = await mount(ada);
  const row = sw("Ada can use Docs");
  expect(row.getAttribute("aria-checked")).toBe("false");
  expect(row.hasAttribute("data-disabled") || row.getAttribute("aria-disabled") === "true").toBe(
    true,
  );
});

it("an email chat's accounts are all locked, following the Inbox agent", async () => {
  const chat = bot("chat", "Re: hi", mailThreadAgentSpawnKey("c1", "t1"));
  rpc.connections.list.mockResolvedValue([conn("c9", "Slack", "", null)]);
  rpc.connections.effectiveAccess.mockResolvedValue({ c9: { shared: "some", botIds: [] } });
  const { sw } = await mount(chat);
  const row = sw("Re: hi can use Slack");
  expect(row.hasAttribute("data-disabled") || row.getAttribute("aria-disabled") === "true").toBe(
    true,
  );
});

it("reloads when the agent's audience changes", async () => {
  rpc.connections.list.mockResolvedValue([conn("c1", "Gmail", "ann@example.com")]);
  rpc.connections.effectiveAccess.mockResolvedValue({ c1: { shared: "some", botIds: [] } });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<BotAccessSection bot={ada} />));
  await act(async () => undefined);
  const before = rpc.connections.effectiveAccess.mock.calls.length;
  await act(async () => root.render(<BotAccessSection bot={{ ...ada, audience: "external" }} />));
  await act(async () => undefined);
  expect(rpc.connections.effectiveAccess.mock.calls.length).toBeGreaterThan(before);
});

it("a failed load shows an error with Retry instead of nothing", async () => {
  rpc.connections.list.mockRejectedValueOnce(new Error("down"));
  rpc.connections.effectiveAccess.mockResolvedValue({});
  const { container } = await mount(ada);
  expect(container.textContent).toContain("Could not load access");
  rpc.connections.list.mockResolvedValue([conn("c1", "Gmail", "ann@example.com")]);
  rpc.connections.effectiveAccess.mockResolvedValue({ c1: { shared: "some", botIds: [] } });
  await act(async () =>
    [...container.querySelectorAll("button")].find((b) => b.textContent === "Retry")?.click(),
  );
  expect(container.textContent).toContain("ann@example.com");
});

it("says the list could not be refreshed when a change saved but the reload failed", async () => {
  rpc.connections.list.mockResolvedValueOnce([conn("c1", "Gmail", "ann@example.com")]);
  rpc.connections.effectiveAccess.mockResolvedValue({ c1: { shared: "some", botIds: [] } });
  const { container, sw } = await mount(ada);
  rpc.connections.list.mockRejectedValue(new Error("down"));
  await act(async () => sw("Ada can use Gmail ann@example.com").click());
  expect(container.textContent).toContain("could not be refreshed");
  expect(container.textContent).toContain("ann@example.com");
});

it("shows search only above 8 rows and renders nothing with no accounts", async () => {
  rpc.connections.list.mockResolvedValue([]);
  rpc.connections.effectiveAccess.mockResolvedValue({});
  const empty = await mount(ada);
  expect(empty.container.textContent).toBe("");
  rpc.connections.effectiveAccess.mockResolvedValue({});

  rpc.connections.list.mockResolvedValue(
    Array.from({ length: 9 }, (_, i) => conn(`c${i}`, `App${i}`, `u${i}@example.com`)),
  );
  const nine = await mount(ada);
  expect(nine.container.querySelector('input[type="search"]')).not.toBeNull();
});

it("shows Allow changes under an agent-linked account that is on, and sets only this agent's grant", async () => {
  rpc.connections.list.mockResolvedValue([
    { ...conn("c1", "Gmail", "ann@example.com", "inbox"), writesEnabled: true },
  ]);
  rpc.connections.effectiveAccess.mockResolvedValue({ c1: { shared: "some", botIds: ["ada"] } });
  rpc.connections.accessAll.mockResolvedValue({
    c1: { allAgents: false, botIds: ["inbox", "ada"], agentShared: true, writeBotIds: [] },
  });
  const { sw } = await mount(ada);
  const nested = sw("Ada can make changes in Gmail ann@example.com");
  expect(nested.getAttribute("aria-checked")).toBe("false");
  await act(async () => nested.click());
  expect(rpc.connections.setAgentAccess).toHaveBeenCalledWith({
    connectionId: "c1",
    botId: "ada",
    on: true,
    canWrite: true,
  });
});

it("Allow changes is disabled while the connection's changes switch is off, and absent on plain accounts and email chats", async () => {
  rpc.connections.list.mockResolvedValue([
    { ...conn("c1", "Gmail", "ann@example.com", "inbox"), writesEnabled: false },
    conn("c2", "Slack", "", null),
  ]);
  rpc.connections.effectiveAccess.mockResolvedValue({
    c1: { shared: "some", botIds: ["ada"] },
    c2: { shared: "some", botIds: ["ada"] },
  });
  rpc.connections.accessAll.mockResolvedValue({
    c1: { allAgents: false, botIds: ["ada"], agentShared: true, writeBotIds: [] },
    c2: { allAgents: true, botIds: [], agentShared: true, writeBotIds: [] },
  });
  const { sw } = await mount(ada);
  const nested = sw("Ada can make changes in Gmail ann@example.com");
  expect(
    nested.hasAttribute("data-disabled") || nested.getAttribute("aria-disabled") === "true",
  ).toBe(true);
  expect(sw("Ada can make changes in Slack")).toBeNull();

  const chat = bot("chat", "Re: hi", mailThreadAgentSpawnKey("c1", "t1"));
  rpc.connections.effectiveAccess.mockResolvedValue({ c1: { shared: "some", botIds: ["chat"] } });
  const mail = await mount(chat);
  expect(mail.sw("Re: hi can make changes in Gmail ann@example.com")).toBeNull();
});

it("shows a saved grant as on, revocable, with a note, when another account limits access", async () => {
  rpc.connections.list.mockResolvedValue([
    { ...conn("c1", "Gmail", "ann@example.com", "inbox"), writesEnabled: true },
  ]);
  // Saved for Ada, but not in effect: another Gmail account is limited to other agents.
  rpc.connections.effectiveAccess.mockResolvedValue({ c1: { shared: "some", botIds: [] } });
  rpc.connections.accessAll.mockResolvedValue({
    c1: { allAgents: false, botIds: ["inbox", "ada"], agentShared: true, writeBotIds: [] },
  });
  const { container, sw } = await mount(ada);
  const use = sw("Ada can use Gmail ann@example.com");
  expect(use.getAttribute("aria-checked")).toBe("true");
  expect(use.hasAttribute("data-disabled")).toBe(false);
  expect(container.textContent).toContain("another account of this app limits access");
  expect(sw("Ada can make changes in Gmail ann@example.com")).not.toBeNull();
  await act(async () => use.click());
  expect(rpc.connections.setAgentAccess).toHaveBeenCalledWith({
    connectionId: "c1",
    botId: "ada",
    on: false,
  });
});

it("does not count 'all agents' as a grant for a firewalled agent", async () => {
  rpc.connections.list.mockResolvedValue([conn("c1", "Gmail", "ann@example.com", "inbox")]);
  rpc.connections.effectiveAccess.mockResolvedValue({ c1: { shared: "all", botIds: [] } });
  rpc.connections.accessAll.mockResolvedValue({
    c1: { allAgents: true, botIds: [], agentShared: true, writeBotIds: [] },
  });
  const { sw } = await mount({ ...ada, firewall: true } as Bot);
  expect(sw("Ada can use Gmail ann@example.com").getAttribute("aria-checked")).toBe("false");
});

const source = (patch: Record<string, unknown> = {}) => ({
  id: "src1",
  kind: "api",
  name: "Contacts API",
  agentBotId: "owner",
  writesEnabled: true,
  usableBotIds: ["owner"],
  writeBotIds: [],
  ...patch,
});

it("lists a directly connected source and grants only this agent through the source endpoint", async () => {
  rpc.connections.list.mockResolvedValue([]);
  rpc.connections.effectiveAccess.mockResolvedValue({});
  rpc.connections.accessAll.mockResolvedValue({});
  rpc.capabilities.list.mockResolvedValue([
    source(),
    { id: "skill1", kind: "skill", name: "Notes" },
  ]);
  const { container, sw } = await mount(ada);
  expect(container.textContent).toContain("Contacts API");
  expect(container.textContent).not.toContain("Notes");
  expect(sw("Ada can use Contacts API").getAttribute("aria-checked")).toBe("false");
  await act(async () => sw("Ada can use Contacts API").click());
  expect(rpc.capabilities.setAgentAccess).toHaveBeenCalledWith({
    id: "src1",
    botId: "ada",
    on: true,
  });
});

it("shows Allow changes for a granted source and keeps a firewalled agent off it", async () => {
  rpc.connections.list.mockResolvedValue([]);
  rpc.connections.effectiveAccess.mockResolvedValue({});
  rpc.connections.accessAll.mockResolvedValue({});
  rpc.capabilities.list.mockResolvedValue([source({ usableBotIds: ["owner", "ada"] })]);
  const granted = await mount(ada);
  await act(async () => granted.sw("Ada can make changes in Contacts API").click());
  expect(rpc.capabilities.setAgentAccess).toHaveBeenCalledWith({
    id: "src1",
    botId: "ada",
    on: true,
    canWrite: true,
  });
  const walled = await mount({ ...ada, firewall: true } as Bot);
  expect(walled.sw("Ada can use Contacts API").getAttribute("aria-disabled")).toBe("true");
});

it("lists what the owner let a Firewall agent ask for, and removes one with its switch", async () => {
  rpc.connections.list.mockResolvedValue([]);
  rpc.connections.effectiveAccess.mockResolvedValue({});
  rpc.connections.accessAll.mockResolvedValue({});
  rpc.capabilities.list.mockResolvedValue([]);
  const { container, sw } = await mount({
    ...ada,
    firewall: true,
    firewallAskCapabilities: ["contacts", "calendar_read"],
  } as Bot);
  expect(container.textContent).toContain("Contacts");
  await act(async () => sw("Ada can ask to use Contacts").click());
  expect(rpc.bots.update).toHaveBeenCalledWith({
    botId: "ada",
    firewallAskCapabilities: ["calendar_read"],
  });
  expect(container.textContent).not.toContain("Contacts");
});

it("shows a label on a granted mail row of a firewalled agent, and saves it on blur", async () => {
  rpc.connections.list.mockResolvedValue([conn("c1", "Gmail", "support@example.com")]);
  rpc.connections.effectiveAccess.mockResolvedValue({
    c1: { shared: "some", botIds: ["ada"] },
  });
  rpc.connections.accessAll.mockResolvedValue({
    c1: {
      allAgents: false,
      botIds: ["ada"],
      agentShared: true,
      writeBotIds: [],
      supportLabels: {},
    },
  });
  const firewalled = { ...ada, firewall: true } as unknown as Bot;
  const { container } = await mount(firewalled);
  const label = container.querySelector<HTMLInputElement>('input[aria-label="Label"]');
  expect(label?.placeholder).toBe("All mail");
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
      label,
      "Support",
    );
    label?.dispatchEvent(new Event("input", { bubbles: true }));
    label?.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(rpc.connections.setAgentAccess).toHaveBeenCalledWith({
    connectionId: "c1",
    botId: "ada",
    on: true,
    supportLabel: "Support",
  });
});

it("shows the label as soon as the agent becomes firewalled, without a remount", async () => {
  rpc.connections.list.mockResolvedValue([conn("c1", "Gmail", "support@example.com")]);
  rpc.connections.effectiveAccess.mockResolvedValue({
    c1: { shared: "some", botIds: ["ada"] },
  });
  rpc.connections.accessAll.mockResolvedValue({
    c1: {
      allAgents: false,
      botIds: ["ada"],
      agentShared: true,
      writeBotIds: [],
      supportLabels: {},
    },
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<BotAccessSection bot={ada} />));
  await act(async () => undefined);
  expect(container.querySelector('input[aria-label="Label"]')).toBeNull();
  await act(async () =>
    root.render(<BotAccessSection bot={{ ...ada, firewall: true } as unknown as Bot} />),
  );
  await act(async () => undefined);
  expect(container.querySelector('input[aria-label="Label"]')).not.toBeNull();
});

it("shows no label for an agent without the firewall", async () => {
  rpc.connections.list.mockResolvedValue([conn("c1", "Gmail", "support@example.com")]);
  rpc.connections.effectiveAccess.mockResolvedValue({
    c1: { shared: "some", botIds: ["ada"] },
  });
  rpc.connections.accessAll.mockResolvedValue({
    c1: {
      allAgents: false,
      botIds: ["ada"],
      agentShared: true,
      writeBotIds: [],
      supportLabels: {},
    },
  });
  const { container } = await mount(ada);
  expect(container.querySelector('input[aria-label="Label"]')).toBeNull();
});

const describedBy = (container: HTMLElement, sw: HTMLElement) => {
  const id = sw.getAttribute("aria-describedby");
  return id ? container.querySelector<HTMLElement>(`[id="${id}"]`) : null;
};

it("says 'Belongs to this agent' on the agent's own connection, server and source", async () => {
  rpc.connections.list.mockResolvedValue([conn("c1", "Mercury", "", "ada")]);
  rpc.connections.effectiveAccess.mockResolvedValue({
    c1: { shared: "some", botIds: ["ada"] },
  });
  rpc.mcp.servers.list.mockResolvedValue([
    { id: "s1", name: "Docs", enabled: true, agentBotId: "ada", agentExclusive: true },
  ]);
  rpc.capabilities.list.mockResolvedValue([source({ agentBotId: "ada", usableBotIds: ["ada"] })]);
  const { container, sw } = await mount(ada);
  for (const label of ["Ada can use Mercury", "Ada can use Docs", "Ada can use Contacts API"]) {
    const row = sw(label);
    expect(row.hasAttribute("data-disabled") || row.getAttribute("aria-disabled") === "true").toBe(
      true,
    );
    expect(describedBy(container, row)?.textContent).toBe("Belongs to this agent");
  }
});

it("says 'Only its own agent can use this' on a private connection and an exclusive server", async () => {
  rpc.connections.list.mockResolvedValue([conn("c2", "Brex", "", "bea")]);
  rpc.connections.effectiveAccess.mockResolvedValue({
    c2: { shared: "some", botIds: ["bea"] },
  });
  rpc.connections.accessAll.mockResolvedValue({
    c2: { allAgents: true, botIds: [], agentShared: false },
  });
  rpc.mcp.servers.list.mockResolvedValue([
    { id: "s1", name: "Docs", enabled: true, agentBotId: "bea", agentExclusive: true },
  ]);
  const { container, sw } = await mount(ada);
  for (const label of ["Ada can use Brex", "Ada can use Docs"]) {
    expect(describedBy(container, sw(label))?.textContent).toBe("Only its own agent can use this");
  }
});

it("says 'Not used by firewalled or external agents' on a locked source", async () => {
  rpc.connections.list.mockResolvedValue([]);
  rpc.connections.effectiveAccess.mockResolvedValue({});
  rpc.connections.accessAll.mockResolvedValue({});
  rpc.capabilities.list.mockResolvedValue([source()]);
  const { container, sw } = await mount({ ...ada, firewall: true } as Bot);
  expect(describedBy(container, sw("Ada can use Contacts API"))?.textContent).toBe(
    "Not used by firewalled or external agents",
  );
});

it("an email chat shows one 'Accounts follow the Inbox agent' line and no per-row reason", async () => {
  const chat = bot("chat", "Re: hi", mailThreadAgentSpawnKey("c1", "t1"));
  rpc.connections.list.mockResolvedValue([
    conn("c1", "Gmail", "ann@example.com", "inbox"),
    conn("c2", "Slack", "", null),
  ]);
  rpc.connections.effectiveAccess.mockResolvedValue({
    c1: { shared: "some", botIds: ["chat"] },
    c2: { shared: "some", botIds: ["chat"] },
  });
  const { container, sw } = await mount(chat);
  expect((container.textContent?.match(/Accounts follow the Inbox agent/g) ?? []).length).toBe(1);
  expect(container.textContent).not.toContain("Belongs to this agent");
  expect(container.textContent).not.toContain("Only its own agent can use this");
  for (const label of ["Re: hi can use Gmail ann@example.com", "Re: hi can use Slack"]) {
    expect(describedBy(container, sw(label))?.textContent).toBe("Accounts follow the Inbox agent");
  }
});

it("an unlocked row shows no reason and no described-by", async () => {
  rpc.connections.list.mockResolvedValue([conn("c2", "Gmail", "bob@example.com")]);
  rpc.connections.effectiveAccess.mockResolvedValue({
    c2: { shared: "some", botIds: ["bea"] },
  });
  const { container, sw } = await mount(ada);
  const row = sw("Ada can use Gmail bob@example.com");
  expect(row.getAttribute("aria-describedby")).toBeNull();
  expect(container.textContent).not.toContain("Belongs to this agent");
  expect(container.textContent).not.toContain("Only its own agent can use this");
});
