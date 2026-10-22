// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ROUTE_BOT_GIVE_UP_MS, useGiveUpOnMissingBot } from "./route-bot";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ waiting, onGiveUp }: { waiting: boolean; onGiveUp: () => void }) {
  useGiveUpOnMissingBot(waiting, "bot-1", onGiveUp);
  return null;
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

it("gives up on a route bot that stays unknown, and only then", () => {
  const onGiveUp = vi.fn();
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe waiting onGiveUp={onGiveUp} />));
  act(() => vi.advanceTimersByTime(ROUTE_BOT_GIVE_UP_MS - 1));
  expect(onGiveUp).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onGiveUp).toHaveBeenCalledOnce();
});

it("does nothing once the bot is found", () => {
  const onGiveUp = vi.fn();
  const root = createRoot(document.createElement("div"));
  act(() => root.render(<Probe waiting onGiveUp={onGiveUp} />));
  act(() => root.render(<Probe waiting={false} onGiveUp={onGiveUp} />));
  act(() => vi.advanceTimersByTime(ROUTE_BOT_GIVE_UP_MS * 2));
  expect(onGiveUp).not.toHaveBeenCalled();
});
