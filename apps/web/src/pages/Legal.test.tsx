// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const text = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + String(values[i] ?? ""), ""),
);
vi.mock("@lingui/core/macro", () => ({
  t: text,
  plural: (n: number, forms: { one: string; other: string }) =>
    (n === 1 ? forms.one : forms.other).replace("#", String(n)),
}));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({
  overview: vi.fn(),
  graph: vi.fn(),
  updateDeadline: vi.fn(),
  scanNow: vi.fn(),
  consent: vi.fn(),
  consentGrant: vi.fn(),
}));
vi.mock("../lib/rpc", () => ({ rpc: { legal: rpcMock } }));

import { LegalGraphView, labelLines, MAX_GRAPH_NODES } from "../components/legal/LegalGraph";
import { setHideAmounts } from "../lib/hide-amounts-preference";
import { LegalPage } from "./Legal";
import {
  consentFixture,
  contracts,
  deadlines,
  emptyOverview,
  graph,
  id,
  needsKeyOverview,
  overview,
} from "./legal/fixtures";
import { LegalContracts } from "./legal/LegalContracts";
import { LegalDeadlines } from "./legal/LegalDeadlines";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = () => act(async () => {});
const render = async (node: ReactNode) => {
  await act(async () => root.render(<MemoryRouter>{node}</MemoryRouter>));
  await flush();
};
const click = (el: Element | null | undefined) =>
  act(async () => void el?.dispatchEvent(new MouseEvent("click", { bubbles: true })));
const button = (name: string) =>
  [...container.querySelectorAll("button")].find(
    (b) => b.textContent === name || b.getAttribute("aria-label") === name,
  );
const tab = (name: string) =>
  [...container.querySelectorAll('[role="tab"]')].find((b) => b.textContent === name);

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  rpcMock.consent.mockResolvedValue(consentFixture);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
});

it("shows counts and contracts, with the value formatted from the decimal string", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  await render(<LegalPage />);
  const page = container.textContent ?? "";
  expect(page).toContain("Master Services Agreement");
  expect(page).toContain("$50,000");
  expect(page).toContain("Auto-renews, 60 days notice");
  // A Term range shows the year on both ends, whatever year it is now.
  expect(page).toContain("Mar 1, 2023 – Feb 28, 2026");
  expect(page).toContain("3 Data room documents not yet checked by Legal");
  expect(container.querySelector(`a[href="/app/data-room?item=${id(101)}"]`)).not.toBeNull();
  expect(button("Allow")).toBeUndefined();
});

it("shows the empty state, loading skeleton and load error", async () => {
  rpcMock.overview.mockResolvedValue(emptyOverview);
  await render(<LegalPage />);
  expect(container.textContent).toContain("Press Scan now to read your Data room");
  expect(container.textContent).toContain("Not scanned yet");

  rpcMock.overview.mockReturnValue(new Promise(() => {}));
  await act(async () => root.unmount());
  root = createRoot(container);
  await render(<LegalPage />);
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();

  rpcMock.overview.mockRejectedValue(new Error("boom"));
  await act(async () => root.unmount());
  root = createRoot(container);
  await render(<LegalPage />);
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});

it("asks for consent when it is not allowed, and grants the shown key", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  rpcMock.consent.mockResolvedValue({ ...consentFixture, allowed: false });
  rpcMock.consentGrant.mockResolvedValue(consentFixture);
  await render(<LegalPage />);
  expect(container.textContent).toContain("Let the Legal agent read your documents");
  // Settings shows the space's model, so the card names the one that reads the documents.
  expect(container.textContent).toContain("its own model, Muse Spark 1.2");
  expect(button("Scan now")?.hasAttribute("disabled")).toBe(true);
  await click(button("Allow"));
  expect(rpcMock.consentGrant).toHaveBeenCalledWith({ key: "k1", version: "v1" });
  expect(container.textContent).not.toContain("Let the Legal agent read your documents");
});

it("refetches the prompt when the consent key is stale", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  rpcMock.consent
    .mockResolvedValueOnce({ ...consentFixture, allowed: false })
    .mockResolvedValue({ ...consentFixture, allowed: false, key: "k2", disclosure: "New model." });
  rpcMock.consentGrant.mockRejectedValue(Object.assign(new Error("stale"), { code: "CONFLICT" }));
  await render(<LegalPage />);
  await click(button("Allow"));
  expect(container.textContent).toContain("New model.");
});

it("scans now without opening the agent panel", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  rpcMock.scanNow.mockResolvedValue({ runId: id(1), botId: id(2) });
  const ask = vi.fn();
  await render(<LegalPage onAskAgent={ask} />);
  await click(button("Scan now"));
  expect(rpcMock.scanNow).toHaveBeenCalledTimes(1);
  // The founder asked for a scan, not a chat; the page shows its progress.
  expect(ask).not.toHaveBeenCalled();
});

it("marks overdue deadlines and closes one with Done", async () => {
  const onChanged = vi.fn();
  rpcMock.updateDeadline.mockResolvedValue({});
  await render(<LegalDeadlines deadlines={deadlines} onChanged={onChanged} today="2026-10-16" />);
  const page = container.textContent ?? "";
  expect(page).toContain("Overdue by 16 days");
  // The year is always shown, whatever year it is.
  expect(page).toMatch(/[A-Z][a-z]{2} \d{1,2}, 20\d\d/);
  expect(page).toContain("Tenant shall submit the closing statement");
  expect(page.match(/Overdue by/g)).toHaveLength(1);
  await click(button(`Mark ${deadlines[0]?.title} done`));
  expect(rpcMock.updateDeadline).toHaveBeenCalledWith({ id: deadlines[0]?.id, status: "done" });
  expect(container.querySelectorAll("li")).toHaveLength(1);
  expect(onChanged).toHaveBeenCalled();
});

it("keeps the deadline and shows the error when the update fails", async () => {
  rpcMock.updateDeadline.mockRejectedValue(new Error("nope"));
  await render(<LegalDeadlines deadlines={deadlines} onChanged={() => {}} today="2026-10-16" />);
  await click(button(`Dismiss ${deadlines[1]?.title}`));
  expect(rpcMock.updateDeadline).toHaveBeenCalledWith({
    id: deadlines[1]?.id,
    status: "dismissed",
  });
  expect(container.textContent).toContain("Send non-renewal notice");
  expect(container.querySelector('[role="alert"]')).not.toBeNull();
});

it("opens the graph tab and draws nodes and edges", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  rpcMock.graph.mockResolvedValue(graph);
  await render(<LegalPage />);
  await click(tab("Graph"));
  await flush();
  expect(container.querySelectorAll('svg [role="button"]')).toHaveLength(graph.nodes.length);
  const drawing = container.querySelector('svg [role="button"]')?.closest("svg");
  expect(drawing?.querySelectorAll("path")).toHaveLength(graph.edges.length);
});

it("draws the graph from the frame's edge, with only a small margin outside the outer boxes", async () => {
  await render(<LegalGraphView graph={graph} />);
  const svg = container.querySelector("svg");
  const rects = [...container.querySelectorAll("svg rect")];
  const xs = rects.map((r) => Number(r.getAttribute("x")));
  const rights = rects.map((r) => Number(r.getAttribute("x")) + Number(r.getAttribute("width")));
  expect(Math.min(...xs)).toBe(24);
  expect(Number(svg?.getAttribute("width")) - Math.max(...rights)).toBe(24);
});

it("lists a selected node's relations with their source quotes", async () => {
  await render(<LegalGraphView graph={graph} />);
  await click(container.querySelector('[aria-label="Contract: Master Services Agreement"]'));
  const page = container.textContent ?? "";
  expect(page).toContain("Customer shall pay the monthly fee.");
  expect(page).toContain("Acme Hosting Inc. party to Master Services Agreement");
  expect(container.querySelector(`a[href="/app/data-room?item=${id(101)}"]`)).not.toBeNull();
});

it("handles an empty graph and caps a very large one", async () => {
  await render(<LegalGraphView graph={{ nodes: [], edges: [] }} />);
  expect(container.textContent).toContain("No relationships yet");
  const nodes = Array.from({ length: MAX_GRAPH_NODES + 30 }, (_, n) => ({
    id: id(n + 1),
    kind: "other" as const,
    label: `N${n}`,
    attrs: null,
    contractId: null,
  }));
  await render(<LegalGraphView graph={{ nodes, edges: [] }} />);
  expect(container.querySelectorAll('svg [role="button"]')).toHaveLength(MAX_GRAPH_NODES);
  expect(container.textContent).toContain(
    `Showing the ${MAX_GRAPH_NODES} most connected of ${MAX_GRAPH_NODES + 30}`,
  );
});

it("says the user's own OpenRouter key is missing, not that OpenRouter is, and links to it", async () => {
  const openSettings = vi.fn();
  rpcMock.overview.mockResolvedValue(needsKeyOverview);
  await render(<LegalPage onOpenSettings={openSettings} />);
  const page = container.textContent ?? "";
  expect(page).toContain("needs your own OpenRouter key");
  expect(page).toContain("shared OpenRouter access can't be used for Legal");
  // The disabled Scan now says why, and the empty page points at the fix.
  expect(button("Scan now")?.hasAttribute("disabled")).toBe(true);
  expect(page).toContain("Needs your OpenRouter key.");
  expect(page).toContain("Add your OpenRouter key above to start.");
  await click(button("Add your OpenRouter key"));
  expect(openSettings).toHaveBeenCalledTimes(1);
});

it("says when the Legal agent was set to another model", async () => {
  rpcMock.overview.mockResolvedValue({
    ...overview,
    model: { provider: "openrouter", id: "openai/gpt-6-luna", isPreferred: false },
    modelBlocker: "model_changed",
  });
  await render(<LegalPage onOpenSettings={() => {}} />);
  expect(container.textContent).toContain("The Legal agent is set to openai/gpt-6-luna.");
  expect(container.textContent).toContain("Needs Muse Spark 1.2.");
  expect(button("Add your OpenRouter key")).toBeUndefined();
});

it("shows no model warning when the agent runs on Muse Spark 1.2", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  await render(<LegalPage />);
  expect(container.textContent).not.toContain("OpenRouter key");
});

it("warns on first load when no model resolves, and shows no consent card without a recipient", async () => {
  rpcMock.overview.mockResolvedValue({ ...overview, model: null, modelBlocker: "own_key" });
  rpcMock.consent.mockResolvedValue({ ...consentFixture, allowed: false, recipients: [] });
  await render(<LegalPage />);
  expect(container.textContent).toContain("needs your own OpenRouter key");
  expect(button("Allow")).toBeUndefined();
});

it("still asks for consent when a recipient exists", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  rpcMock.consent.mockResolvedValue({ ...consentFixture, allowed: false });
  await render(<LegalPage />);
  expect(button("Allow")).toBeDefined();
});

const edgeWithUnderscore = { ...graph.edges[0]!, relation: "party_to" };

it("shows a stored relation key as words", async () => {
  await render(<LegalGraphView graph={{ ...graph, edges: [edgeWithUnderscore] }} />);
  await click(container.querySelector('[aria-label="Contract: Master Services Agreement"]'));
  expect(container.textContent).toContain("Example Labs LLC party to Master Services Agreement");
  expect(container.textContent).not.toContain("party_to");
});

it("hides the contract value while amounts are hidden", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  setHideAmounts(true);
  try {
    await render(<LegalPage />);
    expect(container.textContent).not.toContain("$50,000");
    expect(container.textContent).toContain("•••");
  } finally {
    setHideAmounts(false);
  }
});

it("counts the Overdue tile from the viewer's date, like the row pills", async () => {
  rpcMock.overview.mockResolvedValue({
    ...overview,
    counts: { ...overview.counts, overdueDeadlines: 0 },
    deadlines: [{ ...deadlines[0]!, dueDate: "2000-01-01" }],
  });
  await render(<LegalPage />);
  const tile = [...container.querySelectorAll("div")].find(
    (el) => el.textContent?.startsWith("Overdue") && el.children.length <= 3,
  );
  expect(tile?.textContent).toContain("1");
});

it("says why Scan now is disabled, and shows no consent card while the model is wrong", async () => {
  const openSettings = vi.fn();
  rpcMock.overview.mockResolvedValue({
    ...overview,
    model: { provider: "openrouter", id: "other/model", isPreferred: false },
    modelBlocker: "own_key",
  });
  rpcMock.consent.mockResolvedValue({ ...consentFixture, allowed: false });
  await render(<LegalPage onOpenSettings={openSettings} />);
  expect(button("Scan now")?.hasAttribute("disabled")).toBe(true);
  expect(container.textContent).toContain("Needs your OpenRouter key.");
  expect(button("Allow")).toBeUndefined();

  await act(async () => root.unmount());
  root = createRoot(container);
  rpcMock.overview.mockResolvedValue(overview);
  rpcMock.consent.mockResolvedValue({ ...consentFixture, allowed: false });
  await render(<LegalPage />);
  expect(container.textContent).toContain("Allow access below first.");
  await act(async () => root.unmount());
  root = createRoot(container);
  rpcMock.consent.mockResolvedValue({ ...consentFixture, allowed: false, recipients: [] });
  await render(<LegalPage />);
  expect(container.textContent).toContain("Connect a model in Settings first.");
});

it("keeps Scanning until the run ends, then shows the new time", async () => {
  vi.useFakeTimers();
  try {
    const running = {
      ...overview,
      agent: {
        ...overview.agent,
        lastScanRun: { id: id(7), status: "running" as const, error: null },
      },
    };
    const done = {
      ...overview,
      agent: {
        ...overview.agent,
        lastScanAt: "2026-10-16T08:00:00.000Z",
        lastScanRun: { id: id(7), status: "completed" as const, error: null },
      },
    };
    rpcMock.overview.mockResolvedValueOnce(overview).mockResolvedValue(running);
    rpcMock.scanNow.mockResolvedValue({ runId: id(7), botId: id(2) });
    await render(<LegalPage />);
    await click(button("Scan now"));
    expect(button("Scanning…")?.hasAttribute("disabled")).toBe(true);
    rpcMock.overview.mockResolvedValue(done);
    await act(async () => void (await vi.advanceTimersByTimeAsync(4_100)));
    expect(button("Scan now")).toBeDefined();
    expect(button("Scanning…")).toBeUndefined();
  } finally {
    vi.useRealTimers();
  }
});

it("shows why the last scan failed and scans again from the one Scan now button", async () => {
  rpcMock.overview.mockResolvedValue({
    ...overview,
    agent: {
      ...overview.agent,
      lastScanRun: { id: id(8), status: "failed", error: "Data Room consent is required." },
    },
  });
  rpcMock.scanNow.mockResolvedValue({ runId: id(9), botId: id(2) });
  await render(<LegalPage />);
  expect(container.textContent).toContain("Last scan failed: Data Room consent is required.");
  // No second button that does the same as Scan now.
  expect(button("Retry")).toBeUndefined();
  await click(button("Scan now"));
  expect(rpcMock.scanNow).toHaveBeenCalledTimes(1);
});

it("has one Scan now button on an empty page", async () => {
  rpcMock.overview.mockResolvedValue(emptyOverview);
  await render(<LegalPage />);
  expect(
    [...container.querySelectorAll("button")].filter((b) => b.textContent === "Scan now"),
  ).toHaveLength(1);
});

it("re-reads the overview and consent when the window gets focus again", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  await render(<LegalPage />);
  const before = rpcMock.overview.mock.calls.length;
  await act(async () => void window.dispatchEvent(new Event("focus")));
  expect(rpcMock.overview.mock.calls.length).toBe(before + 1);
  expect(rpcMock.consent.mock.calls.length).toBeGreaterThan(1);
});

it("offers Undo after Done and reopens the deadline", async () => {
  const onChanged = vi.fn();
  rpcMock.updateDeadline.mockResolvedValue({});
  await render(<LegalDeadlines deadlines={deadlines} onChanged={onChanged} today="2026-10-16" />);
  await click(button(`Mark ${deadlines[0]?.title} done`));
  expect(container.textContent).not.toContain("Tenant shall submit");
  await click(button("Undo"));
  expect(rpcMock.updateDeadline).toHaveBeenLastCalledWith({ id: deadlines[0]?.id, status: "open" });
  expect(container.textContent).toContain("Return the security deposit");
  expect(button("Undo")).toBeUndefined();
});

it("says when a deadline is due soon and shows its notes", async () => {
  const soon = (n: number, dueDate: string, notes: string | null) => ({
    ...deadlines[1]!,
    id: id(60 + n),
    title: `Soon ${n}`,
    dueDate,
    notes,
  });
  await render(
    <LegalDeadlines
      deadlines={[
        soon(0, "2026-10-16", "Derived from the expiration date."),
        soon(1, "2026-10-17", null),
        soon(2, "2026-10-21", null),
        soon(3, "2027-03-01", null),
      ]}
      onChanged={() => {}}
      today="2026-10-16"
    />,
  );
  const page = container.textContent ?? "";
  expect(page).toContain("Due today");
  expect(page).toContain("Due tomorrow");
  expect(page).toContain("Due in 5 days");
  expect(page).not.toContain("Due in 136 days");
  expect(page).toContain("Derived from the expiration date.");
});

it("hides amounts in deadline titles and graph labels while amounts are hidden", async () => {
  const priced = { ...deadlines[0]!, title: "Pay $12,500 deposit", contractTitle: "Lease $12,500" };
  const pricedGraph = {
    nodes: [{ ...graph.nodes[3]!, label: "Retainer $9,000 agreement" }, graph.nodes[0]!],
    edges: [],
  };
  setHideAmounts(true);
  try {
    await render(<LegalDeadlines deadlines={[priced]} onChanged={() => {}} today="2026-10-16" />);
    expect(container.textContent).not.toContain("12,500");
    expect(button("Mark Pay $12,500 deposit done")).toBeUndefined();
    await render(<LegalGraphView graph={pricedGraph} />);
    expect(container.textContent).not.toContain("9,000");
    expect(container.querySelector('[aria-label*="9,000"]')).toBeNull();
  } finally {
    setHideAmounts(false);
  }
  await render(<LegalDeadlines deadlines={[priced]} onChanged={() => {}} today="2026-10-16" />);
  expect(container.textContent).toContain("Pay $12,500 deposit");
});

it("keeps the page when a re-read fails, says so, and recovers on Try again", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  await render(<LegalPage />);
  rpcMock.overview.mockRejectedValue(new Error("Could not reach the server"));
  await act(async () => void window.dispatchEvent(new Event("focus")));
  await flush();
  const page = container.textContent ?? "";
  expect(page).toContain("Master Services Agreement");
  expect(page).toContain("Scan now");
  expect(page).toContain("Could not refresh: Could not reach the server");
  rpcMock.overview.mockResolvedValue(overview);
  await click(button("Try again"));
  await flush();
  expect(container.textContent).not.toContain("Could not refresh");
  expect(container.textContent).toContain("Master Services Agreement");
});

it("names the Legal agent on Ask and offers the Hide amounts switch", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  await render(<LegalPage onAskAgent={() => {}} />);
  expect(button("Ask Legal agent")).toBeDefined();
  expect(button("Ask Finance agent")).toBeUndefined();
  expect(container.querySelector('[data-testid="hide-amounts-toggle"]')).not.toBeNull();
});

it("links the unchecked documents line to the Data room and the deadline tiles to Deadlines", async () => {
  // One deadline long past and one far ahead, so which one is overdue never depends on today.
  rpcMock.overview.mockResolvedValue({
    ...overview,
    deadlines: [
      { ...deadlines[0]!, dueDate: "2000-01-01" },
      { ...deadlines[1]!, dueDate: "2999-01-01" },
    ],
  });
  await render(<LegalPage />);
  expect(container.querySelector('a[href="/app/data-room"]')?.textContent).toBe(
    "3 Data room documents not yet checked by Legal",
  );
  expect(tab("Deadlines")?.getAttribute("aria-selected")).toBe("false");
  const overdue = [...container.querySelectorAll("a")].find((a) =>
    a.textContent?.startsWith("Overdue"),
  );
  expect(overdue?.getAttribute("href")).toBe("/app/legal?view=deadlines&due=overdue");
  await click(overdue);
  expect(tab("Deadlines")?.getAttribute("aria-selected")).toBe("true");
  // The tile said 1, so the list it opens shows that one, not every open deadline.
  expect(container.textContent).toContain("Return the security deposit paperwork");
  expect(container.textContent).not.toContain("Send non-renewal notice");
  expect(container.textContent).toContain("Showing 1 overdue deadline.");
  await click(button("Show all 2 open deadlines"));
  expect(container.textContent).toContain("Send non-renewal notice");
});

it("names the space beside the title when there is more than one", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  await render(<LegalPage spaceName="MOCK Empty space" />);
  expect(container.querySelector("h1")?.parentElement?.textContent).toContain("MOCK Empty space");
});

it("says the Legal agent scans daily next to the last scan time", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  await render(<LegalPage />);
  expect(container.textContent).toMatch(/Last scan .+\. Scans daily\./);
});

it("says daily scans wait for access when earlier results exist but access is not allowed", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  rpcMock.consent.mockResolvedValue({ ...consentFixture, allowed: false });
  await render(<LegalPage />);
  expect(container.textContent).toMatch(/Last scan .+\. Daily scans wait until you allow access\./);
  expect(container.textContent).not.toContain("Scans daily.");
});

it("leaves out the unchecked documents line when Legal has checked everything", async () => {
  rpcMock.overview.mockResolvedValue({
    ...overview,
    counts: { ...overview.counts, unreviewedDocuments: 0 },
  });
  await render(<LegalPage />);
  expect(container.textContent).not.toContain("not yet checked");
  expect(container.querySelector('a[href="/app/data-room"]')).toBeNull();
});

it("words a term with only a start date, and gives the next deadline its year", async () => {
  await render(
    <LegalContracts
      contracts={[
        {
          ...contracts[0]!,
          effectiveDate: "2026-05-20",
          expirationDate: null,
          nextDeadline: "2026-11-30",
        },
      ]}
    />,
  );
  const page = container.textContent ?? "";
  expect(page).toContain("Since May 20, 2026");
  expect(page).not.toContain("– —");
  expect(page).toContain("Nov 30, 2026");
});

it("puts contracts between their parties and their jurisdictions, with edges ending at box sides", async () => {
  await render(<LegalGraphView graph={graph} />);
  const heads = [...container.querySelectorAll("svg > text")].map((el) => el.textContent);
  expect(heads.indexOf("Contract")).toBeGreaterThan(heads.indexOf("Company"));
  expect(heads.indexOf("Jurisdiction")).toBeGreaterThan(heads.indexOf("Contract"));
  // No edge starts at a box's centre, where it would run behind the box.
  const centres = [...container.querySelectorAll('svg [role="button"] rect')].map((rect) => {
    const x = Number(rect.getAttribute("x")) + Number(rect.getAttribute("width")) / 2;
    const y = Number(rect.getAttribute("y")) + Number(rect.getAttribute("height")) / 2;
    return `M${x} ${y}`;
  });
  for (const path of container.querySelectorAll("svg path")) {
    const start = path.getAttribute("d")?.split(" C")[0];
    expect(centres).not.toContain(start);
  }
});

it("breaks a long label over two lines instead of cutting it short", () => {
  expect(labelLines("Delaware")).toEqual(["Delaware"]);
  expect(labelLines("MOCK Master Services Agreement - Halcyon Logistics")).toEqual([
    "MOCK Master Services Agreement",
    "- Halcyon Logistics",
  ]);
  expect(labelLines(`${"A ".repeat(40)}end`)[1]?.endsWith("…")).toBe(true);
});
