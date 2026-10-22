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

import { LEGAL_CONSENT_GRANTED } from "../components/legal/ConsentPrompt";
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
  [...container.querySelectorAll('[role="tab"]')].find((b) => b.textContent?.startsWith(name));

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
  expect(container.querySelectorAll("h1")).toHaveLength(1);
  expect(container.querySelector("h1")?.closest("[data-page-header]")).not.toBeNull();
  expect(container.querySelector('table[data-slot="table"]')).not.toBeNull();
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
  // The header stays, so the page is still recognisable and the agent still reachable.
  expect(container.querySelector("h1")?.textContent).toBe("Legal");
});

it("puts the counts in the tab labels and colors Overdue when above zero", async () => {
  rpcMock.overview.mockResolvedValue({
    ...overview,
    deadlines: [{ ...deadlines[0]!, dueDate: "2000-01-01" }],
  });
  await render(<LegalPage />);
  expect(tab("Contracts")?.textContent).toContain(String(overview.counts.contracts));
  expect(container.querySelectorAll("h2")).toHaveLength(0);
  const overdue = [...container.querySelectorAll("span")].find((e) =>
    e.textContent?.endsWith("overdue"),
  );
  expect(overdue?.textContent).toBe("1 overdue");
  expect(overdue?.className).toContain("text-destructive");
});

it("asks for consent when it is not allowed, and grants the shown key", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  rpcMock.consent.mockResolvedValue({ ...consentFixture, allowed: false });
  rpcMock.consentGrant.mockResolvedValue(consentFixture);
  rpcMock.scanNow.mockResolvedValue({ runId: id(1), botId: id(2) });
  await render(<LegalPage />);
  expect(container.textContent).toContain("Let Praci read your documents");
  // The card says what is sent, not just that an AI model is involved.
  expect(container.textContent).toContain("The text is sent");
  // The card's Allow is the one action: no dimmed Scan now, no zero tiles.
  expect(button("Scan now")).toBeUndefined();
  expect(container.querySelectorAll("h2")).toHaveLength(1);
  await click(button("Allow"));
  expect(rpcMock.consentGrant).toHaveBeenCalledWith({ key: "k1", version: "v1" });
  expect(container.textContent).not.toContain("Let Praci read your documents");
  // Allow is the one click: the first scan starts without a second.
  expect(rpcMock.scanNow).toHaveBeenCalledTimes(1);
});

it("does not repeat the card's sentence on an empty page waiting for consent", async () => {
  rpcMock.overview.mockResolvedValue(emptyOverview);
  rpcMock.consent.mockResolvedValue({ ...consentFixture, allowed: false });
  await render(<LegalPage />);
  expect(container.textContent).toContain("Let Praci read your documents");
  expect(container.textContent).not.toContain("Allow access above");
  expect(container.textContent).not.toContain("Press Scan now");
});

it("shows the empty Contracts and Deadlines tabs under the consent card", async () => {
  rpcMock.overview.mockResolvedValue(emptyOverview);
  rpcMock.consent.mockResolvedValue({ ...consentFixture, allowed: false });
  await render(<LegalPage />);
  expect(tab("Contracts")).toBeDefined();
  expect(tab("Deadlines")).toBeDefined();
});

it("does not say Not scanned yet while the first scan runs", async () => {
  rpcMock.overview.mockResolvedValue({
    ...emptyOverview,
    agent: {
      ...emptyOverview.agent,
      lastScanAt: null,
      lastScanRun: { id: id(7), status: "running" as const, error: null },
    },
  });
  await render(<LegalPage />);
  expect(container.textContent).toContain("Scanning…");
  expect(container.textContent).not.toContain("Not scanned yet");
});

it("says No deadlines found with the date after a scan of an empty Data room", async () => {
  rpcMock.overview.mockResolvedValue({
    ...emptyOverview,
    agent: { ...emptyOverview.agent, lastScanAt: "2026-10-20T10:00:00.000Z" },
  });
  await render(<LegalPage />);
  expect(container.textContent).toContain("No contracts or deadlines found on Oct 20, 2026.");
  expect(container.textContent).not.toContain("Press Scan now");
});

it("refetches the prompt when the consent key is stale", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  rpcMock.consent
    .mockResolvedValueOnce({ ...consentFixture, allowed: false })
    .mockResolvedValue({ ...consentFixture, allowed: false, key: "k2", disclosure: "New model." });
  rpcMock.consentGrant
    .mockRejectedValueOnce(Object.assign(new Error("stale"), { code: "CONFLICT" }))
    .mockResolvedValue(consentFixture);
  await render(<LegalPage />);
  await click(button("Allow"));
  // The stale key is replaced silently; the next Allow grants the fresh one.
  expect(container.querySelector('[role="alert"]')).toBeNull();
  await click(button("Allow"));
  expect(rpcMock.consentGrant).toHaveBeenLastCalledWith({ key: "k2", version: "v1" });
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

// A row's buttons are named from its whole first line, contract included.
const named = (d?: { title: string; contractTitle?: string | null }) =>
  d?.contractTitle ? `${d.title}: ${d.contractTitle}` : d?.title;

it("marks overdue deadlines and closes one with Done", async () => {
  const onChanged = vi.fn();
  const sidebarRefresh = vi.fn();
  window.addEventListener("rakazo:notifications-changed", sidebarRefresh);
  rpcMock.updateDeadline.mockResolvedValue({});
  await render(<LegalDeadlines deadlines={deadlines} onChanged={onChanged} today="2026-10-16" />);
  const page = container.textContent ?? "";
  expect(page).toContain("Overdue by 16 days");
  // The year is always shown, whatever year it is.
  expect(page).toMatch(/[A-Z][a-z]{2} \d{1,2}, 20\d\d/);
  expect(page).toContain("Tenant shall submit the closing statement");
  expect(page.match(/Overdue by/g)).toHaveLength(1);
  await click(button(`Mark ${named(deadlines[0])} done`));
  expect(rpcMock.updateDeadline).toHaveBeenCalledWith({ id: deadlines[0]?.id, status: "done" });
  // The closed row's slot now holds the Undo line, so the rows below stay where they were.
  const rows = container.querySelectorAll("li");
  expect(rows).toHaveLength(2);
  expect(rows[0]?.textContent).toContain("Undo");
  expect(onChanged).toHaveBeenCalled();
  // The sidebar Legal badge refreshes at once.
  expect(sidebarRefresh).toHaveBeenCalled();
  window.removeEventListener("rakazo:notifications-changed", sidebarRefresh);
});

it("keeps the deadline and shows the error when the update fails", async () => {
  rpcMock.updateDeadline.mockRejectedValue(new Error("nope"));
  await render(<LegalDeadlines deadlines={deadlines} onChanged={() => {}} today="2026-10-16" />);
  await click(button(`Dismiss ${named(deadlines[1])}`));
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

it("shows no key or model banner when Legal runs on the space default model", async () => {
  rpcMock.overview.mockResolvedValue({
    ...overview,
    model: { provider: "openrouter", id: "openai/gpt-6-luna", isPreferred: false },
  });
  await render(<LegalPage onOpenSettings={() => {}} />);
  expect(container.textContent).not.toMatch(/OpenRouter|Muse Spark|its own model/);
  expect(button("Scan now")).toBeDefined();
});

it("shows no consent card without a recipient", async () => {
  rpcMock.overview.mockResolvedValue({ ...overview, model: null });
  rpcMock.consent.mockResolvedValue({ ...consentFixture, allowed: false, recipients: [] });
  await render(<LegalPage />);
  expect(container.textContent).not.toContain("OpenRouter");
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

it("counts overdue from the viewer's date, like the row pills", async () => {
  rpcMock.overview.mockResolvedValue({
    ...overview,
    counts: { ...overview.counts, overdueDeadlines: 0 },
    deadlines: [{ ...deadlines[0]!, dueDate: "2000-01-01" }],
  });
  await render(<LegalPage />);
  expect(tab("Deadlines")?.textContent).toContain("1 overdue");
});

it("says why Scan now is disabled, and what a missing consent hides", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  rpcMock.consent.mockResolvedValue({ ...consentFixture, allowed: false });
  await render(<LegalPage />);
  expect(button("Scan now")).toBeUndefined();
  expect(button("Allow")).toBeDefined();

  await act(async () => root.unmount());
  root = createRoot(container);
  rpcMock.overview.mockResolvedValue(overview);
  rpcMock.consent.mockResolvedValue({ ...consentFixture, allowed: false });
  await render(<LegalPage />);
  expect(container.textContent).not.toContain("Allow access below first.");
  expect(container.textContent).not.toContain("Daily scans wait");
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

it("offers the OpenRouter key field when the last scan's key was rejected", async () => {
  rpcMock.overview.mockResolvedValue({
    ...overview,
    agent: {
      ...overview.agent,
      lastScanRun: { id: id(8), status: "failed", error: '401: {"code":401}' },
    },
  });
  const openSettings = vi.fn();
  await render(<LegalPage onOpenSettings={openSettings} />);
  // Plain words, no vendor name, in a notice under the tiles that can be dismissed.
  const notice = container.querySelector('[data-testid="scan-failed"]');
  expect(notice?.textContent).toContain("Last scan failed: The AI key was rejected.");
  expect(notice?.textContent).not.toContain("OpenRouter");
  expect(container.querySelector("[data-page-header]")?.textContent ?? "").not.toContain(
    "Last scan failed",
  );
  await click(button("Replace key"));
  expect(openSettings).toHaveBeenCalledTimes(1);
  await click(container.querySelector('[data-testid="scan-failed"] button[aria-label="Dismiss"]'));
  expect(container.querySelector('[data-testid="scan-failed"]')).toBeNull();
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

it("scans and shows the error when Allow is clicked in the agent panel", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  rpcMock.scanNow.mockRejectedValue(new Error("scan down"));
  await render(<LegalPage />);
  await act(async () => void window.dispatchEvent(new Event(LEGAL_CONSENT_GRANTED)));
  expect(rpcMock.scanNow).toHaveBeenCalledTimes(1);
  expect(container.textContent).toContain("scan down");
});

it("offers Undo after Done and reopens the deadline", async () => {
  const onChanged = vi.fn();
  rpcMock.updateDeadline.mockResolvedValue({});
  await render(<LegalDeadlines deadlines={deadlines} onChanged={onChanged} today="2026-10-16" />);
  await click(button(`Mark ${named(deadlines[0])} done`));
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

it("names the Legal agent on Ask, with no Hide amounts switch in the header", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  await render(<LegalPage onAskAgent={() => {}} />);
  expect(button("Ask Legal agent")).toBeDefined();
  expect(button("Ask Finance agent")).toBeUndefined();
  expect(container.querySelector('[data-testid="hide-amounts-toggle"]')).toBeNull();
});

it("links the unchecked documents line to the Data room and opens Deadlines on the overdue ones", async () => {
  // One deadline long past and one far ahead, so which one is overdue never depends on today.
  rpcMock.overview.mockResolvedValue({
    ...overview,
    deadlines: [
      { ...deadlines[0]!, dueDate: "2000-01-01" },
      { ...deadlines[1]!, dueDate: "2999-01-01" },
    ],
  });
  await render(<LegalPage />);
  expect(container.querySelector('a[href="/app/data-room?legal=unchecked"]')?.textContent).toBe(
    "3 Data room documents not yet checked by Legal",
  );
  expect(tab("Deadlines")?.getAttribute("aria-selected")).toBe("false");
  await act(async () => root.unmount());
  root = createRoot(container);
  await act(async () =>
    root.render(
      <MemoryRouter initialEntries={["/app/legal?view=deadlines&due=overdue"]}>
        <LegalPage />
      </MemoryRouter>,
    ),
  );
  await flush();
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
  await render(
    <LegalPage
      spaces={[
        { id: "s1", name: "MOCK Empty space" },
        { id: "s2", name: "Other company" },
      ]}
      spaceId="s1"
      onSwitchSpace={() => undefined}
    />,
  );
  expect(container.querySelector("h1")?.parentElement?.textContent).toContain("MOCK Empty space");
});

it("says the Legal agent scans daily next to the last scan time", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  await render(<LegalPage />);
  expect(container.textContent).toMatch(/Last scan .+\. Scans daily\./);
});

it("states the consent wait once, in the banner, when access is not allowed", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  rpcMock.consent.mockResolvedValue({ ...consentFixture, allowed: false });
  await render(<LegalPage />);
  // The scan time stays out of the header until Legal may read anything.
  expect(container.textContent).not.toContain("Last scan");
  expect(button("Scan now")).toBeUndefined();
  expect(container.textContent).not.toContain("Daily scans wait");
  expect(container.textContent).not.toContain("Scans daily.");
});

it("leaves out the unchecked documents line when Legal has checked everything", async () => {
  rpcMock.overview.mockResolvedValue({
    ...overview,
    counts: { ...overview.counts, unreviewedDocuments: 0 },
  });
  await render(<LegalPage />);
  expect(container.textContent).not.toContain("not yet checked");
  expect(container.querySelector('a[href="/app/data-room?legal=unchecked"]')).toBeNull();
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

it("says the daily scan is paused when the Legal routine is off", async () => {
  rpcMock.overview.mockResolvedValue({
    ...overview,
    agent: { ...overview.agent, dailyScanActive: false },
  });
  await render(<LegalPage />);
  expect(container.textContent).toContain("Daily scan paused.");
  expect(container.textContent).not.toContain("Scans daily");
});

it("tells the shell while consent is missing, so the agent composer waits for the page's one Allow", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  rpcMock.consent.mockResolvedValue({ ...consentFixture, allowed: false });
  rpcMock.consentGrant.mockResolvedValue(consentFixture);
  const onConsentChange = vi.fn();
  const onAskAbout = vi.fn();
  await render(<LegalPage onConsentChange={onConsentChange} onAskAbout={onAskAbout} />);
  expect(onConsentChange).toHaveBeenLastCalledWith(true);
  // No row offers the agent before the page's Allow.
  await click(tab("Deadlines"));
  expect(button("Ask agent about Send non-renewal notice")).toBeUndefined();
  await click(button("Allow"));
  expect(onConsentChange).toHaveBeenLastCalledWith(false);
});

it("offers Ask agent on each deadline row, with the row as the question", async () => {
  const onAsk = vi.fn();
  await render(
    <LegalDeadlines deadlines={deadlines} onChanged={() => {}} today="2026-10-16" onAsk={onAsk} />,
  );
  expect(container.querySelectorAll("li")).toHaveLength(2);
  await click(button(`Ask agent about ${named(deadlines[1])}`));
  expect(onAsk).toHaveBeenCalledWith(deadlines[1]);
});

it("gives each deadline row its own first line, naming the contract", async () => {
  const twin = {
    ...deadlines[1],
    id: id(13),
    contractTitle: "Hosting renewal",
  } as (typeof deadlines)[number];
  await render(
    <LegalDeadlines deadlines={[...deadlines, twin]} onChanged={() => {}} today="2026-10-16" />,
  );
  const firstLines = [...container.querySelectorAll("li")].map(
    (li) => li.querySelector(".font-medium")?.parentElement?.textContent?.split("Due")[0],
  );
  expect(new Set(firstLines).size).toBe(firstLines.length);
  expect(firstLines.join()).toContain("Hosting renewal");
  const names = [...container.querySelectorAll("li button")].map((b) =>
    b.getAttribute("aria-label"),
  );
  expect(new Set(names).size).toBe(names.length);
});

it("shows a status chip only for a contract that is not active", async () => {
  await render(<LegalContracts contracts={contracts} />);
  const text = (selector: string) =>
    [...container.querySelectorAll(selector)].map((el) => el.textContent).join(" ");
  expect(text("tbody tr")).toContain("Expired");
  expect(text("tbody tr")).not.toContain("Active");
});

it("opens no two deadline rows with the same words and leaves out an all-active Status column", async () => {
  rpcMock.overview.mockResolvedValue({
    ...overview,
    contracts: overview.contracts.map((c) => ({ ...c, status: "active" as const })),
  });
  await render(<LegalPage />);
  expect(container.textContent).not.toContain("Status");
});

it("puts the contract name in the deadline title", async () => {
  await render(<LegalDeadlines deadlines={deadlines} onChanged={() => {}} today="2026-10-16" />);
  const first = [...container.querySelectorAll("li .font-medium")].map((el) => el.textContent);
  expect(first).toContain(`${deadlines[0]?.title}: ${deadlines[0]?.contractTitle}`);
});

it("names the contract in the Undo line and keeps it for 30 seconds", async () => {
  vi.useFakeTimers();
  try {
    rpcMock.updateDeadline.mockResolvedValue({});
    await render(<LegalDeadlines deadlines={deadlines} onChanged={() => {}} today="2026-10-16" />);
    await click(button(`Mark ${named(deadlines[0])} done`));
    expect(container.querySelector("li[role=status]")?.textContent).toContain(
      `Marked ${named(deadlines[0])} done.`,
    );
    await act(async () => void (await vi.advanceTimersByTimeAsync(29_000)));
    expect(button("Undo")).toBeDefined();
    await act(async () => void (await vi.advanceTimersByTimeAsync(2_000)));
    expect(button("Undo")).toBeUndefined();
  } finally {
    vi.useRealTimers();
  }
});
