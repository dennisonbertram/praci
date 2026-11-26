// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (strings: TemplateStringsArray) => strings[0] }),
  Trans: ({ children }: { children: React.ReactNode }) => children,
}));
vi.mock("@rakazo/ui-web", () => ({
  Label: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  Switch: ({
    checked,
    onCheckedChange,
    ...props
  }: {
    checked: boolean;
    onCheckedChange?: (checked: boolean) => void;
  } & React.ComponentProps<"button">) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));
vi.mock("../lib/user-error", () => ({ errorText: () => "Something went wrong" }));
const autoReview = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), recent: vi.fn() }));
vi.mock("../lib/rpc", () => ({ rpc: { autoReview } }));

import { AutoReviewSettings } from "./AutoReviewSettings";

async function mount() {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<AutoReviewSettings />));
  await act(async () => {});
  return { container, root };
}

it("shows the background switch only while Auto Review is on, and saves each switch", async () => {
  autoReview.recent.mockResolvedValue([]);
  autoReview.get.mockResolvedValue({ enabled: false, background: false, checkerAvailable: true });
  autoReview.set.mockImplementation(async (patch) => ({
    enabled: false,
    background: false,
    checkerAvailable: true,
    ...patch,
  }));
  const { container, root } = await mount();
  expect(container.querySelectorAll("[role=switch]")).toHaveLength(1);
  await act(async () => container.querySelector<HTMLElement>("[role=switch]")?.click());
  expect(autoReview.set).toHaveBeenCalledWith({ enabled: true });
  const switches = container.querySelectorAll<HTMLElement>("[role=switch]");
  expect(switches).toHaveLength(2);
  await act(async () => switches[1]?.click());
  expect(autoReview.set).toHaveBeenLastCalledWith({ background: true });
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("lists what Auto Review recently approved", async () => {
  autoReview.get.mockResolvedValue({ enabled: true, background: true, checkerAvailable: true });
  autoReview.recent.mockResolvedValue([
    { id: "e1", tool: "page_source_list", reason: "Fits the routine.", at: "2026-01-02T08:00:00Z", botName: "Scout" },
  ]);
  const { container, root } = await mount();
  expect(container.textContent).toContain("Recently approved by Auto Review");
  expect(container.textContent).toContain("Fits the routine.");
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

it("keeps the approved list and names the agent while Auto Review is off", async () => {
  autoReview.get.mockResolvedValue({ enabled: false, background: false, checkerAvailable: true });
  autoReview.recent.mockResolvedValue([
    {
      id: "e1",
      tool: "page_source_list",
      reason: "Fits the routine.",
      at: "2026-01-02T08:00:00Z",
      botName: "Scout",
    },
  ]);
  const { container, root } = await mount();
  expect(container.textContent).toContain("Recently approved by Auto Review");
  expect(container.querySelector("li")?.textContent).toContain(" · Scout · Fits the routine.");
  await act(async () => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});
