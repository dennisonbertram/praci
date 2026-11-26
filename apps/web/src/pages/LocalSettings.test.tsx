// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ integrationSetup: { get: vi.fn() } }));
vi.mock("../lib/rpc", () => ({ rpc: api }));

import { LocalSettingsPage } from "./LocalSettings";

i18n.loadAndActivate({ locale: "en", messages: {} });
vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);

afterEach(() => {
  document.body.replaceChildren();
  api.integrationSetup.get.mockReset();
});

it("retries a failed settings load and shows settings after it succeeds", async () => {
  api.integrationSetup.get.mockRejectedValueOnce(new Error("offline"));
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(
      <I18nProvider i18n={i18n}>
        <LocalSettingsPage />
      </I18nProvider>,
    );
  });

  expect(container.querySelector('[role="alert"]')?.textContent).toContain(
    "Could not open local settings",
  );
  const retry = [...container.querySelectorAll("button")].find(
    (button) => button.textContent === "Try again",
  );
  expect(retry).toBeDefined();

  api.integrationSetup.get.mockResolvedValueOnce({});
  await act(async () => retry?.click());

  expect(api.integrationSetup.get).toHaveBeenCalledTimes(2);
  expect(container.querySelector('[role="alert"]')).toBeNull();
  expect(container.textContent).toContain("Models");

  await act(async () => root.unmount());
});
