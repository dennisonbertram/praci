// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  REFETCH_INTERVAL_MS,
  RETURN_DEDUPE_MS,
  useRefetchWhileOpen,
} from "./use-refetch-while-open";

function Probe({ enabled, refetch }: { enabled: boolean; refetch: () => void }) {
  useRefetchWhileOpen(enabled, refetch);
  return null;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
});
afterEach(() => vi.useRealTimers());

it("refetches on focus, on a notification and every minute, and stops when disabled", () => {
  const refetch = vi.fn();
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe enabled refetch={refetch} />));
  act(() => {
    window.dispatchEvent(new Event("focus"));
  });
  act(() => {
    window.dispatchEvent(new CustomEvent("rakazo:notifications-changed"));
  });
  expect(refetch).toHaveBeenCalledTimes(2);
  act(() => {
    vi.advanceTimersByTime(REFETCH_INTERVAL_MS);
  });
  expect(refetch).toHaveBeenCalledTimes(3);
  act(() => root.render(<Probe enabled={false} refetch={refetch} />));
  act(() => {
    window.dispatchEvent(new Event("focus"));
    vi.advanceTimersByTime(REFETCH_INTERVAL_MS);
  });
  expect(refetch).toHaveBeenCalledTimes(3);
  act(() => root.unmount());
});

it("refetches once when returning to the tab fires both focus and visibilitychange", () => {
  const refetch = vi.fn();
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe enabled refetch={refetch} />));
  act(() => {
    document.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
  });
  expect(refetch).toHaveBeenCalledTimes(1);
  act(() => {
    vi.advanceTimersByTime(RETURN_DEDUPE_MS);
    window.dispatchEvent(new Event("focus"));
  });
  expect(refetch).toHaveBeenCalledTimes(2);
  act(() => root.unmount());
});
