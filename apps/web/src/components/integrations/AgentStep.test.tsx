// @vitest-environment jsdom

import type { Bot } from "@rakazo/contracts";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { Dialog, DialogContent } from "@rakazo/ui-web";
import { AgentStep } from "./AgentStep";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
window.matchMedia ??= () =>
  ({ matches: true, addEventListener() {}, removeEventListener() {} }) as unknown as MediaQueryList;

const bots = [
  { id: "a", name: "Ada", color: "#000" },
  { id: "b", name: "Bram", color: "#000" },
] as unknown as Bot[];

it("starts with every bot unchecked and continues with only the ones the owner picks", async () => {
  const onContinue = vi.fn();
  const container = document.createElement("div");
  document.body.append(container);
  await act(async () =>
    createRoot(container).render(
      <Dialog open>
        <DialogContent>
          <AgentStep
            appName="Sample"
            bots={bots}
            busy={false}
            error={null}
            onContinue={onContinue}
            onSkip={vi.fn()}
          />
        </DialogContent>
      </Dialog>,
    ),
  );
  const boxes = () => [...document.querySelectorAll<HTMLElement>('[role="checkbox"]')];
  expect(boxes().map((box) => box.getAttribute("aria-checked"))).toEqual(["false", "false"]);
  const button = (name: string) =>
    [...document.querySelectorAll("button")].find((b) => b.textContent === name)!;
  await act(async () => button("Continue").click());
  expect(onContinue).toHaveBeenLastCalledWith([]);
  await act(async () => boxes()[1]!.click());
  await act(async () => button("Continue").click());
  expect(onContinue).toHaveBeenLastCalledWith(["b"]);
});
