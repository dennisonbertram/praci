// @vitest-environment jsdom
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { GroupIntro } from "./GroupIntro";

it("lists the members and asks everyone from the starter button", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
  const onAsk = vi.fn();
  const el = document.body.appendChild(document.createElement("div"));
  const root = createRoot(el);
  await act(async () =>
    root.render(
      <GroupIntro
        members={[
          { botId: "b1", name: "Chief", color: "#000000" },
          { botId: "b2", name: "Legal Desk", color: "#000000" },
        ]}
        onAsk={onAsk}
      />,
    ),
  );
  expect([...el.querySelectorAll("li")].map((li) => li.textContent)).toEqual([
    "Chief",
    "Legal Desk",
  ]);
  await act(async () => el.querySelector("button")?.click());
  expect(onAsk).toHaveBeenCalledWith("Quick status check from everyone, please");
  await act(async () => root.unmount());
  vi.unstubAllGlobals();
});
