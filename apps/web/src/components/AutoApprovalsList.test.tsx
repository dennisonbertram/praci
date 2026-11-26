// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (strings: TemplateStringsArray) => strings[0] }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => ({
  Button: (props: React.ComponentProps<"button">) => <button type="button" {...props} />,
}));
vi.mock("../lib/user-error", () => ({ errorText: () => "Could not undo" }));
const autoReview = vi.hoisted(() => ({ approvals: vi.fn(), undo: vi.fn() }));
vi.mock("../lib/rpc", () => ({ rpc: { autoReview } }));

import { AutoApprovalsList } from "./AutoApprovalsList";

const row = {
  id: "d1",
  tool: "archive_bot",
  botName: "Scout",
  target: "Old helper",
  at: "2026-01-02T08:00:00.000Z",
  undoable: true,
  undone: false,
};

async function mount() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<AutoApprovalsList />));
  await act(async () => {});
  return { container, root };
}

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

it("renders nothing while nothing was approved automatically", async () => {
  autoReview.approvals.mockResolvedValue({ rows: [] });
  const { container, root } = await mount();
  expect(container.innerHTML).toBe("");
  await act(async () => root.unmount());
});

it("lists the agent, action and target, and undoes a row", async () => {
  autoReview.approvals.mockResolvedValue({
    rows: [row, { ...row, id: "d2", tool: "page_edit", target: "plan.md", undoable: false }],
  });
  autoReview.undo.mockResolvedValue({ ok: true });
  const { container, root } = await mount();
  expect(container.textContent).toContain("Approved automatically");
  expect(container.textContent).toContain("Old helper");
  expect(container.textContent).toContain("Scout");
  const buttons = container.querySelectorAll("button");
  expect(buttons).toHaveLength(1);
  await act(async () => buttons[0]?.click());
  expect(autoReview.undo).toHaveBeenCalledWith({ id: "d1" });
  expect(container.querySelectorAll("button")).toHaveLength(0);
  expect(container.textContent).toContain("Undone");
  await act(async () => root.unmount());
});

it("shows the failure on that row only, then reloads", async () => {
  autoReview.approvals.mockResolvedValue({ rows: [row, { ...row, id: "d2", target: "Other" }] });
  autoReview.undo.mockRejectedValue(new Error("no"));
  const { container, root } = await mount();
  await act(async () => container.querySelector("button")?.click());
  const items = container.querySelectorAll("li");
  expect(items[0]?.querySelector("[role=alert]")?.textContent).toBe("Could not undo");
  expect(items[0]?.querySelectorAll("button")).toHaveLength(0);
  expect(items[1]?.querySelector("[role=alert]")).toBeNull();
  expect(items[1]?.querySelectorAll("button")).toHaveLength(1);
  expect(autoReview.approvals).toHaveBeenCalledTimes(2);
  await act(async () => root.unmount());
});

it("shows a failed load with Retry, and Retry recovers", async () => {
  autoReview.approvals.mockRejectedValueOnce(new Error("down"));
  autoReview.approvals.mockResolvedValue({ rows: [row] });
  const { container, root } = await mount();
  expect(container.textContent).toContain("Approved automatically");
  expect(container.querySelector("[role=alert]")?.textContent).toBe("Could not undo");
  const retry = container.querySelector("button");
  expect(retry?.textContent).toBe("Retry");
  await act(async () => retry?.click());
  expect(container.querySelector("[role=alert]")).toBeNull();
  expect(container.textContent).toContain("Old helper");
  await act(async () => root.unmount());
});
