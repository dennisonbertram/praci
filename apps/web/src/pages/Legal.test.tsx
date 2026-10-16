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

import { LegalGraphView, MAX_GRAPH_NODES } from "../components/legal/LegalGraph";
import { LegalPage } from "./Legal";
import { consentFixture, deadlines, emptyOverview, graph, id, overview } from "./legal/fixtures";
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
  expect(page).toContain("Unreviewed documents");
  expect(container.querySelector(`a[href="/app/data-room?item=${id(101)}"]`)).not.toBeNull();
  expect(container.querySelector('[aria-label="Allow"]')).toBeNull();
});

it("shows the empty state, loading skeleton and load error", async () => {
  rpcMock.overview.mockResolvedValue(emptyOverview);
  await render(<LegalPage />);
  expect(container.textContent).toContain("scans your Data room");
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

it("scans now and opens the agent panel", async () => {
  rpcMock.overview.mockResolvedValue(overview);
  rpcMock.scanNow.mockResolvedValue({ runId: id(1), botId: id(2) });
  const ask = vi.fn();
  await render(<LegalPage onAskAgent={ask} />);
  await click(button("Scan now"));
  expect(rpcMock.scanNow).toHaveBeenCalledTimes(1);
  expect(ask).toHaveBeenCalledTimes(1);
});

it("marks overdue deadlines and closes one with Done", async () => {
  const onChanged = vi.fn();
  rpcMock.updateDeadline.mockResolvedValue({});
  await render(<LegalDeadlines deadlines={deadlines} onChanged={onChanged} today="2026-10-16" />);
  const page = container.textContent ?? "";
  expect(page).toContain("Overdue by 16 days");
  expect(page).toContain("Tenant shall submit the closing statement");
  expect(page.match(/Overdue by/g)).toHaveLength(1);
  await click(button(`Mark ${deadlines[0]?.title} done`));
  expect(rpcMock.updateDeadline).toHaveBeenCalledWith({ id: deadlines[0]?.id, status: "done" });
  expect(container.textContent).not.toContain("Return the security deposit");
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
  expect(container.querySelectorAll("svg path")).toHaveLength(graph.edges.length);
});

it("lists a selected node's relations with their source quotes", async () => {
  await render(<LegalGraphView graph={graph} />);
  await click(container.querySelector('[aria-label="Contract: Master Services Agreement"]'));
  const page = container.textContent ?? "";
  expect(page).toContain("Customer shall pay the monthly fee.");
  expect(page).toContain("Acme Hosting Inc. party to Master Services Agreement");
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
