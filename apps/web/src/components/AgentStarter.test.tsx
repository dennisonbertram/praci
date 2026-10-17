// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { AgentStarter } from "./AgentStarter";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("explains the agent and sends the question that is picked", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const onPick = vi.fn();
  await act(async () =>
    root.render(
      <AgentStarter description="Reads Carta." prompts={["Who owns what?"]} onPick={onPick} />,
    ),
  );
  expect(container.textContent).toContain("Reads Carta.");
  await act(async () => container.querySelector("button")?.click());
  expect(onPick).toHaveBeenCalledWith("Who owns what?");
  act(() => root.unmount());
});
