// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: (s: TemplateStringsArray | string) => String(s), i18n: { locale: "en" } }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));

import { BotCreatePicker } from "./bot-picker";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it("offers New space only when the account can use a second space", async () => {
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView ??= () => undefined;
  const noop = () => undefined;
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const render = (canCreateSpace: boolean) =>
    act(async () =>
      root.render(
        <BotCreatePicker
          onCreateBot={noop}
          onCreateGroup={noop}
          onCreateSpace={noop}
          onShowGroupInfo={noop}
          onShowSpaceInfo={noop}
          canCreateSpace={canCreateSpace}
        />,
      ),
    );
  await render(false);
  expect(host.querySelector('[data-testid="create-new-group"]')).not.toBeNull();
  expect(host.querySelector('[data-testid="create-new-space"]')).toBeNull();
  await render(true);
  expect(host.querySelector('[data-testid="create-new-space"]')).not.toBeNull();
  await act(async () => root.unmount());
});
