// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { SHOWN_MS, SidebarUndoNotice } from "./SidebarUndoNotice";

vi.mock("@lingui/react/macro", () => ({
  Trans: ({ children }: { children: ReactNode }) => children,
}));

i18n.loadAndActivate({ locale: "en", messages: {} });
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("dismisses once, 8 seconds after it appears, however often the parent re-renders", async () => {
  const dismissed = vi.fn();
  const root = createRoot(document.createElement("div"));
  const show = () =>
    root.render(
      <I18nProvider i18n={i18n}>
        <SidebarUndoNotice message="Auto-grouped" onUndo={() => {}} onDismiss={() => dismissed()} />
      </I18nProvider>,
    );
  await act(async () => show());
  for (let second = 1; second < 8; second++) {
    await act(async () => {
      vi.advanceTimersByTime(1000);
      show();
    });
  }
  expect(dismissed).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTime(1000));
  expect(dismissed).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});

it("waits while a restore is in flight instead of dismissing under it", async () => {
  const dismissed = vi.fn();
  const root = createRoot(document.createElement("div"));
  const show = (hold: boolean) =>
    root.render(
      <I18nProvider i18n={i18n}>
        <SidebarUndoNotice
          message="Report archived"
          onUndo={() => {}}
          onDismiss={() => dismissed()}
          hold={hold}
        />
      </I18nProvider>,
    );
  await act(async () => show(true));
  await act(async () => vi.advanceTimersByTime(30_000));
  expect(dismissed).not.toHaveBeenCalled();
  await act(async () => show(false));
  await act(async () => vi.advanceTimersByTime(SHOWN_MS));
  expect(dismissed).toHaveBeenCalledTimes(1);
  await act(async () => root.unmount());
});
