// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: string }) => children,
}));

import { HiddenBotsList } from "./HiddenBotsList";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
vi.stubGlobal("matchMedia", () => ({
  matches: false,
  addEventListener: () => undefined,
  removeEventListener: () => undefined,
}));

it("lists hidden bots with a Show button, and renders nothing when there are none", async () => {
  const onShow = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<HiddenBotsList bots={[]} onShow={onShow} />));
  expect(container.innerHTML).toBe("");
  await act(async () =>
    root.render(
      <HiddenBotsList bots={[{ id: "b1", name: "Ada", color: "#6366f1" }]} onShow={onShow} />,
    ),
  );
  expect(container.textContent).toContain("Ada");
  const show = [...container.querySelectorAll("button")].find((b) => b.textContent === "Show");
  await act(async () => show?.click());
  expect(onShow).toHaveBeenCalledWith("b1");
  container.remove();
});
