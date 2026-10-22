// @vitest-environment jsdom
import type { BotPage } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), save: vi.fn() }));
vi.mock("../../lib/rpc", () => ({ rpc: { pages: mocks } }));
vi.mock("@lingui/core/macro", () => ({
  t: (parts: TemplateStringsArray) => parts.join(""),
}));
vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { BotPagePanel } from "./bot-page-panel";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
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
  vi.resetAllMocks();
});

it("reports a never-written page and renders its first remote save without a reload", async () => {
  const onPageChange = vi.fn();
  mocks.get.mockResolvedValue(null);
  await act(async () => {
    root.render(<BotPagePanel botId="bot_demo" remote={null} onPageChange={onPageChange} />);
  });
  expect(onPageChange).toHaveBeenCalledWith(null);
  expect(container.querySelector('[role="textbox"]')).toBeNull();

  const page: BotPage = {
    botId: "bot_demo",
    content: "# Created by agent",
    revision: 1,
    updatedBy: "bot",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
  mocks.get.mockResolvedValue(page);
  await act(async () => {
    root.render(
      <BotPagePanel
        botId="bot_demo"
        remote={{ revision: 1, updatedBy: "bot", seq: 1 }}
        onPageChange={onPageChange}
      />,
    );
  });
  expect(onPageChange).toHaveBeenLastCalledWith(page);
  expect(container.querySelector('[role="textbox"]')?.textContent).toContain("Created by agent");
  expect(mocks.save).not.toHaveBeenCalled();
});

it("keeps a failed initial load visible instead of reporting a missing page", async () => {
  const onPageChange = vi.fn();
  mocks.get.mockRejectedValue(new Error("Could not load the page."));
  await act(async () => {
    root.render(<BotPagePanel botId="bot_demo" remote={null} onPageChange={onPageChange} />);
  });
  expect(onPageChange).not.toHaveBeenCalled();
  expect(container.querySelector('[role="alert"]')?.textContent).toBe("Could not load the page.");
});
