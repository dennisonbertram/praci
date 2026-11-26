// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it } from "vitest";
import { DictationButton } from "./dictation-button";

i18n.loadAndActivate({ locale: "en", messages: {} });

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: ReturnType<typeof createRoot>[] = [];
afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  document.body.innerHTML = "";
});

it("stills the recording pulse under prefers-reduced-motion", async () => {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <DictationButton status="listening" onClick={() => undefined} />
      </I18nProvider>,
    ),
  );
  const icon = container.querySelector("button svg");
  expect(icon?.getAttribute("class")).toContain("animate-pulse");
  expect(icon?.getAttribute("class")).toContain("motion-reduce:animate-none");
});
