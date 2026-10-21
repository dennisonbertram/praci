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
vi.mock("@lingui/core/macro", () => ({ t: text, plural: () => "" }));
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: text, i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
const rpcMock = vi.hoisted(() => ({ sessions: vi.fn() }));
vi.mock("../lib/rpc", () => ({ rpc: { devin: rpcMock } }));

import type { DevinSessionsOutput } from "@rakazo/contracts";
import { DevinPage } from "./Devin";
import {
  connectorGone,
  emptyOverview,
  notConnected,
  notConnectedMember,
  overview,
  QUESTION,
  rejected,
} from "./devin/fixtures";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
const flush = () => act(async () => {});
const render = async (node: ReactNode) => {
  await act(async () => root.render(<MemoryRouter>{node}</MemoryRouter>));
  await flush();
};
const show = async (data: DevinSessionsOutput, props: Parameters<typeof DevinPage>[0] = {}) => {
  rpcMock.sessions.mockImplementation(async () => structuredClone(data));
  // A fresh mount, so the page reads the new answer.
  await act(async () => root.render(null));
  await render(<DevinPage {...props} />);
};
const button = (name: string) =>
  [...container.querySelectorAll("button")].find(
    (b) => b.textContent === name || b.getAttribute("aria-label") === name,
  );
const table = () => container.querySelector("table") as HTMLTableElement;
const rowOf = (title: string) =>
  [...table().querySelectorAll("tbody tr")].find((row) => row.textContent?.includes(title)) as
    | HTMLTableRowElement
    | undefined;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.resetAllMocks();
  vi.useRealTimers();
});

it("the row is one link to the session, the question is not clamped, the PR is text, and Error rows count under Needs you", async () => {
  await show(overview);
  const row = rowOf("Add retry limit to the export worker")!;
  const interactive = row.querySelectorAll("a, button, input, [tabindex]");
  expect(interactive).toHaveLength(1);
  const link = interactive[0] as HTMLAnchorElement;
  expect(link.getAttribute("href")).toBe("https://app.devin.ai/sessions/devin-1001");
  expect(link.getAttribute("rel")).toBe("noreferrer");
  expect(link.textContent?.trim().endsWith("(opens in Devin)")).toBe(true);
  expect(link.className).toContain("after:inset-0");
  // The stored question shows in full, with no clamp or truncation class.
  const question = [...row.querySelectorAll("p")].find((p) => p.textContent === QUESTION)!;
  expect(question).toBeTruthy();
  expect(question.className).not.toMatch(/clamp|truncate|overflow-hidden/);
  // Pull requests are text: no anchor in the cell, "open" under the reference.
  const pr = rowOf("Migrate invoices endpoint")!.querySelectorAll("td")[2]!;
  expect(pr.querySelector("a")).toBeNull();
  expect([...pr.children].map((line) => line.textContent)).toEqual([
    "acme/api#212open",
    "acme/mobile#41open",
  ]);
  expect(rowOf("Add retry limit")!.querySelectorAll("td")[2]!.textContent).toBe("—");
  // One needs-you session plus one failed session.
  const tile = [...container.querySelectorAll("h2")].find((h) => h.textContent === "Needs you")!;
  expect(tile.parentElement?.textContent).toContain("2");
});

it("lists Needs you, Working and Earlier in order and omits an empty section", async () => {
  await show(overview);
  const headings = [...table().querySelectorAll("tbody th")].map((th) => th.textContent);
  expect(headings).toEqual(["Needs you", "Working", "Earlier"]);
  await show({ ...overview, sessions: overview.sessions.filter((s) => s.kind === "finished") });
  expect([...table().querySelectorAll("tbody th")].map((th) => th.textContent)).toEqual([
    "Earlier",
  ]);
});

it("names the source, shows an unknown status as Devin's own text and an untitled session", async () => {
  await show(overview);
  expect(rowOf("Bump the TypeScript version")!.textContent).toContain("Code scan");
  expect(rowOf("Untitled session")!.textContent).toContain("Other");
  expect(rowOf("Tidy the onboarding copy")!.textContent).toContain("daydreaming");
});

it("shows how long needs-you and error rows have waited, and the age of the others", async () => {
  await show(overview);
  expect(rowOf("Add retry limit")!.textContent).toContain("Waiting 25m");
  expect(rowOf("Fix flaky checkout test")!.textContent).toContain("Waiting 3h");
  expect(rowOf("Migrate invoices endpoint")!.textContent).toContain("12m ago");
});

it("says the data is old only when stale, and that some sessions were unreadable only when partial", async () => {
  await show(overview);
  expect(container.textContent).not.toContain("Updated 1m ago");
  expect(container.textContent).not.toContain("Some sessions could not be read.");
  await show({ ...overview, stale: true, partial: true });
  expect(container.textContent).toContain("Updated 1m ago");
  expect(container.textContent).toContain("Some sessions could not be read.");
});

it("shows an empty organization as one line and a link to Devin, with no tiles or table", async () => {
  await show(emptyOverview);
  expect(container.textContent).toContain("No Devin sessions yet.");
  const link = [...container.querySelectorAll("a")].find((a) => a.textContent === "Open Devin");
  expect(link?.getAttribute("href")).toBe("https://app.devin.ai");
  expect(container.querySelector("table")).toBeNull();
  expect(container.querySelector("h2")).toBeNull();
});

it("replaces the tiles with the rejected notice, offers Reconnect to owners only and mutes the rows", async () => {
  const onReconnect = vi.fn();
  await show(rejected, { onReconnect });
  expect(container.textContent).toContain("Devin rejected the key. Alerts are paused.");
  expect(container.querySelector("h2")).toBeNull();
  expect(table().getAttribute("data-muted")).toBe("true");
  await act(async () => button("Reconnect")!.click());
  expect(onReconnect).toHaveBeenCalledOnce();
  await show(
    { ...rejected, connection: { ...rejected.connection, manage: false } },
    { onReconnect },
  );
  expect(button("Reconnect")).toBeUndefined();
  expect(container.textContent).toContain("Ask a space owner to reconnect.");
});

it("says the connector left, with the same Reconnect rule", async () => {
  await show(connectorGone, { onReconnect: vi.fn() });
  expect(container.textContent).toContain(
    "The member who connected Devin left this space. Alerts are paused.",
  );
  expect(button("Reconnect")).toBeTruthy();
  expect(table().getAttribute("data-muted")).toBe("true");
});

it("asks an owner to connect and tells a member who can", async () => {
  const onConnect = vi.fn();
  await show(notConnected, { onConnect });
  expect(container.textContent).toContain("Connect Devin to see its sessions here.");
  await act(async () => button("Connect Devin")!.click());
  expect(onConnect).toHaveBeenCalledOnce();
  await show(notConnectedMember, { onConnect });
  expect(container.textContent).toContain("Ask a space owner to connect Devin.");
  expect(button("Connect Devin")).toBeUndefined();
});

it("offers Ask only to the connector, and not while the connection is paused", async () => {
  await show(overview, { onAskAgent: vi.fn() });
  expect(button("Ask")).toBeTruthy();
  await show(
    { ...overview, connection: { ...overview.connection, isConnector: false } },
    { onAskAgent: vi.fn() },
  );
  expect(button("Ask")).toBeUndefined();
  await show(rejected, { onAskAgent: vi.fn() });
  expect(button("Ask")).toBeUndefined();
});

it("keeps the rows and offers Try again when a re-read fails, and shows only the notice on a first failure", async () => {
  rpcMock.sessions.mockRejectedValue(new Error("down"));
  await render(<DevinPage />);
  expect(container.textContent).toContain("Could not load Devin sessions.");
  expect(container.querySelector("table")).toBeNull();
  rpcMock.sessions.mockResolvedValueOnce(overview).mockRejectedValue(new Error("down"));
  await act(async () => button("Try again")!.click());
  await flush();
  await act(async () => void window.dispatchEvent(new Event("focus")));
  await flush();
  expect(container.textContent).toContain("Could not load Devin sessions.");
  expect(table()).toBeTruthy();
  // Try again over kept rows re-reads without dropping them.
  rpcMock.sessions.mockImplementation(() => new Promise(() => {}));
  await act(async () => button("Try again")!.click());
  expect(table()).toBeTruthy();
});

it("re-reads every minute while visible and on focus, and tells the sidebar after each read", async () => {
  vi.useFakeTimers();
  const changed = vi.fn();
  window.addEventListener("rakazo:notifications-changed", changed);
  await show(overview);
  expect(rpcMock.sessions).toHaveBeenCalledTimes(1);
  expect(changed).toHaveBeenCalledTimes(1);
  await act(async () => void vi.advanceTimersByTime(60_000));
  expect(rpcMock.sessions).toHaveBeenCalledTimes(2);
  expect(changed).toHaveBeenCalledTimes(2);
  await act(async () => void window.dispatchEvent(new Event("focus")));
  expect(rpcMock.sessions).toHaveBeenCalledTimes(3);
  window.removeEventListener("rakazo:notifications-changed", changed);
});

it("does not call a partly read, empty listing an empty organization", async () => {
  await show({ ...emptyOverview, partial: true });
  expect(container.textContent).toContain("Some sessions could not be read.");
  expect(container.textContent).not.toContain("No Devin sessions yet.");
});
