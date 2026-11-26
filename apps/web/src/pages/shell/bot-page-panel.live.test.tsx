// @vitest-environment jsdom
import type { BotPage, PageData } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  list: vi.fn(),
  data: vi.fn(),
  refresh: vi.fn(),
  sources: vi.fn(),
  removeSource: vi.fn(),
  setSourceSchedule: vi.fn(),
  pauseSource: vi.fn(),
  resumeSource: vi.fn(),
  share: vi.fn(),
  shareStatus: vi.fn(),
}));
const revoke = vi.hoisted(() => vi.fn());
vi.mock("../../lib/rpc", () => ({
  rpc: { pages: mocks, artifactShares: { revoke } },
}));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray, ...values: unknown[]) =>
    parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
  useLingui: () => ({
    t: (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
  }),
}));

import { setHideAmounts } from "../../lib/hide-amounts-preference";
import { BotPagePanel } from "./bot-page-panel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const noRect = { top: 0, bottom: 0, left: 0, right: 0, width: 0, height: 0, x: 0, y: 0 } as DOMRect;
for (const { prototype } of [Node, Element, Range])
  for (const name of ["getClientRects", "getBoundingClientRect"] as const)
    Object.defineProperty(prototype, name, {
      value: () => (name === "getClientRects" ? [noRect] : noRect),
      configurable: true,
    });
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;
beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  setHideAmounts(false);
  vi.resetAllMocks();
});

const fence = (kind: string, value: unknown) => `\`\`\`${kind}\n${JSON.stringify(value)}\n\`\`\``;
const metric = { label: "Burn", source: "cash", path: "/burn", format: "usd" };
const table = {
  name: "Vendors",
  source: "spend",
  path: "/v",
  limit: 50,
  columns: [
    { key: "name", label: "Vendor" },
    { key: "total", label: "Total", format: "usd" },
  ],
};
const staticChart = { name: "Static", spec: { marks: [] }, data: [] };
const content = [fence("chart", staticChart), fence("metric", metric), fence("table", table)].join(
  "\n\n",
);
const page = (revision = 1): BotPage => ({
  id: "p1",
  kind: "blocks",
  botId: "bot_demo",
  title: "Cash",
  content,
  revision,
  updatedBy: "bot",
  updatedAt: "2026-01-01T00:00:00.000Z",
});
const data = (text: string, revision = 1): PageData => ({
  pageId: "p1",
  revision,
  blocks: [
    { status: "ok", fetchedAt: "2026-01-01T09:00:00.000Z", text },
    {
      status: "ok",
      fetchedAt: "2026-01-01T09:00:00.000Z",
      rows: [{ name: "Acme", total: 1234.5 }],
    },
  ],
});
const source = {
  id: "s1",
  pageId: "p1",
  name: "cash",
  kind: "praci",
  call: { tool: "finance_overview", args: {} },
  schedule: "1h",
  status: "active",
  lastRefreshAt: null,
  lastError: null,
};

const render = (props: Partial<Parameters<typeof BotPagePanel>[0]> = {}) =>
  act(async () => {
    root.render(<BotPagePanel botId="bot_demo" remote={null} {...props} />);
  });
const text = () => container.querySelector('[role="textbox"]')?.textContent ?? "";
const typeIntoEditor = async (value: string) => {
  const paragraph = container.querySelector('[role="textbox"] p') as HTMLElement;
  const range = document.createRange();
  range.selectNodeContents(paragraph);
  range.collapse(false);
  const selection = window.getSelection()!;
  selection.removeAllRanges();
  selection.addRange(range);
  paragraph.textContent = value;
  paragraph.dispatchEvent(
    new InputEvent("input", { bubbles: true, inputType: "insertText", data: value }),
  );
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 900));
  });
};

beforeEach(() => {
  mocks.list.mockResolvedValue([{ id: "p1", title: "Cash", revision: 1, updatedAt: "x" }]);
  mocks.get.mockResolvedValue(page());
  mocks.data.mockResolvedValue(data("$86K"));
  mocks.sources.mockResolvedValue([source]);
});

it("pairs data with live blocks in document order, skipping the static chart", async () => {
  await render();
  expect(mocks.data).toHaveBeenCalledWith({ botId: "bot_demo", pageId: "p1" });
  expect(text()).toContain("$86K");
  expect(text()).toContain("Acme");
  expect(text()).toContain("$1,235");
});

it("masks usd metrics and usd table cells while amounts are hidden", async () => {
  setHideAmounts(true);
  await render();
  expect(text()).not.toContain("$86K");
  expect(text()).not.toContain("1,235");
  expect(text()).toContain("Acme");
  expect(text()).toContain("$•••");
});

it("keeps the last value and offers Retry when a refresh failed", async () => {
  mocks.data.mockResolvedValue({
    ...data("$86K"),
    blocks: [
      { status: "failed", fetchedAt: "2026-01-01T08:00:00.000Z", error: "timed out", text: "$86K" },
      { status: "missing", fetchedAt: null },
    ],
  });
  await render();
  expect(text()).toContain("$86K");
  expect(text()).toContain("Source not found");
  expect(container.querySelector('[aria-label="Source failed"]')).not.toBeNull();
});

it("shows pending and empty placeholders", async () => {
  mocks.data.mockResolvedValue({
    ...data(""),
    blocks: [
      { status: "pending", fetchedAt: null },
      { status: "empty", fetchedAt: null },
    ],
  });
  await render();
  expect(text()).toContain("Waiting for approval");
  expect(text()).toContain("No data yet");
});

it("reloads data on a page.data event for the open page only", async () => {
  await render({ dataRemote: { pageId: "p1", seq: 1 } });
  mocks.data.mockClear();
  mocks.data.mockResolvedValue(data("$90K"));
  await render({ dataRemote: { pageId: "other", seq: 2 } });
  expect(mocks.data).not.toHaveBeenCalled();
  await render({ dataRemote: { pageId: "p1", seq: 3 } });
  expect(mocks.data).toHaveBeenCalledTimes(1);
  expect(text()).toContain("$90K");
});

it("ignores data for another revision and keeps the last data", async () => {
  await render();
  mocks.data.mockResolvedValue(data("$99K", 5));
  await render({ dataRemote: { pageId: "p1", seq: 1 } });
  expect(text()).toContain("$86K");
  expect(text()).not.toContain("$99K");
});

it("keeps the newest live data when requests resolve in reverse order", async () => {
  await render();
  mocks.data.mockClear();
  let finishOlder: (value: PageData) => void = () => undefined;
  let finishNewer: (value: PageData) => void = () => undefined;
  mocks.data
    .mockReturnValueOnce(new Promise<PageData>((resolve) => (finishOlder = resolve)))
    .mockReturnValueOnce(new Promise<PageData>((resolve) => (finishNewer = resolve)));
  await render({ dataRemote: { pageId: "p1", seq: 1 } });
  await render({ dataRemote: { pageId: "p1", seq: 2 } });
  expect(mocks.data).toHaveBeenCalled();
  await act(async () => finishNewer(data("$newer")));
  await act(async () => finishOlder(data("$older")));
  expect(text()).toContain("$newer");
  expect(text()).not.toContain("$older");
});

async function click(el: Element | null | undefined) {
  if (!el) throw new Error("missing element");
  await act(async () => {
    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"])
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }));
  });
}
const byText = (label: string, selector = "*") =>
  [...document.querySelectorAll(selector)].find((el) => el.textContent === label);

async function openMenu() {
  await click(container.querySelector('[aria-label="Page options"]'));
}

it("hides Refresh and Sources when the page has no sources", async () => {
  mocks.sources.mockResolvedValue([]);
  await render();
  await openMenu();
  expect(byText("Rename", '[role="menuitem"]')).toBeTruthy();
  expect(byText("Refresh", '[role="menuitem"]')).toBeUndefined();
  expect(byText("Sources", '[role="menuitem"]')).toBeUndefined();
});

it("Refresh reruns the sources and shows the returned data", async () => {
  let finish: (value: PageData) => void = () => undefined;
  mocks.refresh.mockReturnValue(new Promise<PageData>((resolve) => (finish = resolve)));
  await render();
  await openMenu();
  await click(byText("Refresh", '[role="menuitem"]'));
  expect(mocks.refresh).toHaveBeenCalledWith({ botId: "bot_demo", pageId: "p1" });
  expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  await act(async () => finish(data("$91K")));
  expect(container.querySelector('[aria-busy="true"]')).toBeNull();
  expect(text()).toContain("$91K");
});

it("keeps refresh data when a save starts a later data load", async () => {
  mocks.get.mockResolvedValue({ ...page(), content: `Cash paragraph\n\n${content}` });
  await render();
  mocks.data.mockClear();
  mocks.data.mockResolvedValue(data("$old load value", 2));
  let finishRefresh: (value: PageData) => void = () => undefined;
  mocks.refresh.mockReturnValue(new Promise<PageData>((resolve) => (finishRefresh = resolve)));
  await openMenu();
  await click(byText("Refresh", '[role="menuitem"]'));
  mocks.save.mockResolvedValue({ ok: true, page: page(2) });
  await typeIntoEditor("Cash paragraph edited");
  expect(mocks.data).toHaveBeenCalledTimes(1);
  expect(text()).toContain("$old load value");
  await act(async () => finishRefresh(data("$new refresh value", 2)));
  expect(text()).toContain("$new refresh value");
});

it("ignores a second Refresh while the first is running", async () => {
  let finish: (value: PageData) => void = () => undefined;
  mocks.refresh.mockReturnValue(new Promise<PageData>((resolve) => (finish = resolve)));
  await render();
  await openMenu();
  await click(byText("Refresh", '[role="menuitem"]'));
  await click(container.querySelector('[aria-label="Page options"]'));
  await click(byText("Refresh", '[role="menuitem"]'));
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  await act(async () => finish(data("$91K")));
});

it("shows a refresh error without showing the save Retry", async () => {
  mocks.refresh.mockRejectedValue(new Error("refresh failed"));
  await render();
  await openMenu();
  await click(byText("Refresh", '[role="menuitem"]'));
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("refresh failed");
  expect(byText("Retry", "button")).toBeUndefined();
});

it("keeps save failure and Retry when Refresh also fails", async () => {
  mocks.get.mockResolvedValue({ ...page(), content: `Cash paragraph\n\n${content}` });
  mocks.save.mockRejectedValueOnce(new Error("Could not save the page."));
  await render();
  await typeIntoEditor("Cash paragraph edited");
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not save the page.");
  mocks.refresh.mockRejectedValue(new Error("refresh failed"));
  await openMenu();
  await click(byText("Refresh", '[role="menuitem"]'));
  expect([...container.querySelectorAll('[role="alert"]')].map((el) => el.textContent)).toEqual([
    "refresh failed",
    "Could not save the page.",
  ]);
  expect(byText("Retry", "button")).toBeDefined();
});

it("Sources lists the page's sources and removes one after confirming", async () => {
  mocks.removeSource.mockResolvedValue({ ok: true });
  await render();
  await openMenu();
  await click(byText("Sources", '[role="menuitem"]'));
  expect(document.body.textContent).toContain("finance_overview");
  await click(document.querySelector('[aria-label="cash options"]'));
  await click(byText("Remove", '[role="menuitem"]'));
  expect(mocks.removeSource).not.toHaveBeenCalled();
  mocks.sources.mockResolvedValue([]);
  await click(byText("Remove", "button"));
  expect(mocks.removeSource).toHaveBeenCalledWith({ botId: "bot_demo", sourceId: "s1" });
  expect(document.body.textContent).toContain("No sources");
});

it("changes a source's schedule, pauses it and resumes it", async () => {
  mocks.setSourceSchedule.mockResolvedValue({ ...source, schedule: "1d" });
  mocks.pauseSource.mockResolvedValue({ ...source, schedule: "1d", status: "paused" });
  mocks.resumeSource.mockResolvedValue({ ...source, schedule: "1d" });
  await render();
  await openMenu();
  await click(byText("Sources", '[role="menuitem"]'));
  expect(document.body.textContent).toContain("finance_overview · Hourly");
  await click(document.querySelector('[aria-label="cash options"]'));
  await click(byText("Change schedule", '[role="menuitem"]'));
  await click(byText("Daily", '[role="menuitemradio"]'));
  expect(mocks.setSourceSchedule).toHaveBeenCalledWith({
    botId: "bot_demo",
    sourceId: "s1",
    schedule: "1d",
  });
  expect(document.body.textContent).toContain("finance_overview · Daily");
  await click(document.querySelector('[aria-label="cash options"]'));
  expect(byText("Resume", '[role="menuitem"]')).toBeUndefined();
  await click(byText("Pause", '[role="menuitem"]'));
  expect(mocks.pauseSource).toHaveBeenCalledWith({ botId: "bot_demo", sourceId: "s1" });
  expect(document.body.textContent).toContain("paused");
  await click(document.querySelector('[aria-label="cash options"]'));
  expect(byText("Pause", '[role="menuitem"]')).toBeUndefined();
  await click(byText("Resume", '[role="menuitem"]'));
  expect(mocks.resumeSource).toHaveBeenCalledWith({ botId: "bot_demo", sourceId: "s1" });
});

it("shows the error and Retry on the warning dot, and Retry reruns the sources", async () => {
  mocks.data.mockResolvedValue({
    ...data("$86K"),
    blocks: [
      { status: "failed", fetchedAt: "2026-01-01T08:00:00.000Z", error: "timed out", text: "$86K" },
      { status: "ok", fetchedAt: null, rows: [] },
    ],
  });
  mocks.refresh.mockResolvedValue(data("$87K"));
  await render();
  await click(container.querySelector('[aria-label="Source failed"]'));
  expect(document.body.textContent).toContain("timed out");
  await click(byText("Retry", "button"));
  expect(mocks.refresh).toHaveBeenCalledTimes(1);
  expect(text()).toContain("$87K");
});

it("Share makes the snapshot link and Stop sharing revokes the snapshot artifact", async () => {
  mocks.share.mockResolvedValue({
    url: "https://app.example.test/s#tok",
    expiresAt: "2026-11-29T00:00:00.000Z",
    artifactId: "art1",
  });
  mocks.shareStatus.mockResolvedValue(null);
  revoke.mockResolvedValue({ ok: true });
  await render();
  await openMenu();
  await click(byText("Share", '[role="menuitem"]'));
  expect(mocks.share).toHaveBeenCalledWith({ botId: "bot_demo", pageId: "p1" });
  const input = document.querySelector<HTMLInputElement>("input[readonly]");
  expect(input?.value).toBe("https://app.example.test/s#tok");
  await click(byText("Stop sharing", "button"));
  await click(
    [...document.querySelectorAll("button")].filter((b) => b.textContent === "Stop sharing").at(-1),
  );
  expect(revoke).toHaveBeenCalledWith({ artifactId: "art1" });
  expect(document.querySelector("input[readonly]")).toBeNull();
});

it("puts the single Page options button in the header row on the full-width page", async () => {
  await render({ fixedPageId: "p1" });
  const buttons = container.querySelectorAll('[aria-label="Page options"]');
  expect(buttons).toHaveLength(1);
  expect(buttons[0]?.closest("[data-page-header]")).not.toBeNull();
  expect(container.querySelector("h1")?.textContent).toBe("Cash");
});

it("keeps the options menu out of a page header in the docked panel", async () => {
  await render();
  expect(container.querySelector("[data-page-header]")).toBeNull();
});

it("leaves Markdown table borders out of live tables", async () => {
  await render();
  const cls = container.querySelector('[role="textbox"]')?.getAttribute("class") ?? "";
  expect(cls).not.toMatch(/(^|\s)\[&_td\]:border/);
  expect(cls).toContain("[&_table:not([data-slot=table])_td]:border");
});

it("opens the review from a pending block on the full-width page only", async () => {
  mocks.data.mockResolvedValue({
    ...data(""),
    blocks: [
      { status: "pending", fetchedAt: null },
      { status: "pending", fetchedAt: null },
    ],
  });
  const onReview = vi.fn();
  await render({ fixedPageId: "p1", onReview });
  const link = [...container.querySelectorAll("button")].find((b) =>
    b.textContent?.includes("Waiting for approval"),
  );
  await act(async () => link?.click());
  expect(onReview).toHaveBeenCalled();
  await render({ fixedPageId: undefined, onReview });
  expect(
    [...container.querySelectorAll("button")].some((b) =>
      b.textContent?.includes("Waiting for approval"),
    ),
  ).toBe(false);
});

it("reopens an existing share without replacing its link, then Replace link makes a new one", async () => {
  mocks.shareStatus.mockResolvedValue({ artifactId: "a1", expiresAt: "2026-11-29T00:00:00.000Z" });
  mocks.share.mockResolvedValue({
    url: "https://app.example.test/s#new",
    expiresAt: "2026-11-29T00:00:00.000Z",
    artifactId: "a2",
  });
  revoke.mockResolvedValue({ ok: true });
  await render();
  await openMenu();
  await click(byText("Share", '[role="menuitem"]'));
  expect(mocks.shareStatus).toHaveBeenCalledWith({ botId: "bot_demo", pageId: "p1" });
  expect(mocks.share).not.toHaveBeenCalled();
  expect(document.querySelector("input[readonly]")).toBeNull();
  await click(byText("Replace link", "button"));
  expect(mocks.share).toHaveBeenCalledTimes(1);
  expect(document.querySelector<HTMLInputElement>("input[readonly]")?.value).toBe(
    "https://app.example.test/s#new",
  );
});

it("stops a reopened share by its artifact id", async () => {
  mocks.shareStatus.mockResolvedValue({ artifactId: "a1", expiresAt: "2026-11-29T00:00:00.000Z" });
  revoke.mockResolvedValue({ ok: true });
  await render();
  await openMenu();
  await click(byText("Share", '[role="menuitem"]'));
  await click(byText("Stop sharing", "button"));
  await click(
    [...document.querySelectorAll("button")].filter((b) => b.textContent === "Stop sharing").at(-1),
  );
  expect(revoke).toHaveBeenCalledWith({ artifactId: "a1" });
});

it("returns focus to the editor after deleting a live block, so Ctrl+Z restores it", async () => {
  await render();
  const buttons = () => container.querySelectorAll('[aria-label="Delete block"]');
  expect(buttons()).toHaveLength(2);
  // ProseMirror groups edits made within 500 ms into one undo step; a person is slower than that.
  await act(async () => new Promise((resolve) => setTimeout(resolve, 600)));
  await click(buttons()[0]);
  expect(buttons()).toHaveLength(1);
  const editor = container.querySelector('[role="textbox"]');
  expect(document.activeElement).toBe(editor);
  await act(async () => {
    editor?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "z", ctrlKey: true, bubbles: true, cancelable: true }),
    );
  });
  expect(buttons()).toHaveLength(2);
});

it("hides the live block delete button on touch screens", async () => {
  await render();
  const cls = container.querySelector('[aria-label="Delete block"]')?.getAttribute("class") ?? "";
  expect(cls).toContain("pointer-coarse:hidden");
});
