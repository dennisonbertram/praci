// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { WindowChrome } from "./WindowChrome";

i18n.loadAndActivate({ locale: "en", messages: {} });

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Bridge = NonNullable<typeof window.rakazoDesktop>;

const roots: ReturnType<typeof createRoot>[] = [];
afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document.body.innerHTML = "";
  window.rakazoDesktop = undefined;
});

async function mount(node: React.ReactNode) {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(<I18nProvider i18n={i18n}>{node}</I18nProvider>));
  return container;
}

function installBridge() {
  let maximized = false;
  const toggles: number[] = [];
  window.rakazoDesktop = {
    platform: "win32",
    window: {
      close: async () => undefined,
      minimize: async () => undefined,
      toggleMaximize: async () => {
        toggles.push(1);
        maximized = !maximized;
      },
      state: async () => ({ minimized: false, maximized, fullScreen: false }),
    },
  } as Bridge;
  return { toggles };
}

it("names the window control Maximize or Restore, not Fullscreen", async () => {
  const { toggles } = installBridge();
  const container = await mount(<WindowChrome />);
  // The bridge reports the state asynchronously.
  await act(async () => {});
  const control = container.querySelector<HTMLButtonElement>('button[aria-label="Maximize"]');
  if (!control) throw new Error("Maximize button was not rendered");
  expect(control.getAttribute("aria-label")).toBe("Maximize");
  await act(async () => control.click());
  expect(toggles).toHaveLength(1);
  expect(control.getAttribute("aria-label")).toBe("Restore");
});
