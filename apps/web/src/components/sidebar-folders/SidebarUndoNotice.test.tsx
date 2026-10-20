// @vitest-environment jsdom

import { i18n } from "@lingui/core";
import { I18nProvider } from "@lingui/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { SidebarUndoNotice } from "./SidebarUndoNotice";

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
