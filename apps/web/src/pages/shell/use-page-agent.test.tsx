// @vitest-environment jsdom

import { act, createElement } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@lingui/core/macro", () => ({ t: (parts: TemplateStringsArray) => parts.join("") }));

import { pagePanelFor } from "./page-agent-panels";
import { usePageAgent } from "./use-page-agent";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Agent = ReturnType<typeof usePageAgent>;

function mount(initial: Parameters<typeof usePageAgent>[0]) {
  const current: { agent?: Agent } = {};
  let props = initial;
  const Probe = () => {
    current.agent = usePageAgent(props);
    return null;
  };
  const root = createRoot(document.createElement("div"));
  const render = () => act(() => root.render(createElement(Probe)));
  render();
  return {
    get agent() {
      return current.agent as Agent;
    },
    update(next: Partial<Parameters<typeof usePageAgent>[0]>) {
      props = { ...props, ...next };
      render();
    },
  };
}

const base = () => ({
  create: vi.fn(async () => undefined),
  errorLabel: "Could not create the Test agent",
  hasAgent: false,
  refreshBots: vi.fn(async () => undefined),
  onPage: true,
  scope: "u1:s1",
});

describe("usePageAgent", () => {
  it("Ask opens the panel and makes a missing agent once", async () => {
    const options = base();
    const view = mount(options);
    await act(async () => view.agent.ask());
    expect(view.agent.open).toBe(true);
    expect(options.create).toHaveBeenCalledTimes(1);
    expect(options.refreshBots).toHaveBeenCalledTimes(1);
  });

  it("Ask only opens when the agent exists, or when createOnAsk is off", async () => {
    const withAgent = { ...base(), hasAgent: true };
    const a = mount(withAgent);
    await act(async () => a.agent.ask());
    expect(a.agent.open).toBe(true);
    expect(withAgent.create).not.toHaveBeenCalled();
    const scanner = { ...base(), createOnAsk: false };
    const b = mount(scanner);
    await act(async () => b.agent.ask());
    expect(scanner.create).not.toHaveBeenCalled();
  });

  it("shows the failure and retries from create", async () => {
    const options = { ...base(), create: vi.fn().mockRejectedValueOnce(new Error("")) };
    const view = mount(options);
    await act(async () => void (await view.agent.create()));
    expect(view.agent.error).toBe("Could not create the Test agent");
    expect(view.agent.creating).toBe(false);
    await act(async () => void (await view.agent.create()));
    expect(view.agent.error).toBe("");
  });

  it("closes when the user leaves the page", async () => {
    const view = mount(base());
    await act(async () => view.agent.ask());
    view.update({ onPage: false });
    expect(view.agent.open).toBe(false);
  });

  it("drops a result that arrives after the space changed", async () => {
    let finish: () => void = () => undefined;
    const options = {
      ...base(),
      create: () => new Promise<undefined>((resolve) => (finish = () => resolve(undefined))),
    };
    const view = mount(options);
    act(() => void view.agent.create());
    view.update({ scope: "u1:s2" });
    await act(async () => finish());
    expect(options.refreshBots).not.toHaveBeenCalled();
    expect(view.agent.creating).toBe(true);
  });
});

describe("pagePanelFor", () => {
  const stub = (over: Partial<Agent> = {}): Agent => ({
    open: false,
    setOpen: vi.fn(),
    creating: false,
    error: "",
    create: vi.fn(async () => undefined),
    ask: vi.fn(),
    ...over,
  });
  const kinds = [
    "inbox",
    "finance",
    "scanner",
    "data-room",
    "devin",
    "legal",
    "gtm",
    "company",
    "company-importer",
    "investors",
  ] as const;
  const agents = Object.fromEntries(kinds.map((k) => [k, stub()])) as Record<
    (typeof kinds)[number],
    Agent
  >;
  const prefs = { open: true, collapse: vi.fn() };
  const input = { agents, inbox: prefs, investors: prefs };

  it("has no panel off the agent pages", () => {
    expect(pagePanelFor({ ...input, kind: null })).toBeNull();
  });

  it("names every panel and test id as the e2e specs expect", () => {
    const ids = kinds.map((kind) => {
      const panel = pagePanelFor({ ...input, kind });
      return [panel?.name, panel?.testId, panel?.collapseLabel];
    });
    expect(ids).toEqual([
      ["inbox-agent", "inbox-agent-panel", "Collapse Inbox agent"],
      ["finance-agent", "finance-agent-panel", "Collapse Finance agent"],
      ["scanner-agent", "scanner-agent-panel", "Collapse Scanner agent"],
      ["data-room-agent", "data-room-agent-panel", "Collapse Data room agent"],
      ["devin-agent", "devin-agent-panel", "Collapse Devin agent"],
      ["legal-agent", "legal-agent-panel", "Collapse Legal agent"],
      ["gtm-agent", "gtm-agent-panel", "Collapse GTM agent"],
      ["company-agent", "company-agent-panel", "Collapse Company agent"],
      ["company-importer", "company-importer-panel", "Collapse Company importer"],
      ["investors-agent", "investors-agent-panel", "Collapse Investors agent"],
    ]);
  });

  it("opens Inbox and Investors from their saved preference, the rest from the agent", () => {
    expect(pagePanelFor({ ...input, kind: "inbox" })?.open).toBe(true);
    expect(pagePanelFor({ ...input, kind: "investors" })?.open).toBe(true);
    expect(pagePanelFor({ ...input, kind: "finance" })?.open).toBe(false);
    const open = { ...agents, finance: stub({ open: true }) };
    expect(pagePanelFor({ ...input, agents: open, kind: "finance" })?.open).toBe(true);
  });

  it("collapses a hook-owned panel by closing it", () => {
    pagePanelFor({ ...input, kind: "finance" })?.collapse();
    expect(agents.finance.setOpen).toHaveBeenCalledWith(false);
  });

  it("offers Investors Create only to retry a failure", () => {
    expect(pagePanelFor({ ...input, kind: "investors" })?.create).toBeUndefined();
    const failed = { ...agents, investors: stub({ error: "nope" }) };
    const panel = pagePanelFor({ ...input, agents: failed, kind: "investors" });
    expect(panel?.create).toBeDefined();
    expect(panel?.createLabel).toBe("Try again");
  });

  it("gives Legal no suggestions and Inbox an empty list", () => {
    expect(pagePanelFor({ ...input, kind: "legal" })?.suggestions).toBeUndefined();
    expect(pagePanelFor({ ...input, kind: "inbox" })?.suggestions).toEqual([]);
  });
});
