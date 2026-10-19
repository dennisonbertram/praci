// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (parts: TemplateStringsArray) => parts.join("") }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { PageAgentIntro, pageAgentKind } from "./PageAgentIntro";

i18n.loadAndActivate({ locale: "en", messages: {} });

it("recognises page agents by their spawn key and leaves other bots alone", () => {
  expect(pageAgentKind("inbox-agent:user1")).toBe("inbox");
  expect(pageAgentKind("finance-agent:user1")).toBe("finance");
  expect(pageAgentKind("carta-agent:user1")).toBe("carta");
  expect(pageAgentKind("data-room-agent:user1")).toBe("data-room");
  expect(pageAgentKind("onboarding:first")).toBeNull();
  expect(pageAgentKind(null)).toBeNull();
});

it("gives the Finance agent's empty chat an introduction and questions that send", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  const onAsk = vi.fn();
  try {
    await act(async () =>
      root.render(
        <I18nProvider i18n={i18n}>
          <PageAgentIntro kind="finance" onAsk={onAsk} />
        </I18nProvider>,
      ),
    );
    expect(container.textContent).toContain("runway");
    const first = container.querySelector("button");
    await act(async () => first?.click());
    expect(onAsk).toHaveBeenCalledWith("How much runway do we have?");
  } finally {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  }
});
