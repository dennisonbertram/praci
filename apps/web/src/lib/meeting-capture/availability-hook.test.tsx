// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const tag = vi.hoisted(
  () =>
    (parts: TemplateStringsArray, ...values: unknown[]) =>
      parts.reduce((out, part, i) => out + part + (i < values.length ? String(values[i]) : ""), ""),
);
vi.mock("@lingui/react/macro", () => ({
  useLingui: () => ({ t: tag }),
  Trans: ({ children }: { children: ReactNode }) => children,
}));
vi.mock("@lingui/core/macro", () => ({ t: tag }));

const rpc = vi.hoisted(() => ({
  voice: { status: vi.fn() },
  spaces: { list: vi.fn() },
}));
vi.mock("../../lib/rpc", () => ({ rpc }));
vi.mock("../../lib/device-speech", () => ({ useDeviceSpeech: () => null }));
vi.mock("../../lib/desktop", () => ({ desktopBridge: () => null }));

import type { RecordAvailability } from "../../lib/meeting-capture/availability";
import { useRecordAvailability } from "../../lib/meeting-capture/availability";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: ReturnType<typeof createRoot>[] = [];
beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
});
afterEach(async () => {
  await act(async () => {
    for (const root of roots.splice(0)) root.unmount();
  });
  vi.useRealTimers();
  document.body.innerHTML = "";
});

/** Renders the hook and keeps its latest answer. */
async function mount() {
  let latest: RecordAvailability = { loaded: false };
  const Probe = () => {
    latest = useRecordAvailability();
    return null;
  };
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => root.render(<Probe />));
  const settle = async () => {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(5_000);
    });
    return latest;
  };
  return { current: () => latest, settle };
}

const space = (meetingRecording: string) => ({
  current: { id: "s1" },
  spaces: [{ id: "s1", meetingRecording, canSetMeetingRecording: true }],
});

it("asks again after five seconds when the check fails once", async () => {
  rpc.voice.status
    .mockRejectedValueOnce(new Error("network"))
    .mockResolvedValue({ transcribe: true });
  rpc.spaces.list.mockImplementation(async () => {
    if (rpc.voice.status.mock.calls.length === 1) throw new Error("network");
    return space("confirm");
  });

  const view = await mount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(view.current()).toEqual({ loaded: false });

  const after = await view.settle();
  expect(rpc.voice.status).toHaveBeenCalledTimes(2);
  expect(after).toEqual({ loaded: true, policy: "confirm", engine: true, device: false });
});

it("gives up after three failed attempts and leaves Record hidden", async () => {
  rpc.voice.status.mockRejectedValue(new Error("network"));
  rpc.spaces.list.mockRejectedValue(new Error("network"));

  const view = await mount();
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(view.current()).toEqual({ loaded: false });
  expect(rpc.voice.status).toHaveBeenCalledTimes(1);

  await view.settle();
  expect(rpc.voice.status).toHaveBeenCalledTimes(2);
  await view.settle();
  expect(rpc.voice.status).toHaveBeenCalledTimes(3);
  // The third failure starts no fourth attempt, however long the page stays open.
  await act(async () => {
    await vi.advanceTimersByTimeAsync(60_000);
  });
  expect(rpc.voice.status).toHaveBeenCalledTimes(3);
  expect(view.current()).toEqual({ loaded: false });
});
