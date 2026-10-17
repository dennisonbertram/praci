// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { AgentPanelIntro } from "./AgentPanelIntro";

afterEach(() => {
  document.body.innerHTML = "";
});

it("says what the bot does and sends the suggestion that was picked", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const onPick = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () => {
    createRoot(container).render(
      <AgentPanelIntro
        description="Answers questions about your bank accounts."
        suggestions={["What is our runway?", "Where did spend go up?"]}
        onPick={onPick}
      />,
    );
  });
  expect(container.textContent).toContain("Answers questions about your bank accounts.");
  const second = [...container.querySelectorAll("button")].find(
    (b) => b.textContent === "Where did spend go up?",
  );
  await act(async () => second?.click());
  expect(onPick).toHaveBeenCalledWith("Where did spend go up?");
});
